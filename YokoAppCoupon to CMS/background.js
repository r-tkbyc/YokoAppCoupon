const CMS_URL_PREFIX = "https://front-admin.taspapp.takashimaya.co.jp/store-coupons/new";
const MSG_TYPE = "YK_COUPON_TO_CMS";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (!msg || msg.type !== MSG_TYPE) return;

      const tabs = await chrome.tabs.query({ url: `${CMS_URL_PREFIX}*` });

      if (!tabs || tabs.length === 0) {
        throw new Error("CMSタブが見つかりません（/store-coupons/new を開いてください）");
      }

      const target = tabs.reduce((a, b) => {
        const al = a.lastAccessed ?? 0;
        const bl = b.lastAccessed ?? 0;
        return bl > al ? b : a;
      });

      try {
        await chrome.tabs.sendMessage(target.id, msg);
      } catch (err) {
        // ここが「Receiving end does not exist」になりやすい
        const m = String(err?.message || err);
        throw new Error(
          m.includes("Receiving end does not exist")
            ? "CMS側の受け口が見つかりません（拡張機能を再読み込み→CMSタブを再読み込みしてください）"
            : m
        );
      }

      sendResponse({ ok: true, tabId: target.id });
    } catch (e) {
      console.warn("[background]", e);
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
  })();

  return true;
});
