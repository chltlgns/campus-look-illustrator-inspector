Set-StrictMode -Version Latest

function Convert-InspectorWindowsPathToWsl {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$WindowsPath,
        [Parameter(Mandatory = $true)][string]$WslDistribution
    )

    $uncMatch = [regex]::Match(
        $WindowsPath,
        '^(?:\\\\wsl\.localhost|\\\\wsl\$)\\([^\\]+)\\(.+)$',
        [Text.RegularExpressions.RegexOptions]::IgnoreCase
    )
    if ($uncMatch.Success) {
        $uncDistribution = [string]$uncMatch.Groups[1].Value
        if (-not $uncDistribution.Equals($WslDistribution, [StringComparison]::OrdinalIgnoreCase)) {
            throw 'inspector_root_invalid: WSL UNC distribution이 configured distribution과 일치하지 않습니다.'
        }
        $relative = ([string]$uncMatch.Groups[2].Value) -replace '\\', '/'
        $segments = @($relative.Split('/') | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
        if (
            $segments.Count -lt 1 `
            -or $segments.Count -ne $relative.Split('/').Count `
            -or @($segments | Where-Object { $_ -eq '.' -or $_ -eq '..' }).Count -gt 0
        ) {
            throw 'inspector_root_invalid: WSL UNC path가 올바르지 않습니다.'
        }
        return "/$($segments -join '/')"
    }

    if (
        $WindowsPath.StartsWith('\\wsl.localhost', [StringComparison]::OrdinalIgnoreCase) `
        -or $WindowsPath.StartsWith('\\wsl$', [StringComparison]::OrdinalIgnoreCase)
    ) {
        throw 'inspector_root_invalid: WSL UNC root 형식이 올바르지 않습니다.'
    }

    $converted = & wsl.exe -d $WslDistribution -- wslpath -a -u $WindowsPath 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Windows 경로를 WSL 경로로 변환하지 못했습니다: $converted"
    }
    return (($converted | Out-String).Trim())
}

function Resolve-InspectorRoot {
    [CmdletBinding()]
    param(
        [string]$ExplicitRoot = '',
        [string]$SidecarPath = '',
        [string]$ExplicitWslDistribution = '',
        [string]$ExplicitRuntimeRoot = ''
    )

    $candidateRoot = ''
    $candidateRuntimeRoot = ''
    $distribution = ''
    $source = ''
    $runtimeSource = ''
    $sidecar = $null

    $sourceNeedsSidecar = (
        [string]::IsNullOrWhiteSpace($ExplicitRoot) `
        -and [string]::IsNullOrWhiteSpace($env:CAMPUSLOOK_ILLUSTRATOR_INSPECTOR_ROOT)
    )
    $runtimeNeedsSidecar = (
        [string]::IsNullOrWhiteSpace($ExplicitRuntimeRoot) `
        -and [string]::IsNullOrWhiteSpace($env:CAMPUSLOOK_ILLUSTRATOR_INSPECTOR_RUNTIME_ROOT)
    )
    if ($sourceNeedsSidecar -or $runtimeNeedsSidecar) {
        if ([string]::IsNullOrWhiteSpace($SidecarPath) -or -not (Test-Path -LiteralPath $SidecarPath -PathType Leaf)) {
            throw "inspector_root_invalid: CAMPUSLOOK_ILLUSTRATOR_INSPECTOR_ROOT, CAMPUSLOOK_ILLUSTRATOR_INSPECTOR_RUNTIME_ROOT 또는 installer sidecar가 필요합니다."
        }
        try {
            $sidecar = [IO.File]::ReadAllText($SidecarPath, [Text.UTF8Encoding]::new($false)) | ConvertFrom-Json
        }
        catch {
            throw "inspector_root_invalid: sidecar JSON을 읽을 수 없습니다."
        }
        if (
            -not ($sidecar.PSObject.Properties.Name -contains 'schemaVersion') `
            -or [int]$sidecar.schemaVersion -ne 2 `
            -or -not ($sidecar.PSObject.Properties.Name -contains 'inspectorRoot') `
            -or -not ($sidecar.PSObject.Properties.Name -contains 'runtimeRoot')
        ) {
            throw "inspector_root_invalid: sidecar 형식이 올바르지 않습니다."
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($ExplicitRoot)) {
        $candidateRoot = $ExplicitRoot
        $distribution = $ExplicitWslDistribution
        $source = 'parameter'
    }
    elseif (-not [string]::IsNullOrWhiteSpace($env:CAMPUSLOOK_ILLUSTRATOR_INSPECTOR_ROOT)) {
        $candidateRoot = $env:CAMPUSLOOK_ILLUSTRATOR_INSPECTOR_ROOT
        $distribution = $env:CAMPUSLOOK_ILLUSTRATOR_INSPECTOR_WSL_DISTRIBUTION
        $source = 'environment'
    }
    else {
        $candidateRoot = [string]$sidecar.inspectorRoot
        if ($sidecar.PSObject.Properties.Name -contains 'wslDistribution') {
            $distribution = [string]$sidecar.wslDistribution
        }
        $source = 'sidecar'
    }

    if (-not [string]::IsNullOrWhiteSpace($ExplicitRuntimeRoot)) {
        $candidateRuntimeRoot = $ExplicitRuntimeRoot
        $runtimeSource = 'parameter'
    }
    elseif (-not [string]::IsNullOrWhiteSpace($env:CAMPUSLOOK_ILLUSTRATOR_INSPECTOR_RUNTIME_ROOT)) {
        $candidateRuntimeRoot = $env:CAMPUSLOOK_ILLUSTRATOR_INSPECTOR_RUNTIME_ROOT
        $runtimeSource = 'environment'
    }
    else {
        $candidateRuntimeRoot = [string]$sidecar.runtimeRoot
        $runtimeSource = 'sidecar'
    }

    if ([string]::IsNullOrWhiteSpace($candidateRoot)) {
        throw "inspector_root_invalid: root가 비어 있습니다."
    }
    if ([string]::IsNullOrWhiteSpace($candidateRuntimeRoot)) {
        throw "inspector_root_invalid: runtime root가 비어 있습니다."
    }
    if ([string]::IsNullOrWhiteSpace($distribution)) {
        $distribution = 'Ubuntu'
    }

    try {
        $rootItem = Get-Item -LiteralPath $candidateRoot -ErrorAction Stop
    }
    catch {
        throw "inspector_root_invalid: root 폴더를 찾을 수 없습니다."
    }
    if (-not $rootItem.PSIsContainer) {
        throw "inspector_root_invalid: root가 폴더가 아닙니다."
    }
    $root = $rootItem.FullName.TrimEnd([char[]]@('\', '/'))

    $requiredFiles = @(
        'package.json',
        'check-proof.sh',
        'analyze-proof.mjs',
        'inspect-illustrator.ps1',
        'contracts/inspector-result.schema.json'
    )
    foreach ($relativePath in $requiredFiles) {
        $requiredPath = Join-Path $root ($relativePath -replace '/', [IO.Path]::DirectorySeparatorChar)
        if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
            throw "inspector_root_invalid: 필수 파일이 없습니다: $relativePath"
        }
    }

    try {
        $packagePath = Join-Path $root 'package.json'
        $package = [IO.File]::ReadAllText($packagePath, [Text.UTF8Encoding]::new($false)) | ConvertFrom-Json
    }
    catch {
        throw "inspector_root_invalid: package.json을 읽을 수 없습니다."
    }
    if ([string]$package.name -ne 'campuslook-illustrator-inspector') {
        throw "inspector_root_invalid: 저장소 identity가 일치하지 않습니다."
    }

    try {
        $runtimeItem = Get-Item -LiteralPath $candidateRuntimeRoot -ErrorAction Stop
    }
    catch {
        throw "inspector_root_invalid: runtime root 폴더를 찾을 수 없습니다."
    }
    if (-not $runtimeItem.PSIsContainer) {
        throw "inspector_root_invalid: runtime root가 폴더가 아닙니다."
    }
    $runtimeRoot = $runtimeItem.FullName.TrimEnd([char[]]@('\', '/'))
    $rootPrefix = "$root$([IO.Path]::DirectorySeparatorChar)"
    if (
        $runtimeRoot.Equals($root, [StringComparison]::OrdinalIgnoreCase) `
        -or $runtimeRoot.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)
    ) {
        throw "inspector_root_invalid: runtime root는 source repository 밖에 있어야 합니다."
    }

    [PSCustomObject][ordered]@{
        WindowsRoot = $root
        RuntimeWindowsRoot = $runtimeRoot
        WslDistribution = $distribution
        Source = $source
        RuntimeSource = $runtimeSource
    }
}
