<#
.SYNOPSIS
  Builds the standalone `dsh-workbench` plugin inside a DSH checkout.

.DESCRIPTION
  The plugin is authored in this folder and compiled with the checkout's own DSH
  client preset, so the emitted lib/client.js has exactly the closure-factory
  format the browser module system executes. The build is staged: sources are
  copied into <checkout>/packages/plugins/dsh-workbench (never into an official
  package), built there, and the artifacts are copied back here.

  The staged copy declares `private: true`, so pnpm workspace discovery ignores
  it. The plugin reaches a profile by path, which is how any out-of-tree plugin
  is installed.

.PARAMETER Checkout
  DSH checkout root containing packages/client/tsdown.client.ts.

.PARAMETER SkipBuild
  Only stage the sources; do not compile.

.PARAMETER Clean
  Remove the staged package and its generated build script after a build.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File build-plugin.ps1
#>
[CmdletBinding()]
param(
  [string]$Checkout = 'D:\1_SoftWare\DeepSeek_Harness\deepseek-harness',
  [switch]$SkipBuild,
  [switch]$Clean
)

$ErrorActionPreference = 'Stop'

$here = $PSScriptRoot
$stage = Join-Path $Checkout 'packages\plugins\dsh-workbench'
$tsc = Join-Path $Checkout 'node_modules\.bin\tsc.cmd'
$tsdown = Join-Path $Checkout 'node_modules\.bin\tsdown.cmd'

function Assert-Path([string]$Path, [string]$What) {
  if (-not (Test-Path -LiteralPath $Path)) { throw "dsh-workbench build: $What not found at $Path" }
}

<#
  Write UTF-8 without a byte-order mark. Windows PowerShell's
  `Set-Content -Encoding UTF8` emits a BOM, and a BOM makes package.json and
  tsconfig.json invalid JSON for the bundler's manifest reader.
#>
function Write-Utf8NoBom([string]$Path, [string]$Text) {
  [System.IO.File]::WriteAllText($Path, $Text, [System.Text.UTF8Encoding]::new($false))
}

Assert-Path $Checkout 'DSH checkout'
Assert-Path (Join-Path $Checkout 'packages\client\tsdown.client.ts') 'DSH client bundle preset'
Assert-Path (Join-Path $here 'src\client\index.ts') 'plugin client entry'

# ── 1. stage the sources ─────────────────────────────────────────────────────

Write-Host "==> staging sources into $stage"
if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stage | Out-Null
foreach ($entry in @('src', 'package.json', 'cordis.patch.yml', 'README.md')) {
  $from = Join-Path $here $entry
  if (Test-Path -LiteralPath $from) { Copy-Item -LiteralPath $from -Destination $stage -Recurse -Force }
}

# The host half is compiled by the same tsc pass as the browser half (both live
# under src/), then shipped as lib/index.js. It is copied here only so that a
# partially-staged tree still has a loadable entry; step 4 overwrites it with
# the compiled artifact.
Write-Host '==> host half (compiled by tsc in step 2)'
New-Item -ItemType Directory -Force -Path (Join-Path $stage 'lib') | Out-Null

# tsc emits lib/types, the entry the shared client preset bundles. The path
# overrides point at the consumed packages' BUILT declarations rather than their
# sources: this plugin is out-of-tree, so its program must contain only its own
# files (that is what keeps rootDir/outDir coherent), and those declarations are
# the same public contract the packages publish. `composite`/`references` are
# dropped because the inherited base sets them for in-repo projects.
$tsconfig = @'
{
  "extends": "../../../tsconfig.base.client.json",
  "compilerOptions": {
    "composite": false,
    "incremental": false,
    "rootDir": "src",
    "outDir": "lib/types",
    "paths": {
      "react": ["./../../client/ui-sidebar/node_modules/@types/react/index.d.ts"],
      "react/jsx-runtime": ["./../../client/ui-sidebar/node_modules/@types/react/jsx-runtime.d.ts"],
      "@deepseek-ai/cordis": ["./../../../vendor/cordis/lib/types/index.d.ts"],
      "@deepseek-ai/dsh-client-ui-slots": ["./../../client/ui-slots/lib/types/index.d.ts"],
      "@deepseek-ai/dsh-client-ui-renderer/client": ["./../../client/ui-renderer/lib/types/client/index.d.ts"],
      "@deepseek-ai/dsh-client-ui-sidebar/client": ["./../../client/ui-sidebar/lib/types/client/index.d.ts"],
      "@deepseek-ai/dsh-client-locale/client": ["./../../client/locale/lib/types/client/index.d.ts"],
      "@deepseek-ai/dsh-client-ui-primitives": ["./../../client/ui-primitives/lib/types/index.d.ts"],
      "@deepseek-ai/dsh-client-ui-workspace/client": ["./../../client/ui-workspace/lib/types/client/navigation.d.ts"],
      "@deepseek-ai/dsh-client-ui-layout/client": ["./../../client/ui-layout/lib/types/client/index.d.ts"],
      "@deepseek-ai/dsh-api-workspace-controller/client": ["./../../api/workspace-controller/lib/types/client/index.d.ts"],
      "@deepseek-ai/dsh-api-workspace-files/remote": ["./../../api/workspace-files/lib/typert.remote-client.d.ts"],
      "@deepseek-ai/dsh-client-ui-sidebar-right/client": ["./../../client/ui-sidebar-right/lib/types/client/index.d.ts"],
      "@deepseek-ai/dsh-session/types": ["./../../core/session/lib/types/types.d.ts"]
    }
  },
  "references": [],
  "include": ["src"]
}
'@
Write-Utf8NoBom (Join-Path $stage 'tsconfig.json') $tsconfig

if ($SkipBuild) {
  Write-Host 'Staged only. Compile with:'
  Write-Host "  & '$tsc' -p 'packages\plugins\dsh-workbench\tsconfig.json'   (from $Checkout)"
  Write-Host "  & '$tsdown' --config 'packages\plugins\tsdown.workbench.config.ts'   (from $Checkout)"
  return
}

# ── 2. tsc: emit lib/types ───────────────────────────────────────────────────

Assert-Path $tsc 'tsc'
Write-Host '==> tsc -p (emit lib/types)'
Push-Location $Checkout
try {
  & $tsc -p 'packages\plugins\dsh-workbench\tsconfig.json'
  if ($LASTEXITCODE -ne 0) { throw "dsh-workbench build: tsc exited with $LASTEXITCODE" }
} finally { Pop-Location }

# ── 3. browser bundle ────────────────────────────────────────────────────────

# tsdown runs through its CLI with an explicit --config: a bare programmatic
# build() call discovers every tsdown.config.ts in the checkout instead of the
# one it was handed. The generated config lives next to the package, which
# makes the plugin's own location the stable anchor for its absolute entry —
# the preset's relative entries would otherwise resolve against the checkout
# root, since this package is not a pnpm workspace member.
$CheckoutAt = $Checkout -replace '\\', '/'
$stagedConfig = Join-Path $Checkout 'packages\plugins\tsdown.workbench.config.ts'
$configSource = @"
// Generated by plugins/dsh-workbench/build-plugin.ps1 - do not edit in place.
//
// The host half is not built here: it is a package name, an empty inject list,
// and a no-op apply, so bundling it would only add a build step to 25 lines of
// JavaScript. Only the browser half goes through the DSH client preset.
//
// Both the entry and the output directory are absolute: this package is not a
// pnpm workspace member, so tsdown resolves the preset's relative paths against
// the checkout root rather than the package directory.
import { clientConfig } from '../client/tsdown.client.ts'

const packageDir = '$CheckoutAt/packages/plugins/dsh-workbench'

export default {
  ...clientConfig('dsh-workbench', packageDir + '/lib/types/client/index.js'),
  outDir: packageDir + '/lib',
}
"@
Write-Utf8NoBom $stagedConfig $configSource

Assert-Path $tsdown 'tsdown'
Write-Host '==> tsdown (browser half)'
Push-Location $Checkout
# tsdown prints its progress on stderr. Windows PowerShell 5.1 wraps a native
# command's stderr in an ErrorRecord, and the script-wide
# $ErrorActionPreference = 'Stop' would then abort before the exit code is read,
# so the preference is relaxed for exactly this call.
$previousPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
  & $tsdown --config 'packages\plugins\tsdown.workbench.config.ts'
  $bundleExit = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $previousPreference
  Pop-Location
}
if ($bundleExit -ne 0) { throw "dsh-workbench build: the browser bundle step exited with $bundleExit" }

# ── 4. verify and collect ────────────────────────────────────────────────────

$bundle = Join-Path $stage 'lib\client.js'
Assert-Path $bundle 'built client bundle'
# The two slot keys the plugin claims are the marker: they are the strings that
# must survive any refactor of the plugin's own copy or model, because those
# registrations are what make it appear at all.
foreach ($marker in @('sidebar.panellist', 'workbench')) {
  if (-not (Select-String -LiteralPath $bundle -Pattern $marker -SimpleMatch -Quiet)) {
    throw "dsh-workbench build: $bundle carries no $marker registration; the client bundle did not build"
  }
}

# The host half compiles to lib/types/index.js (rootDir src → outDir lib/types)
# and is shipped at lib/index.js, which `main` in package.json names.
Write-Host '==> collecting artifacts back into $here\lib'
$lib = Join-Path $here 'lib'
New-Item -ItemType Directory -Force -Path $lib | Out-Null
Copy-Item -Path (Join-Path $stage 'lib\client.js') -Destination $lib -Force
if (Test-Path -LiteralPath (Join-Path $stage 'lib\client.js.map')) {
  Copy-Item -Path (Join-Path $stage 'lib\client.js.map') -Destination $lib -Force
}
$hostEntry = Join-Path $stage 'lib\types\index.js'
Assert-Path $hostEntry 'compiled host half'
Copy-Item -Path $hostEntry -Destination (Join-Path $lib 'index.js') -Force
$hostTypes = Join-Path $stage 'lib\types\index.d.ts'
if (Test-Path -LiteralPath $hostTypes) {
  Copy-Item -Path $hostTypes -Destination (Join-Path $lib 'index.d.ts') -Force
}

# The published declarations: the client half is exported on purpose (another
# plugin may mount the panel itself), so its `.d.ts` tree ships beside the
# bundle. Only declarations are copied — the emitted `.js` siblings ARE the
# browser half, which the bundle above already carries.
$stagedTypes = Join-Path $stage 'lib\types'
$shippedTypes = Join-Path $lib 'types'
if (Test-Path -LiteralPath $stagedTypes) {
  Get-ChildItem -LiteralPath $stagedTypes -Recurse -File -Filter '*.d.ts' | ForEach-Object {
    $target = Join-Path $shippedTypes $_.FullName.Substring($stagedTypes.Length + 1)
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
    Copy-Item -LiteralPath $_.FullName -Destination $target -Force
  }
}

$size = (Get-Item -LiteralPath (Join-Path $lib 'client.js')).Length
Write-Host ''
Write-Host "OK  lib/client.js built ($size bytes)"

if ($Clean) {
  Write-Host "==> removing staged sources at $stage"
  Remove-Item -LiteralPath $stage -Recurse -Force
  Remove-Item -LiteralPath (Join-Path $Checkout 'packages\plugins\tsdown.workbench.config.ts') -Force
} else {
  Write-Host "    staged sources remain at $stage (use -Clean to remove them)"
}
