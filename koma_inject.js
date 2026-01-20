(() => {
  const MSG_TYPE = "YK_COUPON_TO_CMS";

  function toast(msg) {
    // KoMaTukuru側に既存toastがある前提：無ければconsoleに落ちるだけ
    try {
      if (typeof window.toast === "function") return window.toast(msg);
    } catch {}
    console.log("[toCMS]", msg);
  }

  function findTitleSet() {
    return document.querySelector('.set[data-set="title"]');
  }

  function getTitleOutputValue(setEl) {
    const out = setEl.querySelector("textarea.output");
    return (out?.value ?? "").trim();
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
    btn.className = "btn-tocms"; // 既存CSSのbuttonを継承（余計な色クラスを付けない）
    btn.textContent = "toCMS";
    btn.title = "CMSへ流し込み（タイトル）";

    // 「変換」の左に差し込む
    actions.insertBefore(btn, convertBtn);

    btn.addEventListener("click", async (e) => {
      e.preventDefault();

      const value = getTitleOutputValue(setEl);
      if (!value) {
        toast("出力が空です（先に変換してください）");
        return;
      }

      try {
        await chrome.runtime.sendMessage({
          type: MSG_TYPE,
          fields: { title: value }
        });
        toast("CMSへ送信しました");
      } catch (err) {
        console.warn(err);
        toast("CMS送信に失敗しました");
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

  // SPAっぽい更新に備えて監視（最小）
  const mo = new MutationObserver(() => boot());
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
