// Collect every import specifier reachable from the preview's vendor files and
// report which ones a browser could not resolve.
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const CHECKOUT = process.env.DSH_CHECKOUT ?? 'D:\\1_SoftWare\\DeepSeek_Harness\\deepseek-harness'
const vendor = join(CHECKOUT, 'node_modules', '.pnpm')
const roots = [
  join(vendor, 'react@18.3.1', 'node_modules', 'react', 'index.js'),
  join(vendor, 'react@18.3.1', 'node_modules', 'react', 'jsx-runtime.js'),
  join(vendor, 'react-dom@18.3.1_react@18.3.1', 'node_modules', 'react-dom', 'client.js'),
  join(CHECKOUT, 'packages', 'client', 'ui-sidebar', 'lib', 'client.js'),
  join(here, 'stubs', 'ui-slots.js'),
  join(here, 'stubs', 'client-store.js'),
  join(here, 'stubs', 'ui-primitives.js'),
]

const importMapKeys = new Set([
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
  '@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-primitives',
])

const specifierRe = /(?:^|\n)\s*(?:import|export)[^'"\n]*?from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g

const visited = new Set()
const bare = new Map()

async function visit(file) {
  if (visited.has(file)) return
  visited.add(file)
  let text
  try {
    text = await readFile(file, 'utf8')
  } catch {
    return
  }
  for (const match of text.matchAll(specifierRe)) {
    const spec = match[1] ?? match[2] ?? match[3]
    if (spec === undefined) continue
    if (spec.startsWith('.') || spec.startsWith('/')) {
      // Relative: the browser follows the same relative path from the served URL.
      const target = resolve(dirname(file), spec)
      await visit(target)
      continue
    }
    if (!importMapKeys.has(spec)) bare.set(spec, file)
  }
}

for (const file of roots) await visit(file)

console.log(`scanned ${visited.size} files`)
if (bare.size === 0) {
  console.log('OK: every import specifier is either relative or in the preview import map')
} else {
  console.log('UNRESOLVED bare specifiers (the import map must answer these):')
  for (const [spec, owner] of bare) console.log(`  ${spec}  <- ${owner.replace(CHECKOUT, '<checkout>')}`)
}
