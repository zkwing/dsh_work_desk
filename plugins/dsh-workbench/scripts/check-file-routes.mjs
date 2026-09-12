/**
 * Live check of this plugin's Host file routes against a RUNNING `dsh` host.
 *
 * The artifact verifier pins the client's side of the contract with a stubbed
 * `fetch`; this script is the other half, and the only place the whole write
 * path is exercised for real: a genuine HTTP request through the composition's
 * trust fence, the Session boundary check, the sandbox policy, and the
 * filesystem backend, against a real file on disk.
 *
 * What it proves, in order:
 *   1. the routes exist and refuse a caller the trust fence rejects;
 *   2. a read answers the text and the version token;
 *   3. a write with the current version lands, and the version moves;
 *   4. a write with a stale version is refused (`workbench/stale`), so an
 *      editor can never silently clobber a file that changed underneath it;
 *   5. a path outside the Session's workspace root is refused
 *      (`workbench/outside-workspace`) even though the file exists and the
 *      backend would allow it;
 *   6. the wrong method is refused.
 *
 * Usage:
 *   node check-file-routes.mjs <origin> <token> [sessionId] [scratchDir]
 *
 * `sessionId` and `scratchDir` default to the newest Session DSH has on disk
 * under `~/.dsh/sessions`, so the boundary is the same one the workbench uses.
 */
import { request as httpRequest } from 'node:http'
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const base = process.argv[2] ?? 'http://127.0.0.1:43299'
const token = process.argv[3] ?? ''
const origin = new URL(base)

let cookie = ''

/**
 * One request through node:http, carrying the session cookie the tokenized page
 * URL sets (the trust fence refuses a caller without it).
 * @param {string} path - request path, query included.
 * @param {{ method?: string, body?: unknown, contentType?: string, withCookie?: boolean }} [options] - request shape.
 * @returns {Promise<{ status: number, body: string, json: any }>}
 */
function request(path, options = {}) {
  const payload = options.body === undefined ? undefined : JSON.stringify(options.body)
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      host: origin.hostname,
      port: origin.port,
      path,
      method: options.method ?? 'GET',
      headers: {
        host: origin.host,
        accept: 'application/json',
        ...(payload === undefined ? {} : { 'content-length': Buffer.byteLength(payload) }),
        ...(options.contentType === undefined ? {} : { 'content-type': options.contentType }),
        ...(options.withCookie === false || cookie === '' ? {} : { cookie }),
      },
    }, (res) => {
      const setCookie = res.headers['set-cookie']
      if (setCookie !== undefined) cookie = setCookie.map(value => value.split(';')[0]).join('; ')
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8')
        let json
        try { json = JSON.parse(body) } catch { json = undefined }
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body, json })
      })
    })
    req.on('error', reject)
    if (payload !== undefined) req.write(payload)
    req.end()
  })
}

const failures = []
function check(condition, message) {
  console.log(`  ${condition ? 'ok   ' : 'FAIL '} ${message}`)
  if (!condition) failures.push(message)
}

/**
 * The newest Session directory DSH has on disk, with the workspace it was
 * opened in.
 * @returns {{ sessionId: string, cwd: string } | undefined}
 */
function newestSession() {
  const root = join(homedir(), '.dsh', 'sessions')
  let best
  for (const project of readdirSync(root)) {
    const projectDir = join(root, project)
    let sessions
    try { sessions = readdirSync(projectDir) } catch { continue }
    for (const entry of sessions) {
      const dir = join(projectDir, entry)
      let info
      try { info = statSync(dir) } catch { continue }
      if (!info.isDirectory()) continue
      if (best === undefined || info.mtimeMs > best.mtimeMs) {
        best = { sessionId: entry, mtimeMs: info.mtimeMs, dir }
      }
    }
  }
  if (best === undefined) return undefined
  // The project folder name is not a path; the workspace registry holds the
  // real root, which is the same boundary the Host enforces.
  let cwd
  try {
    const registry = JSON.parse(readFileSync(join(homedir(), '.dsh', 'storages', 'workspace.json'), 'utf8'))
    const rows = Object.values(registry?.tables?.workspaces ?? {})
    cwd = rows.find(row => Array.isArray(row?.sessionIds) && row.sessionIds.includes(best.sessionId))?.path
      ?? rows[0]?.path
  } catch { cwd = undefined }
  return { sessionId: best.sessionId, cwd }
}

// The tokenized page sets the cookie the routes expect, and answers with a
// redirect to the plain page: this follows it once, keeping the cookie.
let page = await request(token === '' ? '/' : `/?token=${encodeURIComponent(token)}`)
if (page.status >= 300 && page.status < 400) {
  const location = new URL(page.headers?.location ?? '/', base)
  page = await request(location.pathname + location.search)
}
check(page.status === 200, `the tokenized page answers 200 (got ${page.status})`)
check(cookie !== '', 'the page issued the session cookie the trust fence wants')

const discovered = newestSession()
const sessionId = process.argv[4] ?? discovered?.sessionId
const cwd = process.argv[5] ?? discovered?.cwd
console.log(`session: ${String(sessionId)}`)
console.log(`workspace: ${String(cwd)}`)
console.log('')

if (sessionId === undefined || cwd === undefined) {
  console.log('SKIP  no Session on disk to bound the check')
  process.exit(0)
}

const scratch = join(cwd, '.dsh-workbench-route-check.txt')
const original = 'line one\nline two\n'

// 1. the fence: no cookie, no answer beyond a refusal.
const anonymous = await request('/workbench/file/read', {
  method: 'POST',
  contentType: 'application/json',
  body: { sessionId, path: scratch },
  withCookie: false,
})
check(anonymous.status === 401 || anonymous.status === 403,
  `a caller without the session cookie is refused (got ${anonymous.status})`)

// 2. the write that creates the scratch file: this is the editor's own route,
//    so it must refuse to create — proving the "existing file only" rule first.
const beforeCreate = await request('/workbench/file/write', {
  method: 'POST',
  contentType: 'application/json',
  body: { sessionId, path: scratch, text: original, version: 'v0' },
})
check(beforeCreate.status === 404 && beforeCreate.json?.code === 'workbench/not-a-file',
  `a write to a file that does not exist yet is refused (got ${beforeCreate.status}/${String(beforeCreate.json?.code)})`)

// Seed the file through the platform's own tooling path (this script's own
// process has file access; the route is what we are testing).
writeFileSync(scratch, original, 'utf8')

const read = await request('/workbench/file/read', {
  method: 'POST',
  contentType: 'application/json',
  body: { sessionId, path: scratch },
})
check(read.status === 200 && read.json?.ok === true && read.json.text === original,
  `the read route answers the file's text (got ${read.status}/${String(read.json?.code)})`)
check(typeof read.json?.version === 'string' && read.json.version !== '',
  'the read route carries a version token')

const version = read.json?.version
const edited = `${original}line three\n`
const written = await request('/workbench/file/write', {
  method: 'POST',
  contentType: 'application/json',
  body: { sessionId, path: scratch, text: edited, version },
})
check(written.status === 200 && written.json?.ok === true && written.json.version !== version,
  `a version-guarded write lands and moves the version (got ${written.status}/${String(written.json?.code)})`)
check(readFileSync(scratch, 'utf8') === edited, 'the file on disk carries the edited text')

// 4. the stale guard: the same version again must not overwrite the file.
const stale = await request('/workbench/file/write', {
  method: 'POST',
  contentType: 'application/json',
  body: { sessionId, path: scratch, text: 'clobbered\n', version },
})
check(stale.status === 409 && stale.json?.code === 'workbench/stale',
  `a stale version is refused with its own code (got ${stale.status}/${String(stale.json?.code)})`)
check(readFileSync(scratch, 'utf8') === edited, 'the refused write changed nothing on disk')

// 5. the boundary: a real file outside the Session's workspace root.
const outside = await request('/workbench/file/read', {
  method: 'POST',
  contentType: 'application/json',
  body: { sessionId, path: join(homedir(), '.dsh', 'settings.yaml') },
})
check(outside.status === 403 && outside.json?.code === 'workbench/outside-workspace',
  `a path outside the workspace root is refused (got ${outside.status}/${String(outside.json?.code)})`)

// 6. the method and the media type.
const wrongMethod = await request('/workbench/file/read', { method: 'GET' })
check(wrongMethod.status === 405, `a GET on the read route is refused (got ${wrongMethod.status})`)
const wrongType = await request('/workbench/file/read', {
  method: 'POST',
  body: { sessionId, path: scratch },
})
check(wrongType.status === 415, `a non-JSON body is refused (got ${wrongType.status})`)

// Clean up the scratch file through the filesystem, not the route.
rmSync(scratch, { force: true })

console.log('')
console.log(failures.length === 0
  ? 'OK  the workbench file routes read, write, guard, and refuse as specified'
  : `${failures.length} check(s) failed`)
process.exitCode = failures.length === 0 ? 0 : 1
