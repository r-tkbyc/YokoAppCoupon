# cms_inject.js の反映テスト（Mantineのモックフォーム相手）
#
#   PowerShell> .\tests\cms-run.ps1     # 全通過で終了コード0
#
# esm.sh から本物の React + Mantine を読み込んでCMSのフォームを模したものを組み、
# cms_inject.js をそのまま読ませて YK_COUPON_TO_CMS を1発流す。
# 反映結果（report）と画面の実値の両方を検証する。要ネットワーク。
#
# 日時ピッカーはモックに置いていないため、公開期間／利用可能期間は
# 「NG:欄が見つからない」になるのが正しい（エラー報告が効いていることの確認を兼ねる）。

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

$browser = $null
foreach ($p in @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)) { if (Test-Path $p) { $browser = $p; break } }

if (-not $browser) { Write-Host "Chrome / Edge が見つかりませんでした"; exit 1 }

$dump = Join-Path $here '_cmsdump.html'
$uri  = 'file:///' + ((Join-Path $here 'cms-harness.html') -replace '\\', '/')

Start-Process -FilePath $browser -ArgumentList @(
  '--headless=new', '--disable-gpu', '--no-sandbox', '--allow-file-access-from-files',
  '--window-size=1400,3000', '--virtual-time-budget=30000', '--dump-dom', $uri
) -RedirectStandardOutput $dump -RedirectStandardError "$dump.err" -NoNewWindow -Wait

$content = [System.IO.File]::ReadAllText($dump)
Remove-Item $dump, "$dump.err" -Force -ErrorAction SilentlyContinue

$m = [regex]::Match($content, '(?s)<pre id="testout">(.*?)</pre>')
if (-not $m.Success -or -not $m.Groups[1].Value.Trim()) {
  Write-Host "結果を取得できませんでした"
  exit 1
}
$text = [System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value)
Write-Host $text
if ($text -match '>>> 全パス') { exit 0 } else { exit 1 }
