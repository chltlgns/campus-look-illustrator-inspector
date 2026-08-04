[CmdletBinding()]
param(
    [string]$InputFile = '',
    [string]$InputPath = '',
    [switch]$Quiet,
    [switch]$NoOpen,
    [switch]$UseActiveDocument,
    [ValidateRange(100, 300)][int]$RenderScale = 100,
    [ValidateSet('analysis-crop', 'full-artboard')][string]$CaptureMode = 'analysis-crop',
    [string]$InspectorRoot = '',
    [string]$RuntimeRoot = '',
    [string]$PaletteFile = '',
    [string]$WslDistribution = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
chcp 65001 | Out-Null
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)

$title = '캠퍼스룩 야구점퍼 시안 검사'
$workspaceRoot = ''
$workspaceWindowsRoot = ''
$runtimeRoot = ''
$runtimeWindowsRoot = ''
$checkerPath = ''
$palettePath = ''
$paletteWindowsPath = ''
$distribution = ''
$mutex = $null
$mutexAcquired = $false

function Show-Dialog {
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [ValidateSet('Info', 'Warning', 'Error')][string]$Kind = 'Info',
        [switch]$AskToOpen
    )

    if ($Quiet) {
        [ordered]@{ kind = $Kind; message = $Message } | ConvertTo-Json -Compress
        return $false
    }

    Add-Type -AssemblyName System.Windows.Forms
    $icon = switch ($Kind) {
        'Warning' { [Windows.Forms.MessageBoxIcon]::Warning }
        'Error' { [Windows.Forms.MessageBoxIcon]::Error }
        default { [Windows.Forms.MessageBoxIcon]::Information }
    }
    $buttons = if ($AskToOpen) {
        [Windows.Forms.MessageBoxButtons]::YesNo
    }
    else {
        [Windows.Forms.MessageBoxButtons]::OK
    }
    $result = [Windows.Forms.MessageBox]::Show($Message, $title, $buttons, $icon)
    return $result -eq [Windows.Forms.DialogResult]::Yes
}

function Convert-ToWslPath {
    param([Parameter(Mandatory = $true)][string]$WindowsPath)

    return Convert-InspectorWindowsPathToWsl `
        -WindowsPath $WindowsPath `
        -WslDistribution $distribution
}

function Convert-ToWindowsPath {
    param([Parameter(Mandatory = $true)][string]$LinuxPath)

    if (
        $LinuxPath -eq $workspaceRoot `
        -or $LinuxPath.StartsWith("$workspaceRoot/", [StringComparison]::Ordinal)
    ) {
        $relative = $LinuxPath.Substring($workspaceRoot.Length).TrimStart('/') -replace '/', '\'
        if ([string]::IsNullOrWhiteSpace($relative)) {
            return $workspaceWindowsRoot
        }
        return "$workspaceWindowsRoot\$relative"
    }
    if ($LinuxPath -match '^/mnt/([a-zA-Z])/(.*)$') {
        return "$($Matches[1].ToUpperInvariant()):\$($Matches[2] -replace '/', '\')"
    }

    $converted = & wsl.exe -d $distribution -- wslpath -a -w $LinuxPath 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "WSL 경로를 Windows 경로로 변환하지 못했습니다: $converted"
    }
    return (($converted | Out-String).Trim())
}

function Get-PaletteCachePath {
    if (-not (Test-Path -LiteralPath $paletteWindowsPath -PathType Leaf)) {
        throw "컬러판 파일을 찾을 수 없습니다: $paletteWindowsPath"
    }

    $paletteFile = Get-Item -LiteralPath $paletteWindowsPath
    $identityPath = "$runtimeRoot/cache/palette/identity.json"
    $identityWindowsPath = Convert-ToWindowsPath -LinuxPath $identityPath
    $paletteHash = ''
    if (Test-Path -LiteralPath $identityWindowsPath -PathType Leaf) {
        try {
            $identity = [IO.File]::ReadAllText($identityWindowsPath, [Text.UTF8Encoding]::new($false)) | ConvertFrom-Json
            if (
                [long]$identity.length -eq [long]$paletteFile.Length `
                -and [long]$identity.lastWriteTimeUtcTicks -eq [long]$paletteFile.LastWriteTimeUtc.Ticks `
                -and [string]$identity.sha256 -match '^[0-9a-f]{64}$'
            ) {
                $paletteHash = [string]$identity.sha256
            }
        }
        catch { $paletteHash = '' }
    }
    if ([string]::IsNullOrWhiteSpace($paletteHash)) {
        $paletteHash = (Get-FileHash -LiteralPath $paletteWindowsPath -Algorithm SHA256).Hash.ToLowerInvariant()
        $identityDirectory = Split-Path $identityWindowsPath -Parent
        [IO.Directory]::CreateDirectory($identityDirectory) | Out-Null
        $identityData = [ordered]@{
            length = [long]$paletteFile.Length
            lastWriteTimeUtcTicks = [long]$paletteFile.LastWriteTimeUtc.Ticks
            sha256 = $paletteHash
        } | ConvertTo-Json -Compress
        [IO.File]::WriteAllText($identityWindowsPath, $identityData, [Text.UTF8Encoding]::new($false))
    }
    $cacheDirectory = "$runtimeRoot/cache/palette/$paletteHash"
    $cachePng = "$cacheDirectory/full-artwork.png"
    $cachePngWindows = Convert-ToWindowsPath -LinuxPath $cachePng
    $cacheDirectoryWindows = Convert-ToWindowsPath -LinuxPath $cacheDirectory
    [IO.Directory]::CreateDirectory($cacheDirectoryWindows) | Out-Null
    if (-not (Test-Path -LiteralPath $cachePngWindows -PathType Leaf)) {
        $stagedPalette = Join-Path $cacheDirectoryWindows 'source.ai'
        Copy-Item -LiteralPath $paletteWindowsPath -Destination $stagedPalette -Force

        $inspectorWindows = Convert-ToWindowsPath -LinuxPath "$workspaceRoot/inspect-illustrator.ps1"
        $paletteOutput = & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $inspectorWindows `
            -InputPath $stagedPalette `
            -OutputDirectory $cacheDirectoryWindows `
            -SourceDisplayName ([IO.Path]::GetFileName($paletteWindowsPath)) `
            -RenderScale 100 `
            -ExportFullArtwork 2>&1
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $cachePngWindows -PathType Leaf)) {
            throw "컬러판 캐시를 만들지 못했습니다.`r`n`r`n$(($paletteOutput | Out-String).Trim())"
        }
    }

    $cacheJson = "$cacheDirectory/material-color-reference.json"
    $cacheJsonWindows = Convert-ToWindowsPath -LinuxPath $cacheJson
    if (-not (Test-Path -LiteralPath $cacheJsonWindows -PathType Leaf)) {
        $paletteDataOutput = & wsl.exe -d $distribution -- node "$workspaceRoot/analyze-proof.mjs" `
            --palette $cachePng `
            --palette-output $cacheJson 2>&1
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $cacheJsonWindows -PathType Leaf)) {
            throw "컬러판 데이터 캐시를 만들지 못했습니다.`r`n`r`n$(($paletteDataOutput | Out-String).Trim())"
        }
    }
    return $cacheJson
}

try {
    $rootResolver = Join-Path $PSScriptRoot 'inspector-root.ps1'
    if (-not (Test-Path -LiteralPath $rootResolver -PathType Leaf)) {
        throw 'inspector_root_invalid: root resolver를 찾을 수 없습니다.'
    }
    . $rootResolver
    $rootSettings = Resolve-InspectorRoot `
        -ExplicitRoot $InspectorRoot `
        -ExplicitRuntimeRoot $RuntimeRoot `
        -ExplicitWslDistribution $WslDistribution `
        -SidecarPath (Join-Path $PSScriptRoot 'inspector-root.json')
    $workspaceWindowsRoot = [string]$rootSettings.WindowsRoot
    $runtimeWindowsRoot = [string]$rootSettings.RuntimeWindowsRoot
    $distribution = [string]$rootSettings.WslDistribution
    $workspaceRoot = Convert-ToWslPath -WindowsPath $workspaceWindowsRoot
    $runtimeRoot = Convert-ToWslPath -WindowsPath $runtimeWindowsRoot
    $checkerPath = "$workspaceRoot/check-proof.sh"

    if (-not [string]::IsNullOrWhiteSpace($PaletteFile)) {
        $paletteWindowsPath = $PaletteFile
    }
    elseif (-not [string]::IsNullOrWhiteSpace($env:CAMPUSLOOK_MATERIAL_PALETTE)) {
        $paletteWindowsPath = $env:CAMPUSLOOK_MATERIAL_PALETTE
    }
    else {
        $paletteWindowsPath = 'C:\Users\GOLD\Desktop\컬러참고용 판때기.ai'
    }
    $palettePath = Convert-ToWslPath -WindowsPath $paletteWindowsPath

    $totalStopwatch = [Diagnostics.Stopwatch]::StartNew()
    $phaseTimings = [ordered]@{}
    $mutex = New-Object Threading.Mutex($false, 'Local\CampuslookIllustratorProofCheck')
    $mutexAcquired = $mutex.WaitOne(0)
    if (-not $mutexAcquired) {
        Show-Dialog -Kind Warning -Message '이미 다른 시안을 검사하고 있습니다. 결과창이 나온 후 다시 실행해주세요.' | Out-Null
        exit 3
    }

    if ([string]::IsNullOrWhiteSpace($InputPath) -and -not [string]::IsNullOrWhiteSpace($InputFile)) {
        if (-not (Test-Path -LiteralPath $InputFile -PathType Leaf)) {
            throw '검사할 문서 경로를 받지 못했습니다.'
        }
        $InputPath = [IO.File]::ReadAllText($InputFile, [Text.UTF8Encoding]::new($false)).Trim([char]0xFEFF).Trim()
        Remove-Item -LiteralPath $InputFile -Force -ErrorAction SilentlyContinue
    }

    if (-not [string]::IsNullOrWhiteSpace($InputPath)) {
        if (-not (Test-Path -LiteralPath $InputPath -PathType Leaf)) {
            throw "검사할 Illustrator 파일을 찾을 수 없습니다: $InputPath"
        }
        if ([IO.Path]::GetExtension($InputPath) -ne '.ai') {
            throw '현재 단축 검사는 .ai 파일만 지원합니다.'
        }
    }
    elseif (-not $UseActiveDocument) {
        throw '검사할 문서 경로를 받지 못했습니다.'
    }

    $cacheStopwatch = [Diagnostics.Stopwatch]::StartNew()
    $paletteCachePath = Get-PaletteCachePath
    $cacheStopwatch.Stop()
    $phaseTimings.paletteCacheMilliseconds = [Math]::Round($cacheStopwatch.Elapsed.TotalMilliseconds, 1)

    if ($UseActiveDocument) {
        if ([string]::IsNullOrWhiteSpace($InputPath)) {
            $proofOutputPath = "$runtimeRoot/cache/active-proof"
        }
        else {
            $stem = [IO.Path]::GetFileNameWithoutExtension($InputPath) -replace '[/\\:\x00-\x1F]', '_'
            $outputPath = "$runtimeRoot/reports/illustrator/$stem"
            $proofOutputPath = "$outputPath/proof"
        }
        $proofOutputWindows = Convert-ToWindowsPath -LinuxPath $proofOutputPath
        [IO.Directory]::CreateDirectory($proofOutputWindows) | Out-Null

        $fastInspector = Join-Path $PSScriptRoot 'FastProofInspector.jsx'
        if (-not (Test-Path -LiteralPath $fastInspector -PathType Leaf)) {
            throw "빠른 시안 수집기를 찾을 수 없습니다: $fastInspector"
        }
        $illustrator = [Runtime.InteropServices.Marshal]::GetActiveObject('Illustrator.Application')
        $scriptArguments = @(
            $proofOutputWindows,
            $(if ([string]::IsNullOrWhiteSpace($InputPath)) { '' } else { [IO.Path]::GetFileName($InputPath) }),
            [string]$RenderScale,
            '6',
            $CaptureMode
        )
        $illustratorStopwatch = [Diagnostics.Stopwatch]::StartNew()
        $null = $illustrator.DoJavaScriptFile($fastInspector, $scriptArguments, 1)
        $illustratorStopwatch.Stop()
        $phaseTimings.illustratorMilliseconds = [Math]::Round($illustratorStopwatch.Elapsed.TotalMilliseconds, 1)

        $inspectionPath = "$proofOutputPath/document.json"
        $inspectionWindows = Convert-ToWindowsPath -LinuxPath $inspectionPath
        if (-not (Test-Path -LiteralPath $inspectionWindows -PathType Leaf)) {
            throw '빠른 시안 수집기가 document.json을 만들지 못했습니다.'
        }
        if ([string]::IsNullOrWhiteSpace($InputPath)) {
            $inspectionMetadata = [IO.File]::ReadAllText($inspectionWindows, [Text.UTF8Encoding]::new($false)) | ConvertFrom-Json
            $InputPath = [string]$inspectionMetadata.sourcePath
            $documentName = [string]$inspectionMetadata.document.name
            if ([string]::IsNullOrWhiteSpace($InputPath) -or [IO.Path]::GetExtension($InputPath) -ne '.ai') {
                throw '현재 Illustrator 문서를 AI 파일로 먼저 저장한 다음 검사해주세요.'
            }
            $stem = [IO.Path]::GetFileNameWithoutExtension($documentName) -replace '[/\\:\x00-\x1F]', '_'
            $outputPath = "$runtimeRoot/reports/illustrator/$stem"
        }

        $analyzerStopwatch = [Diagnostics.Stopwatch]::StartNew()
        $analyzerOutput = & wsl.exe -d $distribution -- node "$workspaceRoot/analyze-proof.mjs" `
            --inspection $inspectionPath `
            --palette $paletteCachePath `
            --output "$outputPath/result" 2>&1
        $analyzerStopwatch.Stop()
        $phaseTimings.analyzerMilliseconds = [Math]::Round($analyzerStopwatch.Elapsed.TotalMilliseconds, 1)
        if ($LASTEXITCODE -ne 0) {
            throw "다중 시안 분석기가 오류로 종료됐습니다.`r`n`r`n$(($analyzerOutput | Out-String).Trim())"
        }
    }
    else {
        $stem = [IO.Path]::GetFileNameWithoutExtension($InputPath) -replace '[/\\:\x00-\x1F]', '_'
        $outputPath = "$runtimeRoot/reports/illustrator/$stem"
        $wslInputPath = Convert-ToWslPath -WindowsPath $InputPath
        $checkerOutput = & wsl.exe -d $distribution -- $checkerPath $wslInputPath $palettePath $outputPath 2>&1
        $checkerExitCode = $LASTEXITCODE
        if ($checkerExitCode -ne 0) {
            $details = ($checkerOutput | Out-String).Trim()
            throw "시안 검사기가 오류로 종료됐습니다. (code $checkerExitCode)`r`n`r`n$details"
        }
    }

    $reportJsonPath = Convert-ToWindowsPath -LinuxPath "$outputPath/result/report.json"
    $reportMarkdownPath = Convert-ToWindowsPath -LinuxPath "$outputPath/result/report.md"
    $report = [IO.File]::ReadAllText($reportJsonPath, [Text.UTF8Encoding]::new($false)) | ConvertFrom-Json

    $kind = switch ($report.overallStatus) {
        'PASS' { 'Info' }
        'FAIL' { 'Error' }
        default { 'Warning' }
    }
    $designs = @($report.designs)
    $designCountText = "$($report.designCount)개"
    if (
        $null -ne $report.performance `
        -and $report.performance.PSObject.Properties.Name -contains 'detectedProofs' `
        -and [int]$report.performance.detectedProofs -gt [int]$report.designCount
    ) {
        $designCountText = "$($report.designCount)개 (후보 $($report.performance.detectedProofs)개 중 최대 $($report.performance.maximumProofs)개)"
    }
    $totalStopwatch.Stop()
    $elapsedSeconds = [Math]::Round($totalStopwatch.Elapsed.TotalSeconds, 1)
    if ($designs.Count -gt 1) {
        $resultLines = @($designs | ForEach-Object { "$($_.label): $($_.overallStatus)" })
        $message = @"
검사가 완료됐습니다.

검사 파일: $($report.document)
검사 시안: $designCountText
종합 결과: $($report.overallStatus)
검사 시간: ${elapsedSeconds}초

$($resultLines -join "`r`n")

상세 보고서를 메모장으로 여시겠습니까?
"@
    }
    else {
        $message = @"
검사가 완료됐습니다.

검사 파일: $($report.document)
종합 결과: $($report.overallStatus)
표 추출: $($report.tableCheck.status)
겉감 표기: $($report.fields.shell)
몸통 대표색: $($report.visual.body.hex)
원단·번호: $($report.materialCheck.status)
소매: $($report.sleeveCheck.status)
검사 시간: ${elapsedSeconds}초

상세 보고서를 메모장으로 여시겠습니까?
"@
    }

    $shouldOpen = Show-Dialog -Message $message -Kind $kind -AskToOpen
    if ($shouldOpen -and -not $NoOpen) {
        Start-Process -FilePath 'notepad.exe' -ArgumentList @("`"$reportMarkdownPath`"")
    }

    if ($Quiet) {
        $designSummaries = @($designs | ForEach-Object {
            [ordered]@{
                label = $_.label
                status = $_.overallStatus
                artboard = $_.proofArtboard.index + 1
            }
        })
        [ordered]@{
            ok = $true
            status = $report.overallStatus
            designCount = $report.designCount
            elapsedSeconds = $elapsedSeconds
            designs = $designSummaries
            report = $reportMarkdownPath
            phaseTimings = $phaseTimings
        } | ConvertTo-Json -Depth 4 -Compress
    }
}
catch {
    if ($Quiet) {
        [ordered]@{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
    }
    else {
        Show-Dialog -Kind Error -Message $_.Exception.Message | Out-Null
    }
    exit 1
}
finally {
    if ($mutexAcquired -and $null -ne $mutex) {
        try { $mutex.ReleaseMutex() } catch { }
    }
    if ($null -ne $mutex) {
        $mutex.Dispose()
    }
}
