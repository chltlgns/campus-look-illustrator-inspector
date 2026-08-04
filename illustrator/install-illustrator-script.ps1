[CmdletBinding()]
param(
    [switch]$NoElevation,
    [string]$InspectorRoot = '',
    [string]$WslDistribution = 'Ubuntu'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
chcp 65001 | Out-Null
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)

function Copy-WithUtf8Bom {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    $text = [IO.File]::ReadAllText($Source, [Text.UTF8Encoding]::new($false))
    [IO.File]::WriteAllText($Destination, $text, [Text.UTF8Encoding]::new($true))
}

$rootResolverSource = Join-Path $PSScriptRoot 'inspector-root.ps1'
if (-not (Test-Path -LiteralPath $rootResolverSource -PathType Leaf)) {
    throw 'inspector_root_invalid: root resolver를 찾을 수 없습니다.'
}
. $rootResolverSource
$repositoryCandidate = if ([string]::IsNullOrWhiteSpace($InspectorRoot)) {
    Split-Path $PSScriptRoot -Parent
}
else {
    $InspectorRoot
}
$rootSettings = Resolve-InspectorRoot `
    -ExplicitRoot $repositoryCandidate `
    -ExplicitWslDistribution $WslDistribution

$localRoot = Join-Path $env:LOCALAPPDATA 'Campuslook\IllustratorProofCheck'
[IO.Directory]::CreateDirectory($localRoot) | Out-Null

$launcherSource = Join-Path $PSScriptRoot 'run-proof-check.ps1'
$activeCheckerSource = Join-Path $PSScriptRoot 'check-active-illustrator.ps1'
$fastInspectorSource = Join-Path $PSScriptRoot 'FastProofInspector.jsx'
$batchCheckerSource = Join-Path $PSScriptRoot 'batch-check-ai.ps1'
$jsxSource = Join-Path $PSScriptRoot 'CampuslookProofCheck.jsx'
$rootResolverInstalled = Join-Path $localRoot 'inspector-root.ps1'
$rootSidecarInstalled = Join-Path $localRoot 'inspector-root.json'
$launcherInstalled = Join-Path $localRoot 'run-proof-check.ps1'
$activeCheckerInstalled = Join-Path $localRoot 'check-active-illustrator.ps1'
$fastInspectorInstalled = Join-Path $localRoot 'FastProofInspector.jsx'
$batchCheckerInstalled = Join-Path $localRoot 'batch-check-ai.ps1'
$jsxStaged = Join-Path $localRoot 'CampuslookProofCheck.jsx'

Copy-WithUtf8Bom -Source $launcherSource -Destination $launcherInstalled
Copy-WithUtf8Bom -Source $activeCheckerSource -Destination $activeCheckerInstalled
Copy-WithUtf8Bom -Source $fastInspectorSource -Destination $fastInspectorInstalled
Copy-WithUtf8Bom -Source $batchCheckerSource -Destination $batchCheckerInstalled
Copy-WithUtf8Bom -Source $jsxSource -Destination $jsxStaged
Copy-WithUtf8Bom -Source $rootResolverSource -Destination $rootResolverInstalled
$rootSidecar = [ordered]@{
    schemaVersion = 1
    inspectorRoot = [string]$rootSettings.WindowsRoot
    wslDistribution = [string]$rootSettings.WslDistribution
} | ConvertTo-Json -Depth 3
[IO.File]::WriteAllText($rootSidecarInstalled, "$rootSidecar`n", [Text.UTF8Encoding]::new($false))

$startMenuDirectory = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Campuslook'
[IO.Directory]::CreateDirectory($startMenuDirectory) | Out-Null
$shortcutPath = Join-Path $startMenuDirectory 'Illustrator Proof Check.lnk'
$powershellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $powershellPath
$shortcut.Arguments = "-NoLogo -NoProfile -STA -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$activeCheckerInstalled`""
$shortcut.WorkingDirectory = $localRoot
$shortcut.Description = 'Campuslook Illustrator varsity-jacket proof check'
$shortcut.Hotkey = 'CTRL+SHIFT+Q'
$shortcut.WindowStyle = 7
$shortcut.Save()

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
    throw "Illustrator Scripts directory was not found below: $presetsRoot"
}

$jsxDestination = Join-Path $scriptsDirectory 'Campuslook Proof Check.jsx'
$installed = $false
if (Test-Path -LiteralPath $jsxDestination -PathType Leaf) {
    $sourceHash = (Get-FileHash -LiteralPath $jsxStaged -Algorithm SHA256).Hash
    $destinationHash = (Get-FileHash -LiteralPath $jsxDestination -Algorithm SHA256).Hash
    $installed = $sourceHash -eq $destinationHash
}
try {
    if (-not $installed) {
        Copy-Item -LiteralPath $jsxStaged -Destination $jsxDestination -Force -ErrorAction Stop
        $installed = Test-Path -LiteralPath $jsxDestination -PathType Leaf
    }
}
catch [UnauthorizedAccessException] {
    if ($NoElevation) {
        $installed = $false
    }
    else {
        $sourceEscaped = $jsxStaged.Replace("'", "''")
        $destinationEscaped = $jsxDestination.Replace("'", "''")
        $elevatedCommand = @"
`$ErrorActionPreference = 'Stop'
Copy-Item -LiteralPath '$sourceEscaped' -Destination '$destinationEscaped' -Force
"@
        $encodedCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($elevatedCommand))
        $process = Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -PassThru -ArgumentList @(
            '-NoLogo',
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy', 'Bypass',
            '-EncodedCommand', $encodedCommand
        )
        if ($process.ExitCode -ne 0) {
            throw "Elevated JSX copy failed with exit code $($process.ExitCode)."
        }
        $installed = Test-Path -LiteralPath $jsxDestination -PathType Leaf
    }
}

[ordered]@{
    ok = $installed
    launcher = $launcherInstalled
    activeChecker = $activeCheckerInstalled
    fastInspector = $fastInspectorInstalled
    batchChecker = $batchCheckerInstalled
    rootResolver = $rootResolverInstalled
    rootSidecar = $rootSidecarInstalled
    jsx = $jsxDestination
    shortcut = $shortcutPath
    hotkey = $shortcut.Hotkey
    restartIllustratorRequired = $installed
    localOnly = -not $installed
} | ConvertTo-Json -Depth 3

if (-not $installed) {
    exit 2
}
