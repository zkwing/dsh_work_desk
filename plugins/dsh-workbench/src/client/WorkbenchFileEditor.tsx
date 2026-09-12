/**
 * The workbench file editor: one right-column tab that shows a Workspace file
 * and, on request, writes it back.
 *
 * ## Why this is not the official viewer
 *
 * The official `text` tab type renders a file read-only on purpose. DSH's client
 * has no write verb (`remote.workspaceFiles` is read-only and `ctx.fs.writeText`
 * is a Host service), so an editable surface has to pair the official read
 * path with a write path this plugin contributes on the Host. That is what this
 * tab is: `POST /workbench/file/read` loads it, `POST /workbench/file/write`
 * saves it — atomically, only while the version it loaded is still current, and
 * under the composition's own sandbox policy.
 *
 * ## Shape
 *
 * A page tab (no resource pattern), because a page is opened by kind with
 * params and its address is this package's bookkeeping. Opening another file
 * navigates the same tab with new params, which is why the body keys its whole
 * state on `tab.navigation.revision`.
 *
 * Reading is deliberate about which side owns what: the text arrives with the
 * file's version token, edits live only in this tab, and Save is the single
 * moment anything reaches the disk. A file that changed underneath — an Agent
 * edit, another program — answers `workbench/stale`, and the editor offers a
 * reload instead of overwriting it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Button, IconLoadingOutline16, IconRefreshOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { SidebarRightTabDefinition } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { FileOpenOutcome } from './workspaces.js'
import css from './Workbench.module.css'

/** The page kind this tab type owns; `openTab` names it. */
export const EDITOR_KIND = 'workbench-editor'

/** This implementation's identity in the tab system, and the key its body registers under. */
export const EDITOR_ID = 'dsh-workbench/editor'

/** The `workbench` namespace's translate function, bound by the plugin's apply. */
type WorkbenchTranslate = TranslateNS<'workbench'>

declare module '@deepseek-ai/dsh-client-ui-sidebar-right/client' {
  interface SidebarRightTabParamsMap {
    /** What the workbench editor is opened with: which file, in which Session. */
    'workbench-editor': { readonly sessionId: string; readonly path: string }
  }
}

/** One file load's outcome, as the Host route answers it. */
export type EditorReadOutcome =
  | { readonly ok: true; readonly text: string; readonly version: string; readonly size: number }
  | { readonly ok: false; readonly code: string; readonly message: string }

/** One save's outcome, as the Host route answers it. */
export type EditorWriteOutcome =
  | { readonly ok: true; readonly version: string }
  | { readonly ok: false; readonly code: string; readonly message: string }

/** What the editor's registration injects. */
export interface EditorInjected {
  /** The `workbench` namespace's translate function. */
  wt: WorkbenchTranslate
  /** Load one file's text and version through the Host route. */
  readFile: (sessionId: string, path: string) => Promise<EditorReadOutcome>
  /** Replace one file's text, guarded by the version the reader loaded. */
  writeFile: (sessionId: string, path: string, text: string, version: string) => Promise<EditorWriteOutcome>
  /** Hand the address to the official viewer instead (Markdown, PDF, images). */
  openPreview: (sessionId: string, path: string) => FileOpenOutcome
}

/** The editor body's props: the tab's runtime share plus this plugin's face. */
export type FileEditorBodyProps = PropsRuntime<'sidebar.right.pane.tab'> & InjectFace<EditorInjected>

/** The editor title's props: the same runtime share, without the file work. */
export type FileEditorTitleProps = PropsRuntime<'sidebar.right.pane.tab.title'> & InjectFace<EditorInjected>

/** The tab type's registry definition: a page, opened by kind. */
export function editorDefinition(t: WorkbenchTranslate): SidebarRightTabDefinition {
  return {
    id: EDITOR_ID,
    kind: EDITOR_KIND,
    priority: 'extension',
    title: () => t('editor.title'),
  }
}

/** One file's loaded state inside the tab. */
type Load =
  | { readonly state: 'loading' }
  | { readonly state: 'ready'; readonly text: string; readonly version: string; readonly size: number }
  | { readonly state: 'failed'; readonly code: string; readonly message: string }

/** The trailing path segment, for the tab title. */
function baseName(path: string): string {
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return cut < 0 ? path : path.slice(cut + 1)
}

/**
 * The number of lines one text has, counting a trailing newline as ending the
 * last line rather than opening an empty one.
 * @param text - the file's text.
 * @returns the line count, at least 1.
 */
function lineCountOf(text: string): number {
  let lines = 1
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 10) lines += 1
  }
  return lines
}

/** The line-number gutter, one cell per line of the view. */
function Gutter({ lines }: { lines: number }): ReactNode {
  return (
    <div className={css.editorGutter} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} className={css.editorLineNo}>{index + 1}</span>
      ))}
    </div>
  )
}

/**
 * Render the editor tab's body.
 * @param props - the tab runtime share and this plugin's injected face.
 * @returns the editor element.
 */
export function FileEditorBody({ useTabInfo, wt: t, readFile, writeFile, openPreview }: FileEditorBodyProps): ReactNode {
  const { tab } = useTabInfo()
  const navigation = tab.navigation
  const params = useMemo(() => {
    const raw = navigation.params as { sessionId?: unknown; path?: unknown } | undefined
    return typeof raw?.sessionId === 'string' && typeof raw.path === 'string'
      ? { sessionId: raw.sessionId, path: raw.path }
      : undefined
  }, [navigation.params])

  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [draft, setDraft] = useState<string | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const [saved, setSaved] = useState(false)
  const alive = useRef(true)
  const request = useRef<AbortController | undefined>(undefined)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      request.current?.abort()
    }
  }, [])

  /** Load (or reload) the file this tab was navigated to. */
  const reload = useCallback((): void => {
    if (params === undefined) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoad({ state: 'loading' })
    setDraft(undefined)
    setNotice(undefined)
    setSaved(false)
    void readFile(params.sessionId, params.path).then((outcome) => {
      if (!alive.current || controller.signal.aborted) return
      setLoad(outcome.ok
        ? { state: 'ready', text: outcome.text, version: outcome.version, size: outcome.size }
        : { state: 'failed', code: outcome.code, message: outcome.message })
    })
  }, [params, readFile])

  // Every navigation — a new file, or the same file opened again — reloads:
  // `revision` bumps even when the params are identical, which is the
  // documented "navigated again" signal.
  useEffect(() => { reload() }, [reload, navigation.revision])

  const text = load.state === 'ready' ? load.text : ''
  const value = draft ?? text
  const dirty = draft !== undefined && draft !== text
  const lines = useMemo(() => lineCountOf(value), [value])

  /** Save the draft, guarded by the version this tab loaded. */
  const save = useCallback((): void => {
    if (params === undefined || load.state !== 'ready' || draft === undefined) return
    setSaving(true)
    setNotice(undefined)
    void writeFile(params.sessionId, params.path, draft, load.version).then((outcome) => {
      if (!alive.current) return
      setSaving(false)
      if (outcome.ok) {
        setLoad({ state: 'ready', text: draft, version: outcome.version, size: load.size })
        setDraft(undefined)
        setSaved(true)
        return
      }
      setNotice(outcome.code === 'workbench/stale'
        ? t('editor.stale')
        : `${t('editor.saveFailed')}: ${outcome.message}`)
    })
  }, [draft, load, params, t, writeFile])

  if (params === undefined) {
    return <p className={css.editorNote}>{t('editor.noTarget')}</p>
  }

  const name = baseName(params.path)

  return (
    <div className={css.editor} data-editor-state={load.state}>
      <div className={css.editorHead}>
        <span className={css.editorName} title={params.path}>{name}</span>
        {dirty && <span className={css.editorDirty} title={t('editor.dirty')}>●</span>}
        <span className={css.editorTools}>
          {load.state === 'ready' && (
            <span className={css.editorMeta}>
              {lines} {t('editor.lines')} · {load.size} B
            </span>
          )}
          {draft !== undefined && (
            <button
              type="button"
              className={css.pickerTool}
              aria-label={t('editor.discard')}
              title={t('editor.discard')}
              onClick={() => { setDraft(undefined); setNotice(undefined) }}
            >
              ↺
            </button>
          )}
          <button
            type="button"
            className={css.pickerTool}
            aria-label={t('editor.reload')}
            title={t('editor.reload')}
            onClick={reload}
          >
            <IconRefreshOutline16 size={13} />
          </button>
          <button
            type="button"
            className={css.pickerTool}
            aria-label={t('editor.preview')}
            title={t('editor.preview')}
            onClick={() => { openPreview(params.sessionId, params.path) }}
          >
            ◱
          </button>
        </span>
      </div>

      {notice !== undefined && <p className={css.editorNotice} role="alert">{notice}</p>}

      {load.state === 'loading' && (
        <p className={css.editorNote}>
          <IconLoadingOutline16 size={13} className={css.explorerSpin} />
          {t('editor.loading')}
        </p>
      )}

      {load.state === 'failed' && (
        <div className={css.editorNote}>
          <p className={css.editorFailed}>{load.message}</p>
          {/* A binary, oversized, or unreadable file is still worth seeing in the
              viewer that knows how to render it. */}
          <Button variant="outline" size="sm" onClick={() => { openPreview(params.sessionId, params.path) }}>
            {t('editor.preview')}
          </Button>
        </div>
      )}

      {load.state === 'ready' && (
        <>
          <div className={css.editorBody}>
            <Gutter lines={lines} />
            {draft === undefined
              ? <pre className={css.editorText} data-editor-readonly="">{value}</pre>
              : (
                <textarea
                  className={css.editorInput}
                  value={draft}
                  spellCheck={false}
                  aria-label={name}
                  onChange={(event) => { setDraft(event.target.value); setSaved(false) }}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                      event.preventDefault()
                      save()
                    }
                  }}
                />
              )}
          </div>
          <div className={css.editorFoot}>
            <Button
              variant={draft === undefined ? 'outline' : 'ghost'}
              size="sm"
              onClick={() => { setDraft(draft === undefined ? text : undefined); setNotice(undefined); setSaved(false) }}
            >
              {draft === undefined ? t('editor.edit') : t('editor.cancel')}
            </Button>
            <span className={css.editorHint}>{saved ? t('editor.saved') : t('editor.hint')}</span>
            <Button variant="primary" size="sm" disabled={draft === undefined || saving || !dirty} onClick={save}>
              {t('editor.save')}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Render the editor tab's chip title: the file's name.
 * @param props - the tab runtime share and this plugin's injected face.
 * @returns the title element.
 */
export function FileEditorTitle({ useTabInfo, wt: t }: FileEditorTitleProps): ReactNode {
  const { tab } = useTabInfo()
  const raw = tab.navigation.params as { path?: unknown } | undefined
  const name = typeof raw?.path === 'string' ? baseName(raw.path) : t('editor.title')
  return <span className={css.editorChip} title={name}>{name}</span>
}
