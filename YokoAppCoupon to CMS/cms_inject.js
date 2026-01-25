(() => {
  const MSG_TYPE = "YK_COUPON_TO_CMS";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function showToast(msg){
    // 既存があれば再利用
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

    // Select は input (type=text) が居る / text系も input
    // NumberInput も input type=text
    const input = scope.querySelector("input, textarea");
    return input || null;
  }

  function findInputByLabelTextStrict(labelText){
    const lb = findLabelElementStrict(labelText);
    if (!lb) return null;
    const scope = lb.closest(".mantine-InputWrapper-root") || lb.parentElement;
    if (!scope) return null;
    const input = scope.querySelector("input, textarea");
    return input || null;
  }

  // =============================
  //  Mantine Select（表示グループ/カテゴリ/ブランド/配布方法 など）
  // =============================
  async function setMantineSelectByLabel(labelText, valueText){
    const input = findInputByLabelText(labelText);
    if (!input) return false;

    const want = normText(valueText);
    if (!want) return false;

    // 既に一致しているならOK
    if (normText(input.value) === want) return true;

    // クリックでドロップダウン表示
    input.click();
    await wait(80);

    // Portal なので body 全体から option を拾う
    const options = $$('[role="option"]', document.body);
    const opt = options.find(o => normText(o.textContent) === want) || null;
    if (!opt){
      // 部分一致 fallback
      const opt2 = options.find(o => normText(o.textContent).includes(want)) || null;
      if (!opt2) return false;
      opt2.click();
      await wait(40);
      return true;
    }
    opt.click();
    await wait(40);
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
    await wait(40);
    return true;
  }

  // =============================
  //  RichText（ProseMirror / tiptap）
  // =============================
  function findRichEditorByLabel(labelText){
    const lb = findLabelElementIncludes(labelText);
    if (!lb) return null;

    // label の近くに RTE が居る想定
    const scope = lb.closest(".mantine-InputWrapper-root") || lb.parentElement || document;
    const prose = scope.querySelector(".tiptap.ProseMirror, .ProseMirror");
    if (prose) return prose;

    // 少し広げる
    const stack = lb.closest(".mantine-Stack-root");
    return stack?.querySelector(".tiptap.ProseMirror, .ProseMirror") || null;
  }

  function richEditorIsEmpty(prose){
    if (!prose) return true;
    const t = (prose.textContent || "").replace(/\u200B/g, "").trim();
    // テキストが空、または空行だけなら空扱い
    return !t;
  }

  // ★改行→ <p>…</p> 化（行ごとに段落）
  function setRichText(prose, text){
    if (!prose) return false;
    const raw = (text ?? "").toString();
    // 改行コード統一
    const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const safe = lines.map(l =>
      (l ?? "").toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
    );

    // 空行は <p><br></p> にして段落維持
    const html = safe.map(l => (l.trim() ? `<p>${l}</p>` : `<p><br></p>`)).join("");
    prose.focus();
    prose.innerHTML = html;
    // tiptap/react の拾い方に合わせて input も飛ばす
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
      if (cur && cur.trim()) return false; // 空欄のみ
    }

    return setNativeValue(input, want);
  }

  // =============================
  //  Switch（role="switch" checkbox）
  // =============================
  function setSwitchByLabel(labelText, enabled){
    // labelText を含む Stack を探し、その中の checkbox[role=switch]
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

    sw.click(); // Mantineはclickで状態/DOMを更新する想定
    return true;
  }

  // =============================
  //  日時（公開期間 / 利用可能期間）入力サポート
  // =============================
  function parseYmdHmToDate(text){
    const s = (text ?? "").toString().trim();
    if (!s) return null;

    // 期待形式: YYYY/MM/DD HH:mm
    const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
    if (!m) return null;

    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const h = Number(m[4]);
    const mi = Number(m[5]);
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d) || !Number.isFinite(h) || !Number.isFinite(mi)) return null;

    // ローカルタイムで構築（ユーザーPCのTZに従う）
    const dt = new Date(y, mo - 1, d, h, mi, 0, 0);
    if (Number.isNaN(dt.getTime())) return null;
    return dt;
  }

  function _btnIsPlaceholder(btn){
    if (!btn) return true;
    // Mantine placeholder span
    if (btn.querySelector(".mantine-InputPlaceholder-placeholder")) return true;
    const t = (btn.textContent || "").trim();
    return !t || t === "開始日時" || t === "終了日時";
  }

  function _setDateButtonText(btn, text){
    if (!btn) return false;
    const t = (text ?? "").toString().trim();
    if (!t) return false;

    const trunc = btn.querySelector("span.truncate");
    if (trunc){
      trunc.textContent = t;
      return true;
    }
    // placeholder span がある時は textContent で丸ごと置換してOK
    btn.textContent = t;
    return true;
  }

  function _ensureHiddenInput(stack, name){
    if (!stack) return null;
    let el = stack.querySelector(`input[type="hidden"][name="${name}"]`);
    if (el) return el;

    el = document.createElement("input");
    el.type = "hidden";
    el.name = name;
    el.value = "";
    stack.appendChild(el);
    return el;
  }

  function setMantineDateRangeByLabel(labelText, startText, endText){
    // label から Stack を取得（idが毎回変わるので label 依存）
    const lb = findLabelElementStrict(labelText);
    if (!lb) return false;

    const stack = lb.closest(".mantine-Stack-root") || lb.parentElement;
    if (!stack) return false;

    // このStackの中に DateTimePicker らしきボタンが2つある想定（開始/終了）
    const buttons = Array.from(stack.querySelectorAll("button[aria-haspopup='dialog']"));
    if (!buttons.length) return false;

    const startBtn = buttons[0] || null;
    // 終了は name=end が付いている方を優先
    const endBtn = stack.querySelector("button[name='end'][aria-haspopup='dialog']") || buttons[1] || null;

    let changed = false;

    // 開始
    if (startText){
      const dt = parseYmdHmToDate(startText);
      if (dt){
        // 空欄なら入れる（ユーザーが触った可能性がある場合は壊さない）
        const hidden = _ensureHiddenInput(stack, "start");
        if (_btnIsPlaceholder(startBtn) || !((hidden.value || "").trim())){
          _setDateButtonText(startBtn, startText);
          setNativeValue(hidden, dt.toISOString());
          changed = true;
        }
      }
    }

    // 終了
    if (endText){
      const dt = parseYmdHmToDate(endText);
      if (dt){
        const hidden = _ensureHiddenInput(stack, "end");
        if (_btnIsPlaceholder(endBtn) || !((hidden.value || "").trim())){
          _setDateButtonText(endBtn, endText);
          setNativeValue(hidden, dt.toISOString());
          changed = true;
        }
      }
    }

    return changed;
  }

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
        //  - 公開期間（開始）  : p.publishStart
        //  - 公開期間（終了）  : p.publishEnd
        //  - 利用可能期間（開始）: p.usableStart
        //  - 利用可能期間（終了）: p.usableEnd
        if (p.publishStart || p.publishEnd){
          if (setMantineDateRangeByLabel("公開期間", p.publishStart, p.publishEnd)) changed = true;
        }
        if (p.usableStart || p.usableEnd){
          if (setMantineDateRangeByLabel("利用可能期間", p.usableStart, p.usableEnd)) changed = true;
        }

        // ★追加：ブランド入居フロア / ブランド名（空欄のみ）
        if (p.brandFloor){
          const bf = findInputByLabelTextStrict("ブランド入居フロア") || findInputByLabelText("ブランド入居フロア");
          if (bf && !(bf.value || "").toString().trim()){
            const ok = await setMantineSelectByLabelStrict("ブランド入居フロア", p.brandFloor);
            if (ok) changed = true;
          }
        }
        if (p.brandName){
          const bn = findInputByLabelTextStrict("ブランド名") || findInputByLabelText("ブランド名");
          if (bn && !(bn.value || "").toString().trim()){
            const ok = await setMantineSelectByLabelStrict("ブランド名", p.brandName);
            if (ok) changed = true;
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
          // DOM変化待ち
          await new Promise(r => setTimeout(r, 80));
        }

        // 全体で利用可能な回数（“あり”の時に出現）
        if (p.totalLimitEnabled && p.totalCount){
          // ここは「1が初期値」になりがちなので上書き許可
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
