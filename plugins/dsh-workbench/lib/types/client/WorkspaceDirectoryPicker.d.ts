import type { ReactNode } from 'react';
import type { BrowseOutcome, MakeOutcome, WorkbenchTranslate } from './Workbench.tsx';
/** Props the panel supplies: the browse face, the copy, and the flow's outcomes. */
export interface DirectoryPickerProps {
    /** Whether the dialog is up. */
    open: boolean;
    /** The bound `workbench` translate. */
    t: WorkbenchTranslate;
    /** List one level; absent path asks for the host account's home directory. */
    browseDirectory: (path: string | undefined, signal: AbortSignal) => Promise<BrowseOutcome>;
    /** Create one child directory under the listed level. */
    makeDirectory: (path: string, name: string) => Promise<MakeOutcome>;
    /** The operator confirmed a directory. */
    onPicked: (path: string) => void;
    /** The operator dismissed the dialog. */
    onCancel: () => void;
}
/**
 * Render the picker dialog.
 * @param props - the browse face, the copy, and the flow's outcomes.
 * @returns the modal element.
 */
export declare function WorkspaceDirectoryPicker({ open, t, browseDirectory, makeDirectory, onPicked, onCancel, }: DirectoryPickerProps): ReactNode;
//# sourceMappingURL=WorkspaceDirectoryPicker.d.ts.map