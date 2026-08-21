# Excel複数セルの一括ペーストの回帰テスト
#
#   PowerShell> .\tests\paste-run.ps1     # 全通過で終了コード0
#
# run.ps1 と同じ仕組み。index.html に paste-corpus.js を差し込んだ一時HTMLを作り、
# ヘッドレスChrome（無ければEdge）の --dump-dom で結果を回収する。
# 合成 ClipboardEvent を流して実際のペーストハンドラを通すので、
# cellsFromHtml だけでなく getPasteTargets / setFieldValue まで一気に検証できる。

#
# -Source に別の index.html を渡すと、そちらを検証できる。
# 「このテストは本当にバグを捕まえるのか」を確かめたいときに、
# 旧版を取り出して落ちることを確認するのに使う：
#   git show HEAD:index.html > tests\_old.html
#   .\tests\paste-run.ps1 -Source tests\_old.html    # ← 失敗するのが正しい

param([string]$Source)

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

$harness = Join-Path $here '_pasteharness.html'
$dump    = Join-Path $here '_pastedump.html'

$target = if ($Source) { (Resolve-Path $Source).Path } else { Join-Path $root 'index.html' }
Write-Host "検証対象: $target"
$html   = [System.IO.File]::ReadAllText($target)
$inject = '<pre id="testout"></pre>' + "`n" + '<script src="paste-corpus.js"></script>' + "`n</body>"
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
