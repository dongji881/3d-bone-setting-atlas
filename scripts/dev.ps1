param([switch]$SelfTest)
$ErrorActionPreference = "Continue"
$proj = Split-Path -Parent $PSScriptRoot

if ($SelfTest) {
  $node = Get-Command node -ErrorAction SilentlyContinue
  Write-Host ("[信息] Node.js: " + $(if ($node) { (& node -v) } else { "未安装" }))
  Write-Host "[结果] 自检完成"
  exit 0
}

$node = Get-Command node -ErrorAction SilentlyContinue
$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $node -or -not $npm) {
  Write-Host "[错误] 开发模式需要 Node.js（双击「一键启动.bat」则无需安装）。"
  Write-Host "       安装地址：https://nodejs.org/zh-cn"
  Start-Process "https://nodejs.org/zh-cn"
  exit 1
}

$nm = Join-Path $proj "node_modules"
if (-not (Test-Path -LiteralPath $nm)) {
  Write-Host "[提示] 首次运行，正在安装依赖（需要几分钟）..."
  Push-Location $proj
  & npm install --registry=https://registry.npmmirror.com
  if ($LASTEXITCODE -ne 0) { & npm install }
  if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Host "[错误] 依赖安装失败，请检查网络后重试。"
    exit 1
  }
  Pop-Location
}

Write-Host "[提示] 正在启动开发服务器：http://localhost:5173"
Write-Host "       修改 src 下代码会自动热更新，关闭本窗口即退出。"
Push-Location $proj
& npm run dev
Pop-Location
