/**
 * Host half of `dsh-coding-bench`.
 *
 * The coding bench is a browser-surface plugin: its capabilities are slots, a
 * locale namespace, and Workspace views, all of which live in the client half
 * this package serves as `/plugins/dsh-coding-bench/client.js`. This row exists
 * so the Loader has a live entry to attach that client declaration to.
 *
 * ## Why there is a file route here
 *
 * DSH's client has **no write verb for files**. `remote.workspaceFiles` exposes
 * `stat`/`read`/`readAll`/`readBytes`/`readRelated`/`list`/`changes` and nothing
 * else, and the only writer (`ctx.fs.writeText`) is a Host service behind the
 * sandbox policy. So an in-app editor cannot be built from the client API: the
 * writing half has to be contributed here, the way `@deepseek-ai/dsh-host-open-in-app`
 * contributes its launch route.
 *
 * Two routes, one job each:
 *
 * - `POST /coding-bench/file/read` reads one UTF-8 file, bounded, with the
 *   version token a later write guards against.
 * - `POST /coding-bench/file/write` replaces one UTF-8 file **atomically and
 *   only if its version still matches** what the reader saw.
 *
 * ## The safety rules, in one place
 *
 * - **Trust**: every request goes through the composition's `connection`
 *   service first (`requestRejection`), the same Host/Origin fence plus login
 *   cookie that guards the open-in-app routes. Nothing is read or written for a
 *   caller that fence refuses.
 * - **Boundary**: the path must resolve inside the workspace root of the Session
 *   the caller names — the root the Host itself holds for that Session, never a
 *   path the caller asserts. A write outside it is refused with
 *   `coding-bench/outside-workspace` even when the filesystem backend would
 *   allow it.
 * - **Policy**: the write runs under the composition's own resolved sandbox
 *   policy (`ctx.sandboxPolicy.resolve`), session override included. This route
 *   never manufactures a policy of its own, so it can never grant an access the
 *   deployment or the session did not already have; a `read-only` policy simply
 *   refuses the save.
 * - **Freshness**: a write is always `replaceIfVersion` against the version the
 *   reader loaded. A file that changed under the editor (an Agent edit, another
 *   process) answers `coding-bench/stale`, and the client reloads instead of
 *   clobbering.
 * - **Shape**: only an existing regular file inside the boundary is writable —
 *   no creates, no directories, no symlink follow at the final component. Body
 *   and text are capped, so a hostile page cannot make this an unbounded buffer.
 *
 * ## How this differs from the workbench's route
 *
 * Same shape, different namespace. The two routes can coexist on a profile
 * because they answer on disjoint paths. The rationale for keeping them apart
 * is not isolation (a future rename could just as easily live here) but
 * attribution: the coding bench is a new module, its failures should be
 * diagnosable against its own `coding-bench/...` error codes, and the routes
 * can evolve independently.
 */
import type { Context } from '@deepseek-ai/cordis';
/** Package name, used by the Loader for diagnostics and by the client scan. */
export declare const name = "dsh-coding-bench";
/**
 * No Cordis service is required to mount this plugin.
 *
 * The file routes are installed through `ctx.inject` inside {@link apply}, so a
 * composition without the web server, the trust fence, or the filesystem keeps
 * this row live — and its client half mountable — instead of leaving the plugin
 * pending forever.
 */
export declare const inject: readonly string[];
/** Read route: one bounded UTF-8 file plus its version token. */
export declare const CODING_BENCH_READ_ROUTE = "/coding-bench/file/read";
/** Write route: atomic, version-guarded replacement of one UTF-8 file. */
export declare const CODING_BENCH_WRITE_ROUTE = "/coding-bench/file/write";
/**
 * Register the coding bench's Host row and install its file routes once the
 * web server, the trust fence, the filesystem, and the sandbox policy are
 * mounted.
 * @param ctx - the Host context.
 */
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map