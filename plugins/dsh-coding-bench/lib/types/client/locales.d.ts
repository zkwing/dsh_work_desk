/**
 * `coding-bench` namespace dictionaries: the IDE the user opens in the right
 * column once they pick a workspace.
 *
 * The Chinese dictionary is the source of truth; `WorkbenchKey` is derived
 * from it, and the English dictionary is checked complete against that key
 * set via `satisfies Record<WorkbenchKey, string>`. Adding a new key in the
 * zh object surfaces a compile error in en until it gets a translation, so
 * the two never drift apart.
 */
export declare const zh: {
    trigger: string;
    title: string;
    subtitle: string;
    'placeholder.main': string;
    'placeholder.bench': string;
    'bench.todo.title': string;
    'bench.todo.explorer': string;
    'bench.todo.editor': string;
    'bench.open': string;
    'empty.title': string;
    'empty.hint': string;
    'error.title': string;
    'error.dismiss': string;
    'foot.hint': string;
};
/** Key union derived from the source-of-truth Chinese dictionary. */
export type WorkbenchKey = keyof typeof zh;
/** English copy, checked complete against {@link WorkbenchKey}. */
export declare const en: Record<WorkbenchKey, string>;
//# sourceMappingURL=locales.d.ts.map