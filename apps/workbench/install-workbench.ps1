# Workbench installer — installs the sidebar-foot control room into a DSH checkout.
#
# What it touches (all inside the DSH checkout, nothing in $DSH_HOME):
#   packages/client/ui-sidebar/src/client/workbench/*        (new files)
#   packages/client/ui-sidebar/src/client/index.ts           (backed up, then replaced)
#   packages/client/ui-sidebar/lib/types/**                  (tsc build output)
#   packages/client/ui-sidebar/lib/client.js(.map)           (tsdown bundle output)
#
# The sidebar's own client bundle carries the workbench, so no plugin row, no
# profile file, and no frontend dist rebuild is involved.
#
# Usage:
#   pwsh -File install-workbench.ps1                     # install + build
#   pwsh -File install-workbench.ps1 -DryRun             # print the plan only
#   pwsh -File install-workbench.ps1 -SkipBuild          # copy sources only
#   pwsh -File install-workbench.ps1 -Uninstall          # restore the sidebar index

[CmdletBinding()]
param(
  [string]$Checkout = 'D:\1_SoftWare\DeepSeek_Harness\deepseek-harness',
  [switch]$DryRun,
  [switch]$SkipBuild,
  [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'

$here = $PSScriptRoot
$workbenchSource = Join-Path $here 'dsh'
$patchSource = Join-Path $here 'patch'

$sidebarDir = Join-Path $Checkout 'packages\client\ui-sidebar'
$sidebarClient = Join-Path $sidebarDir 'src\client'
$workbenchTarget = Join-Path $sidebarClient 'workbench'
$sidebarIndex = Join-Path $sidebarClient 'index.ts'
$backupIndex = Join-Path $sidebarClient 'index.ts.workbench-backup'

function Assert-Path([string]$Path, [string]$What) {
  if (-not (Test-Path -LiteralPath $Path)) { throw "workbench install: $What not found at $Path" }
}

function Invoke-Step([string]$Description, [scriptblock]$Action) {
  Write-Host "==> $Description"
  if ($DryRun) { return }
  & $Action
}

Assert-Path $Checkout 'DSH checkout'
Assert-Path $sidebarDir 'ui-sidebar package'
Assert-Path $workbenchSource 'workbench sources'

if ($Uninstall) {
  if (Test-Path -LiteralPath $backupIndex) {
    Invoke-Step "restore $sidebarIndex from backup" { Copy-Item -LiteralPath $backupIndex -Destination $sidebarIndex -Force }
    Write-Host 'Restored. Rebuild the sidebar bundle to finish:'
    Write-Host "  & '$Checkout\node_modules\.bin\tsc.cmd' -b packages/client/ui-sidebar"
    Write-Host "  & '$Checkout\node_modules\.bin\tsdown.cmd' --env.DSH_BUILD_FACE client  (from $sidebarDir)"
  } else {
    Write-Host "No backup at $backupIndex - nothing to restore."
  }
  return
}

# ── 1. sources ────────────────────────────────────────────────────────────────

Invoke-Step "copy workbench sources -> $workbenchTarget" {
  New-Item -ItemType Directory -Force -Path $workbenchTarget | Out-Null
  Copy-Item -Path (Join-Path $workbenchSource '*') -Destination $workbenchTarget -Recurse -Force
}

Invoke-Step "back up $sidebarIndex -> $backupIndex" {
  if (-not (Test-Path -LiteralPath $backupIndex)) {
    Copy-Item -LiteralPath $sidebarIndex -Destination $backupIndex -Force
  }
}

Invoke-Step "install the workbench registration into $sidebarIndex" {
  Copy-Item -LiteralPath (Join-Path $patchSource 'ui-sidebar.index.ts') -Destination $sidebarIndex -Force
}

Invoke-Step "install the workbench smoke test into $sidebarDir\tests" {
  Copy-Item -LiteralPath (Join-Path $patchSource 'workbench.client.spec.tsx') -Destination (Join-Path $sidebarDir 'tests\workbench.client.spec.tsx') -Force
}

if ($SkipBuild) {
  Write-Host 'Sources installed. Build with:'
  Write-Host "  & '$Checkout\node_modules\.bin\tsc.cmd' -b packages/client/ui-sidebar   (from $Checkout)"
  Write-Host "  & '$Checkout\node_modules\.bin\tsdown.cmd' --env.DSH_BUILD_FACE client   (from $sidebarDir)"
  return
}

# ── 2. tsc: emit lib/types, which the tsdown client entry consumes ────────────

Invoke-Step 'tsc -b packages/client/ui-sidebar' {
  $tsc = Join-Path $Checkout 'node_modules\.bin\tsc.cmd'
  Assert-Path $tsc 'tsc'
  Push-Location $Checkout
  try {
    & $tsc -b packages/client/ui-sidebar
    if ($LASTEXITCODE -ne 0) { throw "workbench install: tsc failed with exit code $LASTEXITCODE" }
  } finally { Pop-Location }
}

# ── 3. tsdown: rebuild lib/client.js, the bundle the Host serves ──────────────

Invoke-Step 'tsdown (client face) for ui-sidebar' {
  $tsdown = Join-Path $Checkout 'node_modules\.bin\tsdown.cmd'
  Assert-Path $tsdown 'tsdown'
  Push-Location $sidebarDir
  try {
    & $tsdown --env.DSH_BUILD_FACE client
    if ($LASTEXITCODE -ne 0) { throw "workbench install: tsdown failed with exit code $LASTEXITCODE" }
  } finally { Pop-Location }
}

# ── 4. verify the artifact really carries the workbench ──────────────────────

if ($DryRun) {
  Write-Host ''
  Write-Host 'Dry run only: nothing was copied and nothing was built.'
  return
}

$bundle = Join-Path $sidebarDir 'lib\client.js'
Assert-Path $bundle 'built sidebar bundle'
$marker = Select-String -LiteralPath $bundle -Pattern 'dsh.workbench.v1' -SimpleMatch -Quiet
if ($marker) {
  $size = (Get-Item -LiteralPath $bundle).Length
  Write-Host ''
  Write-Host "OK  workbench present in $bundle ($size bytes)"
  Write-Host 'Restart DSH Desktop (or rerun `dsh web`) to load the rebuilt bundle, then look at the sidebar foot.'
} else {
  throw "workbench install: $bundle carries no workbench marker; the client bundle did not rebuild"
}
