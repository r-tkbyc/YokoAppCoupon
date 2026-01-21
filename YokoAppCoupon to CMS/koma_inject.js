(() => {
  const MSG_TYPE = "YK_COUPON_TO_CMS";

  function findTitleSet() {
    return document.querySelector('.set[data-set="title"]');
  }

  function getOutputs(setEl) {
    const titleEl = setEl.querySelector("textarea.output-title");
    const adminEl = setEl.querySelector("textarea.output-admin");
    return {
      title: (titleEl?.value ?? "").trim(),
      admin: (adminEl?.value ?? "").trim()
    };
  }

  function getMetaValues() {
    const displayGroup = (document.getElementById("displayGroup")?.value ?? "").toString().trim();
    const category = (document.getElementById("category")?.value ?? "").toString().trim();
    return { displayGroup, category };
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
    btn.className = "btn-tocms";
    btn.textContent = "toCMS";
    btn.title = "CMSへ流し込み";

    // 「変換」の左に差し込む
    actions.insertBefore(btn, convertBtn);

    btn.addEventListener("click", async (e) => {
      e.preventDefault();

      const { title, admin } = getOutputs(setEl);
      const { displayGroup, category } = getMetaValues();

      if (!title && !admin && !displayGroup && !category) {
        // 何も無いなら何もしない（うるさくしない）
        return;
      }

      try {
        const res = await chrome.runtime.sendMessage({
          type: MSG_TYPE,
          fields: {
            title,
            admin,
            displayGroup,
            category
          }
        });

        // YokoApp側のダイアログは「CMSが見つからない時だけ」
        if (!res || !res.ok) {
          if (res?.code === "CMS_NOT_FOUND") {
            alert(res.error);
          } else {
            // 通常失敗は黙ってコンソールだけ（必要なら後で方針変更）
            console.warn("[toCMS] failed:", res?.error || res);
          }
        }
      } catch (err) {
        // ここは「拡張側が受けてない」等なので、CMS見つからない扱いに寄せる
        console.warn("[toCMS] send failed:", err);
        alert("CMS側の受け口が見つかりません。（拡張機能を再読み込み→CMSタブを再読み込みしてください）");
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

  // SPA/DOM差し替え対策（最小）
  const mo = new MutationObserver(() => boot());
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
