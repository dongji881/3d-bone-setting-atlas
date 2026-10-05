param(
  [string]$Root = "",
  [switch]$NoOpen
)
$ErrorActionPreference = "Stop"

if (-not $Root) { $Root = Join-Path (Split-Path -Parent $PSScriptRoot) "dist" }
$Root = (Resolve-Path -LiteralPath $Root).Path

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".mjs"  = "text/javascript; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".map"  = "application/json"
  ".txt"  = "text/plain; charset=utf-8"
  ".svg"  = "image/svg+xml"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".gif"  = "image/gif"
  ".ico"  = "image/x-icon"
  ".webmanifest" = "application/manifest+json"
  ".glb"  = "model/gltf-binary"
  ".gltf" = "model/gltf+json"
  ".bin"  = "application/octet-stream"
  ".wasm" = "application/wasm"
  ".woff" = "font/woff"
  ".woff2" = "font/woff2"
  ".ttf"  = "font/ttf"
  ".mp4"  = "video/mp4"
  ".webm" = "video/webm"
}

$indexHtml = Join-Path $Root "index.html"
if (-not (Test-Path -LiteralPath $indexHtml)) {
  Write-Host "[错误] 未找到构建产物：$indexHtml"
  exit 1
}

$listener = $null
$port = 0
foreach ($p in 8080..8099) {
  $l = New-Object System.Net.HttpListener
  $l.Prefixes.Add("http://localhost:$p/")
  try {
    $l.Start()
    $listener = $l
    $port = $p
    break
  } catch {
    try { $l.Close() } catch { }
  }
}
if (-not $listener) {
  Write-Host "[错误] 8080-8099 端口均被占用，请关闭其他程序后重试。"
  exit 1
}

function Send-File([System.Net.HttpListenerContext]$ctx, [string]$path, [int]$status, [string]$type, [bool]$noCache) {
  $res = $ctx.Response
  $res.StatusCode = $status
  if ($type) { $res.ContentType = $type }
  if ($noCache) { $res.Headers["Cache-Control"] = "no-cache" }
  if ($status -eq 200 -and (Test-Path -LiteralPath $path -PathType Leaf)) {
    $bytes = [System.IO.File]::ReadAllBytes($path)
    $res.ContentLength64 = $bytes.Length
    try { $res.OutputStream.Write($bytes, 0, $bytes.Length) } catch { }
  } else {
    $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
    $res.ContentLength64 = $msg.Length
    try { $res.OutputStream.Write($msg, 0, $msg.Length) } catch { }
  }
  try { $res.Close() } catch { }
}

$url = "http://localhost:$port/"
Write-Host ""
Write-Host "已启动本地服务（3D 正骨教学程序）"
Write-Host "访问地址 : $url"
Write-Host "资源目录 : $Root"
Write-Host "关闭本窗口即退出程序。"
Write-Host ""
if (-not $NoOpen) { Start-Process $url }

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
  } catch {
    break
  }
  $req = $ctx.Request
  $rel = ""
  try {
    $rel = [Uri]::UnescapeDataString($req.Url.AbsolutePath)
  } catch { }
  $rel = ($rel -replace "/", [IO.Path]::DirectorySeparatorChar).TrimStart([IO.Path]::DirectorySeparatorChar)

  $status = 200
  $type = ""
  $noCache = $false
  $file = Join-Path $Root $rel

  $isSafe = -not ($rel -match "\.\.")

  if (-not $isSafe) {
    Send-File $ctx "" 403 "" $false
    continue
  }

  if (Test-Path -LiteralPath $file -PathType Leaf) {
    $ext = [IO.Path]::GetExtension($file).ToLowerInvariant()
    if ($mime.ContainsKey($ext)) { $type = $mime[$ext] } else { $type = "application/octet-stream" }
    if ($ext -eq ".html") { $noCache = $true }
  } elseif ($rel -notmatch "\.[A-Za-z0-9]+$") {
    $file = $indexHtml
    $type = $mime[".html"]
    $noCache = $true
  } else {
    $status = 404
    $file = ""
  }
  Send-File $ctx $file $status $type $noCache
}
