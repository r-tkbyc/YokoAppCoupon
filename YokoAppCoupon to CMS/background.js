const MSG_TYPE = "YK_COUPON_TO_CMS";
const CMS_URL_PREFIX = "https://front-admin.taspapp.takashimaya.co.jp";
const CMS_NEW_PATH = "/store-coupons/new";

function log(...args) { console.log("[background]", ...args); }

async function findBestCmsTab() {
  const tabs = await chrome.tabs.query({ url: CMS_URL_PREFIX + "/*" });
  const candidates = tabs.filter(t => {
    try {
      const u = new URL(t.url);
      return u.origin === CMS_URL_PREFIX && u.pathname === CMS_NEW_PATH;
    } catch {
      return false;
    }
  });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  return candidates[0];
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || msg.__type !== MSG_TYPE) return;

  (async () => {
    const tab = await findBestCmsTab();
    if (!tab?.id) {
      log("CMSタブが見つかりません");
      return;
    }
    log("forward to CMS tab", tab.id, msg);
    chrome.tabs.sendMessage(tab.id, msg);
  })();
});
