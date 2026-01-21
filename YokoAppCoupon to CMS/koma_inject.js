(() => {
  const MSG_TYPE = "YK_COUPON_TO_CMS";

  function toast(msg) {
    // YokoAppCoupon(index.html) に toast() がある前提。無ければ console へ。
    try {
      if (typeof window.toast === "function") return window.toast(msg);
    } catch {}
    console.log("[toCMS]", msg);
  }

  function findTitleSet() {
    return document.querySelector('.set[data-set="title"]');
  }

  function getValue(sel) {
    const el = document.querySelector(sel);
    return (el?.value ?? "").toString().trim();
  }

  function getTitleOutputValue(setEl) {
    // 新：出力（タイトル）
    const out = setEl.querySelector("textarea.output-title");
    return (out?.value ?? "").toString().trim();
  }

  function getAdminOutputValue(setEl) {
    // 新：出力（管理名称）
    const out = setEl.querySelector("textarea.output-admin");
    return (out?.value ?? "").toString().trim();
  }

  function addToCmsButton(setEl) {
    const actions = setEl.querySelector(".set-head .actions");
    if (!actions) return;

    // 既にあるなら何もしない
    if (actions.querySelector(".btn-tocms")) return;

    const convertBtn = actions.querySelector(".btn-convert");
    if (!convertBtn) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-tocms"; // 既存buttonスタイルを継承（余計な色クラスは付けない）
    btn.textContent = "toCMS";
    btn.title = "CMSへ流し込み（タイトル/管理名称/表示グループ/カテゴリ）";

    // 「変換」の左に差し込む
    actions.insertBefore(btn, convertBtn);

    btn.addEventListener("click", async (e) => {
      e.preventDefault();

      // 送信値（index.htmlの現状DOMに合わせる）
      const title = getTitleOutputValue(setEl);
      const adminName = getAdminOutputValue(setEl);
      const displayGroup = getValue("#displayGroup");
      const category = getValue("#category");

      if (!title) {
        toast("出力（タイトル）が空です（先に変換してください）");
        return;
      }

      try {
        const res = await chrome.runtime.sendMessage({
          type: MSG_TYPE,
          fields: { title, adminName, displayGroup, category }
        });

        // ✅成功時は何も出さない（要望通り）
        if (res && res.ok) return;

        // ✅CMSタブが見つからない時だけダイアログ（toast）
        const err = String(res?.error || "unknown");
        if (err.includes("CMSタブが見つかりません")) {
          toast(err);
        } else {
          // それ以外は静かにconsoleへ
          console.warn("[toCMS] send failed:", err);
        }
      } catch (err) {
        const msg = String(err?.message || err);
        if (msg.includes("CMSタブが見つかりません")) toast(msg);
        else console.warn("[toCMS] send failed:", err);
      }
    });
  }

  function boot() {
    const setEl = findTitleSet();
    if (!setEl) return;
    addToCmsButton(setEl);
  }

  // 初回
  boot();

  // SPA/DOM差し替えに備えて監視（軽量）
  const mo = new MutationObserver(() => boot());
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
