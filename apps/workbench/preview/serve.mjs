/**
 * Preview host for the workbench: serves the real sidebar client bundle (the
 * artifact DSH serves), its extracted stylesheet, and a browser-side CommonJS
 * loader for the React files that bundle requires.
 *
 * React 18 ships no ESM build, so `/__cjs/...` wraps each upstream CJS file in
 * a module function and serves the equivalent `react` / `react/jsx-runtime` /
 * `react-dom/client` facade as plain ESM. The stubbed module-table rows
 * (ui-slots, client-store, ui-primitives) are ordinary ESM files.
 *
 * Usage: node serve.mjs [--port 43121]
 */
import { createServer } from 'node:http'
import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const CHECKOUT = process.env.DSH_CHECKOUT ?? 'D:\\1_SoftWare\\DeepSeek_Harness\\deepseek-harness'
const PNPM = join(CHECKOUT, 'node_modules', '.pnpm')

const portFlag = process.argv.indexOf('--port')
const PORT = Number(portFlag === -1 ? 43121 : process.argv[portFlag + 1])

/**
 * Package root directories reachable through `/__cjs/<prefix>/...`, longest
 * prefix first so `react-dom` never matches the `react` entry.
 * @type {ReadonlyArray<readonly [string, string]>}
 */
const CJS_PACKAGES = [
  ['react-dom/', join(PNPM, 'react-dom@18.3.1_react@18.3.1', 'node_modules', 'react-dom') + sep],
  ['react/', join(PNPM, 'react@18.3.1', 'node_modules', 'react') + sep],
]

/** Module-table rows answered by ESM facades over the loader above. */
const FACADES = {
  '/__vendor/react': {
    cjs: '/__cjs/react/index.js',
    exports: [
      'Children', 'Component', 'Fragment', 'Profiler', 'PureComponent', 'StrictMode', 'Suspense',
      'cloneElement', 'createContext', 'createElement', 'createFactory', 'createRef', 'forwardRef',
      'isValidElement', 'lazy', 'memo', 'startTransition', 'useCallback', 'useContext', 'useDebugValue',
      'useDeferredValue', 'useEffect', 'useId', 'useImperativeHandle', 'useInsertionEffect',
      'useLayoutEffect', 'useMemo', 'useReducer', 'useRef', 'useState', 'useSyncExternalStore',
      'useTransition', 'version',
    ],
  },
  '/__vendor/jsx-runtime': {
    cjs: '/__cjs/react/jsx-runtime.js',
    exports: ['Fragment', 'jsx', 'jsxs'],
  },
  '/__vendor/react-dom-client': {
    cjs: '/__cjs/react-dom/client.js',
    exports: ['createRoot', 'hydrateRoot'],
  },
}

/**
 * Build the ESM facade for one facade definition: import the loader, register
 * the upstream CJS file as a classic script, then re-export the requested
 * names. The registration has to be an awaited DOM script because the browser
 * cannot `import` a non-module file.
 * @param definition - upstream cjs path plus the named exports to forward.
 * @returns the facade module source.
 */
function facadeSource(definition) {
  return [
    `import { createRequire } from '/__cjs/loader.js'`,
    `await new Promise((resolve, reject) => {`,
    `  const tag = document.createElement('script')`,
    `  tag.src = ${JSON.stringify(definition.cjs)}`,
    `  tag.onload = () => { resolve() }`,
    `  tag.onerror = () => { reject(new Error('preview: cannot load ' + tag.src)) }`,
    `  document.head.appendChild(tag)`,
    `})`,
    `const require = createRequire(${JSON.stringify(definition.cjs)})`,
    `const mod = require(${JSON.stringify(definition.cjs)})`,
    'export default mod',
    ...definition.exports.map(name => `export const ${name} = mod.${name}`),
    '',
  ].join('\n')
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
}

const LOADER_SOURCE = `// Browser-side CommonJS loader for the preview's React files.
// Mirrors the shape of the DSH module table: one shared cache, one require per
// specifier, and a namespace object whose default carries the exports object.
const cache = new Map()

function normalize(baseDir, spec) {
  // An absolute specifier (the facades address React that way) starts its own
  // path; a relative one extends the requiring module's directory.
  const parts = spec.startsWith('/') ? [''] : baseDir.split('/')
  for (const segment of spec.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') parts.pop()
    else parts.push(segment)
  }
  return parts.join('/')
}

/** A module's own directory, derived from its served URL (always \`/__cjs/...\`). */
function baseOf(url) {
  return url.slice(0, url.lastIndexOf('/'))
}

export function createRequire(url) {
  const baseDir = baseOf(url)
  return function require(spec) {
    // An absolute specifier stands on its own; a relative one resolves against
    // the requiring module's directory (an empty base name).
    const bare = spec.startsWith('/') ? spec : normalize(baseDir, spec)
    // A bare package specifier also tries the CJS namespace and the package's
    // own main entry, which is how react-dom/client.js reaches react-dom.
    const packageBase = '/__cjs/' + spec
    const candidates = [bare, bare + '.js', bare + '/index.js']
    if (!spec.startsWith('.') && !spec.startsWith('/')) {
      candidates.push(packageBase, packageBase + '.js', packageBase + '/index.js')
    }
    for (const candidate of candidates) {
      // Missing wrappers load synchronously: React's CJS files require their
      // siblings while executing, and only the top-level wrapper arrives as a
      // script tag. A local server answers the synchronous request immediately.
      if (window.__DSH_PREVIEW_CJS__[candidate] === undefined && window.__DSH_SYNC_LOAD__ !== undefined) {
        window.__DSH_SYNC_LOAD__(candidate)
      }
      const factory = window.__DSH_PREVIEW_CJS__[candidate]
      if (factory === undefined) continue
      let record = cache.get(candidate)
      if (record === undefined) {
        record = { exports: {} }
        cache.set(candidate, record)
        factory(record, record.exports, createRequire(candidate))
      }
      return record.exports
    }
    throw new Error('preview loader: cannot resolve ' + spec + ' from ' + url)
  }
}

/** Load and run one CJS wrapper synchronously, ignoring an already-present key. */
globalThis.__DSH_SYNC_LOAD__ = function syncLoad(url) {
  try {
    const request = new XMLHttpRequest()
    request.open('GET', url, false)
    request.send(null)
    if (request.status >= 200 && request.status < 300) {
      ;(0, eval)(request.responseText)
    }
  } catch (error) {
    console.warn('preview loader: synchronous load failed for ' + url, error)
  }
}
`

const PACKAGE_JSON_CACHE = new Map()

async function packageMain(dir) {
  if (PACKAGE_JSON_CACHE.has(dir)) return PACKAGE_JSON_CACHE.get(dir)
  const manifest = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
  const main = typeof manifest.main === 'string' ? manifest.main : 'index.js'
  PACKAGE_JSON_CACHE.set(dir, main)
  return main
}

/**
 * Wrap one CJS file as a module function the browser loader can execute.
 * @param absolute - upstream CJS file path.
 * @param url - the `/__cjs/...` URL the loader will use as this module's id.
 * @returns the wrapper source.
 */
async function wrapCjs(absolute, url) {
  const source = await readFile(absolute, 'utf8')
  // The wrapper may load before any other wrapper, so it creates the registry;
  // React's upstream files read `process.env.NODE_ENV`, which a browser lacks.
  return `;(window.__DSH_PREVIEW_CJS__ ??= {})[${JSON.stringify(url)}] = function (module, exports, require) {\n`
    + `var process = globalThis.process ?? (globalThis.process = { env: { NODE_ENV: 'development' } })\n`
    + `${source}\n}\n`
}

/**
 * Map a `/__cjs/<prefix>/<rest>` request onto an upstream file and the URL the
 * loader registers it under (the URL is the logical `/__cjs/<prefix>/<rest>`
 * form, never the pnpm directory the file actually lives in).
 * @param pathname - the request path.
 * @returns the upstream path plus its loader id, or undefined when unmatched.
 */
function cjsTarget(pathname) {
  if (!pathname.startsWith('/__cjs/')) return undefined
  const rest = pathname.slice('/__cjs/'.length)
  for (const [prefix, root] of CJS_PACKAGES) {
    if (!rest.startsWith(prefix)) continue
    const file = resolve(join(root, rest.slice(prefix.length)))
    if (file.startsWith(resolve(root))) return { file, url: `/__cjs/${rest}` }
  }
  return undefined
}

/**
 * Resolve an otherwise-unknown `/__cjs/<pkg>/<rest>` path by looking for the
 * package inside the pnpm store (the store's directory names carry the exact
 * peer-suffixed package id, so this is a search rather than a mapping).
 * @param pathname - the request path.
 * @returns the upstream file path when one exists.
 */
async function resolveFromStore(pathname) {
  const rest = pathname.slice('/__cjs/'.length)
  const slash = rest.indexOf('/')
  if (slash <= 0) return undefined
  const pkg = rest.slice(0, slash)
  const entry = rest.slice(slash + 1)
  const scoped = pkg.startsWith('@') ? pkg.slice(0, pkg.indexOf('/', 1)) : pkg
  const segments = pkg.split('/')
  let names
  try {
    names = await readdir(PNPM)
  } catch {
    return undefined
  }
  const candidates = names
    .filter(name => name === scoped || name.startsWith(`${scoped}@`))
    .sort()
  for (const name of candidates) {
    const base = join(PNPM, name, 'node_modules', ...segments)
    const file = resolve(join(base, entry))
    if (!file.startsWith(resolve(join(PNPM, name, 'node_modules')))) continue
    const info = await stat(file).catch(() => null)
    if (info === null) continue
    if (info.isDirectory()) {
      const main = join(file, await packageMain(file))
      const mainInfo = await stat(main).catch(() => null)
      if (mainInfo !== null && mainInfo.isFile()) return main
      continue
    }
    if (info.isFile()) return file
  }
  return undefined
}

/**
 * Pull the workbench stylesheet out of the built bundle. The plugin build
 * inlines each module stylesheet as a JSON string literal, so this is exactly
 * the CSS the browser plugin injects.
 * @param bundle - the built client.js text.
 * @returns the Workbench.module.css text.
 */
function extractWorkbenchCss(bundle) {
  const match = /const css = ("(?:[^"\\]|\\.)*");\s*\n\s*const tagId = "([^"]+)"/g
  let found
  while ((found = match.exec(bundle)) !== null) {
    if (found[2].endsWith('Workbench.module.css')) return JSON.parse(found[1])
  }
  throw new Error('serve: the bundle carries no Workbench.module.css style block')
}

async function readOrNull(path) {
  try {
    const info = await stat(path)
    if (!info.isFile()) return null
    return await readFile(path)
  } catch {
    return null
  }
}

const server = createServer((request, response) => {
  void (async () => {
    const url = new URL(request.url ?? '/', `http://127.0.0.1:${String(PORT)}`)
    // Cache-busting query keys are ignored: they exist only to defeat the
    // browser's module map while iterating on the preview.
    const pathname = decodeURIComponent(url.pathname)
    const send = (status, type, body) => {
      response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
      response.end(body)
    }

    if (pathname === '/__cjs/loader.js') {
      send(200, MIME['.js'], LOADER_SOURCE)
      return
    }
    if (pathname.startsWith('/__cjs/')) {
      const resolved = cjsTarget(pathname) ?? await resolveFromStore(pathname).then(file => (
        file === undefined ? undefined : { file, url: pathname }
      ))
      if (resolved === undefined) {
        send(404, 'text/plain', 'not a preview cjs path')
        return
      }
      let target = resolved.file
      const info = await stat(target).catch(() => null)
      if (info !== null && info.isDirectory()) target = join(target, await packageMain(target))
      const body = await readOrNull(target)
      if (body === null) {
        send(404, 'text/plain', `missing ${target}`)
        return
      }
      send(200, MIME['.js'], await wrapCjs(target, resolved.url))
      return
    }
    if (pathname in FACADES) {
      send(200, MIME['.js'], facadeSource(FACADES[pathname]))
      return
    }
    if (pathname === '/workbench.css') {
      const bundle = await readOrNull(join(CHECKOUT, 'packages', 'client', 'ui-sidebar', 'lib', 'client.js'))
      if (bundle === null) {
        send(404, 'text/plain', 'bundle missing')
        return
      }
      send(200, MIME['.css'], extractWorkbenchCss(bundle.toString('utf8')))
      return
    }
    if (pathname === '/__status') {
      const bundle = await readOrNull(join(CHECKOUT, 'packages', 'client', 'ui-sidebar', 'lib', 'client.js'))
      send(200, MIME['.json'], JSON.stringify({
        checkout: resolve(CHECKOUT),
        bundle: bundle === null ? null : { bytes: bundle.length, hasWorkbench: bundle.toString('utf8').includes('dsh.workbench.v1') },
      }))
      return
    }

    const statics = {
      '/': join(here, 'index.html'),
      '/index.html': join(here, 'index.html'),
      '/main.js': join(here, 'main.js'),
      '/plugins/client.js': join(CHECKOUT, 'packages', 'client', 'ui-sidebar', 'lib', 'client.js'),
      '/__vendor/ui-slots': join(here, 'stubs', 'ui-slots.js'),
      '/__vendor/ui-primitives': join(here, 'stubs', 'ui-primitives.js'),
      '/__vendor/client-store': join(here, 'stubs', 'client-store.js'),
    }
    const target = statics[pathname]
    if (target === undefined) {
      send(404, 'text/plain', 'not found')
      return
    }
    const body = await readOrNull(target)
    if (body === null) {
      send(404, 'text/plain', `missing ${target}`)
      return
    }
    send(200, MIME[extname(target)] ?? 'application/octet-stream', body)
  })().catch((error) => {
    response.writeHead(500).end(String(error))
  })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`workbench preview: http://127.0.0.1:${String(PORT)}/`)
  console.log(`  status:   http://127.0.0.1:${String(PORT)}/__status`)
  console.log(`  checkout: ${resolve(CHECKOUT)}`)
})
