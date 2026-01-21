(() => {
  const MSG_TYPE = "YK_COUPON_TO_CMS";

  function normText(s) {
    return (s ?? "")
      .toString()
      .replace(/[\u00A0\u3000]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function log(...args) { console.log("[koma_inject]", ...args); }
  function warn(...args) { console.warn("[koma_inject]", ...args); }

  function findTitleSet() {
    return document.querySelector('.set[data-set="title"]');
  }

  // タイトルセット内の「出力（タイトル）」「出力（管理名称）」をできるだけ安定して拾う
  function getOutputByPanelHeading(setEl, headingContains) {
    if (!setEl) return "";
    const want = normText(headingContains);

    const panels = Array.from(setEl.querySelectorAll(".panel, .col-right .panel"));
    for (const p of panels) {
      const headEl = p.querySelector("h2, h3, .panel-title, .head, .label");
      const head = normText(headEl?.textContent || "");
      if (head && head.includes(want)) {
        const out = p.querySelector("textarea.output");
        return out ? (out.value || "").trim() : "";
      }
    }
    return "";
  }

  function getOutputsFallback(setEl) {
    const outs = Array.from(setEl?.querySelectorAll("textarea.output") || []);
    const v1 = (outs[0]?.value || "").trim();
    const v2 = (outs[1]?.value || "").trim();
    return { v1, v2 };
  }

  function getTitleOutputValue(setEl) {
    // まずラベルで拾う
    const byLabel = getOutputByPanelHeading(setEl, "出力（タイトル）");
    if (byLabel) return byLabel;

    // 旧UI/ラベル無し：最初のoutput
    const { v1 } = getOutputsFallback(setEl);
    return v1;
  }

  function getAdminNameOutputValue(setEl) {
    const byLabel = getOutputByPanelHeading(setEl, "出力（管理名称）");
    if (byLabel) return byLabel;

    // 2つ目があればそれを管理名称とみなす
    const { v2 } = getOutputsFallback(setEl);
    return v2;
  }

  // YokoAppCoupon側のプルダウン（表示グループ/カテゴリ）を「ラベル文字」から拾える場合だけ拾う
  function getValueByLabelText(labelText) {
    const want = normText(labelText);
    const labels = Array.from(document.querySelectorAll("label, .label, .field-label, h2, h3"))
      .filter(el => normText(el.textContent) === want);

    for (const lab of labels) {
      // label[for] -> #id
      if (lab.tagName.toLowerCase() === "label") {
        const forId = lab.getAttribute("for");
        if (forId) {
          const target = document.getElementById(forId);
          if (target) {
            if (target.tagName.toLowerCase() === "select") {
              const sel = target;
              return normText(sel.options[sel.selectedIndex]?.text || sel.value);
            }
            if (target.tagName.toLowerCase() === "input" || target.tagName.toLowerCase() === "textarea") {
              return normText(target.value);
            }
          }
        }
      }

      // 近傍から拾う（fallback）
      const box = lab.closest(".panel, .field, .cell, .col, .row") || lab.parentElement;
      if (!box) continue;

      const sel = box.querySelector("select");
      if (sel) return normText(sel.options[sel.selectedIndex]?.text || sel.value);

      const inp = box.querySelector("input, textarea");
      if (inp) return normText(inp.value);
    }

    return "";
  }

  function addToCMSButton(setEl) {
    const btnArea = setEl.querySelector(".btn-area");
    if (!btnArea) return;

    // 既にあるなら作らない
    if (btnArea.querySelector("button[data-to-cms]")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "toCMS";
    btn.className = "btn"; // 既存スタイルに合わせる
    btn.dataset.toCms = "1";

    btn.addEventListener("click", () => {
      const titleOut = getTitleOutputValue(setEl);
      const adminOut = getAdminNameOutputValue(setEl);

      const displayGroup = getValueByLabelText("表示グループ");
      const category = getValueByLabelText("カテゴリ");

      const payload = {
        __type: MSG_TYPE,
        from: location.href,
        title: titleOut,
        admin_name: adminOut,
        display_group: displayGroup,
        category: category,
      };

      log("send payload", payload);

      chrome.runtime.sendMessage(payload, (resp) => {
        if (chrome.runtime.lastError) {
          warn("sendMessage error", chrome.runtime.lastError.message);
          alert("toCMS送信に失敗しました（拡張機能の権限/起動状態を確認）");
          return;
        }
        // backgroundは何も返さない想定でもOK
        alert("CMSへ送信しました（対象タブへ自動入力します）");
      });
    });

    // 変換ボタンの左に差し込み（既存順序を崩さない）
    const convertBtn = Array.from(btnArea.querySelectorAll("button")).find(b => normText(b.textContent).includes("変換"));
    if (convertBtn) {
      btnArea.insertBefore(btn, convertBtn);
    } else {
      btnArea.insertBefore(btn, btnArea.firstChild);
    }
  }

  function init() {
    const setEl = findTitleSet();
    if (!setEl) return;
    addToCMSButton(setEl);
  }

  // DOM変化にも追従
  const mo = new MutationObserver(() => init());
  mo.observe(document.documentElement, { childList: true, subtree: true });

  init();
})();
