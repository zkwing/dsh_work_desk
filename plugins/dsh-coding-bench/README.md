# dsh-coding-bench

Empty skeleton of a DSH plugin, version 0.0.1. Both halves (`src/index.ts` for
the Host side, `src/client/index.ts` for the browser side) export a `name`,
an `inject` list, and an `apply` function — the minimum the DSH loader
expects — and do nothing else.

## What works

`build-plugin.ps1 -Clean` produces a loadable bundle (`lib/index.js` +
`lib/client.js` + the shipped type declarations) inside this folder, ready
for `dsh plugin add` by path, by tarball, or by git URL. The plugin
installs cleanly and presents no UI.

## What's missing

Almost everything. The two `apply` functions are empty, the `inject` lists
are empty, and the bundle marker grep inside `build-plugin.ps1` only checks
for the plugin id `coding-bench`. The moment a real `apply` calls
`ctx.slots.register(...)`, add the slot names the plugin claims to that
list — otherwise the build will still pass but the contract is no longer
verified.

## How to rename

- `package.json` — `name` field, every `dsh-coding-bench` occurrence
- `cordis.patch.yml` — `id: coding-bench` (the part after `dsh-`)
- `build-plugin.ps1` — the four hard-coded `dsh-coding-bench` / `coding-bench` / `tsdown.coding-bench.config.ts` strings
- `tsconfig.json` — `paths` (only if you start consuming client packages)
- `src/index.ts` and `src/client/index.ts` — `export const name = '…'`

## Build

```
powershell -ExecutionPolicy Bypass -File build-plugin.ps1
```

The script stages `src/`, `package.json`, `cordis.patch.yml`, and `README.md`
into the DSH checkout at `packages\plugins\dsh-coding-bench`, runs tsc and
tsdown there, and copies the artifacts back to `lib/`. `-Clean` removes
the staged tree and the generated `tsdown` config.
