param(
  [Parameter(Mandatory = $true)][string]$Url,
  [int]$B = 15000,
  [int]$W = 1600,
  [int]$H = 2600,
  [string]$Out = "$env:TEMP\opencode\dump.html"
)
$E = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $E)) { $E = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
& $E --headless=new --no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars "--virtual-time-budget=$B" "--window-size=$W,$H" --dump-dom $Url |
  Out-File -FilePath $Out -Encoding utf8
Write-Output "dumped $Out"
