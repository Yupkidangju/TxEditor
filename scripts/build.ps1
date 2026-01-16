param(
  [ValidateSet('release', 'debug')]
  [string]$Profile = 'release',
  [bool]$CopyArtifacts = $true,
  [switch]$SkipNpmCi,
  [switch]$SkipRustCheck,
  [switch]$SkipQualityGates,
  [switch]$SkipBuild,
  [string]$NotifyUrl = $env:BUILD_NOTIFY_URL
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$OutputEncoding = [System.Text.UTF8Encoding]::new()
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

function New-Directory([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Get-Timestamp() {
  return (Get-Date).ToString('yyyyMMdd-HHmmss')
}

function Write-Log([string]$Level, [string]$Message) {
  $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss.fff')
  Write-Output "[$ts][$Level] $Message"
}

function Get-SafeFileName([string]$Name) {
  return ($Name -replace '[^a-zA-Z0-9._-]+', '_')
}

function Invoke-External([string]$DisplayName, [string]$FilePath, [string[]]$ArgumentList, [string]$WorkingDirectory, [string]$LogDir) {
  $argLine = ($ArgumentList | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } }) -join ' '
  $safe = Get-SafeFileName $DisplayName
  $logPath = Join-Path $LogDir ("step-$safe.log")
  Write-Log 'INFO' "$($DisplayName): $FilePath $argLine"
  Push-Location -LiteralPath $WorkingDirectory
  try {
    "[$((Get-Date).ToString('o'))] $FilePath $argLine" | Out-File -LiteralPath $logPath -Append -Encoding utf8
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
      & $FilePath @ArgumentList 2>&1 | Out-File -LiteralPath $logPath -Append -Encoding utf8
    } finally {
      $ErrorActionPreference = $prevEap
    }
    if ($LASTEXITCODE -ne 0) {
      throw "$DisplayName failed (exit code $LASTEXITCODE). Log: $logPath"
    }
    Write-Log 'INFO' "$($DisplayName) done"
  } finally {
    Pop-Location
  }
}

function Find-RcDir() {
  $candidateRoots = @()
  if ($env:ProgramFiles) { $candidateRoots += (Join-Path $env:ProgramFiles 'Windows Kits\10\bin') }
  $pf86 = [Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
  if ($pf86) { $candidateRoots += (Join-Path $pf86 'Windows Kits\10\bin') }
  $candidateRoots += 'C:\Program Files (x86)\Windows Kits\10\bin'
  $candidateRoots += 'C:\Program Files\Windows Kits\10\bin'

  $archSubdir = 'x64'
  if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { $archSubdir = 'arm64' }
  if ($env:PROCESSOR_ARCHITECTURE -eq 'x86') { $archSubdir = 'x86' }

  foreach ($root in $candidateRoots | Select-Object -Unique) {
    if (-not (Test-Path -LiteralPath $root)) { continue }
    $versionDirs = Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending
    foreach ($vd in $versionDirs) {
      $rc = Join-Path $vd.FullName (Join-Path $archSubdir 'rc.exe')
      if (Test-Path -LiteralPath $rc) { return (Split-Path -Parent $rc) }
    }
  }
  return $null
}

function Ensure-RcOnPath() {
  $rcInPath = $false
  foreach ($dir in ($env:Path -split ';')) {
    if (-not $dir) { continue }
    if (Test-Path -LiteralPath (Join-Path $dir 'rc.exe')) { $rcInPath = $true; break }
  }

  if ($rcInPath) { return }

  $rcDir = Find-RcDir
  if (-not $rcDir) {
    throw 'Could not find rc.exe. Ensure Windows SDK (Windows Kits 10/11) is installed.'
  }

  $env:Path = "$rcDir;$env:Path"
  Write-Log 'INFO' "Added rc.exe directory to PATH: $rcDir"
}

function Get-FileHashSha256([string]$Path) {
  $h = Get-FileHash -Algorithm SHA256 -LiteralPath $Path
  return @{
    path = $Path
    sha256 = $h.Hash.ToLowerInvariant()
    length = (Get-Item -LiteralPath $Path).Length
    lastWriteTime = (Get-Item -LiteralPath $Path).LastWriteTime.ToString('o')
  }
}

function Write-IntegrityManifest([string]$OutputPath, [string[]]$Paths) {
  $items = @()
  foreach ($p in $Paths) {
    if (-not (Test-Path -LiteralPath $p)) { continue }
    $item = Get-Item -LiteralPath $p
    if ($item.PSIsContainer) {
      $files = Get-ChildItem -LiteralPath $p -Recurse -File -ErrorAction SilentlyContinue
      foreach ($f in $files) { $items += (Get-FileHashSha256 -Path $f.FullName) }
    } else {
      $items += (Get-FileHashSha256 -Path $p)
    }
  }

  $manifest = @{
    generatedAt = (Get-Date).ToString('o')
    project = 'TxEditor'
    profile = $Profile
    items = $items
  }
  $manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
}

function Copy-IfExists([string]$Source, [string]$DestDir) {
  if (-not (Test-Path -LiteralPath $Source)) { return }
  New-Directory $DestDir
  $item = Get-Item -LiteralPath $Source
  if ($item.PSIsContainer) {
    Copy-Item -LiteralPath (Join-Path $Source '*') -Destination $DestDir -Recurse -Force
  } else {
    Copy-Item -LiteralPath $Source -Destination $DestDir -Force
  }
}

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ts = Get-Timestamp

$buildRoot = Join-Path $root '.build'
$logsDir = Join-Path $buildRoot 'logs'
$artifactsDir = Join-Path $buildRoot 'artifacts'
$rollbackDir = Join-Path $buildRoot 'rollback'

New-Directory $buildRoot
New-Directory $logsDir
New-Directory $artifactsDir
New-Directory $rollbackDir

$runDir = Join-Path $artifactsDir $ts
New-Directory $runDir
$stepLogsDir = Join-Path $runDir 'steps'
New-Directory $stepLogsDir

$transcriptPath = Join-Path $logsDir ("build-$ts.transcript.log")
$summaryPath = Join-Path $runDir 'summary.json'
$integrityPath = Join-Path $runDir 'integrity.json'

$start = Get-Date
$status = 'success'
$errorMessage = $null

Start-Transcript -LiteralPath $transcriptPath -Force | Out-Null
try {
  Write-Log 'INFO' "Build start: $ts"
  Write-Log 'INFO' "Project root: $root"

  if (-not (Test-Path -LiteralPath (Join-Path $root 'package-lock.json'))) { throw 'Missing package-lock.json (lockfile required for reproducible builds).' }
  if (-not (Test-Path -LiteralPath (Join-Path $root 'src-tauri\Cargo.lock'))) { throw 'Missing src-tauri\\Cargo.lock (lockfile required for reproducible builds).' }

  Ensure-RcOnPath

  $backupDir = Join-Path $rollbackDir $ts
  New-Directory $backupDir
  Copy-IfExists (Join-Path $root 'dist') (Join-Path $backupDir 'dist')
  Copy-IfExists (Join-Path $root 'src-tauri\target\release\txeditor.exe') (Join-Path $backupDir 'release')
  Copy-IfExists (Join-Path $root 'src-tauri\target\release\bundle') (Join-Path $backupDir 'bundle')

  if (-not $SkipNpmCi) {
    Invoke-External 'npm ci' 'npm.cmd' @('ci') $root $stepLogsDir
  }

  Invoke-External 'Rust fetch' 'cargo' @('fetch', '--locked') (Join-Path $root 'src-tauri') $stepLogsDir

  if (-not $SkipRustCheck) {
    Invoke-External 'Rust check' 'cargo' @('check', '--locked') (Join-Path $root 'src-tauri') $stepLogsDir
  }

  if (-not $SkipQualityGates) {
    Invoke-External 'lint' 'npm.cmd' @('run', 'lint') $root $stepLogsDir
    Invoke-External 'typecheck' 'npm.cmd' @('run', 'typecheck') $root $stepLogsDir
    Invoke-External 'test' 'npm.cmd' @('run', 'test') $root $stepLogsDir
    Invoke-External 'Rust test' 'cargo' @('test', '--locked') (Join-Path $root 'src-tauri') $stepLogsDir
  }

  if (-not $SkipBuild) {
    if ($Profile -eq 'debug') {
      Invoke-External 'tauri build' 'npm.cmd' @('run', 'tauri', 'build', '--', '--debug') $root $stepLogsDir
    } else {
      Invoke-External 'tauri build' 'npm.cmd' @('run', 'tauri', 'build') $root $stepLogsDir
    }
  }

  $releaseExe = Join-Path $root 'src-tauri\target\release\txeditor.exe'
  $bundleDir = Join-Path $root 'src-tauri\target\release\bundle'
  $distDir = Join-Path $root 'dist'

  $bundleFiles = @()
  if (Test-Path -LiteralPath $bundleDir) {
    $bundleFiles = Get-ChildItem -LiteralPath $bundleDir -Recurse -File -ErrorAction SilentlyContinue |
      Where-Object { $_.Extension -in @('.msi', '.exe') } |
      Select-Object -ExpandProperty FullName
  }

  $integrityTargets = @($releaseExe, $distDir, $bundleDir) | Where-Object { $_ }
  Write-IntegrityManifest -OutputPath $integrityPath -Paths $integrityTargets

  if ($CopyArtifacts) {
    Copy-IfExists $releaseExe (Join-Path $runDir 'release')
    foreach ($f in $bundleFiles) { Copy-IfExists $f (Join-Path $runDir 'bundle') }
    Copy-IfExists $transcriptPath $runDir
  }

  $quality = @{
    lockfilesPresent = $true
    rcExeOnPath = $true
  }

  $durationSec = [math]::Round(((Get-Date) - $start).TotalSeconds, 3)
  $summary = @{
    project = 'TxEditor'
    profile = $Profile
    startedAt = $start.ToString('o')
    finishedAt = (Get-Date).ToString('o')
    durationSec = $durationSec
    status = $status
    artifactsDir = $runDir
    transcriptPath = $transcriptPath
    integrityPath = $integrityPath
    quality = $quality
  }
  $summary | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $summaryPath -Encoding UTF8

  if ($NotifyUrl) {
    try {
      $payload = @{
        text = "TxEditor build $status ($Profile) - $ts"
        data = $summary
      } | ConvertTo-Json -Depth 8
      Invoke-RestMethod -Method Post -Uri $NotifyUrl -ContentType 'application/json' -Body $payload | Out-Null
      Write-Log 'INFO' "Notification sent: $NotifyUrl"
    } catch {
      Write-Log 'WARN' "Notification failed: $($_.Exception.Message)"
    }
  }

  Write-Log 'INFO' 'Build completed'
} catch {
  $status = 'failure'
  $errorMessage = $_.Exception.Message
  Write-Log 'ERROR' $errorMessage

  try {
    $candidateBackup = Join-Path $rollbackDir $ts
    if (Test-Path -LiteralPath $candidateBackup) {
      $distBackup = Join-Path $candidateBackup 'dist'
      $releaseBackup = Join-Path $candidateBackup 'release\txeditor.exe'
      $bundleBackup = Join-Path $candidateBackup 'bundle'

      if (Test-Path -LiteralPath $distBackup) {
        Remove-Item -LiteralPath (Join-Path $root 'dist') -Recurse -Force -ErrorAction SilentlyContinue
        New-Directory (Join-Path $root 'dist')
        Copy-Item -LiteralPath (Join-Path $distBackup '*') -Destination (Join-Path $root 'dist') -Recurse -Force
      }
      if (Test-Path -LiteralPath $releaseBackup) {
        Copy-Item -LiteralPath $releaseBackup -Destination (Join-Path $root 'src-tauri\target\release\txeditor.exe') -Force
      }
      if (Test-Path -LiteralPath $bundleBackup) {
        Remove-Item -LiteralPath (Join-Path $root 'src-tauri\target\release\bundle') -Recurse -Force -ErrorAction SilentlyContinue
        New-Directory (Join-Path $root 'src-tauri\target\release\bundle')
        Copy-Item -LiteralPath (Join-Path $bundleBackup '*') -Destination (Join-Path $root 'src-tauri\target\release\bundle') -Recurse -Force
      }
      Write-Log 'INFO' 'Rollback completed'
    }
  } catch {
    Write-Log 'WARN' "Rollback failed: $($_.Exception.Message)"
  }

  $durationSec = [math]::Round(((Get-Date) - $start).TotalSeconds, 3)
  $summary = @{
    project = 'TxEditor'
    profile = $Profile
    startedAt = $start.ToString('o')
    finishedAt = (Get-Date).ToString('o')
    durationSec = $durationSec
    status = $status
    errorMessage = $errorMessage
    artifactsDir = $runDir
    transcriptPath = $transcriptPath
  }
  $summary | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $summaryPath -Encoding UTF8

  if ($NotifyUrl) {
    try {
      $payload = @{
        text = "TxEditor build $status ($Profile) - $ts - $errorMessage"
        data = $summary
      } | ConvertTo-Json -Depth 8
      Invoke-RestMethod -Method Post -Uri $NotifyUrl -ContentType 'application/json' -Body $payload | Out-Null
      Write-Log 'INFO' "Notification sent: $NotifyUrl"
    } catch {
      Write-Log 'WARN' "Notification failed: $($_.Exception.Message)"
    }
  }

  exit 1
} finally {
  Stop-Transcript | Out-Null
}
