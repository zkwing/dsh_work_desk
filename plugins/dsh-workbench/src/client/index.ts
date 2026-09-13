/**
 * Browser half of `dsh-workbench`: the control room as a global main panel.
 *
 * The workbench is the Workspace surface's extension and it is mounted the way
 * the app mounts a workspace: a `main` entry under the key `workbench` plus a
 * row in `sidebar.panellist`, so it is picked from the sidebar's panel list and
 * takes the center column instead of covering the conversation with an overlay.
 * Its data comes from the official Workspace capability rather than a roster of
 * its own:
 *
 * - the card list is the Host Workspace snapshot, read in the panel through the
 *   global `useWorkspaces` hook (`ui-workspace` provides that root hook);
 * - the add flow is the same one the sidebar's "Add workspace…" entry runs:
 *   `ctx.uiWorkspace.pickDirectory()` for the OS chooser, then
 *   `ctx.workspaces.create({ path })` to register it;
 * - the tree face lists directories over `remote.workspaceFiles.list`, the
 *   namespace `ui-sidebar-files` also consumes, with the Session that owns the
 *   workspace root travelling with each call.
 *
 * Services are treated in two tiers, because a plugin that cannot mount has no
 * fallback at all while a plugin that mounts without one optional capability
 * still works:
 *
 * - `slots` and `locale` are required: without them there is nothing to
 *   register and no copy to draw.
 * - `uiWorkspace`, `workspaces` and the `workspaceFiles` Remote namespace are
 *   probed with `ctx.get()` and degrade. A composition without the workspace
 *   rows still shows the panel with its structure and a notice, instead of
 *   leaving the workbench pending forever.
 *
 * Composition rules this file follows (the DSH plugin contract):
 *
 * - It contributes to slots another plugin declares. `ctx.slots.inject()` is
 *   the sanctioned way to wait for a declaration — each registration runs once
 *   its owner slot exists and is torn down with this plugin's fiber.
 * - `inject` names upstream services only. No Desktop-only service is injected,
 *   so the same bundle activates identically under ordinary `dsh web`, DSH
 *   Desktop compatibility mode, and DSH Desktop advanced mode.
 * - All copy goes through this plugin's own locale namespace.
 *
 * @module dsh-workbench/client
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the SlotRegistry service merge (ctx.slots), the SlotMap
// merges for the `main` key, the sidebar's panel list, and the `useWorkspaces`
// global hook. These packages are compile-time contracts here, never runtime
// dependencies: every capability arrives through a service or a slot.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { ISidebarRight } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { ILayout } from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: the theme service and its `theme/change` event merge. The panel
// follows the host palette through CSS variables, but switching the *grid*
// between white and gold needs the resolved color scheme, which is this
// service's fact rather than the stylesheet's.
import type { ThemeSnapshot } from '@deepseek-ai/dsh-client-ui-theme/client'
import type {} from '@deepseek-ai/dsh-session/types'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: merges the generated `workspaceFiles` Remote namespace into the
// Remote face.
import type {} from '@deepseek-ai/dsh-api-workspace-files/remote'
import {
  WorkbenchPanel, WorkbenchPanelIcon,
  type BrowseOutcome, type DirectoryLevelResult, type MakeOutcome, type WorkbenchInjected,
} from './Workbench.js'
import {
  EDITOR_ID, EDITOR_KIND, FileEditorBody, FileEditorTitle, editorDefinition,
  type EditorInjected, type EditorReadOutcome, type EditorWriteOutcome,
} from './WorkbenchFileEditor.js'
import {
  createCapabilityStore, createValueStore, failureText, fileAddress, pickStep,
  type AddOutcome, type Capabilities, type FileOpenOutcome, type PickReply, type PickerListing, type TreeEntry,
} from './workspaces.js'
import { en, zh, type WorkbenchKey } from './locales.js'

export type { WorkbenchInjected, WorkbenchPanelProps, WorkbenchTranslate } from './Workbench.js'
// The panel is exported deliberately: it is the workbench's whole surface, and
// a host or another plugin can mount it by supplying the two hooks its props
// name (`useWorkspaces` from the standard kit, `useCapability` from this
// plugin's inject face) instead of going through these registrations.
export { WorkbenchPanel, WorkbenchPanelIcon, workspaceItems } from './Workbench.js'
// The editor is exported for the same reason: it is a complete surface (a page
// tab type plus its body and chip title), and a host may mount it directly.
export {
  EDITOR_ID, EDITOR_KIND, FileEditorBody, FileEditorTitle, editorDefinition,
} from './WorkbenchFileEditor.js'
export type {
  EditorInjected, EditorReadOutcome, EditorWriteOutcome, FileEditorBodyProps, FileEditorTitleProps,
} from './WorkbenchFileEditor.js'
export {
  CARD_ACCENTS, MAX_EXPLORER_DEPTH, NO_CAPABILITIES, accentFor, childPath, createCapabilityStore,
  explorerRows, failureText, fileAddress, orderEntries, parentPathOf, pickStep, pickerCrumbs, pickerEntries,
  sizeText, splitPath,
} from './workspaces.js'
export type {
  AddOutcome, Capabilities, CapabilitySource, CapabilityStore, CardAccent, ExplorerNote, ExplorerRow,
  FileOpenOutcome, PickReply, PickStep, PickerCrumb, PickerEntry, PickerListing, TreeEntry, TreeLevel,
} from './workspaces.js'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The workbench control room and Workspace-card copy. */
    workbench: WorkbenchKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'workbench'

/** The `main` key this plugin occupies (also the panel-list row id). */
const PANEL_ID = 'workbench'

/**
 * Required services.
 *
 * Deliberately minimal: the slot registry and the locale service are the only
 * ones the workbench cannot exist without.
 */
export const inject = ['slots', 'locale']

/** The directory-picking and Session-navigation face `ui-workspace` provides. */
interface UiWorkspaceFace {
  /** @param workspaceId - target Workspace. */
  openWorkspace(workspaceId: string): Promise<void>
  /** @param workspaceId - target Workspace. */
  startSession(workspaceId?: string): void
  /**
   * List one directory level through the Host's browse backend.
   * @param path - directory to list; absent lists the host account's home.
   * @param signal - cancellation for a superseded scan.
   */
  listDirectory(path?: string, signal?: AbortSignal): Promise<PickerListing>
  /**
   * Create one child directory through the Host's browse backend.
   * @param path - existing parent directory.
   * @param name - single non-blank path segment.
   * @returns the created directory's absolute path.
   */
  createDirectory(path: string, name: string): Promise<string>
}

/** The Workspace registry face the client controller provides. */
interface WorkspacesFace {
  /** @param input - Host create payload carrying the picked directory. */
  create(input: { path: string }): Promise<unknown>
  /** @param workspaceId - registration to drop. */
  delete(workspaceId: string): Promise<void>
}

/** The `directoryPicker` Remote slice this plugin calls. */
interface DirectoryPickerFace {
  /**
   * Open the host's OS chooser.
   * @param signal - cancellation for an abandoned chooser.
   * @returns the chosen path, or null when the operator cancelled.
   */
  pick(signal?: AbortSignal): Promise<PickReply>
}

/** The `workspaceFiles` Remote slice this plugin calls. */
interface WorkspaceFilesFace {
  /**
   * @param sessionId - Session whose workspace root confines the listing.
   * @param path - directory path, absolute or workspace-relative.
   * @param signal - cancellation for a superseded listing.
   */
  list(
    sessionId: string,
    path: string,
    signal: AbortSignal,
  ): Promise<
    | { ok: true; value: { entries: readonly TreeEntry[]; truncated: boolean } }
    | { ok: false; error: { code: string; message: string } }
  >
}

/**
 * The right column face `ui-sidebar-right` provides.
 *
 * `openResource` opens a file address in the official viewer; `openTab` opens a
 * page type by kind, which is how this plugin's editor is reached. Both are
 * typed by the package's own declarations, which this program imports.
 */
type SidebarRightFace = ISidebarRight

/** The two routes this plugin's Host half contributes. */
const WORKBENCH_READ_ROUTE = '/workbench/file/read'
const WORKBENCH_WRITE_ROUTE = '/workbench/file/write'

/**
 * The optional services as the root registry answers right now.
 *
 * Read per call rather than captured: every one of them can be mounted after
 * this plugin's `apply`, and two of them are Remote namespaces that mount
 * asynchronously.
 * @param ctx - the client root context.
 * @param name - service name to resolve.
 * @returns the service, or undefined when this composition has not mounted it.
 */
function service<T>(ctx: ClientContext, name: string): T | undefined {
  return ctx.get(name) as T | undefined
}

/**
 * The `workspaceFiles` namespace, through whichever face carries it: the traced
 * `remote.<namespace>` child service, or the Remote assembly object.
 * @param ctx - the client root context.
 * @returns the namespace, or undefined when unmounted.
 */
function workspaceFiles(ctx: ClientContext): WorkspaceFilesFace | undefined {
  const traced = service<WorkspaceFilesFace>(ctx, 'remote.workspaceFiles')
  if (traced !== undefined) return traced
  return service<{ workspaceFiles?: WorkspaceFilesFace }>(ctx, 'remote')?.workspaceFiles
}

/**
 * The `directoryPicker` namespace, resolved the same two ways as
 * {@link workspaceFiles}.
 * @param ctx - the client root context.
 * @returns the namespace, or undefined when unmounted.
 */
function directoryPicker(ctx: ClientContext): DirectoryPickerFace | undefined {
  const traced = service<DirectoryPickerFace>(ctx, 'remote.directoryPicker')
  if (traced !== undefined) return traced
  return service<{ directoryPicker?: DirectoryPickerFace }>(ctx, 'remote')?.directoryPicker
}

/** One line for a rejection that crossed a service boundary. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Classify one right-column rejection.
 *
 * `ui-sidebar-right` raises plain `Error`s, so the only signal is their text.
 * Of the two a file open can hit, the missing seat is the one a caller can
 * repair — put a session on screen — so it travels as a code instead of as a
 * line the reader cannot act on.
 * @param error - the rejection.
 * @returns the classification, empty when there is none.
 */
function paneCodeOf(error: unknown): { readonly code?: 'pane/no-session' } {
  return messageOf(error).includes('no session surface is mounted') ? { code: 'pane/no-session' } : {}
}

/** The client Session service `ui-workspace` also drives (`ctx.sessions`). */
interface SessionsFace {
  /**
   * Select one Session.
   * @param sessionId - the Session to make current.
   */
  open(sessionId: string): void
}

/** The theme service `ui-theme` provides (`ctx.theme`), narrowed to the read this plugin makes. */
interface ThemeFace {
  /** @returns the current immutable snapshot, stable until the next change. */
  getTheme(): ThemeSnapshot
}

/**
 * Register the workbench's dictionaries, its sidebar panel row, and its main
 * panel body.
 * @param ctx - the client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-workbench: dictionaries')
  // Bound once and handed down through the inject faces: the bound translate is
  // locale-reactive and stable, so the panel re-renders on a language switch
  // without re-registering anything.
  const workbenchT = ctx.locale.bind(NS)

  // Optional capability tier. The seed answers the services that are already
  // mounted, and one `ctx.inject` per service reports the ones that arrive
  // later (or go away again). Neither path ever leaves the plugin pending: the
  // panel mounts whatever the composition has and states what it lacks.
  const capability = createCapabilityStore()
  const seed: Capabilities = {
    navigation: service(ctx, 'uiWorkspace') !== undefined,
    workspaces: service(ctx, 'workspaces') !== undefined,
    files: workspaceFiles(ctx) !== undefined,
    picker: directoryPicker(ctx) !== undefined,
    pane: service(ctx, 'sidebarRight') !== undefined,
  }
  capability.set(seed)

  /**
   * Report one optional service's presence for as long as it is mounted.
   * @param name - the service to watch.
   * @param on - the capability patch while it is mounted.
   * @param off - the capability patch once it unmounts.
   */
  const watch = (name: string, on: Partial<Capabilities>, off: Partial<Capabilities>): void => {
    ctx.inject([name], (scope) => {
      scope.effect(() => {
        capability.set(on)
        return () => { capability.set(off) }
      }, `dsh-workbench: ${name} capability`)
    })
  }
  watch('uiWorkspace', { navigation: true }, { navigation: false })
  watch('workspaces', { workspaces: true }, { workspaces: false })
  watch('remote.workspaceFiles', { files: true }, { files: false })
  watch('remote.directoryPicker', { picker: true }, { picker: false })
  watch('sidebarRight', { pane: true }, { pane: false })

  // The color scheme, as a live source for the panel. Every surface and label
  // in this panel's stylesheet comes from the host's `--dsw-*` alias tokens, so
  // the palette follows the theme on its own; the scheme is needed for the one
  // thing tokens cannot express — the background grid, which is white on a dark
  // palette and gold on a light one. Absent a theme service the panel starts on
  // the dark palette, which is the palette every DSH surface ships first.
  const themeService = service<ThemeFace>(ctx, 'theme')
  const scheme = createValueStore(themeService?.getTheme().active.colorScheme === 'dark')
  ctx.effect(() => {
    const off = ctx.on('theme/change', (snapshot: ThemeSnapshot) => {
      scheme.set(snapshot.active.colorScheme === 'dark')
    })
    return () => { off() }
  }, 'dsh-workbench: color scheme')

  // Every action resolves its services at call time for the same reason the
  // flags are live, so a control that the flags enable is never a stale
  // closure over an absent service.

  /**
   * Register one absolute directory as a Workspace.
   *
   * The single adoption step: both adding routes (the OS chooser and the in-app
   * picker) end here, so a failure is reported once, in one place.
   * @param path - absolute host directory the operator picked.
   * @returns what the panel should show about it.
   */
  const registerWorkspace = async (path: string): Promise<AddOutcome> => {
    const registry = service<WorkspacesFace>(ctx, 'workspaces')
    if (registry === undefined) return { kind: 'failed', message: workbenchT('notice.noWorkspaceService') }
    try {
      await registry.create({ path })
      return { kind: 'created', path }
    } catch (error: unknown) {
      return { kind: 'failed', message: messageOf(error) }
    }
  }

  /**
   * Try the Host's OS chooser, and say what the panel should do when it cannot
   * serve one. See {@link pickStep} for why a refusal means "browse in-app".
   * @returns what the panel should show, or `browse` to open the in-app picker.
   */
  const pickWorkspace = async (): Promise<AddOutcome> => {
    if (service<WorkspacesFace>(ctx, 'workspaces') === undefined) {
      return { kind: 'failed', message: workbenchT('notice.noWorkspaceService') }
    }
    const picker = directoryPicker(ctx)
    if (picker === undefined) return { kind: 'browse' }
    let reply: PickReply
    try {
      reply = await picker.pick()
    } catch (error: unknown) {
      // A transport-level rejection is not the documented refusal: the namespace
      // is mounted, so browsing is still the better answer than an error card.
      return { kind: 'failed', message: messageOf(error) }
    }
    const step = pickStep(reply)
    switch (step.step) {
      case 'picked': return registerWorkspace(step.path)
      case 'cancelled': return { kind: 'cancelled' }
      case 'browse': return { kind: 'browse' }
      default: return { kind: 'failed', message: step.message }
    }
  }

  /**
   * List one level for the in-app picker.
   * @param path - directory to list; absent lists the host account's home.
   * @param signal - cancellation for a superseded scan.
   * @returns the level, or the line to show instead.
   */
  const browseDirectory = async (path: string | undefined, signal: AbortSignal): Promise<BrowseOutcome> => {
    const navigation = service<UiWorkspaceFace>(ctx, 'uiWorkspace')
    if (navigation === undefined) return { ok: false, message: workbenchT('picker.unavailable') }
    try {
      return { ok: true, value: await navigation.listDirectory(path, signal) }
    } catch (error: unknown) {
      return { ok: false, message: messageOf(error) }
    }
  }

  /**
   * Create one child directory for the in-app picker.
   * @param path - existing parent directory.
   * @param name - single non-blank path segment.
   * @returns the created path, or the line to show instead.
   */
  const makeDirectory = async (path: string, name: string): Promise<MakeOutcome> => {
    const navigation = service<UiWorkspaceFace>(ctx, 'uiWorkspace')
    if (navigation === undefined) return { ok: false, message: workbenchT('picker.unavailable') }
    try {
      return { ok: true, path: await navigation.createDirectory(path, name) }
    } catch (error: unknown) {
      return { ok: false, message: messageOf(error) }
    }
  }

  const openWorkspace = (workspaceId: string): Promise<void> => {
    const navigation = service<UiWorkspaceFace>(ctx, 'uiWorkspace')
    if (navigation === undefined) return Promise.resolve()
    return navigation.openWorkspace(workspaceId)
  }

  const startSession = (workspaceId: string): void => {
    service<UiWorkspaceFace>(ctx, 'uiWorkspace')?.startSession(workspaceId)
  }

  const removeWorkspace = (workspaceId: string): void => {
    const registry = service<WorkspacesFace>(ctx, 'workspaces')
    if (registry === undefined) return
    void registry.delete(workspaceId)
  }

  const listDirectory = async (
    sessionId: string,
    path: string,
    signal: AbortSignal,
  ): Promise<DirectoryLevelResult> => {
    const files = workspaceFiles(ctx)
    if (files === undefined) {
      return {
        ok: false,
        value: { status: 'error', entries: [], truncated: false, error: workbenchT('tree.unavailable') },
      }
    }
    // The generated namespace types its scope id as the branded SessionId;
    // Workspace rows carry the same ids as plain strings, so the brand is
    // re-asserted here at the one Remote boundary.
    const result = await files.list(sessionId as never, path, signal)
    if (result.ok) {
      return { ok: true, value: { status: 'ready', entries: result.value.entries, truncated: result.value.truncated } }
    }
    return {
      ok: false,
      value: { status: 'error', entries: [], truncated: false, error: failureText(workbenchT, result.error) },
    }
  }

  /**
   * Show one file in the right column: the workbench editor when the right
   * column is there, the official viewer as the fallback route.
   *
   * The address carries the Session, not the sandbox: the official `text` tab
   * type claims session-scoped file addresses only, and the Host resolves the
   * path against that Session's workspace root.
   * @param sessionId - the Session whose workspace holds the file.
   * @param path - the file's absolute path.
   * @returns whether the column took it, and why not when it did not.
   */
  const openFile = (sessionId: string, path: string): FileOpenOutcome => {
    const pane = service<SidebarRightFace>(ctx, 'sidebarRight')
    if (pane === undefined) return { ok: false, message: workbenchT('file.noPane') }
    if (pane.openTab !== undefined) {
      try {
        pane.openTab(EDITOR_KIND, { params: { sessionId, path } })
        return { ok: true }
      } catch (error: unknown) {
        // No editor type in force — the right column may predate this plugin's
        // registration — so fall through to the official viewer.
        if (!(error instanceof Error)) return { ok: false, message: messageOf(error) }
      }
    }
    return openPreview(sessionId, path)
  }

  /**
   * Put one Session on screen.
   *
   * Selecting a session is only half of what the right column needs: its root
   * controller renders the session-scoped seat **only while the Conversation is
   * the selected main panel** (`ui-sidebar-right`'s `RightbarRoot`), and that
   * seat is what publishes the binding every `openResource`/`openTab` requires.
   * @param sessionId - the Session to make current.
   * @returns whether a sessions service was there to answer.
   */
  const selectSession = (sessionId: string): boolean => {
    const sessions = service<SessionsFace>(ctx, 'sessions')
    if (sessions === undefined) return false
    sessions.open(sessionId)
    return true
  }

  /**
   * Select the Conversation as the center column's panel (`activePanelId: null`).
   *
   * This is the step that brings the right column into existence at all: the
   * workbench is a global panel, and a global panel means no right column, so
   * any file open has to hand the column over first. It is the same selection
   * `uiWorkspace.openSession` makes, taken here on its own so the handover does
   * not also reconnect a workspace.
   * @returns whether a layout service was there to answer.
   */
  const showConversation = (): boolean => {
    const layout = service<ILayout>(ctx, 'layout')
    if (layout === undefined) return false
    layout.selectPanel(null)
    return true
  }

  /**
   * Show one file in the official viewer instead of the editor: the route that
   * renders Markdown, PDFs, and images rather than their bytes.
   * @param sessionId - the Session whose workspace holds the file.
   * @param path - the file's absolute path.
   * @returns whether the column took it, and why not when it did not.
   */
  const openPreview = (sessionId: string, path: string): FileOpenOutcome => {
    const pane = service<SidebarRightFace>(ctx, 'sidebarRight')
    if (pane === undefined) return { ok: false, message: workbenchT('file.noPane') }
    try {
      pane.openResource(fileAddress(sessionId, path))
      return { ok: true }
    } catch (error: unknown) {
      // `openResource` throws for an address no registered type will claim,
      // which in practice means this composition mounts no file viewer — and for
      // the same missing seat the editor route hits, which the caller repairs.
      return { ok: false, message: messageOf(error), ...paneCodeOf(error) }
    }
  }

  /**
   * Load one file's text through this plugin's Host route.
   *
   * The route exists because the client has no write verb and no bounded text
   * read with a version token; it answers the same shape whether it failed in
   * the trust fence, the boundary check, or the filesystem.
   * @param sessionId - the Session whose workspace confines the path.
   * @param path - the file's absolute path.
   * @returns the text and its version, or the reason it could not be read.
   */
  const readFile = async (sessionId: string, path: string): Promise<EditorReadOutcome> => {
    try {
      const response = await fetch(WORKBENCH_READ_ROUTE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, path }),
      })
      const payload = await response.json() as Partial<EditorReadOutcome> & {
        code?: string; message?: string; text?: string; version?: string; size?: number
      }
      if (payload.ok === true && typeof payload.text === 'string' && typeof payload.version === 'string') {
        return { ok: true, text: payload.text, version: payload.version, size: payload.size ?? 0 }
      }
      return {
        ok: false,
        code: payload.code ?? 'workbench/failed',
        message: payload.message ?? `HTTP ${response.status}`,
      }
    } catch (error: unknown) {
      return { ok: false, code: 'workbench/unreachable', message: messageOf(error) }
    }
  }

  /**
   * Save one file through this plugin's Host route.
   * @param sessionId - the Session whose workspace confines the path.
   * @param path - the file's absolute path.
   * @param text - the full new content.
   * @param version - the version the reader loaded; a mismatch is refused.
   * @returns the new version, or the reason the write did not happen.
   */
  const writeFile = async (
    sessionId: string,
    path: string,
    text: string,
    version: string,
  ): Promise<EditorWriteOutcome> => {
    try {
      const response = await fetch(WORKBENCH_WRITE_ROUTE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, path, text, version }),
      })
      const payload = await response.json() as Partial<EditorWriteOutcome> & {
        code?: string; message?: string; version?: string
      }
      if (payload.ok === true && typeof payload.version === 'string') {
        return { ok: true, version: payload.version }
      }
      return {
        ok: false,
        code: payload.code ?? 'workbench/failed',
        message: payload.message ?? `HTTP ${response.status}`,
      }
    } catch (error: unknown) {
      return { ok: false, code: 'workbench/unreachable', message: messageOf(error) }
    }
  }

  const injected = (): WorkbenchInjected => ({
    wt: workbenchT,
    hooks: { capability, scheme },
    pickWorkspace,
    registerWorkspace,
    browseDirectory,
    makeDirectory,
    openFile,
    selectSession,
    showConversation,
    openWorkspace,
    startSession,
    removeWorkspace,
    listDirectory,
  })

  const editorInjected = (): EditorInjected => ({
    wt: workbenchT,
    readFile,
    writeFile,
    openPreview,
  })

  // The panel body: the center column's occupant while `workbench` is selected.
  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PANEL_ID,
    inject: injected,
  }, WorkbenchPanel))

  // The editor: a page tab type of the right column, its body, and its chip
  // title. A page is opened by kind through `ctx.sidebarRight.openTab`, so this
  // plugin never competes with the official `text` type for a file address.
  ctx.inject(['sidebarRightTabs'], (scope) => {
    scope.effect(() => scope.sidebarRightTabs.register(editorDefinition(workbenchT)),
      'dsh-workbench: editor tab type')
  })
  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab',
    key: EDITOR_ID,
    locale: NS,
    inject: editorInjected,
  }, FileEditorBody))
  ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab.title',
    key: EDITOR_ID,
    inject: editorInjected,
  }, FileEditorTitle))

  // The sidebar row that selects it: the label thunk resolves per read, so the
  // row follows the active locale without re-registering.
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 20,
    label: () => workbenchT('trigger'),
  }, WorkbenchPanelIcon))
}
