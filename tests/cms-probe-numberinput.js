/* Mantine NumberInput（並べ替え優先度）が入らない原因の切り分け
 *
 * 使い方:
 *   1. CMSのクーポン新規作成画面を開く（並べ替え優先度は 0 のままでOK）
 *   2. F12 → Console タブ
 *   3. このファイルの中身を全部コピーして貼り付け → Enter
 *   4. 出力を丸ごと渡す（クリップボードにも自動コピーされる）
 *
 * 検証済みの前提:
 *   素の Mantine 7 NumberInput に対しては、cms_inject.js の setNativeValue() は
 *   ちゃんと通ることをローカル再現で確認済み（tests/_ni-harness.html）。
 *   したがって疑うべきは「ラベル誤爆で別の input を掴んでいる」「後から上書きされる」側。
 *
 * 実行後は値を 0 に戻すが、保存はしないこと。
 */
(async () => {
  const TEST_VALUE = "98";
  const LABEL      = "並べ替え優先度";

  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const normText = (s) => (s || "").replace(/\s+/g, " ").trim();
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [];
  const say = (s) => out.push(s);
  const finish = () => {
    say("===== レポート ここまで =====");
    const report = out.join("\n");
    console.log(report);
    try { copy(report); console.log("%c↑ クリップボードにコピー済み", "color:#0a0"); }
    catch (e) { console.log("%c↑ 上のテキストを選択してコピーしてください", "color:#a60"); }
  };

  say("===== レポート ここから =====");
  say(`URL: ${location.href}`);

  // ---- 1. ページ上の NumberInput を全部並べる（誤爆検出） ----
  const wrappers = $$(".mantine-NumberInput-root");
  say("");
  say(`---- ページ上の mantine-NumberInput-root: ${wrappers.length}件 ----`);
  wrappers.forEach((w, i) => {
    const l = w.querySelector("label");
    const inp = w.querySelector("input");
    say(`  [${i}] label="${l ? normText(l.textContent) : "(無し)"}" id=${inp ? inp.id : "?"} value="${inp ? inp.value : "?"}"`);
  });

  // ---- 2. 「優先度」を含む label を全部（誤爆検出） ----
  const allLabels = $$("label");
  const cands = allLabels.filter((l) => /並べ替え|並び替え|優先度/.test(normText(l.textContent)));
  say("");
  say(`---- label総数 ${allLabels.length} 件中、「並べ替え/並び替え/優先度」を含むもの: ${cands.length}件 ----`);
  cands.forEach((l) =>
    say(`  docIndex=${allLabels.indexOf(l)}  "${normText(l.textContent)}"  for=${l.getAttribute("for")}`)
  );

  // ---- 3. cms_inject.js と同じ探索を再現 ----
  const lb = allLabels.find((l) => normText(l.textContent).includes(LABEL)) || null;
  say("");
  say("---- cms_inject.js の findInputByLabelText() の結果 ----");
  if (!lb) { say(`  [致命] includes("${LABEL}") でラベルが1件も見つからない`); finish(); return; }

  const scope = lb.closest(".mantine-InputWrapper-root") || lb.parentElement;
  const el = scope ? scope.querySelector("input, textarea") : null;
  say(`  ヒットしたラベル: docIndex=${allLabels.indexOf(lb)} "${normText(lb.textContent)}"`);
  say(`  scope class: ${scope ? scope.className : "null"}`);
  say(`  掴んだ input: ${el ? `id=${el.id} type=${el.type} class="${el.className}" value="${el.value}"` : "null"}`);
  if (!el) { say("  [致命] scope 内に input が無い"); finish(); return; }
  say(`  → これが本当に「並べ替え優先度」の欄か、画面と id を見比べてください`);

  // ---- 4. React の内部値 ----
  const reactProps = (n) => {
    const k = Object.keys(n).find((x) => x.startsWith("__reactProps$"));
    return k ? n[k] : null;
  };
  const reactValue = (n) => {
    const p = reactProps(n);
    return p ? JSON.stringify(p.value) : "(取得不可)";
  };
  const upBtn   = scope.querySelector('button[data-direction="up"]');
  const downBtn = scope.querySelector('button[data-direction="down"]');
  const snap = () =>
    `el.value="${el.value}" React=${reactValue(el)} up.disabled=${upBtn ? upBtn.disabled : "?"} down.disabled=${downBtn ? downBtn.disabled : "?"}`;

  const ORIGINAL = el.value;
  say("");
  say("---- 初期状態 ----");
  say(`  ${snap()}`);
  say(`  onChange: ${reactProps(el) && typeof reactProps(el).onChange === "function" ? "あり" : "なし"}`);
  say(`  readOnly=${el.readOnly} disabled=${el.disabled}`);

  // ---- 5. cms_inject.js と完全に同じ手順で注入 ----
  function nativeSet(node, v) {
    const proto = node instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(node, v); else node.value = v;
  }
  function setNativeValue(node, v) {
    nativeSet(node, v);
    node.dispatchEvent(new Event("input",  { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
  }

  say("");
  say(`---- 現行ロジックで "${TEST_VALUE}" を注入 ----`);
  setNativeValue(el, TEST_VALUE);
  say(`  直後   : ${snap()}`);
  await wait(300);
  say(`  0.3秒後: ${snap()}`);
  await wait(1200);
  say(`  1.5秒後: ${snap()}`);
  await wait(2000);
  say(`  3.5秒後: ${snap()}   ← ここで 0 に戻っていたらCMS側が上書きしている`);

  // ---- 6. ダメだった場合の代替手段を試す ----
  if (el.value !== TEST_VALUE) {
    say("");
    say("---- 代替手段A: focus → 全選択 → execCommand('insertText') ----");
    el.focus();
    try { el.setSelectionRange(0, el.value.length); } catch (e) {}
    document.execCommand("insertText", false, TEST_VALUE);
    await wait(400);
    say(`  ${snap()}`);

    if (el.value !== TEST_VALUE && upBtn) {
      say("");
      say("---- 代替手段B: upボタン連打 ----");
      for (let i = 0; i < Number(TEST_VALUE) && !upBtn.disabled; i++) { upBtn.click(); await wait(10); }
      await wait(300);
      say(`  ${snap()}`);
    }
  }

  // ---- 7. 後始末 ----
  say("");
  say("---- 0 に戻す ----");
  setNativeValue(el, "0");
  el.blur();
  await wait(400);
  say(`  ${snap()}  (元の値は "${ORIGINAL}")`);
  say("※ 画面上も 0 に戻っているか目視で確認してください。戻っていなければ手で直してください。");

  finish();
})();
