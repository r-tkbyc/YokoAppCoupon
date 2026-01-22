// background.js (MV3 service worker)

const CMS_NEW_URL = "https://front-admin.taspapp.takashimaya.co.jp/store-coupons/new";

function isCmsNewTab(tab) {
  if (!tab || !tab.url) return false;
  return tab.url.startsWith(CMS_NEW_URL);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== "YOKO_TO_CMS") return;

  (async () => {
    try {
      const tabs = await chrome.tabs.query({ url: "https://front-admin.taspapp.takashimaya.co.jp/store-coupons/*" });
      const candidates = tabs.filter(isCmsNewTab);

      if (!candidates.length) {
        sendResponse({ ok: false, reason: "CMS_TAB_NOT_FOUND" });
        return;
      }

      // lastAccessed 優先
      candidates.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
      const target = candidates[0];

      await chrome.tabs.sendMessage(target.id, {
        type: "APPLY_TO_CMS",
        payload: msg.payload
      });

      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, reason: "SEND_FAILED", error: String(e && e.message ? e.message : e) });
    }
  })();

  return true; // async
});
