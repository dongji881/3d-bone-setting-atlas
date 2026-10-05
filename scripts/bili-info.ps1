param(
  [Parameter(Mandatory = $true)][string[]]$Bv,
  [string]$Out = ""
)
$ErrorActionPreference = "Stop"
if (-not $Out) { $Out = Join-Path $env:TEMP "opencode\bili_info.txt" }
$lines = @()
foreach ($b in $Bv) {
  $tmp = Join-Path $env:TEMP ("opencode\bi_" + [guid]::NewGuid().ToString("N") + ".json")
  & curl.exe -s -m 25 -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" -H "Referer: https://www.bilibili.com/" "https://api.bilibili.com/x/web-interface/view?bvid=$b" -o $tmp
  try {
    $j = Get-Content -LiteralPath $tmp -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($j.code -eq 0) {
      $d = $j.data
      $mm = [math]::Floor($d.duration / 60); $ss = $d.duration % 60
      $lines += "{0}`t{1}:{2:d2}`t{3}`t{4}`t{5}" -f $b, $mm, $ss, $d.owner.name, $d.stat.view, $d.title
    } else { $lines += "$b`tERR code=$($j.code) $($j.message)" }
  } catch { $lines += "$b`tPARSE FAIL" }
  Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
}
[System.IO.File]::WriteAllLines($Out, $lines, [System.Text.UTF8Encoding]::new($false))
Write-Output "n=$($Bv.Count) -> $Out"
