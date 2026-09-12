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
import type { WorkbenchKey } from './locales.js';
/** Accent palette keys the stylesheet maps to gradients. */
export type CardAccent = 'azure' | 'violet' | 'amber' | 'emerald' | 'rose' | 'slate';
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
    readonly workspaceId: string;
    /** Canonical host directory path. */
    readonly path: string;
    /** User-visible title. */
    readonly title: string;
    /** Sessions accounted to this Workspace, in manual order. */
    readonly sessionIds: readonly string[];
    /** ISO-8601 creation instant. */
    readonly createdAt: string;
    /** ISO-8601 last-mutation instant. */
    readonly updatedAt: string;
}
/** The Workspace Controller snapshot as a card grid reads it. */
export interface WorkspacesSnapshot {
    /** Host-authoritative Workspace rows in display order. */
    readonly items: readonly WorkspaceCardModel[];
    /** Sessions hidden from every Workspace grouping surface. */
    readonly archivedSessionIds: readonly string[];
}
/** Accent keys, cycled by a Workspace's stable position in the Host order. */
export declare const CARD_ACCENTS: readonly CardAccent[];
/**
 * Pick a card accent from the Workspace's index in the Host order. Position
 * rather than identity: the same Workspace keeps its colour while the order is
 * stable, and the palette never repeats two adjacent cards.
 * @param index - zero-based position in the Workspace order.
 * @returns the accent key for that card.
 */
export declare function accentFor(index: number): CardAccent;
/** One entry of a directory level, as the tree renders it. */
export interface TreeEntry {
    /** Basename inside the listed directory. */
    readonly name: string;
    /** What the child resolves to; a symlink reports its destination type. */
    readonly type: 'file' | 'directory' | 'other';
    /** Byte size, present only for a regular file whose backend reports it. */
    readonly size?: number;
}
/** One directory level's state inside a card's tree face. */
export interface TreeLevel {
    /** Lifecycle of this level's listing. */
    readonly status: 'loading' | 'ready' | 'error';
    /** Entries in the backend's stable name order; empty unless ready. */
    readonly entries: readonly TreeEntry[];
    /** Whether the entry cap dropped children from {@link entries}. */
    readonly truncated: boolean;
    /** Human-readable failure, when {@link status} is 'error'. */
    readonly error?: string;
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
    readonly navigation: boolean;
    /** `ctx.workspaces`: the Workspace registry (create/delete). */
    readonly workspaces: boolean;
    /** `remote.workspaceFiles`: directory listings. */
    readonly files: boolean;
    /** `remote.directoryPicker`: the Host's directory-picking namespace. */
    readonly picker: boolean;
    /** `ctx.sidebarRight`: the right column that shows opened files. */
    readonly pane: boolean;
}
/** A live value a Slot component subscribes to; structurally the framework's source. */
export interface CapabilitySource {
    /** Read the cached snapshot reference (stable between notifications). */
    getSnapshot(): Capabilities;
    /**
     * Subscribe to snapshot invalidation.
     * @param listener - invalidation callback.
     * @returns unsubscribe function.
     */
    subscribe(listener: () => void): () => void;
}
/** Nothing mounted yet: the panel's state before the late services arrive. */
export declare const NO_CAPABILITIES: Capabilities;
/** The capability source plus its one writer, owned by the plugin's apply. */
export interface CapabilityStore extends CapabilitySource {
    /**
     * Merge one patch and notify listeners when the snapshot actually changed.
     * @param patch - the flags whose service just mounted or unmounted.
     */
    set(patch: Partial<Capabilities>): void;
}
/**
 * Create the panel's capability source. It is a plain observable rather than a
 * React state so the registrant can hand it to the slot as a `hooks` source:
 * the framework binds it to a `useCapability` selector hook, and a flag that
 * flips later re-renders the panel without re-registering anything.
 * @returns the source and its writer.
 */
export declare function createCapabilityStore(): CapabilityStore;
/** Deepest nesting {@link explorerRows} walks, so a symlink loop cannot outrun it. */
export declare const MAX_EXPLORER_DEPTH = 32;
/** Why a level has no entries to show. */
export type ExplorerNote = 'loading' | 'empty' | 'truncated' | 'failed';
/**
 * One rendered explorer row.
 *
 * The explorer is a VS Code-shaped flat list: `entry` rows carry their own
 * depth, so indentation and the indent guides are row facts rather than nested
 * markup, and `note` rows stand in for a level that is loading, empty,
 * truncated, or failed.
 */
export type ExplorerRow = {
    readonly kind: 'entry';
    readonly path: string;
    readonly name: string;
    readonly type: TreeEntry['type'];
    readonly depth: number;
    readonly size?: number | undefined;
    readonly expanded: boolean;
} | {
    readonly kind: 'note';
    readonly path: string;
    readonly depth: number;
    readonly note: ExplorerNote;
    readonly error?: string | undefined;
};
/**
 * Order one level for display: directories first, then everything else, each
 * group by name. The endpoint's order is a listing fact; this is the reader's.
 * @param entries - the listing as the endpoint returned it.
 * @returns a new array, directories first, then by name within each group.
 */
export declare function orderEntries(entries: readonly TreeEntry[]): TreeEntry[];
/**
 * Split a path into the directory part (trailing separator kept) and the last
 * segment, for the explorer's header row. Accepts either separator, because the
 * path comes from the Host and may be a Windows one.
 * @param path - the workspace root.
 * @returns the directory prefix and the name.
 */
export declare function splitPath(path: string): {
    directory: string;
    name: string;
};
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
export declare function explorerRows(root: string, levels: ReadonlyMap<string, TreeLevel>, expanded: ReadonlySet<string>): ExplorerRow[];
/**
 * Join a parent path with a child name using `/`, whatever separators the parent
 * carries. The Host resolves mixed separators, and the tree only needs a stable
 * key, so no platform branch is needed here.
 * @param parent - the listed directory's path.
 * @param name - the child's basename.
 * @returns the child's path.
 */
export declare function childPath(parent: string, name: string): string;
/** Compact byte size for a tree row. */
export declare function sizeText(bytes: number | undefined): string;
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
export declare function failureText(t: (key: WorkbenchKey) => string, error: {
    code: string;
    message: string;
}): string;
/**
 * One directory row of the in-app picker: a listing child or a breadcrumb
 * ancestor, carrying the absolute path the Host resolved (clients never join
 * path segments themselves).
 */
export interface PickerEntry {
    /** Base name shown in the row; empty on the synthetic Home crumb. */
    readonly name: string;
    /** Absolute host path. */
    readonly path: string;
    /** Hidden by the host platform's convention; the reader decides whether to show it. */
    readonly hidden: boolean;
}
/** One browsable level plus its ancestry, as the picker's browse backend reports it. */
export interface PickerListing {
    /** Absolute path of the listed directory. */
    readonly path: string;
    /** The host account's home directory. */
    readonly home: string;
    /** Ancestor chain from the filesystem root to the listed directory inclusive. */
    readonly crumbs: readonly PickerEntry[];
    /** Direct child directories. */
    readonly entries: readonly PickerEntry[];
    /** True when the backend cut the entries at its complete-result bound. */
    readonly truncated: boolean;
}
/**
 * One `directoryPicker.pick` answer, structurally: the Remote's own result
 * shape. `undefined` stands for a composition with no pick namespace at all.
 */
export type PickReply = {
    readonly ok: true;
    readonly value: string | null;
} | {
    readonly ok: false;
    readonly error: {
        readonly code: string;
        readonly message: string;
    };
};
/** What the add flow does after one pick attempt. */
export type PickStep = {
    readonly step: 'picked';
    readonly path: string;
} | {
    readonly step: 'cancelled';
} | {
    readonly step: 'browse';
} | {
    readonly step: 'failed';
    readonly message: string;
};
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
export declare function pickStep(reply: PickReply | undefined): PickStep;
/** What adding a Workspace reported back to the panel. */
export type AddOutcome = {
    readonly kind: 'created';
    readonly path: string;
} | {
    readonly kind: 'cancelled';
} | {
    readonly kind: 'browse';
} | {
    readonly kind: 'failed';
    readonly message: string;
};
/** One breadcrumb: a jump target, flagged when it is the Home root. */
export interface PickerCrumb {
    /** Absolute host path this crumb jumps to. */
    readonly path: string;
    /** Segment name; empty when the crumb is the synthetic Home root. */
    readonly name: string;
    /** True for the crumb that stands for the host account's home directory. */
    readonly home: boolean;
}
/**
 * The breadcrumb chain for one listing: the Host's own chain, with Home marked
 * where it appears, and prepended as a jump target when the listed directory is
 * not under Home at all.
 * @param listing - the level being shown.
 * @returns the crumbs, filesystem root first.
 */
export declare function pickerCrumbs(listing: PickerListing): PickerCrumb[];
/**
 * The rows one picker level shows: hidden directories filtered unless asked
 * for, in natural case-insensitive name order.
 * @param listing - the level being shown.
 * @param showHidden - whether the reader asked for hidden directories.
 * @returns the rows, in display order.
 */
export declare function pickerEntries(listing: PickerListing, showHidden: boolean): PickerEntry[];
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
export declare function fileAddress(sessionId: string, path: string): string;
/** What opening one file in the right column reported back to the panel. */
export type FileOpenOutcome = {
    readonly ok: true;
} | {
    readonly ok: false;
    readonly message: string;
    /**
     * A stable classification for the one failure the caller can repair.
     *
     * `pane/no-session` is `ui-sidebar-right` refusing while no session surface
     * is mounted: the right column is session content, so a global panel has to
     * put a session on screen before it can hold a file. Every other failure is
     * the Host's or the registry's own line, reported as it came.
     */
    readonly code?: 'pane/no-session';
};
/**
 * The parent of one path, or undefined when it already is a root.
 * @param path - an absolute path, with either separator.
 * @returns the parent path, separator included.
 */
export declare function parentPathOf(path: string): string | undefined;
//# sourceMappingURL=workspaces.d.ts.map