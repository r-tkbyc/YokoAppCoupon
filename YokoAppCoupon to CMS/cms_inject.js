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

  function setNativeValue(el, value){
    if (!el) return false;
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set){
      desc.set.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  // =============================
  //  label 起点の入力探索
  // =============================
  function normText(s){
    return (s || "").replace(/\s+/g, " ").trim();
  }

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
  //  Mantine Select（表示グループ/カテゴリ/配布方法 など）
  // =============================
  async function setMantineSelectByLabel(labelText, valueText){
    const input = findInputByLabelText(labelText);
    if (!input) return false;

    const want = normText(valueText);
    if (!want) return false;

    if (normText(input.value) === want) return true;

    input.click();
    await wait(80);

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
  //  RichText（ProseMirror / tiptap）
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
  //  NumberInput（type=text）
  // =============================
  function setNumberInputByLabel(labelText, valueText, allowOverwriteIfCurrentIn = []){
    const input = findInputByLabelText(labelText);
    if (!input) return false;

    const cur = (input.value ?? "").toString();
    const want = (valueText ?? "").toString();

    if (allowOverwriteIfCurrentIn.length > 0){
      const ok = allowOverwriteIfCurrentIn.includes(cur);
      if (!ok) return false;
    } else {
      if (cur && cur.trim()) return false;
    }
    return setNativeValue(input, want);
  }

  // =============================
  //  Switch（role="switch" checkbox）
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
  //  TextInput（ブランド入居フロア / ブランド名 など）
  // =============================
  function setTextInputByLabelIfEmpty(labelText, valueText){
    const input = findInputByLabelTextStrict(labelText) || findInputByLabelText(labelText);
    if (!input) return false;
    if ((input.value || "").toString().trim()) return false;

    const want = (valueText ?? "").toString();
    if (!want.trim()) return false;

    return setNativeValue(input, want);
  }

  // =============================
  //  日時（Mantine DateTimePicker）を “UI操作で確定” させる
  // =============================
  function parseYmdHm(text){
    const s = (text ?? "").toString().trim();
    if (!s) return null;
    const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const h = Number(m[4]);
    const mi = Number(m[5]);
    if (![y,mo,d,h,mi].every(Number.isFinite)) return null;
    return { y, mo, d, h, mi };
  }

  function isVisible(el){
    if (!el) return false;
    const st = getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  }

  function getActiveDateDropdown(){
    // “今開いている” dropdown をできるだけそれっぽく取る
    const drops = $$('[data-dates-dropdown="true"][role="dialog"]', document.body)
      .filter(isVisible);

    if (!drops.length) return null;

    // 末尾の方が新しく開いた可能性が高い
    return drops[drops.length - 1];
  }

  async function openDropdownByClick(targetBtn){
    if (!targetBtn) return null;
    targetBtn.click();
    await wait(80);
    // 少し待って出現を拾う
    for (let i=0; i<10; i++){
      const dd = getActiveDateDropdown();
      if (dd) return dd;
      await wait(50);
    }
    return null;
  }

  function getHeaderYM(dropdown){
    const levelBtn = dropdown.querySelector("button.mantine-DateTimePicker-calendarHeaderLevel");
    if (!levelBtn) return null;
    const t = (levelBtn.textContent || "").trim(); // 例: "1月 2026"
    const m = t.match(/(\d+)\s*月\s*(\d{4})/);
    if (!m) return null;
    return { mo: Number(m[1]), y: Number(m[2]) };
  }

  async function moveMonthTo(dropdown, y, mo){
    // 最大24回まで prev/next で合わせる（過剰ループ防止）
    for (let i=0; i<24; i++){
      const cur = getHeaderYM(dropdown);
      if (!cur || (!Number.isFinite(cur.y) || !Number.isFinite(cur.mo))) return false;

      if (cur.y === y && cur.mo === mo) return true;

      const curIndex = cur.y * 12 + (cur.mo - 1);
      const tgtIndex = y * 12 + (mo - 1);
      const dir = (tgtIndex > curIndex) ? "next" : "previous";

      const btn = dropdown.querySelector(`button[data-direction="${dir}"]`);
      if (!btn) return false;
      btn.click();
      await wait(60);
    }
    return false;
  }

  function findDayButton(dropdown, y, mo, d){
    // aria-label 例: "26 1月 2026"
    const aria = `${d} ${mo}月 ${y}`;
    const btn =
      dropdown.querySelector(`button[aria-label="${aria}"]`) ||
      dropdown.querySelector(`button.mantine-DateTimePicker-day[aria-label="${aria}"]`) ||
      null;
    return btn;
  }

  async function setTimeInDropdown(dropdown, hh, mi){
    const timeInput = dropdown.querySelector('input[type="time"]');
    if (!timeInput) return false;

    const v = `${String(hh).padStart(2,"0")}:${String(mi).padStart(2,"0")}`;
    setNativeValue(timeInput, v);
    await wait(40);
    return true;
  }

  async function submitDropdown(dropdown){
    const submit =
      dropdown.querySelector("button.mantine-DateTimePicker-submitButton") ||
      dropdown.querySelector("button.mantine-DateTimePicker-submitButton[type='button']") ||
      dropdown.querySelector("button[data-mantine-stop-propagation='true'].mantine-DateTimePicker-submitButton") ||
      dropdown.querySelector(".mantine-DateTimePicker-timeWrapper button[type='button']") ||
      null;

    if (!submit) return false;
    submit.click();
    await wait(80);
    return true;
  }

  async function setDateTimeViaPickerButton(targetBtn, y, mo, d, hh, mi){
    const dd = await openDropdownByClick(targetBtn);
    if (!dd) return false;

    // 月移動
    const okMove = await moveMonthTo(dd, y, mo);
    if (!okMove) return false;

    // day クリック
    const dayBtn = findDayButton(dd, y, mo, d);
    if (!dayBtn) return false;
    dayBtn.click();
    await wait(50);

    // time セット
    const okTime = await setTimeInDropdown(dd, hh, mi);
    if (!okTime) return false;

    // ✓確定
    const okSubmit = await submitDropdown(dd);
    if (!okSubmit) return false;

    return true;
  }

  async function setMantineDateRangeByLabel_UI(labelText, startText, endText){
    const lb = findLabelElementStrict(labelText);
    if (!lb) return false;

    const stack = lb.closest(".mantine-Stack-root") || lb.parentElement;
    if (!stack) return false;

    // 開始/終了ボタン
    const buttons = Array.from(stack.querySelectorAll("button[aria-haspopup='dialog']"));
    if (!buttons.length) return false;

    const startBtn = buttons[0] || null;
    const endBtn =
      stack.querySelector("button[name='end'][aria-haspopup='dialog']") ||
      buttons[1] ||
      null;

    let changed = false;

    // hidden input（存在することが多い）※最終的な保持確認用
    const hiddenStart = stack.querySelector('input[type="hidden"][name="start"]') || null;
    const hiddenEnd   = stack.querySelector('input[type="hidden"][name="end"]') || null;

    if (startText){
      const p = parseYmdHm(startText);
      if (p){
        // 「既に埋まってるなら触らない」方針（安全）
        const already = (hiddenStart?.value || "").trim();
        if (!already){
          const ok = await setDateTimeViaPickerButton(startBtn, p.y, p.mo, p.d, p.h, p.mi);
          if (ok) changed = true;
        }
      }
    }

    if (endText){
      const p = parseYmdHm(endText);
      if (p){
        const already = (hiddenEnd?.value || "").trim();
        if (!already){
          const ok = await setDateTimeViaPickerButton(endBtn, p.y, p.mo, p.d, p.h, p.mi);
          if (ok) changed = true;
        }
      }
    }

    return changed;
  }

  // =============================
  //  main
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

        // ★ブランド入居フロア / ブランド名（TextInput）
        if (p.brandFloor){
          if (setTextInputByLabelIfEmpty("ブランド入居フロア", p.brandFloor)) changed = true;
        }
        if (p.brandName){
          if (setTextInputByLabelIfEmpty("ブランド名", p.brandName)) changed = true;
        }

        // 日時（公開期間 / 利用可能期間）
        //  - 公開期間（開始）  : p.publishStart
        //  - 公開期間（終了）  : p.publishEnd
        //  - 利用可能期間（開始）: p.usableStart
        //  - 利用可能期間（終了）: p.usableEnd
        if (p.publishStart || p.publishEnd){
          const ok = await setMantineDateRangeByLabel_UI("公開期間", p.publishStart, p.publishEnd);
          if (ok) changed = true;
        }
        if (p.usableStart || p.usableEnd){
          const ok = await setMantineDateRangeByLabel_UI("利用可能期間", p.usableStart, p.usableEnd);
          if (ok) changed = true;
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
          await wait(80);
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
