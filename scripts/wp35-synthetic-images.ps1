$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$fixtureDirectory = Join-Path $PSScriptRoot '../artifacts/wp35-live'
[IO.Directory]::CreateDirectory($fixtureDirectory) | Out-Null
$fixtures = @{
  receipt = @('SYNTHETIC TEST STORE', '2026-10-01', '', 'COFFEE          USD 3.50', 'BREAD           USD 2.25', 'SUBTOTAL        USD 5.75', 'TAX             USD 0.25', 'TOTAL           USD 6.00', 'AMOUNT DUE      USD 6.00', '', 'SYNTHETIC TEST DATA ONLY')
  purchase = @('SYNTHETIC MUG', '', 'PRICE: USD 12.50', '', 'One ceramic mug', 'SYNTHETIC TEST DATA ONLY')
}
foreach ($name in $fixtures.Keys) {
  $bitmap = [Drawing.Bitmap]::new(1000, 900)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  $font = [Drawing.Font]::new('Consolas', 30)
  try {
    $graphics.Clear([Drawing.Color]::White)
    $graphics.TextRenderingHint = [Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $y = 45
    foreach ($line in $fixtures[$name]) { $graphics.DrawString($line, $font, [Drawing.Brushes]::Black, 35, $y); $y += 65 }
    $bitmap.Save((Join-Path $fixtureDirectory ($name+'.png')), [Drawing.Imaging.ImageFormat]::Png)
  } finally { $font.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
}
Write-Output 'Created two synthetic OCR fixtures in artifacts/wp35-live.'
