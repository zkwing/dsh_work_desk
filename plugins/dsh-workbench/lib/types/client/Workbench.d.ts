import type { InjectFace, PropsRuntime, SnapshotSelectorHook, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import { type AddOutcome, type CapabilitySource, type FileOpenOutcome, type PickerListing, type TreeLevel, type ValueSource, type WorkspaceCardModel, type WorkspacesSnapshot } from './workspaces.ts';
/** The `workbench` namespace's translate function, bound by the plugin's apply. */
export type WorkbenchTranslate = TranslateNS<'workbench'>;
/** One directory level's outcome: the level model, ready or failed. */
export type DirectoryLevelResult = {
    ok: boolean;
    value: TreeLevel;
};
/** One picker level's outcome, as the browse primitive answers it. */
export type BrowseOutcome = {
    readonly ok: true;
    readonly value: PickerListing;
} | {
    readonly ok: false;
    readonly message: string;
};
/** One folder creation's outcome, as the browse primitive answers it. */
export type MakeOutcome = {
    readonly ok: true;
    readonly path: string;
} | {
    readonly ok: false;
    readonly message: string;
};
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
    wt: WorkbenchTranslate;
    /**
     * Live sources, which the framework binds into selector hooks.
     *
     * `capability` (→ `useCapability`) says what this composition mounts;
     * `scheme` (→ `useScheme`) says whether the host palette is dark, which is
     * what picks the background grid's color. Both are sources rather than values
     * because an entry's inject face is built once and cached.
     */
    hooks: {
        capability: CapabilitySource;
        scheme: ValueSource<boolean>;
    };
    /**
     * Try the Host's OS chooser. A `browse` outcome means this composition serves
     * the in-app picker instead — a fork in the flow, not a failure.
     */
    pickWorkspace: () => Promise<AddOutcome>;
    /** Register one absolute directory as a Workspace (the single adoption step). */
    registerWorkspace: (path: string) => Promise<AddOutcome>;
    /** List one directory level for the in-app picker; an absent path lists Home. */
    browseDirectory: (path: string | undefined, signal: AbortSignal) => Promise<BrowseOutcome>;
    /** Create one child directory for the in-app picker. */
    makeDirectory: (path: string, name: string) => Promise<MakeOutcome>;
    /**
     * Show one file in the right column through `ctx.sidebarRight` — the same
     * route the official file tree takes. Reports rather than throws when this
     * composition mounts no viewer for the address.
     */
    openFile: (sessionId: string, path: string) => FileOpenOutcome;
    /** Make one Session current. */
    selectSession: (sessionId: string) => boolean;
    /**
     * Select the Conversation as the center column's panel.
     *
     * The right column — and with it any file view — only exists while the
     * Conversation is selected, so opening a file from this global panel always
     * hands the column over.
     */
    showConversation: () => boolean;
    /** Open a Workspace's Conversation in the center column. */
    openWorkspace: (workspaceId: string) => Promise<void>;
    /** Start a New Session inside a Workspace. */
    startSession: (workspaceId: string) => void;
    /** Drop a Workspace registration. */
    removeWorkspace: (workspaceId: string) => void;
    /** List one directory level, resolving the Remote namespace per call. */
    listDirectory: (sessionId: string, path: string, signal: AbortSignal) => Promise<DirectoryLevelResult>;
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
export type WorkbenchPanelProps = PropsRuntime<'main'> & InjectFace<WorkbenchInjected>;
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
        useWorkspaces: SnapshotSelectorHook<WorkspacesSnapshot>;
    }
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
export declare function workspaceItems(snapshot: WorkspacesSnapshot | undefined): readonly WorkspaceCardModel[];
/**
 * Render the control room as the `workbench` main panel.
 * @param props - the `main` runtime share (carrying `useWorkspaces`) plus this plugin's face.
 * @returns the panel element.
 */
export declare function WorkbenchPanel({ wt: t, pickWorkspace, registerWorkspace, browseDirectory, makeDirectory, openFile, selectSession, showConversation, openWorkspace, removeWorkspace, listDirectory, useWorkspaces, useCapability, useScheme, }: WorkbenchPanelProps): import("react").JSX.Element;
/**
 * The sidebar panel-list glyph: one gauge, no interaction of its own.
 * @param props - the panel row's presentation share.
 * @returns the glyph.
 */
export declare function WorkbenchPanelIcon({ size }: PropsRuntime<'sidebar.panellist'>): import("react").JSX.Element;
//# sourceMappingURL=Workbench.d.ts.map