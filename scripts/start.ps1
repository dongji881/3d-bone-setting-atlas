param(
  [switch]$SelfTest,
  [switch]$NoOpen
)
$ErrorActionPreference = "Continue"
$proj = Split-Path -Parent $PSScriptRoot

function Open-NodeSite { Start-Process "https://nodejs.org/zh-cn" }

if ($SelfTest) {
  $ok = $true
  foreach ($f in @("scripts\serve.ps1", "package.json")) {
    $p = Join-Path $proj $f
    if (Test-Path -LiteralPath $p) { Write-Host "[OK] $f" } else { Write-Host "[缺失] $f"; $ok = $false }
  }
  $hasDist = Test-Path -LiteralPath (Join-Path $proj "dist\index.html")
  Write-Host ("[信息] dist 构建产物: " + $(if ($hasDist) { "已存在（可离线双击启动）" } else { "缺失（启动时会自动构建，需要 Node.js）" }))
  $node = Get-Command node -ErrorAction SilentlyContinue
  Write-Host ("[信息] Node.js: " + $(if ($node) { (& node -v) } else { "未安装" }))
  if ($ok) { Write-Host "[结果] 自检通过"; exit 0 } else { Write-Host "[结果] 自检失败"; exit 1 }
}

$dist = Join-Path $proj "dist\index.html"
if (-not (Test-Path -LiteralPath $dist)) {
  Write-Host "[提示] 未找到 dist 构建产物，开始本地构建（首次需要几分钟）..."
  $node = Get-Command node -ErrorAction SilentlyContinue
  $npm = Get-Command npm -ErrorAction SilentlyContinue
  if (-not $node -or -not $npm) {
    Write-Host "[错误] 本机未安装 Node.js，无法自动构建。"
    Write-Host "       请安装 Node.js 后重新双击「一键启动.bat」："
    Write-Host "       https://nodejs.org/zh-cn"
    Open-NodeSite
    exit 1
  }
  Push-Location $proj
  Write-Host "[步骤] 安装依赖 npm install ..."
  & npm install --registry=https://registry.npmmirror.com
  if ($LASTEXITCODE -ne 0) { & npm install }
  if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Host "[错误] 依赖安装失败，请检查网络后重试。"
    exit 1
  }
  Write-Host "[步骤] 构建 npm run build ..."
  & npm run build
  if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Host "[错误] 构建失败。"
    exit 1
  }
  Pop-Location
}

& (Join-Path $PSScriptRoot "serve.ps1") -NoOpen:$NoOpen
