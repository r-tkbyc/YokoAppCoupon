/* Excel複数セルの一括ペーストの回帰テスト
 *
 *   PowerShell> .\tests\paste-run.ps1
 *
 * run.ps1 と同じ仕組みで index.html に差し込まれて動く。
 * 合成 ClipboardEvent を document に流し、実際のペーストハンドラを通す。
 *
 * ★HTMLのフィクスチャは Excel が実際に出力したものをそのまま使うこと。
 *   作文したHTMLでは「ソース側の折り返し」という肝心の性質が再現できない。
 */
(() => {
  const out = [];
  const say = s => out.push(s);
  let fail = 0;

  const $ = s => document.querySelector(s);
  const NL = String.fromCharCode(10);
  const TAB = String.fromCharCode(9);

  // ---------------------------------------------------------------
  // フィクスチャ1: Excel が実際に出したHTML（2026-08-21 実機採取）
  //
  // C22:C23 をコピーしたもの。注目すべきは <td> の中身が
  //   ［宮脇賣扇庵］扇子ケース
  //     プレゼント
  // と、Excel によってソース側で折り返されている点。
  // これを文字としての改行と解釈すると本文が壊れる。
  // ---------------------------------------------------------------
  const EXCEL_WRAPPED = [
    '<html xmlns:x="urn:schemas-microsoft-com:office:excel">',
    '<head><meta http-equiv=Content-Type content="text/html; charset=utf-8">',
    '<style><!--br',
    String.fromCharCode(9) + '{mso-data-placement:same-cell;}',
    '--></style></head>',
    '<body link=blue vlink=purple>',
    '<table border=0 cellpadding=0 cellspacing=0 width=490>',
    ' <tr height=78>',
    '<!--StartFragment-->',
    '  <td height=78 class=xl65 width=397 style=\'height:58.9pt;width:298pt\'>［宮脇賣扇庵］扇子ケース',
    '  プレゼント</td>',
    '  <td class=xl64 width=93 style=\'border-left:none;width:70pt\'>10</td>',
    '<!--EndFragment-->',
    ' </tr>',
    '</table>',
    '</body>',
    '</html>',
  ].join(NL);

  // セル内で Alt+Enter した本物の改行は <br>。これは残らないといけない。
  const EXCEL_REAL_BR = [
    '<table>',
    ' <tr>',
    '  <td class=xl65>1階',
    '  化粧品売場<br>',
    '  2階 婦人服売場</td>',
    '  <td class=xl64>30</td>',
    ' </tr>',
    '</table>',
  ].join(NL);

  // ---------------------------------------------------------------
  function firePaste(el, html, plain){
    const dt = new DataTransfer();
    if (html  != null) dt.setData('text/html',  html);
    if (plain != null) dt.setData('text/plain', plain);
    const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
  }

  function clearAllFields(){
    document.querySelectorAll('textarea, input').forEach(el => {
      if (el.readOnly || el.disabled) return;
      const t = (el.type || '').toLowerCase();
      if (t === 'datetime-local') return;
      if (el.tagName === 'INPUT' && t !== 'text' && t !== 'number') return;
      el.value = '';
    });
  }

  function check(label, got, want){
    const ok = got === want;
    if (!ok) fail++;
    say(`  ${ok ? 'OK ' : 'NG '} ${label}`);
    if (!ok){
      say(`        期待 ${JSON.stringify(want)}`);
      say(`        実際 ${JSON.stringify(got)}`);
    }
  }

  const titleIn  = $('.set[data-set="title"] .input');
  const firstCome = $('#firstCome');
  const floorIn  = $('.set[data-set="floor-brand"] .input-floor');

  say('=== Excel複数セルの一括ペースト ===');
  say('');
  say('■ Excelがソース側で折り返したセル（報告された不具合）');
  clearAllFields();
  firePaste(titleIn, EXCEL_WRAPPED, '［宮脇賣扇庵］扇子ケース プレゼント' + TAB + '10' + NL);
  check('タイトル入力欄に改行が入らない', titleIn.value, '［宮脇賣扇庵］扇子ケース プレゼント');
  check('先着人数', firstCome.value, '10');

  say('');
  say('■ セル内の <br>（Alt+Enter）は改行として残る');
  clearAllFields();
  firePaste(titleIn, EXCEL_REAL_BR, '"1階 化粧品売場' + NL + '2階 婦人服売場"' + TAB + '30' + NL);
  check('<br> が改行として保持される', titleIn.value, '1階 化粧品売場' + NL + '2階 婦人服売場');
  check('先着人数', firstCome.value, '30');

  say('');
  say('■ 単一セルは分割せず既定のペーストにまかせる');
  clearAllFields();
  const before = titleIn.value;
  firePaste(titleIn, '<table><tr><td>ひとつだけ</td></tr></table>', 'ひとつだけ');
  check('ハンドラが介入しない（値は変わらない）', titleIn.value, before);

  say('');
  say('■ タブを含まない複数行テキストはバラまかない');
  clearAllFields();
  firePaste(titleIn, '', '1行目' + NL + '2行目' + NL + '3行目');
  check('タイトル欄は空のまま（既定動作にまかせる）', titleIn.value, '');
  check('先着人数も空のまま', firstCome.value, '');

  say('');
  say('■ number欄の安全装置（数字でないセルは入れずに空のまま）');
  clearAllFields();
  firePaste(titleIn,
    '<table><tr><td>タイトルです</td><td>1階 化粧品</td></tr></table>',
    'タイトルです' + TAB + '1階 化粧品');
  check('タイトルは入る', titleIn.value, 'タイトルです');
  check('先着人数は空（"1"を拾わない）', firstCome.value, '');

  say('');
  say('■ 先着人数は文字混じりでも数字を抜き出す（v1.5.0）');
  [
    ['先着１００名様',  '100', false],   // 実機で報告されたセル。全角数字＋「先着」
    ['３０名様',        '30',  false],
    ['30人',            '30',  false],
    ['1,000名様',       '1000', false],
    ['各20名',          '20',  false],
    ['限定30名',        '30',  false],
    ['計30名様',        '30',  false],
    ['先着30名様限定',  '30',  false],
    ['各日先着１００名様', '100', true],  // 「各日」は欄に残さず data 属性へ
    ['各日30名様',      '30',  true],
  ].forEach(([cell, want, eachDay]) => {
    clearAllFields();
    delete firstCome.dataset.eachDay;
    firePaste(titleIn,
      `<table><tr><td>タイトルです</td><td>${cell}</td></tr></table>`,
      'タイトルです' + TAB + cell);
    check(`${cell} → ${want}`, firstCome.value, want);
    check(`  各日フラグ ${eachDay ? 'ON' : 'OFF'}`, firstCome.dataset.eachDay === '1', eachDay);
  });

  say('');
  say('■ 先着人数に未知の語が残るセルは入れずに空のまま（列ずれ検出）');
  [
    '1階 化粧品',                                  // 数字だけ拾うと「先着1名」になる
    '［夕張あきんど屋］じゃがバタートッピング 増量プレゼント',  // 起点を1つ間違えた場合
    '先着20名様30%OFF',                            // 連結して 2030 になるのを防ぐ
  ].forEach(cell => {
    clearAllFields();
    firePaste(titleIn,
      `<table><tr><td>タイトルです</td><td>${cell}</td></tr></table>`,
      'タイトルです' + TAB + cell);
    check(`${cell} → 空`, firstCome.value, '');
  });

  say('');
  say('■ 単一セルでも number欄は肩代わりする（v1.5.0）');
  clearAllFields();
  delete firstCome.dataset.eachDay;
  firePaste(firstCome, '<table><tr><td>各日先着１００名様</td></tr></table>', '各日先着１００名様');
  check('先着人数', firstCome.value, '100');
  check('各日フラグ ON', firstCome.dataset.eachDay === '1', true);

  say('');
  say('■ 各日フラグは次のペーストで消える（居残らない）');
  firePaste(firstCome, '<table><tr><td>先着50名様</td></tr></table>', '先着50名様');
  check('先着人数', firstCome.value, '50');
  check('各日フラグ OFF', firstCome.dataset.eachDay === '1', false);

  say('');
  say('■ タイトルへの反映（※各日先着xx名様）');
  clearAllFields();
  delete firstCome.dataset.eachDay;
  firePaste(titleIn,
    '<table><tr><td>テストタイトル</td><td>各日先着１００名様</td></tr></table>',
    'テストタイトル' + TAB + '各日先着１００名様');
  $('.set[data-set="title"] .btn-convert').click();
  check('出力タイトル', $('.set[data-set="title"] .output-title').value, 'テストタイトル※各日先着100名様');
  check('全体で利用可能な回数', $('#overallTotal').value, '100');

  clearAllFields();
  delete firstCome.dataset.eachDay;
  firePaste(titleIn,
    '<table><tr><td>テストタイトル</td><td>先着１００名様</td></tr></table>',
    'テストタイトル' + TAB + '先着１００名様');
  $('.set[data-set="title"] .btn-convert').click();
  check('各日なしは従来どおり', $('.set[data-set="title"] .output-title').value, 'テストタイトル※先着100名様');

  say('');
  say('■ 各日フラグのクリアは isTrusted で切り分ける');
  // 手入力（isTrusted:true）で落とす仕掛けだが、合成イベントでは isTrusted を
  // 立てられないので、ここで確かめられるのは「ペースト側の合成イベントで
  // 自分が立てたフラグを自分で消さない」側だけ。手入力側は実機で確認する。
  firstCome.dataset.eachDay = '1';
  firstCome.value = '20';
  firstCome.dispatchEvent(new Event('input', { bubbles:true }));
  check('合成イベントでは落ちない', firstCome.dataset.eachDay === '1', true);

  say('');
  say('■ 起点をずらしても順に流し込む');
  clearAllFields();
  firePaste(floorIn,
    '<table><tr><td>3階 婦人服</td><td>テストブランド</td></tr></table>',
    '3階 婦人服' + TAB + 'テストブランド');
  check('フロア・売場', floorIn.value, '3階 婦人服');
  check('ブランド名', $('.set[data-set="floor-brand"] .input-brand').value, 'テストブランド');

  clearAllFields();

  say('');
  say(fail === 0 ? '>>> 全パス' : `>>> 失敗 ${fail} 件`);

  const pre = document.getElementById('testout');
  if (pre) pre.textContent = out.join(NL);
})();
