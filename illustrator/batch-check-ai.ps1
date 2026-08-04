[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$InputDirectory,
    [Parameter(Mandatory = $true)][string]$OutputJson,
    [ValidateRange(100, 300)][int]$RenderScale = 100,
    [ValidateSet('analysis-crop', 'full-artboard')][string]$CaptureMode = 'analysis-crop',
    [ValidateRange(0, 10000)][int]$ReadyDelayMilliseconds = 0,
    [ValidateRange(0, 100)][int]$MaximumFiles = 0
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
chcp 65001 | Out-Null
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)

$installedLauncher = Join-Path $env:LOCALAPPDATA 'Campuslook\IllustratorProofCheck\run-proof-check.ps1'
$launcher = if (Test-Path -LiteralPath $installedLauncher -PathType Leaf) {
    $installedLauncher
}
else {
    Join-Path $PSScriptRoot 'run-proof-check.ps1'
}
if (-not (Test-Path -LiteralPath $launcher -PathType Leaf)) {
    throw "검사 실행기를 찾을 수 없습니다: $launcher"
}
if (-not (Test-Path -LiteralPath $InputDirectory -PathType Container)) {
    throw "입력 폴더를 찾을 수 없습니다: $InputDirectory"
}

$files = @(Get-ChildItem -LiteralPath $InputDirectory -Filter '*.ai' -File | Sort-Object Name)
if ($MaximumFiles -gt 0) {
    $files = @($files | Select-Object -First $MaximumFiles)
}
if ($files.Count -lt 1) {
    throw "검사할 AI 파일이 없습니다: $InputDirectory"
}

$illustrator = [Runtime.InteropServices.Marshal]::GetActiveObject('Illustrator.Application')
$originalDocumentPath = ''
$originalDocumentSaved = $null
if ($illustrator.Documents.Count -gt 0) {
    try { $originalDocumentPath = [string]$illustrator.ActiveDocument.FullName } catch { $originalDocumentPath = '' }
    try { $originalDocumentSaved = [bool]$illustrator.ActiveDocument.Saved } catch { $originalDocumentSaved = $null }
}
$originalInteractionLevel = $illustrator.UserInteractionLevel
$results = @()
$batchStopwatch = [Diagnostics.Stopwatch]::StartNew()

try {
    $illustrator.UserInteractionLevel = -1
    foreach ($file in $files) {
        $fileStopwatch = [Diagnostics.Stopwatch]::StartNew()
        $openStopwatch = [Diagnostics.Stopwatch]::StartNew()
        $document = $null
        $record = [ordered]@{
            file = $file.Name
            path = $file.FullName
            openSeconds = $null
            checkSeconds = $null
            totalSeconds = $null
            executionOk = $false
            status = $null
            designCount = $null
            designs = @()
            phaseTimings = $null
            report = $null
            reportJson = $null
            reportData = $null
            error = $null
            closeError = $null
        }
        try {
            $document = $illustrator.Open($file.FullName)
            $openStopwatch.Stop()
            $record.openSeconds = [Math]::Round($openStopwatch.Elapsed.TotalSeconds, 2)
            if ($ReadyDelayMilliseconds -gt 0) {
                Start-Sleep -Milliseconds $ReadyDelayMilliseconds
            }

            $rawOutput = @(& powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $launcher `
                -InputPath $file.FullName -Quiet -NoOpen -UseActiveDocument `
                -RenderScale $RenderScale -CaptureMode $CaptureMode 2>&1)
            $exitCode = $LASTEXITCODE
            $jsonLine = @($rawOutput | Where-Object { $_ -is [string] -and $_.Trim().StartsWith('{') } | Select-Object -Last 1)
            if ($jsonLine.Count -lt 1) {
                throw "검사기가 JSON 결과를 반환하지 않았습니다. exit=$exitCode output=$(($rawOutput | Out-String).Trim())"
            }
            $parsed = ($jsonLine[0] | ConvertFrom-Json)
            if ($exitCode -ne 0 -or -not [bool]$parsed.ok) {
                $detail = if ($parsed.error) { [string]$parsed.error } else { "검사기 종료 코드 $exitCode" }
                throw $detail
            }
            $record.executionOk = $true
            $record.status = [string]$parsed.status
            $record.designCount = [int]$parsed.designCount
            $record.checkSeconds = [double]$parsed.elapsedSeconds
            $record.designs = @($parsed.designs)
            $record.phaseTimings = $parsed.phaseTimings
            $record.report = [string]$parsed.report
            $record.reportJson = [IO.Path]::ChangeExtension($record.report, '.json')
            if (Test-Path -LiteralPath $record.reportJson -PathType Leaf) {
                $record.reportData = [IO.File]::ReadAllText($record.reportJson, [Text.UTF8Encoding]::new($false)) | ConvertFrom-Json
            }
        }
        catch {
            if ($openStopwatch.IsRunning) {
                $openStopwatch.Stop()
                $record.openSeconds = [Math]::Round($openStopwatch.Elapsed.TotalSeconds, 2)
            }
            $record.error = $_.Exception.Message
        }
        finally {
            if ($null -ne $document) {
                try { $document.Close(2) } catch { $record.closeError = $_.Exception.Message }
            }
            $fileStopwatch.Stop()
            $record.totalSeconds = [Math]::Round($fileStopwatch.Elapsed.TotalSeconds, 2)
            $results += [PSCustomObject]$record
        }
    }
}
finally {
    try { $illustrator.UserInteractionLevel = $originalInteractionLevel } catch { }
    $batchStopwatch.Stop()
}

$finalDocumentPath = ''
$finalDocumentSaved = $null
if ($illustrator.Documents.Count -gt 0) {
    try { $finalDocumentPath = [string]$illustrator.ActiveDocument.FullName } catch { $finalDocumentPath = '' }
    try { $finalDocumentSaved = [bool]$illustrator.ActiveDocument.Saved } catch { $finalDocumentSaved = $null }
}

$summary = [ordered]@{
    schemaVersion = 2
    inputDirectory = $InputDirectory
    fileCount = $files.Count
    executionSuccessCount = @($results | Where-Object executionOk).Count
    executionErrorCount = @($results | Where-Object { -not $_.executionOk }).Count
    totalSeconds = [Math]::Round($batchStopwatch.Elapsed.TotalSeconds, 2)
    readyDelayMilliseconds = $ReadyDelayMilliseconds
    originalDocument = [ordered]@{ path = $originalDocumentPath; saved = $originalDocumentSaved }
    finalDocument = [ordered]@{ path = $finalDocumentPath; saved = $finalDocumentSaved }
    originalDocumentPreserved = ($originalDocumentPath -eq $finalDocumentPath -and $originalDocumentSaved -eq $finalDocumentSaved)
    results = $results
}

$outputParent = Split-Path $OutputJson -Parent
if (-not [string]::IsNullOrWhiteSpace($outputParent)) {
    [IO.Directory]::CreateDirectory($outputParent) | Out-Null
}
[IO.File]::WriteAllText($OutputJson, (($summary | ConvertTo-Json -Depth 12) + "`n"), [Text.UTF8Encoding]::new($false))
$summary | ConvertTo-Json -Depth 12
