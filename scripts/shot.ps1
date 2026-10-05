param(
  [Parameter(Mandatory = $true)][string]$Url,
  [Parameter(Mandatory = $true)][string]$Out,
  [int]$W = 1600,
  [int]$H = 900,
  [int]$B = 14000
)
$E = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $E)) { $E = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
Add-Content -Path "$env:TEMP\opencode\shot.log" -Value "URL=[$Url] OUT=[$Out]"
& $E --headless=new --no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars --run-all-compositor-stages-before-draw --disable-new-content-rendering-timeout "--screenshot=$Out" "--window-size=$W,$H" "--virtual-time-budget=$B" $Url
Start-Sleep -Milliseconds 300
