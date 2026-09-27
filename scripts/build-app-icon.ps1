param([Parameter(Mandatory=$true)][string]$SourcePath)

# Format conversion only: preserve the generated artwork and alpha channel.
Add-Type -AssemblyName System.Drawing
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskIconDir = Join-Path $taskRoot 'desktop/assets'
$taskPublicDir = Join-Path $taskRoot 'public'
New-Item -ItemType Directory -Force -Path $taskIconDir, $taskPublicDir | Out-Null
Copy-Item -LiteralPath $SourcePath -Destination (Join-Path $taskRoot 'src/assets/uta-app-icon.png') -Force
Copy-Item -LiteralPath $SourcePath -Destination (Join-Path $taskPublicDir 'uta-icon.png') -Force
$taskImage = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $SourcePath).Path)
$taskSizes = @(16, 24, 32, 48, 64, 128, 256)
$taskFrames = @()
try {
    foreach ($taskSize in $taskSizes) {
        $taskBitmap = [System.Drawing.Bitmap]::new($taskSize, $taskSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $taskGraphics = [System.Drawing.Graphics]::FromImage($taskBitmap)
        $taskGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $taskGraphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $taskGraphics.DrawImage($taskImage, 0, 0, $taskSize, $taskSize)
        $taskStream = [System.IO.MemoryStream]::new()
        $taskBitmap.Save($taskStream, [System.Drawing.Imaging.ImageFormat]::Png)
        $taskFrames += ,$taskStream.ToArray()
        $taskStream.Dispose(); $taskGraphics.Dispose(); $taskBitmap.Dispose()
    }
    $taskOutput = [System.IO.File]::Create((Join-Path $taskIconDir 'uta.ico'))
    $taskWriter = [System.IO.BinaryWriter]::new($taskOutput)
    try {
        $taskWriter.Write([uint16]0); $taskWriter.Write([uint16]1); $taskWriter.Write([uint16]$taskSizes.Count)
        $taskOffset = 6 + 16 * $taskSizes.Count
        for ($taskIndex = 0; $taskIndex -lt $taskSizes.Count; $taskIndex++) {
            $taskSizeByte = if ($taskSizes[$taskIndex] -eq 256) { 0 } else { $taskSizes[$taskIndex] }
            $taskWriter.Write([byte]$taskSizeByte); $taskWriter.Write([byte]$taskSizeByte)
            $taskWriter.Write([byte]0); $taskWriter.Write([byte]0)
            $taskWriter.Write([uint16]1); $taskWriter.Write([uint16]32)
            $taskWriter.Write([uint32]$taskFrames[$taskIndex].Length); $taskWriter.Write([uint32]$taskOffset)
            $taskOffset += $taskFrames[$taskIndex].Length
        }
        foreach ($taskFrame in $taskFrames) { $taskWriter.Write([byte[]]$taskFrame) }
    } finally { $taskWriter.Dispose(); $taskOutput.Dispose() }
} finally { $taskImage.Dispose() }
