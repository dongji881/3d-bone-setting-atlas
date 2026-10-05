param(
  [string]$Q = "",
  [string]$E = "",
  [string]$Out = "",
  [int]$N = 12
)
$ErrorActionPreference = "Stop"
if (-not $Out) { $Out = Join-Path $env:TEMP "opencode\bili.txt" }
$enc = if ($E) { $E } else { [uri]::EscapeDataString($Q) }
if (-not $Q) { $Q = "[$E]" }
$tmp = Join-Path $env:TEMP ("opencode\bs_" + [guid]::NewGuid().ToString("N") + ".html")
$c = ""
for ($i = 0; $i -lt 4; $i++) {
  if ($i -gt 0) { Start-Sleep -Seconds (10 * $i) }
  & curl.exe -s -m 25 -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" -H "Referer: https://www.bilibili.com/" "https://search.bilibili.com/all?keyword=$enc" -o $tmp
  if ($LASTEXITCODE -ne 0) { continue }
  $c = Get-Content -LiteralPath $tmp -Raw -Encoding UTF8
  if ($c.Length -gt 5000 -and $c -match 'bvid') { break }
  $c = ""
}
Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
if (-not $c) { [System.IO.File]::WriteAllText($Out, "# BLOCKED: $Q", [System.Text.UTF8Encoding]::new($false)); Write-Output "BLOCKED $Q"; exit 1 }
$rows = @()
$seen = @{}
foreach ($m in [regex]::Matches($c, 'bvid:"(?<b>BV1[A-Za-z0-9]+)"')) {
  $b = $m.Groups['b'].Value
  if ($seen[$b]) { continue }; $seen[$b] = 1
  $pre = $c.Substring([Math]::Max(0, $m.Index - 1200), [Math]::Min(1200, $m.Index))
  $post = $c.Substring($m.Index + $m.Length, [Math]::Min(1200, $c.Length - $m.Index - $m.Length))
  $tm = [regex]::Matches($post, 'title:"(?<t>(?:[^"\\]|\\.)*)"') | Select-Object -First 1
  $am = [regex]::Matches($pre, 'author:"(?<a>(?:[^"\\]|\\.)*)"') | Select-Object -Last 1
  $pm = [regex]::Matches($post, 'play:(?<p>\d+)') | Select-Object -First 1
  $t = if ($tm) { [regex]::Replace([regex]::Unescape($tm.Groups['t'].Value), '<[^>]*>', '') } else { '?' }
  $a = if ($am) { [regex]::Unescape($am.Groups['a'].Value) } else { '?' }
  $p = if ($pm) { [int]$pm.Groups['p'].Value } else { 0 }
  $rows += [pscustomobject]@{ bv = $b; play = $p; author = $a; title = $t }
}
$lines = @("# Q: $Q  (results: $($rows.Count))")
$lines += ($rows | Sort-Object -Property play -Descending | Select-Object -First $N |
  ForEach-Object { "{0}`t{1}`t{2}`t{3}" -f $_.bv, $_.play, $_.author, $_.title })
[System.IO.File]::WriteAllLines($Out, $lines, [System.Text.UTF8Encoding]::new($false))
Write-Output "rows=$($rows.Count) -> $Out"
