Set-StrictMode -Version Latest

function Resolve-InspectorRoot {
    [CmdletBinding()]
    param(
        [string]$ExplicitRoot = '',
        [string]$SidecarPath = '',
        [string]$ExplicitWslDistribution = ''
    )

    $candidateRoot = ''
    $distribution = ''
    $source = ''

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
    elseif (-not [string]::IsNullOrWhiteSpace($SidecarPath) -and (Test-Path -LiteralPath $SidecarPath -PathType Leaf)) {
        try {
            $sidecar = [IO.File]::ReadAllText($SidecarPath, [Text.UTF8Encoding]::new($false)) | ConvertFrom-Json
        }
        catch {
            throw "inspector_root_invalid: sidecar JSON을 읽을 수 없습니다."
        }
        if (
            -not ($sidecar.PSObject.Properties.Name -contains 'schemaVersion') `
            -or [int]$sidecar.schemaVersion -ne 1 `
            -or -not ($sidecar.PSObject.Properties.Name -contains 'inspectorRoot')
        ) {
            throw "inspector_root_invalid: sidecar 형식이 올바르지 않습니다."
        }
        $candidateRoot = [string]$sidecar.inspectorRoot
        if ($sidecar.PSObject.Properties.Name -contains 'wslDistribution') {
            $distribution = [string]$sidecar.wslDistribution
        }
        $source = 'sidecar'
    }
    else {
        throw "inspector_root_invalid: CAMPUSLOOK_ILLUSTRATOR_INSPECTOR_ROOT 또는 installer sidecar가 필요합니다."
    }

    if ([string]::IsNullOrWhiteSpace($candidateRoot)) {
        throw "inspector_root_invalid: root가 비어 있습니다."
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

    [PSCustomObject][ordered]@{
        WindowsRoot = $root
        WslDistribution = $distribution
        Source = $source
    }
}
