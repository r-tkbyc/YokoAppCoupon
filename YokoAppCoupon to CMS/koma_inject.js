// YokoAppCoupon side content script (GitHub Pages)
// - Injects "toCMS" button into the Title block actions
// - Collects converted outputs + selected meta values
// - Sends payload to background -> CMS tab

(() => {
  const MSG_TYPE = "YK_COUPON_TO_CMS";
  const BTN_ID = "yk_toCMS_btn";

  const qs = (sel, root = document) => root.querySelector(sel);
  const trim = (v) => (v == null ? "" : String(v)).trim();

  function collectFields() {
    const fields = {};

    // Title / Admin
    const titleSet = qs('.set[data-set="title"]');
    fields.title = trim(qs('.output-title', titleSet)?.value || qs('.output', titleSet)?.value || "");
    fields.admin = trim(qs('.output-admin', titleSet)?.value || "");

    // Meta
    fields.division = trim(qs('#division')?.value || "");
    fields.firstCome = trim(qs('#firstCome')?.value || "");
    fields.displayGroup = trim(qs('#displayGroup')?.value || "");
    fields.category = trim(qs('#category')?.value || "");

    // Floor / Brand
    const floorSet = qs('.set[data-set="floor-brand"]');
    fields.brandFloor = trim(qs('.output-floor', floorSet)?.value || "");
    fields.brandName = trim(qs('.output-brand', floorSet)?.value || "");

    // Terms / Notes
    const termsSet = qs('.set[data-set="terms"]');
    fields.terms = trim(qs('.output-terms', termsSet)?.value || "");

    const notesSet = qs('.set[data-set="notes"]');
    fields.notes = trim(qs('.output-notes', notesSet)?.value || "");

    return fields;
  }

  function ensureButton() {
    const titleSet = qs('.set[data-set="title"]');
    if (!titleSet) return false;

    const actions = qs('.actions', titleSet);
    if (!actions) return false;

    if (qs(`#${BTN_ID}`, actions)) return true;

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.textContent = 'toCMS';
    btn.title = 'CMSへ流し込み';
    btn.addEventListener('click', onToCMS);

    // Insert left of Convert (if exists)
    const convertBtn = qs('.btn-convert', actions) || actions.querySelector('button');
    actions.insertBefore(btn, convertBtn || actions.firstChild);
    return true;
  }

  async function onToCMS() {
    const fields = collectFields();
    try {
      const resp = await chrome.runtime.sendMessage({ type: MSG_TYPE, fields });
      // ダイアログは「CMSが見つからない時だけ」
      if (!resp || resp.ok !== true) {
        alert('CMS側の受け口が見つかりません。（拡張機能を再読み込み→CMSタブを再読み込みしてください）');
      }
    } catch (err) {
      console.warn('[toCMS] send failed:', err);
      alert('CMS側の受け口が見つかりません。（拡張機能を再読み込み→CMSタブを再読み込みしてください）');
    }
  }

  function boot() {
    try {
      ensureButton();
    } catch (e) {
      console.warn('[toCMS] boot failed:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // Keep it resilient to DOM rewrites (GitHub Pages reload, hot edits, etc.)
  const obs = new MutationObserver(() => boot());
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
