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
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { type WorkbenchKey } from './locales.js';
export type { WorkbenchInjected, WorkbenchPanelProps, WorkbenchTranslate } from './Workbench.js';
export { WorkbenchPanel, WorkbenchPanelIcon, workspaceItems } from './Workbench.js';
export { EDITOR_ID, EDITOR_KIND, FileEditorBody, FileEditorTitle, editorDefinition, } from './WorkbenchFileEditor.js';
export type { EditorInjected, EditorReadOutcome, EditorWriteOutcome, FileEditorBodyProps, FileEditorTitleProps, } from './WorkbenchFileEditor.js';
export { CARD_ACCENTS, MAX_EXPLORER_DEPTH, NO_CAPABILITIES, accentFor, childPath, createCapabilityStore, explorerRows, failureText, fileAddress, orderEntries, parentPathOf, pickStep, pickerCrumbs, pickerEntries, sizeText, splitPath, } from './workspaces.js';
export type { AddOutcome, Capabilities, CapabilitySource, CapabilityStore, CardAccent, ExplorerNote, ExplorerRow, FileOpenOutcome, PickReply, PickStep, PickerCrumb, PickerEntry, PickerListing, TreeEntry, TreeLevel, } from './workspaces.js';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The workbench control room and Workspace-card copy. */
        workbench: WorkbenchKey;
    }
}
/**
 * Required services.
 *
 * Deliberately minimal: the slot registry and the locale service are the only
 * ones the workbench cannot exist without.
 */
export declare const inject: string[];
/**
 * Register the workbench's dictionaries, its sidebar panel row, and its main
 * panel body.
 * @param ctx - the client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map