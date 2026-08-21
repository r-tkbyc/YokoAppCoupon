/* CMS側DOMの診断スクリプト
 *
 * 使い方:
 *   1. CMSのクーポン新規作成画面を開く（入力は空のままでOK）
 *   2. F12 → Console タブ
 *   3. このファイルの中身を全部コピーして貼り付け → Enter
 *   4. 出力された「===== レポート ここから =====」以降を全部コピーして渡す
 *
 * cms_inject.js が実際に使っている探索ロジックをそのまま再現して、
 * どのフィールドがどこで外れているかを報告する。ページは一切変更しない。
 */
(() => {
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const normText = (s) => (s || "").replace(/\s+/g, " ").trim();
  const out = [];
  const say = (s) => out.push(s);

  // --- cms_inject.js と同一の探索ロジック ---
  const findLabelStrict = (t) => {
    const x = normText(t);
    return $$("label").find((l) => normText(l.textContent).startsWith(x)) || null;
  };
  const findLabelIncludes = (t) => {
    const x = normText(t);
    return $$("label").find((l) => normText(l.textContent).includes(x)) || null;
  };
  const scopeOf = (lb) =>
    lb ? lb.closest(".mantine-InputWrapper-root") || lb.parentElement : null;

  const describe = (el) => {
    if (!el) return "null";
    const bits = [el.tagName.toLowerCase()];
    if (el.type) bits.push(`type=${el.type}`);
    if (el.name) bits.push(`name=${el.name}`);
    if (el.id) bits.push(`id=${el.id}`);
    if (el.getAttribute("role")) bits.push(`role=${el.getAttribute("role")}`);
    if (el.placeholder) bits.push(`ph="${el.placeholder}"`);
    const v = (el.value ?? "").toString();
    if (v) bits.push(`value="${v.slice(0, 30)}"`);
    return bits.join(" ");
  };

  // --- 対象フィールド一覧（cms_inject.js の Main と同じ順・同じ探索方法） ---
  const FIELDS = [
    ["タイトル",                     "input",   "includes"],
    ["管理名称",                     "input",   "includes"],
    ["表示グループ",                 "select",  "includes"],
    ["カテゴリ",                     "select",  "includes"],
    ["配布方法",                     "select",  "strict"  ],
    ["公開期間",                     "range",   "strict"  ],
    ["利用可能期間",                 "range",   "strict"  ],
    ["ブランド入居フロア",           "input",   "strict"  ],
    ["ブランド名",                   "input",   "strict"  ],
    ["ご利用条件",                   "rich",    "includes"],
    ["注意事項",                     "rich",    "includes"],
    ["並べ替え優先度",               "number",  "includes"],
    ["会員ひとりが利用可能な回数",   "number",  "includes"],
    ["全体の利用回数制限",           "switch",  "startsWith"],
    ["全体で利用可能な回数",         "number",  "includes"],
  ];

  say("===== レポート ここから =====");
  say(`URL: ${location.href}`);
  say(`label要素の総数: ${$$("label").length}`);
  say(`.mantine-InputWrapper-root の数: ${$$(".mantine-InputWrapper-root").length}`);
  say("");
  say("---- フィールド別 ----");

  for (const [label, kind, how] of FIELDS) {
    const lb = how === "strict" || how === "startsWith"
      ? findLabelStrict(label)
      : findLabelIncludes(label);

    if (!lb) {
      const loose = $$("label").filter((l) =>
        normText(l.textContent).includes(label.slice(0, 3))
      );
      say(`[NG] ${label} (${kind}) : ラベルが見つからない`);
      if (loose.length) {
        say(`      近そうなラベル: ${loose.map((l) => `"${normText(l.textContent)}"`).join(" / ")}`);
      }
      continue;
    }

    const hit = normText(lb.textContent);
    const exact = hit === label;
    const scope = scopeOf(lb);
    const scopeCls = scope ? (scope.className || "(class無し)") : "null";

    let target = null;
    let extra = "";

    if (kind === "rich") {
      target =
        scope?.querySelector(".tiptap.ProseMirror, .ProseMirror") ||
        lb.closest(".mantine-Stack-root")?.querySelector(".tiptap.ProseMirror, .ProseMirror") ||
        null;
      extra = target ? `ProseMirror OK (class="${target.className}")` : "ProseMirror が見つからない";
    } else if (kind === "switch") {
      const stack = lb.closest(".mantine-Stack-root") || lb.parentElement;
      target = stack?.querySelector("input[type='checkbox'][role='switch']") || null;
      extra = target ? `switch OK checked=${target.checked}` : "role=switch のcheckboxが見つからない";
    } else if (kind === "range") {
      const stack = lb.closest(".mantine-Stack-root") || lb.parentElement;
      const startBtn =
        stack?.querySelector('button.mantine-DateTimePicker-input[aria-haspopup="dialog"]') ||
        stack?.querySelector('button[data-dates-input="true"][aria-haspopup="dialog"]') ||
        stack?.querySelector('button[aria-haspopup="dialog"]') || null;
      const endBtn =
        stack?.querySelector('button[name="end"][aria-haspopup="dialog"]') ||
        stack?.querySelector('button[id$="-target"][name="end"]') || null;
      target = startBtn;
      const btns = $$('button[aria-haspopup="dialog"]', stack || document);
      extra =
        `開始btn=${startBtn ? describe(startBtn) : "null"} / ` +
        `終了btn=${endBtn ? describe(endBtn) : "null"} / ` +
        `stack内のdialogボタン数=${btns.length}` +
        (btns.length
          ? ` [${btns.map((b) => `${b.name || "(name無し)"}:"${normText(b.textContent)}":${b.className}`).join(" | ")}]`
          : "");
    } else {
      target = scope?.querySelector("input, textarea") || null;
      extra = describe(target);
      if (kind === "select" && target) {
        extra += ` / aria-haspopup=${target.getAttribute("aria-haspopup")} readonly=${target.readOnly}`;
      }
    }

    const mark = target ? "[OK]" : "[NG]";
    say(`${mark} ${label} (${kind})`);
    say(`      ラベル実文言: "${hit}"${exact ? "" : "  ← 完全一致していない"}`);
    say(`      scope: ${scopeCls}`);
    say(`      ${extra}`);
  }

  // --- 参考情報 ---
  say("");
  say("---- ページ上のラベル全部 ----");
  say($$("label").map((l) => `"${normText(l.textContent)}"`).join(", "));

  say("");
  say("---- mantine-* クラス名の種類（先頭2階層） ----");
  const pref = new Set();
  $$("[class*='mantine-']").forEach((el) => {
    String(el.className).split(/\s+/).forEach((c) => {
      if (c.startsWith("mantine-")) pref.add(c);
    });
  });
  say([...pref].sort().join(", ") || "(mantine-* クラスが1つも無い ← Mantineのバージョンアップ/CSS Modules化の可能性)");

  say("");
  say("---- 日時ピッカーらしきボタン（ページ全体） ----");
  $$('button[aria-haspopup="dialog"], button[data-dates-input]').forEach((b) => {
    say(`  ${describe(b)} class="${b.className}" text="${normText(b.textContent)}"`);
  });

  say("===== レポート ここまで =====");

  const report = out.join("\n");
  console.log(report);
  try {
    copy(report);
    console.log("%c↑ クリップボードにコピー済みです", "color:#0a0");
  } catch (e) {
    console.log("%c↑ 上のテキストを選択してコピーしてください", "color:#a60");
  }
})();
