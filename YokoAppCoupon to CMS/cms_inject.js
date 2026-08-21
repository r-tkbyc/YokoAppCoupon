(() => {
  const MSG_TYPE = "YK_COUPON_TO_CMS";

  // ★ 二重登録の防止
  //
  // background.js は content script が載っていないと判断すると executeScript で
  // このファイルを注入してくる（"Receiving end does not exist" の救済パス）。
  // 既に生きているところへ再注入されると listener が積み上がり、toCMS 1回で
  // 2回走って日時ピッカーの同じポップオーバーを奪い合う（実機で発生）。
  //
  // 単純な「読み込み済みフラグ」ではダメ。拡張だけ再読み込みするとフラグは
  // ページに残ったまま古いインスタンスだけが無効化されるので、新しい方が
  // 登録をスキップして救済パスごと死ぬ。
  // 「前のインスタンスを解除してから自分を登録する」なら両方の状況で正しい。
  try {
    window.__YK_CMS_INJECT_DISPOSE__?.();
  } catch (e) {
    // 無効化済みの旧インスタンス（Extension context invalidated）。無視してよい
  }

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function showToast(msg, ms){
    let toast = document.getElementById("__yk_toast__");
    if (!toast){
      toast = document.createElement("div");
      toast.id = "__yk_toast__";
      toast.style.position = "fixed";
      toast.style.right = "16px";
      toast.style.bottom = "16px";
      toast.style.zIndex = "2147483647";
      toast.style.background = "rgba(0,0,0,.85)";
      toast.style.color = "#fff";
      toast.style.padding = "10px 12px";
      toast.style.borderRadius = "10px";
      toast.style.fontSize = "13px";
      toast.style.maxWidth = "420px";
      toast.style.lineHeight = "1.5";
      toast.style.whiteSpace = "pre-wrap";
      toast.style.opacity = "0";
      toast.style.transition = "opacity .2s ease";
      document.documentElement.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = "1";
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toast.style.opacity = "0";
    }, ms || 1200);
  }

  function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

  async function waitFor(fn, timeoutMs = 2500, intervalMs = 50){
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs){
      const v = fn();
      if (v) return v;
      await wait(intervalMs);
    }
    return null;
  }

  function normText(s){
    return (s || "").replace(/\s+/g, " ").trim();
  }

  function setNativeValue(el, value){
    if (!el) return false;
    const v = (value ?? "").toString();

    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;

    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set){
      desc.set.call(el, v);
    } else {
      el.value = v;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  // =============================
  // 反映結果の記録
  //
  // 「入らなかった」を “欄が無い / 既存値がある / 入れたが戻された” まで
  // 切り分けて残す。真偽値ひとつに潰すと原因が追えなくなるため。
  // =============================
  let report = [];   // [{ field, status, detail }]
  let writes = [];   // [{ field, isOk(), retry() }] 書き込み後の検証用

  const R = {
    done:    (detail) => ({ ok: true,  status: "入力",               detail: detail || "" }),
    noValue: ()       => ({ ok: false, status: "skip:値なし",         detail: "" }),
    filled:  (cur)    => ({ ok: false, status: "skip:既存値あり",     detail: `現在値="${cur}"` }),
    noField: ()       => ({ ok: false, status: "NG:欄が見つからない", detail: "" }),
    fail:    (why)    => ({ ok: false, status: "NG:" + why,           detail: "" }),
  };

  function elDesc(el){
    if (!el) return "null";
    return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}`;
  }

  // 書き込んだ直後は成功に見えても、CMS側の初期化や再レンダリングで
  // 後から消されることがある。あとでまとめて確認するために積んでおく。
  //
  // ★ describe は必須。「戻された」とだけ報告しても原因が追えず、
  //   実際に “検証側の誤判定” と “本当に消された” の区別が付かなかった。
  function watch(field, isOk, retry, describe){
    writes.push({ field, isOk, retry, describe });
  }

  // <input type="text"> は HTML の value sanitization で CR/LF を落とす。
  // 期待値もそれに合わせないと、改行を含む値で必ず「戻された」と誤判定する
  // （タイトル・管理名称はツール側の textarea 由来なので改行が入りうる）。
  function expectedIn(el, value){
    const v = (value ?? "").toString();
    return (el && el.tagName === "TEXTAREA") ? v : v.replace(/[\r\n]+/g, "");
  }

  function watchValue(field, el, want){
    const expect = expectedIn(el, want);
    watch(field,
      () => (el.value ?? "").toString() === expect,
      () => setNativeValue(el, want),
      () => `期待="${expect}" 実際="${(el.value ?? "").toString()}"`);
  }

  async function verifyWrites(){
    if (!writes.length) return [];
    await wait(700);
    const reverted = [];
    for (const w of writes){
      let ok = false;
      try { ok = !!w.isOk(); } catch (e) { ok = false; }
      if (ok) continue;

      try { w.retry(); } catch (e) { /* 入れ直しは best effort */ }
      await wait(350);

      try { ok = !!w.isOk(); } catch (e) { ok = false; }
      if (ok) continue;

      let detail = "";
      try { detail = w.describe ? w.describe() : ""; } catch (e) { detail = "(検証値を取得できず)"; }
      reverted.push({ field: w.field, detail });
    }
    return reverted;
  }

  // =============================
  // label起点の探索
  // =============================
  function findLabelElementStrict(labelText){
    const target = normText(labelText);
    if (!target) return null;
    const labels = $$("label");
    return labels.find(l => normText(l.textContent).startsWith(target)) || null;
  }

  function findLabelElementIncludes(labelText){
    const target = normText(labelText);
    if (!target) return null;
    const labels = $$("label");
    return labels.find(l => normText(l.textContent).includes(target)) || null;
  }

  function findInputByLabelText(labelText){
    const lb = findLabelElementIncludes(labelText);
    if (!lb) return null;
    const scope = lb.closest(".mantine-InputWrapper-root") || lb.parentElement;
    if (!scope) return null;
    return scope.querySelector("input, textarea") || null;
  }

  function findInputByLabelTextStrict(labelText){
    const lb = findLabelElementStrict(labelText);
    if (!lb) return null;
    const scope = lb.closest(".mantine-InputWrapper-root") || lb.parentElement;
    if (!scope) return null;
    return scope.querySelector("input, textarea") || null;
  }

  // =============================
  // TextInput（空欄のみ埋める）
  // =============================
  function setTextByLabel(field, labelText, value, strict){
    const v = (value ?? "").toString();
    if (!v.trim()) return R.noValue();

    const input = strict
      ? (findInputByLabelTextStrict(labelText) || findInputByLabelText(labelText))
      : findInputByLabelText(labelText);
    if (!input) return R.noField();

    const cur = (input.value ?? "").toString();
    if (cur.trim()) return R.filled(cur);

    setNativeValue(input, v);
    watchValue(field, input, v);
    return R.done(elDesc(input));
  }

  // =============================
  // Mantine Select
  // =============================
  async function setMantineSelectByLabel(field, labelText, valueText){
    const input = findInputByLabelText(labelText);
    if (!input) return R.noField();

    const want = normText(valueText);
    if (!want) return R.noValue();

    if (normText(input.value) === want) return R.filled(input.value);

    input.click();
    await wait(80);

    // Portal想定で body から拾う
    const options = $$('[role="option"]', document.body);
    const opt =
      options.find(o => normText(o.textContent) === want) ||
      options.find(o => normText(o.textContent).includes(want)) ||
      null;

    if (!opt) return R.fail(`選択肢「${want}」が無い`);
    opt.click();
    await wait(60);

    // 選択肢の再クリックは副作用が読めないので retry はしない（意図的）
    watch(field,
      () => normText(input.value) === want,
      () => {},
      () => `期待="${want}" 実際="${normText(input.value)}"`);
    return R.done(`${elDesc(input)} → ${want}`);
  }

  async function setMantineSelectByLabelStrict(field, labelText, valueText){
    const input = findInputByLabelTextStrict(labelText);
    if (!input) return R.noField();

    const want = normText(valueText);
    if (!want) return R.noValue();

    if (normText(input.value) === want) return R.filled(input.value);

    input.click();
    await wait(80);

    const options = $$('[role="option"]', document.body);
    const opt = options.find(o => normText(o.textContent) === want) || null;
    if (!opt) return R.fail(`選択肢「${want}」が無い`);

    opt.click();
    await wait(60);

    watch(field,
      () => normText(input.value) === want,
      () => {},
      () => `期待="${want}" 実際="${normText(input.value)}"`);
    return R.done(`${elDesc(input)} → ${want}`);
  }

  // =============================
  // RichText（ProseMirror / tiptap）
  // =============================
  function findRichEditorByLabel(labelText){
    const lb = findLabelElementIncludes(labelText);
    if (!lb) return null;

    const scope = lb.closest(".mantine-InputWrapper-root") || lb.parentElement || document;
    const prose = scope.querySelector(".tiptap.ProseMirror, .ProseMirror");
    if (prose) return prose;

    const stack = lb.closest(".mantine-Stack-root");
    return stack?.querySelector(".tiptap.ProseMirror, .ProseMirror") || null;
  }

  function richEditorIsEmpty(prose){
    if (!prose) return true;
    const t = (prose.textContent || "").replace(/\u200B/g, "").trim();
    return !t;
  }

  function setRichText(prose, text){
    if (!prose) return false;
    const raw = (text ?? "").toString();
    const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const safe = lines.map(l =>
      (l ?? "").toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
    );
    const html = safe.map(l => (l.trim() ? `<p>${l}</p>` : `<p><br></p>`)).join("");
    prose.focus();
    prose.innerHTML = html;
    prose.dispatchEvent(new Event("input", { bubbles: true }));
    prose.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function setRichTextByLabel(field, labelText, text){
    const v = (text ?? "").toString();
    if (!v.trim()) return R.noValue();

    const prose = findRichEditorByLabel(labelText);
    if (!prose) return R.noField();
    if (!richEditorIsEmpty(prose)) return R.filled(normText(prose.textContent).slice(0, 20) + "…");

    if (!setRichText(prose, v)) return R.fail("書き込めなかった");

    watch(field,
      () => !richEditorIsEmpty(prose),
      () => setRichText(prose, v),
      () => `期待=空でないこと 実際="${normText(prose.textContent).slice(0, 40)}"`);
    return R.done();
  }

  // =============================
  // NumberInput（type=text）
  // =============================
  function setNumberInputByLabel(field, labelText, valueText, allowOverwriteIfCurrentIn = []){
    const want = (valueText ?? "").toString();
    if (!want.trim()) return R.noValue();

    const input = findInputByLabelText(labelText);
    if (!input) return R.noField();

    const cur = (input.value ?? "").toString();

    if (allowOverwriteIfCurrentIn.length > 0){
      if (!allowOverwriteIfCurrentIn.includes(cur)) return R.filled(cur);
    } else {
      if (cur && cur.trim()) return R.filled(cur);
    }

    setNativeValue(input, want);
    watchValue(field, input, want);
    return R.done(`${elDesc(input)} "${cur || "(空)"}" → "${want}"`);
  }

  // =============================
  // Switch（role="switch"）
  // =============================
  function setSwitchByLabel(field, labelText, enabled){
    const labels = $$("label");
    const lb = labels.find(l => (l.textContent || "").trim().startsWith(labelText));
    if (!lb) return R.noField();

    const stack = lb.closest(".mantine-Stack-root") || lb.parentElement;
    if (!stack) return R.noField();

    const sw = stack.querySelector("input[type='checkbox'][role='switch']");
    if (!sw) return R.noField();

    const want = !!enabled;
    const cur = !!sw.checked;
    if (cur === want) return R.filled(cur ? "ON" : "OFF");

    sw.click();
    watch(field,
      () => !!sw.checked === want,
      () => { if (!!sw.checked !== want) sw.click(); },
      () => `期待=${want ? "ON" : "OFF"} 実際=${sw.checked ? "ON" : "OFF"}`);
    return R.done(want ? "OFF → ON" : "ON → OFF");
  }

  // =============================
  // 日時（公開期間 / 利用可能期間）: Popover操作で確定まで行う
  // =============================
  function parseYmdHm(text){
    const s = (text ?? "").toString().trim();
    if (!s) return null;

    // YYYY/MM/DD HH:mm
    const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
    if (!m) return null;

    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const hh = Number(m[4]);
    const mm = Number(m[5]);
    if (![y, mo, d, hh, mm].every(Number.isFinite)) return null;

    return { y, mo, d, hh, mm, hhmm: `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}` };
  }

  function anyPopoverOpen(){
    return !!document.querySelector('.mantine-Popover-dropdown[role="dialog"]');
  }

  function closeAllPopovers(){
    // 閉じるものが無いなら何もしない。
    // CMSへ合成イベントを送るのは相手のハンドラを踏む行為なので、必要な時だけにする。
    if (!anyPopoverOpen()) return;

    // ESCで閉じられることが多い。
    // ★ document から dispatch しないこと。event.target が document になり、
    //    CMS が document に直付けしている keydown ハンドラ内の
    //    `t?.hasAttribute(...)` が "hasAttribute is not a function" で落ちる
    //    （`?.` は null/undefined しか防げず、関数でない場合は素通りする）。
    //    Element から投げれば bubbles で document まで届くので効果は同じ。
    const from =
      (document.activeElement instanceof Element ? document.activeElement : null) ||
      document.body ||
      document.documentElement;
    from?.dispatchEvent?.(new KeyboardEvent("keydown", {
      key: "Escape", code: "Escape", keyCode: 27, which: 27,
      bubbles: true, cancelable: true
    }));
    // クリックアウトも効くことが多い
    document.body?.click?.();
  }

  function getDropdownIdFromTarget(target){
    if (!target) return null;
    // buttonに aria-controls="mantine-xxxx-dropdown" が付くケースが多い
    const ac = target.getAttribute("aria-controls");
    if (ac) return ac;

    // たまに target id から推測できる
    const id = target.id || "";
    if (id.endsWith("-target")) return id.replace(/-target$/, "-dropdown");
    return null;
  }

  function headerTextFromDropdown(dd){
    const h =
      dd.querySelector(".mantine-DateTimePicker-calendarHeaderLevel") ||
      dd.querySelector(".mantine-DatePicker-calendarHeaderLevel");
    return normText(h?.textContent || "");
  }

  function parseHeaderYm(text){
    // "1月 2026"
    const m = (text || "").match(/^(\d{1,2})月\s+(\d{4})$/);
    if (!m) return null;
    return { mo: Number(m[1]), y: Number(m[2]) };
  }

  function clickMonthNav(dd, dir /* 'next'|'previous' */, times){
    const btnSelDT = `.mantine-DateTimePicker-calendarHeaderControl[data-direction="${dir}"]`;
    const btnSelD  = `.mantine-DatePicker-calendarHeaderControl[data-direction="${dir}"]`;
    const btn = dd.querySelector(btnSelDT) || dd.querySelector(btnSelD);
    if (!btn) return false;

    for (let i=0; i<times; i++){
      btn.click();
    }
    return true;
  }

  async function moveToMonth(dd, wantY, wantMo){
    // 最大24ステップで合わせる
    for (let i=0; i<24; i++){
      const curText = headerTextFromDropdown(dd);
      const cur = parseHeaderYm(curText);
      if (!cur) break;

      if (cur.y === wantY && cur.mo === wantMo) return true;

      const curIndex = cur.y * 12 + (cur.mo - 1);
      const wantIndex = wantY * 12 + (wantMo - 1);
      const diff = wantIndex - curIndex;

      if (diff === 0) return true;

      const dir = diff > 0 ? "next" : "previous";
      // 1クリックずつが安定
      clickMonthNav(dd, dir, 1);
      await wait(60);
    }
    return false;
  }

  function findDayButton(dd, y, mo, d){
    // aria-label="30 1月 2026"
    const want1 = `${d} ${mo}月 ${y}`;
    const btn =
      dd.querySelector(`button[aria-label="${want1}"]`) ||
      null;
    if (btn) return btn;

    // 厳密に一致しない環境向けにfallback
    const all = $$("button[aria-label]", dd);
    return all.find(b => {
      const al = (b.getAttribute("aria-label") || "").trim();
      return al.includes(`${d} `) && al.includes(`${mo}月`) && al.includes(`${y}`);
    }) || null;
  }

  function findSubmitButton(dd){
    // DateTimePicker の submit
    const dt = dd.querySelector("button.mantine-DateTimePicker-submitButton");
    if (dt) return dt;

    // チェックアイコンのActionIcon（path d を見て判定）
    const buttons = $$("button", dd);
    for (const b of buttons){
      const path = b.querySelector("svg path");
      const d = path?.getAttribute("d") || "";
      if (d.includes("M4 4.586") && d.includes("L1.707 2.293")) return b;
    }
    // 最後の手段：一番最後のボタン
    return buttons[buttons.length - 1] || null;
  }

  async function ensureAllDayOffIfNeed(dd){
    // 終了側に "終日" switch がある場合、timeを入れたいならOFFにしてtime inputを出す
    const sw = dd.querySelector('input[type="checkbox"][role="switch"]');
    const timeInput = dd.querySelector('input[type="time"]');
    if (!sw) return true;

    // timeを扱うUIがあるならOFFに寄せる（checkedだとtimeが出ない/効かないケースがある）
    if (sw.checked){
      sw.click();
      await wait(80);
    }
    // time input がなければこの段階で出現待ち
    if (!timeInput){
      await waitFor(() => dd.querySelector('input[type="time"]'), 1200, 60);
    }
    return true;
  }

  async function setDateTimeByTarget(targetBtn, text){
    const dt = parseYmdHm(text);
    if (!targetBtn) return "欄が見つからない";
    if (!dt) return `日時の書式が想定外："${text}"`;

    closeAllPopovers();
    await wait(60);

    const ddId = getDropdownIdFromTarget(targetBtn);

    targetBtn.scrollIntoView?.({ block: "center" });
    targetBtn.click();

    // dropdown取得
    const dd = ddId
      ? await waitFor(() => document.getElementById(ddId), 3000, 60)
      : await waitFor(() => document.querySelector('.mantine-Popover-dropdown[role="dialog"]'), 3000, 60);

    if (!dd) return "カレンダーが開かなかった";

    // 月移動
    await moveToMonth(dd, dt.y, dt.mo);

    // 日付クリック
    const dayBtn = findDayButton(dd, dt.y, dt.mo, dt.d);
    if (!dayBtn) return `${dt.y}/${dt.mo}/${dt.d} のボタンが見つからない`;
    dayBtn.click();
    await wait(80);

    // time（あれば入れる）
    const timeInputBefore = dd.querySelector('input[type="time"]');
    if (timeInputBefore || dd.querySelector('input[type="checkbox"][role="switch"]')){
      await ensureAllDayOffIfNeed(dd);
      const timeInput = dd.querySelector('input[type="time"]');
      if (timeInput){
        setNativeValue(timeInput, dt.hhmm);
        await wait(80);
      }
    }

    // ✅確定
    const submit = findSubmitButton(dd);
    if (!submit) return "確定ボタンが見つからない";
    submit.click();

    // 閉じるまで待つ（重なり防止）
    if (ddId){
      await waitFor(() => !document.getElementById(ddId), 2500, 60);
    } else {
      // idが取れなかった場合：今開いてるdropdownが消えるまで
      await wait(120);
      await waitFor(() => !document.querySelector('.mantine-Popover-dropdown[role="dialog"]'), 2500, 60);
    }

    return null; // = 成功
  }

  function isPlaceholderBtn(btn){
    if (!btn) return true;
    const t = (btn.textContent || "").trim();
    // ここは環境で文言が揺れるので「空ならプレースホルダ扱い」
    return !t || t === "開始日時" || t === "終了日時";
  }

  async function setMantineDateRangeByLabel(field, labelText, startText, endText){
    const lb = findLabelElementStrict(labelText);
    if (!lb) return R.noField();

    const stack = lb.closest(".mantine-Stack-root") || lb.parentElement;
    if (!stack) return R.noField();

    // 開始ボタン：DateTimePicker-input を優先（data-dates-input=true も多い）
    const startBtn =
      stack.querySelector('button.mantine-DateTimePicker-input[aria-haspopup="dialog"]') ||
      stack.querySelector('button[data-dates-input="true"][aria-haspopup="dialog"]') ||
      stack.querySelector('button[aria-haspopup="dialog"]');

    // 終了ボタン：name=end が確実
    const endBtn =
      stack.querySelector('button[name="end"][aria-haspopup="dialog"]') ||
      stack.querySelector('button[id$="-target"][name="end"]') ||
      null;

    const notes = [];
    let changed = false;
    let skippedFilled = 0;
    let wantCount = 0;

    // 開始（空っぽ/プレースホルダなら入れる）
    if (startText){
      wantCount++;
      if (!startBtn){
        notes.push("開始:欄が見つからない");
      } else if (!isPlaceholderBtn(startBtn)){
        skippedFilled++;
      } else {
        const err = await setDateTimeByTarget(startBtn, startText);
        if (err) notes.push(`開始:${err}`);
        else {
          changed = true;
          watch(`${field}(開始)`,
            () => !isPlaceholderBtn(startBtn),
            () => {},
            () => `期待="${startText}" 実際="${normText(startBtn.textContent)}"`);
        }
        await wait(120);
      }
    }

    // 終了（空っぽ/プレースホルダなら入れる）
    if (endText){
      wantCount++;
      if (!endBtn){
        notes.push("終了:欄が見つからない");
      } else if (!isPlaceholderBtn(endBtn)){
        skippedFilled++;
      } else {
        const err = await setDateTimeByTarget(endBtn, endText);
        if (err) notes.push(`終了:${err}`);
        else {
          changed = true;
          watch(`${field}(終了)`,
            () => !isPlaceholderBtn(endBtn),
            () => {},
            () => `期待="${endText}" 実際="${normText(endBtn.textContent)}"`);
        }
        await wait(120);
      }
    }

    if (!wantCount) return R.noValue();
    if (notes.length) return { ok: changed, status: "NG:" + notes.join(" / "), detail: "" };
    if (changed) return R.done();
    if (skippedFilled) return R.filled("設定済み");
    return R.noValue();
  }

  // =============================
  // Main
  // =============================
  const handleMessage = (msg, sender, sendResponse) => {
    (async () => {
      try {
        if (!msg || msg.type !== MSG_TYPE) return;

        const p = msg.payload || {};
        report = [];
        writes = [];
        let changed = false;

        const apply = (field, res) => {
          if (!res) return;
          if (res.ok) changed = true;
          report.push({ 項目: field, 結果: res.status, 詳細: res.detail || "" });
        };

        // タイトル/管理名称（空欄のみ）
        apply("タイトル", setTextByLabel("タイトル", "タイトル", p.title, false));
        apply("管理名称", setTextByLabel("管理名称", "管理名称", p.adminName, false));

        // 表示グループ / カテゴリ（select）
        apply("表示グループ", await setMantineSelectByLabel("表示グループ", "表示グループ", p.displayGroup));
        apply("カテゴリ",     await setMantineSelectByLabel("カテゴリ", "カテゴリ", p.category));

        // 配布方法（select）
        apply("配布方法", await setMantineSelectByLabelStrict("配布方法", "配布方法", p.distributionMethod));

        // 日時（公開期間 / 利用可能期間）
        // p.publishStart / p.publishEnd / p.usableStart / p.usableEnd
        apply("公開期間",     await setMantineDateRangeByLabel("公開期間", "公開期間", p.publishStart, p.publishEnd));
        apply("利用可能期間", await setMantineDateRangeByLabel("利用可能期間", "利用可能期間", p.usableStart, p.usableEnd));

        // ★重要：ブランド入居フロア / ブランド名（TextInputなので “直接入力”）
        apply("ブランド入居フロア", setTextByLabel("ブランド入居フロア", "ブランド入居フロア", p.brandFloor, true));
        apply("ブランド名",         setTextByLabel("ブランド名", "ブランド名", p.brandName, true));

        // ご利用条件 / 注意事項（RichText：空なら入れる）
        apply("ご利用条件", setRichTextByLabel("ご利用条件", "ご利用条件", p.terms));
        apply("注意事項",   setRichTextByLabel("注意事項", "注意事項", p.notes));

        // 並べ替え優先度（CMS側が"0"の時のみ上書き）
        apply("並べ替え優先度", setNumberInputByLabel("並べ替え優先度", "並べ替え優先度", p.sortPriority, ["", "0"]));

        // 会員ひとりが利用可能な回数（基本空 or 初期値なら入れる）
        apply("会員ひとりが利用可能な回数",
          setNumberInputByLabel("会員ひとりが利用可能な回数", "会員ひとりが利用可能な回数", p.perUser, ["", "1"]));

        // 全体の利用回数制限（switch）
        if (typeof p.totalLimitEnabled === "boolean"){
          apply("全体の利用回数制限", setSwitchByLabel("全体の利用回数制限", "全体の利用回数制限", p.totalLimitEnabled));
          await wait(120);
        }

        // 全体で利用可能な回数（“あり”の時に出現）
        if (p.totalLimitEnabled){
          apply("全体で利用可能な回数",
            setNumberInputByLabel("全体で利用可能な回数", "全体で利用可能な回数", p.totalCount, ["", "1"]));
        }

        // 書き込んだ値が生き残っているか確認し、消えていたら1回だけ入れ直す
        const reverted = await verifyWrites();
        reverted.forEach(({ field, detail }) => {
          const row = report.find(r => r.項目 === field)
                   || report.find(r => field.startsWith(r.項目));
          if (row){
            row.結果 = "NG:入れたが戻された";
            row.詳細 = detail;
          } else {
            report.push({ 項目: field, 結果: "NG:入れたが戻された", 詳細: detail });
          }
        });

        const ng = report.filter(r => String(r.結果).startsWith("NG"));

        console.log("%c[toCMS] 反映結果", "font-weight:bold");
        console.table(report);
        if (ng.length) console.warn("[toCMS] 未反映:", ng);

        if (ng.length){
          showToast(
            `未反映 ${ng.length}件\n` + ng.map(r => `・${r.項目}（${r.結果.replace(/^NG:/, "")}）`).join("\n") +
            "\n\n詳細はコンソール（F12）",
            9000
          );
        } else if (changed){
          showToast("入力しました");
        } else {
          showToast("入力できる空欄がありませんでした", 4000);
        }

        sendResponse({ ok: true, changed, report });
      } catch (e) {
        console.warn("[cms_inject]", e);
        showToast("エラー: " + String(e?.message || e), 9000);
        sendResponse({ ok: false, error: String(e?.message || e), report });
      }
    })();

    return true;
  };

  chrome.runtime.onMessage.addListener(handleMessage);

  // 次に注入されたインスタンスから呼ばれる。これを置いておかないと二重登録になる。
  window.__YK_CMS_INJECT_DISPOSE__ = () => {
    chrome.runtime.onMessage.removeListener(handleMessage);
  };
})();
