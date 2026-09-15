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

export const zh = {
  'trigger': '工作台',
  'title': '工作台',
  'subtitle': '为每个工作区提供可编辑的文件视图',
  'placeholder.main': '请打开侧栏中的「工作台」进入文件视图。',
  'placeholder.bench': '该页面将在工作区被打开后显示其文件树。',
  'bench.todo.title': 'TODO',
  'bench.todo.explorer': '左侧：文件树（工作区打开后渲染）',
  'bench.todo.editor': '右侧：多标签 / 多窗格编辑器（双击文件进入）',
  'bench.open': '在右栏打开工作台',
  'empty.title': '没有工作区',
  'empty.hint': '请先用 DSH 侧栏添加一个工作区目录，再回到这里。',
  'error.title': '打开工作台失败',
  'error.dismiss': '关闭',
  'foot.hint': '双击文件进入编辑器；Ctrl+S 保存；Ctrl+W 关闭；Ctrl+Tab 切换',
} satisfies Record<string, string>

/** Key union derived from the source-of-truth Chinese dictionary. */
export type WorkbenchKey = keyof typeof zh

/** English copy, checked complete against {@link WorkbenchKey}. */
export const en: Record<WorkbenchKey, string> = {
  'trigger': 'Coding Bench',
  'title': 'Coding Bench',
  'subtitle': 'A per-workspace editable file view',
  'placeholder.main': 'Open the Coding Bench in the right column to start.',
  'placeholder.bench': 'Pick a workspace — the file tree will appear here.',
  'bench.todo.title': 'TODO',
  'bench.todo.explorer': 'Left: file tree (renders once a workspace is opened)',
  'bench.todo.editor': 'Right: multi-tab / multi-pane editor (double-click a file to enter)',
  'bench.open': 'Open in the right column',
  'empty.title': 'No workspaces yet',
  'empty.hint': 'Add a workspace directory through the DSH sidebar first, then come back.',
  'error.title': 'Could not open the Coding Bench',
  'error.dismiss': 'Dismiss',
  'foot.hint': 'Double-click a file to edit; Ctrl+S save; Ctrl+W close; Ctrl+Tab switch',
}
