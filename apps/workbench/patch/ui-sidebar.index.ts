/** Registers the sidebar shell and global panel navigation. */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the SlotRegistry service merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the Session root standard-props merge.
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type { SidebarPanelMetadata, SidebarRootInjected } from './contract/slots.ts'
import { SidebarRoot } from './SidebarRoot.tsx'
import { WorkbenchTrigger, en as workbenchEn, zh as workbenchZh } from './workbench/index.ts'
import { en, zh, type SidebarKey } from './locales.ts'

export type {
  SidebarBrandMarkOwnerProps, SidebarBrandNameOwnerProps, SidebarFooterActionOwnerProps,
  SidebarPanelIconOwnerProps, SidebarPanelMetadata,
  SidebarRootComponentProps, SidebarRootInjected, SidebarSectionOwnerProps, SidebarSettingsOwnerProps,
} from './contract/slots.ts'
export type { SidebarKey } from './locales.ts'
export { WorkbenchTrigger, type WorkbenchTriggerProps } from './workbench/index.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Sidebar controls and global panel copy. */
    sidebar: SidebarKey
    /** The workbench control room's copy (owned by the workbench module). */
    workbench: import('./workbench/index.ts').WorkbenchKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'sidebar'

/** Dictionary namespace owned by the workbench module. */
const WORKBENCH_NS = 'workbench'

interface WorkspaceNavigation {
  startSession(workspaceId?: Parameters<SidebarRootInjected['startSession']>[0]): void
}

/** Services required by the sidebar plugin. */
export const inject = ['slots', 'layout', 'uiWorkspace', 'locale']

/** Registers the sidebar shell and its service callbacks.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  const workspaceNavigation = ctx.get('uiWorkspace') as unknown as WorkspaceNavigation
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-sidebar: dictionaries')
  // The workbench renders inside this plugin's own client half, so it registers
  // its dictionary here and binds the namespace once: the bound translate is
  // locale-reactive and stable, which is what an inject face needs.
  ctx.effect(() => ctx.locale.register(WORKBENCH_NS, { zh: workbenchZh, en: workbenchEn }), 'ui-sidebar: workbench dictionaries')
  const workbenchT = ctx.locale.bind(WORKBENCH_NS)
  const panels = createSnapshotStore<readonly SidebarPanelMetadata[]>([])
  const syncPanels = (): void => {
    const next = ctx.slots.entriesOfSlot('sidebar.panellist').map(({ options }) => {
      // The list registration requires an id; StoredEntry erases the slot kind.
      const id = options.id as MainPanelId
      return { id, order: options.order ?? 0, label: resolveSlotLabel(options.label) ?? id }
    }).sort((a, b) => a.order - b.order)
    const previous = panels.getSnapshot()
    if (previous.length === next.length && previous.every((panel, index) => {
      const candidate = next[index] as SidebarPanelMetadata
      return panel.id === candidate.id && panel.order === candidate.order && panel.label === candidate.label
    })) return
    panels.set(next)
  }
  ctx.effect(() => ctx.slots.subscribe('sidebar.panellist', syncPanels), 'ui-sidebar: panel entries')
  ctx.effect(() => ctx.locale.subscribe(syncPanels), 'ui-sidebar: panel labels')

  const injectProps = (): SidebarRootInjected => ({
    // The shell's New Session button rides the Workspace UI's shared action
    // (current Session Workspace, then recent Workspace).
    startSession: (workspaceId) => { workspaceNavigation.startSession(workspaceId) },
    toggleSidebar: () => { ctx.layout.toggleSidebar() },
    selectPanel: (id) => { ctx.layout.selectPanel(id) },
    hooks: { panels },
  })
  ctx.slots.inject('sidebar', () => ctx.slots.register({
    name: 'sidebar',
    locale: NS,
    children: {
      'sidebar.brand.mark': { kind: 'single', scope: 'root' },
      'sidebar.brand.name': { kind: 'single', scope: 'root' },
      'sidebar.panellist': { kind: 'list', scope: 'root' },
      'sidebar.workspaces': { kind: 'single', scope: 'root' },
      'sidebar.settings': { kind: 'single', scope: 'root' },
      'sidebar.footer.action': { kind: 'list', scope: 'root' },
    },
    inject: injectProps,
  }, SidebarRoot))
  // Workbench seat: the sidebar foot's additive action list, above Settings.
  // The label thunk resolves per read, so the entry follows the active locale.
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'workbench',
    order: 10,
    label: () => workbenchT('trigger'),
    inject: () => ({ wt: workbenchT }),
  }, WorkbenchTrigger))
  syncPanels()
}
