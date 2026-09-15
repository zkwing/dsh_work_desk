window.__ModuleLoader__.load({
	id: "dsh-coding-bench",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region dsh-coding-bench/lib/types/client/panel.js
		/** Main-column body: a quiet landing page that points at the right column. */
		function MainSlotBody(props) {
			const t = props.wt;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "cb-main",
				role: "region",
				"aria-label": t("title"),
				children: [
					(0, react_jsx_runtime.jsx)("h1", {
						className: "cb-main__title",
						children: t("title")
					}),
					(0, react_jsx_runtime.jsx)("p", {
						className: "cb-main__subtitle",
						children: t("subtitle")
					}),
					(0, react_jsx_runtime.jsx)("p", {
						className: "cb-main__placeholder",
						children: t("placeholder.main")
					})
				]
			});
		}
		/** Right-column body: a TODO placeholder for the upcoming explorer + editor
		*  area. The two-column layout it describes (left = file tree, right = editor)
		*  is what the next milestones will fill in. */
		function BenchPageBody(props) {
			const t = props.wt;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "cb-page",
				role: "region",
				"aria-label": t("title"),
				children: [
					(0, react_jsx_runtime.jsx)("div", {
						className: "cb-page__explorer",
						children: (0, react_jsx_runtime.jsx)("strong", { children: t("bench.todo.explorer") })
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: "cb-page__editor",
						children: [(0, react_jsx_runtime.jsx)("strong", { children: t("bench.todo.editor") }), (0, react_jsx_runtime.jsx)("p", { children: t("placeholder.bench") })]
					}),
					(0, react_jsx_runtime.jsx)("footer", {
						className: "cb-page__foot",
						children: (0, react_jsx_runtime.jsx)("span", { children: t("foot.hint") })
					})
				]
			});
		}
		/** The right-column page chip. The chip is the title text rendered in the
		*  tab strip while the page is open; M6 replaces it with a real per-file tab. */
		function BenchPageChip(props) {
			return (0, react_jsx_runtime.jsx)("span", {
				className: "cb-chip",
				children: props.wt("title")
			});
		}
		/** The sidebar panel-list glyph: a one-line identifier. The icon is rendered
		*  by the slot system from any SVG string the implementation returns; this is
		*  the small "code" prompt glyph for now, swapped for a proper icon when the
		*  visual pass lands. */
		function CodingBenchPanelIcon() {
			return (0, react_jsx_runtime.jsx)("span", {
				"aria-hidden": "true",
				className: "cb-icon",
				children: "</>"
			});
		}
		//#endregion
		//#region dsh-coding-bench/lib/types/client/locales.js
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
		const zh = {
			"trigger": "工作台",
			"title": "工作台",
			"subtitle": "为每个工作区提供可编辑的文件视图",
			"placeholder.main": "请打开侧栏中的「工作台」进入文件视图。",
			"placeholder.bench": "该页面将在工作区被打开后显示其文件树。",
			"bench.todo.title": "TODO",
			"bench.todo.explorer": "左侧：文件树（工作区打开后渲染）",
			"bench.todo.editor": "右侧：多标签 / 多窗格编辑器（双击文件进入）",
			"bench.open": "在右栏打开工作台",
			"empty.title": "没有工作区",
			"empty.hint": "请先用 DSH 侧栏添加一个工作区目录，再回到这里。",
			"error.title": "打开工作台失败",
			"error.dismiss": "关闭",
			"foot.hint": "双击文件进入编辑器；Ctrl+S 保存；Ctrl+W 关闭；Ctrl+Tab 切换"
		};
		/** English copy, checked complete against {@link WorkbenchKey}. */
		const en = {
			"trigger": "Coding Bench",
			"title": "Coding Bench",
			"subtitle": "A per-workspace editable file view",
			"placeholder.main": "Open the Coding Bench in the right column to start.",
			"placeholder.bench": "Pick a workspace — the file tree will appear here.",
			"bench.todo.title": "TODO",
			"bench.todo.explorer": "Left: file tree (renders once a workspace is opened)",
			"bench.todo.editor": "Right: multi-tab / multi-pane editor (double-click a file to enter)",
			"bench.open": "Open in the right column",
			"empty.title": "No workspaces yet",
			"empty.hint": "Add a workspace directory through the DSH sidebar first, then come back.",
			"error.title": "Could not open the Coding Bench",
			"error.dismiss": "Dismiss",
			"foot.hint": "Double-click a file to edit; Ctrl+S save; Ctrl+W close; Ctrl+Tab switch"
		};
		//#endregion
		//#region dsh-coding-bench/lib/types/client/index.js
		/** The plugin's dictionary namespace. The host reads it through the locale
		*  service and re-renders every bound translate when the language changes. */
		const NS = "coding-bench";
		/** The `main` slot key, the `sidebar.panellist` row id and the
		*  `sidebarRightTabs` kind all share this string, so the three registrations
		*  refer to the same plugin surface. */
		const PANEL_ID = "coding-bench";
		/** The right-column page kind. `ctx.sidebarRight.openTab(KIND, params)` opens
		*  this page; the body and title are bound to the same id by their `key`. */
		const RIGHT_PAGE_KIND = "coding-bench";
		/** Services the `apply` body actually needs right now. Each one is checked
		*  per call inside the inject face factory, so a composition that mounts the
		*  plugin before these services are available will still register the
		*  dictionary and the slots; the pages and the body that depend on them
		*  come up empty in the meantime. */
		const inject = [
			"slots",
			"locale",
			"sidebarRightTabs"
		];
		/** Bind the plugin's locales and register every slot/page that contributes
		*  to the host surface. The function closes over `ctx` (the host's client
		*  context) and the bound translate, so every registration can rebind both
		*  without going through a module-level mutable. */
		function apply(ctx) {
			const t = ctx.locale.bind(NS);
			const injected = () => ({ wt: t });
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-coding-bench: dictionary");
			ctx.slots.inject("main", () => ctx.slots.register({
				name: "main",
				key: PANEL_ID,
				inject: injected
			}, MainSlotBody));
			ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
				name: "sidebar.panellist",
				id: PANEL_ID,
				order: 20,
				label: () => t("trigger")
			}, CodingBenchPanelIcon));
			ctx.inject(["sidebarRightTabs"], (scope) => {
				scope.effect(() => {
					scope.sidebarRightTabs.register({
						id: PANEL_ID,
						kind: RIGHT_PAGE_KIND,
						priority: "extension",
						title: () => t("title")
					});
					return () => {};
				}, "dsh-coding-bench: right page description");
			});
			ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
				name: "sidebar.right.pane.tab",
				key: RIGHT_PAGE_KIND,
				locale: NS,
				inject: injected
			}, BenchPageBody));
			ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
				name: "sidebar.right.pane.tab.title",
				key: RIGHT_PAGE_KIND,
				inject: injected
			}, BenchPageChip));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map