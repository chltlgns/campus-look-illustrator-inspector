[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,

    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory,

    [string]$SourceDisplayName = '',

    [ValidateRange(50, 400)]
    [int]$RenderScale = 200,

    [switch]$ExportFullArtwork
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
chcp 65001 | Out-Null
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)

function Get-NumericBounds {
    param([Parameter(Mandatory = $true)]$Item)

    $raw = @($Item.GeometricBounds)
    if ($raw.Count -ne 4) {
        throw 'Illustrator 객체의 경계값이 4개가 아닙니다.'
    }

    return @(
        [double]$raw[0],
        [double]$raw[1],
        [double]$raw[2],
        [double]$raw[3]
    )
}

function Get-ArtboardMatch {
    param(
        [Parameter(Mandatory = $true)][double[]]$Bounds,
        [Parameter(Mandatory = $true)][object[]]$Artboards
    )

    $centerX = ($Bounds[0] + $Bounds[2]) / 2.0
    $centerY = ($Bounds[1] + $Bounds[3]) / 2.0
    $bestIndex = -1
    $bestArea = 0.0

    foreach ($artboard in $Artboards) {
        $rect = [double[]]$artboard.rect
        if (
            $centerX -ge $rect[0] -and
            $centerX -le $rect[2] -and
            $centerY -le $rect[1] -and
            $centerY -ge $rect[3]
        ) {
            $width = $rect[2] - $rect[0]
            $height = $rect[1] - $rect[3]
            return [ordered]@{
                index = [int]$artboard.index
                x = ($centerX - $rect[0]) / $width
                y = ($rect[1] - $centerY) / $height
            }
        }

        $intersectionWidth = [Math]::Max(
            0.0,
            [Math]::Min($Bounds[2], $rect[2]) - [Math]::Max($Bounds[0], $rect[0])
        )
        $intersectionHeight = [Math]::Max(
            0.0,
            [Math]::Min($Bounds[1], $rect[1]) - [Math]::Max($Bounds[3], $rect[3])
        )
        $intersectionArea = $intersectionWidth * $intersectionHeight
        if ($intersectionArea -gt $bestArea) {
            $bestArea = $intersectionArea
            $bestIndex = [int]$artboard.index
        }
    }

    if ($bestIndex -ge 0) {
        $artboard = $Artboards[$bestIndex]
        $rect = [double[]]$artboard.rect
        return [ordered]@{
            index = $bestIndex
            x = ($centerX - $rect[0]) / ($rect[2] - $rect[0])
            y = ($rect[1] - $centerY) / ($rect[1] - $rect[3])
        }
    }

    return [ordered]@{ index = -1; x = $null; y = $null }
}

function Get-FullArtworkBounds {
    param([Parameter(Mandatory = $true)]$Document)

    $left = [double]::PositiveInfinity
    $top = [double]::NegativeInfinity
    $right = [double]::NegativeInfinity
    $bottom = [double]::PositiveInfinity
    $found = $false

    for ($layerIndex = 1; $layerIndex -le $Document.Layers.Count; $layerIndex += 1) {
        $layer = $Document.Layers.Item($layerIndex)
        for ($itemIndex = 1; $itemIndex -le $layer.PageItems.Count; $itemIndex += 1) {
            try {
                $item = $layer.PageItems.Item($itemIndex)
                if ($item.Hidden) {
                    continue
                }
                $bounds = Get-NumericBounds -Item $item
                $left = [Math]::Min($left, $bounds[0])
                $top = [Math]::Max($top, $bounds[1])
                $right = [Math]::Max($right, $bounds[2])
                $bottom = [Math]::Min($bottom, $bounds[3])
                $found = $true
            }
            catch {
                continue
            }
        }
    }

    if (-not $found) {
        return $null
    }

    return @($left, $top, $right, $bottom)
}

if (-not (Test-Path -LiteralPath $InputPath -PathType Leaf)) {
    throw "Illustrator 파일을 찾을 수 없습니다: $InputPath"
}

[IO.Directory]::CreateDirectory($OutputDirectory) | Out-Null

$illustrator = $null
$document = $null
$originalFirstArtboardRect = $null
$originalUserInteractionLevel = $null
$previousDocument = $null

try {
    $illustrator = New-Object -ComObject Illustrator.Application
    $originalUserInteractionLevel = $illustrator.UserInteractionLevel
    if ($illustrator.Documents.Count -gt 0) {
        $previousDocument = $illustrator.ActiveDocument
    }
    $illustrator.UserInteractionLevel = -1
    $null = $illustrator.Open($InputPath)

    if ($illustrator.Documents.Count -lt 1) {
        throw "Illustrator가 파일을 열지 못했습니다: $InputPath"
    }

    $document = $illustrator.ActiveDocument

    $artboards = @()
    for ($index = 1; $index -le $document.Artboards.Count; $index += 1) {
        $artboard = $document.Artboards.Item($index)
        $rect = @($artboard.ArtboardRect) | ForEach-Object { [double]$_ }
        $artboards += [ordered]@{
            index = $index - 1
            name = [string]$artboard.Name
            rect = $rect
            width = $rect[2] - $rect[0]
            height = $rect[1] - $rect[3]
            render = "artboard-$($index - 1).png"
        }
    }

    $layers = @()
    for ($index = 1; $index -le $document.Layers.Count; $index += 1) {
        $layer = $document.Layers.Item($index)
        $layers += [ordered]@{
            index = $index - 1
            name = [string]$layer.Name
            visible = [bool]$layer.Visible
            locked = [bool]$layer.Locked
            directPageItems = [int]$layer.PageItems.Count
            childLayers = [int]$layer.Layers.Count
        }
    }

    $texts = @()
    for ($index = 1; $index -le $document.TextFrames.Count; $index += 1) {
        try {
            $textFrame = $document.TextFrames.Item($index)
            $bounds = [double[]](Get-NumericBounds -Item $textFrame)
            $match = Get-ArtboardMatch -Bounds $bounds -Artboards $artboards
            $texts += [ordered]@{
                index = $index - 1
                name = [string]$textFrame.Name
                contents = [string]$textFrame.Contents
                bounds = $bounds
                artboardIndex = [int]$match.index
                normalized = [ordered]@{ x = $match.x; y = $match.y }
                layer = [string]$textFrame.Layer.Name
                kind = [int]$textFrame.Kind
            }
        }
        catch {
            $texts += [ordered]@{
                index = $index - 1
                error = $_.Exception.Message
            }
        }
    }

    $documentDisplayName = if ([string]::IsNullOrWhiteSpace($SourceDisplayName)) {
        [string]$document.Name
    }
    else {
        $SourceDisplayName
    }

    $inspection = [ordered]@{
        schemaVersion = 1
        inspectedAt = [DateTimeOffset]::Now.ToString('o')
        sourcePath = $InputPath
        document = [ordered]@{
            name = $documentDisplayName
            artboards = [int]$document.Artboards.Count
            layers = [int]$document.Layers.Count
            pageItems = [int]$document.PageItems.Count
            textFrames = [int]$document.TextFrames.Count
            groupItems = [int]$document.GroupItems.Count
            pathItems = [int]$document.PathItems.Count
            compoundPathItems = [int]$document.CompoundPathItems.Count
            placedItems = [int]$document.PlacedItems.Count
            rasterItems = [int]$document.RasterItems.Count
        }
        artboards = $artboards
        layers = $layers
        texts = $texts
    }

    $json = $inspection | ConvertTo-Json -Depth 8
    $jsonPath = Join-Path $OutputDirectory 'document.json'
    [IO.File]::WriteAllText($jsonPath, $json, [Text.UTF8Encoding]::new($false))

    $pngOptions = New-Object -ComObject Illustrator.ExportOptionsPNG24
    $pngOptions.ArtBoardClipping = $true
    $pngOptions.Transparency = $false
    $pngOptions.HorizontalScale = $RenderScale
    $pngOptions.VerticalScale = $RenderScale

    for ($index = 0; $index -lt $document.Artboards.Count; $index += 1) {
        $document.Artboards.SetActiveArtboardIndex($index)
        $outputBase = Join-Path $OutputDirectory "artboard-$index"
        $document.Export($outputBase, 5, $pngOptions)
        Start-Sleep -Milliseconds 80
    }

    if ($ExportFullArtwork) {
        $fullBounds = Get-FullArtworkBounds -Document $document
        if ($null -ne $fullBounds) {
            $originalFirstArtboardRect = @($document.Artboards.Item(1).ArtboardRect)
            $document.Artboards.Item(1).ArtboardRect = $fullBounds
            $document.Artboards.SetActiveArtboardIndex(0)
            $outputBase = Join-Path $OutputDirectory 'full-artwork'
            $document.Export($outputBase, 5, $pngOptions)
        }
    }

    [ordered]@{
        ok = $true
        document = $documentDisplayName
        outputDirectory = $OutputDirectory
        artboards = [int]$document.Artboards.Count
        texts = [int]$document.TextFrames.Count
    } | ConvertTo-Json -Compress
}
finally {
    if ($null -ne $document) {
        if ($null -ne $originalFirstArtboardRect) {
            try {
                $document.Artboards.Item(1).ArtboardRect = $originalFirstArtboardRect
            }
            catch {
                # 원본은 저장하지 않으므로 복원 실패도 파일에는 반영되지 않습니다.
            }
        }
        try {
            $document.Close(2)
        }
        catch {
            # 이미 닫힌 문서라면 무시합니다.
        }
    }
    if ($null -ne $previousDocument) {
        try {
            $previousDocument.Activate()
        }
        catch {
            # 검사 전 문서가 이미 닫혔다면 무시합니다.
        }
    }
    if ($null -ne $illustrator -and $null -ne $originalUserInteractionLevel) {
        try {
            $illustrator.UserInteractionLevel = $originalUserInteractionLevel
        }
        catch {
            # Illustrator가 종료된 경우는 무시합니다.
        }
    }
}
