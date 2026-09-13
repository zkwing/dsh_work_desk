/**
 * Workbench model: Workspaces as cards, and the file-tree reading that backs a
 * card's tree face.
 *
 * The workbench owns no roster of its own. A card IS a Host Workspace, read
 * through the global `useWorkspaces` hook (`ctx.workspaces.list`), so adding or
 * removing a Workspace anywhere in the app changes the grid here with no copy
 * and no second source of truth. Everything this module derives is presentation
 * over that snapshot plus the workspace-files listing.
 */
import type { WorkbenchKey } from './locales.js'

/** Accent palette keys the stylesheet maps to gradients. */
export type CardAccent = 'azure' | 'violet' | 'amber' | 'emerald' | 'rose' | 'slate'

/**
 * The Workspace fields a card renders.
 *
 * Structurally the Workspace Controller's `WorkspaceView`. Declared locally so
 * this plugin's component types its props without a value-level dependency on
 * the controller package; the objects themselves come from the Host through the
 * `useWorkspaces` root hook, so they are the real rows.
 */
export interface WorkspaceCardModel {
  /** Stable Workspace identity. */
  readonly workspaceId: string
  /** Canonical host directory path. */
  readonly path: string
  /** User-visible title. */
  readonly title: string
  /** Sessions accounted to this Workspace, in manual order. */
  readonly sessionIds: readonly string[]
  /** ISO-8601 creation instant. */
  readonly createdAt: string
  /** ISO-8601 last-mutation instant. */
  readonly updatedAt: string
}

/** The Workspace Controller snapshot as a card grid reads it. */
export interface WorkspacesSnapshot {
  /** Host-authoritative Workspace rows in display order. */
  readonly items: readonly WorkspaceCardModel[]
  /** Sessions hidden from every Workspace grouping surface. */
  readonly archivedSessionIds: readonly string[]
}

/** Accent keys, cycled by a Workspace's stable position in the Host order. */
export const CARD_ACCENTS: readonly CardAccent[] = ['azure', 'violet', 'amber', 'emerald', 'rose', 'slate']

/**
 * Pick a card accent from the Workspace's index in the Host order. Position
 * rather than identity: the same Workspace keeps its colour while the order is
 * stable, and the palette never repeats two adjacent cards.
 * @param index - zero-based position in the Workspace order.
 * @returns the accent key for that card.
 */
export function accentFor(index: number): CardAccent {
  return CARD_ACCENTS[index % CARD_ACCENTS.length] ?? 'azure'
}

/** One entry of a directory level, as the tree renders it. */
export interface TreeEntry {
  /** Basename inside the listed directory. */
  readonly name: string
  /** What the child resolves to; a symlink reports its destination type. */
  readonly type: 'file' | 'directory' | 'other'
  /** Byte size, present only for a regular file whose backend reports it. */
  readonly size?: number
}

/** One directory level's state inside a card's tree face. */
export interface TreeLevel {
  /** Lifecycle of this level's listing. */
  readonly status: 'loading' | 'ready' | 'error'
  /** Entries in the backend's stable name order; empty unless ready. */
  readonly entries: readonly TreeEntry[]
  /** Whether the entry cap dropped children from {@link entries}. */
  readonly truncated: boolean
  /** Human-readable failure, when {@link status} is 'error'. */
  readonly error?: string
}

/**
 * What a composition actually mounts, as the panel reads it live.
 *
 * Every one of these services can arrive after this plugin's `apply` — the
 * Remote namespaces mount asynchronously, and `dsh.client.inject` edges are
 * loading metadata rather than apply sequencing. So the flag, not a value
 * captured at apply time, is what a face enables its controls against.
 */
export interface Capabilities {
  /** `uiWorkspace`: the OS directory picker and Session navigation. */
  readonly navigation: boolean
  /** `ctx.workspaces`: the Workspace registry (create/delete). */
  readonly workspaces: boolean
  /** `remote.workspaceFiles`: directory listings. */
  readonly files: boolean
  /** `remote.directoryPicker`: the Host's directory-picking namespace. */
  readonly picker: boolean
  /** `ctx.sidebarRight`: the right column that shows opened files. */
  readonly pane: boolean
}

/** A live value a Slot component subscribes to; structurally the framework's source. */
export interface CapabilitySource {
  /** Read the cached snapshot reference (stable between notifications). */
  getSnapshot(): Capabilities
  /**
   * Subscribe to snapshot invalidation.
   * @param listener - invalidation callback.
   * @returns unsubscribe function.
   */
  subscribe(listener: () => void): () => void
}

/** Nothing mounted yet: the panel's state before the late services arrive. */
export const NO_CAPABILITIES: Capabilities = {
  navigation: false, workspaces: false, files: false, picker: false, pane: false,
}

/** The capability source plus its one writer, owned by the plugin's apply. */
export interface CapabilityStore extends CapabilitySource {
  /**
   * Merge one patch and notify listeners when the snapshot actually changed.
   * @param patch - the flags whose service just mounted or unmounted.
   */
  set(patch: Partial<Capabilities>): void
}

/** A live value a Slot component subscribes to; structurally the framework's source. */
export interface ValueSource<T> {
  /** Read the cached value (stable between notifications). */
  getSnapshot(): T
  /**
   * Subscribe to invalidation.
   * @param listener - invalidation callback.
   * @returns unsubscribe function.
   */
  subscribe(listener: () => void): () => void
}

/** A value source plus its one writer. */
export interface ValueStore<T> extends ValueSource<T> {
  /**
   * Replace the value and notify only when it actually changed.
   * @param value - the new value.
   */
  set(value: T): void
}

/**
 * Create a minimal observable value for a registration's `hooks` compartment.
 *
 * The slot framework binds such a source into a selector hook, which is how a
 * value the plugin cannot re-register for — the color scheme, say — still
 * re-renders the panel.
 * @param initial - the first value.
 * @returns the source and its writer.
 */
export function createValueStore<T>(initial: T): ValueStore<T> {
  let snapshot = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set(value) {
      if (Object.is(value, snapshot)) return
      snapshot = value
      for (const listener of [...listeners]) listener()
    },
  }
}

/**
 * Create the panel's capability source. It is a plain observable rather than a
 * React state so the registrant can hand it to the slot as a `hooks` source:
 * the framework binds it to a `useCapability` selector hook, and a flag that
 * flips later re-renders the panel without re-registering anything.
 * @returns the source and its writer.
 */
export function createCapabilityStore(): CapabilityStore {
  let snapshot: Capabilities = NO_CAPABILITIES
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set(patch) {
      const next: Capabilities = { ...snapshot, ...patch }
      // Compared key by key rather than field by field: a capability added to
      // the interface must not need a second edit here to become observable.
      const changed = (Object.keys(next) as (keyof Capabilities)[])
        .some(key => next[key] !== snapshot[key])
      if (!changed) return
      // A fresh object per real change, and the same object in between: that is
      // what `useSyncExternalStore` requires of `getSnapshot`.
      snapshot = next
      for (const listener of [...listeners]) listener()
    },
  }
}

/** Deepest nesting {@link explorerRows} walks, so a symlink loop cannot outrun it. */
export const MAX_EXPLORER_DEPTH = 32

/** Why a level has no entries to show. */
export type ExplorerNote = 'loading' | 'empty' | 'truncated' | 'failed'

/**
 * One rendered explorer row.
 *
 * The explorer is a VS Code-shaped flat list: `entry` rows carry their own
 * depth, so indentation and the indent guides are row facts rather than nested
 * markup, and `note` rows stand in for a level that is loading, empty,
 * truncated, or failed.
 */
export type ExplorerRow =
  | {
    readonly kind: 'entry'
    readonly path: string
    readonly name: string
    readonly type: TreeEntry['type']
    readonly depth: number
    readonly size?: number | undefined
    readonly expanded: boolean
  }
  | {
    readonly kind: 'note'
    readonly path: string
    readonly depth: number
    readonly note: ExplorerNote
    readonly error?: string | undefined
  }

/** Natural, case-insensitive name order, so `file2` precedes `file10`. */
const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/**
 * Order one level for display: directories first, then everything else, each
 * group by name. The endpoint's order is a listing fact; this is the reader's.
 * @param entries - the listing as the endpoint returned it.
 * @returns a new array, directories first, then by name within each group.
 */
export function orderEntries(entries: readonly TreeEntry[]): TreeEntry[] {
  return [...entries].sort((left, right) => {
    const group = Number(right.type === 'directory') - Number(left.type === 'directory')
    return group !== 0 ? group : byName.compare(left.name, right.name)
  })
}

/**
 * Split a path into the directory part (trailing separator kept) and the last
 * segment, for the explorer's header row. Accepts either separator, because the
 * path comes from the Host and may be a Windows one.
 * @param path - the workspace root.
 * @returns the directory prefix and the name.
 */
export function splitPath(path: string): { directory: string; name: string } {
  const trimmed = path.replace(/[/\\]+$/, '')
  const cut = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  if (cut < 0) return { directory: '', name: trimmed }
  return { directory: trimmed.slice(0, cut + 1), name: trimmed.slice(cut + 1) }
}

/**
 * Flatten the listed tree into the rows the explorer draws, in display order:
 * each expanded directory contributes its ordered entries and then, right after
 * a directory row, that directory's own subtree.
 *
 * Only levels already in `levels` are walked, so a listing happens when a
 * directory is first expanded and never for the whole tree at once.
 * @param root - the workspace root being browsed.
 * @param levels - every listed level, keyed by absolute path.
 * @param expanded - the directories the reader has opened.
 * @returns the flat row list, top to bottom.
 */
export function explorerRows(
  root: string,
  levels: ReadonlyMap<string, TreeLevel>,
  expanded: ReadonlySet<string>,
): ExplorerRow[] {
  const rows: ExplorerRow[] = []
  const walk = (path: string, depth: number): void => {
    if (depth > MAX_EXPLORER_DEPTH) return
    const level = levels.get(path)
    if (level === undefined || level.status === 'loading') {
      rows.push({ kind: 'note', path, depth, note: 'loading' })
      return
    }
    if (level.status === 'error') {
      rows.push({ kind: 'note', path, depth, note: 'failed', error: level.error })
      return
    }
    if (level.entries.length === 0) {
      rows.push({ kind: 'note', path, depth, note: 'empty' })
      return
    }
    for (const entry of orderEntries(level.entries)) {
      const child = childPath(path, entry.name)
      const open = entry.type === 'directory' && expanded.has(child)
      rows.push({
        kind: 'entry', path: child, name: entry.name, type: entry.type, depth,
        size: entry.size, expanded: open,
      })
      if (open) walk(child, depth + 1)
    }
    if (level.truncated) rows.push({ kind: 'note', path, depth, note: 'truncated' })
  }
  walk(root, 0)
  return rows
}

/**
 * Join a parent path with a child name using `/`, whatever separators the parent
 * carries. The Host resolves mixed separators, and the tree only needs a stable
 * key, so no platform branch is needed here.
 * @param parent - the listed directory's path.
 * @param name - the child's basename.
 * @returns the child's path.
 */
export function childPath(parent: string, name: string): string {
  if (parent === '') return name
  return `${parent.replace(/[/\\]+$/, '')}/${name}`
}

/** Compact byte size for a tree row. */
export function sizeText(bytes: number | undefined): string {
  if (bytes === undefined) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Turn a Remote failure into one line for the tree. The Remote answers with a
 * structured failure rather than throwing, so the caller only formats it.
 *
 * The three Workspace-file codes this plugin can provoke have copy of their own
 * in the `workbench` namespace; anything else is a Host diagnostic, and Host
 * text is not this plugin's copy to translate.
 * @param t - the bound `workbench` translate.
 * @param error - the failure's code and message.
 * @returns the display line.
 */
export function failureText(t: (key: WorkbenchKey) => string, error: { code: string; message: string }): string {
  switch (error.code) {
    case 'workspace-file/outside-workspace':
      return t('tree.error.outside')
    case 'workspace-file/not-found':
      return t('tree.error.notFound')
    case 'workspace-file/not-directory':
      return t('tree.error.notDirectory')
    default:
      return error.message
  }
}

// ── adding a Workspace ──────────────────────────────────────────────────────

/**
 * One directory row of the in-app picker: a listing child or a breadcrumb
 * ancestor, carrying the absolute path the Host resolved (clients never join
 * path segments themselves).
 */
export interface PickerEntry {
  /** Base name shown in the row; empty on the synthetic Home crumb. */
  readonly name: string
  /** Absolute host path. */
  readonly path: string
  /** Hidden by the host platform's convention; the reader decides whether to show it. */
  readonly hidden: boolean
}

/** One browsable level plus its ancestry, as the picker's browse backend reports it. */
export interface PickerListing {
  /** Absolute path of the listed directory. */
  readonly path: string
  /** The host account's home directory. */
  readonly home: string
  /** Ancestor chain from the filesystem root to the listed directory inclusive. */
  readonly crumbs: readonly PickerEntry[]
  /** Direct child directories. */
  readonly entries: readonly PickerEntry[]
  /** True when the backend cut the entries at its complete-result bound. */
  readonly truncated: boolean
}

/**
 * One `directoryPicker.pick` answer, structurally: the Remote's own result
 * shape. `undefined` stands for a composition with no pick namespace at all.
 */
export type PickReply =
  | { readonly ok: true; readonly value: string | null }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

/** What the add flow does after one pick attempt. */
export type PickStep =
  | { readonly step: 'picked'; readonly path: string }
  | { readonly step: 'cancelled' }
  | { readonly step: 'browse' }
  | { readonly step: 'failed'; readonly message: string }

/**
 * Classify one pick answer into the flow's next move.
 *
 * This is not "call `pickDirectory()` and use the path". A boot composes exactly
 * one directory-picking interaction, and the Host **refuses** a verb that
 * interaction cannot serve. With the browse backend — the resolved choice on a
 * host whose native chooser cannot reach the operator — `pick` answers
 * `directory-picker/unavailable`, and the browse primitives are the only way
 * through. That refusal is a fork in the flow, not an error to show.
 * @param reply - the pick answer, or its absence when the namespace is unmounted.
 * @returns the next step of the add flow.
 */
export function pickStep(reply: PickReply | undefined): PickStep {
  // No pick namespace at all: the browse primitives may still be mounted.
  if (reply === undefined) return { step: 'browse' }
  if (reply.ok) {
    return reply.value === null || reply.value === ''
      ? { step: 'cancelled' }
      : { step: 'picked', path: reply.value }
  }
  if (reply.error.code === 'directory-picker/unavailable') return { step: 'browse' }
  return { step: 'failed', message: reply.error.message }
}

/** What adding a Workspace reported back to the panel. */
export type AddOutcome =
  | { readonly kind: 'created'; readonly path: string }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'browse' }
  | { readonly kind: 'failed'; readonly message: string }

/** One breadcrumb: a jump target, flagged when it is the Home root. */
export interface PickerCrumb {
  /** Absolute host path this crumb jumps to. */
  readonly path: string
  /** Segment name; empty when the crumb is the synthetic Home root. */
  readonly name: string
  /** True for the crumb that stands for the host account's home directory. */
  readonly home: boolean
}

/**
 * The breadcrumb chain for one listing: the Host's own chain, with Home marked
 * where it appears, and prepended as a jump target when the listed directory is
 * not under Home at all.
 * @param listing - the level being shown.
 * @returns the crumbs, filesystem root first.
 */
export function pickerCrumbs(listing: PickerListing): PickerCrumb[] {
  const chain = listing.crumbs.length > 0
    ? listing.crumbs
    : [{ name: listing.path, path: listing.path, hidden: false }]
  const crumbs: PickerCrumb[] = []
  if (!chain.some(crumb => crumb.path === listing.home)) {
    crumbs.push({ path: listing.home, name: '', home: true })
  }
  for (const crumb of chain) {
    crumbs.push({ path: crumb.path, name: crumb.name, home: crumb.path === listing.home })
  }
  return crumbs
}

/**
 * The rows one picker level shows: hidden directories filtered unless asked
 * for, in natural case-insensitive name order.
 * @param listing - the level being shown.
 * @param showHidden - whether the reader asked for hidden directories.
 * @returns the rows, in display order.
 */
export function pickerEntries(listing: PickerListing, showHidden: boolean): PickerEntry[] {
  return listing.entries
    .filter(entry => showHidden || !entry.hidden)
    .sort((left, right) => byName.compare(left.name, right.name))
}

// ── opening a file ──────────────────────────────────────────────────────────

/**
 * The `dsh-resource://file/session/<sessionId>/<path>` address of one file.
 *
 * Built here rather than imported: the grammar lives in
 * `@deepseek-ai/dsh-util-workspace-path`, which is not a platform-baseline
 * module, and this plugin resolves its runtime dependencies from the module
 * table. The grammar is fixed and small — every segment component-encoded, `:`
 * left literal so a drive letter reads as written, backslashes normalized to
 * `/` — and `verify-artifact.mjs` pins it against the documented examples.
 *
 * The **session** scope is the one that matters: the official `text` tab type
 * claims `dsh-resource://file/session/…` addresses (and only those), because
 * the Host resolves the path against the Session's own workspace root.
 * @param sessionId - the Session whose Host workspace resolves the path.
 * @param path - absolute or workspace-relative path.
 * @returns the address to hand to `ctx.sidebarRight.openResource`.
 */
export function fileAddress(sessionId: string, path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/^(?:\.\/)+/, '')
  const encoded = normalized
    .split('/')
    .map(segment => encodeURIComponent(segment).replace(/%3A/gi, ':'))
    .join('/')
  return `dsh-resource://file/session/${encodeURIComponent(sessionId)}/${encoded}`
}

/** What opening one file in the right column reported back to the panel. */
export type FileOpenOutcome =
  | { readonly ok: true }
  | {
    readonly ok: false
    readonly message: string
    /**
     * A stable classification for the one failure the caller can repair.
     *
     * `pane/no-session` is `ui-sidebar-right` refusing while no session surface
     * is mounted: the right column is session content, so a global panel has to
     * put a session on screen before it can hold a file. Every other failure is
     * the Host's or the registry's own line, reported as it came.
     */
    readonly code?: 'pane/no-session'
  }

/**
 * The parent of one path, or undefined when it already is a root.
 * @param path - an absolute path, with either separator.
 * @returns the parent path, separator included.
 */
export function parentPathOf(path: string): string | undefined {
  const trimmed = path.replace(/[/\\]+$/, '')
  const cut = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  if (cut < 0) return undefined
  const parent = trimmed.slice(0, cut + 1)
  return parent === '' ? undefined : parent
}
