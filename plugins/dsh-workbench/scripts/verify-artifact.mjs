/**
 * Standalone verification of the built `dsh-workbench` artifact.
 *
 * The browser bundle is the closure-factory format the DSH module system
 * executes: a script that calls `window.__ModuleLoader__.load({ id, factory })`
 * and resolves its externals through the injected `require`. This script
 * reproduces exactly that handshake with the smallest host surface the plugin
 * touches, so the checks below are the ones that decide whether the plugin
 * works in a browser:
 *
 *   1. the loader registration names this package and resolves only baseline
 *      platform externals;
 *   2. `apply()` registers the `workbench` dictionaries plus exactly two seats:
 *      the `main/workbench` panel body and its `sidebar.panellist` row;
 *   3. the seats' injected faces really reach the Host (one add flow, one
 *      listing, one refusal);
 *   4. a capability that mounts *after* `apply` still reaches the panel, and a
 *      composition that never mounts it degrades instead of failing;
 *   5. the explorer's row model — the VS Code-shaped flat list — is what the
 *      panel draws.
 *
 * Usage: node verify-artifact.mjs [path/to/client.js]
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bundlePath = resolve(process.argv[2] ?? join(here, '..', 'lib', 'client.js'))
const EXPECTED_ID = 'dsh-workbench'

const failures = []
function check(condition, message) {
  if (condition) {
    console.log(`  ok    ${message}`)
  } else {
    failures.push(message)
    console.log(`  FAIL  ${message}`)
  }
}

// ── 1. the loader handshake ─────────────────────────────────────────────────

const source = readFileSync(bundlePath, 'utf8')
const registrations = []
globalThis.window = {
  __ModuleLoader__: {
    load(registration) { registrations.push(registration) },
    create() { return undefined },
    require(id) {
      // Only baseline externals may be requested: anything else is a module the
      // platform table cannot answer, which would throw in the browser.
      throw new Error(`unexpected module request: ${id}`)
    },
  },
}
// The bundle is a classic script, not a module: give it the global scope a
// browser gives it, with the module-table require already installed. The DOM
// stub exists because the client preset inlines each module stylesheet as a
// factory-execution side effect (a tagged <style> element), so a working
// document is part of the artifact's contract.
const injectedStyles = []
const documentStub = {
  head: { appendChild(node) { injectedStyles.push(node) } },
  querySelector(selector) {
    const tagId = selector.match(/data-plugin-css=(?:"|\\")?([^"\\\]]+)/)?.[1]
    return injectedStyles.some(node => node.dataset?.pluginCss === tagId) ? {} : null
  },
  createElement() { return { dataset: {}, textContent: '' } },
}
const evaluate = new Function('window', 'document', 'require', source)
const requested = []
evaluate(globalThis.window, documentStub, id => {
  requested.push(id)
  // Every baseline row the plugin asks for, as an inert namespace object.
  return {}
})

console.log(`artifact: ${bundlePath}`)
console.log(`bytes:    ${source.length}`)
console.log('loader handshake')
check(registrations.length === 1, `the bundle registers exactly one module (got ${registrations.length})`)
const registration = registrations[0]
check(registration?.id === EXPECTED_ID, `the registration id is ${EXPECTED_ID}`)
check(typeof registration?.factory === 'function', 'the registration carries a factory')
check(requested.length === 0,
  `registration touches the module table zero times, so it is pure registration (got ${requested.length})`)

// ── 2. the client face ──────────────────────────────────────────────────────

const exports = registration.factory(id => {
  // The bundle resolves its externals lazily, at factory execution rather than
  // at registration, so this is where the module table actually answers.
  if (id.startsWith('react') || id.startsWith('@deepseek-ai/')) {
    requested.push(id)
    return {}
  }
  throw new Error(`unexpected post-registration module request: ${id}`)
})

console.log('client face')
check(typeof exports.apply === 'function', 'the factory exports apply()')
check(Array.isArray(exports.inject), 'the factory exports an inject list')
check(JSON.stringify(exports.inject) === JSON.stringify(['slots', 'locale']),
  `inject is the two services the panel cannot exist without (got ${JSON.stringify(exports.inject)})`)
check(exports.inject.includes('slots'), 'inject asks for the slot registry')
check(exports.inject.includes('locale'), 'inject asks for the locale service')
check(!exports.inject.some(name => name.startsWith('desktop')),
  'inject names no Desktop-only service, so the bundle also activates under ordinary dsh web')
check(typeof exports.WorkbenchPanel === 'function', 'the factory exports the WorkbenchPanel component')
check(typeof exports.WorkbenchPanelIcon === 'function', 'the factory exports the panel-list icon')
const externals = [...new Set(requested)]
check(externals.length > 0 && externals.every(id => id.startsWith('react') || id.startsWith('@deepseek-ai/')),
  `every external the factory resolves is a platform baseline row (${externals.join(', ')})`)

// ── 3. the host stub ────────────────────────────────────────────────────────

/**
 * A minimal cordis-shaped host.
 *
 * `provide()` is the point of this stub: a service appears by name at some
 * later moment, and every `ctx.inject` callback waiting on that name runs then —
 * which is exactly the ordering the real client has, where the Remote
 * namespaces mount asynchronously and can arrive long after a plugin's apply.
 * @param initial - services mounted before the plugin loads.
 * @returns the host, its recorded registrations, and a late-provisioning hook.
 */
function createHost(initial = {}) {
  const services = new Map(Object.entries(initial))
  const waiting = []
  const seats = []
  const dictionaries = []
  const listeners = new Map()
  const host = {
    locale: {
      register(namespace, dicts) { dictionaries.push({ namespace, dicts }); return () => {} },
      bind(namespace) { return key => `${namespace}:${key}` },
    },
    slots: {
      // ctx.slots carries register() directly; it is the service proxy that
      // rebinds that method to the calling fiber. inject(key, callback) then
      // runs the callback once the awaited slot is declared and returns its
      // disposer.
      register(options, component) {
        seats.push({ options, component })
        return () => {}
      },
      inject(slot, callback) {
        const disposer = callback()
        const seat = seats[seats.length - 1]
        if (seat !== undefined) { seat.slot = slot; seat.disposer = disposer }
        else seats.push({ slot, disposer, missingRegistration: true })
        return () => {}
      },
    },
    effect(fn) { fn(); return () => {} },
    get(name) { return services.get(name) },
    // The event bus the plugin subscribes to (`theme/change` today). Emission is
    // explicit so a check can drive the change and read the live source after.
    on(name, callback) {
      const bucket = listeners.get(name) ?? []
      bucket.push(callback)
      listeners.set(name, bucket)
      return () => {
        const current = listeners.get(name) ?? []
        listeners.set(name, current.filter(entry => entry !== callback))
      }
    },
    emit(name, payload) {
      for (const callback of [...(listeners.get(name) ?? [])]) callback(payload)
    },
    inject(deps, callback) {
      // `scope.effect` mirrors cordis, and each dependency appears on the scope
      // as a live property read: an injected scope carries its services, and a
      // service that mounts later must answer when the callback finally runs.
      const scope = { effect(fn) { return fn() ?? (() => {}) } }
      for (const dep of deps) {
        Object.defineProperty(scope, dep, { get: () => services.get(dep), enumerable: true })
      }
      if (deps.every(dep => services.has(dep))) { callback(scope); return () => {} }
      waiting.push({ deps, callback, scope })
      return () => {}
    },
    provide(name, value) {
      services.set(name, value)
      for (const entry of [...waiting]) {
        if (!entry.deps.every(dep => services.has(dep))) continue
        waiting.splice(waiting.indexOf(entry), 1)
        entry.callback(entry.scope)
      }
    },
  }
  return { host, seats, dictionaries, provide: host.provide, emit: host.emit, mounted: services }
}

/** The recorded services one host's faces call, so the checks can read them back. */
function createServices() {
  const created = []
  const listed = []
  const browsed = []
  const made = []
  const opened = []
  const openedTabs = []
  const tabTypes = []
  const openedSessions = []
  const selectedPanels = []
  const scheme = { current: 'dark' }
  const state = {
    // `directoryPicker.pick` answer for the next call.
    pickReply: { ok: true, value: 'D:\\3_WorkProject\\demo' },
    // Whether `ui-workspace`'s browse primitives are served at all.
    browseServed: true,
    // `workspaceFiles.list` failure, when set.
    failWith: null,
    // Whether the Workspace registry rejects `create`.
    createFails: false,
    // Whether the right column refuses the address (no registered type claims it).
    paneRefuses: false,
    // Whether only the editor page kind is unregistered (the viewer still answers).
    tabRefuses: false,
    // The exact line the right column throws, when a check needs a specific one.
    paneMessage: undefined,
  }
  return {
    created,
    listed,
    browsed,
    made,
    opened,
    openedTabs,
    tabTypes,
    openedSessions,
    selectedPanels,
    scheme,
    // The theme service: the only thing the panel reads from it is the resolved
    // color scheme, which decides the background grid's color.
    theme: {
      getTheme() { return { active: { colorScheme: scheme.current } } },
    },
    state,
    // The tab-type registry `ui-sidebar-right` provides.
    sidebarRightTabs: {
      register(definition) { tabTypes.push(definition); return () => {} },
    },
    // The right column face `ui-sidebar-right` provides. Both verbs refuse the
    // same way it does: a write with no mounted session surface throws.
    sidebarRight: {
      openResource(address) {
        if (state.paneMessage !== undefined) throw new Error(state.paneMessage)
        if (state.paneRefuses) throw new Error(`openResource: no type will open "${address}"`)
        opened.push(address)
      },
      openTab(kind, options) {
        if (state.paneMessage !== undefined) throw new Error(state.paneMessage)
        if (state.paneRefuses || state.tabRefuses) throw new Error(`openTab: no tab type is registered as "${kind}"`)
        openedTabs.push({ kind, params: options?.params })
      },
    },
    // The client Session service `ui-workspace` also drives.
    sessions: {
      open(sessionId) { openedSessions.push(sessionId) },
    },
    // The layout service: the panel selection the right column is gated on.
    layout: {
      selectPanel(panelId) { selectedPanels.push(panelId) },
    },
    // The directory-picking + Session-navigation service `ui-workspace` provides.
    uiWorkspace: {
      openWorkspace: async () => {},
      startSession: () => {},
      // Only the browse backend serves these; a native boot refuses them.
      listDirectory: async (path) => {
        if (!state.browseServed) throw new Error('directoryPicker.list needs the browse capability')
        browsed.push(path)
        const at = path ?? 'C:\\Users\\tester'
        return {
          path: at,
          home: 'C:\\Users\\tester',
          crumbs: [
            { name: 'C:\\', path: 'C:\\', hidden: false },
            { name: 'Users', path: 'C:\\Users', hidden: false },
            { name: 'tester', path: 'C:\\Users\\tester', hidden: false },
            ...(at === 'C:\\Users\\tester' ? [] : [{ name: 'projects', path: at, hidden: false }]),
          ],
          entries: [
            { name: 'zeta', path: `${at}\\zeta`, hidden: false },
            { name: 'beta', path: `${at}\\beta`, hidden: false },
            { name: 'alpha', path: `${at}\\alpha`, hidden: false },
            { name: '.git', path: `${at}\\.git`, hidden: true },
          ],
          truncated: false,
        }
      },
      createDirectory: async (path, name) => {
        if (!state.browseServed) throw new Error('directoryPicker.createDirectory needs the browse capability')
        made.push({ path, name })
        return `${path}\\${name}`
      },
    },
    // `ctx.workspaces` — the Workspace Controller service.
    workspaces: {
      create: async (input) => {
        if (state.createFails) throw new Error(`create refused: ${input.path}`)
        created.push(input)
        return { workspaceId: 'w-new', path: input.path }
      },
      delete: async () => {},
    },
    // The generated `directoryPicker` Remote namespace. Its `pick` verb is
    // refused when the boot composed the browse interaction.
    directoryPicker: {
      pick: async () => state.pickReply,
    },
    // The generated `workspaceFiles` Remote namespace.
    workspaceFiles: {
      list: async (sessionId, path) => {
        listed.push({ sessionId, path })
        if (state.failWith !== null) return { ok: false, error: state.failWith }
        return {
          ok: true,
          value: {
            path: '',
            entries: [{ name: 'src', type: 'directory' }, { name: 'README.md', type: 'file', size: 2048 }],
            truncated: false,
          },
        }
      },
    },
  }
}

/** The two seats `apply()` must take, in a host's recording. */
function seatsOf(seats) {
  return {
    panel: seats.find(seat => seat.slot === 'main') ?? {},
    row: seats.find(seat => seat.slot === 'sidebar.panellist') ?? {},
  }
}

// ── 4. registration against a fully provisioned host ────────────────────────

console.log('host registration')

const full = createServices()
const a = createHost({
  uiWorkspace: full.uiWorkspace,
  workspaces: full.workspaces,
  'remote.workspaceFiles': full.workspaceFiles,
  'remote.directoryPicker': full.directoryPicker,
  sidebarRight: full.sidebarRight,
  sidebarRightTabs: full.sidebarRightTabs,
  sessions: full.sessions,
  layout: full.layout,
  theme: full.theme,
  remote: { workspaceFiles: full.workspaceFiles, directoryPicker: full.directoryPicker },
})
let threw
try {
  exports.apply(a.host)
} catch (error) {
  threw = error
}
check(threw === undefined, `apply() runs against a minimal host${threw === undefined ? '' : `: ${String(threw?.message ?? threw)}`}`)
check(a.dictionaries.length === 1 && a.dictionaries[0].namespace === 'workbench',
  'apply() registers the workbench dictionary namespace once')
const dicts = a.dictionaries[0]?.dicts
check(dicts?.zh !== undefined && dicts?.en !== undefined, 'the namespace carries both zh and en dictionaries')
check(dicts?.zh?.title !== undefined && dicts?.en?.title !== undefined, 'both dictionaries define the control-room title')
check(Object.keys(dicts?.zh ?? {}).length === Object.keys(dicts?.en ?? {}).length,
  'the zh and en dictionaries have the same key count')
check(a.seats.length === 4,
  `apply() takes exactly four registrations: the panel body, its panel row, the editor body, its chip title (got ${a.seats.length})`)

const { panel, row } = seatsOf(a.seats)
const editorBody = a.seats.find(seat => seat.slot === 'sidebar.right.pane.tab') ?? {}
const editorTitle = a.seats.find(seat => seat.slot === 'sidebar.right.pane.tab.title') ?? {}
check(panel.options?.name === 'main' && panel.options?.key === 'workbench',
  `the panel body registers under main key workbench (got ${String(panel.options?.name)}/${String(panel.options?.key)})`)
check(typeof panel.component === 'function', 'the panel body is a function component')
check(typeof panel.disposer === 'function', 'the panel registration returns a disposer')
check(row.options?.name === 'sidebar.panellist' && row.options?.id === 'workbench',
  `the panel-list row id matches the main key (got ${String(row.options?.id)})`)
check(typeof row.options?.label === 'function' && row.options.label() === 'workbench:trigger',
  'the row label resolves through the bound namespace at read time')
check(typeof row.component === 'function', 'the row renders a glyph component')

// The editor: a page tab type of the right column plus its two seats.
check(full.tabTypes.length === 1 && full.tabTypes[0].kind === 'workbench-editor',
  `apply() registers exactly one tab type: the editor page (got ${full.tabTypes.length})`)
check(full.tabTypes[0]?.priority === 'extension' && full.tabTypes[0]?.patterns === undefined,
  'the editor is a page type, so it never competes for a file address')
check(typeof full.tabTypes[0]?.title === 'function' && full.tabTypes[0].title() === 'workbench:editor.title',
  'the editor chip falls back to namespace copy')
check(editorBody.options?.key === 'dsh-workbench/editor' && editorTitle.options?.key === 'dsh-workbench/editor',
  'the body and chip title register under the same type id')
check(typeof editorBody.component === 'function' && typeof editorTitle.component === 'function',
  'both editor seats carry a component')
const editorFace = editorBody.options?.inject?.()
check(typeof editorFace?.readFile === 'function' && typeof editorFace?.writeFile === 'function',
  'the editor injects the read and write halves of the file flow')
check(typeof editorFace?.openPreview === 'function', 'the editor can hand the file to the official viewer')

const injected = panel.options?.inject?.()
check(typeof injected?.wt === 'function', 'the panel injects the bound translate')
check(typeof injected?.pickWorkspace === 'function', 'the panel injects the pick-a-directory flow')
check(typeof injected?.registerWorkspace === 'function', 'the panel injects the Workspace adoption step')
check(typeof injected?.browseDirectory === 'function', 'the panel injects the in-app picker\'s lister')
check(typeof injected?.makeDirectory === 'function', 'the panel injects the in-app picker\'s folder creator')
check(typeof injected?.openFile === 'function', 'the panel injects the right-column file opener')
check(typeof injected?.selectSession === 'function',
  'the panel injects the session selection the handover needs')
check(typeof injected?.showConversation === 'function',
  'the panel injects the conversation handover, without which the right column does not exist')
check(typeof injected?.openWorkspace === 'function', 'the panel injects open-Workspace navigation')
check(typeof injected?.startSession === 'function', 'the panel injects start-Session navigation')
check(typeof injected?.removeWorkspace === 'function', 'the panel injects Workspace removal')
check(typeof injected?.listDirectory === 'function', 'the panel injects the directory lister')
check(typeof injected?.hooks?.capability?.getSnapshot === 'function',
  'the panel injects the capability source as a hook, not as a captured flag')
check(injected?.hooks?.scheme?.getSnapshot() === true,
  'the panel injects the color scheme as a live source, seeded from the theme service')
// The grid is white on a dark palette and gold on a light one, so the source has
// to follow the host theme rather than a build-time constant.
a.emit('theme/change', { active: { colorScheme: 'light' } })
check(injected?.hooks?.scheme?.getSnapshot() === false,
  'a theme change flips the scheme source the panel renders the grid from')
// …and the seed reads the service rather than a build-time constant: a host
// whose active theme is light starts the panel on the light grid.
const lightHost = createServices()
const light = createHost({
  uiWorkspace: lightHost.uiWorkspace,
  workspaces: lightHost.workspaces,
  'remote.workspaceFiles': lightHost.workspaceFiles,
  'remote.directoryPicker': lightHost.directoryPicker,
  sidebarRight: lightHost.sidebarRight,
  sidebarRightTabs: lightHost.sidebarRightTabs,
  sessions: lightHost.sessions,
  layout: lightHost.layout,
  theme: { getTheme: () => ({ active: { colorScheme: 'light' } }) },
})
exports.apply(light.host)
check(seatsOf(light.seats).panel.options?.inject?.().hooks?.scheme?.getSnapshot() === false,
  'a host whose active theme is light seeds the scheme source on the light palette')
check(JSON.stringify(injected?.hooks?.capability?.getSnapshot())
  === '{"navigation":true,"workspaces":true,"files":true,"picker":true,"pane":true}',
  `a fully provisioned host reports every capability mounted (got ${JSON.stringify(injected?.hooks?.capability?.getSnapshot())})`)

// ── 5. the faces actually reach the Host ────────────────────────────────────

console.log('workspace faces')

// A cancelled chooser must not create anything.
full.state.pickReply = { ok: true, value: null }
check((await injected.pickWorkspace()).kind === 'cancelled', 'a null chooser answer is a cancellation')
check(full.created.length === 0, 'a cancelled directory pick creates no Workspace')

// The native path: the OS chooser answers a path, the registry adopts it.
full.state.pickReply = { ok: true, value: 'D:\\3_WorkProject\\demo' }
const nativeAdd = await injected.pickWorkspace()
check(nativeAdd.kind === 'created' && nativeAdd.path === 'D:\\3_WorkProject\\demo',
  `a chooser answer is adopted as a Workspace (${JSON.stringify(nativeAdd)})`)
check(full.created.length === 1 && full.created[0].path === 'D:\\3_WorkProject\\demo',
  `the registration carries the picked path (${JSON.stringify(full.created[0] ?? null)})`)

// A Host rejection is reported, not swallowed: this is the bug that made the
// add button look dead.
full.state.createFails = true
const refused = await injected.pickWorkspace()
check(refused.kind === 'failed' && refused.message.includes('create refused'),
  `a refused registration reports the Host's line (${JSON.stringify(refused)})`)
full.state.createFails = false
const adopted = await injected.registerWorkspace('D:\\3_WorkProject\\other')
check(adopted.kind === 'created' && full.created.length === 2,
  'the adoption step registers a path the in-app picker confirmed')

// The browse path: the boot composed no OS chooser, so `pick` is refused by the
// Host. This is the DSH Desktop composition (its boot graph loads
// ui-directory-picker-browse and not -native), and reading that refusal as an
// error is what made adding a directory impossible there.
full.state.pickReply = {
  ok: false,
  error: {
    code: 'directory-picker/unavailable',
    message: 'directoryPicker.pick needs the native capability; the composed picker serves "browse"',
  },
}
check((await injected.pickWorkspace()).kind === 'browse',
  'a refused pick asks for the in-app picker instead of failing')

// Any other pick failure stays a failure, carrying the Host's own line.
full.state.pickReply = { ok: false, error: { code: 'gateway/internal', message: 'chooser exploded' } }
const pickFailed = await injected.pickWorkspace()
check(pickFailed.kind === 'failed' && pickFailed.message === 'chooser exploded',
  `a real chooser failure is reported as itself (${JSON.stringify(pickFailed)})`)

// The in-app picker's own two primitives.
const home = await injected.browseDirectory(undefined, new AbortController().signal)
check(home.ok === true && home.value.home === 'C:\\Users\\tester' && home.value.entries.length === 4,
  'the in-app picker lists the host home level')
check(full.browsed.length === 1 && full.browsed[0] === undefined,
  'an absent path asks the Host for its home directory, not a client-side guess')
const madeDir = await injected.makeDirectory('C:\\Users\\tester', 'new-project')
check(madeDir.ok === true && madeDir.path === 'C:\\Users\\tester\\new-project',
  `the in-app picker can create a folder and receives its absolute path (${JSON.stringify(madeDir)})`)
full.state.browseServed = false
const browseRefused = await injected.browseDirectory(undefined, new AbortController().signal)
check(browseRefused.ok === false && browseRefused.message.includes('browse capability'),
  'a listing failure is reported instead of thrown at the panel')
full.state.browseServed = true

// ── 5b. opening a file in the right column ──────────────────────────────────

// The address grammar is the one the official `text` tab type claims, built
// locally because `@deepseek-ai/dsh-util-workspace-path` is not a platform
// baseline module. These are the documented shapes, pinned here.
console.log('file open')

check(exports.fileAddress('s-1', 'D:\\3_WorkProject\\demo\\README.md')
  === 'dsh-resource://file/session/s-1/D:/3_WorkProject/demo/README.md',
  `a Windows path keeps its drive colon and normalizes separators (${exports.fileAddress('s-1', 'D:\\3_WorkProject\\demo\\README.md')})`)
check(exports.fileAddress('s-1', 'D:\\a b\\c#d\\e?f.txt')
  === 'dsh-resource://file/session/s-1/D:/a%20b/c%23d/e%3Ff.txt',
  'segments are percent-encoded, so spaces and #/? survive the round trip')
check(exports.fileAddress('s-1', '/home/me/notes.txt') === 'dsh-resource://file/session/s-1//home/me/notes.txt',
  'a POSIX absolute path keeps its leading empty segment, which is what decodes back to /home/…')
check(exports.fileAddress('s 1', 'x.txt') === 'dsh-resource://file/session/s%201/x.txt',
  'the Session id is encoded too')

const fileOutcome = injected.openFile('session-1', 'D:\\3_WorkProject\\demo\\README.md')
check(fileOutcome.ok === true && full.openedTabs.length === 1,
  'a double-clicked file is handed to the right column')
check(full.openedTabs[0]?.kind === 'workbench-editor'
  && full.openedTabs[0]?.params?.sessionId === 'session-1'
  && full.openedTabs[0]?.params?.path === 'D:\\3_WorkProject\\demo\\README.md',
  `the column opens the editor page with the file (${JSON.stringify(full.openedTabs[0] ?? null)})`)
check(full.opened.length === 0, 'the editor is the default route, not the read-only viewer')

// The explicit viewer route still works, and is what Markdown/PDF/images need.
const preview = editorFace.openPreview('session-1', 'D:\\3_WorkProject\\demo\\README.md')
check(preview.ok === true && full.opened.length === 1
  && full.opened[0] === 'dsh-resource://file/session/session-1/D:/3_WorkProject/demo/README.md',
  `the viewer route hands over the session-scoped address (${String(full.opened[0])})`)

// The editor type missing changes the route, not the outcome: the official
// viewer answers instead of the click doing nothing.
full.state.tabRefuses = true
const fallbackOpen = injected.openFile('session-1', 'D:\\3_WorkProject\\demo\\README.md')
check(fallbackOpen.ok === true && full.opened.length === 2,
  'an unregistered editor type falls back to the official viewer')
full.state.tabRefuses = false
full.state.paneRefuses = true
const refusedOpen = editorFace.openPreview('session-1', 'D:\\3_WorkProject\\demo\\README.md')
check(refusedOpen.ok === false && refusedOpen.message.includes('no type will open'),
  `an address no viewer claims is reported, not thrown (${JSON.stringify(refusedOpen)})`)
full.state.paneRefuses = false

// The right column is session content: with no session surface mounted, every
// open is refused, and that refusal must arrive classified — it is the one the
// panel repairs by selecting the Workspace's session and retrying.
full.state.paneRefuses = true
full.state.paneMessage = 'sidebarRight: no session surface is mounted'
const noSeat = injected.openFile('session-1', 'D:\\3_WorkProject\\demo\\README.md')
check(noSeat.ok === false && noSeat.code === 'pane/no-session',
  `a missing session seat is classified so the caller can repair it (${JSON.stringify(noSeat)})`)
full.state.paneMessage = undefined
const otherRefusal = injected.openFile('session-1', 'D:\\3_WorkProject\\demo\\README.md')
check(otherRefusal.ok === false && otherRefusal.code === undefined,
  'every other refusal stays a plain line, not a repairable code')
full.state.paneRefuses = false

// The repair itself, in the order the panel takes it: select the session, then
// hand the center column back to the Conversation. That second step is the one
// that matters — `ui-sidebar-right`'s root controller mounts its session seat
// only while `activePanelId === null`, so a global panel has no right column at
// all until the Conversation is selected.
check(injected.selectSession('session-1') === true && full.openedSessions.length === 1
  && full.openedSessions[0] === 'session-1',
  'selecting a session reaches the sessions service')
check(injected.showConversation() === true && full.selectedPanels.length === 1
  && full.selectedPanels[0] === null,
  'showing the conversation selects the null panel, which is what mounts the right column')
const noSessionsHost = createHost({ sidebarRight: full.sidebarRight })
exports.apply(noSessionsHost.host)
const bareSelect = seatsOf(noSessionsHost.seats)
check(bareSelect.panel.options?.inject?.().selectSession('s-1') === false,
  'with no sessions service the session half of the repair reports that it could not run')
check(bareSelect.panel.options?.inject?.().showConversation() === false,
  'with no layout service the column handover reports that it could not run')

// ── 5c. the editor's read/write contract with the Host routes ───────────────

// The client half talks to this plugin's own Host routes with `fetch`; those
// routes are checked end to end against a real host by `check-file-routes.mjs`.
// Here the wire shape is pinned: which route, which method, which fields, and
// how each answer is classified.
console.log('editor routes')

const calls = []
let answer = { body: { ok: true, text: 'hello\n', version: 'v-1', size: 6 } }
const realFetch = globalThis.fetch
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), init })
  if (answer instanceof Error) throw answer
  return { status: answer.status ?? 200, json: async () => answer.body }
}

const loaded = await editorFace.readFile('session-1', 'D:\\3_WorkProject\\demo\\README.md')
check(loaded.ok === true && loaded.text === 'hello\n' && loaded.version === 'v-1',
  `the editor loads text and version from the read route (${JSON.stringify(loaded)})`)
check(calls[0]?.url === '/workbench/file/read' && calls[0]?.init?.method === 'POST',
  `the read goes to this plugin's own route by POST (${String(calls[0]?.url)})`)
check(JSON.parse(String(calls[0]?.init?.body)).sessionId === 'session-1'
  && JSON.parse(String(calls[0]?.init?.body)).path === 'D:\\3_WorkProject\\demo\\README.md',
  'the read body names the Session and the path, never a root the client asserts')

answer = { body: { ok: true, version: 'v-2' } }
const saved = await editorFace.writeFile('session-1', 'D:\\3_WorkProject\\demo\\README.md', 'hello\nworld\n', 'v-1')
check(saved.ok === true && saved.version === 'v-2',
  `the editor saves through the write route and takes the new version (${JSON.stringify(saved)})`)
const writeBody = JSON.parse(String(calls[1]?.init?.body))
check(calls[1]?.url === '/workbench/file/write'
  && writeBody.text === 'hello\nworld\n' && writeBody.version === 'v-1',
  'the write body carries the full text and the version the reader loaded')

answer = { status: 409, body: { ok: false, code: 'workbench/stale', message: 'stale' } }
const stale = await editorFace.writeFile('session-1', 'D:\\3_WorkProject\\demo\\README.md', 'x', 'v-old')
check(stale.ok === false && stale.code === 'workbench/stale',
  `a stale version is classified as its own outcome (${JSON.stringify(stale)})`)

answer = { status: 403, body: { ok: false, code: 'workbench/outside-workspace', message: 'outside' } }
const outside = await editorFace.readFile('session-1', 'C:\\elsewhere\\a.txt')
check(outside.ok === false && outside.message === 'outside',
  'a refusal carries the Host line to the editor')

answer = new Error('network down')
const unreachable = await editorFace.readFile('session-1', 'D:\\x.txt')
check(unreachable.ok === false && unreachable.code === 'workbench/unreachable',
  'an unreachable route is its own outcome rather than a thrown promise')
globalThis.fetch = realFetch

const level = await injected.listDirectory('session-1', 'D:\\3_WorkProject\\demo', new AbortController().signal)
check(level.ok === true, 'a directory listing reports success')
check(level.value.status === 'ready' && level.value.entries.length === 2,
  `the listing carries the Host entries (${level.value.entries.length})`)
check(full.listed.length === 1 && full.listed[0].sessionId === 'session-1',
  'the listing travels with the Session that owns the workspace root')

full.state.failWith = { code: 'workspace-file/outside-workspace', message: 'raw' }
const denied = await injected.listDirectory('session-1', 'C:\\elsewhere', new AbortController().signal)
check(denied.ok === false && denied.value.status === 'error',
  'a refused listing becomes an error level rather than a throw')
check(denied.value.error === 'workbench:tree.error.outside',
  `the error line is namespace copy, not an English literal (got ${JSON.stringify(denied.value.error)})`)
full.state.failWith = null

// ── 6. a capability that mounts after apply ─────────────────────────────────

// The regression this plugin was rebuilt around: `apply` runs as soon as
// `slots` and `locale` exist, while the Remote namespaces mount asynchronously
// afterwards. Probing once at apply time froze an absent `workspaceFiles` and
// the panel reported "no file capability" for the life of the page.
console.log('late capability')

const late = createServices()
const b = createHost({})
let lateThrew
try {
  exports.apply(b.host)
} catch (error) {
  lateThrew = error
}
const lateInjected = seatsOf(b.seats).panel.options?.inject?.()
check(lateThrew === undefined && b.seats.length === 4,
  'apply() registers the panel, its row, and the editor seats against a host that has mounted nothing yet')
const before = lateInjected?.hooks?.capability?.getSnapshot() ?? {}
check(before.files === false && before.navigation === false && before.workspaces === false
  && before.picker === false && before.pane === false,
  `every capability starts unmounted (got ${JSON.stringify(before)})`)
const beforeLevel = await lateInjected.listDirectory('session-1', 'D:\\x', new AbortController().signal)
check(beforeLevel.ok === false && beforeLevel.value.error === 'workbench:tree.unavailable',
  'a listing asked for before the namespace mounts answers a failed level, not a missing action')
check((await lateInjected.pickWorkspace()).kind === 'failed',
  'an add flow asked for before the registry mounts answers a failure, not a dead button')
check(lateInjected.openFile('s-1', 'D:\\x').ok === false,
  'opening a file before the right column mounts reports instead of throwing')

// This is the same inject face captured above: nothing is re-registered.
b.provide('uiWorkspace', late.uiWorkspace)
b.provide('workspaces', late.workspaces)
b.provide('remote.workspaceFiles', late.workspaceFiles)
b.provide('remote.directoryPicker', late.directoryPicker)
b.provide('sidebarRight', late.sidebarRight)
b.provide('sessions', late.sessions)
b.provide('layout', late.layout)
check(lateInjected.hooks.capability.getSnapshot().files === true,
  'mounting the Remote namespace flips the file capability on the live source')
check(lateInjected.hooks.capability.getSnapshot().navigation === true,
  'mounting ui-workspace flips the navigation capability on the live source')
check(lateInjected.hooks.capability.getSnapshot().picker === true,
  'mounting the chooser namespace flips the picker capability on the live source')
check(lateInjected.hooks.capability.getSnapshot().pane === true,
  'mounting the right column flips the pane capability on the live source')
late.state.pickReply = { ok: true, value: 'D:\\late' }
const lateAdd = await lateInjected.pickWorkspace()
check(lateAdd.kind === 'created' && late.created.length === 1,
  'the add flow resolves its services per call, so a late mount still adds')
check(lateInjected.openFile('s-1', 'D:\\late\\a.txt').ok === true && late.openedTabs.length === 1,
  'the file opener resolves the right column per call, so a late mount still opens')
const lateLevel = await lateInjected.listDirectory('session-1', 'D:\\late', new AbortController().signal)
check(lateLevel.ok === true && lateLevel.value.entries.length === 2,
  'the directory lister resolves the Remote namespace per call, so a late mount still lists')

// ── 7. the explorer row model ───────────────────────────────────────────────

console.log('explorer model')

const root = 'D:\\3_WorkProject\\demo'
const levels = new Map([
  [root, {
    status: 'ready',
    truncated: false,
    entries: [
      { name: 'README.md', type: 'file', size: 2048 },
      { name: 'src', type: 'directory' },
      { name: 'zeta.txt', type: 'file', size: 10 },
      { name: 'Alpha', type: 'directory' },
      { name: 'file10.txt', type: 'file', size: 1 },
      { name: 'file2.txt', type: 'file', size: 1 },
    ],
  }],
])
const collapsed = exports.explorerRows(root, levels, new Set())
check(collapsed.every(row => row.kind === 'entry'),
  'a collapsed root draws only entry rows')
check(collapsed.map(row => row.name).join(',') === 'Alpha,src,file2.txt,file10.txt,README.md,zeta.txt',
  `directories come first, then natural case-insensitive name order (${collapsed.map(row => row.name).join(',')})`)
check(collapsed.every(row => row.depth === 0), 'every root entry sits at depth zero')

const srcPath = `${root}/src`
const opened = new Map(levels)
opened.set(srcPath, {
  status: 'ready',
  truncated: false,
  entries: [{ name: 'index.ts', type: 'file', size: 12 }, { name: 'nested', type: 'directory' }],
})
const expandedRows = exports.explorerRows(root, opened, new Set([srcPath]))
const srcIndex = expandedRows.findIndex(row => row.path === srcPath)
check(srcIndex >= 0 && expandedRows[srcIndex].expanded === true,
  'an expanded directory row reports itself expanded')
check(expandedRows[srcIndex + 1]?.path === `${srcPath}/nested` && expandedRows[srcIndex + 1]?.depth === 1,
  'its children follow it immediately, one level deeper')
check(expandedRows[srcIndex + 2]?.path === `${srcPath}/index.ts` && expandedRows[srcIndex + 2]?.depth === 1,
  'a child level keeps the directories-first order too')

const unlisted = exports.explorerRows(root, new Map([[root, { status: 'ready', truncated: false, entries: [{ name: 'src', type: 'directory' }] }]]), new Set([srcPath]))
check(unlisted.some(row => row.kind === 'note' && row.note === 'loading'),
  'an expanded directory with no listing yet draws a loading note')
check(exports.explorerRows(root, new Map([[root, { status: 'error', entries: [], truncated: false, error: 'boom' }]]), new Set())
  .some(row => row.kind === 'note' && row.note === 'failed' && row.error === 'boom'),
  'a failed level draws a failed note carrying its line')
check(exports.explorerRows(root, new Map([[root, { status: 'ready', entries: [], truncated: false }]]), new Set())
  .some(row => row.kind === 'note' && row.note === 'empty'),
  'an empty level draws an empty note rather than nothing')

const truncatedRows = exports.explorerRows(root, new Map([[root, {
  status: 'ready', truncated: true, entries: [{ name: 'a', type: 'file' }],
}]]), new Set())
check(truncatedRows[truncatedRows.length - 1]?.note === 'truncated',
  'the entry cap is reported after the entries it dropped')

check(exports.splitPath('D:\\3_WorkProject\\work_desk').name === 'work_desk'
  && exports.splitPath('D:\\3_WorkProject\\work_desk').directory === 'D:\\3_WorkProject\\',
  'the header splits a Windows root into parent and name')
check(exports.splitPath('/home/me/project/').name === 'project', 'a trailing separator is not the name')

// The address bar walks up with the same path grammar the header splits with.
check(exports.parentPathOf('D:\\3_WorkProject\\work_desk') === 'D:\\3_WorkProject\\',
  `a Windows path steps up to its parent (${String(exports.parentPathOf('D:\\3_WorkProject\\work_desk'))})`)
check(exports.parentPathOf('/home/me/project') === '/home/me/', 'a POSIX path steps up the same way')
check(exports.parentPathOf('D:\\') === undefined && exports.parentPathOf('/') === undefined,
  'a root has no parent, so the up control is disabled there')
check(exports.parentPathOf('relative') === undefined, 'a bare name has no parent to step to')

// ── 7b. the pick flow's decision table ──────────────────────────────────────

console.log('pick flow')

check(exports.pickStep(undefined).step === 'browse',
  'no pick namespace at all means browsing in-app')
check(exports.pickStep({ ok: true, value: 'D:\\p' }).step === 'picked',
  'a chooser answer is a picked path')
check(exports.pickStep({ ok: true, value: '' }).step === 'cancelled'
  && exports.pickStep({ ok: true, value: null }).step === 'cancelled',
  'an empty or null answer is a cancellation')
const refusal = { ok: false, error: { code: 'directory-picker/unavailable', message: 'needs the native capability' } }
check(exports.pickStep(refusal).step === 'browse',
  'the documented "browse backend serves no pick" refusal forks into the in-app picker')
check(exports.pickStep({ ok: false, error: { code: 'gateway/internal', message: 'boom' } }).message === 'boom',
  'any other failure stays a failure, carrying the Host line')

const listing = {
  path: 'C:\\Users\\tester\\projects',
  home: 'C:\\Users\\tester',
  crumbs: [
    { name: 'C:\\', path: 'C:\\', hidden: false },
    { name: 'Users', path: 'C:\\Users', hidden: false },
    { name: 'tester', path: 'C:\\Users\\tester', hidden: false },
    { name: 'projects', path: 'C:\\Users\\tester\\projects', hidden: false },
  ],
  entries: [
    { name: 'zeta', path: 'C:\\Users\\tester\\projects\\zeta', hidden: false },
    { name: '.config', path: 'C:\\Users\\tester\\projects\\.config', hidden: true },
    { name: 'alpha', path: 'C:\\Users\\tester\\projects\\alpha', hidden: false },
  ],
  truncated: false,
}
const crumbs = exports.pickerCrumbs(listing)
check(crumbs.some(crumb => crumb.home && crumb.path === 'C:\\Users\\tester'),
  'the Home crumb is marked where the host chain contains it')
check(crumbs[crumbs.length - 1].path === listing.path, 'the listed directory is the last crumb')
check(exports.pickerCrumbs({ ...listing, crumbs: [{ name: 'D:\\', path: 'D:\\', hidden: false }] })
  .some(crumb => crumb.home), 'Home is added as a jump target when the chain is on another root')
check(exports.pickerEntries(listing, false).map(entry => entry.name).join(',') === 'alpha,zeta',
  `hidden directories stay out of the rows by default (${exports.pickerEntries(listing, false).map(e => e.name).join(',')})`)
check(exports.pickerEntries(listing, true).map(entry => entry.name).join(',') === '.config,alpha,zeta',
  'asking for hidden directories shows them, in the same natural order')

// ── 8. the degraded composition ─────────────────────────────────────────────

// A composition that never mounts any Workspace service must still mount the
// panel: a truthful, reduced face beats a registration that never resolves.
console.log('degraded composition')

const bare = createHost({})
let bareThrew
try {
  exports.apply(bare.host)
} catch (error) {
  bareThrew = error
}
check(bareThrew === undefined,
  `apply() mounts without any Workspace service${bareThrew === undefined ? '' : `: ${String(bareThrew?.message ?? bareThrew)}`}`)
check(bare.seats.length === 4, 'the degraded composition still registers every slot it owns')
const bareInjected = seatsOf(bare.seats).panel.options?.inject?.()
check(typeof bareInjected?.pickWorkspace === 'function' && typeof bareInjected?.listDirectory === 'function',
  'its actions are present and inert rather than missing')
const bareAdd = await bareInjected.pickWorkspace()
check(bareAdd.kind === 'failed' && bareAdd.message === 'workbench:notice.noWorkspaceService',
  `with nothing mounted the add flow says so (${JSON.stringify(bareAdd)})`)
check((await bareInjected.registerWorkspace('D:\\x')).kind === 'failed',
  'and the adoption step refuses rather than reporting a phantom success')
const bareBrowse = await bareInjected.browseDirectory(undefined, new AbortController().signal)
check(bareBrowse.ok === false && bareBrowse.message === 'workbench:picker.unavailable',
  'the in-app picker states the missing browsing capability as a line')
const bareOpen = bareInjected.openFile('s-1', 'D:\\x')
check(bareOpen.ok === false && bareOpen.message === 'workbench:file.noPane',
  `with no right column the file opener says so (${JSON.stringify(bareOpen)})`)
check(bareInjected.hooks.capability.getSnapshot().files === false,
  'the capability source answers "nothing mounted" instead of throwing')
const bareLevel = await bareInjected.listDirectory('session-1', 'D:\\x', new AbortController().signal)
check(bareLevel.ok === false && bareLevel.value.error === 'workbench:tree.unavailable',
  'the degraded file face states the missing namespace as a level failure')
check(typeof bareInjected?.wt === 'function', 'the translate is always present')
// The panel reads its card grid through a global hook the composition supplies.
// Without that source the grid must answer empty instead of throwing: the read
// is one exported function, so the degraded answer is checkable without a
// renderer (the bundle resolves React as a module-table row, not a real DOM).
const rows = [
  { workspaceId: 'w-1', path: 'D:\\a', title: 'a', sessionIds: ['s-1'], createdAt: '', updatedAt: '' },
]
check(Array.isArray(exports.workspaceItems(undefined)) && exports.workspaceItems(undefined).length === 0,
  'an absent Workspace snapshot reads as an empty grid rather than throwing')
check(exports.workspaceItems({ items: rows, archivedSessionIds: [] }).length === 1,
  'a mounted Workspace snapshot passes its rows through to the grid')

// ── summary ─────────────────────────────────────────────────────────────────

console.log('')
if (failures.length === 0) {
  console.log('OK  the artifact satisfies the DSH client-module contract')
} else {
  console.log(`${failures.length} check(s) failed`)
  process.exitCode = 1
}
