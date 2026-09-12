/**
 * The in-app Workspace directory picker.
 *
 * A boot composes exactly one directory-picking interaction. When the Host
 * resolves the **browse** backend there is no OS chooser to drive, `pick` is
 * refused by design, and the browsing primitives (`listDirectory`,
 * `createDirectory`) are the only route from "the operator wants a directory"
 * to an absolute path. This dialog is that route: the same level-by-level
 * browsing the official dialog performs, drawn as the workbench's own modal.
 *
 * It is deliberately not the official dialog: that one is the occupant of
 * ui-workspace's `*.directoryFlow` holes (a `single` slot each, already filled
 * by the composed picker surface) and it is opened by the sidebar and
 * conversation menus' owner-local state. There is no service to raise it from
 * another plugin, so a panel that wants an add action under the browse backend
 * has to bring its own.
 *
 * The address bar is where this dialog earns its keep: the path is an editable
 * field, so a directory can be **typed or pasted** — from Explorer, from a
 * terminal, from a card's own path line — and confirmed with Enter, the way the
 * OS dialog's address bar works. Browsing stays for everything else.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Button, IconFolderClose16, IconLoadingOutline16, IconPlusOutline16, IconRefreshOutline16,
  Input, Modal,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { parentPathOf, pickerCrumbs, pickerEntries, type PickerListing } from './workspaces.ts'
import type { BrowseOutcome, MakeOutcome, WorkbenchTranslate } from './Workbench.tsx'
import css from './Workbench.module.css'

/** Props the panel supplies: the browse face, the copy, and the flow's outcomes. */
export interface DirectoryPickerProps {
  /** Whether the dialog is up. */
  open: boolean
  /** The bound `workbench` translate. */
  t: WorkbenchTranslate
  /** List one level; absent path asks for the host account's home directory. */
  browseDirectory: (path: string | undefined, signal: AbortSignal) => Promise<BrowseOutcome>
  /** Create one child directory under the listed level. */
  makeDirectory: (path: string, name: string) => Promise<MakeOutcome>
  /** The operator confirmed a directory. */
  onPicked: (path: string) => void
  /** The operator dismissed the dialog. */
  onCancel: () => void
}

/** One level's state inside the dialog. */
type Level =
  | { readonly state: 'loading' }
  | { readonly state: 'ready'; readonly listing: PickerListing }
  | { readonly state: 'failed'; readonly message: string }

/**
 * Render the picker dialog.
 * @param props - the browse face, the copy, and the flow's outcomes.
 * @returns the modal element.
 */
export function WorkspaceDirectoryPicker({
  open, t, browseDirectory, makeDirectory, onPicked, onCancel,
}: DirectoryPickerProps): ReactNode {
  const [level, setLevel] = useState<Level>({ state: 'loading' })
  const [showHidden, setShowHidden] = useState(false)
  const [creating, setCreating] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [notice, setNotice] = useState<string | undefined>(undefined)
  // The address bar's own text: it follows the listing, but the reader's typing
  // owns it until the listing they asked for actually lands.
  const [address, setAddress] = useState('')
  const controller = useRef<AbortController | undefined>(undefined)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      controller.current?.abort()
    }
  }, [])

  /**
   * Show one level; an absent path asks the Host for its home directory, which
   * is also how the dialog opens.
   * @param path - the directory to show, or undefined for Home.
   */
  const show = useCallback((path: string | undefined): void => {
    controller.current?.abort()
    const next = new AbortController()
    controller.current = next
    setLevel({ state: 'loading' })
    setNotice(undefined)
    setAddress(path ?? '')
    void browseDirectory(path, next.signal).then((outcome) => {
      if (!alive.current || next.signal.aborted) return
      setLevel(outcome.ok ? { state: 'ready', listing: outcome.value } : { state: 'failed', message: outcome.message })
      // The Host resolves relative paths, `~`, and short names; its answer is
      // what the field shows once it lands, so the bar never claims a path the
      // listing is not actually of.
      if (outcome.ok) setAddress(outcome.value.path)
    })
  }, [browseDirectory])

  // Each opening starts at Home again: a stale level from the last visit would
  // claim a directory the operator did not navigate to.
  useEffect(() => {
    if (!open) {
      controller.current?.abort()
      return
    }
    setCreating(false)
    setFolderName('')
    setShowHidden(false)
    show(undefined)
    return () => { controller.current?.abort() }
  }, [open, show])

  const listing = level.state === 'ready' ? level.listing : undefined
  const crumbs = useMemo(() => (listing === undefined ? [] : pickerCrumbs(listing)), [listing])
  const rows = useMemo(
    () => (listing === undefined ? [] : pickerEntries(listing, showHidden)),
    [listing, showHidden],
  )
  const parent = useMemo(() => (listing === undefined ? undefined : parentPathOf(listing.path)), [listing])

  /**
   * Go to whatever the address bar holds.
   *
   * A typed path is not validated here: the browse primitive is the only thing
   * that knows what exists, and it answers a structured failure that lands in
   * this dialog's own notice line.
   * @param path - the typed or pasted path.
   */
  const go = (path: string): void => {
    const wanted = path.trim()
    if (wanted === '') return
    show(wanted)
  }

  /** Create a folder in the listed level, then move into it. */
  const create = (): void => {
    if (listing === undefined) return
    const name = folderName.trim() === '' ? t('picker.untitledFolder') : folderName.trim()
    setNotice(undefined)
    void makeDirectory(listing.path, name).then((outcome) => {
      if (!alive.current) return
      if (!outcome.ok) {
        setNotice(outcome.message)
        return
      }
      setCreating(false)
      setFolderName('')
      show(outcome.path)
    })
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={t('picker.title')}
      closeLabel={t('picker.cancel')}
      className={css.picker ?? ''}
      contentClassName={css.pickerContent ?? ''}
      footer={(
        <>
          <Button variant="outline" size="sm" onClick={onCancel}>{t('picker.cancel')}</Button>
          <Button
            variant="primary"
            size="sm"
            disabled={listing === undefined || creating}
            onClick={() => { if (listing !== undefined) onPicked(listing.path) }}
          >
            {t('picker.choose')}
          </Button>
        </>
      )}
    >
      {/* The address bar: the listed path, editable and confirmed with Enter —
          the one thing a pasted path needs and a browse-only dialog lacks. */}
      <div className={css.pickerAddress}>
        <Input
          className={css.pickerAddressInput ?? ''}
          value={address}
          spellCheck={false}
          aria-label={t('picker.path')}
          placeholder={t('picker.pathPlaceholder')}
          onChange={(event) => { setAddress(event.target.value) }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') go(address)
            if (event.key === 'Escape') setAddress(listing?.path ?? '')
          }}
        />
        <Button variant="outline" size="sm" onClick={() => { go(address) }}>{t('picker.go')}</Button>
        <button
          type="button"
          className={css.pickerTool}
          aria-label={t('picker.up')}
          title={t('picker.up')}
          disabled={parent === undefined}
          onClick={() => { if (parent !== undefined) show(parent) }}
        >
          ↑
        </button>
      </div>

      <div className={css.pickerCrumbs}>
        {crumbs.map((crumb, index) => (
          <span key={crumb.path} className={css.pickerCrumbCell}>
            {index > 0 && <span className={css.pickerCrumbSep} aria-hidden="true">›</span>}
            <button
              type="button"
              className={`${css.pickerCrumb} ${index === crumbs.length - 1 ? css.pickerCrumbCurrent : ''}`}
              title={crumb.path}
              onClick={() => { show(crumb.path) }}
            >
              {crumb.home ? t('picker.home') : crumb.name}
            </button>
          </span>
        ))}
      </div>

      <div className={css.pickerBar}>
        <label className={css.pickerToggle}>
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(event) => { setShowHidden(event.target.checked) }}
          />
          {t('picker.showHidden')}
        </label>
        <button
          type="button"
          className={css.pickerTool}
          aria-label={t('picker.reload')}
          title={t('picker.reload')}
          onClick={() => { show(listing?.path) }}
        >
          <IconRefreshOutline16 size={13} />
        </button>
        <button
          type="button"
          className={css.pickerTool}
          aria-label={t('picker.newFolder')}
          title={t('picker.newFolder')}
          disabled={listing === undefined}
          onClick={() => { setCreating(true); setNotice(undefined) }}
        >
          <IconPlusOutline16 size={13} />
        </button>
      </div>

      {creating && (
        <div className={css.pickerCreate}>
          <Input
            autoFocus
            value={folderName}
            placeholder={t('picker.folderName')}
            aria-label={t('picker.folderName')}
            onChange={(event) => { setFolderName(event.target.value) }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') create()
              if (event.key === 'Escape') { setCreating(false); setFolderName('') }
            }}
          />
          <Button variant="primary" size="sm" onClick={create}>{t('picker.create')}</Button>
        </div>
      )}

      {notice !== undefined && <p className={css.pickerNotice} role="alert">{notice}</p>}

      <div className={css.pickerRows} role="listbox" aria-label={t('picker.title')}>
        {level.state === 'loading' && (
          <p className={css.pickerNote}>
            <IconLoadingOutline16 size={13} className={css.explorerSpin} />
            {t('picker.loading')}
          </p>
        )}
        {level.state === 'failed' && (
          <p className={css.pickerNote}>
            <span className={css.explorerErrorText}>{level.message}</span>
            <button type="button" className={css.explorerRetry} onClick={() => { show(listing?.path) }}>
              {t('tree.retry')}
            </button>
          </p>
        )}
        {level.state === 'ready' && rows.length === 0 && <p className={css.pickerNote}>{t('picker.empty')}</p>}
        {rows.map(row => (
          <button
            key={row.path}
            type="button"
            className={css.pickerRow}
            title={row.path}
            onClick={() => { show(row.path) }}
          >
            <span className={css.explorerIcon} aria-hidden="true"><IconFolderClose16 size={15} /></span>
            <span className={css.explorerName}>{row.name}</span>
          </button>
        ))}
        {listing?.truncated === true && <p className={css.pickerNote}>{t('picker.truncated')}</p>}
      </div>
    </Modal>
  )
}
