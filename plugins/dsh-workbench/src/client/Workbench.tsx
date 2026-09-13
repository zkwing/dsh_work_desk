/**
 * Workbench main panel: the control room as a first-class application panel.
 *
 * This is the shape the app gives a workspace — a selectable surface that takes
 * the center column — rather than a floating overlay. The panel registers under
 * the `main` key `workbench`, and `sidebar.panellist` draws its row in the
 * global panel list, so the workbench toggles like every other panel and never
 * covers the conversation.
 *
 * A card is a Host Workspace, read through the global `useWorkspaces` hook, so
 * the grid mirrors the registry: adding a Workspace anywhere adds a card,
 * removing one removes it, and the workbench keeps no roster of its own. The
 * empty plus card drives the same directory-picking flow the sidebar's own
 * "Add workspace…" entry uses, so both routes end in one Host create call.
 *
 * A card's Files face is a VS Code-shaped explorer: one flat row list carrying
 * per-row depth, indent guides, rotating chevrons, folder and file-type glyphs,
 * the reader's selection, and arrow-key traversal. A level is listed when its
 * directory is first expanded and never for the whole tree at once.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import {
  FileTypeIcon, IconChevronDownOutline14, IconChevronRightOutline14, IconChevronUpOutline14,
  IconFolderClose16, IconFolderOpen16, IconGaugeOutline16, IconLoadingOutline16, IconPlusOutline16,
  IconRefreshOutline16, IconTrashOutline16, IconWarningOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  InjectFace, PropsRuntime, SnapshotSelectorHook, TranslateNS,
} from '@deepseek-ai/dsh-client-ui-slots'
import {
  accentFor, explorerRows, sizeText, splitPath,
  type AddOutcome, type Capabilities, type CapabilitySource, type CardAccent, type ExplorerRow,
  type FileOpenOutcome, type PickerListing, type TreeLevel, type ValueSource, type WorkspaceCardModel,
  type WorkspacesSnapshot,
} from './workspaces.ts'
import type { CardStatus } from './cards.ts'
import { WorkspaceDirectoryPicker } from './WorkspaceDirectoryPicker.tsx'
import css from './Workbench.module.css'

/** The `workbench` namespace's translate function, bound by the plugin's apply. */
export type WorkbenchTranslate = TranslateNS<'workbench'>

/** One directory level's outcome: the level model, ready or failed. */
export type DirectoryLevelResult = { ok: boolean; value: TreeLevel }

/** One picker level's outcome, as the browse primitive answers it. */
export type BrowseOutcome =
  | { readonly ok: true; readonly value: PickerListing }
  | { readonly ok: false; readonly message: string }

/** One folder creation's outcome, as the browse primitive answers it. */
export type MakeOutcome =
  | { readonly ok: true; readonly path: string }
  | { readonly ok: false; readonly message: string }

/**
 * This plugin's business face: what the registration injects, and therefore
 * what the panel's props carry.
 *
 * Every action is always present and resolves its services at call time — the
 * entry's inject face is built once and cached, so a value captured here could
 * never catch a service that mounts later. Which controls those actions back is
 * decided by `hooks.capability`, the one member that stays live.
 */
export interface WorkbenchInjected {
  /** The `workbench` namespace's translate function. */
  wt: WorkbenchTranslate
  /**
   * Live sources, which the framework binds into selector hooks.
   *
   * `capability` (→ `useCapability`) says what this composition mounts;
   * `scheme` (→ `useScheme`) says whether the host palette is dark, which is
   * what picks the background grid's color. Both are sources rather than values
   * because an entry's inject face is built once and cached.
   */
  hooks: { capability: CapabilitySource; scheme: ValueSource<boolean> }
  /**
   * Try the Host's OS chooser. A `browse` outcome means this composition serves
   * the in-app picker instead — a fork in the flow, not a failure.
   */
  pickWorkspace: () => Promise<AddOutcome>
  /** Register one absolute directory as a Workspace (the single adoption step). */
  registerWorkspace: (path: string) => Promise<AddOutcome>
  /** List one directory level for the in-app picker; an absent path lists Home. */
  browseDirectory: (path: string | undefined, signal: AbortSignal) => Promise<BrowseOutcome>
  /** Create one child directory for the in-app picker. */
  makeDirectory: (path: string, name: string) => Promise<MakeOutcome>
  /**
   * Show one file in the right column through `ctx.sidebarRight` — the same
   * route the official file tree takes. Reports rather than throws when this
   * composition mounts no viewer for the address.
   */
  openFile: (sessionId: string, path: string) => FileOpenOutcome
  /** Make one Session current. */
  selectSession: (sessionId: string) => boolean
  /**
   * Select the Conversation as the center column's panel.
   *
   * The right column — and with it any file view — only exists while the
   * Conversation is selected, so opening a file from this global panel always
   * hands the column over.
   */
  showConversation: () => boolean
  /** Open a Workspace's Conversation in the center column. */
  openWorkspace: (workspaceId: string) => Promise<void>
  /** Start a New Session inside a Workspace. */
  startSession: (workspaceId: string) => void
  /** Drop a Workspace registration. */
  removeWorkspace: (workspaceId: string) => void
  /** List one directory level, resolving the Remote namespace per call. */
  listDirectory: (sessionId: string, path: string, signal: AbortSignal) => Promise<DirectoryLevelResult>
}

/**
 * Props this panel receives: the `main` runtime share — which carries the
 * global standard kit, including `useWorkspaces` — plus this plugin's face,
 * whose `hooks` compartment arrives bound as `useCapability`.
 *
 * The composition decides what the panel can do, and says so: with no Workspace
 * capability it still renders its structure and a notice, instead of leaving a
 * blank center column.
 */
export type WorkbenchPanelProps = PropsRuntime<'main'> & InjectFace<WorkbenchInjected>

declare module '@deepseek-ai/dsh-client-ui-slots' {
  /**
   * The global standard kit every slot component receives, as this plugin's
   * program sees it.
   *
   * `useWorkspaces` is declared by `ui-workspace` (it merges the same member
   * into this interface and provides the source through
   * `ctx.slots.provideRoot`). This package cannot see that declaration: it is
   * out-of-tree, so its program resolves the DSH packages through built
   * declaration files, and the module carrying the merge is not one this plugin
   * imports. Restating the member keeps the component's props typed against the
   * very hook the composition provides.
   */
  interface GlobalStandardProps {
    /** Selector hook over the Host Workspace snapshot. */
    useWorkspaces: SnapshotSelectorHook<WorkspacesSnapshot>
  }
}

/**
 * The file explorer: the workspace root and whatever the reader has opened
 * under it, as one flat VS Code-shaped list.
 *
 * State is the reader's alone — which levels are listed, which directories are
 * expanded, and which row is selected. Every listing goes out through the
 * injected `listDirectory`, which resolves the Remote namespace per call, so a
 * level asked for before that namespace mounts reports a failed level with a
 * retry rather than losing the whole face. Each level's request is aborted when
 * it is superseded, when its directory collapses, or when the card unmounts.
 *
 * Gestures follow the editor too: one click selects, a directory's click also
 * opens it, and a file opens on double click (or Enter) into the right column.
 * @param props - the root to browse, its Session, the copy, and the two faces.
 * @returns the explorer element.
 */
function FileExplorer({ root, sessionId, t, listDirectory, available, onOpenFile }: {
  root: string
  sessionId: string | undefined
  t: WorkbenchTranslate
  listDirectory: WorkbenchPanelProps['listDirectory']
  available: boolean
  onOpenFile: (path: string) => void
}) {
  const [levels, setLevels] = useState<ReadonlyMap<string, TreeLevel>>(() => new Map())
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const [selected, setSelected] = useState<string | undefined>(undefined)
  const listRef = useRef<HTMLUListElement>(null)
  const controllers = useRef(new Map<string, AbortController>())
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    const pending = controllers.current
    return () => {
      alive.current = false
      for (const controller of pending.values()) controller.abort()
      pending.clear()
    }
  }, [])

  const load = useCallback((path: string): void => {
    if (sessionId === undefined) return
    controllers.current.get(path)?.abort()
    const controller = new AbortController()
    controllers.current.set(path, controller)
    setLevels((current) => new Map(current).set(path, { status: 'loading', entries: [], truncated: false }))
    void listDirectory(sessionId, path, controller.signal)
      .then((result) => {
        if (!alive.current || controller.signal.aborted) return
        controllers.current.delete(path)
        setLevels((current) => new Map(current).set(path, result.value))
      })
      .catch(() => {
        if (!alive.current || controller.signal.aborted) return
        controllers.current.delete(path)
        setLevels((current) => new Map(current).set(path, {
          status: 'error', entries: [], truncated: false, error: t('tree.error.other'),
        }))
      })
  }, [listDirectory, sessionId, t])

  // The root is listed once, and again whenever the workspace or its Session
  // changes: another card's expansion state belongs to another tree.
  useEffect(() => {
    setLevels(new Map())
    setExpanded(new Set())
    setSelected(undefined)
    for (const controller of controllers.current.values()) controller.abort()
    controllers.current.clear()
    load(root)
  }, [load, root])

  const rows = useMemo(() => explorerRows(root, levels, expanded), [root, levels, expanded])
  // The focusable rows and their indexes, so arrow-key traversal is a lookup
  // rather than a scan: the flat list is the whole navigation model.
  const { indexes, entryRows } = useMemo(() => {
    const map = new Map<string, number>()
    const entries: Array<Extract<ExplorerRow, { kind: 'entry' }>> = []
    for (const row of rows) {
      if (row.kind !== 'entry') continue
      map.set(row.path, entries.length)
      entries.push(row)
    }
    return { indexes: map, entryRows: entries }
  }, [rows])
  const rowCount = entryRows.length

  const toggle = useCallback((row: Extract<ExplorerRow, { kind: 'entry' }>): void => {
    setSelected(row.path)
    if (row.type !== 'directory') return
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(row.path)) next.delete(row.path)
      else next.add(row.path)
      return next
    })
    if (!row.expanded && !levels.has(row.path)) load(row.path)
  }, [levels, load])

  /** Drop every listed level and ask again for the reader's open directories. */
  const reload = useCallback((): void => {
    const open = [...expanded]
    setLevels(new Map())
    for (const path of open) load(path)
    load(root)
  }, [expanded, load, root])

  const focusRow = (index: number): void => {
    const target = listRef.current?.querySelector<HTMLElement>(`[data-explorer-index="${index}"]`)
    target?.focus()
  }

  /**
   * VS Code's traversal: up and down move the selection, right opens a
   * directory or steps into it, left closes it or steps out to its parent, and
   * Enter opens a file the way a double click does.
   * @param event - the row's key event.
   * @param index - the row's position among the focusable rows.
   * @param row - the row itself.
   */
  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>, index: number, row: Extract<ExplorerRow, { kind: 'entry' }>): void => {
    switch (event.key) {
      case 'Enter':
        // A file row's Enter opens it instead of re-running the click: the
        // button's native Enter would otherwise only select.
        if (row.type === 'file') { onOpenFile(row.path); break }
        return
      case 'ArrowDown': focusRow(Math.min(index + 1, rowCount - 1)); break
      case 'ArrowUp': focusRow(Math.max(index - 1, 0)); break
      case 'Home': focusRow(0); break
      case 'End': focusRow(rowCount - 1); break
      case 'ArrowRight':
        if (row.type === 'directory' && !row.expanded) toggle(row)
        else if (row.type === 'directory') focusRow(index + 1)
        else return
        break
      case 'ArrowLeft': {
        if (row.type === 'directory' && row.expanded) { toggle(row); break }
        for (let back = index - 1; back >= 0; back -= 1) {
          const candidate = entryRows[back]
          if (candidate !== undefined && candidate.depth === row.depth - 1) { focusRow(back); break }
        }
        break
      }
      default: return
    }
    event.preventDefault()
  }

  const { directory, name } = splitPath(root)

  if (sessionId === undefined) {
    return (
      <div className={css.explorer}>
        <p className={css.explorerNote} data-explorer-state="no-session">{t('tree.noSession')}</p>
      </div>
    )
  }
  if (!available) {
    return (
      <div className={css.explorer}>
        <p className={css.explorerNote} data-explorer-state="unavailable">{t('tree.unavailable')}</p>
      </div>
    )
  }

  return (
    <div className={css.explorer} data-explorer-root={root}>
      {/* The section header: the folder's name in caps, its parent dimmed, and
          the two tools every explorer has. */}
      <div className={css.explorerHead}>
        <IconChevronDownOutline14 size={12} className={css.explorerCaret} />
        <span className={css.explorerTitle} title={root}>{name.toUpperCase()}</span>
        <span className={css.explorerParent} title={root}>{directory}</span>
        <span className={css.explorerTools}>
          <button
            type="button"
            className={css.explorerTool}
            aria-label={t('tree.collapseAll')}
            title={t('tree.collapseAll')}
            disabled={expanded.size === 0}
            onClick={() => { setExpanded(new Set()) }}
          >
            <IconChevronUpOutline14 size={13} />
          </button>
          <button
            type="button"
            className={css.explorerTool}
            aria-label={t('tree.reload')}
            title={t('tree.reload')}
            onClick={reload}
          >
            <IconRefreshOutline16 size={13} />
          </button>
        </span>
      </div>
      <ul className={css.explorerRows} ref={listRef} role="tree" aria-label={name}>
        {rows.map(row => (row.kind === 'entry'
          ? (
            <ExplorerEntryRow
              key={row.path}
              row={row}
              index={indexes.get(row.path) ?? 0}
              selected={selected === row.path}
              t={t}
              onSelect={toggle}
              onOpenFile={onOpenFile}
              onKeyDown={onKeyDown}
            />
          )
          : <ExplorerNoteRow key={`${row.note}:${row.path}`} row={row} t={t} onRetry={reload} />))}
      </ul>
      <p className={css.explorerFoot}>{t('tree.hint')}</p>
    </div>
  )
}

/** One entry row: guides, chevron, glyph, name, and the size of a file. */
function ExplorerEntryRow({ row, index, selected, t, onSelect, onOpenFile, onKeyDown }: {
  row: Extract<ExplorerRow, { kind: 'entry' }>
  index: number
  selected: boolean
  t: WorkbenchTranslate
  onSelect: (row: Extract<ExplorerRow, { kind: 'entry' }>) => void
  onOpenFile: (path: string) => void
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>, index: number, row: Extract<ExplorerRow, { kind: 'entry' }>) => void
}): ReactNode {
  return (
    <li className={css.explorerItem} role="treeitem" aria-expanded={row.type === 'directory' ? row.expanded : undefined}>
      <button
        type="button"
        className={`${css.explorerRow} ${selected ? css.explorerRowSelected : ''}`}
        data-explorer-index={index}
        data-explorer-kind={row.type}
        title={row.type === 'file' ? `${row.path}\n${t('file.open')}` : row.path}
        onClick={() => { onSelect(row) }}
        onDoubleClick={() => { if (row.type === 'file') onOpenFile(row.path) }}
        onKeyDown={(event) => { onKeyDown(event, index, row) }}
      >
        {/* One guide per ancestor: `depth` columns of the VS Code indent rule. */}
        {Array.from({ length: row.depth }, (_, level) => (
          <span key={level} className={css.explorerGuide} aria-hidden="true" />
        ))}
        <span className={css.explorerGlyph} aria-hidden="true">
          {row.type === 'directory'
            ? (row.expanded ? <IconChevronDownOutline14 size={12} /> : <IconChevronRightOutline14 size={12} />)
            : null}
        </span>
        <span className={css.explorerIcon} aria-hidden="true">
          {row.type === 'directory'
            ? (row.expanded ? <IconFolderOpen16 size={15} /> : <IconFolderClose16 size={15} />)
            : row.type === 'file'
              ? <FileTypeIcon path={row.name} size={15} />
              : <IconWarningOutline16 size={13} />}
        </span>
        <span className={css.explorerName}>{row.name}</span>
        {row.type === 'file' && <span className={css.explorerSize}>{sizeText(row.size)}</span>}
      </button>
    </li>
  )
}

/** One note row: why a level has nothing to show, and how to ask again. */
function ExplorerNoteRow({ row, t, onRetry }: {
  row: Extract<ExplorerRow, { kind: 'note' }>
  t: WorkbenchTranslate
  onRetry: () => void
}): ReactNode {
  const indent = Array.from({ length: row.depth }, (_, level) => (
    <span key={level} className={css.explorerGuide} aria-hidden="true" />
  ))
  if (row.note === 'failed') {
    return (
      <li className={css.explorerItem} data-explorer-note="failed">
        <span className={css.explorerNoteRow}>
          {indent}
          <span className={css.explorerErrorText}>{row.error ?? ''}</span>
          <button type="button" className={css.explorerRetry} onClick={onRetry}>{t('tree.retry')}</button>
        </span>
      </li>
    )
  }
  return (
    <li className={css.explorerItem} data-explorer-note={row.note}>
      <span className={css.explorerNoteRow}>
        {indent}
        {row.note === 'loading' && <IconLoadingOutline16 size={13} className={css.explorerSpin} />}
        <span className={css.explorerNoteText}>
          {row.note === 'loading' ? t('tree.loading') : row.note === 'empty' ? t('tree.empty') : t('tree.truncated')}
        </span>
      </span>
    </li>
  )
}

/** `HH:MM` of an ISO instant, or the raw value when it does not parse. */
function shortTime(iso: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return iso
  return `${at.getHours().toString().padStart(2, '0')}:${at.getMinutes().toString().padStart(2, '0')}`
}

/**
 * The Workspace rows a card grid renders.
 *
 * Split out of the component so the degraded path — a composition that mounts no
 * Workspace UI, so the snapshot source is absent — is a plain function that can
 * be exercised without a renderer, and so the component never reads a field off
 * an absent snapshot.
 * @param snapshot - the Workspace snapshot, or its absence.
 * @returns the rows, empty when there is no snapshot.
 */
export function workspaceItems(snapshot: WorkspacesSnapshot | undefined): readonly WorkspaceCardModel[] {
  return snapshot?.items ?? []
}

/**
 * Selector hook over an empty Workspace snapshot.
 *
 * The panel calls its snapshot hook unconditionally (a Hook cannot be skipped),
 * so when the composition provides none this standby answers the empty grid
 * instead of throwing.
 */
const NO_WORKSPACES = ((selector: (state: WorkspacesSnapshot) => unknown) =>
  selector({ items: [], archivedSessionIds: [] })) as SnapshotSelectorHook<WorkspacesSnapshot>

/**
 * One Workspace card: its identity button, the Workspace path, and a file
 * explorer rooted at that path.
 *
 * The explorer browses the Workspace's own path through the first Session
 * accounted to it, because the Host confines a listing to that Session's
 * workspace root, and a file opens in the right column the way the official
 * file tree opens it. Which controls appear is the capability snapshot's call,
 * not this card's: an action whose service is not mounted is drawn disabled
 * rather than missing, so the card never changes shape as services come and go.
 * @param props - the Workspace, its order index, the capabilities, and the faces.
 * @returns the card element.
 */
function WorkspaceCard({
  workspace, index, t, capability, listDirectory, onOpen, onRemove, onOpenFile,
}: {
  workspace: WorkspaceCardModel
  index: number
  t: WorkbenchTranslate
  capability: Capabilities
  listDirectory: WorkbenchPanelProps['listDirectory']
  onOpen: () => Promise<void>
  onRemove: () => void
  onOpenFile: (path: string) => void
}) {
  const accent: CardAccent = accentFor(index)
  const sessionId = workspace.sessionIds[0]
  // The Host does not surface a "this Workspace is running" signal yet, so the
  // card runs a small local state machine on top of `onOpen`: idle before the
  // operator has opened it, running while the open is in flight, completed
  // once the Promise settles. A future real signal plugs in by replacing the
  // writes into this state — the three strings stay the right vocabulary.
  const [status, setStatus] = useState<CardStatus>('idle')
  const [acknowledged, setAcknowledged] = useState(false)

  /** Drive the card from idle → running → completed, falling back to idle on a rejection. */
  const handleOpen = useCallback(async (): Promise<void> => {
    setStatus('running')
    setAcknowledged(false)
    try {
      await onOpen()
      setStatus('completed')
    } catch {
      setStatus('idle')
    }
  }, [onOpen])

  /**
   * One click anywhere on the card acknowledges a completed card: the green
   * pulse settles down to its idle ring once the operator has seen it. Internal
   * controls stopPropagation so a click on the open/remove button stays its
   * own gesture and does not also acknowledge the card.
   */
  const onCardClick = useCallback((): void => {
    if (status === 'completed' && !acknowledged) setAcknowledged(true)
  }, [status, acknowledged])

  return (
    <article
      className={`${css.card} ${css[`accent_${accent}`] ?? ''} ${css.cardFiles}`}
      data-card-status={status}
      data-card-acknowledged={acknowledged ? 'true' : 'false'}
      onClick={onCardClick}
    >
      <header className={css.cardHead}>
        {/* The card's identity is the workspace's own open gesture: picking it
            connects (reuse-or-create blank Session) and shows the Conversation,
            which is exactly what a row in the official sidebar browser does. */}
        <button
          type="button"
          className={css.cardOpen}
          disabled={!capability.navigation}
          title={`${t('card.activate')} — ${workspace.path}`}
          onClick={(event) => { event.stopPropagation(); void handleOpen() }}
        >
          <span className={css.cardGlyph} aria-hidden="true"><IconFolderClose16 size={16} /></span>
          <span className={css.cardTitle}>{workspace.title}</span>
        </button>
        {capability.workspaces && (
          <button
            type="button"
            className={css.iconOnly}
            aria-label={t('card.remove')}
            title={`${t('card.remove')} — ${t('card.remove.hint')}`}
            onClick={(event) => { event.stopPropagation(); onRemove() }}
          >
            <IconTrashOutline16 size={14} />
          </button>
        )}
      </header>

      <p className={css.cardPath} title={workspace.path}>{workspace.path}</p>

      <FileExplorer
        root={workspace.path}
        sessionId={sessionId}
        t={t}
        listDirectory={listDirectory}
        available={capability.files}
        onOpenFile={(path) => { onOpenFile(path) }}
      />

      <footer className={css.cardFoot}>
        <span className={css.cardUpdated}>
          {t('card.updated')} {shortTime(workspace.updatedAt)}
        </span>
      </footer>
    </article>
  )
}

/**
 * Render the control room as the `workbench` main panel.
 * @param props - the `main` runtime share (carrying `useWorkspaces`) plus this plugin's face.
 * @returns the panel element.
 */
export function WorkbenchPanel({
  wt: t,
  pickWorkspace,
  registerWorkspace,
  browseDirectory,
  makeDirectory,
  openFile,
  selectSession,
  showConversation,
  openWorkspace,
  removeWorkspace,
  listDirectory,
  useWorkspaces,
  useCapability,
  useScheme,
}: WorkbenchPanelProps) {
  const [adding, setAdding] = useState(false)
  const [picking, setPicking] = useState(false)
  const dark = useScheme(darkPalette => darkPalette)
  // The notice names the gesture that failed, not a fixed one: a file that will
  // not open must not read as "could not add the workspace".
  const [error, setError] = useState<{ label: string; message: string } | undefined>(undefined)
  const [now, setNow] = useState(() => new Date())
  // The bound hooks cannot be called conditionally, so an absent source is
  // swapped for a standby: same call, empty grid and no capabilities.
  const readWorkspaces = useWorkspaces ?? NO_WORKSPACES
  const snapshot = readWorkspaces((state: WorkspacesSnapshot) => state)
  const workspaces = workspaceItems(snapshot)
  const capability = useCapability(state => state)
  // Adding needs the registry plus one way to name a directory: the OS chooser's
  // namespace, or `ui-workspace`'s browsing primitives.
  const canAdd = capability.workspaces && (capability.picker || capability.navigation)

  // A one-second clock keeps the panel's clock reading honest about the page
  // still running.
  useEffect(() => {
    const timer = window.setInterval(() => { setNow(new Date()) }, 1000)
    return () => { window.clearInterval(timer) }
  }, [])

  // The scheme attribute lives on the document root, not on the panel root:
  // WorkspaceDirectoryPicker is a body-portaled Modal whose rows sit outside
  // the panel subtree, and mounting the light token override on `:root` is
  // what reaches both the panel and the portal in one rule. The cleanup drops
  // the attribute only when this plugin set it, so a host that already carries
  // one is left untouched.
  useEffect(() => {
    const root = document.documentElement
    const previous = root.getAttribute('data-wb-scheme')
    root.setAttribute('data-wb-scheme', dark ? 'dark' : 'light')
    return () => {
      if (previous === null) root.removeAttribute('data-wb-scheme')
      else root.setAttribute('data-wb-scheme', previous)
    }
  }, [dark])

  /**
   * Act on one add outcome. Failures are shown, never swallowed: a picker that
   * refuses and a Host that rejects both used to leave the button looking dead.
   * @param outcome - what the flow reported.
   */
  const settle = useCallback((outcome: AddOutcome): void => {
    switch (outcome.kind) {
      case 'browse': setPicking(true); break
      case 'failed': setError({ label: t('notice.addFailed'), message: outcome.message }); break
      default: break
    }
  }, [t])

  // Both add routes run the same flow, so neither can be enabled without the
  // registry and a directory source that flow needs.
  const onAdd = useCallback(() => {
    if (!canAdd) return
    setError(undefined)
    setAdding(true)
    void pickWorkspace().then(settle).finally(() => { setAdding(false) })
  }, [canAdd, pickWorkspace, settle])

  /** Adopt the directory the in-app picker confirmed. */
  const onPicked = useCallback((path: string): void => {
    setPicking(false)
    setAdding(true)
    void registerWorkspace(path).then(settle).finally(() => { setAdding(false) })
  }, [registerWorkspace, settle])

  /**
   * Show one file of one card in the right column.
   *
   * The right column is not merely session content: `ui-sidebar-right` mounts
   * its session seat **only while the Conversation is the selected main panel**
   * (`RightbarRoot` returns null for any global panel). The workbench *is* a
   * global panel, so the file cannot go anywhere until the column is handed
   * over: the first refusal selects this Workspace's own session, selects the
   * Conversation, and then polls, because the seat appears one render later and
   * the session may still be loading.
   * @param workspace - the card the file belongs to.
   * @param path - the file's absolute path.
   */
  const openCardFile = useCallback((workspace: WorkspaceCardModel, path: string): void => {
    const sessionId = workspace.sessionIds[0]
    if (sessionId === undefined) {
      setError({ label: t('notice.openFailed'), message: t('file.noSession') })
      return
    }
    // 25 × 200 ms: long enough for a session to load and the frame to commit,
    // short enough that a real failure is reported while the reader is looking.
    const attempt = (tries: number): void => {
      const outcome = openFile(sessionId, path)
      if (outcome.ok) {
        setError(undefined)
        return
      }
      if (outcome.code !== 'pane/no-session') {
        setError({ label: t('notice.openFailed'), message: outcome.message })
        return
      }
      if (tries === 0) {
        // Hand the center column over: select the file's own session, then the
        // Conversation, which is what brings the right column into existence.
        if (!selectSession(sessionId)) openWorkspace(workspace.workspaceId)
        showConversation()
      }
      if (tries >= 25) {
        setError({ label: t('notice.openFailed'), message: outcome.message })
        return
      }
      window.setTimeout(() => { attempt(tries + 1) }, 200)
    }
    attempt(0)
  }, [openFile, openWorkspace, selectSession, showConversation, t])

  const readings = useMemo(() => {
    const sessions = workspaces.reduce((total, workspace) => total + workspace.sessionIds.length, 0)
    const latest = workspaces.reduce<string | undefined>((newest, workspace) => (
      newest === undefined || workspace.updatedAt > newest ? workspace.updatedAt : newest
    ), undefined)
    const clock = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
    return [
      { id: 'workspaces', label: t('metric.workspaces'), value: `${workspaces.length}`, hint: t('metric.workspaces.hint') },
      { id: 'sessions', label: t('metric.sessions'), value: `${sessions}`, hint: t('metric.sessions.hint') },
      { id: 'recent', label: t('metric.recent'), value: latest === undefined ? '—' : shortTime(latest), hint: t('metric.recent.hint') },
      { id: 'clock', label: t('metric.clock'), value: clock, hint: '' },
    ]
  }, [workspaces, now, t])

  return (
    <div
      className={css.workbench}
      role="region"
      aria-label={t('title')}
    >
      <header className={css.panelHead}>
        <div className={css.headIdentity}>
          <span className={css.headGlyph} aria-hidden="true"><IconGaugeOutline16 size={18} /></span>
          <div className={css.headText}>
            <h2 className={css.title}>{t('title')}</h2>
            <p className={css.subtitle}>{t('subtitle')}</p>
          </div>
        </div>
        <div className={css.headActions}>
          <span className={css.live}>
            <span className={css.liveDot} aria-hidden="true" />
            {t('live')}
          </span>
          <button
            type="button"
            className={css.action}
            disabled={adding || !canAdd}
            onClick={onAdd}
          >
            <IconPlusOutline16 size={14} />
            {t('action.add')}
          </button>
          <button type="button" className={css.action} onClick={() => { setNow(new Date()) }}>
            <IconRefreshOutline16 size={14} />
            {t('action.refresh')}
          </button>
        </div>
      </header>

      {!canAdd && (
        <p className={css.notice}>{t('notice.noWorkspaceService')}</p>
      )}

      {/* A failed add says what failed and stays out of the way: the previous
          behaviour — a rejected promise nobody awaited — showed nothing at all. */}
      {error !== undefined && (
        <p className={css.noticeError} role="alert">
          <span className={css.noticeErrorText}>{error.label}: {error.message}</span>
          <button
            type="button"
            className={css.noticeClose}
            aria-label={t('notice.dismiss')}
            onClick={() => { setError(undefined) }}
          >
            ✕
          </button>
        </p>
      )}

      <section className={css.readings} aria-label={t('metrics.label')}>
        {readings.map(reading => (
          <div key={reading.id} className={css.reading}>
            <span className={css.readingLabel}>{reading.label}</span>
            <span className={css.readingValue}>{reading.value}</span>
            {reading.hint !== '' && <span className={css.readingHint}>{reading.hint}</span>}
          </div>
        ))}
      </section>

      <section className={css.projects} aria-label={t('projects.label')}>
        {workspaces.length === 0 && (
          <div className={css.empty}>
            <span className={css.emptyGlyph} aria-hidden="true"><IconGaugeOutline16 size={22} /></span>
            <p className={css.emptyTitle}>{t('empty.title')}</p>
            <p className={css.emptyHint}>{t('empty.hint')}</p>
          </div>
        )}
        {workspaces.map((workspace, index) => (
          <WorkspaceCard
            key={workspace.workspaceId}
            workspace={workspace}
            index={index}
            t={t}
            capability={capability}
            listDirectory={listDirectory}
            onOpen={() => openWorkspace(workspace.workspaceId)}
            onRemove={() => { removeWorkspace(workspace.workspaceId) }}
            onOpenFile={path => { openCardFile(workspace, path) }}
          />
        ))}
        {/* The empty card slot: one more route into the same add flow. */}
        <button
          type="button"
          className={css.addCard}
          aria-label={t('card.add')}
          disabled={adding || !canAdd}
          onClick={onAdd}
        >
          <span className={css.addGlyph} aria-hidden="true"><IconPlusOutline16 size={20} /></span>
          <span className={css.addTitle}>{t('card.add')}</span>
          <span className={css.addHint}>{t('card.add.hint')}</span>
        </button>
      </section>

      <footer className={css.panelFoot}>
        <span className={css.footHint}>{t('foot.hint')}</span>
      </footer>

      <WorkspaceDirectoryPicker
        open={picking}
        t={t}
        browseDirectory={browseDirectory}
        makeDirectory={makeDirectory}
        onPicked={onPicked}
        onCancel={() => { setPicking(false) }}
      />
    </div>
  )
}

/**
 * The sidebar panel-list glyph: one gauge, no interaction of its own.
 * @param props - the panel row's presentation share.
 * @returns the glyph.
 */
export function WorkbenchPanelIcon({ size }: PropsRuntime<'sidebar.panellist'>) {
  return <IconGaugeOutline16 size={size} />
}
