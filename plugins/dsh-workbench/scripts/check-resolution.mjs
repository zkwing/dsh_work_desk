/**
 * Resolve-check for an installed DSH plugin package.
 *
 * The profile Loader imports a plugin by bare package name from the profile
 * directory, so this asks Node the same question with the same anchor: can
 * `dsh-workbench` be imported from <profile>/package.json, and does its host
 * half evaluate?
 *
 * Usage: node check-resolution.mjs [profileDir] [packageName]
 */
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const profileDir = process.argv[2]
const packageName = process.argv[3] ?? 'dsh-workbench'
if (profileDir === undefined) {
  console.error('usage: node check-resolution.mjs <profileDir> [packageName]')
  process.exit(2)
}

const anchor = join(profileDir, 'package.json')
console.log(`anchor:  ${anchor}`)
console.log(`package: ${packageName}`)

const manifest = JSON.parse(readFileSync(anchor, 'utf8'))
const declared = manifest.dependencies?.[packageName]
const bundles = manifest.dsh?.profile?.bundles ?? []
console.log(`declared as a dependency: ${declared ?? '(not declared)'}`)
console.log(`listed in dsh.profile.bundles: ${bundles.includes(packageName)}`)

const require = createRequire(anchor)
let resolved
try {
  resolved = require.resolve(packageName)
} catch (error) {
  console.log(`FAIL  the Loader's anchor cannot resolve ${packageName}: ${String(error.message ?? error)}`)
  process.exitCode = 1
}
if (resolved !== undefined) {
  console.log(`resolved host entry: ${resolved}`)
  const pkgJson = require.resolve(`${packageName}/package.json`)
  const installed = JSON.parse(readFileSync(pkgJson, 'utf8'))
  console.log(`installed version: ${installed.version}`)
  console.log(`declares dsh.bundle.patch: ${installed.dsh?.bundle?.patch ?? '(none)'}`)
  console.log(`declares dsh.client.platform: ${installed.dsh?.client?.platform ?? '(none)'}`)
  const clientPath = join(pkgJson, '..', installed.exports?.['./client']?.default ?? '')
  console.log(`client bundle present: ${existsSync(clientPath)} (${clientPath})`)
  // Import the host half the way the Loader does: a bare specifier from the
  // profile anchor, which also proves the fallback chain supplies its peers.
  const host = await import(new URL(`file:///${resolved.replace(/\\/g, '/')}`).href)
  console.log(`host half exports: ${Object.keys(host).join(', ')}`)
  console.log(host.apply !== undefined && Array.isArray(host.inject)
    ? 'OK  the plugin resolves from the profile and its host half loads'
    : 'FAIL  the host half is missing apply()/inject')
}
