(() => {
  const MSG_TYPE = "YK_COUPON_TO_CMS";

  // -----------------------------
  // helpers
  // -----------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function findSetByTitleText(titleText){
    const sets = $$(".set");
    return sets.find(s => (s.querySelector(".set-title")?.textContent || "").trim() === titleText) || null;
  }

  function findPanelByH2(rootSet, h2Text){
    if (!rootSet) return null;
    const panels = $$(".panel", rootSet);
    return panels.find(p => (p.querySelector("h2")?.textContent || "").trim() === h2Text) || null;
  }

  function readAnyValue(panel){
    if (!panel) return { value: "", el: null };

    const el =
      $("textarea", panel) ||
      $("input", panel) ||
      $("select", panel);

    if (!el) return { value: "", el: null };

    if (el.tagName === "SELECT") return { value: el.value ?? "", el };
    if (el.type === "checkbox" || el.type === "radio") return { value: el.checked ? "1" : "0", el };

    return { value: (el.value ?? "").toString(), el };
  }

  function cleanNum(v){
    const s = (v ?? "").toString().trim();
    const n = s.replace(/[^\d]/g, "");
    // 0 は空扱い
    if (!n) return "";
    if (Number(n) <= 0) return "";
    return String(Number(n));
  }

  function insertToCMSButton(){
    const titleSet = $('.set[data-set="title"]');
    const actions = titleSet ? $(".actions", titleSet) : null;
    if (!actions) return false;

    if ($("#btn-toCMS", actions)) return true;

    const btn = document.createElement("button");
    btn.id = "btn-toCMS";
    btn.textContent = "toCMS";
    btn.title = "CMSへ流し込み";
    // 既存ボタンと同じ見た目（primaryを使わない）
    btn.className = "";

    const convertBtn = $(".btn-convert", actions);
    if (convertBtn) actions.insertBefore(btn, convertBtn);
    else actions.prepend(btn);

    btn.addEventListener("click", onToCMS);
    return true;
  }

  // DOM遅延対策
  function ensureButton(){
    if (insertToCMSButton()) return;
    const mo = new MutationObserver(() => {
      if (insertToCMSButton()) mo.disconnect();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  // -----------------------------
  // main: build payload
  // -----------------------------
  function buildPayload(){
    // タイトル系（出力から取る）
    const titleSet = $('.set[data-set="title"]');
    const outTitle = $(".output-title", titleSet)?.value ?? "";
    const outAdmin = $(".output-admin", titleSet)?.value ?? "";

    // メタ
    const division = ($("#division")?.value ?? "").toString().trim();
    const firstCome = cleanNum($("#firstCome")?.value ?? "");
    const displayGroup = ($("#displayGroup")?.value ?? "").toString().trim();
    const category = ($("#category")?.value ?? "").toString().trim();

    // フロア・ブランド（出力から取る＝変換結果を送る）
    const fbSet = $('.set[data-set="floor-brand"]');
    const brandFloor = $(".output-floor", fbSet)?.value ?? "";
    const brandName = $(".output-brand", fbSet)?.value ?? "";

    // ご利用条件 / 注意事項（出力から取る）
    const termsSet = $('.set[data-set="terms"]');
    const notesSet = $('.set[data-set="notes"]');
    const terms = $(".output-terms", termsSet)?.value ?? "";
    const notes = $(".output-notes", notesSet)?.value ?? "";

    // クーポン利用条件（セットタイトルで探す）
    const couponSet = findSetByTitleText("クーポン利用条件");

    const pPerUser = findPanelByH2(couponSet, "入力（会員ひとりが利用可能な回数）");
    const pToggle  = findPanelByH2(couponSet, "入力（全体の利用回数制限）");
    const pTotal   = findPanelByH2(couponSet, "入力（全体で利用可能な回数）");

    let perUser = readAnyValue(pPerUser).value;
    perUser = cleanNum(perUser) || "1"; // 空なら1（保険）

    // toggle は UI 実装に依存するので、基本は totalCount の有無で判定
    const totalCount = cleanNum(readAnyValue(pTotal).value);
    const totalLimitEnabled = !!totalCount; // 0/空なら false

    return {
      type: MSG_TYPE,
      payload: {
        title: outTitle,
        adminName: outAdmin,

        division,
        firstCome,
        displayGroup,
        category,

        brandFloor,
        brandName,

        terms,
        notes,

        perUser,
        totalLimitEnabled,
        totalCount
      }
    };
  }

  async function onToCMS(){
    const msg = buildPayload();

    // 拡張のコンテキスト保険
    if (!chrome?.runtime?.sendMessage){
      alert("拡張機能のコンテキストが見つかりません。（拡張が有効か確認してください）");
      return;
    }

    try {
      const res = await chrome.runtime.sendMessage(msg);

      // 成功時は何もしない（要求どおり）
      if (!res || res.ok !== true){
        const reason = (res && res.error) ? res.error : "CMS側の受け口が見つかりません。";
        alert(`CMS側の受け口が見つかりません。（拡張機能を再読み込み→CMSタブを再読み込みしてください）\n\n${reason}`);
      }
    } catch (err){
      alert("CMS側の受け口が見つかりません。（拡張機能を再読み込み→CMSタブを再読み込みしてください）");
      console.warn("[toCMS] send failed:", err);
    }
  }

  // init
  ensureButton();
})();
