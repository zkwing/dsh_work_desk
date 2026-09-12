/**
 * Probe the RUNNING DSH Desktop web surface.
 *
 * The desktop composition serves the page through its own asset handler rather
 * than `dsh web`'s webserver, and its `/plugins` route answers 404 for any URL
 * it did not advertise. So this asks the same questions `check-live-host.mjs`
 * asks, but against whatever the app is actually serving right now, and prints
 * what it finds instead of only pass/fail — the point is diagnosis.
 *
 * Usage: node probe-running-app.mjs [origin] [packageName] [token]
 */
import { get } from 'node:http'

const base = process.argv[2] ?? 'http://127.0.0.1:43120'
const packageName = process.argv[3] ?? 'dsh-workbench'
const token = process.argv[4] ?? ''
const origin = new URL(base)

function request(path, headers = {}) {
  return new Promise((resolve) => {
    const req = get({
      host: origin.hostname,
      port: origin.port,
      path,
      headers: { host: origin.host, accept: '*/*', ...headers },
    }, (res) => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve({
        status: res.statusCode ?? 0,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }))
    })
    req.on('error', (error) => resolve({ status: 0, headers: {}, body: `ERROR ${error.message}` }))
  })
}

console.log(`origin: ${base}`)
console.log('')

const paths = [
  '/',
  token === '' ? undefined : `/?token=${encodeURIComponent(token)}`,
  `/${token === '' ? '' : `?token=${encodeURIComponent(token)}`}`,
  '/manifest.webmanifest',
  `/plugins/${packageName}/client.js`,
].filter(Boolean)

for (const path of paths) {
  const response = await request(path)
  console.log(`GET ${path}`)
  console.log(`  status=${response.status} bytes=${response.body.length} type=${response.headers['content-type'] ?? '-'}`)
  if (response.status === 200) {
    const html = response.body
    const combo = /preload" as="script" href="(\/plugins\/\?\?[^"]*)"/.exec(html)?.[1]
    console.log(`  mentions ${packageName}: ${html.includes(packageName)}`)
    console.log(`  has __DSH_BOOT__: ${html.includes('__DSH_BOOT__')}`)
    console.log(`  application combo: ${combo === undefined ? 'none' : `${combo.slice(0, 90)}… (${combo.length} chars)`}`)
    if (combo !== undefined) {
      console.log(`  combo lists ${packageName}: ${combo.includes(`${packageName}/client.js`)}`)
    }
  } else if (response.body.length > 0 && response.body.length < 400) {
    console.log(`  body: ${JSON.stringify(response.body.slice(0, 200))}`)
  }
  console.log('')
}
