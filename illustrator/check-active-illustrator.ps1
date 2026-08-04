[CmdletBinding()]
param(
    [switch]$Quiet,
    [switch]$NoOpen
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
chcp 65001 | Out-Null
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)

$title = '캠퍼스룩 야구점퍼 시안 검사'

function Show-Message {
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [ValidateSet('Info', 'Warning', 'Error')][string]$Kind = 'Info',
        [switch]$Ask
    )

    if ($Quiet) {
        [ordered]@{ kind = $Kind; message = $Message } | ConvertTo-Json -Compress
        return $null
    }

    Add-Type -AssemblyName System.Windows.Forms
    $icon = switch ($Kind) {
        'Warning' { [Windows.Forms.MessageBoxIcon]::Warning }
        'Error' { [Windows.Forms.MessageBoxIcon]::Error }
        default { [Windows.Forms.MessageBoxIcon]::Information }
    }
    $buttons = if ($Ask) {
        [Windows.Forms.MessageBoxButtons]::YesNo
    }
    else {
        [Windows.Forms.MessageBoxButtons]::OK
    }
    return [Windows.Forms.MessageBox]::Show($Message, $title, $buttons, $icon)
}

try {
    $illustratorProcesses = @(Get-Process Illustrator -ErrorAction SilentlyContinue)
    if ($illustratorProcesses.Count -lt 1) {
        Show-Message -Kind Warning -Message 'Illustrator를 먼저 실행하고 검사할 AI 문서를 열어주세요.' | Out-Null
        exit 2
    }

    $launcher = Join-Path $PSScriptRoot 'run-proof-check.ps1'
    if (-not (Test-Path -LiteralPath $launcher -PathType Leaf)) {
        throw "검사 실행기를 찾을 수 없습니다: $launcher"
    }

    & $launcher -Quiet:$Quiet -NoOpen:$NoOpen -UseActiveDocument
}
catch {
    if ($Quiet) {
        [ordered]@{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
    }
    else {
        Show-Message -Kind Error -Message $_.Exception.Message | Out-Null
    }
    exit 1
}
