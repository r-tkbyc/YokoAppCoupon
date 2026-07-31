# 日時パースの回帰テスト
#
#   PowerShell> .\tests\run.ps1
#
# index.html にテストスクリプトを差し込んだ一時HTMLを作り、
# ヘッドレスChrome（無ければEdge）で開いて結果を取り出す。
# 新しい日時の書き方を見つけたら datetime-corpus.js の CORPUS に1行足して再実行する。

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $here

$browser = $null
foreach ($p in @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)) { if (Test-Path $p) { $browser = $p; break } }

if (-not $browser) { Write-Host "Chrome / Edge が見つかりませんでした"; exit 1 }

$harness = Join-Path $here '_harness.html'
$dump    = Join-Path $here '_dump.html'

$html   = [System.IO.File]::ReadAllText((Join-Path $root 'index.html'))
$inject = '<pre id="testout"></pre>' + "`n" + '<script src="datetime-corpus.js"></script>' + "`n</body>"
[System.IO.File]::WriteAllText($harness, $html.Replace('</body>', $inject), (New-Object System.Text.UTF8Encoding($false)))

$uri = 'file:///' + ($harness -replace '\\', '/')
Start-Process -FilePath $browser -ArgumentList @(
  '--headless=new', '--disable-gpu', '--no-sandbox',
  '--window-size=1400,3000', '--virtual-time-budget=6000', '--dump-dom', $uri
) -RedirectStandardOutput $dump -RedirectStandardError "$dump.err" -NoNewWindow -Wait

$content = [System.IO.File]::ReadAllText($dump)
Remove-Item $harness, $dump, "$dump.err" -Force -ErrorAction SilentlyContinue

$m = [regex]::Match($content, '(?s)<pre id="testout">(.*?)</pre>')
if (-not $m.Success -or -not $m.Groups[1].Value.Trim()) {
  Write-Host "テスト結果を取得できませんでした（index.html の JS でエラーが出ている可能性があります）"
  exit 1
}

$text = [System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value)
Write-Host $text

if ($text -match '>>> 全パス') { exit 0 } else { exit 1 }
