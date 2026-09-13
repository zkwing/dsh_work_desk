/**
 * Live-wire check: does a booted DSH Host serve this plugin's browser bundle?
 *
 * The client module system scans the Loader's entries, turns a `dsh.client`
 * declaration into a served bundle, and advertises it in the boot graph the
 * browser reads. This script asks a RUNNING `dsh web` instance the same
 * questions the browser asks, so it verifies the composition end to end rather
 * than merely well-formed.
 *
 * Three Host rules shape the requests below:
 *   * the page is served only at the tokenized URL the Host prints, which sets
 *     the browser session cookie; the request must not carry a
 *     `sec-fetch-site: cross-site` marker, which is why this uses `node:http`
 *     instead of fetch (undici adds `sec-fetch-mode`, and the trust fence
 *     refuses a cross-site marker outright);
 *   * `/plugins/??…` combo URLs are advertised URNs on an exact-match route, so
 *     a query string changes the URN and answers 404 — they are fetched
 *     verbatim;
 *   * an unadvertised single-plugin URL is a 404 by design, and the browser
 *     never requests one. The batch is the load-bearing route.
 *
 * Usage:
 *   node check-live-host.mjs <origin> [packageName] [token]
 */
import { get } from 'node:http'

const base = process.argv[2] ?? 'http://127.0.0.1:43299'
const packageName = process.argv[3] ?? 'dsh-workbench'
const token = process.argv[4] ?? ''
const origin = new URL(base)

let cookie = ''

/**
 * One GET through node:http, following redirects and carrying the session
 * cookie the tokenized page URL sets.
 * @param {string} path - request path, query string included.
 * @returns {Promise<{ status: number, headers: Record<string, string>, body: string }>}
 */
function request(path) {
  return new Promise((resolve, reject) => {
    const req = get({
      host: origin.hostname,
      port: origin.port,
      path,
      headers: {
        host: origin.host,
        accept: 'text/html,application/javascript,*/*',
        ...(cookie === '' ? {} : { cookie }),
      },
    }, (res) => {
      const setCookie = res.headers['set-cookie']
      if (setCookie !== undefined) {
        cookie = setCookie.map(value => value.split(';')[0]).join('; ')
      }
      if (res.statusCode !== undefined && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location !== undefined) {
        res.resume()
        request(new URL(res.headers.location, base).pathname + new URL(res.headers.location, base).search)
          .then(resolve, reject)
        return
      }
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        })
      })
    })
    req.on('error', reject)
  })
}

const failures = []
function check(condition, message) {
  console.log(`  ${condition ? 'ok   ' : 'FAIL '} ${message}`)
  if (!condition) failures.push(message)
}

console.log(`host:    ${base}`)
console.log(`package: ${packageName}`)
console.log('')

// ── 1. the page and its boot graph ─────────────────────────────────────────
const pagePath = token === '' ? '/' : `/?token=${encodeURIComponent(token)}`
const index = await request(pagePath)
check(index.status === 200, `GET / answers 200 (got ${index.status})`)
const html = index.body
check(html.includes('__DSH_BOOT__'), 'the served page injects window.__DSH_BOOT__')
check(html.includes(packageName), `the boot graph names the plugin (${packageName})`)

// The application combo is the preload href; the script src is the small
// bootstrap combo for the module system itself.
const comboHref = /preload" as="script" href="(\/plugins\/\?\?[^"]*)"/.exec(html)?.[1]?.replaceAll('&amp;', '&')
const comboSrc = /<script src="(\/plugins\/\?\?[^"]*)"/.exec(html)?.[1]?.replaceAll('&amp;', '&')
check(comboHref !== undefined, 'the page preloads an application combo')
check(comboSrc !== undefined, 'the page boots from a bootstrap combo')
check(comboHref?.includes(`${packageName}/client.js`) === true,
  `the application combo lists ${packageName}/client.js`)

// ── 2. the combos actually serve ───────────────────────────────────────────
const combo = comboSrc === undefined ? undefined : await request(comboSrc)
check(combo?.status === 200, `the bootstrap combo answers 200 (got ${combo?.status})`)
check(combo?.headers['content-type']?.includes('javascript') === true,
  `the combo is served as JavaScript (got ${combo?.headers['content-type']})`)

const batch = comboHref === undefined ? undefined : await request(comboHref)
check(batch?.status === 200, `the application combo answers 200 (got ${batch?.status})`)
const batchBody = batch?.body ?? ''
check(batchBody.includes('__ModuleLoader__.load'), 'the batch is module-loader closure factories')
check(batchBody.includes(`dsh-workbench/client.js`), 'the batch carries the plugin bundle entry')

// ── 3. the artifact's own markers survive the wire ─────────────────────────
// The markers are the plugin's integrations rather than its copy: the two slots
// it claims (the panel body and the sidebar row that selects it), the global
// Workspace hook it reads cards from, the workspace-files namespace it lists
// trees over, the chooser it adds through, and the right column it opens files in.
check(batchBody.includes('sidebar.panellist'), 'the served bundle claims the sidebar panel row')
check(batchBody.includes('useWorkspaces'), 'the served bundle reads the Workspace snapshot hook')
check(batchBody.includes('workspaceFiles'), 'the served bundle lists directories through the Remote namespace')
check(batchBody.includes('directoryPicker'), 'the served bundle can call the Host directory picker')
check(batchBody.includes('sidebarRight') && batchBody.includes('dsh-resource://file/session/'),
  'the served bundle opens files in the right column through resource addresses')
check(batchBody.includes('workbench-editor') && batchBody.includes('/workbench/file/write'),
  'the served bundle carries the editor tab type and this plugin\'s write route')
check(batchBody.includes('selectPanel'),
  'the served bundle hands the center column over (the right column only exists in the conversation view)')
check(batchBody.includes('--dsw-alias-bg-base') && batchBody.includes('data-wb-scheme'),
  'the served stylesheet follows the host palette and switches its grid by color scheme')
check(batchBody.includes('@deepseek-ai/dsh-client-ui-sidebar'),
  'the official sidebar is composed in the same graph as the workbench')

// ── 3b. which directory-picking interaction this boot composed ─────────────
// The adaptive chooser mounts exactly one interaction — the native OS chooser or
// the in-app browser — and each carries its own client surface. Which one is
// here decides how "Add workspace…" reaches the Host: only the native
// interaction serves `directoryPicker/pick`, and the browse one refuses it. The
// plugin handles both, so this is a read-out rather than a failure either way;
// both-at-once or neither would be a miscomposed picker row.
const nativeSurface = html.includes('dsh-client-ui-directory-picker-native')
const browseSurface = html.includes('dsh-client-ui-directory-picker-browse')
check(nativeSurface !== browseSurface,
  `the graph names exactly one directory-picker interaction (native=${nativeSurface}, browse=${browseSurface})`)

// ── 4. the single-plugin route ─────────────────────────────────────────────
// The registry answers a single-plugin URL only when the application batch is
// one resource; otherwise the advertised combo is the URL the page loads, and a
// bare single URL is a 404 by design.
const single = await request(`/plugins/${packageName}/client.js`)
check(single.status === 200 || single.status === 404,
  `GET /plugins/${packageName}/client.js answers 200 or a by-design 404 (got ${single.status})`)
if (single.status === 200) {
  check(single.body.includes('sidebar.panellist'), 'the single-plugin URL serves the workbench bundle')
}

console.log('')
console.log(failures.length === 0
  ? 'OK  the running Host serves this plugin to the browser'
  : `${failures.length} check(s) failed`)
process.exitCode = failures.length === 0 ? 0 : 1
