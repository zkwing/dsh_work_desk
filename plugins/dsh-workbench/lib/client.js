window.__ModuleLoader__.load({
	id: "dsh-workbench",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		//#region dsh-workbench/lib/types/client/workspaces.js
		/** Accent keys, cycled by a Workspace's stable position in the Host order. */
		const CARD_ACCENTS = [
			"azure",
			"violet",
			"amber",
			"emerald",
			"rose",
			"slate"
		];
		/**
		* Pick a card accent from the Workspace's index in the Host order. Position
		* rather than identity: the same Workspace keeps its colour while the order is
		* stable, and the palette never repeats two adjacent cards.
		* @param index - zero-based position in the Workspace order.
		* @returns the accent key for that card.
		*/
		function accentFor(index) {
			return CARD_ACCENTS[index % CARD_ACCENTS.length] ?? "azure";
		}
		/** Nothing mounted yet: the panel's state before the late services arrive. */
		const NO_CAPABILITIES = {
			navigation: false,
			workspaces: false,
			files: false,
			picker: false,
			pane: false
		};
		/**
		* Create a minimal observable value for a registration's `hooks` compartment.
		*
		* The slot framework binds such a source into a selector hook, which is how a
		* value the plugin cannot re-register for — the color scheme, say — still
		* re-renders the panel.
		* @param initial - the first value.
		* @returns the source and its writer.
		*/
		function createValueStore(initial) {
			let snapshot = initial;
			const listeners = /* @__PURE__ */ new Set();
			return {
				getSnapshot: () => snapshot,
				subscribe(listener) {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				set(value) {
					if (Object.is(value, snapshot)) return;
					snapshot = value;
					for (const listener of [...listeners]) listener();
				}
			};
		}
		/**
		* Create the panel's capability source. It is a plain observable rather than a
		* React state so the registrant can hand it to the slot as a `hooks` source:
		* the framework binds it to a `useCapability` selector hook, and a flag that
		* flips later re-renders the panel without re-registering anything.
		* @returns the source and its writer.
		*/
		function createCapabilityStore() {
			let snapshot = NO_CAPABILITIES;
			const listeners = /* @__PURE__ */ new Set();
			return {
				getSnapshot: () => snapshot,
				subscribe(listener) {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				set(patch) {
					const next = {
						...snapshot,
						...patch
					};
					if (!Object.keys(next).some((key) => next[key] !== snapshot[key])) return;
					snapshot = next;
					for (const listener of [...listeners]) listener();
				}
			};
		}
		/** Deepest nesting {@link explorerRows} walks, so a symlink loop cannot outrun it. */
		const MAX_EXPLORER_DEPTH = 32;
		/** Natural, case-insensitive name order, so `file2` precedes `file10`. */
		const byName = new Intl.Collator(void 0, {
			numeric: true,
			sensitivity: "base"
		});
		/**
		* Order one level for display: directories first, then everything else, each
		* group by name. The endpoint's order is a listing fact; this is the reader's.
		* @param entries - the listing as the endpoint returned it.
		* @returns a new array, directories first, then by name within each group.
		*/
		function orderEntries(entries) {
			return [...entries].sort((left, right) => {
				const group = Number(right.type === "directory") - Number(left.type === "directory");
				return group !== 0 ? group : byName.compare(left.name, right.name);
			});
		}
		/**
		* Split a path into the directory part (trailing separator kept) and the last
		* segment, for the explorer's header row. Accepts either separator, because the
		* path comes from the Host and may be a Windows one.
		* @param path - the workspace root.
		* @returns the directory prefix and the name.
		*/
		function splitPath(path) {
			const trimmed = path.replace(/[/\\]+$/, "");
			const cut = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
			if (cut < 0) return {
				directory: "",
				name: trimmed
			};
			return {
				directory: trimmed.slice(0, cut + 1),
				name: trimmed.slice(cut + 1)
			};
		}
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
		function explorerRows(root, levels, expanded) {
			const rows = [];
			const walk = (path, depth) => {
				if (depth > 32) return;
				const level = levels.get(path);
				if (level === void 0 || level.status === "loading") {
					rows.push({
						kind: "note",
						path,
						depth,
						note: "loading"
					});
					return;
				}
				if (level.status === "error") {
					rows.push({
						kind: "note",
						path,
						depth,
						note: "failed",
						error: level.error
					});
					return;
				}
				if (level.entries.length === 0) {
					rows.push({
						kind: "note",
						path,
						depth,
						note: "empty"
					});
					return;
				}
				for (const entry of orderEntries(level.entries)) {
					const child = childPath(path, entry.name);
					const open = entry.type === "directory" && expanded.has(child);
					rows.push({
						kind: "entry",
						path: child,
						name: entry.name,
						type: entry.type,
						depth,
						size: entry.size,
						expanded: open
					});
					if (open) walk(child, depth + 1);
				}
				if (level.truncated) rows.push({
					kind: "note",
					path,
					depth,
					note: "truncated"
				});
			};
			walk(root, 0);
			return rows;
		}
		/**
		* Join a parent path with a child name using `/`, whatever separators the parent
		* carries. The Host resolves mixed separators, and the tree only needs a stable
		* key, so no platform branch is needed here.
		* @param parent - the listed directory's path.
		* @param name - the child's basename.
		* @returns the child's path.
		*/
		function childPath(parent, name) {
			if (parent === "") return name;
			return `${parent.replace(/[/\\]+$/, "")}/${name}`;
		}
		/** Compact byte size for a tree row. */
		function sizeText(bytes) {
			if (bytes === void 0) return "";
			if (bytes < 1024) return `${bytes} B`;
			if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
			return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
		}
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
		function failureText(t, error) {
			switch (error.code) {
				case "workspace-file/outside-workspace": return t("tree.error.outside");
				case "workspace-file/not-found": return t("tree.error.notFound");
				case "workspace-file/not-directory": return t("tree.error.notDirectory");
				default: return error.message;
			}
		}
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
		function pickStep(reply) {
			if (reply === void 0) return { step: "browse" };
			if (reply.ok) return reply.value === null || reply.value === "" ? { step: "cancelled" } : {
				step: "picked",
				path: reply.value
			};
			if (reply.error.code === "directory-picker/unavailable") return { step: "browse" };
			return {
				step: "failed",
				message: reply.error.message
			};
		}
		/**
		* The breadcrumb chain for one listing: the Host's own chain, with Home marked
		* where it appears, and prepended as a jump target when the listed directory is
		* not under Home at all.
		* @param listing - the level being shown.
		* @returns the crumbs, filesystem root first.
		*/
		function pickerCrumbs(listing) {
			const chain = listing.crumbs.length > 0 ? listing.crumbs : [{
				name: listing.path,
				path: listing.path,
				hidden: false
			}];
			const crumbs = [];
			if (!chain.some((crumb) => crumb.path === listing.home)) crumbs.push({
				path: listing.home,
				name: "",
				home: true
			});
			for (const crumb of chain) crumbs.push({
				path: crumb.path,
				name: crumb.name,
				home: crumb.path === listing.home
			});
			return crumbs;
		}
		/**
		* The rows one picker level shows: hidden directories filtered unless asked
		* for, in natural case-insensitive name order.
		* @param listing - the level being shown.
		* @param showHidden - whether the reader asked for hidden directories.
		* @returns the rows, in display order.
		*/
		function pickerEntries(listing, showHidden) {
			return listing.entries.filter((entry) => showHidden || !entry.hidden).sort((left, right) => byName.compare(left.name, right.name));
		}
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
		function fileAddress(sessionId, path) {
			const encoded = path.replace(/\\/g, "/").replace(/^(?:\.\/)+/, "").split("/").map((segment) => encodeURIComponent(segment).replace(/%3A/gi, ":")).join("/");
			return `dsh-resource://file/session/${encodeURIComponent(sessionId)}/${encoded}`;
		}
		/**
		* The parent of one path, or undefined when it already is a root.
		* @param path - an absolute path, with either separator.
		* @returns the parent path, separator included.
		*/
		function parentPathOf(path) {
			const trimmed = path.replace(/[/\\]+$/, "");
			const cut = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
			if (cut < 0) return void 0;
			const parent = trimmed.slice(0, cut + 1);
			return parent === "" ? void 0 : parent;
		}
		//#endregion
		//#region \0dsh-css:D:\1_SoftWare\DeepSeek_Harness\deepseek-harness\packages\plugins\dsh-workbench\src\client\Workbench.module.css.mjs
		const css = ":root{--wb-bg:var(--dsw-alias-bg-base,#0a0d14);--wb-panel:var(--dsw-alias-bg-layer-1,#141822);--wb-panel-solid:var(--dsw-alias-bg-layer-1,#141822);--wb-raised:var(--dsw-alias-bg-layer-2,#ffffff0a);--wb-overlay:var(--dsw-alias-bg-overlay,#171b24);--wb-line:var(--dsw-alias-border-l1,#ffffff1a);--wb-line-strong:var(--dsw-alias-border-l2,#ffffff2e);--wb-text:var(--dsw-alias-label-primary,#e8ecf5);--wb-text-dim:var(--dsw-alias-label-secondary,#e8ecf59e);--wb-text-faint:color-mix(in srgb, var(--wb-text-dim) 62%, transparent);--wb-accent:var(--dsw-alias-brand-primary,#679efe);--wb-danger:var(--dsw-alias-state-error-primary,#e45c5c);--wb-warn:var(--dsw-alias-state-warn-primary,#e09e36);--wb-ok:var(--dsw-alias-state-success-primary,#4ed17e);--wb-glass-tint:var(--wb-text);--wb-glass-edge:color-mix(in srgb, var(--wb-text) 16%, transparent);--wb-glass-sheen:color-mix(in srgb, var(--wb-text) 10%, transparent);--wb-scrim:#00000024;--wb-scrim-strong:#00000061;--wb-shadow:#0000004d;--wb-grid-minor:color-mix(in srgb, var(--dsw-alias-label-primary,#fff) 5.5%, transparent);--wb-grid-major:color-mix(in srgb, var(--dsw-alias-label-primary,#fff) 11%, transparent);--wb-grid-cell:16px;--wb-grid-block:80px;--wb-radius-card:18px;--wb-radius-lg:14px;--wb-radius-md:12px;--wb-radius-sm:10px;--wb-radius-pill:999px;--wb-pad-row:16px;--wb-pad-card:16px;--wb-gap-tight:6px;--wb-gap-row:10px;--wb-rim-top:color-mix(in srgb, var(--wb-text) 26%, transparent);--wb-rim-bottom:color-mix(in srgb, var(--wb-text) 6%, transparent);--wb-ambient-halo:color-mix(in srgb, var(--wb-accent) 18%, transparent);--wb-focus-ring:color-mix(in srgb, var(--wb-accent) 60%, transparent);--wb-focus-inset:color-mix(in srgb, var(--wb-text) 60%, transparent);--wb-sheen-angle:0deg;--wb-ease:var(--ds-ease-in-out);--wb-card-base:color-mix(in srgb, var(--wb-panel) 38%, transparent);--wb-card-rim:color-mix(in srgb, var(--wb-text) 22%, transparent);--wb-card-shadow:0 10px 28px var(--wb-shadow)}@property --wb-sheen-angle{syntax:\"<angle>\";inherits:false;initial-value:0deg}@property --wb-ring-angle{syntax:\"<angle>\";inherits:false;initial-value:0deg}.y5tTyq_workbench{box-sizing:border-box;background:radial-gradient(120% 60% at 50% -10%, var(--wb-ambient-halo), transparent 70%), radial-gradient(140% 70% at 50% -8%, color-mix(in srgb, var(--wb-text) 6%, transparent), transparent 55%), var(--wb-bg);flex-direction:column;width:100%;height:100%;min-height:0;display:flex;position:relative;overflow:hidden}:root[data-wb-scheme=light]{--wb-bg:#fff;--wb-panel:#fff;--wb-panel-solid:#fff;--wb-overlay:#fff;--wb-line:#000;--wb-line-strong:#000;--wb-glass-edge:#000;--wb-glass-sheen:#000;--wb-glass-tint:#000;--wb-rim-top:#000;--wb-rim-bottom:#000;--wb-text:#000;--wb-text-dim:#666;--wb-text-faint:#999;--wb-accent:red;--wb-danger:red;--wb-warn:#000;--wb-ok:#0057b8;--wb-focus-ring:red;--wb-ambient-halo:#fff;--wb-shadow:transparent;--wb-scrim:transparent;--wb-scrim-strong:transparent;--wb-card-rim:transparent;--wb-card-shadow:0 0 0 transparent;--wb-card-base:#fff;--wb-radius-card:0;--wb-radius-lg:0;--wb-radius-md:0;--wb-radius-sm:0;--wb-radius-pill:0;--wb-grid-minor:#e8e8e8;--wb-grid-major:#ccc}.y5tTyq_workbench:before{content:\"\";pointer-events:none;background-image:linear-gradient(var(--wb-grid-minor) 1px, transparent 1px), linear-gradient(90deg, var(--wb-grid-minor) 1px, transparent 1px), linear-gradient(var(--wb-grid-major) 1px, transparent 1px), linear-gradient(90deg, var(--wb-grid-major) 1px, transparent 1px);background-size:var(--wb-grid-cell) var(--wb-grid-cell), var(--wb-grid-cell) var(--wb-grid-cell), var(--wb-grid-block) var(--wb-grid-block), var(--wb-grid-block) var(--wb-grid-block);position:absolute;inset:0;-webkit-mask-image:radial-gradient(130% 100% at 50% 0,#000 55%,#0000 100%);mask-image:radial-gradient(130% 100% at 50% 0,#000 55%,#0000 100%)}.y5tTyq_notice{border-bottom:1px solid var(--wb-line);background:linear-gradient(180deg, color-mix(in srgb, var(--wb-warn) 16%, transparent), color-mix(in srgb, var(--wb-warn) 10%, transparent));color:var(--wb-warn);letter-spacing:.005em;margin:0;padding:10px 22px;font-size:12px;position:relative}.y5tTyq_noticeError{border-bottom:1px solid color-mix(in srgb, var(--wb-danger) 32%, transparent);background:linear-gradient(180deg, color-mix(in srgb, var(--wb-danger) 16%, transparent), color-mix(in srgb, var(--wb-danger) 10%, transparent));color:var(--wb-danger);align-items:center;gap:10px;margin:0;padding:10px 14px 10px 22px;font-size:12px;display:flex;position:relative}.y5tTyq_noticeErrorText{flex:1;min-width:0}.y5tTyq_noticeClose{border:1px solid color-mix(in srgb, var(--wb-danger) 38%, transparent);width:22px;height:22px;color:inherit;font:inherit;cursor:pointer;transition:background .18s var(--wb-ease);background:0 0;border-radius:6px;flex:none;padding:0;font-size:11px;line-height:1}.y5tTyq_noticeClose:hover{background:color-mix(in srgb, var(--wb-glass-tint) 13%, transparent)}.y5tTyq_panelHead{border-bottom:1px solid var(--wb-line);background:linear-gradient(180deg, color-mix(in srgb, var(--wb-text) 4%, transparent) 0%, transparent 70%);justify-content:space-between;align-items:center;gap:16px;padding:16px 22px;display:flex;position:relative}.y5tTyq_headIdentity{align-items:center;gap:12px;min-width:0;display:flex}.y5tTyq_headGlyph{border:1px solid var(--wb-line-strong);border-radius:var(--wb-radius-md);background:linear-gradient(180deg, color-mix(in srgb, var(--wb-text) 14%, transparent) 0%, transparent 50%), linear-gradient(150deg, color-mix(in srgb, var(--wb-accent) 32%, transparent), color-mix(in srgb, var(--wb-accent) 4%, transparent));width:38px;height:38px;color:color-mix(in srgb, var(--wb-accent) 62%, var(--wb-text));box-shadow:inset 0 1px 0 color-mix(in srgb, var(--wb-text) 22%, transparent), 0 0 24px color-mix(in srgb, var(--wb-accent) 26%, transparent);flex:none;justify-content:center;align-items:center;display:inline-flex}.y5tTyq_headText{min-width:0}.y5tTyq_title{letter-spacing:-.005em;color:var(--wb-text);margin:0;font-size:15.5px;font-weight:600}.y5tTyq_subtitle{letter-spacing:.02em;color:color-mix(in srgb, var(--wb-text-dim) 78%, transparent);margin:3px 0 0;font-size:11.5px}.y5tTyq_headActions{flex:none;align-items:center;gap:8px;display:flex}.y5tTyq_live{box-sizing:border-box;border:1px solid color-mix(in srgb, var(--wb-ok) 34%, transparent);border-radius:var(--wb-radius-pill);background:color-mix(in srgb, var(--wb-ok) 12%, transparent);height:28px;color:var(--wb-ok);letter-spacing:.08em;text-transform:uppercase;box-shadow:inset 0 1px 0 color-mix(in srgb, var(--wb-text) 14%, transparent);align-items:center;gap:6px;padding:0 12px;font-size:11px;font-weight:600;display:inline-flex}.y5tTyq_liveDot{background:var(--wb-ok);width:6px;height:6px;box-shadow:0 0 10px color-mix(in srgb, var(--wb-ok) 70%, transparent);border-radius:50%;animation:2s ease-in-out infinite y5tTyq_wbPulse}.y5tTyq_action{box-sizing:border-box;border:1px solid var(--wb-line-strong);border-radius:var(--wb-radius-md);background:color-mix(in srgb, var(--wb-glass-tint) 5%, transparent);height:30px;color:var(--wb-text);font:inherit;letter-spacing:.01em;cursor:pointer;box-shadow:inset 0 1px 0 color-mix(in srgb, var(--wb-text) 14%, transparent);transition:background .18s var(--wb-ease), border-color .18s var(--wb-ease), color .18s var(--wb-ease), transform .18s var(--wb-ease);align-items:center;gap:6px;padding:0 12px;font-size:12px;font-weight:500;display:inline-flex}.y5tTyq_action:hover:not(:disabled){background:color-mix(in srgb, var(--wb-glass-tint) 10%, transparent);border-color:color-mix(in srgb, var(--wb-glass-tint) 22%, transparent);transform:translateY(-1px)}.y5tTyq_action:active:not(:disabled){background:color-mix(in srgb, var(--wb-glass-tint) 7%, transparent);transform:translateY(0)}.y5tTyq_action:focus-visible{outline:2px solid var(--wb-focus-ring);outline-offset:2px;box-shadow:inset 0 1px 0 color-mix(in srgb, var(--wb-text) 14%, transparent), 0 0 0 4px color-mix(in srgb, var(--wb-focus-ring) 30%, transparent)}.y5tTyq_iconOnly{box-sizing:border-box;border-radius:var(--wb-radius-md);width:30px;height:30px;color:var(--wb-text-dim);cursor:pointer;transition:background .18s var(--wb-ease), color .18s var(--wb-ease), border-color .18s var(--wb-ease), transform .18s var(--wb-ease);background:0 0;border:1px solid #0000;justify-content:center;align-items:center;padding:0;display:inline-flex}.y5tTyq_iconOnly:hover:not(:disabled){background:color-mix(in srgb, var(--wb-glass-tint) 9%, transparent);color:var(--wb-text);border-color:color-mix(in srgb, var(--wb-glass-tint) 14%, transparent)}.y5tTyq_iconOnly:focus-visible{outline:2px solid var(--wb-focus-ring);outline-offset:2px;box-shadow:0 0 0 4px color-mix(in srgb, var(--wb-focus-ring) 24%, transparent)}.y5tTyq_readings{border-bottom:1px solid var(--wb-line);background:linear-gradient(180deg, color-mix(in srgb, var(--wb-text) 3%, transparent) 0%, transparent 70%);grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:14px 22px;display:grid;position:relative}.y5tTyq_reading{border:1px solid var(--wb-line);border-top-color:var(--wb-rim-top);border-radius:var(--wb-radius-lg);background:linear-gradient(180deg, color-mix(in srgb, var(--wb-text) 7%, transparent) 0%, color-mix(in srgb, var(--wb-text) 1%, transparent) 100%);box-shadow:inset 0 1px 0 color-mix(in srgb, var(--wb-text) 12%, transparent), inset 0 -1px 0 var(--wb-rim-bottom);flex-direction:column;gap:4px;padding:12px 14px 11px;display:flex;position:relative}.y5tTyq_readingLabel{letter-spacing:.1em;text-transform:uppercase;color:color-mix(in srgb, var(--wb-text-dim) 78%, transparent);font-size:10.5px;font-weight:600}.y5tTyq_readingValue{letter-spacing:-.02em;color:var(--wb-text);font-variant-numeric:tabular-nums;font-size:22px;font-weight:600;line-height:1.1}.y5tTyq_readingHint{letter-spacing:.01em;color:color-mix(in srgb, var(--wb-text-dim) 80%, transparent);font-variant-numeric:tabular-nums;font-size:11px}.y5tTyq_projects{scrollbar-width:thin;scrollbar-color:color-mix(in srgb, var(--wb-glass-tint) 22%, transparent) transparent;flex:1;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;min-height:0;padding:20px 22px 26px;display:grid;position:relative;overflow-y:auto}.y5tTyq_projects::-webkit-scrollbar{width:8px}.y5tTyq_projects::-webkit-scrollbar-thumb{border-radius:var(--wb-radius-pill);background-clip:content-box;background-color:color-mix(in srgb, var(--wb-glass-tint) 22%, transparent);transition:background-color .18s var(--wb-ease);border:2px solid #0000}.y5tTyq_projects::-webkit-scrollbar-thumb:hover{background-color:color-mix(in srgb, var(--wb-glass-tint) 34%, transparent)}.y5tTyq_projects::-webkit-scrollbar-track{background:0 0}.y5tTyq_card{--card-accent:var(--wb-accent);border:1px solid var(--wb-glass-edge);border-top-color:var(--wb-rim-top);border-radius:var(--wb-radius-card);background:conic-gradient(from var(--wb-sheen-angle) at 50% 50%, transparent 0deg, color-mix(in srgb, var(--wb-text) 7%, transparent) 30deg, transparent 70deg, transparent 360deg), linear-gradient(158deg, color-mix(in srgb, var(--wb-glass-tint) 9%, transparent) 0%, color-mix(in srgb, var(--wb-glass-tint) 3%, transparent) 40%, color-mix(in srgb, var(--wb-glass-tint) 1%, transparent) 100%), linear-gradient(180deg, color-mix(in srgb, var(--card-accent) 6%, transparent), transparent 60%), var(--wb-card-base);-webkit-backdrop-filter:blur(22px)saturate(180%);box-shadow:inset 0 1px 0 var(--wb-card-rim), inset 0 -1px 0 var(--wb-rim-bottom), var(--wb-card-shadow);transition:transform .22s var(--wb-ease), border-color .22s var(--wb-ease), box-shadow .22s var(--wb-ease), --wb-sheen-angle 1.2s var(--wb-ease);flex-direction:column;gap:10px;padding:16px 16px 14px;display:flex;position:relative}.y5tTyq_card:after{content:\"\";z-index:-1;border-radius:calc(var(--wb-radius-card) + 2px);pointer-events:none;--wb-ring-angle:0deg;background:0 0;position:absolute;inset:-2px}.y5tTyq_card:before{content:\"\";z-index:1;background:linear-gradient(180deg, var(--card-accent), transparent 85%);width:3px;box-shadow:0 0 14px color-mix(in srgb, var(--card-accent) 70%, transparent);opacity:.9;position:absolute;inset:0 auto 0 0}.y5tTyq_card:hover{border-color:color-mix(in srgb, var(--wb-glass-tint) 26%, transparent);box-shadow:inset 0 1px 0 color-mix(in srgb, var(--wb-text) 30%, transparent), inset 0 -1px 0 var(--wb-rim-bottom), 0 20px 48px var(--wb-scrim-strong), 0 0 0 1px color-mix(in srgb, var(--card-accent) 18%, transparent), 0 0 28px color-mix(in srgb, var(--card-accent) 14%, transparent);transform:translateY(-3px)}.y5tTyq_card:focus-visible{box-shadow:inset 0 1px 0 var(--wb-card-rim), inset 0 -1px 0 var(--wb-rim-bottom), 0 0 0 2px var(--wb-focus-ring), 0 0 0 4px color-mix(in srgb, var(--wb-focus-ring) 28%, transparent), var(--wb-card-shadow);outline:none}.y5tTyq_cardFiles{min-height:260px}.y5tTyq_cardHead{align-items:center;gap:8px;min-width:0;display:flex}.y5tTyq_cardOpen{border-radius:var(--wb-radius-md);min-width:0;color:inherit;font:inherit;text-align:left;cursor:pointer;transition:background .18s var(--wb-ease), transform .18s var(--wb-ease);background:0 0;border:none;flex:1;align-items:center;gap:8px;margin:-2px -4px -2px -2px;padding:2px 4px 2px 2px;display:flex}.y5tTyq_cardOpen:hover:not(:disabled){background:color-mix(in srgb, var(--wb-glass-tint) 7%, transparent)}.y5tTyq_cardOpen:active:not(:disabled){background:color-mix(in srgb, var(--wb-glass-tint) 11%, transparent);transform:translate(1px)}.y5tTyq_cardOpen:disabled{cursor:default}.y5tTyq_cardOpen:focus-visible{outline:2px solid var(--wb-focus-ring);outline-offset:1px;box-shadow:0 0 0 4px color-mix(in srgb, var(--wb-focus-ring) 24%, transparent)}.y5tTyq_cardGlyph{border:1px solid color-mix(in srgb, var(--card-accent) 24%, transparent);border-radius:var(--wb-radius-md);background:linear-gradient(180deg, color-mix(in srgb, var(--wb-text) 14%, transparent) 0%, transparent 55%), color-mix(in srgb, var(--card-accent) 18%, transparent);width:28px;height:28px;color:var(--card-accent);box-shadow:inset 0 1px 0 color-mix(in srgb, var(--wb-text) 18%, transparent), 0 0 14px color-mix(in srgb, var(--card-accent) 22%, transparent);transition:box-shadow .22s var(--wb-ease), border-color .22s var(--wb-ease);flex:none;justify-content:center;align-items:center;display:inline-flex}.y5tTyq_cardOpen:hover:not(:disabled) .y5tTyq_cardGlyph{box-shadow:inset 0 1px 0 color-mix(in srgb, var(--wb-text) 22%, transparent), 0 0 20px color-mix(in srgb, var(--card-accent) 36%, transparent)}.y5tTyq_cardTitle{text-overflow:ellipsis;white-space:nowrap;letter-spacing:-.005em;min-width:0;color:var(--wb-text);flex:1;font-size:13.5px;font-weight:600;overflow:hidden}.y5tTyq_cardPath{text-overflow:ellipsis;white-space:nowrap;font-family:var(--ds-font-family-code);letter-spacing:-.005em;color:color-mix(in srgb, var(--wb-accent) 55%, var(--wb-text));opacity:.92;margin:0;font-size:11px;overflow:hidden}.y5tTyq_explorer{border:1px solid var(--wb-line);border-top-color:var(--wb-rim-top);border-radius:var(--wb-radius-md);background:var(--wb-scrim);min-height:0;box-shadow:inset 0 1px 0 color-mix(in srgb, var(--wb-text) 10%, transparent);flex-direction:column;flex:1;display:flex;overflow:hidden}.y5tTyq_explorerHead{border-bottom:1px solid var(--wb-line);background:color-mix(in srgb, var(--wb-glass-tint) 5%, transparent);flex:none;align-items:center;gap:4px;height:28px;padding:0 6px 0 4px;display:flex}.y5tTyq_explorerCaret{color:color-mix(in srgb, var(--wb-text-dim) 78%, transparent);flex:none}.y5tTyq_explorerTitle{text-overflow:ellipsis;white-space:nowrap;letter-spacing:.1em;text-transform:uppercase;color:color-mix(in srgb, var(--wb-text-dim) 88%, transparent);flex:none;font-size:10.5px;font-weight:700;overflow:hidden}.y5tTyq_explorerParent{text-overflow:ellipsis;white-space:nowrap;text-align:right;min-width:0;color:color-mix(in srgb, var(--wb-text-dim) 62%, transparent);flex:1;font-size:10.5px;overflow:hidden}.y5tTyq_explorerTools{flex:none;align-items:center;gap:2px;display:inline-flex}.y5tTyq_explorerTool{width:22px;height:22px;color:var(--wb-text-dim);cursor:pointer;transition:background .18s var(--wb-ease), color .18s var(--wb-ease);background:0 0;border:none;border-radius:6px;justify-content:center;align-items:center;padding:0;display:inline-flex}.y5tTyq_explorerTool:hover:not(:disabled){background:color-mix(in srgb, var(--wb-glass-tint) 11%, transparent);color:var(--wb-text)}.y5tTyq_explorerTool:disabled{color:color-mix(in srgb, var(--wb-text-dim) 50%, transparent);cursor:default;opacity:.5}.y5tTyq_explorerTool:focus-visible,.y5tTyq_explorerRow:focus-visible,.y5tTyq_explorerRetry:focus-visible{outline:1px solid var(--wb-focus-ring);outline-offset:-1px}.y5tTyq_explorerRows{scrollbar-width:thin;scrollbar-color:color-mix(in srgb, var(--wb-glass-tint) 22%, transparent) transparent;flex:1;min-height:0;margin:0;padding:4px 0;list-style:none;overflow:auto}.y5tTyq_explorerRows::-webkit-scrollbar{width:8px}.y5tTyq_explorerRows::-webkit-scrollbar-thumb{border-radius:var(--wb-radius-pill);background-clip:content-box;background-color:color-mix(in srgb, var(--wb-glass-tint) 22%, transparent);transition:background-color .18s var(--wb-ease);border:2px solid #0000}.y5tTyq_explorerRows::-webkit-scrollbar-thumb:hover{background-color:color-mix(in srgb, var(--wb-glass-tint) 34%, transparent)}.y5tTyq_explorerRows::-webkit-scrollbar-track{background:0 0}.y5tTyq_explorerItem{min-width:0}.y5tTyq_explorerRow{box-sizing:border-box;width:100%;height:22px;color:var(--wb-text);font:inherit;text-align:left;white-space:nowrap;cursor:pointer;transition:background .16s var(--wb-ease), color .16s var(--wb-ease);background:0 0;border:none;align-items:center;gap:4px;padding:0 6px 0 4px;font-size:12.5px;line-height:22px;display:flex}.y5tTyq_explorerRow:hover{background:color-mix(in srgb, var(--wb-glass-tint) 6%, transparent)}.y5tTyq_explorerRowSelected{background:color-mix(in srgb, var(--wb-accent) 22%, transparent);box-shadow:inset 2px 0 0 var(--wb-accent);color:var(--wb-text)}.y5tTyq_explorerRowSelected:hover{background:color-mix(in srgb, var(--wb-accent) 28%, transparent)}.y5tTyq_explorerRow:focus-visible{background:color-mix(in srgb, var(--wb-accent) 12%, transparent);box-shadow:inset 0 0 0 1px var(--wb-focus-ring), inset 2px 0 0 var(--wb-accent);outline:none}.y5tTyq_explorerGuide{background-image:linear-gradient(90deg, color-mix(in srgb, var(--wb-text) 12%, transparent) 0 1px, transparent 1px);background-repeat:no-repeat;flex:none;align-self:stretch;width:14px}.y5tTyq_explorerGlyph{width:14px;color:color-mix(in srgb, var(--wb-text-dim) 78%, transparent);transition:color .16s var(--wb-ease);flex:none;justify-content:center;align-items:center;display:inline-flex}.y5tTyq_explorerRow:hover .y5tTyq_explorerGlyph{color:var(--wb-text-dim)}.y5tTyq_explorerIcon{width:18px;color:color-mix(in srgb, var(--wb-accent) 50%, var(--wb-text-dim));transition:color .16s var(--wb-ease);flex:none;justify-content:center;align-items:center;display:inline-flex}.y5tTyq_explorerRow[data-explorer-kind=file] .y5tTyq_explorerIcon{color:inherit}.y5tTyq_explorerName{text-overflow:ellipsis;flex:1;min-width:0;overflow:hidden}.y5tTyq_explorerSize{letter-spacing:.01em;color:color-mix(in srgb, var(--wb-text-dim) 60%, transparent);font-variant-numeric:tabular-nums;flex:none;padding-left:8px;font-size:10.5px}.y5tTyq_explorerNoteRow{box-sizing:border-box;height:22px;color:color-mix(in srgb, var(--wb-text-dim) 70%, transparent);align-items:center;gap:4px;padding:0 6px 0 4px;font-size:11.5px;display:flex}.y5tTyq_explorerNoteText{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.y5tTyq_explorerErrorText{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--wb-danger);flex:1;overflow:hidden}.y5tTyq_explorerRetry{border:1px solid var(--wb-line-strong);border-radius:var(--wb-radius-pill);height:18px;color:var(--wb-text);font:inherit;cursor:pointer;transition:background .18s var(--wb-ease), border-color .18s var(--wb-ease);background:0 0;flex:none;padding:0 8px;font-size:10.5px}.y5tTyq_explorerRetry:hover{background:color-mix(in srgb, var(--wb-glass-tint) 11%, transparent);border-color:color-mix(in srgb, var(--wb-glass-tint) 22%, transparent)}.y5tTyq_explorerSpin{animation:1s linear infinite y5tTyq_wbSpin}.y5tTyq_explorerNote{color:var(--wb-text-dim);margin:0;padding:14px 12px;font-size:12px;line-height:1.5}.y5tTyq_explorerFoot{border-top:1px solid var(--wb-line);letter-spacing:.02em;color:color-mix(in srgb, var(--wb-text-dim) 62%, transparent);text-overflow:ellipsis;white-space:nowrap;flex:none;margin:0;padding:6px 10px;font-size:10.5px;overflow:hidden}.y5tTyq_picker{width:min(560px,92vw);color:var(--wb-text)}.y5tTyq_pickerContent{max-height:min(560px,72vh)}.y5tTyq_pickerCrumbs{flex-wrap:wrap;align-items:center;gap:2px;padding:0 0 8px;font-size:12px;display:flex}.y5tTyq_pickerCrumbCell{align-items:center;gap:2px;min-width:0;display:inline-flex}.y5tTyq_pickerCrumbSep{color:color-mix(in srgb, var(--wb-text-dim) 50%, transparent)}.y5tTyq_pickerCrumb{text-overflow:ellipsis;white-space:nowrap;max-width:160px;color:var(--wb-text-dim);font:inherit;cursor:pointer;transition:background .18s var(--wb-ease), color .18s var(--wb-ease);background:0 0;border:none;border-radius:6px;padding:2px 6px;font-size:12px;overflow:hidden}.y5tTyq_pickerCrumb:hover{background:color-mix(in srgb, var(--wb-glass-tint) 9%, transparent);color:var(--wb-text)}.y5tTyq_pickerCrumbCurrent{color:var(--wb-text);font-weight:600}.y5tTyq_pickerAddress{align-items:center;gap:6px;padding:0 0 8px;display:flex}.y5tTyq_pickerAddressInput{min-width:0;font-family:var(--ds-font-family-code);flex:1;font-size:12px}.y5tTyq_pickerBar{border-bottom:1px solid var(--wb-line);align-items:center;gap:8px;padding:0 0 8px;display:flex}.y5tTyq_pickerPath{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-family:var(--ds-font-family-code);color:color-mix(in srgb, var(--wb-accent) 55%, var(--wb-text));opacity:.92;flex:1;font-size:11.5px;overflow:hidden}.y5tTyq_pickerToggle{color:var(--wb-text-dim);cursor:pointer;flex:none;align-items:center;gap:5px;font-size:11px;display:inline-flex}.y5tTyq_pickerTool{width:22px;height:22px;color:var(--wb-text-dim);cursor:pointer;transition:background .18s var(--wb-ease), color .18s var(--wb-ease);background:0 0;border:none;border-radius:6px;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.y5tTyq_pickerTool:hover:not(:disabled){background:color-mix(in srgb, var(--wb-glass-tint) 11%, transparent);color:var(--wb-text)}.y5tTyq_pickerTool:disabled{opacity:.45;cursor:default}.y5tTyq_pickerCreate{align-items:center;gap:8px;padding:8px 0;display:flex}.y5tTyq_pickerNotice{border:1px solid color-mix(in srgb, var(--wb-danger) 32%, transparent);border-radius:var(--wb-radius-sm);background:color-mix(in srgb, var(--wb-danger) 14%, transparent);color:var(--wb-danger);margin:0 0 8px;padding:6px 8px;font-size:11.5px}.y5tTyq_pickerRows{border:1px solid var(--wb-line);border-top-color:var(--wb-rim-top);border-radius:var(--wb-radius-md);background:var(--wb-scrim);scrollbar-width:thin;scrollbar-color:color-mix(in srgb, var(--wb-glass-tint) 22%, transparent) transparent;min-height:180px;max-height:300px;box-shadow:inset 0 1px 0 color-mix(in srgb, var(--wb-text) 10%, transparent);padding:4px 0;overflow:auto}.y5tTyq_pickerRows::-webkit-scrollbar{width:8px}.y5tTyq_pickerRows::-webkit-scrollbar-thumb{border-radius:var(--wb-radius-pill);background-clip:content-box;background-color:color-mix(in srgb, var(--wb-glass-tint) 22%, transparent);transition:background-color .18s var(--wb-ease);border:2px solid #0000}.y5tTyq_pickerRows::-webkit-scrollbar-thumb:hover{background-color:color-mix(in srgb, var(--wb-glass-tint) 34%, transparent)}.y5tTyq_pickerRows::-webkit-scrollbar-track{background:0 0}.y5tTyq_pickerRow{box-sizing:border-box;width:100%;height:26px;color:var(--wb-text);font:inherit;text-align:left;white-space:nowrap;cursor:pointer;transition:background .16s var(--wb-ease);background:0 0;border:none;align-items:center;gap:6px;padding:0 10px;font-size:12.5px;display:flex}.y5tTyq_pickerRow:hover{background:color-mix(in srgb, var(--wb-glass-tint) 7%, transparent)}.y5tTyq_pickerNote{color:color-mix(in srgb, var(--wb-text-dim) 62%, transparent);align-items:center;gap:6px;margin:0;padding:8px 10px;font-size:11.5px;display:flex}.y5tTyq_editor{flex-direction:column;height:100%;min-height:0;font-size:12.5px;display:flex}.y5tTyq_editorHead{border-bottom:1px solid var(--dsw-alias-border-l2,var(--wb-line));background:color-mix(in srgb, var(--wb-text) 3%, transparent);flex:none;align-items:center;gap:6px;padding:6px 10px;display:flex}.y5tTyq_editorName{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;font-weight:600;overflow:hidden}.y5tTyq_editorDirty{color:var(--wb-warn);flex:none;font-size:10px}.y5tTyq_editorTools{flex:none;align-items:center;gap:4px;display:inline-flex}.y5tTyq_editorMeta{opacity:.6;font-variant-numeric:tabular-nums;font-size:10.5px}.y5tTyq_editorNotice{background:color-mix(in srgb, var(--wb-warn) 16%, transparent);color:var(--wb-warn);flex:none;margin:0;padding:6px 10px;font-size:11.5px}.y5tTyq_editorNote{opacity:.75;flex-direction:column;align-items:flex-start;gap:8px;margin:0;padding:12px 10px;font-size:12px;display:flex}.y5tTyq_editorFailed{color:var(--wb-danger);margin:0}.y5tTyq_editorBody{min-height:0;font-family:var(--ds-font-family-code);flex:1;display:flex;overflow:auto}.y5tTyq_editorGutter{text-align:right;opacity:.4;user-select:none;font-variant-numeric:tabular-nums;flex-direction:column;flex:none;padding:8px 8px 8px 10px;font-size:11.5px;line-height:1.5;display:flex}.y5tTyq_editorLineNo{display:block}.y5tTyq_editorText,.y5tTyq_editorInput{min-width:0;color:inherit;font:inherit;tab-size:2;white-space:pre;background:0 0;border:none;outline:none;flex:1;margin:0;padding:8px 12px 8px 0;font-size:12.5px;line-height:1.5}.y5tTyq_editorText{overflow:visible}.y5tTyq_editorInput{resize:none;white-space:pre;overflow:hidden}.y5tTyq_editorFoot{border-top:1px solid var(--dsw-alias-border-l2,var(--wb-line));background:color-mix(in srgb, var(--wb-text) 3%, transparent);flex:none;align-items:center;gap:8px;padding:6px 10px;display:flex}.y5tTyq_editorHint{text-overflow:ellipsis;white-space:nowrap;opacity:.6;flex:1;min-width:0;font-size:10.5px;overflow:hidden}.y5tTyq_editorChip{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.y5tTyq_cardFoot{border-top:1px solid color-mix(in srgb, var(--wb-text) 6%, transparent);justify-content:space-between;align-items:center;gap:10px;margin-top:2px;padding-top:4px;display:flex}.y5tTyq_cardUpdated{letter-spacing:.02em;color:color-mix(in srgb, var(--wb-text-dim) 62%, transparent);font-variant-numeric:tabular-nums;font-size:10.5px}.y5tTyq_card[data-card-status=idle]{border-color:var(--wb-glass-edge)}.y5tTyq_card[data-card-status=running]{border-color:#0000}.y5tTyq_card[data-card-status=running]:after{background:conic-gradient(from var(--wb-ring-angle), var(--wb-accent) 0deg, var(--wb-accent) 22deg, transparent 38deg, transparent 322deg, var(--wb-accent) 338deg, var(--wb-accent) 360deg);box-shadow:0 0 22px color-mix(in srgb, var(--wb-accent) 60%, transparent), inset 0 0 22px color-mix(in srgb, var(--wb-accent) 38%, transparent);animation:1.6s linear infinite y5tTyq_wbRingSpin}.y5tTyq_card[data-card-status=completed]{border-color:var(--wb-ok);box-shadow:inset 0 1px 0 color-mix(in srgb, var(--wb-glass-tint) 20%, transparent), inset 0 -1px 0 color-mix(in srgb, var(--wb-glass-tint) 5%, transparent), var(--wb-card-shadow), 0 0 0 0 color-mix(in srgb, var(--wb-ok) 60%, transparent)}.y5tTyq_card[data-card-status=completed][data-card-acknowledged=false]{animation:1.4s ease-in-out infinite y5tTyq_wbCompletedPulse}.y5tTyq_card[data-card-status=completed][data-card-acknowledged=true]{border-color:var(--wb-ok);box-shadow:inset 0 1px 0 color-mix(in srgb, var(--wb-glass-tint) 20%, transparent), inset 0 -1px 0 color-mix(in srgb, var(--wb-glass-tint) 5%, transparent), var(--wb-card-shadow);animation:none}.y5tTyq_addCard{border:1px dashed color-mix(in srgb, var(--wb-line-strong) 100%, transparent);border-radius:var(--wb-radius-card);background:linear-gradient(180deg, color-mix(in srgb, var(--wb-text) 4%, transparent) 0%, transparent 70%), color-mix(in srgb, var(--wb-glass-tint) 3%, transparent);-webkit-backdrop-filter:blur(14px)saturate(150%);min-height:190px;color:var(--wb-text-dim);font:inherit;cursor:pointer;transition:border-color .18s var(--wb-ease), background .18s var(--wb-ease), color .18s var(--wb-ease), transform .18s var(--wb-ease), box-shadow .18s var(--wb-ease);flex-direction:column;justify-content:center;align-items:center;gap:6px;padding:18px;display:flex}.y5tTyq_addCard:hover:not(:disabled){border-color:color-mix(in srgb, var(--wb-accent) 60%, transparent);background:linear-gradient(180deg, color-mix(in srgb, var(--wb-text) 6%, transparent) 0%, transparent 70%), color-mix(in srgb, var(--wb-accent) 8%, transparent);color:var(--wb-text);box-shadow:0 18px 44px var(--wb-scrim-strong), 0 0 24px color-mix(in srgb, var(--wb-accent) 14%, transparent);transform:translateY(-3px)}.y5tTyq_addCard:disabled{cursor:progress;opacity:.6}.y5tTyq_addGlyph{border:1px solid var(--wb-line-strong);border-radius:var(--wb-radius-lg);background:linear-gradient(180deg, color-mix(in srgb, var(--wb-text) 16%, transparent) 0%, transparent 55%), linear-gradient(150deg, color-mix(in srgb, var(--wb-accent) 28%, transparent), transparent);width:46px;height:46px;color:color-mix(in srgb, var(--wb-accent) 62%, var(--wb-text));box-shadow:inset 0 1px 0 color-mix(in srgb, var(--wb-text) 22%, transparent);transition:box-shadow .22s var(--wb-ease);justify-content:center;align-items:center;display:inline-flex}.y5tTyq_addCard:hover:not(:disabled) .y5tTyq_addGlyph{box-shadow:inset 0 1px 0 color-mix(in srgb, var(--wb-text) 22%, transparent), 0 0 22px color-mix(in srgb, var(--wb-accent) 36%, transparent)}.y5tTyq_addTitle{letter-spacing:.01em;color:var(--wb-text);font-size:13px;font-weight:600}.y5tTyq_addHint{letter-spacing:.02em;color:color-mix(in srgb, var(--wb-text-dim) 70%, transparent);font-size:11px}.y5tTyq_accent_azure{--card-accent:oklch(from var(--dsw-alias-brand-primary,#679efe) l .16 240)}.y5tTyq_accent_violet{--card-accent:oklch(from var(--dsw-alias-brand-primary,#a78bfa) l .16 290)}.y5tTyq_accent_amber{--card-accent:var(--dsw-alias-state-warn-primary,#f7ad31)}.y5tTyq_accent_emerald{--card-accent:var(--dsw-alias-state-success-primary,#4ed17e)}.y5tTyq_accent_rose{--card-accent:var(--dsw-alias-state-error-primary,#e45c5c)}.y5tTyq_accent_slate{--card-accent:var(--dsw-alias-label-secondary,#979da6)}.y5tTyq_empty{border:1px dashed var(--wb-line-strong);border-radius:var(--wb-radius-card);background:linear-gradient(180deg, color-mix(in srgb, var(--wb-text) 4%, transparent) 0%, transparent 70%), color-mix(in srgb, var(--wb-glass-tint) 3%, transparent);-webkit-backdrop-filter:blur(14px)saturate(150%);text-align:center;flex-direction:column;grid-column:1/-1;justify-content:center;align-items:center;gap:8px;padding:56px 24px;display:flex}.y5tTyq_emptyGlyph{border:1px solid var(--wb-line-strong);border-radius:var(--wb-radius-lg);background:linear-gradient(180deg, color-mix(in srgb, var(--wb-text) 16%, transparent) 0%, transparent 55%), linear-gradient(150deg, color-mix(in srgb, var(--wb-accent) 28%, transparent), transparent);width:48px;height:48px;color:color-mix(in srgb, var(--wb-accent) 62%, var(--wb-text));box-shadow:inset 0 1px 0 color-mix(in srgb, var(--wb-text) 22%, transparent);justify-content:center;align-items:center;display:inline-flex}.y5tTyq_emptyTitle{letter-spacing:.01em;color:var(--wb-text);margin:6px 0 0;font-size:14px;font-weight:600}.y5tTyq_emptyHint{letter-spacing:.01em;color:color-mix(in srgb, var(--wb-text-dim) 72%, transparent);margin:0 0 10px;font-size:12px}.y5tTyq_panelFoot{border-top:1px solid var(--wb-line);background:var(--wb-scrim);justify-content:space-between;align-items:center;padding:10px 22px;display:flex;position:relative}.y5tTyq_footHint{letter-spacing:.04em;text-transform:uppercase;color:color-mix(in srgb, var(--wb-text-dim) 64%, transparent);font-size:10.5px;font-weight:600}:root[data-wb-scheme=light] .y5tTyq_workbench{background:#fff}:root[data-wb-scheme=light] .y5tTyq_workbench:before{background-image:linear-gradient(#e8e8e8 1px,#0000 1px),linear-gradient(90deg,#e8e8e8 1px,#0000 1px),linear-gradient(#ccc 1px,#0000 1px),linear-gradient(90deg,#ccc 1px,#0000 1px);-webkit-mask-image:none;mask-image:none}:root[data-wb-scheme=light] .y5tTyq_panelHead{box-shadow:none;z-index:2;background:#fff;border-bottom:1px solid #000;padding:20px 22px}:root[data-wb-scheme=light] .y5tTyq_headGlyph{color:#fff;box-shadow:none;background:#000;border:1px solid #000;width:36px;height:36px}:root[data-wb-scheme=light] .y5tTyq_title{letter-spacing:-.01em;color:#000;font-size:22px;font-weight:700;line-height:1.05}:root[data-wb-scheme=light] .y5tTyq_subtitle{letter-spacing:.1em;text-transform:uppercase;color:#666;margin-top:4px;font-size:10.5px;font-weight:600}:root[data-wb-scheme=light] .y5tTyq_live{color:#000;height:auto;box-shadow:none;letter-spacing:.1em;text-transform:uppercase;background:#fff;border:1px solid #000;border-radius:0;padding:4px 10px;font-size:10.5px;font-weight:700}:root[data-wb-scheme=light] .y5tTyq_liveDot{width:8px;height:8px;box-shadow:none;background:#000;border-radius:0;animation:none}:root[data-wb-scheme=light] .y5tTyq_action{color:#000;box-shadow:none;letter-spacing:.005em;background:#fff;border:1px solid #000;border-radius:0;font-weight:700;transition:background-color .15s ease-out,border-color .15s ease-out,color .15s ease-out}:root[data-wb-scheme=light] .y5tTyq_action:hover:not(:disabled){color:#000;background:#f0f0f0;border-color:red;transform:none}:root[data-wb-scheme=light] .y5tTyq_action:active:not(:disabled){background:#e5e5e5;border-color:red;transform:none}:root[data-wb-scheme=light] .y5tTyq_action:focus-visible{outline-offset:2px;box-shadow:none;outline:2px solid red}:root[data-wb-scheme=light] .y5tTyq_action:after{content:\"→\";margin-left:6px;font-weight:400;transition:transform .15s ease-out}:root[data-wb-scheme=light] .y5tTyq_action:hover:not(:disabled):after{transform:translate(2px)}:root[data-wb-scheme=light] .y5tTyq_iconOnly{color:#000;background:0 0;border:1px solid #0000;border-radius:0;transition:background-color .15s ease-out,border-color .15s ease-out,color .15s ease-out}:root[data-wb-scheme=light] .y5tTyq_iconOnly:hover:not(:disabled){color:#000;background:#f0f0f0;border-color:#000}:root[data-wb-scheme=light] .y5tTyq_iconOnly:focus-visible{outline-offset:2px;box-shadow:none;outline:2px solid red}:root[data-wb-scheme=light] .y5tTyq_readings{background:#fff;border-bottom:1px solid #000;gap:12px;padding:16px 22px}:root[data-wb-scheme=light] .y5tTyq_reading{box-shadow:none;background:#fff;border:1px solid #000;border-radius:0;gap:6px;padding:12px 14px}:root[data-wb-scheme=light] .y5tTyq_readingLabel{letter-spacing:.12em;text-transform:uppercase;color:#000;font-size:10px;font-weight:700}:root[data-wb-scheme=light] .y5tTyq_readingValue{letter-spacing:-.01em;color:#000;font-size:24px;font-weight:700;line-height:1}:root[data-wb-scheme=light] .y5tTyq_readingHint{letter-spacing:.04em;text-transform:uppercase;color:#666;font-size:10.5px}:root[data-wb-scheme=light] .y5tTyq_projects{scrollbar-color:#000 transparent;gap:16px;padding:24px 22px}:root[data-wb-scheme=light] .y5tTyq_projects::-webkit-scrollbar{width:8px}:root[data-wb-scheme=light] .y5tTyq_projects::-webkit-scrollbar-thumb{background:#000;border:none;border-radius:0}:root[data-wb-scheme=light] .y5tTyq_projects::-webkit-scrollbar-thumb:hover{background:#000}:root[data-wb-scheme=light] .y5tTyq_card{box-shadow:none;-webkit-backdrop-filter:none;background:#fff;border:1px solid #000;border-left-color:#ccc;border-radius:0;gap:10px;padding:16px;transition:background-color .15s ease-out,border-color .15s ease-out}:root[data-wb-scheme=light] .y5tTyq_card:hover{box-shadow:none;background:#f0f0f0;border-color:#000 #000 #000 red;transform:none}:root[data-wb-scheme=light] .y5tTyq_card:focus-visible{outline-offset:2px;box-shadow:none;outline:2px solid red}:root[data-wb-scheme=light] .y5tTyq_card[data-card-status=idle]{border-left-color:#ccc}:root[data-wb-scheme=light] .y5tTyq_card[data-card-status=running]{border-color:red}:root[data-wb-scheme=light] .y5tTyq_card[data-card-status=running]:after{box-shadow:none;background:0 0;animation:none}:root[data-wb-scheme=light] .y5tTyq_card[data-card-status=completed]{box-shadow:none;border-color:#0057b8}:root[data-wb-scheme=light] .y5tTyq_card[data-card-status=completed][data-card-acknowledged=false]{animation:none}:root[data-wb-scheme=light] .y5tTyq_card[data-card-status=completed][data-card-acknowledged=true]{border-color:#0057b8}:root[data-wb-scheme=light] .y5tTyq_card:before{display:none}:root[data-wb-scheme=light] .y5tTyq_card:after{box-shadow:none;background:0 0}:root[data-wb-scheme=light] .y5tTyq_cardHead{align-items:center}:root[data-wb-scheme=light] .y5tTyq_cardOpen{color:#000;box-shadow:none;background:0 0;border:none;border-radius:0;margin:0;padding:0;transition:color .15s ease-out}:root[data-wb-scheme=light] .y5tTyq_cardOpen:hover:not(:disabled){color:red;box-shadow:none;background:0 0;transform:none}:root[data-wb-scheme=light] .y5tTyq_cardOpen:active:not(:disabled){transform:none}:root[data-wb-scheme=light] .y5tTyq_cardOpen:focus-visible{outline-offset:2px;outline:2px solid red}:root[data-wb-scheme=light] .y5tTyq_cardGlyph{color:#000}:root[data-wb-scheme=light] .y5tTyq_cardOpen:hover:not(:disabled) .y5tTyq_cardGlyph{color:red;box-shadow:none}:root[data-wb-scheme=light] .y5tTyq_cardTitle{letter-spacing:-.005em;font-size:16px;font-weight:700}:root[data-wb-scheme=light] .y5tTyq_cardOpen:after{content:\"→\";color:#ccc;margin-left:8px;font-weight:400;transition:color .15s ease-out,transform .15s ease-out}:root[data-wb-scheme=light] .y5tTyq_cardOpen:hover:not(:disabled):after{color:red;transform:translate(2px)}:root[data-wb-scheme=light] .y5tTyq_cardPath{letter-spacing:.02em;color:#666;font-family:inherit;font-size:11px;transition:color .15s ease-out}:root[data-wb-scheme=light] .y5tTyq_card:hover .y5tTyq_cardPath{color:red}:root[data-wb-scheme=light] .y5tTyq_cardFoot{border-top:1px solid #ccc;margin-top:4px;padding-top:8px}:root[data-wb-scheme=light] .y5tTyq_cardUpdated{letter-spacing:.06em;text-transform:uppercase;color:#666;font-size:10.5px;font-weight:600}:root[data-wb-scheme=light] .y5tTyq_cardStatus{letter-spacing:.12em;text-transform:uppercase;color:#000;font-size:10px;font-weight:700}:root[data-wb-scheme=light] .y5tTyq_cardStatus[data-card-state=running]{color:red}:root[data-wb-scheme=light] .y5tTyq_cardStatus[data-card-state=completed]{color:#0057b8}:root[data-wb-scheme=light] .y5tTyq_explorer{box-shadow:none;background:#fff;border:1px solid #000;border-radius:0}:root[data-wb-scheme=light] .y5tTyq_explorerHead{background:#fff;border-bottom:1px solid #000;height:32px;padding:0 10px}:root[data-wb-scheme=light] .y5tTyq_explorerCaret{color:#000}:root[data-wb-scheme=light] .y5tTyq_explorerTitle{letter-spacing:.12em;text-transform:uppercase;color:#000;font-size:11px;font-weight:700}:root[data-wb-scheme=light] .y5tTyq_explorerParent{text-align:left;color:#666;font-family:inherit;font-size:10.5px}:root[data-wb-scheme=light] .y5tTyq_explorerTools{gap:2px}:root[data-wb-scheme=light] .y5tTyq_explorerTool{color:#000;background:0 0;border:1px solid #0000;border-radius:0;transition:background-color .15s ease-out,border-color .15s ease-out,color .15s ease-out}:root[data-wb-scheme=light] .y5tTyq_explorerTool:hover:not(:disabled){color:#000;background:#f0f0f0;border-color:#000}:root[data-wb-scheme=light] .y5tTyq_explorerTool:disabled{color:#ccc;opacity:1;background:0 0;border-color:#0000}:root[data-wb-scheme=light] .y5tTyq_explorerTool:focus-visible,:root[data-wb-scheme=light] .y5tTyq_explorerRow:focus-visible,:root[data-wb-scheme=light] .y5tTyq_explorerRetry:focus-visible{outline-offset:-2px;outline:2px solid red}:root[data-wb-scheme=light] .y5tTyq_explorerRows{scrollbar-color:#000 transparent;padding:4px 0}:root[data-wb-scheme=light] .y5tTyq_explorerRows::-webkit-scrollbar{width:8px}:root[data-wb-scheme=light] .y5tTyq_explorerRows::-webkit-scrollbar-thumb{background:#000;border:none;border-radius:0}:root[data-wb-scheme=light] .y5tTyq_explorerRows::-webkit-scrollbar-thumb:hover{background:#000}:root[data-wb-scheme=light] .y5tTyq_explorerRow{border-radius:0;transition:background-color .15s ease-out}:root[data-wb-scheme=light] .y5tTyq_explorerRow:hover{box-shadow:none;background:#f0f0f0;border-color:#0000}:root[data-wb-scheme=light] .y5tTyq_explorerRow:hover .y5tTyq_explorerGlyph{color:#000;box-shadow:none}:root[data-wb-scheme=light] .y5tTyq_explorerRowSelected{color:#fff;box-shadow:none;background:#000}:root[data-wb-scheme=light] .y5tTyq_explorerRowSelected:hover{background:#000}:root[data-wb-scheme=light] .y5tTyq_explorerRowSelected .y5tTyq_explorerName{color:#fff}:root[data-wb-scheme=light] .y5tTyq_explorerRowSelected .y5tTyq_explorerSize{color:#ccc}:root[data-wb-scheme=light] .y5tTyq_explorerRowSelected .y5tTyq_explorerGlyph,:root[data-wb-scheme=light] .y5tTyq_explorerRowSelected .y5tTyq_explorerIcon{color:#fff}:root[data-wb-scheme=light] .y5tTyq_explorerRowSelected .y5tTyq_explorerGuide{background:#fff}:root[data-wb-scheme=light] .y5tTyq_explorerRowSelected .y5tTyq_explorerGuide[data-depth^=\"1\"]{background:#666}:root[data-wb-scheme=light] .y5tTyq_explorerRowSelected:hover .y5tTyq_explorerGlyph{color:#fff;box-shadow:none}:root[data-wb-scheme=light] .y5tTyq_explorerGuide{background-image:linear-gradient(90deg,#ccc 0 1px,#0000 1px)}:root[data-wb-scheme=light] .y5tTyq_explorerGlyph,:root[data-wb-scheme=light] .y5tTyq_explorerIcon,:root[data-wb-scheme=light] .y5tTyq_explorerRow[data-explorer-kind=file] .y5tTyq_explorerIcon{color:#000}:root[data-wb-scheme=light] .y5tTyq_explorerName{color:inherit;font-weight:500}:root[data-wb-scheme=light] .y5tTyq_explorerSize{color:#666;font-size:11px}:root[data-wb-scheme=light] .y5tTyq_explorerNoteText{color:#666}:root[data-wb-scheme=light] .y5tTyq_explorerErrorText{color:red}:root[data-wb-scheme=light] .y5tTyq_explorerRetry{color:#000;box-shadow:none;background:#fff;border:1px solid #000;border-radius:0;font-weight:700;transition:background-color .15s ease-out,border-color .15s ease-out}:root[data-wb-scheme=light] .y5tTyq_explorerRetry:hover{box-shadow:none;background:#f0f0f0;border-color:red}:root[data-wb-scheme=light] .y5tTyq_explorerRetry:after{content:\"→\";margin-left:4px;font-weight:400}:root[data-wb-scheme=light] .y5tTyq_explorerSpin{animation:none}:root[data-wb-scheme=light] .y5tTyq_explorerNote{color:#666;text-align:left;font-size:11px}:root[data-wb-scheme=light] .y5tTyq_explorerFoot{letter-spacing:.08em;text-transform:uppercase;color:#666;border-top:1px solid #ccc;padding:6px 10px;font-size:10px;font-weight:600}:root[data-wb-scheme=light] .y5tTyq_addCard{color:#000;text-align:left;box-shadow:none;background:#fff;border:1px solid #000;border-radius:0;align-items:flex-start;padding:18px;transition:background-color .15s ease-out,border-color .15s ease-out,color .15s ease-out}:root[data-wb-scheme=light] .y5tTyq_addCard:hover:not(:disabled){color:#000;box-shadow:none;background:#f0f0f0;border-color:red;transform:none}:root[data-wb-scheme=light] .y5tTyq_addCard:disabled{color:#999;opacity:1;background:#fff;border-color:#ccc}:root[data-wb-scheme=light] .y5tTyq_addGlyph{color:#fff;box-shadow:none;background:#000;border:1px solid #000;border-radius:0;align-self:flex-start;width:36px;height:36px}:root[data-wb-scheme=light] .y5tTyq_addCard:hover:not(:disabled) .y5tTyq_addGlyph{color:#fff;box-shadow:none;background:#000}:root[data-wb-scheme=light] .y5tTyq_addTitle{letter-spacing:0;text-transform:none;color:#000;font-size:14px;font-weight:700}:root[data-wb-scheme=light] .y5tTyq_addHint{letter-spacing:0;text-transform:none;color:#666;font-size:12px;font-weight:400}:root[data-wb-scheme=light] .y5tTyq_addCard:after{content:\"→\";margin-top:4px;font-size:14px;font-weight:700}:root[data-wb-scheme=light] .y5tTyq_empty{text-align:left;box-shadow:none;background:#fff;border:1px solid #000;border-radius:0;align-items:flex-start;gap:10px;padding:56px 24px}:root[data-wb-scheme=light] .y5tTyq_emptyGlyph{color:#fff;box-shadow:none;background:#000;border:1px solid #000;border-radius:0;align-self:flex-start;width:44px;height:44px}:root[data-wb-scheme=light] .y5tTyq_emptyTitle{letter-spacing:-.005em;text-transform:none;color:#000;margin:0;font-size:16px;font-weight:700}:root[data-wb-scheme=light] .y5tTyq_emptyHint{letter-spacing:0;text-transform:none;color:#666;margin:0;font-size:13px;font-weight:400}:root[data-wb-scheme=light] .y5tTyq_panelFoot{background:#fff;border-top:1px solid #000}:root[data-wb-scheme=light] .y5tTyq_footHint{letter-spacing:.14em;text-transform:uppercase;color:#666;font-size:10px;font-weight:700}:root[data-wb-scheme=light] .y5tTyq_notice{color:#000;background:#fff;border-bottom:1px solid #000;padding:12px 22px;font-weight:500}:root[data-wb-scheme=light] .y5tTyq_noticeError{color:red;background:#fff;border-bottom:2px solid red;padding:12px 22px;font-weight:600}:root[data-wb-scheme=light] .y5tTyq_noticeErrorText{color:red}:root[data-wb-scheme=light] .y5tTyq_noticeClose{color:#000;background:#fff;border:1px solid #000;border-radius:0;transition:background-color .15s ease-out,border-color .15s ease-out}:root[data-wb-scheme=light] .y5tTyq_noticeClose:hover{color:#000;background:#f0f0f0;border-color:red}:root[data-wb-scheme=light] .y5tTyq_picker{color:#000}:root[data-wb-scheme=light] .y5tTyq_pickerContent{background:#fff}:root[data-wb-scheme=light] .y5tTyq_pickerCrumbs{padding:0 0 10px}:root[data-wb-scheme=light] .y5tTyq_pickerCrumbSep{color:#999}:root[data-wb-scheme=light] .y5tTyq_pickerCrumb{color:#666;background:0 0;border-radius:0;transition:background-color .15s ease-out,color .15s ease-out}:root[data-wb-scheme=light] .y5tTyq_pickerCrumb:hover{color:#000;box-shadow:none;background:#f0f0f0}:root[data-wb-scheme=light] .y5tTyq_pickerCrumbCurrent{color:#000;background:#f0f0f0}:root[data-wb-scheme=light] .y5tTyq_pickerAddress{background:#fff;border:1px solid #000;border-radius:0}:root[data-wb-scheme=light] .y5tTyq_pickerAddressInput{color:#000;background:#fff;border-radius:0;font-family:inherit}:root[data-wb-scheme=light] .y5tTyq_pickerBar{background:#fff;border:1px solid #000;border-radius:0}:root[data-wb-scheme=light] .y5tTyq_pickerPath{color:#000}:root[data-wb-scheme=light] .y5tTyq_pickerToggle{color:#000;background:#fff;border:1px solid #000;border-radius:0}:root[data-wb-scheme=light] .y5tTyq_pickerTool{color:#000;background:#fff;border:1px solid #000;border-radius:0;font-weight:700;transition:background-color .15s ease-out,border-color .15s ease-out}:root[data-wb-scheme=light] .y5tTyq_pickerTool:hover:not(:disabled){color:#000;box-shadow:none;background:#f0f0f0;border-color:red}:root[data-wb-scheme=light] .y5tTyq_pickerTool:disabled{color:#999;box-shadow:none;background:#fff;border-color:#ccc}:root[data-wb-scheme=light] .y5tTyq_pickerTool:after{content:\"→\";margin-left:4px;font-weight:400}:root[data-wb-scheme=light] .y5tTyq_pickerCreate{color:#fff;background:#000;border:1px solid #000;border-radius:0;font-weight:700}:root[data-wb-scheme=light] .y5tTyq_pickerNotice{color:#000;background:#fff;border:1px solid #000;border-radius:0}:root[data-wb-scheme=light] .y5tTyq_pickerRows{scrollbar-color:#000 transparent;background:#fff;border:1px solid #000;border-radius:0}:root[data-wb-scheme=light] .y5tTyq_pickerRows::-webkit-scrollbar{width:8px}:root[data-wb-scheme=light] .y5tTyq_pickerRows::-webkit-scrollbar-thumb{background:#000;border:none;border-radius:0}:root[data-wb-scheme=light] .y5tTyq_pickerRow{color:#000;background:0 0;border-radius:0;transition:background-color .15s ease-out,color .15s ease-out}:root[data-wb-scheme=light] .y5tTyq_pickerRow:hover{color:#000;box-shadow:none;background:#f0f0f0}:root[data-wb-scheme=light] .y5tTyq_pickerNote{color:#666;text-align:left;background:#fff;border-radius:0}:root[data-wb-scheme=light] .y5tTyq_editor{color:#000}:root[data-wb-scheme=light] .y5tTyq_editorHead{background:#fff;border-bottom:1px solid #000}:root[data-wb-scheme=light] .y5tTyq_editorName{color:#000;font-weight:700}:root[data-wb-scheme=light] .y5tTyq_editorDirty{color:red}:root[data-wb-scheme=light] .y5tTyq_editorTools{gap:6px}:root[data-wb-scheme=light] .y5tTyq_editorTool,:root[data-wb-scheme=light] .y5tTyq_editorSave,:root[data-wb-scheme=light] .y5tTyq_editorCancel,:root[data-wb-scheme=light] .y5tTyq_editorPreview{color:#000;background:#fff;border:1px solid #000;border-radius:0;font-weight:700;transition:background-color .15s ease-out,border-color .15s ease-out}:root[data-wb-scheme=light] .y5tTyq_editorMeta{color:#666}:root[data-wb-scheme=light] .y5tTyq_editorNotice{color:#000;text-align:left;background:#fff;border:1px solid #000;border-radius:0}:root[data-wb-scheme=light] .y5tTyq_editorNote{color:#666;text-align:left}:root[data-wb-scheme=light] .y5tTyq_editorFailed{color:red;text-align:left;background:#fff;border:1px solid red;border-radius:0}:root[data-wb-scheme=light] .y5tTyq_editorBody{background:#fff;border-radius:0}:root[data-wb-scheme=light] .y5tTyq_editorGutter{color:#999;font-variant-numeric:tabular-nums;background:#fff;border-right:1px solid #ccc;font-family:inherit}:root[data-wb-scheme=light] .y5tTyq_editorText,:root[data-wb-scheme=light] .y5tTyq_editorInput{font-variant-numeric:tabular-nums;color:#000;background:#fff;border-radius:0;font-family:inherit}:root[data-wb-scheme=light] .y5tTyq_editorFoot{background:#fff;border-top:1px solid #000}:root[data-wb-scheme=light] .y5tTyq_editorHint{color:#666;letter-spacing:.06em;text-transform:uppercase;font-size:10.5px;font-weight:600}:root[data-wb-scheme=light] .y5tTyq_editorChip{color:#000;background:#fff;border:1px solid #000;border-radius:0}:root[data-wb-scheme=light] *,:root[data-wb-scheme=light] :is(.y5tTyq_card,.y5tTyq_addCard,.y5tTyq_empty,.y5tTyq_reading,.y5tTyq_explorer,.y5tTyq_panelHead,.y5tTyq_panelFoot,.y5tTyq_picker,.y5tTyq_pickerContent,.y5tTyq_pickerRow,.y5tTyq_pickerTool,.y5tTyq_pickerCreate,.y5tTyq_pickerCrumb,.y5tTyq_pickerAddress,.y5tTyq_pickerAddressInput,.y5tTyq_pickerBar,.y5tTyq_pickerToggle,.y5tTyq_pickerNotice,.y5tTyq_pickerRows,.y5tTyq_pickerNote,.y5tTyq_editorHead,.y5tTyq_editorName,.y5tTyq_editorBody,.y5tTyq_editorFoot,.y5tTyq_editorGutter,.y5tTyq_editorText,.y5tTyq_editorInput,.y5tTyq_editorChip,.y5tTyq_editorNotice,.y5tTyq_editorFailed,.y5tTyq_notice,.y5tTyq_noticeError,.y5tTyq_noticeClose,.y5tTyq_explorerHead,.y5tTyq_explorerRow,.y5tTyq_explorerTool,.y5tTyq_explorerRetry,.y5tTyq_action,.y5tTyq_iconOnly,.y5tTyq_cardOpen,.y5tTyq_addGlyph,.y5tTyq_emptyGlyph,.y5tTyq_headGlyph,.y5tTyq_live,.y5tTyq_liveDot){border-radius:0}:root[data-wb-scheme=light] .y5tTyq_explorerRow:focus-visible{outline-offset:-2px;box-shadow:none;outline:2px solid red}@media (prefers-reduced-motion:reduce){:root[data-wb-scheme=light] :is(.y5tTyq_workbench,.y5tTyq_panelHead,.y5tTyq_headGlyph,.y5tTyq_live,.y5tTyq_action,.y5tTyq_iconOnly,.y5tTyq_readings,.y5tTyq_reading,.y5tTyq_projects,.y5tTyq_card,.y5tTyq_cardOpen,.y5tTyq_addCard,.y5tTyq_empty,.y5tTyq_explorer,.y5tTyq_explorerHead,.y5tTyq_explorerRow,.y5tTyq_explorerTool,.y5tTyq_explorerRetry,.y5tTyq_panelFoot,.y5tTyq_pickerCrumb,.y5tTyq_pickerTool,.y5tTyq_pickerRow,.y5tTyq_pickerCreate,.y5tTyq_pickerAddress,.y5tTyq_editorHead,.y5tTyq_editorFoot){transition:none}:root[data-wb-scheme=light] :is(.y5tTyq_liveDot,.y5tTyq_explorerSpin,.y5tTyq_addGlyph,.y5tTyq_cardGlyph,.y5tTyq_card[data-card-status=completed][data-card-acknowledged=false]){animation:none}}@media (width<=760px){.y5tTyq_readings{grid-template-columns:repeat(2,minmax(0,1fr))}.y5tTyq_live{display:none}}@keyframes y5tTyq_wbPulse{0%,to{opacity:1}50%{opacity:.35}}@keyframes y5tTyq_wbSheenDrift{0%{--wb-sheen-angle:0deg}to{--wb-sheen-angle:360deg}}@keyframes y5tTyq_wbSpin{to{transform:rotate(360deg)}}@keyframes y5tTyq_wbRingSpin{to{--wb-ring-angle:360deg}}@keyframes y5tTyq_wbCompletedPulse{0%,to{box-shadow:inset 0 1px 0 color-mix(in srgb, var(--wb-glass-tint) 20%, transparent), inset 0 -1px 0 color-mix(in srgb, var(--wb-glass-tint) 5%, transparent), var(--wb-card-shadow), 0 0 0 0 color-mix(in srgb, var(--wb-ok) 60%, transparent)}50%{box-shadow:inset 0 1px 0 color-mix(in srgb, var(--wb-glass-tint) 20%, transparent), inset 0 -1px 0 color-mix(in srgb, var(--wb-glass-tint) 5%, transparent), var(--wb-card-shadow), 0 0 0 6px color-mix(in srgb, var(--wb-ok) 0%, transparent)}}@media (prefers-reduced-motion:reduce){.y5tTyq_liveDot,.y5tTyq_explorerSpin,.y5tTyq_card[data-card-status=running]:after,.y5tTyq_card[data-card-status=completed][data-card-acknowledged=false]{animation:none}.y5tTyq_card,.y5tTyq_card:after,.y5tTyq_addCard,.y5tTyq_addGlyph,.y5tTyq_cardOpen,.y5tTyq_cardGlyph,.y5tTyq_action,.y5tTyq_iconOnly,.y5tTyq_noticeClose,.y5tTyq_explorerTool,.y5tTyq_explorerRow,.y5tTyq_explorerGlyph,.y5tTyq_explorerIcon,.y5tTyq_explorerRetry,.y5tTyq_explorerRows::-webkit-scrollbar-thumb,.y5tTyq_pickerCrumb,.y5tTyq_pickerRow,.y5tTyq_pickerTool,.y5tTyq_pickerRows::-webkit-scrollbar-thumb,.y5tTyq_projects::-webkit-scrollbar-thumb{transition:none}.y5tTyq_card{--wb-sheen-angle:0deg}}";
		const tagId = "dsh-workbench/Workbench.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-workbench";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var Workbench_module_css_default = {
			"accent_amber": "y5tTyq_accent_amber",
			"accent_azure": "y5tTyq_accent_azure",
			"accent_emerald": "y5tTyq_accent_emerald",
			"accent_rose": "y5tTyq_accent_rose",
			"accent_slate": "y5tTyq_accent_slate",
			"accent_violet": "y5tTyq_accent_violet",
			"action": "y5tTyq_action",
			"addCard": "y5tTyq_addCard",
			"addGlyph": "y5tTyq_addGlyph",
			"addHint": "y5tTyq_addHint",
			"addTitle": "y5tTyq_addTitle",
			"card": "y5tTyq_card",
			"cardFiles": "y5tTyq_cardFiles",
			"cardFoot": "y5tTyq_cardFoot",
			"cardGlyph": "y5tTyq_cardGlyph",
			"cardHead": "y5tTyq_cardHead",
			"cardOpen": "y5tTyq_cardOpen",
			"cardPath": "y5tTyq_cardPath",
			"cardStatus": "y5tTyq_cardStatus",
			"cardTitle": "y5tTyq_cardTitle",
			"cardUpdated": "y5tTyq_cardUpdated",
			"editor": "y5tTyq_editor",
			"editorBody": "y5tTyq_editorBody",
			"editorCancel": "y5tTyq_editorCancel",
			"editorChip": "y5tTyq_editorChip",
			"editorDirty": "y5tTyq_editorDirty",
			"editorFailed": "y5tTyq_editorFailed",
			"editorFoot": "y5tTyq_editorFoot",
			"editorGutter": "y5tTyq_editorGutter",
			"editorHead": "y5tTyq_editorHead",
			"editorHint": "y5tTyq_editorHint",
			"editorInput": "y5tTyq_editorInput",
			"editorLineNo": "y5tTyq_editorLineNo",
			"editorMeta": "y5tTyq_editorMeta",
			"editorName": "y5tTyq_editorName",
			"editorNote": "y5tTyq_editorNote",
			"editorNotice": "y5tTyq_editorNotice",
			"editorPreview": "y5tTyq_editorPreview",
			"editorSave": "y5tTyq_editorSave",
			"editorText": "y5tTyq_editorText",
			"editorTool": "y5tTyq_editorTool",
			"editorTools": "y5tTyq_editorTools",
			"empty": "y5tTyq_empty",
			"emptyGlyph": "y5tTyq_emptyGlyph",
			"emptyHint": "y5tTyq_emptyHint",
			"emptyTitle": "y5tTyq_emptyTitle",
			"explorer": "y5tTyq_explorer",
			"explorerCaret": "y5tTyq_explorerCaret",
			"explorerErrorText": "y5tTyq_explorerErrorText",
			"explorerFoot": "y5tTyq_explorerFoot",
			"explorerGlyph": "y5tTyq_explorerGlyph",
			"explorerGuide": "y5tTyq_explorerGuide",
			"explorerHead": "y5tTyq_explorerHead",
			"explorerIcon": "y5tTyq_explorerIcon",
			"explorerItem": "y5tTyq_explorerItem",
			"explorerName": "y5tTyq_explorerName",
			"explorerNote": "y5tTyq_explorerNote",
			"explorerNoteRow": "y5tTyq_explorerNoteRow",
			"explorerNoteText": "y5tTyq_explorerNoteText",
			"explorerParent": "y5tTyq_explorerParent",
			"explorerRetry": "y5tTyq_explorerRetry",
			"explorerRow": "y5tTyq_explorerRow",
			"explorerRowSelected": "y5tTyq_explorerRowSelected",
			"explorerRows": "y5tTyq_explorerRows",
			"explorerSize": "y5tTyq_explorerSize",
			"explorerSpin": "y5tTyq_explorerSpin",
			"explorerTitle": "y5tTyq_explorerTitle",
			"explorerTool": "y5tTyq_explorerTool",
			"explorerTools": "y5tTyq_explorerTools",
			"footHint": "y5tTyq_footHint",
			"headActions": "y5tTyq_headActions",
			"headGlyph": "y5tTyq_headGlyph",
			"headIdentity": "y5tTyq_headIdentity",
			"headText": "y5tTyq_headText",
			"iconOnly": "y5tTyq_iconOnly",
			"live": "y5tTyq_live",
			"liveDot": "y5tTyq_liveDot",
			"notice": "y5tTyq_notice",
			"noticeClose": "y5tTyq_noticeClose",
			"noticeError": "y5tTyq_noticeError",
			"noticeErrorText": "y5tTyq_noticeErrorText",
			"panelFoot": "y5tTyq_panelFoot",
			"panelHead": "y5tTyq_panelHead",
			"picker": "y5tTyq_picker",
			"pickerAddress": "y5tTyq_pickerAddress",
			"pickerAddressInput": "y5tTyq_pickerAddressInput",
			"pickerBar": "y5tTyq_pickerBar",
			"pickerContent": "y5tTyq_pickerContent",
			"pickerCreate": "y5tTyq_pickerCreate",
			"pickerCrumb": "y5tTyq_pickerCrumb",
			"pickerCrumbCell": "y5tTyq_pickerCrumbCell",
			"pickerCrumbCurrent": "y5tTyq_pickerCrumbCurrent",
			"pickerCrumbSep": "y5tTyq_pickerCrumbSep",
			"pickerCrumbs": "y5tTyq_pickerCrumbs",
			"pickerNote": "y5tTyq_pickerNote",
			"pickerNotice": "y5tTyq_pickerNotice",
			"pickerPath": "y5tTyq_pickerPath",
			"pickerRow": "y5tTyq_pickerRow",
			"pickerRows": "y5tTyq_pickerRows",
			"pickerToggle": "y5tTyq_pickerToggle",
			"pickerTool": "y5tTyq_pickerTool",
			"projects": "y5tTyq_projects",
			"reading": "y5tTyq_reading",
			"readingHint": "y5tTyq_readingHint",
			"readingLabel": "y5tTyq_readingLabel",
			"readingValue": "y5tTyq_readingValue",
			"readings": "y5tTyq_readings",
			"subtitle": "y5tTyq_subtitle",
			"title": "y5tTyq_title",
			"wbCompletedPulse": "y5tTyq_wbCompletedPulse",
			"wbPulse": "y5tTyq_wbPulse",
			"wbRingSpin": "y5tTyq_wbRingSpin",
			"wbSheenDrift": "y5tTyq_wbSheenDrift",
			"wbSpin": "y5tTyq_wbSpin",
			"workbench": "y5tTyq_workbench"
		};
		//#endregion
		//#region dsh-workbench/lib/types/client/WorkspaceDirectoryPicker.js
		/**
		* The in-app Workspace directory picker.
		*
		* A boot composes exactly one directory-picking interaction. When the Host
		* resolves the **browse** backend there is no OS chooser to drive, `pick` is
		* refused by design, and the browsing primitives (`listDirectory`,
		* `createDirectory`) are the only route from "the operator wants a directory"
		* to an absolute path. This dialog is that route: the same level-by-level
		* browsing the official dialog performs, drawn as the workbench's own modal.
		*
		* It is deliberately not the official dialog: that one is the occupant of
		* ui-workspace's `*.directoryFlow` holes (a `single` slot each, already filled
		* by the composed picker surface) and it is opened by the sidebar and
		* conversation menus' owner-local state. There is no service to raise it from
		* another plugin, so a panel that wants an add action under the browse backend
		* has to bring its own.
		*
		* The address bar is where this dialog earns its keep: the path is an editable
		* field, so a directory can be **typed or pasted** — from Explorer, from a
		* terminal, from a card's own path line — and confirmed with Enter, the way the
		* OS dialog's address bar works. Browsing stays for everything else.
		*/
		/**
		* Render the picker dialog.
		* @param props - the browse face, the copy, and the flow's outcomes.
		* @returns the modal element.
		*/
		function WorkspaceDirectoryPicker({ open, t, browseDirectory, makeDirectory, onPicked, onCancel }) {
			const [level, setLevel] = (0, react.useState)({ state: "loading" });
			const [showHidden, setShowHidden] = (0, react.useState)(false);
			const [creating, setCreating] = (0, react.useState)(false);
			const [folderName, setFolderName] = (0, react.useState)("");
			const [notice, setNotice] = (0, react.useState)(void 0);
			const [address, setAddress] = (0, react.useState)("");
			const controller = (0, react.useRef)(void 0);
			const alive = (0, react.useRef)(true);
			(0, react.useEffect)(() => {
				alive.current = true;
				return () => {
					alive.current = false;
					controller.current?.abort();
				};
			}, []);
			/**
			* Show one level; an absent path asks the Host for its home directory, which
			* is also how the dialog opens.
			* @param path - the directory to show, or undefined for Home.
			*/
			const show = (0, react.useCallback)((path) => {
				controller.current?.abort();
				const next = new AbortController();
				controller.current = next;
				setLevel({ state: "loading" });
				setNotice(void 0);
				setAddress(path ?? "");
				browseDirectory(path, next.signal).then((outcome) => {
					if (!alive.current || next.signal.aborted) return;
					setLevel(outcome.ok ? {
						state: "ready",
						listing: outcome.value
					} : {
						state: "failed",
						message: outcome.message
					});
					if (outcome.ok) setAddress(outcome.value.path);
				});
			}, [browseDirectory]);
			(0, react.useEffect)(() => {
				if (!open) {
					controller.current?.abort();
					return;
				}
				setCreating(false);
				setFolderName("");
				setShowHidden(false);
				show(void 0);
				return () => {
					controller.current?.abort();
				};
			}, [open, show]);
			const listing = level.state === "ready" ? level.listing : void 0;
			const crumbs = (0, react.useMemo)(() => listing === void 0 ? [] : pickerCrumbs(listing), [listing]);
			const rows = (0, react.useMemo)(() => listing === void 0 ? [] : pickerEntries(listing, showHidden), [listing, showHidden]);
			const parent = (0, react.useMemo)(() => listing === void 0 ? void 0 : parentPathOf(listing.path), [listing]);
			/**
			* Go to whatever the address bar holds.
			*
			* A typed path is not validated here: the browse primitive is the only thing
			* that knows what exists, and it answers a structured failure that lands in
			* this dialog's own notice line.
			* @param path - the typed or pasted path.
			*/
			const go = (path) => {
				const wanted = path.trim();
				if (wanted === "") return;
				show(wanted);
			};
			/** Create a folder in the listed level, then move into it. */
			const create = () => {
				if (listing === void 0) return;
				const name = folderName.trim() === "" ? t("picker.untitledFolder") : folderName.trim();
				setNotice(void 0);
				makeDirectory(listing.path, name).then((outcome) => {
					if (!alive.current) return;
					if (!outcome.ok) {
						setNotice(outcome.message);
						return;
					}
					setCreating(false);
					setFolderName("");
					show(outcome.path);
				});
			};
			return (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open,
				onClose: onCancel,
				title: t("picker.title"),
				closeLabel: t("picker.cancel"),
				className: Workbench_module_css_default.picker ?? "",
				contentClassName: Workbench_module_css_default.pickerContent ?? "",
				footer: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					size: "sm",
					onClick: onCancel,
					children: t("picker.cancel")
				}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "primary",
					size: "sm",
					disabled: listing === void 0 || creating,
					onClick: () => {
						if (listing !== void 0) onPicked(listing.path);
					},
					children: t("picker.choose")
				})] }),
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: Workbench_module_css_default.pickerAddress,
						children: [
							(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
								className: Workbench_module_css_default.pickerAddressInput ?? "",
								value: address,
								spellCheck: false,
								"aria-label": t("picker.path"),
								placeholder: t("picker.pathPlaceholder"),
								onChange: (event) => {
									setAddress(event.target.value);
								},
								onKeyDown: (event) => {
									if (event.key === "Enter") go(address);
									if (event.key === "Escape") setAddress(listing?.path ?? "");
								}
							}),
							(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								size: "sm",
								onClick: () => {
									go(address);
								},
								children: t("picker.go")
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: Workbench_module_css_default.pickerTool,
								"aria-label": t("picker.up"),
								title: t("picker.up"),
								disabled: parent === void 0,
								onClick: () => {
									if (parent !== void 0) show(parent);
								},
								children: "↑"
							})
						]
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: Workbench_module_css_default.pickerCrumbs,
						children: crumbs.map((crumb, index) => (0, react_jsx_runtime.jsxs)("span", {
							className: Workbench_module_css_default.pickerCrumbCell,
							children: [index > 0 && (0, react_jsx_runtime.jsx)("span", {
								className: Workbench_module_css_default.pickerCrumbSep,
								"aria-hidden": "true",
								children: "›"
							}), (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: `${Workbench_module_css_default.pickerCrumb} ${index === crumbs.length - 1 ? Workbench_module_css_default.pickerCrumbCurrent : ""}`,
								title: crumb.path,
								onClick: () => {
									show(crumb.path);
								},
								children: crumb.home ? t("picker.home") : crumb.name
							})]
						}, crumb.path))
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: Workbench_module_css_default.pickerBar,
						children: [
							(0, react_jsx_runtime.jsxs)("label", {
								className: Workbench_module_css_default.pickerToggle,
								children: [(0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: showHidden,
									onChange: (event) => {
										setShowHidden(event.target.checked);
									}
								}), t("picker.showHidden")]
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: Workbench_module_css_default.pickerTool,
								"aria-label": t("picker.reload"),
								title: t("picker.reload"),
								onClick: () => {
									show(listing?.path);
								},
								children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutline16, { size: 13 })
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: Workbench_module_css_default.pickerTool,
								"aria-label": t("picker.newFolder"),
								title: t("picker.newFolder"),
								disabled: listing === void 0,
								onClick: () => {
									setCreating(true);
									setNotice(void 0);
								},
								children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutline16, { size: 13 })
							})
						]
					}),
					creating && (0, react_jsx_runtime.jsxs)("div", {
						className: Workbench_module_css_default.pickerCreate,
						children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
							autoFocus: true,
							value: folderName,
							placeholder: t("picker.folderName"),
							"aria-label": t("picker.folderName"),
							onChange: (event) => {
								setFolderName(event.target.value);
							},
							onKeyDown: (event) => {
								if (event.key === "Enter") create();
								if (event.key === "Escape") {
									setCreating(false);
									setFolderName("");
								}
							}
						}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							size: "sm",
							onClick: create,
							children: t("picker.create")
						})]
					}),
					notice !== void 0 && (0, react_jsx_runtime.jsx)("p", {
						className: Workbench_module_css_default.pickerNotice,
						role: "alert",
						children: notice
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: Workbench_module_css_default.pickerRows,
						role: "listbox",
						"aria-label": t("picker.title"),
						children: [
							level.state === "loading" && (0, react_jsx_runtime.jsxs)("p", {
								className: Workbench_module_css_default.pickerNote,
								children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconLoadingOutline16, {
									size: 13,
									className: Workbench_module_css_default.explorerSpin
								}), t("picker.loading")]
							}),
							level.state === "failed" && (0, react_jsx_runtime.jsxs)("p", {
								className: Workbench_module_css_default.pickerNote,
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: Workbench_module_css_default.explorerErrorText,
									children: level.message
								}), (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: Workbench_module_css_default.explorerRetry,
									onClick: () => {
										show(listing?.path);
									},
									children: t("tree.retry")
								})]
							}),
							level.state === "ready" && rows.length === 0 && (0, react_jsx_runtime.jsx)("p", {
								className: Workbench_module_css_default.pickerNote,
								children: t("picker.empty")
							}),
							rows.map((row) => (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: Workbench_module_css_default.pickerRow,
								title: row.path,
								onClick: () => {
									show(row.path);
								},
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: Workbench_module_css_default.explorerIcon,
									"aria-hidden": "true",
									children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderClose16, { size: 15 })
								}), (0, react_jsx_runtime.jsx)("span", {
									className: Workbench_module_css_default.explorerName,
									children: row.name
								})]
							}, row.path)),
							listing?.truncated === true && (0, react_jsx_runtime.jsx)("p", {
								className: Workbench_module_css_default.pickerNote,
								children: t("picker.truncated")
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region dsh-workbench/lib/types/client/Workbench.js
		/**
		* Workbench main panel: the control room as a first-class application panel.
		*
		* This is the shape the app gives a workspace — a selectable surface that takes
		* the center column — rather than a floating overlay. The panel registers under
		* the `main` key `workbench`, and `sidebar.panellist` draws its row in the
		* global panel list, so the workbench toggles like every other panel and never
		* covers the conversation.
		*
		* A card is a Host Workspace, read through the global `useWorkspaces` hook, so
		* the grid mirrors the registry: adding a Workspace anywhere adds a card,
		* removing one removes it, and the workbench keeps no roster of its own. The
		* empty plus card drives the same directory-picking flow the sidebar's own
		* "Add workspace…" entry uses, so both routes end in one Host create call.
		*
		* A card's Files face is a VS Code-shaped explorer: one flat row list carrying
		* per-row depth, indent guides, rotating chevrons, folder and file-type glyphs,
		* the reader's selection, and arrow-key traversal. A level is listed when its
		* directory is first expanded and never for the whole tree at once.
		*/
		/**
		* The file explorer: the workspace root and whatever the reader has opened
		* under it, as one flat VS Code-shaped list.
		*
		* State is the reader's alone — which levels are listed, which directories are
		* expanded, and which row is selected. Every listing goes out through the
		* injected `listDirectory`, which resolves the Remote namespace per call, so a
		* level asked for before that namespace mounts reports a failed level with a
		* retry rather than losing the whole face. Each level's request is aborted when
		* it is superseded, when its directory collapses, or when the card unmounts.
		*
		* Gestures follow the editor too: one click selects, a directory's click also
		* opens it, and a file opens on double click (or Enter) into the right column.
		* @param props - the root to browse, its Session, the copy, and the two faces.
		* @returns the explorer element.
		*/
		function FileExplorer({ root, sessionId, t, listDirectory, available, onOpenFile }) {
			const [levels, setLevels] = (0, react.useState)(() => /* @__PURE__ */ new Map());
			const [expanded, setExpanded] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			const [selected, setSelected] = (0, react.useState)(void 0);
			const listRef = (0, react.useRef)(null);
			const controllers = (0, react.useRef)(/* @__PURE__ */ new Map());
			const alive = (0, react.useRef)(true);
			(0, react.useEffect)(() => {
				alive.current = true;
				const pending = controllers.current;
				return () => {
					alive.current = false;
					for (const controller of pending.values()) controller.abort();
					pending.clear();
				};
			}, []);
			const load = (0, react.useCallback)((path) => {
				if (sessionId === void 0) return;
				controllers.current.get(path)?.abort();
				const controller = new AbortController();
				controllers.current.set(path, controller);
				setLevels((current) => new Map(current).set(path, {
					status: "loading",
					entries: [],
					truncated: false
				}));
				listDirectory(sessionId, path, controller.signal).then((result) => {
					if (!alive.current || controller.signal.aborted) return;
					controllers.current.delete(path);
					setLevels((current) => new Map(current).set(path, result.value));
				}).catch(() => {
					if (!alive.current || controller.signal.aborted) return;
					controllers.current.delete(path);
					setLevels((current) => new Map(current).set(path, {
						status: "error",
						entries: [],
						truncated: false,
						error: t("tree.error.other")
					}));
				});
			}, [
				listDirectory,
				sessionId,
				t
			]);
			(0, react.useEffect)(() => {
				setLevels(/* @__PURE__ */ new Map());
				setExpanded(/* @__PURE__ */ new Set());
				setSelected(void 0);
				for (const controller of controllers.current.values()) controller.abort();
				controllers.current.clear();
				load(root);
			}, [load, root]);
			const rows = (0, react.useMemo)(() => explorerRows(root, levels, expanded), [
				root,
				levels,
				expanded
			]);
			const { indexes, entryRows } = (0, react.useMemo)(() => {
				const map = /* @__PURE__ */ new Map();
				const entries = [];
				for (const row of rows) {
					if (row.kind !== "entry") continue;
					map.set(row.path, entries.length);
					entries.push(row);
				}
				return {
					indexes: map,
					entryRows: entries
				};
			}, [rows]);
			const rowCount = entryRows.length;
			const toggle = (0, react.useCallback)((row) => {
				setSelected(row.path);
				if (row.type !== "directory") return;
				setExpanded((current) => {
					const next = new Set(current);
					if (next.has(row.path)) next.delete(row.path);
					else next.add(row.path);
					return next;
				});
				if (!row.expanded && !levels.has(row.path)) load(row.path);
			}, [levels, load]);
			/** Drop every listed level and ask again for the reader's open directories. */
			const reload = (0, react.useCallback)(() => {
				const open = [...expanded];
				setLevels(/* @__PURE__ */ new Map());
				for (const path of open) load(path);
				load(root);
			}, [
				expanded,
				load,
				root
			]);
			const focusRow = (index) => {
				(listRef.current?.querySelector(`[data-explorer-index="${index}"]`))?.focus();
			};
			/**
			* VS Code's traversal: up and down move the selection, right opens a
			* directory or steps into it, left closes it or steps out to its parent, and
			* Enter opens a file the way a double click does.
			* @param event - the row's key event.
			* @param index - the row's position among the focusable rows.
			* @param row - the row itself.
			*/
			const onKeyDown = (event, index, row) => {
				switch (event.key) {
					case "Enter":
						if (row.type === "file") {
							onOpenFile(row.path);
							break;
						}
						return;
					case "ArrowDown":
						focusRow(Math.min(index + 1, rowCount - 1));
						break;
					case "ArrowUp":
						focusRow(Math.max(index - 1, 0));
						break;
					case "Home":
						focusRow(0);
						break;
					case "End":
						focusRow(rowCount - 1);
						break;
					case "ArrowRight":
						if (row.type === "directory" && !row.expanded) toggle(row);
						else if (row.type === "directory") focusRow(index + 1);
						else return;
						break;
					case "ArrowLeft":
						if (row.type === "directory" && row.expanded) {
							toggle(row);
							break;
						}
						for (let back = index - 1; back >= 0; back -= 1) {
							const candidate = entryRows[back];
							if (candidate !== void 0 && candidate.depth === row.depth - 1) {
								focusRow(back);
								break;
							}
						}
						break;
					default: return;
				}
				event.preventDefault();
			};
			const { directory, name } = splitPath(root);
			if (sessionId === void 0) return (0, react_jsx_runtime.jsx)("div", {
				className: Workbench_module_css_default.explorer,
				children: (0, react_jsx_runtime.jsx)("p", {
					className: Workbench_module_css_default.explorerNote,
					"data-explorer-state": "no-session",
					children: t("tree.noSession")
				})
			});
			if (!available) return (0, react_jsx_runtime.jsx)("div", {
				className: Workbench_module_css_default.explorer,
				children: (0, react_jsx_runtime.jsx)("p", {
					className: Workbench_module_css_default.explorerNote,
					"data-explorer-state": "unavailable",
					children: t("tree.unavailable")
				})
			});
			return (0, react_jsx_runtime.jsxs)("div", {
				className: Workbench_module_css_default.explorer,
				"data-explorer-root": root,
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: Workbench_module_css_default.explorerHead,
						children: [
							(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, {
								size: 12,
								className: Workbench_module_css_default.explorerCaret
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: Workbench_module_css_default.explorerTitle,
								title: root,
								children: name.toUpperCase()
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: Workbench_module_css_default.explorerParent,
								title: root,
								children: directory
							}),
							(0, react_jsx_runtime.jsxs)("span", {
								className: Workbench_module_css_default.explorerTools,
								children: [(0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: Workbench_module_css_default.explorerTool,
									"aria-label": t("tree.collapseAll"),
									title: t("tree.collapseAll"),
									disabled: expanded.size === 0,
									onClick: () => {
										setExpanded(/* @__PURE__ */ new Set());
									},
									children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronUpOutline14, { size: 13 })
								}), (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: Workbench_module_css_default.explorerTool,
									"aria-label": t("tree.reload"),
									title: t("tree.reload"),
									onClick: reload,
									children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutline16, { size: 13 })
								})]
							})
						]
					}),
					(0, react_jsx_runtime.jsx)("ul", {
						className: Workbench_module_css_default.explorerRows,
						ref: listRef,
						role: "tree",
						"aria-label": name,
						children: rows.map((row) => row.kind === "entry" ? (0, react_jsx_runtime.jsx)(ExplorerEntryRow, {
							row,
							index: indexes.get(row.path) ?? 0,
							selected: selected === row.path,
							t,
							onSelect: toggle,
							onOpenFile,
							onKeyDown
						}, row.path) : (0, react_jsx_runtime.jsx)(ExplorerNoteRow, {
							row,
							t,
							onRetry: reload
						}, `${row.note}:${row.path}`))
					}),
					(0, react_jsx_runtime.jsx)("p", {
						className: Workbench_module_css_default.explorerFoot,
						children: t("tree.hint")
					})
				]
			});
		}
		/** One entry row: guides, chevron, glyph, name, and the size of a file. */
		function ExplorerEntryRow({ row, index, selected, t, onSelect, onOpenFile, onKeyDown }) {
			return (0, react_jsx_runtime.jsx)("li", {
				className: Workbench_module_css_default.explorerItem,
				role: "treeitem",
				"aria-expanded": row.type === "directory" ? row.expanded : void 0,
				children: (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: `${Workbench_module_css_default.explorerRow} ${selected ? Workbench_module_css_default.explorerRowSelected : ""}`,
					"data-explorer-index": index,
					"data-explorer-kind": row.type,
					title: row.type === "file" ? `${row.path}\n${t("file.open")}` : row.path,
					onClick: () => {
						onSelect(row);
					},
					onDoubleClick: () => {
						if (row.type === "file") onOpenFile(row.path);
					},
					onKeyDown: (event) => {
						onKeyDown(event, index, row);
					},
					children: [
						Array.from({ length: row.depth }, (_, level) => (0, react_jsx_runtime.jsx)("span", {
							className: Workbench_module_css_default.explorerGuide,
							"aria-hidden": "true"
						}, level)),
						(0, react_jsx_runtime.jsx)("span", {
							className: Workbench_module_css_default.explorerGlyph,
							"aria-hidden": "true",
							children: row.type === "directory" ? row.expanded ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, { size: 12 }) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutline14, { size: 12 }) : null
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: Workbench_module_css_default.explorerIcon,
							"aria-hidden": "true",
							children: row.type === "directory" ? row.expanded ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpen16, { size: 15 }) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderClose16, { size: 15 }) : row.type === "file" ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FileTypeIcon, {
								path: row.name,
								size: 15
							}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutline16, { size: 13 })
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: Workbench_module_css_default.explorerName,
							children: row.name
						}),
						row.type === "file" && (0, react_jsx_runtime.jsx)("span", {
							className: Workbench_module_css_default.explorerSize,
							children: sizeText(row.size)
						})
					]
				})
			});
		}
		/** One note row: why a level has nothing to show, and how to ask again. */
		function ExplorerNoteRow({ row, t, onRetry }) {
			const indent = Array.from({ length: row.depth }, (_, level) => (0, react_jsx_runtime.jsx)("span", {
				className: Workbench_module_css_default.explorerGuide,
				"aria-hidden": "true"
			}, level));
			if (row.note === "failed") return (0, react_jsx_runtime.jsx)("li", {
				className: Workbench_module_css_default.explorerItem,
				"data-explorer-note": "failed",
				children: (0, react_jsx_runtime.jsxs)("span", {
					className: Workbench_module_css_default.explorerNoteRow,
					children: [
						indent,
						(0, react_jsx_runtime.jsx)("span", {
							className: Workbench_module_css_default.explorerErrorText,
							children: row.error ?? ""
						}),
						(0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: Workbench_module_css_default.explorerRetry,
							onClick: onRetry,
							children: t("tree.retry")
						})
					]
				})
			});
			return (0, react_jsx_runtime.jsx)("li", {
				className: Workbench_module_css_default.explorerItem,
				"data-explorer-note": row.note,
				children: (0, react_jsx_runtime.jsxs)("span", {
					className: Workbench_module_css_default.explorerNoteRow,
					children: [
						indent,
						row.note === "loading" && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconLoadingOutline16, {
							size: 13,
							className: Workbench_module_css_default.explorerSpin
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: Workbench_module_css_default.explorerNoteText,
							children: row.note === "loading" ? t("tree.loading") : row.note === "empty" ? t("tree.empty") : t("tree.truncated")
						})
					]
				})
			});
		}
		/** `HH:MM` of an ISO instant, or the raw value when it does not parse. */
		function shortTime(iso) {
			const at = new Date(iso);
			if (Number.isNaN(at.getTime())) return iso;
			return `${at.getHours().toString().padStart(2, "0")}:${at.getMinutes().toString().padStart(2, "0")}`;
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
		function workspaceItems(snapshot) {
			return snapshot?.items ?? [];
		}
		/**
		* Selector hook over an empty Workspace snapshot.
		*
		* The panel calls its snapshot hook unconditionally (a Hook cannot be skipped),
		* so when the composition provides none this standby answers the empty grid
		* instead of throwing.
		*/
		const NO_WORKSPACES = ((selector) => selector({
			items: [],
			archivedSessionIds: []
		}));
		/**
		* One Workspace card: its identity button, the Workspace path, and a file
		* explorer rooted at that path.
		*
		* The explorer browses the Workspace's own path through the first Session
		* accounted to it, because the Host confines a listing to that Session's
		* workspace root, and a file opens in the right column the way the official
		* file tree opens it. Which controls appear is the capability snapshot's call,
		* not this card's: an action whose service is not mounted is drawn disabled
		* rather than missing, so the card never changes shape as services come and go.
		* @param props - the Workspace, its order index, the capabilities, and the faces.
		* @returns the card element.
		*/
		function WorkspaceCard({ workspace, index, t, capability, listDirectory, onOpen, onRemove, onOpenFile }) {
			const accent = accentFor(index);
			const sessionId = workspace.sessionIds[0];
			const [status, setStatus] = (0, react.useState)("idle");
			const [acknowledged, setAcknowledged] = (0, react.useState)(false);
			/** Drive the card from idle → running → completed, falling back to idle on a rejection. */
			const handleOpen = (0, react.useCallback)(async () => {
				setStatus("running");
				setAcknowledged(false);
				try {
					await onOpen();
					setStatus("completed");
				} catch {
					setStatus("idle");
				}
			}, [onOpen]);
			/**
			* One click anywhere on the card acknowledges a completed card: the green
			* pulse settles down to its idle ring once the operator has seen it. Internal
			* controls stopPropagation so a click on the open/remove button stays its
			* own gesture and does not also acknowledge the card.
			*/
			const onCardClick = (0, react.useCallback)(() => {
				if (status === "completed" && !acknowledged) setAcknowledged(true);
			}, [status, acknowledged]);
			return (0, react_jsx_runtime.jsxs)("article", {
				className: `${Workbench_module_css_default.card} ${Workbench_module_css_default[`accent_${accent}`] ?? ""} ${Workbench_module_css_default.cardFiles}`,
				"data-card-status": status,
				"data-card-acknowledged": acknowledged ? "true" : "false",
				onClick: onCardClick,
				children: [
					(0, react_jsx_runtime.jsxs)("header", {
						className: Workbench_module_css_default.cardHead,
						children: [(0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: Workbench_module_css_default.cardOpen,
							disabled: !capability.navigation,
							title: `${t("card.activate")} — ${workspace.path}`,
							onClick: (event) => {
								event.stopPropagation();
								handleOpen();
							},
							children: [(0, react_jsx_runtime.jsx)("span", {
								className: Workbench_module_css_default.cardGlyph,
								"aria-hidden": "true",
								children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderClose16, { size: 16 })
							}), (0, react_jsx_runtime.jsx)("span", {
								className: Workbench_module_css_default.cardTitle,
								children: workspace.title
							})]
						}), capability.workspaces && (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: Workbench_module_css_default.iconOnly,
							"aria-label": t("card.remove"),
							title: `${t("card.remove")} — ${t("card.remove.hint")}`,
							onClick: (event) => {
								event.stopPropagation();
								onRemove();
							},
							children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutline16, { size: 14 })
						})]
					}),
					(0, react_jsx_runtime.jsx)("p", {
						className: Workbench_module_css_default.cardPath,
						title: workspace.path,
						children: workspace.path
					}),
					(0, react_jsx_runtime.jsx)(FileExplorer, {
						root: workspace.path,
						sessionId,
						t,
						listDirectory,
						available: capability.files,
						onOpenFile: (path) => {
							onOpenFile(path);
						}
					}),
					(0, react_jsx_runtime.jsxs)("footer", {
						className: Workbench_module_css_default.cardFoot,
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: Workbench_module_css_default.cardStatus,
							"data-card-state": status,
							children: status === "running" ? t("card.state.running") : status === "completed" ? t("card.state.completed") : t("card.state.idle")
						}), (0, react_jsx_runtime.jsxs)("span", {
							className: Workbench_module_css_default.cardUpdated,
							children: [
								t("card.updated"),
								" ",
								shortTime(workspace.updatedAt)
							]
						})]
					})
				]
			});
		}
		/**
		* Render the control room as the `workbench` main panel.
		* @param props - the `main` runtime share (carrying `useWorkspaces`) plus this plugin's face.
		* @returns the panel element.
		*/
		function WorkbenchPanel({ wt: t, pickWorkspace, registerWorkspace, browseDirectory, makeDirectory, openFile, selectSession, showConversation, openWorkspace, removeWorkspace, listDirectory, useWorkspaces, useCapability, useScheme }) {
			const [adding, setAdding] = (0, react.useState)(false);
			const [picking, setPicking] = (0, react.useState)(false);
			const dark = useScheme((darkPalette) => darkPalette);
			const [error, setError] = (0, react.useState)(void 0);
			const [now, setNow] = (0, react.useState)(() => /* @__PURE__ */ new Date());
			const workspaces = workspaceItems((useWorkspaces ?? NO_WORKSPACES)((state) => state));
			const capability = useCapability((state) => state);
			const canAdd = capability.workspaces && (capability.picker || capability.navigation);
			(0, react.useEffect)(() => {
				const timer = window.setInterval(() => {
					setNow(/* @__PURE__ */ new Date());
				}, 1e3);
				return () => {
					window.clearInterval(timer);
				};
			}, []);
			(0, react.useEffect)(() => {
				const root = document.documentElement;
				const previous = root.getAttribute("data-wb-scheme");
				root.setAttribute("data-wb-scheme", dark ? "dark" : "light");
				return () => {
					if (previous === null) root.removeAttribute("data-wb-scheme");
					else root.setAttribute("data-wb-scheme", previous);
				};
			}, [dark]);
			/**
			* Act on one add outcome. Failures are shown, never swallowed: a picker that
			* refuses and a Host that rejects both used to leave the button looking dead.
			* @param outcome - what the flow reported.
			*/
			const settle = (0, react.useCallback)((outcome) => {
				switch (outcome.kind) {
					case "browse":
						setPicking(true);
						break;
					case "failed":
						setError({
							label: t("notice.addFailed"),
							message: outcome.message
						});
						break;
					default: break;
				}
			}, [t]);
			const onAdd = (0, react.useCallback)(() => {
				if (!canAdd) return;
				setError(void 0);
				setAdding(true);
				pickWorkspace().then(settle).finally(() => {
					setAdding(false);
				});
			}, [
				canAdd,
				pickWorkspace,
				settle
			]);
			/** Adopt the directory the in-app picker confirmed. */
			const onPicked = (0, react.useCallback)((path) => {
				setPicking(false);
				setAdding(true);
				registerWorkspace(path).then(settle).finally(() => {
					setAdding(false);
				});
			}, [registerWorkspace, settle]);
			/**
			* Show one file of one card in the right column.
			*
			* The right column is not merely session content: `ui-sidebar-right` mounts
			* its session seat **only while the Conversation is the selected main panel**
			* (`RightbarRoot` returns null for any global panel). The workbench *is* a
			* global panel, so the file cannot go anywhere until the column is handed
			* over: the first refusal selects this Workspace's own session, selects the
			* Conversation, and then polls, because the seat appears one render later and
			* the session may still be loading.
			* @param workspace - the card the file belongs to.
			* @param path - the file's absolute path.
			*/
			const openCardFile = (0, react.useCallback)((workspace, path) => {
				const sessionId = workspace.sessionIds[0];
				if (sessionId === void 0) {
					setError({
						label: t("notice.openFailed"),
						message: t("file.noSession")
					});
					return;
				}
				const attempt = (tries) => {
					const outcome = openFile(sessionId, path);
					if (outcome.ok) {
						setError(void 0);
						return;
					}
					if (outcome.code !== "pane/no-session") {
						setError({
							label: t("notice.openFailed"),
							message: outcome.message
						});
						return;
					}
					if (tries === 0) {
						if (!selectSession(sessionId)) openWorkspace(workspace.workspaceId);
						showConversation();
					}
					if (tries >= 25) {
						setError({
							label: t("notice.openFailed"),
							message: outcome.message
						});
						return;
					}
					window.setTimeout(() => {
						attempt(tries + 1);
					}, 200);
				};
				attempt(0);
			}, [
				openFile,
				openWorkspace,
				selectSession,
				showConversation,
				t
			]);
			const readings = (0, react.useMemo)(() => {
				const sessions = workspaces.reduce((total, workspace) => total + workspace.sessionIds.length, 0);
				const latest = workspaces.reduce((newest, workspace) => newest === void 0 || workspace.updatedAt > newest ? workspace.updatedAt : newest, void 0);
				const clock = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
				return [
					{
						id: "workspaces",
						label: t("metric.workspaces"),
						value: `${workspaces.length}`,
						hint: t("metric.workspaces.hint")
					},
					{
						id: "sessions",
						label: t("metric.sessions"),
						value: `${sessions}`,
						hint: t("metric.sessions.hint")
					},
					{
						id: "recent",
						label: t("metric.recent"),
						value: latest === void 0 ? "—" : shortTime(latest),
						hint: t("metric.recent.hint")
					},
					{
						id: "clock",
						label: t("metric.clock"),
						value: clock,
						hint: ""
					}
				];
			}, [
				workspaces,
				now,
				t
			]);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: Workbench_module_css_default.workbench,
				role: "region",
				"aria-label": t("title"),
				children: [
					(0, react_jsx_runtime.jsxs)("header", {
						className: Workbench_module_css_default.panelHead,
						children: [(0, react_jsx_runtime.jsxs)("div", {
							className: Workbench_module_css_default.headIdentity,
							children: [(0, react_jsx_runtime.jsx)("span", {
								className: Workbench_module_css_default.headGlyph,
								"aria-hidden": "true",
								children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconGaugeOutline16, { size: 18 })
							}), (0, react_jsx_runtime.jsxs)("div", {
								className: Workbench_module_css_default.headText,
								children: [(0, react_jsx_runtime.jsx)("h2", {
									className: Workbench_module_css_default.title,
									children: t("title")
								}), (0, react_jsx_runtime.jsx)("p", {
									className: Workbench_module_css_default.subtitle,
									children: t("subtitle")
								})]
							})]
						}), (0, react_jsx_runtime.jsxs)("div", {
							className: Workbench_module_css_default.headActions,
							children: [
								(0, react_jsx_runtime.jsxs)("span", {
									className: Workbench_module_css_default.live,
									children: [(0, react_jsx_runtime.jsx)("span", {
										className: Workbench_module_css_default.liveDot,
										"aria-hidden": "true"
									}), t("live")]
								}),
								(0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: Workbench_module_css_default.action,
									disabled: adding || !canAdd,
									onClick: onAdd,
									children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutline16, { size: 14 }), t("action.add")]
								}),
								(0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: Workbench_module_css_default.action,
									onClick: () => {
										setNow(/* @__PURE__ */ new Date());
									},
									children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutline16, { size: 14 }), t("action.refresh")]
								})
							]
						})]
					}),
					!canAdd && (0, react_jsx_runtime.jsx)("p", {
						className: Workbench_module_css_default.notice,
						children: t("notice.noWorkspaceService")
					}),
					error !== void 0 && (0, react_jsx_runtime.jsxs)("p", {
						className: Workbench_module_css_default.noticeError,
						role: "alert",
						children: [(0, react_jsx_runtime.jsxs)("span", {
							className: Workbench_module_css_default.noticeErrorText,
							children: [
								error.label,
								": ",
								error.message
							]
						}), (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: Workbench_module_css_default.noticeClose,
							"aria-label": t("notice.dismiss"),
							onClick: () => {
								setError(void 0);
							},
							children: "✕"
						})]
					}),
					(0, react_jsx_runtime.jsx)("section", {
						className: Workbench_module_css_default.readings,
						"aria-label": t("metrics.label"),
						children: readings.map((reading) => (0, react_jsx_runtime.jsxs)("div", {
							className: Workbench_module_css_default.reading,
							children: [
								(0, react_jsx_runtime.jsx)("span", {
									className: Workbench_module_css_default.readingLabel,
									children: reading.label
								}),
								(0, react_jsx_runtime.jsx)("span", {
									className: Workbench_module_css_default.readingValue,
									children: reading.value
								}),
								reading.hint !== "" && (0, react_jsx_runtime.jsx)("span", {
									className: Workbench_module_css_default.readingHint,
									children: reading.hint
								})
							]
						}, reading.id))
					}),
					(0, react_jsx_runtime.jsxs)("section", {
						className: Workbench_module_css_default.projects,
						"aria-label": t("projects.label"),
						children: [
							workspaces.length === 0 && (0, react_jsx_runtime.jsxs)("div", {
								className: Workbench_module_css_default.empty,
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: Workbench_module_css_default.emptyGlyph,
										"aria-hidden": "true",
										children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconGaugeOutline16, { size: 22 })
									}),
									(0, react_jsx_runtime.jsx)("p", {
										className: Workbench_module_css_default.emptyTitle,
										children: t("empty.title")
									}),
									(0, react_jsx_runtime.jsx)("p", {
										className: Workbench_module_css_default.emptyHint,
										children: t("empty.hint")
									})
								]
							}),
							workspaces.map((workspace, index) => (0, react_jsx_runtime.jsx)(WorkspaceCard, {
								workspace,
								index,
								t,
								capability,
								listDirectory,
								onOpen: () => openWorkspace(workspace.workspaceId),
								onRemove: () => {
									removeWorkspace(workspace.workspaceId);
								},
								onOpenFile: (path) => {
									openCardFile(workspace, path);
								}
							}, workspace.workspaceId)),
							(0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: Workbench_module_css_default.addCard,
								"aria-label": t("card.add"),
								disabled: adding || !canAdd,
								onClick: onAdd,
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: Workbench_module_css_default.addGlyph,
										"aria-hidden": "true",
										children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutline16, { size: 20 })
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: Workbench_module_css_default.addTitle,
										children: t("card.add")
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: Workbench_module_css_default.addHint,
										children: t("card.add.hint")
									})
								]
							})
						]
					}),
					(0, react_jsx_runtime.jsx)("footer", {
						className: Workbench_module_css_default.panelFoot,
						children: (0, react_jsx_runtime.jsx)("span", {
							className: Workbench_module_css_default.footHint,
							children: t("foot.hint")
						})
					}),
					(0, react_jsx_runtime.jsx)(WorkspaceDirectoryPicker, {
						open: picking,
						t,
						browseDirectory,
						makeDirectory,
						onPicked,
						onCancel: () => {
							setPicking(false);
						}
					})
				]
			});
		}
		/**
		* The sidebar panel-list glyph: one gauge, no interaction of its own.
		* @param props - the panel row's presentation share.
		* @returns the glyph.
		*/
		function WorkbenchPanelIcon({ size }) {
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconGaugeOutline16, { size });
		}
		//#endregion
		//#region dsh-workbench/lib/types/client/WorkbenchFileEditor.js
		/**
		* The workbench file editor: one right-column tab that shows a Workspace file
		* and, on request, writes it back.
		*
		* ## Why this is not the official viewer
		*
		* The official `text` tab type renders a file read-only on purpose. DSH's client
		* has no write verb (`remote.workspaceFiles` is read-only and `ctx.fs.writeText`
		* is a Host service), so an editable surface has to pair the official read
		* path with a write path this plugin contributes on the Host. That is what this
		* tab is: `POST /workbench/file/read` loads it, `POST /workbench/file/write`
		* saves it — atomically, only while the version it loaded is still current, and
		* under the composition's own sandbox policy.
		*
		* ## Shape
		*
		* A page tab (no resource pattern), because a page is opened by kind with
		* params and its address is this package's bookkeeping. Opening another file
		* navigates the same tab with new params, which is why the body keys its whole
		* state on `tab.navigation.revision`.
		*
		* Reading is deliberate about which side owns what: the text arrives with the
		* file's version token, edits live only in this tab, and Save is the single
		* moment anything reaches the disk. A file that changed underneath — an Agent
		* edit, another program — answers `workbench/stale`, and the editor offers a
		* reload instead of overwriting it.
		*/
		/** The page kind this tab type owns; `openTab` names it. */
		const EDITOR_KIND = "workbench-editor";
		/** This implementation's identity in the tab system, and the key its body registers under. */
		const EDITOR_ID = "dsh-workbench/editor";
		/** The tab type's registry definition: a page, opened by kind. */
		function editorDefinition(t) {
			return {
				id: EDITOR_ID,
				kind: EDITOR_KIND,
				priority: "extension",
				title: () => t("editor.title")
			};
		}
		/** The trailing path segment, for the tab title. */
		function baseName(path) {
			const cut = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
			return cut < 0 ? path : path.slice(cut + 1);
		}
		/**
		* The number of lines one text has, counting a trailing newline as ending the
		* last line rather than opening an empty one.
		* @param text - the file's text.
		* @returns the line count, at least 1.
		*/
		function lineCountOf(text) {
			let lines = 1;
			for (let index = 0; index < text.length; index += 1) if (text.charCodeAt(index) === 10) lines += 1;
			return lines;
		}
		/** The line-number gutter, one cell per line of the view. */
		function Gutter({ lines }) {
			return (0, react_jsx_runtime.jsx)("div", {
				className: Workbench_module_css_default.editorGutter,
				"aria-hidden": "true",
				children: Array.from({ length: lines }, (_, index) => (0, react_jsx_runtime.jsx)("span", {
					className: Workbench_module_css_default.editorLineNo,
					children: index + 1
				}, index))
			});
		}
		/**
		* Render the editor tab's body.
		* @param props - the tab runtime share and this plugin's injected face.
		* @returns the editor element.
		*/
		function FileEditorBody({ useTabInfo, wt: t, readFile, writeFile, openPreview }) {
			const { tab } = useTabInfo();
			const navigation = tab.navigation;
			const params = (0, react.useMemo)(() => {
				const raw = navigation.params;
				return typeof raw?.sessionId === "string" && typeof raw.path === "string" ? {
					sessionId: raw.sessionId,
					path: raw.path
				} : void 0;
			}, [navigation.params]);
			const [load, setLoad] = (0, react.useState)({ state: "loading" });
			const [draft, setDraft] = (0, react.useState)(void 0);
			const [saving, setSaving] = (0, react.useState)(false);
			const [notice, setNotice] = (0, react.useState)(void 0);
			const [saved, setSaved] = (0, react.useState)(false);
			const alive = (0, react.useRef)(true);
			const request = (0, react.useRef)(void 0);
			(0, react.useEffect)(() => {
				alive.current = true;
				return () => {
					alive.current = false;
					request.current?.abort();
				};
			}, []);
			/** Load (or reload) the file this tab was navigated to. */
			const reload = (0, react.useCallback)(() => {
				if (params === void 0) return;
				request.current?.abort();
				const controller = new AbortController();
				request.current = controller;
				setLoad({ state: "loading" });
				setDraft(void 0);
				setNotice(void 0);
				setSaved(false);
				readFile(params.sessionId, params.path).then((outcome) => {
					if (!alive.current || controller.signal.aborted) return;
					setLoad(outcome.ok ? {
						state: "ready",
						text: outcome.text,
						version: outcome.version,
						size: outcome.size
					} : {
						state: "failed",
						code: outcome.code,
						message: outcome.message
					});
				});
			}, [params, readFile]);
			(0, react.useEffect)(() => {
				reload();
			}, [reload, navigation.revision]);
			const text = load.state === "ready" ? load.text : "";
			const value = draft ?? text;
			const dirty = draft !== void 0 && draft !== text;
			const lines = (0, react.useMemo)(() => lineCountOf(value), [value]);
			/** Save the draft, guarded by the version this tab loaded. */
			const save = (0, react.useCallback)(() => {
				if (params === void 0 || load.state !== "ready" || draft === void 0) return;
				setSaving(true);
				setNotice(void 0);
				writeFile(params.sessionId, params.path, draft, load.version).then((outcome) => {
					if (!alive.current) return;
					setSaving(false);
					if (outcome.ok) {
						setLoad({
							state: "ready",
							text: draft,
							version: outcome.version,
							size: load.size
						});
						setDraft(void 0);
						setSaved(true);
						return;
					}
					setNotice(outcome.code === "workbench/stale" ? t("editor.stale") : `${t("editor.saveFailed")}: ${outcome.message}`);
				});
			}, [
				draft,
				load,
				params,
				t,
				writeFile
			]);
			if (params === void 0) return (0, react_jsx_runtime.jsx)("p", {
				className: Workbench_module_css_default.editorNote,
				children: t("editor.noTarget")
			});
			const name = baseName(params.path);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: Workbench_module_css_default.editor,
				"data-editor-state": load.state,
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: Workbench_module_css_default.editorHead,
						children: [
							(0, react_jsx_runtime.jsx)("span", {
								className: Workbench_module_css_default.editorName,
								title: params.path,
								children: name
							}),
							dirty && (0, react_jsx_runtime.jsx)("span", {
								className: Workbench_module_css_default.editorDirty,
								title: t("editor.dirty"),
								children: "●"
							}),
							(0, react_jsx_runtime.jsxs)("span", {
								className: Workbench_module_css_default.editorTools,
								children: [
									load.state === "ready" && (0, react_jsx_runtime.jsxs)("span", {
										className: Workbench_module_css_default.editorMeta,
										children: [
											lines,
											" ",
											t("editor.lines"),
											" · ",
											load.size,
											" B"
										]
									}),
									draft !== void 0 && (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: Workbench_module_css_default.pickerTool,
										"aria-label": t("editor.discard"),
										title: t("editor.discard"),
										onClick: () => {
											setDraft(void 0);
											setNotice(void 0);
										},
										children: "↺"
									}),
									(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: Workbench_module_css_default.pickerTool,
										"aria-label": t("editor.reload"),
										title: t("editor.reload"),
										onClick: reload,
										children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutline16, { size: 13 })
									}),
									(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: Workbench_module_css_default.pickerTool,
										"aria-label": t("editor.preview"),
										title: t("editor.preview"),
										onClick: () => {
											openPreview(params.sessionId, params.path);
										},
										children: "◱"
									})
								]
							})
						]
					}),
					notice !== void 0 && (0, react_jsx_runtime.jsx)("p", {
						className: Workbench_module_css_default.editorNotice,
						role: "alert",
						children: notice
					}),
					load.state === "loading" && (0, react_jsx_runtime.jsxs)("p", {
						className: Workbench_module_css_default.editorNote,
						children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconLoadingOutline16, {
							size: 13,
							className: Workbench_module_css_default.explorerSpin
						}), t("editor.loading")]
					}),
					load.state === "failed" && (0, react_jsx_runtime.jsxs)("div", {
						className: Workbench_module_css_default.editorNote,
						children: [(0, react_jsx_runtime.jsx)("p", {
							className: Workbench_module_css_default.editorFailed,
							children: load.message
						}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							size: "sm",
							onClick: () => {
								openPreview(params.sessionId, params.path);
							},
							children: t("editor.preview")
						})]
					}),
					load.state === "ready" && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsxs)("div", {
						className: Workbench_module_css_default.editorBody,
						children: [(0, react_jsx_runtime.jsx)(Gutter, { lines }), draft === void 0 ? (0, react_jsx_runtime.jsx)("pre", {
							className: Workbench_module_css_default.editorText,
							"data-editor-readonly": "",
							children: value
						}) : (0, react_jsx_runtime.jsx)("textarea", {
							className: Workbench_module_css_default.editorInput,
							value: draft,
							spellCheck: false,
							"aria-label": name,
							onChange: (event) => {
								setDraft(event.target.value);
								setSaved(false);
							},
							onKeyDown: (event) => {
								if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
									event.preventDefault();
									save();
								}
							}
						})]
					}), (0, react_jsx_runtime.jsxs)("div", {
						className: Workbench_module_css_default.editorFoot,
						children: [
							(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: draft === void 0 ? "outline" : "ghost",
								size: "sm",
								onClick: () => {
									setDraft(draft === void 0 ? text : void 0);
									setNotice(void 0);
									setSaved(false);
								},
								children: draft === void 0 ? t("editor.edit") : t("editor.cancel")
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: Workbench_module_css_default.editorHint,
								children: saved ? t("editor.saved") : t("editor.hint")
							}),
							(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "primary",
								size: "sm",
								disabled: draft === void 0 || saving || !dirty,
								onClick: save,
								children: t("editor.save")
							})
						]
					})] })
				]
			});
		}
		/**
		* Render the editor tab's chip title: the file's name.
		* @param props - the tab runtime share and this plugin's injected face.
		* @returns the title element.
		*/
		function FileEditorTitle({ useTabInfo, wt: t }) {
			const { tab } = useTabInfo();
			const raw = tab.navigation.params;
			const name = typeof raw?.path === "string" ? baseName(raw.path) : t("editor.title");
			return (0, react_jsx_runtime.jsx)("span", {
				className: Workbench_module_css_default.editorChip,
				title: name,
				children: name
			});
		}
		//#endregion
		//#region dsh-workbench/lib/types/client/locales.js
		/**
		* `workbench` namespace dictionaries: the Workspace-card control room.
		*
		* The workbench is the Workspace surface's extension, so its copy names
		* Workspaces rather than projects: a card is a Workspace, and the empty card
		* slot is how one gets added.
		*/
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"trigger": "工作台",
			"title": "控制室",
			"subtitle": "工作区工作台 · 每个工作区一张卡片",
			"live": "运行中",
			"metrics.label": "工作区读数",
			"metric.workspaces": "工作区",
			"metric.workspaces.hint": "已登记",
			"metric.sessions": "会话",
			"metric.sessions.hint": "全部工作区合计",
			"metric.recent": "最近更新",
			"metric.recent.hint": "本地时间",
			"metric.clock": "当前时间",
			"action.add": "添加工作区",
			"action.refresh": "刷新",
			"empty.title": "还没有工作区",
			"empty.hint": "用右侧的加号卡片添加一个工作区目录，它就会变成一张卡片。",
			"projects.label": "工作区卡片",
			"card.add": "添加工作区",
			"card.add.hint": "选择目录并登记为工作区",
			"card.updated": "更新于",
			"card.remove": "移除工作区",
			"card.remove.hint": "只移除登记，目录与会话日志保留",
			"card.state.idle": "空闲",
			"card.state.running": "运行中",
			"card.state.completed": "已完成",
			"card.activate": "打开这个工作区的对话",
			"file.open": "双击在对话视图右侧打开",
			"file.noPane": "当前组合没有右侧栏（ui-sidebar-right），文件内容没有地方显示。",
			"file.noSession": "这个工作区还没有会话，先新建一个会话才能在右侧打开文件。",
			"editor.title": "工作台编辑器",
			"editor.loading": "读取中…",
			"editor.noTarget": "这个标签没有带上要打开的文件。",
			"editor.lines": "行",
			"editor.edit": "编辑",
			"editor.cancel": "退出编辑",
			"editor.save": "保存",
			"editor.saved": "已保存",
			"editor.dirty": "有未保存的改动",
			"editor.discard": "放弃改动",
			"editor.reload": "重新读取",
			"editor.preview": "用官方预览打开（Markdown / 图片 / PDF）",
			"editor.hint": "Ctrl+S 保存；保存只在你读到的版本仍然是最新时才写入。",
			"editor.stale": "这个文件在别处被改过，保存已取消：先「重新读取」再改，避免覆盖别人的改动。",
			"editor.saveFailed": "保存失败",
			"tree.loading": "读取中…",
			"tree.empty": "空目录",
			"tree.truncated": "已截断，只显示前若干项",
			"tree.retry": "重试",
			"tree.reload": "重新读取",
			"tree.collapseAll": "全部折叠",
			"tree.hint": "点目录行展开或折叠，方向键上下移动；双击文件会在对话视图的右侧打开。",
			"tree.noSession": "该工作区还没有会话，先新建一个会话才能浏览文件。",
			"tree.unavailable": "文件能力（workspace-files）还没挂载上，暂时列不出目录。",
			"tree.error.other": "读不出这个目录。",
			"tree.error.outside": "该工作区的会话根目录在别处，Host 拒绝列出这个路径。",
			"tree.error.notFound": "这个目录已经不存在了。",
			"tree.error.notDirectory": "这个条目不是目录。",
			"notice.noWorkspaceService": "当前组合没有挂载工作区能力，卡片会是空的；装上工作区（ui-workspace 与 workspace 控制器）后这里会显示工作区。",
			"notice.addFailed": "添加工作区失败",
			"notice.openFailed": "打开文件失败",
			"notice.dismiss": "关闭提示",
			"picker.title": "添加工作区",
			"picker.path": "目录地址",
			"picker.pathPlaceholder": "输入或粘贴目录路径，回车前往",
			"picker.go": "前往",
			"picker.up": "上一层",
			"picker.home": "主目录",
			"picker.loading": "读取中…",
			"picker.empty": "这一层没有子目录",
			"picker.truncated": "目录过多，只显示开头部分",
			"picker.showHidden": "显示隐藏目录",
			"picker.newFolder": "新建文件夹",
			"picker.folderName": "文件夹名称",
			"picker.untitledFolder": "未命名文件夹",
			"picker.create": "创建",
			"picker.choose": "选择此目录",
			"picker.cancel": "取消",
			"picker.reload": "重新读取",
			"picker.unavailable": "当前组合既没有系统目录选择器，也没有目录浏览能力，无法选择目录。",
			"foot.hint": "卡片来自 Host 工作区注册表，新增/移除与侧边栏工作区同步。"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"trigger": "Workbench",
			"title": "Control Room",
			"subtitle": "Workspace workbench · one card per workspace",
			"live": "Live",
			"metrics.label": "Workspace readings",
			"metric.workspaces": "Workspaces",
			"metric.workspaces.hint": "registered",
			"metric.sessions": "Sessions",
			"metric.sessions.hint": "across all workspaces",
			"metric.recent": "Latest update",
			"metric.recent.hint": "local time",
			"metric.clock": "Current time",
			"action.add": "Add workspace",
			"action.refresh": "Refresh",
			"empty.title": "No workspaces yet",
			"empty.hint": "Use the plus card to add a workspace directory and it becomes a card.",
			"projects.label": "Workspace cards",
			"card.add": "Add workspace",
			"card.add.hint": "Pick a directory and register it",
			"card.updated": "Updated",
			"card.remove": "Remove workspace",
			"card.remove.hint": "Unregisters only; directory and session logs stay",
			"card.state.idle": "Idle",
			"card.state.running": "Running",
			"card.state.completed": "Completed",
			"card.activate": "Open this workspace's conversation",
			"file.open": "Double-click to open in the conversation's right column",
			"file.noPane": "This composition mounts no right column (ui-sidebar-right), so file content has nowhere to show.",
			"file.noSession": "This workspace has no session yet; start one to open files on the right.",
			"editor.title": "Workbench editor",
			"editor.loading": "Reading…",
			"editor.noTarget": "This tab carries no file to open.",
			"editor.lines": "lines",
			"editor.edit": "Edit",
			"editor.cancel": "Stop editing",
			"editor.save": "Save",
			"editor.saved": "Saved",
			"editor.dirty": "Unsaved changes",
			"editor.discard": "Discard changes",
			"editor.reload": "Reload",
			"editor.preview": "Open in the official viewer (Markdown / images / PDF)",
			"editor.hint": "Ctrl+S saves; the write happens only while the version you loaded is still current.",
			"editor.stale": "This file changed elsewhere, so the save was cancelled: reload first and reapply your edit instead of overwriting it.",
			"editor.saveFailed": "Save failed",
			"tree.loading": "Reading…",
			"tree.empty": "Empty directory",
			"tree.truncated": "Truncated to the entry cap",
			"tree.retry": "Retry",
			"tree.reload": "Reload",
			"tree.collapseAll": "Collapse all",
			"tree.hint": "Click a directory row to expand or collapse it, arrow keys to move; double-click a file to open it in the conversation's right column.",
			"tree.noSession": "This workspace has no session yet; start one to browse its files.",
			"tree.unavailable": "The file capability (workspace-files) is not mounted yet, so directories cannot be listed.",
			"tree.error.other": "That directory could not be read.",
			"tree.error.outside": "That Workspace session is rooted elsewhere, so the Host refused this path.",
			"tree.error.notFound": "That directory no longer exists.",
			"tree.error.notDirectory": "That entry is not a directory.",
			"notice.noWorkspaceService": "This composition mounts no Workspace capability, so the grid stays empty; mounting ui-workspace and the workspace controller fills it.",
			"notice.addFailed": "Could not add the workspace",
			"notice.openFailed": "Could not open the file",
			"notice.dismiss": "Dismiss",
			"picker.title": "Add workspace",
			"picker.path": "Directory address",
			"picker.pathPlaceholder": "Type or paste a directory path, then Enter",
			"picker.go": "Go",
			"picker.up": "Parent directory",
			"picker.home": "Home",
			"picker.loading": "Reading…",
			"picker.empty": "No subdirectories here",
			"picker.truncated": "Too many directories to list; only the beginning is shown",
			"picker.showHidden": "Show hidden directories",
			"picker.newFolder": "New folder",
			"picker.folderName": "Folder name",
			"picker.untitledFolder": "Untitled folder",
			"picker.create": "Create",
			"picker.choose": "Choose this directory",
			"picker.cancel": "Cancel",
			"picker.reload": "Reload",
			"picker.unavailable": "This composition mounts neither an OS directory chooser nor directory browsing, so no directory can be chosen.",
			"foot.hint": "Cards come from the Host Workspace registry, so add/remove stays in sync with the sidebar."
		};
		//#endregion
		//#region dsh-workbench/lib/types/client/index.js
		/** Dictionary namespace owned by this plugin. */
		const NS = "workbench";
		/** The `main` key this plugin occupies (also the panel-list row id). */
		const PANEL_ID = "workbench";
		/**
		* Required services.
		*
		* Deliberately minimal: the slot registry and the locale service are the only
		* ones the workbench cannot exist without.
		*/
		const inject = ["slots", "locale"];
		/** The two routes this plugin's Host half contributes. */
		const WORKBENCH_READ_ROUTE = "/workbench/file/read";
		const WORKBENCH_WRITE_ROUTE = "/workbench/file/write";
		/**
		* The optional services as the root registry answers right now.
		*
		* Read per call rather than captured: every one of them can be mounted after
		* this plugin's `apply`, and two of them are Remote namespaces that mount
		* asynchronously.
		* @param ctx - the client root context.
		* @param name - service name to resolve.
		* @returns the service, or undefined when this composition has not mounted it.
		*/
		function service(ctx, name) {
			return ctx.get(name);
		}
		/**
		* The `workspaceFiles` namespace, through whichever face carries it: the traced
		* `remote.<namespace>` child service, or the Remote assembly object.
		* @param ctx - the client root context.
		* @returns the namespace, or undefined when unmounted.
		*/
		function workspaceFiles(ctx) {
			const traced = service(ctx, "remote.workspaceFiles");
			if (traced !== void 0) return traced;
			return service(ctx, "remote")?.workspaceFiles;
		}
		/**
		* The `directoryPicker` namespace, resolved the same two ways as
		* {@link workspaceFiles}.
		* @param ctx - the client root context.
		* @returns the namespace, or undefined when unmounted.
		*/
		function directoryPicker(ctx) {
			const traced = service(ctx, "remote.directoryPicker");
			if (traced !== void 0) return traced;
			return service(ctx, "remote")?.directoryPicker;
		}
		/** One line for a rejection that crossed a service boundary. */
		function messageOf(error) {
			return error instanceof Error ? error.message : String(error);
		}
		/**
		* Classify one right-column rejection.
		*
		* `ui-sidebar-right` raises plain `Error`s, so the only signal is their text.
		* Of the two a file open can hit, the missing seat is the one a caller can
		* repair — put a session on screen — so it travels as a code instead of as a
		* line the reader cannot act on.
		* @param error - the rejection.
		* @returns the classification, empty when there is none.
		*/
		function paneCodeOf(error) {
			return messageOf(error).includes("no session surface is mounted") ? { code: "pane/no-session" } : {};
		}
		/**
		* Register the workbench's dictionaries, its sidebar panel row, and its main
		* panel body.
		* @param ctx - the client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-workbench: dictionaries");
			const workbenchT = ctx.locale.bind(NS);
			const capability = createCapabilityStore();
			const seed = {
				navigation: service(ctx, "uiWorkspace") !== void 0,
				workspaces: service(ctx, "workspaces") !== void 0,
				files: workspaceFiles(ctx) !== void 0,
				picker: directoryPicker(ctx) !== void 0,
				pane: service(ctx, "sidebarRight") !== void 0
			};
			capability.set(seed);
			/**
			* Report one optional service's presence for as long as it is mounted.
			* @param name - the service to watch.
			* @param on - the capability patch while it is mounted.
			* @param off - the capability patch once it unmounts.
			*/
			const watch = (name, on, off) => {
				ctx.inject([name], (scope) => {
					scope.effect(() => {
						capability.set(on);
						return () => {
							capability.set(off);
						};
					}, `dsh-workbench: ${name} capability`);
				});
			};
			watch("uiWorkspace", { navigation: true }, { navigation: false });
			watch("workspaces", { workspaces: true }, { workspaces: false });
			watch("remote.workspaceFiles", { files: true }, { files: false });
			watch("remote.directoryPicker", { picker: true }, { picker: false });
			watch("sidebarRight", { pane: true }, { pane: false });
			const scheme = createValueStore(service(ctx, "theme")?.getTheme().active.colorScheme === "dark");
			ctx.effect(() => {
				const off = ctx.on("theme/change", (snapshot) => {
					scheme.set(snapshot.active.colorScheme === "dark");
				});
				return () => {
					off();
				};
			}, "dsh-workbench: color scheme");
			/**
			* Register one absolute directory as a Workspace.
			*
			* The single adoption step: both adding routes (the OS chooser and the in-app
			* picker) end here, so a failure is reported once, in one place.
			* @param path - absolute host directory the operator picked.
			* @returns what the panel should show about it.
			*/
			const registerWorkspace = async (path) => {
				const registry = service(ctx, "workspaces");
				if (registry === void 0) return {
					kind: "failed",
					message: workbenchT("notice.noWorkspaceService")
				};
				try {
					await registry.create({ path });
					return {
						kind: "created",
						path
					};
				} catch (error) {
					return {
						kind: "failed",
						message: messageOf(error)
					};
				}
			};
			/**
			* Try the Host's OS chooser, and say what the panel should do when it cannot
			* serve one. See {@link pickStep} for why a refusal means "browse in-app".
			* @returns what the panel should show, or `browse` to open the in-app picker.
			*/
			const pickWorkspace = async () => {
				if (service(ctx, "workspaces") === void 0) return {
					kind: "failed",
					message: workbenchT("notice.noWorkspaceService")
				};
				const picker = directoryPicker(ctx);
				if (picker === void 0) return { kind: "browse" };
				let reply;
				try {
					reply = await picker.pick();
				} catch (error) {
					return {
						kind: "failed",
						message: messageOf(error)
					};
				}
				const step = pickStep(reply);
				switch (step.step) {
					case "picked": return registerWorkspace(step.path);
					case "cancelled": return { kind: "cancelled" };
					case "browse": return { kind: "browse" };
					default: return {
						kind: "failed",
						message: step.message
					};
				}
			};
			/**
			* List one level for the in-app picker.
			* @param path - directory to list; absent lists the host account's home.
			* @param signal - cancellation for a superseded scan.
			* @returns the level, or the line to show instead.
			*/
			const browseDirectory = async (path, signal) => {
				const navigation = service(ctx, "uiWorkspace");
				if (navigation === void 0) return {
					ok: false,
					message: workbenchT("picker.unavailable")
				};
				try {
					return {
						ok: true,
						value: await navigation.listDirectory(path, signal)
					};
				} catch (error) {
					return {
						ok: false,
						message: messageOf(error)
					};
				}
			};
			/**
			* Create one child directory for the in-app picker.
			* @param path - existing parent directory.
			* @param name - single non-blank path segment.
			* @returns the created path, or the line to show instead.
			*/
			const makeDirectory = async (path, name) => {
				const navigation = service(ctx, "uiWorkspace");
				if (navigation === void 0) return {
					ok: false,
					message: workbenchT("picker.unavailable")
				};
				try {
					return {
						ok: true,
						path: await navigation.createDirectory(path, name)
					};
				} catch (error) {
					return {
						ok: false,
						message: messageOf(error)
					};
				}
			};
			const openWorkspace = (workspaceId) => {
				const navigation = service(ctx, "uiWorkspace");
				if (navigation === void 0) return Promise.resolve();
				return navigation.openWorkspace(workspaceId);
			};
			const startSession = (workspaceId) => {
				service(ctx, "uiWorkspace")?.startSession(workspaceId);
			};
			const removeWorkspace = (workspaceId) => {
				const registry = service(ctx, "workspaces");
				if (registry === void 0) return;
				registry.delete(workspaceId);
			};
			const listDirectory = async (sessionId, path, signal) => {
				const files = workspaceFiles(ctx);
				if (files === void 0) return {
					ok: false,
					value: {
						status: "error",
						entries: [],
						truncated: false,
						error: workbenchT("tree.unavailable")
					}
				};
				const result = await files.list(sessionId, path, signal);
				if (result.ok) return {
					ok: true,
					value: {
						status: "ready",
						entries: result.value.entries,
						truncated: result.value.truncated
					}
				};
				return {
					ok: false,
					value: {
						status: "error",
						entries: [],
						truncated: false,
						error: failureText(workbenchT, result.error)
					}
				};
			};
			/**
			* Show one file in the right column: the workbench editor when the right
			* column is there, the official viewer as the fallback route.
			*
			* The address carries the Session, not the sandbox: the official `text` tab
			* type claims session-scoped file addresses only, and the Host resolves the
			* path against that Session's workspace root.
			* @param sessionId - the Session whose workspace holds the file.
			* @param path - the file's absolute path.
			* @returns whether the column took it, and why not when it did not.
			*/
			const openFile = (sessionId, path) => {
				const pane = service(ctx, "sidebarRight");
				if (pane === void 0) return {
					ok: false,
					message: workbenchT("file.noPane")
				};
				if (pane.openTab !== void 0) try {
					pane.openTab(EDITOR_KIND, { params: {
						sessionId,
						path
					} });
					return { ok: true };
				} catch (error) {
					if (!(error instanceof Error)) return {
						ok: false,
						message: messageOf(error)
					};
				}
				return openPreview(sessionId, path);
			};
			/**
			* Put one Session on screen.
			*
			* Selecting a session is only half of what the right column needs: its root
			* controller renders the session-scoped seat **only while the Conversation is
			* the selected main panel** (`ui-sidebar-right`'s `RightbarRoot`), and that
			* seat is what publishes the binding every `openResource`/`openTab` requires.
			* @param sessionId - the Session to make current.
			* @returns whether a sessions service was there to answer.
			*/
			const selectSession = (sessionId) => {
				const sessions = service(ctx, "sessions");
				if (sessions === void 0) return false;
				sessions.open(sessionId);
				return true;
			};
			/**
			* Select the Conversation as the center column's panel (`activePanelId: null`).
			*
			* This is the step that brings the right column into existence at all: the
			* workbench is a global panel, and a global panel means no right column, so
			* any file open has to hand the column over first. It is the same selection
			* `uiWorkspace.openSession` makes, taken here on its own so the handover does
			* not also reconnect a workspace.
			* @returns whether a layout service was there to answer.
			*/
			const showConversation = () => {
				const layout = service(ctx, "layout");
				if (layout === void 0) return false;
				layout.selectPanel(null);
				return true;
			};
			/**
			* Show one file in the official viewer instead of the editor: the route that
			* renders Markdown, PDFs, and images rather than their bytes.
			* @param sessionId - the Session whose workspace holds the file.
			* @param path - the file's absolute path.
			* @returns whether the column took it, and why not when it did not.
			*/
			const openPreview = (sessionId, path) => {
				const pane = service(ctx, "sidebarRight");
				if (pane === void 0) return {
					ok: false,
					message: workbenchT("file.noPane")
				};
				try {
					pane.openResource(fileAddress(sessionId, path));
					return { ok: true };
				} catch (error) {
					return {
						ok: false,
						message: messageOf(error),
						...paneCodeOf(error)
					};
				}
			};
			/**
			* Load one file's text through this plugin's Host route.
			*
			* The route exists because the client has no write verb and no bounded text
			* read with a version token; it answers the same shape whether it failed in
			* the trust fence, the boundary check, or the filesystem.
			* @param sessionId - the Session whose workspace confines the path.
			* @param path - the file's absolute path.
			* @returns the text and its version, or the reason it could not be read.
			*/
			const readFile = async (sessionId, path) => {
				try {
					const response = await fetch(WORKBENCH_READ_ROUTE, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({
							sessionId,
							path
						})
					});
					const payload = await response.json();
					if (payload.ok === true && typeof payload.text === "string" && typeof payload.version === "string") return {
						ok: true,
						text: payload.text,
						version: payload.version,
						size: payload.size ?? 0
					};
					return {
						ok: false,
						code: payload.code ?? "workbench/failed",
						message: payload.message ?? `HTTP ${response.status}`
					};
				} catch (error) {
					return {
						ok: false,
						code: "workbench/unreachable",
						message: messageOf(error)
					};
				}
			};
			/**
			* Save one file through this plugin's Host route.
			* @param sessionId - the Session whose workspace confines the path.
			* @param path - the file's absolute path.
			* @param text - the full new content.
			* @param version - the version the reader loaded; a mismatch is refused.
			* @returns the new version, or the reason the write did not happen.
			*/
			const writeFile = async (sessionId, path, text, version) => {
				try {
					const response = await fetch(WORKBENCH_WRITE_ROUTE, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({
							sessionId,
							path,
							text,
							version
						})
					});
					const payload = await response.json();
					if (payload.ok === true && typeof payload.version === "string") return {
						ok: true,
						version: payload.version
					};
					return {
						ok: false,
						code: payload.code ?? "workbench/failed",
						message: payload.message ?? `HTTP ${response.status}`
					};
				} catch (error) {
					return {
						ok: false,
						code: "workbench/unreachable",
						message: messageOf(error)
					};
				}
			};
			const injected = () => ({
				wt: workbenchT,
				hooks: {
					capability,
					scheme
				},
				pickWorkspace,
				registerWorkspace,
				browseDirectory,
				makeDirectory,
				openFile,
				selectSession,
				showConversation,
				openWorkspace,
				startSession,
				removeWorkspace,
				listDirectory
			});
			const editorInjected = () => ({
				wt: workbenchT,
				readFile,
				writeFile,
				openPreview
			});
			ctx.slots.inject("main", () => ctx.slots.register({
				name: "main",
				key: PANEL_ID,
				inject: injected
			}, WorkbenchPanel));
			ctx.inject(["sidebarRightTabs"], (scope) => {
				scope.effect(() => scope.sidebarRightTabs.register(editorDefinition(workbenchT)), "dsh-workbench: editor tab type");
			});
			ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
				name: "sidebar.right.pane.tab",
				key: EDITOR_ID,
				locale: NS,
				inject: editorInjected
			}, FileEditorBody));
			ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
				name: "sidebar.right.pane.tab.title",
				key: EDITOR_ID,
				inject: editorInjected
			}, FileEditorTitle));
			ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
				name: "sidebar.panellist",
				id: PANEL_ID,
				order: 20,
				label: () => workbenchT("trigger")
			}, WorkbenchPanelIcon));
		}
		//#endregion
		exports.CARD_ACCENTS = CARD_ACCENTS;
		exports.EDITOR_ID = EDITOR_ID;
		exports.EDITOR_KIND = EDITOR_KIND;
		exports.FileEditorBody = FileEditorBody;
		exports.FileEditorTitle = FileEditorTitle;
		exports.MAX_EXPLORER_DEPTH = MAX_EXPLORER_DEPTH;
		exports.NO_CAPABILITIES = NO_CAPABILITIES;
		exports.WorkbenchPanel = WorkbenchPanel;
		exports.WorkbenchPanelIcon = WorkbenchPanelIcon;
		exports.accentFor = accentFor;
		exports.apply = apply;
		exports.childPath = childPath;
		exports.createCapabilityStore = createCapabilityStore;
		exports.editorDefinition = editorDefinition;
		exports.explorerRows = explorerRows;
		exports.failureText = failureText;
		exports.fileAddress = fileAddress;
		exports.inject = inject;
		exports.orderEntries = orderEntries;
		exports.parentPathOf = parentPathOf;
		exports.pickStep = pickStep;
		exports.pickerCrumbs = pickerCrumbs;
		exports.pickerEntries = pickerEntries;
		exports.sizeText = sizeText;
		exports.splitPath = splitPath;
		exports.workspaceItems = workspaceItems;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map