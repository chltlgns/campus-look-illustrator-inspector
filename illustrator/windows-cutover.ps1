[CmdletBinding()]
param(
    [ValidateSet('Preflight', 'Backup', 'RecordPostState', 'Rollback')]
    [string]$Mode = 'Preflight',
    [string]$BackupRoot = '',
    [string]$LocalRoot = '',
    [string]$ShortcutPath = '',
    [string]$ProgramJsxPath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
chcp 65001 | Out-Null
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)

function Get-FileSha256 {
    param([Parameter(Mandatory = $true)][string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Resolve-ProgramJsxPath {
    $illustrator = Get-Process Illustrator -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -ne $illustrator -and -not [string]::IsNullOrWhiteSpace($illustrator.Path)) {
        $illustratorRoot = Split-Path (Split-Path (Split-Path (Split-Path $illustrator.Path -Parent) -Parent) -Parent) -Parent
    }
    else {
        $illustratorRoot = 'C:\Program Files\Adobe\Adobe Illustrator 2025'
    }
    $presetsRoot = Join-Path $illustratorRoot 'Presets'
    $scriptsDirectory = Get-ChildItem -LiteralPath $presetsRoot -Directory -Recurse -ErrorAction Stop |
        Where-Object { @(Get-ChildItem -LiteralPath $_.FullName -Filter '*.jsx' -File -ErrorAction SilentlyContinue).Count -gt 0 } |
        Select-Object -First 1 -ExpandProperty FullName
    if ([string]::IsNullOrWhiteSpace($scriptsDirectory)) {
        throw "cutover_preflight_failed: Illustrator Scripts directory was not found below $presetsRoot"
    }
    return (Join-Path $scriptsDirectory 'Campuslook Proof Check.jsx')
}

function Get-TargetEntries {
    param(
        [Parameter(Mandatory = $true)][string]$ResolvedLocalRoot,
        [Parameter(Mandatory = $true)][string]$ResolvedShortcutPath,
        [Parameter(Mandatory = $true)][string]$ResolvedProgramJsxPath
    )

    $localFiles = @(
        'run-proof-check.ps1',
        'check-active-illustrator.ps1',
        'FastProofInspector.jsx',
        'batch-check-ai.ps1',
        'CampuslookProofCheck.jsx',
        'inspector-root.ps1',
        'inspector-root.json'
    )
    $entries = @()
    foreach ($name in $localFiles) {
        $entries += [PSCustomObject][ordered]@{
            id = "local/$name"
            path = Join-Path $ResolvedLocalRoot $name
            backupRelativePath = "local/$name"
        }
    }
    $entries += [PSCustomObject][ordered]@{
        id = 'start-menu/Illustrator Proof Check.lnk'
        path = $ResolvedShortcutPath
        backupRelativePath = 'start-menu/Illustrator Proof Check.lnk'
    }
    $entries += [PSCustomObject][ordered]@{
        id = 'illustrator/Campuslook Proof Check.jsx'
        path = $ResolvedProgramJsxPath
        backupRelativePath = 'illustrator/Campuslook Proof Check.jsx'
    }
    return @($entries)
}

function Get-ObservedEntries {
    param([Parameter(Mandatory = $true)][object[]]$Entries)
    return @($Entries | ForEach-Object {
        $exists = Test-Path -LiteralPath $_.path -PathType Leaf
        [PSCustomObject][ordered]@{
            id = $_.id
            path = $_.path
            backupRelativePath = $_.backupRelativePath
            existed = $exists
            sha256 = if ($exists) { Get-FileSha256 -Path $_.path } else { $null }
            length = if ($exists) { [long](Get-Item -LiteralPath $_.path).Length } else { $null }
            lastWriteTimeUtc = if ($exists) { (Get-Item -LiteralPath $_.path).LastWriteTimeUtc.ToString('o') } else { $null }
        }
    })
}

function Write-JsonFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)]$Value
    )
    [IO.File]::WriteAllText(
        $Path,
        (($Value | ConvertTo-Json -Depth 10) + "`n"),
        [Text.UTF8Encoding]::new($false)
    )
}

$resolvedLocalRoot = if ([string]::IsNullOrWhiteSpace($LocalRoot)) {
    Join-Path $env:LOCALAPPDATA 'Campuslook\IllustratorProofCheck'
}
else {
    $LocalRoot
}
$resolvedShortcutPath = if ([string]::IsNullOrWhiteSpace($ShortcutPath)) {
    Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Campuslook\Illustrator Proof Check.lnk'
}
else {
    $ShortcutPath
}
$resolvedProgramJsxPath = if ([string]::IsNullOrWhiteSpace($ProgramJsxPath)) {
    Resolve-ProgramJsxPath
}
else {
    $ProgramJsxPath
}
$targets = @(Get-TargetEntries `
    -ResolvedLocalRoot $resolvedLocalRoot `
    -ResolvedShortcutPath $resolvedShortcutPath `
    -ResolvedProgramJsxPath $resolvedProgramJsxPath)

if ($Mode -eq 'Preflight') {
    [ordered]@{
        schemaVersion = 'campuslook-windows-cutover-preflight/v1'
        ok = $true
        writeCount = 0
        localRoot = $resolvedLocalRoot
        shortcutPath = $resolvedShortcutPath
        programJsxPath = $resolvedProgramJsxPath
        entries = @(Get-ObservedEntries -Entries $targets)
    } | ConvertTo-Json -Depth 8
    exit 0
}

if ([string]::IsNullOrWhiteSpace($BackupRoot)) {
    throw 'cutover_backup_invalid: BackupRoot가 필요합니다.'
}
$backupFullPath = [IO.Path]::GetFullPath($BackupRoot).TrimEnd([char[]]@('\', '/'))
$localFullPath = [IO.Path]::GetFullPath($resolvedLocalRoot).TrimEnd([char[]]@('\', '/'))
if (
    $backupFullPath.Equals($localFullPath, [StringComparison]::OrdinalIgnoreCase) `
    -or $backupFullPath.StartsWith("$localFullPath\", [StringComparison]::OrdinalIgnoreCase)
) {
    throw 'cutover_backup_invalid: backup root는 설치 폴더 밖에 있어야 합니다.'
}
$manifestPath = Join-Path $backupFullPath 'manifest.json'

if ($Mode -eq 'Backup') {
    if (Test-Path -LiteralPath $backupFullPath) {
        throw 'cutover_backup_invalid: 새 backup root가 필요합니다.'
    }
    [IO.Directory]::CreateDirectory($backupFullPath) | Out-Null
    $observed = @(Get-ObservedEntries -Entries $targets)
    foreach ($entry in $observed) {
        if (-not $entry.existed) {
            continue
        }
        $backupPath = Join-Path $backupFullPath ($entry.backupRelativePath -replace '/', [IO.Path]::DirectorySeparatorChar)
        [IO.Directory]::CreateDirectory((Split-Path $backupPath -Parent)) | Out-Null
        Copy-Item -LiteralPath $entry.path -Destination $backupPath -ErrorAction Stop
        if ((Get-FileSha256 -Path $backupPath) -ne $entry.sha256) {
            throw "cutover_backup_invalid: backup hash mismatch: $($entry.id)"
        }
    }
    $manifestEntries = @($observed | ForEach-Object {
        [PSCustomObject][ordered]@{
            id = $_.id
            path = $_.path
            backupRelativePath = $_.backupRelativePath
            preExisted = $_.existed
            preSha256 = $_.sha256
            preLength = $_.length
            preLastWriteTimeUtc = $_.lastWriteTimeUtc
            postRecorded = $false
            postExisted = $null
            postSha256 = $null
            postLength = $null
        }
    })
    $manifest = [ordered]@{
        schemaVersion = 'campuslook-windows-cutover-backup/v1'
        createdAt = [DateTimeOffset]::UtcNow.ToString('o')
        backupRoot = $backupFullPath
        localRoot = $resolvedLocalRoot
        shortcutPath = $resolvedShortcutPath
        programJsxPath = $resolvedProgramJsxPath
        entries = $manifestEntries
    }
    Write-JsonFile -Path $manifestPath -Value $manifest
    [ordered]@{ ok = $true; mode = $Mode; manifest = $manifestPath; entries = $manifestEntries.Count } |
        ConvertTo-Json -Compress
    exit 0
}

if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw 'cutover_backup_invalid: manifest를 찾을 수 없습니다.'
}
try {
    $manifest = [IO.File]::ReadAllText($manifestPath, [Text.UTF8Encoding]::new($false)) | ConvertFrom-Json
}
catch {
    throw 'cutover_backup_invalid: manifest JSON을 읽을 수 없습니다.'
}
if ([string]$manifest.schemaVersion -ne 'campuslook-windows-cutover-backup/v1') {
    throw 'cutover_backup_invalid: manifest schema가 올바르지 않습니다.'
}

if ($Mode -eq 'RecordPostState') {
    foreach ($entry in @($manifest.entries)) {
        $exists = Test-Path -LiteralPath $entry.path -PathType Leaf
        $entry.postRecorded = $true
        $entry.postExisted = $exists
        $entry.postSha256 = if ($exists) { Get-FileSha256 -Path $entry.path } else { $null }
        $entry.postLength = if ($exists) { [long](Get-Item -LiteralPath $entry.path).Length } else { $null }
    }
    $manifest | Add-Member -NotePropertyName postRecordedAt -NotePropertyValue ([DateTimeOffset]::UtcNow.ToString('o')) -Force
    Write-JsonFile -Path $manifestPath -Value $manifest
    [ordered]@{ ok = $true; mode = $Mode; manifest = $manifestPath; entries = @($manifest.entries).Count } |
        ConvertTo-Json -Compress
    exit 0
}

foreach ($entry in @($manifest.entries)) {
    if (-not [bool]$entry.postRecorded) {
        throw "cutover_rollback_blocked: post-state가 없습니다: $($entry.id)"
    }
    $currentExists = Test-Path -LiteralPath $entry.path -PathType Leaf
    if ($currentExists -ne [bool]$entry.postExisted) {
        throw "cutover_rollback_blocked: current presence drift: $($entry.id)"
    }
    if ($currentExists -and (Get-FileSha256 -Path $entry.path) -ne [string]$entry.postSha256) {
        throw "cutover_rollback_blocked: current hash drift: $($entry.id)"
    }
}

foreach ($entry in @($manifest.entries)) {
    if ([bool]$entry.preExisted) {
        $backupPath = Join-Path $backupFullPath ([string]$entry.backupRelativePath -replace '/', [IO.Path]::DirectorySeparatorChar)
        if (-not (Test-Path -LiteralPath $backupPath -PathType Leaf)) {
            throw "cutover_rollback_blocked: backup file missing: $($entry.id)"
        }
        if ((Get-FileSha256 -Path $backupPath) -ne [string]$entry.preSha256) {
            throw "cutover_rollback_blocked: backup hash drift: $($entry.id)"
        }
        [IO.Directory]::CreateDirectory((Split-Path ([string]$entry.path) -Parent)) | Out-Null
        Copy-Item -LiteralPath $backupPath -Destination ([string]$entry.path) -Force -ErrorAction Stop
    }
    elseif (Test-Path -LiteralPath $entry.path -PathType Leaf) {
        Remove-Item -LiteralPath $entry.path -Force -ErrorAction Stop
    }
}

foreach ($entry in @($manifest.entries)) {
    $currentExists = Test-Path -LiteralPath $entry.path -PathType Leaf
    if ($currentExists -ne [bool]$entry.preExisted) {
        throw "cutover_rollback_failed: restored presence mismatch: $($entry.id)"
    }
    if ($currentExists -and (Get-FileSha256 -Path $entry.path) -ne [string]$entry.preSha256) {
        throw "cutover_rollback_failed: restored hash mismatch: $($entry.id)"
    }
}

[ordered]@{ ok = $true; mode = $Mode; manifest = $manifestPath; entries = @($manifest.entries).Count } |
    ConvertTo-Json -Compress
