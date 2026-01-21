(() => {
  const MSG_TYPE = "YK_COUPON_TO_CMS";

  function findTitleSet() {
    return document.querySelector('.set[data-set="title"]');
  }

  function getValues() {
    const setEl = findTitleSet();
    if (!setEl) return null;

    // ✅ index.html(v1.1.2) に合わせる
    const outTitle = (setEl.querySelector("textarea.output-title")?.value ?? "").trim();
    const outAdmin = (setEl.querySelector("textarea.output-admin")?.value ?? "").trim();

    const displayGroup = (document.getElementById("displayGroup")?.value ?? "").trim();
    const category = (document.getElementById("category")?.value ?? "").trim();

    // 将来用（今はCMSへ未マッピングでもpayloadに入れてOK）
    const division = (document.getElementById("division")?.value ?? "").trim();
    const firstCome = (document.getElementById("firstCome")?.value ?? "").toString().trim();

    return {
      outTitle,
      outAdmin,
      displayGroup,
      category,
      division,
      firstCome
    };
  }

  function addToCmsButton(setEl) {
    const actions = setEl.querySelector(".set-head .actions");
    if (!actions) return;

    if (actions.querySelector(".btn-tocms")) return;

    const convertBtn = actions.querySelector(".btn-convert");
    if (!convertBtn) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-tocms";
    btn.textContent = "toCMS";
    btn.title = "CMSへ流し込み";

    // 「変換」の左へ
    actions.insertBefore(btn, convertBtn);

    btn.addEventListener("click", async (e) => {
      e.preventDefault();

      const v = getValues();
      if (!v) return;

      // 出力が空でも、今回は「ダイアログ出さない」方針なので何もしない（consoleだけ）
      if (!v.outTitle && !v.outAdmin) {
        console.warn("[toCMS] outputs are empty (convert first)");
        return;
      }

      try {
        const res = await chrome.runtime.sendMessage({
          type: MSG_TYPE,
          fields: {
            title: v.outTitle,
            adminName: v.outAdmin,
            displayGroup: v.displayGroup,
            category: v.category,
            division: v.division,
            firstCome: v.firstCome
          }
        });

        if (!res?.ok) {
          const err = String(res?.error || "unknown");
          // ✅ CMSタブが無い時だけダイアログ
          if (err.includes("CMSタブ") || err.includes("見つかりません")) {
            alert(err);
          } else {
            console.warn("[toCMS] send failed:", err);
          }
        }
      } catch (err) {
        const m = String(err?.message || err);
        // 基本は黙る。致命（拡張死んでる等）は console へ
        console.warn("[toCMS] send failed:", m);
      }
    });
  }

  function boot() {
    const setEl = findTitleSet();
    if (!setEl) return;
    addToCmsButton(setEl);
  }

  boot();

  const mo = new MutationObserver(() => boot());
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
