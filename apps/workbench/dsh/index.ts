/**
 * Workbench public surface: the sidebar-foot trigger component and its
 * `sidebar` locale keys. The sidebar plugin imports the trigger into its own
 * client half, so the workbench contributes no loader row, no module-table
 * entry, and no new bundle of its own.
 */
export { WorkbenchTrigger, type WorkbenchTriggerProps } from './Workbench.tsx'
export { en, zh, type WorkbenchKey } from './locales.ts'
export {
  ACCENTS, STATUSES, WORKBENCH_STATE_VERSION, STORAGE_KEY,
  createProject, loadState, progressOf, saveState, summarize,
  type ControlRoomReading, type WorkbenchAccent, type WorkbenchProject, type WorkbenchProjectStatus,
  type WorkbenchState,
} from './state.ts'
