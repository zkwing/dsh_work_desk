/**
 * Client half of `dsh-coding-bench`.
 *
 * The bundle ships a single client module: this `apply` function, called once
 * per profile that loads the plugin. It registers:
 *
 * - the `coding-bench` locale namespace (Chinese source of truth, English
 *   checked complete against it);
 * - a `main`-slot body under the key `coding-bench`, which is what the user
 *   sees in the center column when they pick the bench from the sidebar;
 * - a sidebar panel-list row under the same id, so the bench is pickable;
 * - a right-column page kind `coding-bench`, registered through both
 *   `sidebarRightTabs.register` (its description) and the two `sidebar.right.*`
 *   slot pairs (its body and its title), so `ctx.sidebarRight.openTab` can
 *   open it.
 *
 * What the M2 milestone ships is the wiring. The bodies are placeholders —
 * the placeholders still mount, the right column still opens, the slot toggle
 * still works, and the dictionary covers everything the surfaces draw. The
 * real file tree, the editor, the multi-tab + multi-pane layout, the keymap
 * and the theme land in their own modules after this one.
 *
 * The same composition rules as dsh-workbench: the `inject` list names
 * upstream services only, so the bundle activates identically under
 * `dsh web`, DSH Desktop compatibility mode and DSH Desktop advanced mode.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Load the `Context` augmentations: `ctx.slots` lives here, and
// `ctx.sidebarRightTabs` lives in the sidebar-right package. Empty
// type-only imports are enough — the declaration-merge runs as soon as
// tsc sees the file.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import {
  MainSlotBody, BenchPageBody, BenchPageChip, CodingBenchPanelIcon,
  type CodingBenchInjected, type CodingBenchSlot, type CodingBenchTranslate,
} from './panel.js'
export type { CodingBenchInjected } from './panel.js'
import { en, zh, type WorkbenchKey } from './locales.js'

/** The plugin's dictionary namespace. The host reads it through the locale
 *  service and re-renders every bound translate when the language changes. */
const NS = 'coding-bench'

/** The `main` slot key, the `sidebar.panellist` row id and the
 *  `sidebarRightTabs` kind all share this string, so the three registrations
 *  refer to the same plugin surface. */
const PANEL_ID = 'coding-bench'

/** The right-column page kind. `ctx.sidebarRight.openTab(KIND, params)` opens
 *  this page; the body and title are bound to the same id by their `key`. */
const RIGHT_PAGE_KIND = 'coding-bench'

/** Services the `apply` body actually needs right now. Each one is checked
 *  per call inside the inject face factory, so a composition that mounts the
 *  plugin before these services are available will still register the
 *  dictionary and the slots; the pages and the body that depend on them
 *  come up empty in the meantime. */
export const inject = ['slots', 'locale', 'sidebarRightTabs'] as const

/** Translate re-export so other modules (the editor, the explorer) can pick
 *  the same typed `TranslateNS<'coding-bench'>` without redefining it. */
export type { CodingBenchTranslate, CodingBenchSlot }

/** Bind the plugin's locales and register every slot/page that contributes
 *  to the host surface. The function closes over `ctx` (the host's client
 *  context) and the bound translate, so every registration can rebind both
 *  without going through a module-level mutable. */
export function apply(ctx: ClientContext): void {
  // The bound translate follows the active locale. Every slot factory below
  // closes over it (or rebinds it on every read) so a language switch
  // re-renders the panel without re-registering anything.
  const t = ctx.locale.bind(NS) as CodingBenchTranslate

  // The inject face factory. The slot system calls this once per slot
  // instance and caches the result, so anything the body needs on every
  // render must come from `ctx.get` and the live `hooks` observable — not
  // a captured closure variable. The translate is the one exception: it is
  // already locale-reactive, so capturing it here is safe.
  const injected = (): CodingBenchInjected => ({ wt: t })

  // Dictionary registration: the host's locale service reads this map and
  // hands the bound translate to every slot factory that asks for it.
  ctx.effect(() => ctx.locale.register(NS, { zh, en }),
    'dsh-coding-bench: dictionary')

  // Center column: the placeholder body. M3 fills it with the workspace
  // card grid; the slot key stays the same so the registration below is
  // stable across milestones.
  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PANEL_ID,
    inject: injected,
  }, MainSlotBody))

  // Sidebar panel-list row: the glyph the operator clicks to bring the
  // panel back into the center column. The label is a thunk so a language
  // switch re-renders the row without re-registering it.
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 20,
    label: () => t('trigger'),
  }, CodingBenchPanelIcon))

  // Right column page kind. Two halves to wire:
  //  1. register the page description on the `sidebarRightTabs` service —
  //     the host reads this to know what kind exists, what to title the
  //     tab with, and how to prioritise it against other contenders.
  //  2. register the body and the title components on the
  //     `sidebar.right.pane.tab` and `sidebar.right.pane.tab.title` slots
  //     — these are what `sidebarRightTabs` consults to render an open page.
  // The id on the description and the key on the slot registration must be
  // the same string the caller passes to `ctx.sidebarRight.openTab`.
  ctx.inject(['sidebarRightTabs'], (scope) => {
    scope.effect(() => {
      const tabs = scope.sidebarRightTabs as { register: (description: { id: string; kind: string; priority: 'extension' | 'core'; title: () => string }) => void }
      tabs.register({
        id: PANEL_ID,
        kind: RIGHT_PAGE_KIND,
        priority: 'extension',
        title: () => t('title'),
      })
      return () => {
        // The host drops the registration when the service unmounts.
      }
    }, 'dsh-coding-bench: right page description')
  })

  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab',
    key: RIGHT_PAGE_KIND,
    locale: NS,
    inject: injected,
  }, BenchPageBody))

  ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab.title',
    key: RIGHT_PAGE_KIND,
    inject: injected,
  }, BenchPageChip))
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The Coding Bench dictionary: the panel body, the right-column page,
     *  the tab chip and the foot hint. */
    'coding-bench': WorkbenchKey
  }
}
