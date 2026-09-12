import type { ReactNode } from 'react';
import type { InjectFace, PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { SidebarRightTabDefinition } from '@deepseek-ai/dsh-client-ui-sidebar-right/client';
import type { FileOpenOutcome } from './workspaces.js';
/** The page kind this tab type owns; `openTab` names it. */
export declare const EDITOR_KIND = "workbench-editor";
/** This implementation's identity in the tab system, and the key its body registers under. */
export declare const EDITOR_ID = "dsh-workbench/editor";
/** The `workbench` namespace's translate function, bound by the plugin's apply. */
type WorkbenchTranslate = TranslateNS<'workbench'>;
declare module '@deepseek-ai/dsh-client-ui-sidebar-right/client' {
    interface SidebarRightTabParamsMap {
        /** What the workbench editor is opened with: which file, in which Session. */
        'workbench-editor': {
            readonly sessionId: string;
            readonly path: string;
        };
    }
}
/** One file load's outcome, as the Host route answers it. */
export type EditorReadOutcome = {
    readonly ok: true;
    readonly text: string;
    readonly version: string;
    readonly size: number;
} | {
    readonly ok: false;
    readonly code: string;
    readonly message: string;
};
/** One save's outcome, as the Host route answers it. */
export type EditorWriteOutcome = {
    readonly ok: true;
    readonly version: string;
} | {
    readonly ok: false;
    readonly code: string;
    readonly message: string;
};
/** What the editor's registration injects. */
export interface EditorInjected {
    /** The `workbench` namespace's translate function. */
    wt: WorkbenchTranslate;
    /** Load one file's text and version through the Host route. */
    readFile: (sessionId: string, path: string) => Promise<EditorReadOutcome>;
    /** Replace one file's text, guarded by the version the reader loaded. */
    writeFile: (sessionId: string, path: string, text: string, version: string) => Promise<EditorWriteOutcome>;
    /** Hand the address to the official viewer instead (Markdown, PDF, images). */
    openPreview: (sessionId: string, path: string) => FileOpenOutcome;
}
/** The editor body's props: the tab's runtime share plus this plugin's face. */
export type FileEditorBodyProps = PropsRuntime<'sidebar.right.pane.tab'> & InjectFace<EditorInjected>;
/** The editor title's props: the same runtime share, without the file work. */
export type FileEditorTitleProps = PropsRuntime<'sidebar.right.pane.tab.title'> & InjectFace<EditorInjected>;
/** The tab type's registry definition: a page, opened by kind. */
export declare function editorDefinition(t: WorkbenchTranslate): SidebarRightTabDefinition;
/**
 * Render the editor tab's body.
 * @param props - the tab runtime share and this plugin's injected face.
 * @returns the editor element.
 */
export declare function FileEditorBody({ useTabInfo, wt: t, readFile, writeFile, openPreview }: FileEditorBodyProps): ReactNode;
/**
 * Render the editor tab's chip title: the file's name.
 * @param props - the tab runtime share and this plugin's injected face.
 * @returns the title element.
 */
export declare function FileEditorTitle({ useTabInfo, wt: t }: FileEditorTitleProps): ReactNode;
export {};
//# sourceMappingURL=WorkbenchFileEditor.d.ts.map