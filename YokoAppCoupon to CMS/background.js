const CMS_URL_PREFIX = "https://front-admin.taspapp.takashimaya.co.jp/store-coupons/new";
const MSG_TYPE = "YK_COUPON_TO_CMS";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (!msg || msg.type !== MSG_TYPE) return;

      // CMSタブ候補を探す
      const tabs = await chrome.tabs.query({ url: `${CMS_URL_PREFIX}*` });

      if (!tabs || tabs.length === 0) {
        sendResponse({ ok: false, reason: "no_cms_tab", error: "CMSタブが見つかりません（/store-coupons/new を開いてください）" });
        return;
      }

      // lastAccessed が最大のタブを採用（事故防止：最後に触ったタブ）
      const target = tabs.reduce((a, b) => {
        const al = a.lastAccessed ?? 0;
        const bl = b.lastAccessed ?? 0;
        return bl > al ? b : a;
      });

      await chrome.tabs.sendMessage(target.id, msg);

      sendResponse({ ok: true, tabId: target.id });
    } catch (e) {
      console.warn("[background]", e);
      sendResponse({ ok: false, reason: "send_failed", error: String(e?.message || e) });
    }
  })();

  return true; // async
});
