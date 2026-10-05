param(
  [string]$Bvid = "BV1ziige1Edr",
  [string]$Out = "",
  [int]$W = 960,
  [int]$H = 560,
  [int]$B = 20000
)
if (-not $Out) { $Out = Join-Path $env:TEMP "opencode\player.png" }
$u = "https://player.bilibili.com/player.html?bvid=$Bvid&page=1&autoplay=0&high_quality=1"
$shot = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "shot.ps1"
& $shot -Url $u -Out $Out -W $W -H $H -B $B
Write-Output "started $Bvid -> $Out"
