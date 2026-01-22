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
      toast.style.zIndex = "999999";
      toast.style.padding = "10px 12px";
      toast.style.borderRadius = "10px";
      toast.style.background = "rgba(30,30,30,.92)";
      toast.style.color = "#fff";
      toast.style.fontSize = "13px";
      toast.style.boxShadow = "0 6px 18px rgba(0,0,0,.25)";
      toast.style.opacity = "0";
      toast.style.transition = "opacity .2s ease";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = "1";
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => (toast.style.opacity = "0"), 1200);
  }

  function setNativeValue(el, value){
    const v = (value ?? "").toString();
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    desc?.set?.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function findInputByLabelText(labelText){
    // label のテキストで特定 → for=id で input 取得
    const labels = $$("label");
    const target = labels.find(l => (l.textContent || "").replace(/\s+/g,"").includes(labelText.replace(/\s+/g,"")));
    if (!target) return null;

    const forId = target.getAttribute("for");
    if (forId){
      const input = document.getElementById(forId);
      if (input) return input;
    }
    // fallback: labelの近くのinput
    const wrap = target.closest(".mantine-InputWrapper-root") || target.parentElement;
    return wrap ? $("input, textarea", wrap) : null;
  }

  async function setMantineSelectByLabel(labelText, desired){
    const input = findInputByLabelText(labelText);
    if (!input) return false;

    const want = (desired ?? "").toString().trim();
    if (!want) return false;

    // すでに同値ならOK
    if ((input.value || "").trim() === want) return true;

    // クリックして候補を出す
    input.click();
    input.focus();

    // 候補が出るまで少し待つ
    await new Promise(r => setTimeout(r, 50));

    // role="option" を探して一致をクリック
    const options = $$('[role="option"]');
    const opt = options.find(o => (o.textContent || "").trim() === want) || null;
    if (opt){
      opt.click();
      return true;
    }

    // fallback: 値を直接入れてみる
    setNativeValue(input, want);
    return true;
  }

  function findRichEditorByLabel(labelText){
    const labels = $$("label");
    const lb = labels.find(l => (l.textContent || "").trim().startsWith(labelText));
    if (!lb) return null;

    const stack = lb.closest(".mantine-Stack-root") || lb.parentElement;
    if (!stack) return null;

    const editorRoot = stack.querySelector(".mantine-RichTextEditor-root");
    if (!editorRoot) return null;

    const prose = editorRoot.querySelector(".ProseMirror[contenteditable='true']");
    return prose || null;
  }

  function richEditorIsEmpty(prose){
    if (!prose) return true;
    // tiptapの空判定に寄せる
    const text = (prose.textContent || "").replace(/\u200B/g,"").trim();
    return text.length === 0;
  }

  function setRichText(prose, text){
    const t = (text ?? "").toString();
    if (!t.trim()) return false;

    // 2000文字制限はCMS側にあるのでここでは触らない（必要なら後で）
    const escaped = t
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");

    const html = "<p>" + escaped.replace(/\n/g, "<br>") + "</p>";
    prose.innerHTML = html;
    prose.dispatchEvent(new Event("input", { bubbles: true }));
    prose.dispatchEvent(new Event("blur", { bubbles: true }));
    return true;
  }

  function setNumberInputByLabel(labelText, desired, treatAsDefaultValues = ["", "1"]){
    const input = findInputByLabelText(labelText);
    if (!input) return false;

    const want = (desired ?? "").toString().trim();
    if (!want) return false;

    const cur = (input.value ?? "").toString().trim();

    // 空 or 初期値扱いなら上書きOK（今回の「1固定」対策）
    if (!cur || treatAsDefaultValues.includes(cur) || cur === want){
      setNativeValue(input, want);
      return true;
    }
    // curが既に入力されていてユーザーが触っている可能性があるなら壊さない
    return false;
  }

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
