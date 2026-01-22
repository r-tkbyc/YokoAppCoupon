// YokoAppCoupon (GitHub Pages) 側 content script
// - タイトルブロックの actions に toCMS ボタンを挿入
// - クリックで各フィールド値を payload 化し background へ送信
// - CMS タブが見つからない時だけアラート表示

const MSG_TYPE = 'YK_COUPON_TO_CMS';

(() => {
  const TOOL_ORIGIN = 'https://r-tkbyc.github.io';
  const TOOL_PATH_PREFIX = '/YokoAppCoupon/';

  if (location.origin !== TOOL_ORIGIN) return;
  if (!location.pathname.startsWith(TOOL_PATH_PREFIX)) return;

  // -----------------------------
  // helpers
  // -----------------------------
  const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

  function qsAny(selectors, root = document) {
    for (const sel of selectors) {
      const el = root.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function findPanelByHeadingText(headingTextCandidates) {
    const cands = Array.isArray(headingTextCandidates) ? headingTextCandidates : [headingTextCandidates];
    const heads = Array.from(document.querySelectorAll('.panel h2'));
    for (const h of heads) {
      const t = norm(h.textContent);
      for (const cand of cands) {
        if (!cand) continue;
        if (t === cand || t.includes(cand)) {
          return h.closest('.panel');
        }
      }
    }
    return null;
  }

  function readValueFromPanel(panel) {
    if (!panel) return { kind: 'none', value: '' };

    const textarea = panel.querySelector('textarea');
    if (textarea) return { kind: 'text', value: textarea.value ?? '' };

    const input = panel.querySelector('input');
    if (input) {
      if (input.type === 'checkbox') return { kind: 'checkbox', value: input.checked };
      return { kind: 'input', value: input.value ?? '' };
    }

    const select = panel.querySelector('select');
    if (select) return { kind: 'select', value: select.value ?? '' };

    return { kind: 'none', value: '' };
  }

  function buildPayload() {
    const title = (qsAny(['.output-title', 'textarea.output-title', 'textarea.output'])?.value ?? '').trim();
    const admin = (qsAny(['.output-admin', 'textarea.output-admin'])?.value ?? '').trim();

    const displayGroup = (qsAny(['#displayGroup', 'select#displayGroup'])?.value ?? '').trim();
    const category = (qsAny(['#category', 'select#category'])?.value ?? '').trim();

    const floor = (qsAny(['.output-floor', 'textarea.output-floor'])?.value ?? '').trim();
    const brand = (qsAny(['.output-brand', 'textarea.output-brand'])?.value ?? '').trim();

    const terms = (qsAny(['.output-terms', 'textarea.output-terms'])?.value ?? '').trim();
    const notes = (qsAny(['.output-notes', 'textarea.output-notes'])?.value ?? '').trim();

    const pPerUser = findPanelByHeadingText(['会員ひとりが利用可能な回数', '入力（会員ひとりが利用可能な回数）']);
    const perUserVal = readValueFromPanel(pPerUser).value;

    const pAllLimit = findPanelByHeadingText(['全体の利用回数制限', '入力（全体の利用回数制限）']);
    const allLimitRaw = readValueFromPanel(pAllLimit);
    let allLimitEnabled = null;
    if (allLimitRaw.kind === 'checkbox') allLimitEnabled = Boolean(allLimitRaw.value);
    if (allLimitRaw.kind === 'select' || allLimitRaw.kind === 'input') {
      const v = String(allLimitRaw.value ?? '');
      allLimitEnabled = v.includes('あり') || v === 'true' || v === '1';
    }

    const pAllCount = findPanelByHeadingText(['全体で利用可能な回数', '入力（全体で利用可能な回数）']);
    const allLimitCountVal = readValueFromPanel(pAllCount).value;

    return {
      title,
      admin,
      displayGroup,
      category,
      floor,
      brand,
      terms,
      notes,
      coupon: {
        perUser: String(perUserVal ?? '').trim(),
        allLimitEnabled,
        allLimitCount: String(allLimitCountVal ?? '').trim(),
      },
      __meta: {
        sourceUrl: location.href,
        sentAt: Date.now(),
      },
    };
  }

  function showCmsNotFoundDialog() {
    alert('CMS側の受け口が見つかりません。（拡張機能を再読み込み→CMSタブを再読み込みしてください）');
  }

  async function sendToBackground(payload) {
    try {
      const res = await chrome.runtime.sendMessage({ type: MSG_TYPE, payload });
      if (!res || res.ok !== true) {
        if (res?.reason === 'no_cms_tab') showCmsNotFoundDialog();
        console.warn('[toCMS] background response:', res);
        return;
      }
      // 成功時は何も出さない（要件）
    } catch (err) {
      console.warn('[toCMS] send failed:', err);
      showCmsNotFoundDialog();
    }
  }

  function ensureButton() {
    const actions = document.querySelector('.set[data-set="title"] .actions');
    if (!actions) return;

    if (actions.querySelector('.btn-tocms')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-tocms';
    btn.textContent = 'toCMS';
    btn.title = 'CMSへ流し込み';

    btn.addEventListener('click', () => {
      const payload = buildPayload();
      sendToBackground(payload);
    });

    actions.appendChild(btn);
  }

  const boot = () => {
    ensureButton();
    const mo = new MutationObserver(() => ensureButton());
    mo.observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
