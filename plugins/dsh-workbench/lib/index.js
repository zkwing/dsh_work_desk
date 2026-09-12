/**
 * Host half of `dsh-workbench`.
 *
 * The workbench is a browser-surface plugin: its capabilities are slots, a
 * locale namespace, and Workspace views, all of which live in the client half
 * this package serves as `/plugins/dsh-workbench/client.js`. This row exists so
 * the Loader has a live entry to attach that client declaration to.
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
 * - `POST /workbench/file/read` reads one UTF-8 file, bounded, with the version
 *   token a later write guards against.
 * - `POST /workbench/file/write` replaces one UTF-8 file **atomically and only
 *   if its version still matches** what the reader saw.
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
 *   `workbench/outside-workspace` even when the filesystem backend would allow it.
 * - **Policy**: the write runs under the composition's own resolved sandbox
 *   policy (`ctx.sandboxPolicy.resolve`), session override included. This route
 *   never manufactures a policy of its own, so it can never grant an access the
 *   deployment or the session did not already have; a `read-only` policy simply
 *   refuses the save.
 * - **Freshness**: a write is always `replaceIfVersion` against the version the
 *   reader loaded. A file that changed under the editor (an Agent edit, another
 *   process) answers `workbench/stale`, and the client reloads instead of
 *   clobbering.
 * - **Shape**: only an existing regular file inside the boundary is writable —
 *   no creates, no directories, no symlink follow at the final component. Body
 *   and text are capped, so a hostile page cannot make this an unbounded buffer.
 */
// The web server hands these routes a Node request/response pair. This program
// is the client-typed one (no ambient node types), so the two shapes are
// restated structurally below: only the members these routes actually touch.
/** Package name, used by the Loader for diagnostics and by the client scan. */
export const name = 'dsh-workbench';
/**
 * No Cordis service is required to mount this plugin.
 *
 * The file routes are installed through `ctx.inject` inside {@link apply}, so a
 * composition without the web server, the trust fence, or the filesystem keeps
 * this row live — and its client half mountable — instead of leaving the plugin
 * pending forever.
 */
export const inject = [];
/** Read route: one bounded UTF-8 file plus its version token. */
export const WORKBENCH_READ_ROUTE = '/workbench/file/read';
/** Write route: atomic, version-guarded replacement of one UTF-8 file. */
export const WORKBENCH_WRITE_ROUTE = '/workbench/file/write';
/** Request bodies are JSON with a path and, for a write, the whole text. */
const MAX_BODY_BYTES = 4 * 1024 * 1024;
/** Largest file this route will read or replace; beyond it the editor refuses. */
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
/** JSON response, never cached: outcomes here are live facts about files. */
function sendJson(res, status, payload) {
    res.statusCode = status;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify(payload));
}
/** 405 with the route's one supported method. */
function sendMethodNotAllowed(res) {
    res.statusCode = 405;
    res.setHeader('allow', 'POST');
    res.end();
}
/** One refusal in the client's vocabulary: a stable code plus a display line. */
function refuse(res, status, code, message) {
    sendJson(res, status, { ok: false, code, message });
}
/** Collect a bounded request body as UTF-8 text; null past the ceiling (stream drained). */
async function readBoundedBody(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        size += chunk.byteLength;
        if (size > MAX_BODY_BYTES) {
            // Drain the remainder so the refusal is a readable response, not a socket cut.
            req.resume();
            return null;
        }
        chunks.push(chunk);
    }
    const merged = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return new TextDecoder().decode(merged);
}
/**
 * Parse a JSON object body with the string fields a route requires.
 * @param text - the request body.
 * @param fields - the fields that must be present, non-empty strings.
 * @returns the typed fields, or null when the body is not that shape.
 */
function parseBody(text, fields) {
    let body;
    try {
        body = JSON.parse(text);
    }
    catch {
        return null;
    }
    if (typeof body !== 'object' || body === null)
        return null;
    const record = body;
    const parsed = {};
    for (const field of fields) {
        const value = record[field];
        if (typeof value !== 'string')
            return null;
        parsed[field] = value;
    }
    return parsed;
}
/** One line for any rejection that crossed a service boundary. */
function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}
/** The filesystem error code a rejection carries, when it has one. */
function codeOf(error) {
    const code = error.code;
    return typeof code === 'string' ? code : 'workbench/failed';
}
/**
 * The workspace root of one Session, read from the Host's own session state.
 *
 * Live sessions answer from their header; a session that is not currently
 * loaded answers from persistence, so a card can edit a file of a Workspace
 * whose Agent is not running. Everything here is the Host's fact, never the
 * caller's claim.
 * @param ctx - the route context.
 * @param sessionId - the Session the caller names.
 * @returns its workspace root, or undefined when the Session is unknown.
 */
async function workspaceRootOf(ctx, sessionId) {
    const live = ctx.sessions.get(sessionId);
    if (live !== undefined)
        return live.header.cwd ?? ctx.sandboxPolicy.workspaceRoot;
    const stored = await ctx.sessionPersistence?.stat(sessionId);
    return stored?.header?.cwd ?? undefined;
}
/**
 * Resolve one body path inside the Session's workspace root.
 *
 * Returns the refusal to send rather than throwing, so both routes share one
 * boundary rule with one wording.
 * @param ctx - the route context.
 * @param sessionId - the Session whose root confines the path.
 * @param path - the absolute path the client sent.
 * @returns the resolved target and the live session, or a refusal.
 */
async function locate(ctx, sessionId, path) {
    const workspaceRoot = await workspaceRootOf(ctx, sessionId);
    if (workspaceRoot === undefined) {
        return { ok: false, status: 404, code: 'workbench/unknown-session', message: `unknown session: ${sessionId}` };
    }
    const root = await ctx.fs.resolve(workspaceRoot);
    const target = await ctx.fs.resolve(path, { cwd: workspaceRoot });
    if (!ctx.fs.contains(root, target)) {
        return {
            ok: false,
            status: 403,
            code: 'workbench/outside-workspace',
            message: `"${path}" is outside the workspace root of this session`,
        };
    }
    return { ok: true, target, session: ctx.sessions.get(sessionId), root, workspaceRoot };
}
/**
 * Register the workbench's Host row and install its file routes once the web
 * server, the trust fence, the filesystem, and the sandbox policy are mounted.
 * @param ctx - the Host context.
 */
export function apply(ctx) {
    ctx.inject(['webServer', 'connection', 'fs', 'sandboxPolicy', 'sessions'], (scope) => {
        const mounted = scope;
        mounted.effect(() => {
            // `sessionPersistence` is optional: without it only live sessions resolve,
            // which is a smaller feature, not a broken one.
            const routeContext = {
                connection: mounted.connection,
                fs: mounted.fs,
                sandboxPolicy: mounted.sandboxPolicy,
                sessions: mounted.sessions,
                webServer: mounted.webServer,
                sessionPersistence: mounted.get('sessionPersistence'),
            };
            const disposeRead = mounted.webServer.register({
                kind: 'exact',
                path: WORKBENCH_READ_ROUTE,
                handler: (req, res) => handleRead(routeContext, req, res),
            });
            const disposeWrite = mounted.webServer.register({
                kind: 'exact',
                path: WORKBENCH_WRITE_ROUTE,
                handler: (req, res) => handleWrite(routeContext, req, res),
            });
            return () => {
                disposeWrite();
                disposeRead();
            };
        }, 'dsh-workbench: file routes');
    });
}
/**
 * Answer one read: the file's text, its version, and its size.
 * @param ctx - the route context.
 * @param req - the request.
 * @param res - the response.
 */
async function handleRead(ctx, req, res) {
    const rejection = ctx.connection.requestRejection(req);
    if (rejection !== undefined) {
        refuse(res, rejection, 'workbench/unauthorized', 'request rejected by the connection trust fence');
        return;
    }
    if (req.method !== 'POST') {
        sendMethodNotAllowed(res);
        return;
    }
    if (String(req.headers['content-type']).split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
        refuse(res, 415, 'workbench/bad-request', 'content-type must be application/json');
        return;
    }
    const body = await readBoundedBody(req);
    if (body === null) {
        refuse(res, 413, 'workbench/too-large', 'request body is too large');
        return;
    }
    const parsed = parseBody(body, ['sessionId', 'path']);
    if (parsed === null) {
        refuse(res, 400, 'workbench/bad-request', 'request body must be JSON with string "sessionId" and "path"');
        return;
    }
    try {
        const located = await locate(ctx, parsed.sessionId, parsed.path);
        if (!located.ok) {
            refuse(res, located.status, located.code, located.message);
            return;
        }
        const info = await ctx.fs.stat(located.target);
        if (info === undefined || info.type !== 'file') {
            refuse(res, 404, 'workbench/not-a-file', `"${parsed.path}" is not a file`);
            return;
        }
        if ((info.size ?? 0) > MAX_TEXT_BYTES) {
            refuse(res, 413, 'workbench/too-large', `"${parsed.path}" is larger than the editor cap`);
            return;
        }
        const text = await ctx.fs.readText(located.target);
        if (text.includes('\u0000')) {
            refuse(res, 415, 'workbench/not-text', `"${parsed.path}" is not a text file`);
            return;
        }
        sendJson(res, 200, { ok: true, text, version: info.version, size: info.size ?? 0 });
    }
    catch (error) {
        refuse(res, 500, codeOf(error), messageOf(error));
    }
}
/**
 * Answer one write: replace the file when its version still matches.
 * @param ctx - the route context.
 * @param req - the request.
 * @param res - the response.
 */
async function handleWrite(ctx, req, res) {
    const rejection = ctx.connection.requestRejection(req);
    if (rejection !== undefined) {
        refuse(res, rejection, 'workbench/unauthorized', 'request rejected by the connection trust fence');
        return;
    }
    if (req.method !== 'POST') {
        sendMethodNotAllowed(res);
        return;
    }
    if (String(req.headers['content-type']).split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
        refuse(res, 415, 'workbench/bad-request', 'content-type must be application/json');
        return;
    }
    const body = await readBoundedBody(req);
    if (body === null) {
        refuse(res, 413, 'workbench/too-large', 'request body is too large');
        return;
    }
    const parsed = parseBody(body, ['sessionId', 'path', 'text', 'version']);
    if (parsed === null) {
        refuse(res, 400, 'workbench/bad-request', 'request body must be JSON with string "sessionId", "path", "text", "version"');
        return;
    }
    try {
        const located = await locate(ctx, parsed.sessionId, parsed.path);
        if (!located.ok) {
            refuse(res, located.status, located.code, located.message);
            return;
        }
        const info = await ctx.fs.stat(located.target);
        // Existing regular files only: an editor replaces what it opened, it does
        // not create and it never follows a final-component symlink into a write.
        if (info === undefined || info.type !== 'file') {
            refuse(res, 404, 'workbench/not-a-file', `"${parsed.path}" is not an existing file`);
            return;
        }
        if (new TextEncoder().encode(parsed.text).byteLength > MAX_TEXT_BYTES) {
            refuse(res, 413, 'workbench/too-large', 'the text is larger than the editor cap');
            return;
        }
        // The composition's own policy, session override included: this route
        // contributes no access of its own. A Session that is not loaded still has a
        // persisted cwd, and that cwd is its workspace-write boundary — the very
        // boundary a live Session supplies — so the boundary comes from the Session
        // either way while the mode stays the deployment's own.
        const resolved = ctx.sandboxPolicy.resolve(located.session === undefined ? {} : { session: located.session });
        const policy = located.session === undefined
            ? { ...resolved, workspaceRoot: located.workspaceRoot }
            : resolved;
        const outcome = await ctx.fs.writeText(located.target, parsed.text, { kind: 'replaceIfVersion', version: parsed.version }, undefined, policy);
        sendJson(res, 200, { ok: true, version: outcome.version });
    }
    catch (error) {
        const code = codeOf(error);
        // A stale guard is the one failure the editor resolves by reloading, so it
        // answers its own status and code rather than a generic 500.
        const status = code === 'FS_STALE_VERSION' ? 409 : code === 'FS_SANDBOX_DENIED' ? 403 : 500;
        refuse(res, status, code === 'FS_STALE_VERSION' ? 'workbench/stale' : code, messageOf(error));
    }
}
//# sourceMappingURL=index.js.map