const MSG_TYPE = "YK_COUPON_TO_CMS";

// CMSタブ探索は “/store-coupons” 配下を広く拾う
const CMS_URL_PATTERN = "https://front-admin.taspapp.takashimaya.co.jp/store-coupons*";

function pickBestCmsTab(tabs) {
  if (!tabs || tabs.length === 0) return null;

  // 1) アクティブ優先
  const active = tabs.find(t => t.active && t.windowId != null);
  if (active) return active;

  // 2) それ以外は先頭
  return tabs[0];
}

async function trySendToTab(tabId, msg) {
  return await chrome.tabs.sendMessage(tabId, msg);
}

async function ensureCmsReceiver(tabId) {
  // content_script が載ってない時の救済：cms_inject.js を注入
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["cms_inject.js"]
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (!msg || msg.type !== MSG_TYPE) return;

      const tabs = await chrome.tabs.query({ url: CMS_URL_PATTERN });
      const targetTab = pickBestCmsTab(tabs);

      if (!targetTab?.id) {
        sendResponse({ ok: false, code: "CMS_NOT_FOUND", error: "CMSタブが見つかりません。（/store-coupons を開いてください）" });
        return;
      }

      try {
        const res = await trySendToTab(targetTab.id, msg);
        sendResponse(res ?? { ok: true });
        return;
      } catch (e) {
        const emsg = String(e?.message || e);

        // “Receiving end does not exist” 系なら注入してリトライ
        if (emsg.includes("Receiving end does not exist") || emsg.includes("Could not establish connection")) {
          await ensureCmsReceiver(targetTab.id);
          const res2 = await trySendToTab(targetTab.id, msg);
          sendResponse(res2 ?? { ok: true });
          return;
        }

        sendResponse({ ok: false, code: "SEND_FAILED", error: emsg });
        return;
      }
    } catch (e) {
      sendResponse({ ok: false, code: "BG_ERROR", error: String(e?.message || e) });
    }
  })();

  return true;
});
