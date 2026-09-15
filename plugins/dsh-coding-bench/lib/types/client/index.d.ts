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
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { type CodingBenchSlot, type CodingBenchTranslate } from './panel.js';
export type { CodingBenchInjected } from './panel.js';
import { type WorkbenchKey } from './locales.js';
/** Services the `apply` body actually needs right now. Each one is checked
 *  per call inside the inject face factory, so a composition that mounts the
 *  plugin before these services are available will still register the
 *  dictionary and the slots; the pages and the body that depend on them
 *  come up empty in the meantime. */
export declare const inject: readonly ["slots", "locale", "sidebarRightTabs"];
/** Translate re-export so other modules (the editor, the explorer) can pick
 *  the same typed `TranslateNS<'coding-bench'>` without redefining it. */
export type { CodingBenchTranslate, CodingBenchSlot };
/** Bind the plugin's locales and register every slot/page that contributes
 *  to the host surface. The function closes over `ctx` (the host's client
 *  context) and the bound translate, so every registration can rebind both
 *  without going through a module-level mutable. */
export declare function apply(ctx: ClientContext): void;
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The Coding Bench dictionary: the panel body, the right-column page,
         *  the tab chip and the foot hint. */
        'coding-bench': WorkbenchKey;
    }
}
//# sourceMappingURL=index.d.ts.map