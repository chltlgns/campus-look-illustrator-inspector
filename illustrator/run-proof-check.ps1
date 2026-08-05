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
    [string]$LegacyPaletteFile = '',
    [string]$SleevePaletteFile = '',
    [string]$MaterialPalettesSidecar = '',
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
$catalogRegistryPath = ''
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

    # Keep UNC and drive-letter normalization in the shared fail-closed resolver.
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

function Resolve-MaterialPaletteSources {
    $sidecarPath = if ([string]::IsNullOrWhiteSpace($MaterialPalettesSidecar)) {
        Join-Path $PSScriptRoot 'material-palettes.json'
    }
    else {
        $MaterialPalettesSidecar
    }
    $sidecar = $null
    if (Test-Path -LiteralPath $sidecarPath -PathType Leaf) {
        try {
            $sidecar = [IO.File]::ReadAllText($sidecarPath, [Text.UTF8Encoding]::new($false)) | ConvertFrom-Json
        }
        catch {
            throw 'palette_registry_invalid: material-palettes sidecar JSON을 읽을 수 없습니다.'
        }
        if ([string]$sidecar.schemaVersion -ne 'campuslook-material-palettes/v1') {
            throw 'palette_registry_invalid: material-palettes sidecar schema가 올바르지 않습니다.'
        }
    }

    $current = if (-not [string]::IsNullOrWhiteSpace($PaletteFile)) {
        $PaletteFile
    }
    elseif (-not [string]::IsNullOrWhiteSpace($env:CAMPUSLOOK_MATERIAL_PALETTE)) {
        $env:CAMPUSLOOK_MATERIAL_PALETTE
    }
    elseif ($null -ne $sidecar) {
        [string]$sidecar.currentBody
    }
    else {
        Join-Path $env:USERPROFILE 'Desktop\컬러참고용 판때기.ai'
    }
    $legacy = if (-not [string]::IsNullOrWhiteSpace($LegacyPaletteFile)) {
        $LegacyPaletteFile
    }
    elseif (-not [string]::IsNullOrWhiteSpace($env:CAMPUSLOOK_LEGACY_MATERIAL_PALETTE)) {
        $env:CAMPUSLOOK_LEGACY_MATERIAL_PALETTE
    }
    elseif ($null -ne $sidecar) {
        [string]$sidecar.legacyBody
    }
    else { '' }
    $sleeve = if (-not [string]::IsNullOrWhiteSpace($SleevePaletteFile)) {
        $SleevePaletteFile
    }
    elseif (-not [string]::IsNullOrWhiteSpace($env:CAMPUSLOOK_SLEEVE_MATERIAL_PALETTE)) {
        $env:CAMPUSLOOK_SLEEVE_MATERIAL_PALETTE
    }
    elseif ($null -ne $sidecar) {
        [string]$sidecar.sleeveMaterial
    }
    else { '' }

    if ([string]::IsNullOrWhiteSpace($current)) {
        throw 'palette_registry_invalid: current-body source가 없습니다.'
    }
    $fullRequested = $null -ne $sidecar `
        -or -not [string]::IsNullOrWhiteSpace($legacy) `
        -or -not [string]::IsNullOrWhiteSpace($sleeve)
    if ($fullRequested -and ([string]::IsNullOrWhiteSpace($legacy) -or [string]::IsNullOrWhiteSpace($sleeve))) {
        throw 'palette_registry_invalid: installed/full mode에는 current-body, legacy-body, sleeve-material 세 source가 모두 필요합니다.'
    }
    return [ordered]@{
        requireFull = $fullRequested
        currentBody = $current
        legacyBody = $legacy
        sleeveMaterial = $sleeve
    }
}

function Get-CatalogCachePath {
    param(
        [Parameter(Mandatory = $true)][string]$Role,
        [Parameter(Mandatory = $true)][string]$Generation,
        [Parameter(Mandatory = $true)][string]$CatalogId,
        [Parameter(Mandatory = $true)][string]$SourceWindowsPath
    )

    if (-not (Test-Path -LiteralPath $SourceWindowsPath -PathType Leaf)) {
        throw "palette_registry_invalid: $Role 컬러판 파일을 찾을 수 없습니다: $SourceWindowsPath"
    }
    # Cache identity is the exact source digest and role. Path/mtime are never trusted as identity.
    $paletteHash = (Get-FileHash -LiteralPath $SourceWindowsPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $cacheDirectory = "$runtimeRoot/cache/material-catalog/$Role/$paletteHash"
    $cachePng = "$cacheDirectory/full-artwork.png"
    $cachePngWindows = Convert-ToWindowsPath -LinuxPath $cachePng
    $cacheDirectoryWindows = Convert-ToWindowsPath -LinuxPath $cacheDirectory
    $cacheJson = "$cacheDirectory/catalog.json"
    $cacheJsonWindows = Convert-ToWindowsPath -LinuxPath $cacheJson
    [IO.Directory]::CreateDirectory($cacheDirectoryWindows) | Out-Null
    if (-not (Test-Path -LiteralPath $cacheJsonWindows -PathType Leaf)) {
        $stagedPalette = Join-Path $cacheDirectoryWindows 'source.ai'
        Copy-Item -LiteralPath $SourceWindowsPath -Destination $stagedPalette -Force

        $inspectorWindows = Convert-ToWindowsPath -LinuxPath "$workspaceRoot/inspect-illustrator.ps1"
        $inspectionWindows = Join-Path $cacheDirectoryWindows 'document.json'
        $marker = Join-Path $cacheDirectoryWindows 'collector.marker'
        [IO.File]::WriteAllText($marker, [DateTimeOffset]::UtcNow.ToString('o'), [Text.UTF8Encoding]::new($false))
        $collectorSucceeded = $false
        $paletteOutput = @()
        for ($attempt = 1; $attempt -le 2; $attempt += 1) {
            $paletteOutput = & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $inspectorWindows `
                -InputPath $stagedPalette `
                -OutputDirectory $cacheDirectoryWindows `
                -SourceDisplayName ([IO.Path]::GetFileName($SourceWindowsPath)) `
                -RenderScale 100 `
                -ExportFullArtwork 2>&1
            if (
                $LASTEXITCODE -eq 0 `
                -and (Test-Path -LiteralPath $cachePngWindows -PathType Leaf) `
                -and (Test-Path -LiteralPath $inspectionWindows -PathType Leaf) `
                -and (Get-Item -LiteralPath $cachePngWindows).LastWriteTimeUtc -gt (Get-Item -LiteralPath $marker).LastWriteTimeUtc
            ) {
                $collectorSucceeded = $true
                break
            }
        }
        Remove-Item -LiteralPath $marker -Force -ErrorAction SilentlyContinue
        if (-not $collectorSucceeded) {
            throw "$Role 컬러판 캐시를 만들지 못했습니다.`r`n`r`n$(($paletteOutput | Out-String).Trim())"
        }

        $builderArguments = @(
            "$workspaceRoot/analyze-proof.mjs",
            '--palette', $cachePng,
            '--palette-output', $cacheJson,
            '--catalog-role', $Role,
            '--catalog-generation', $Generation,
            '--catalog-id', $CatalogId,
            '--source-sha256', $paletteHash,
            '--source-display-name', ([IO.Path]::GetFileName($SourceWindowsPath))
        )
        if ($Role -ne 'current-body') {
            $builderArguments += @('--observation', "$cacheDirectory/document.json")
        }
        $paletteDataOutput = & wsl.exe -d $distribution -- node @builderArguments 2>&1
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $cacheJsonWindows -PathType Leaf)) {
            throw "$Role catalog 데이터 캐시를 만들지 못했습니다.`r`n`r`n$(($paletteDataOutput | Out-String).Trim())"
        }
    }

    try {
        $catalog = [IO.File]::ReadAllText($cacheJsonWindows, [Text.UTF8Encoding]::new($false)) | ConvertFrom-Json
    }
    catch {
        throw "palette_registry_invalid: $Role catalog JSON을 읽을 수 없습니다."
    }
    if (
        [int]$catalog.schemaVersion -ne 2 `
        -or [string]$catalog.role -ne $Role `
        -or [string]$catalog.catalogId -ne $CatalogId `
        -or [string]$catalog.source.sha256 -ne $paletteHash `
        -or @($catalog.entries).Count -lt 1
    ) {
        throw "palette_registry_invalid: $Role cache의 role/hash/schema/catalogId가 일치하지 않습니다."
    }
    return [ordered]@{
        role = $Role
        catalogId = $CatalogId
        sourceSha256 = $paletteHash
        path = $cacheJson
    }
}

function Get-MaterialCatalogRegistryPath {
    param([Parameter(Mandatory = $true)]$Sources)

    $references = @()
    $references += Get-CatalogCachePath `
        -Role 'current-body' -Generation 'current' -CatalogId 'current-body-tr' `
        -SourceWindowsPath ([string]$Sources.currentBody)
    if ([bool]$Sources.requireFull) {
        $references += Get-CatalogCachePath `
            -Role 'legacy-body' -Generation 'legacy' -CatalogId 'legacy-body-tr' `
            -SourceWindowsPath ([string]$Sources.legacyBody)
        $references += Get-CatalogCachePath `
            -Role 'sleeve-material' -Generation 'reference' -CatalogId 'sleeve-leather-reference' `
            -SourceWindowsPath ([string]$Sources.sleeveMaterial)
    }
    $registryPath = "$runtimeRoot/cache/material-catalog/registry.json"
    $registryWindowsPath = Convert-ToWindowsPath -LinuxPath $registryPath
    [IO.Directory]::CreateDirectory((Split-Path $registryWindowsPath -Parent)) | Out-Null
    $registry = [ordered]@{
        schemaVersion = 'campuslook-material-catalog-registry/v1'
        requireFull = [bool]$Sources.requireFull
        catalogs = @($references)
    } | ConvertTo-Json -Depth 6
    [IO.File]::WriteAllText($registryWindowsPath, "$registry`n", [Text.UTF8Encoding]::new($false))
    return $registryPath
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

    $paletteSources = Resolve-MaterialPaletteSources
    $paletteWindowsPath = [string]$paletteSources.currentBody
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
    $catalogRegistryPath = Get-MaterialCatalogRegistryPath -Sources $paletteSources
    $cacheStopwatch.Stop()
    $phaseTimings.paletteCacheMilliseconds = [Math]::Round($cacheStopwatch.Elapsed.TotalMilliseconds, 1)
    $phaseTimings.catalogCacheMilliseconds = $phaseTimings.paletteCacheMilliseconds

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
            --catalog-registry $catalogRegistryPath `
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
        $checkerOutput = & wsl.exe -d $distribution -- env `
            "CAMPUSLOOK_CATALOG_REGISTRY=$catalogRegistryPath" `
            $checkerPath $wslInputPath $palettePath $outputPath 2>&1
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
몸통 catalog: $($report.materialCheck.matchedCatalog.role)
소매: $($report.sleeveCheck.status)
소매 판정코드: $($report.sleeveCheck.decisionCode)
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
