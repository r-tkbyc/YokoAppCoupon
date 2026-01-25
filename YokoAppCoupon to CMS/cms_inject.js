(() => {
  const MSG_TYPE = "YK_COUPON_TO_CMS";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function showToast(msg){
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
      toast.style.opacity = "0";
      toast.style.transition = "opacity .2s ease";
      document.documentElement.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = "1";
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toast.style.opacity = "0";
    }, 1200);
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
  // Mantine Select
  // =============================
  async function setMantineSelectByLabel(labelText, valueText){
    const input = findInputByLabelText(labelText);
    if (!input) return false;

    const want = normText(valueText);
    if (!want) return false;

    if (normText(input.value) === want) return true;

    input.click();
    await wait(80);

    // Portal想定で body から拾う
    const options = $$('[role="option"]', document.body);
    const opt =
      options.find(o => normText(o.textContent) === want) ||
      options.find(o => normText(o.textContent).includes(want)) ||
      null;

    if (!opt) return false;
    opt.click();
    await wait(60);
    return true;
  }

  async function setMantineSelectByLabelStrict(labelText, valueText){
    const input = findInputByLabelTextStrict(labelText);
    if (!input) return false;

    const want = normText(valueText);
    if (!want) return false;

    if (normText(input.value) === want) return true;

    input.click();
    await wait(80);

    const options = $$('[role="option"]', document.body);
    const opt = options.find(o => normText(o.textContent) === want) || null;
    if (!opt) return false;

    opt.click();
    await wait(60);
    return true;
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

  // =============================
  // NumberInput（type=text）
  // =============================
  function setNumberInputByLabel(labelText, valueText, allowOverwriteIfCurrentIn = []){
    const input = findInputByLabelText(labelText);
    if (!input) return false;

    const cur = (input.value ?? "").toString();
    const want = (valueText ?? "").toString();
    if (!want.trim()) return false;

    if (allowOverwriteIfCurrentIn.length > 0){
      if (!allowOverwriteIfCurrentIn.includes(cur)) return false;
    } else {
      if (cur && cur.trim()) return false;
    }

    return setNativeValue(input, want);
  }

  // =============================
  // Switch（role="switch"）
  // =============================
  function setSwitchByLabel(labelText, enabled){
    const labels = $$("label");
    const lb = labels.find(l => (l.textContent || "").trim().startsWith(labelText));
    if (!lb) return false;

    const stack = lb.closest(".mantine-Stack-root") || lb.parentElement;
    if (!stack) return false;

    const sw = stack.querySelector("input[type='checkbox'][role='switch']");
    if (!sw) return false;

    const want = !!enabled;
    const cur = !!sw.checked;
    if (cur === want) return true;

    sw.click();
    return true;
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

  function closeAllPopovers(){
    // ESCで閉じられることが多い
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
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
    if (!targetBtn || !dt) return false;

    closeAllPopovers();
    await wait(60);

    const ddId = getDropdownIdFromTarget(targetBtn);

    targetBtn.scrollIntoView?.({ block: "center" });
    targetBtn.click();

    // dropdown取得
    const dd = ddId
      ? await waitFor(() => document.getElementById(ddId), 3000, 60)
      : await waitFor(() => document.querySelector('.mantine-Popover-dropdown[role="dialog"]'), 3000, 60);

    if (!dd) return false;

    // 月移動
    await moveToMonth(dd, dt.y, dt.mo);

    // 日付クリック
    const dayBtn = findDayButton(dd, dt.y, dt.mo, dt.d);
    if (!dayBtn) return false;
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
    if (!submit) return false;
    submit.click();

    // 閉じるまで待つ（重なり防止）
    if (ddId){
      await waitFor(() => !document.getElementById(ddId), 2500, 60);
    } else {
      // idが取れなかった場合：今開いてるdropdownが消えるまで
      await wait(120);
      await waitFor(() => !document.querySelector('.mantine-Popover-dropdown[role="dialog"]'), 2500, 60);
    }

    return true;
  }

  function isPlaceholderBtn(btn){
    if (!btn) return true;
    const t = (btn.textContent || "").trim();
    // ここは環境で文言が揺れるので「空ならプレースホルダ扱い」
    return !t || t === "開始日時" || t === "終了日時";
  }

  async function setMantineDateRangeByLabel(labelText, startText, endText){
    const lb = findLabelElementStrict(labelText);
    if (!lb) return false;

    const stack = lb.closest(".mantine-Stack-root") || lb.parentElement;
    if (!stack) return false;

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

    let changed = false;

    // 開始（空っぽ/プレースホルダなら入れる）
    if (startText && startBtn && isPlaceholderBtn(startBtn)){
      const ok = await setDateTimeByTarget(startBtn, startText);
      if (ok) changed = true;
      await wait(120);
    }

    // 終了（空っぽ/プレースホルダなら入れる）
    if (endText && endBtn && isPlaceholderBtn(endBtn)){
      const ok = await setDateTimeByTarget(endBtn, endText);
      if (ok) changed = true;
      await wait(120);
    }

    return changed;
  }

  // =============================
  // Main
  // =============================
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
      try {
        if (!msg || msg.type !== MSG_TYPE) return;

        const p = msg.payload || {};
        let changed = false;

        // タイトル/管理名称（空欄のみ）
        const titleEl = findInputByLabelText("タイトル");
        if (titleEl && !titleEl.value && p.title){
          setNativeValue(titleEl, p.title);
          changed = true;
        }

        const adminEl = findInputByLabelText("管理名称");
        if (adminEl && !adminEl.value && p.adminName){
          setNativeValue(adminEl, p.adminName);
          changed = true;
        }

        // 表示グループ / カテゴリ（select）
        if (p.displayGroup){
          const ok = await setMantineSelectByLabel("表示グループ", p.displayGroup);
          if (ok) changed = true;
        }
        if (p.category){
          const ok = await setMantineSelectByLabel("カテゴリ", p.category);
          if (ok) changed = true;
        }

        // 配布方法（select）
        if (p.distributionMethod){
          const ok = await setMantineSelectByLabelStrict("配布方法", p.distributionMethod);
          if (ok) changed = true;
        }

        // 日時（公開期間 / 利用可能期間）
        // p.publishStart / p.publishEnd / p.usableStart / p.usableEnd
        if (p.publishStart || p.publishEnd){
          const ok = await setMantineDateRangeByLabel("公開期間", p.publishStart, p.publishEnd);
          if (ok) changed = true;
        }
        if (p.usableStart || p.usableEnd){
          const ok = await setMantineDateRangeByLabel("利用可能期間", p.usableStart, p.usableEnd);
          if (ok) changed = true;
        }

        // ★重要：ブランド入居フロア / ブランド名（TextInputなので “直接入力”）
        if (p.brandFloor){
          const bf = findInputByLabelTextStrict("ブランド入居フロア") || findInputByLabelText("ブランド入居フロア");
          if (bf && !(bf.value || "").toString().trim()){
            setNativeValue(bf, p.brandFloor);
            changed = true;
          }
        }
        if (p.brandName){
          const bn = findInputByLabelTextStrict("ブランド名") || findInputByLabelText("ブランド名");
          if (bn && !(bn.value || "").toString().trim()){
            setNativeValue(bn, p.brandName);
            changed = true;
          }
        }

        // ご利用条件 / 注意事項（RichText：空なら入れる）
        if (p.terms){
          const prose = findRichEditorByLabel("ご利用条件");
          if (prose && richEditorIsEmpty(prose)){
            if (setRichText(prose, p.terms)) changed = true;
          }
        }
        if (p.notes){
          const prose = findRichEditorByLabel("注意事項");
          if (prose && richEditorIsEmpty(prose)){
            if (setRichText(prose, p.notes)) changed = true;
          }
        }

        // 会員ひとりが利用可能な回数（基本空 or 初期値なら入れる）
        if (p.perUser){
          if (setNumberInputByLabel("会員ひとりが利用可能な回数", p.perUser, ["", "1"])) changed = true;
        }

        // 全体の利用回数制限（switch）
        if (typeof p.totalLimitEnabled === "boolean"){
          if (setSwitchByLabel("全体の利用回数制限", p.totalLimitEnabled)) changed = true;
          await wait(120);
        }

        // 全体で利用可能な回数（“あり”の時に出現）
        if (p.totalLimitEnabled && p.totalCount){
          if (setNumberInputByLabel("全体で利用可能な回数", p.totalCount, ["", "1"])) changed = true;
        }

        if (changed) showToast("入力しました");

        sendResponse({ ok: true, changed });
      } catch (e) {
        console.warn("[cms_inject]", e);
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();

    return true;
  });
})();
