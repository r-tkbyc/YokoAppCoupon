(() => {
  const MSG_TYPE = "YK_COUPON_TO_CMS";

  // -----------------------------
  // helpers
  // -----------------------------
  const $ = (sel, root = document) => root.querySelector(sel);

  function cleanNum(v){
    const s = (v ?? "").toString().trim();
    const n = s.replace(/[^\d]/g, "");
    // 0 は空扱い
    if (!n) return "";
    if (Number(n) <= 0) return "";
    return String(Number(n));
  }

  function pickValueByIds(ids){
    for (const id of ids){
      const el = document.getElementById(id);
      if (!el) continue;
      const v = (el.value ?? "").toString();
      if (v.trim()) return v;
    }
    return "";
  }

  function insertToCMSButton(){
    const titleSet = document.querySelector('.set[data-set="title"]');
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
    const titleSet = document.querySelector('.set[data-set="title"]');
    const outTitle = $(".output-title", titleSet)?.value ?? "";
    const outAdmin = $(".output-admin", titleSet)?.value ?? "";

    // メタ
    const division = ($("#division")?.value ?? "").toString().trim();
    const firstCome = cleanNum($("#firstCome")?.value ?? "");
    const displayGroup = ($("#displayGroup")?.value ?? "").toString().trim();
    const category = ($("#category")?.value ?? "").toString().trim();

    // フロア・ブランド（出力＝変換結果を送る）
    const fbSet = document.querySelector('.set[data-set="floor-brand"]');
    const brandFloor = $(".output-floor", fbSet)?.value ?? "";
    const brandName  = $(".output-brand", fbSet)?.value ?? "";

    // ご利用条件 / 注意事項（出力から取る）
    const termsSet = document.querySelector('.set[data-set="terms"]');
    const notesSet = document.querySelector('.set[data-set="notes"]');
    const terms = $(".output-terms", termsSet)?.value ?? "";
    const notes = $(".output-notes", notesSet)?.value ?? "";

    // 日時設定（出力から取る：IDは環境差に備えて候補を持つ）
    // - 利用可能期間（開始）: 10:00 付与済みの出力
    // - 公開/利用可能期間（終了）: 20:00 付与済みの出力（共通）
    // - 公開期間（開始）: 配布希望日時 or 開始日時-1日 17:00 の出力
    const usableStart = pickValueByIds(["dtUseStartOut","dtAvailStartOut","dtUsableStartOut","dtUseStart","dtAvailStart","dtStartOutUse"]);
    const publishStart = pickValueByIds(["dtPubStartOut","dtPublishStartOut","dtPublicStartOut","dtPubStart","dtStartOutPub","dtStartOutPublic"]);
    const endBoth = pickValueByIds(["dtEndOut","dtEndOutBoth","dtBothEndOut","dtPubEndOut","dtUsableEndOut","dtAvailEndOut","dtEndOutAll"]);

    // 配布方法（select）
    const distributionMethod = ($("#distributionMethod")?.value ?? "").toString().trim();

    // クーポン利用条件（ID直取りで安定化）
    let perUser = cleanNum($("#perMemberLimit")?.value ?? "");
    perUser = perUser || "1"; // 空なら1（保険）

    const totalCount = cleanNum($("#overallTotal")?.value ?? "");
    const overallLimit = ($("#overallLimit")?.value ?? "").toString().trim(); // "あり" | "なし"
    const totalLimitEnabled = (overallLimit === "あり") || !!totalCount;

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

        publishStart,
        publishEnd: endBoth,
        usableStart,
        usableEnd: endBoth,
        distributionMethod,

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
