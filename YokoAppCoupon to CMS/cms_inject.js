// 横浜CMS（新規クーポン）側 content script
// - background から payload を受け取り、CMSの各フィールドへ入力する
// - 成功時のダイアログは出さない（要件）
// - 失敗時も基本は console のみ（YokoApp側で「受け口がない」ダイアログ）

const MSG_TYPE = 'YK_COUPON_TO_CMS';

(() => {
  const CMS_HOST = 'front-admin.taspapp.takashimaya.co.jp';
  const CMS_PATH_PREFIX = '/admin/store-coupons/new';

  if (location.hostname !== CMS_HOST) return;
  if (!location.pathname.startsWith(CMS_PATH_PREFIX)) return;

  // -----------------------------
  // helpers
  // -----------------------------
  const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

  function dispatchInputEvents(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function findLabelEl(labelText) {
    const want = norm(labelText);
    const labels = Array.from(document.querySelectorAll('label'));
    // exact match first, then includes
    let found = labels.find(l => norm(l.textContent).startsWith(want));
    if (!found) found = labels.find(l => norm(l.textContent).includes(want));
    return found || null;
  }

  function findFieldRootByLabel(labelEl) {
    if (!labelEl) return null;
    // Mantine: label は InputWrapper の中
    // 近い Stack/Wrapper を root にして、その中から input/textarea/prosemirror を探す
    return labelEl.closest('.mantine-InputWrapper-root, .mantine-Stack-root, .mantine-Input-wrapper, div') || labelEl.parentElement;
  }

  function findInputByLabel(labelText) {
    const label = findLabelEl(labelText);
    if (!label) return null;

    const forId = label.getAttribute('for');
    if (forId) {
      const byId = document.getElementById(forId);
      if (byId) return byId;
    }

    const root = findFieldRootByLabel(label);
    if (!root) return null;

    // NumberInput / TextInput
    return root.querySelector('input, textarea') || null;
  }

  function isUntouchedValue(input) {
    const cur = String(input.value ?? '');
    const init = input.getAttribute('value');
    if (init == null) return cur === '';
    return cur === init;
  }

  function setInputValueSmart(input, value, { force = false } = {}) {
    if (!input) return false;
    const v = String(value ?? '');
    if (!force) {
      // 空欄 or 初期値のときだけ上書き
      if (!(String(input.value ?? '') === '' || isUntouchedValue(input))) return false;
    }
    input.focus();
    input.value = v;
    dispatchInputEvents(input);
    input.blur();
    return true;
  }

  function setSelectLikeByLabel(labelText, value) {
    const input = findInputByLabel(labelText);
    if (!input) return false;

    const v = String(value ?? '').trim();
    if (!v) return false;

    // 既に値が入っていて違う場合、初期値なら上書き（Selectは初期値が空が多い）
    const force = String(input.value ?? '') === '' || isUntouchedValue(input);

    if (!force) return false;

    input.focus();
    input.value = v;
    dispatchInputEvents(input);

    // Mantine Combobox: 入力→候補→Enter で確定
    try {
      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' }));
      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
    } catch (_) {}

    input.blur();
    return true;
  }

  // RichTextEditor (tiptap / ProseMirror)
  function findProseMirrorByLabel(labelText) {
    const label = findLabelEl(labelText);
    if (!label) return null;

    const stack = label.closest('.mantine-Stack-root') || label.parentElement;
    if (!stack) return null;

    return stack.querySelector('.mantine-RichTextEditor-root .ProseMirror') || null;
  }

  function proseMirrorIsEmpty(pm) {
    if (!pm) return true;
    return norm(pm.textContent) === '';
  }

  function replaceContentEditableText(el, text) {
    if (!el) return false;
    const v = String(text ?? '');
    if (!v) return false;

    el.focus();

    // select all
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);

    let ok = false;
    try {
      ok = document.execCommand('insertText', false, v);
    } catch (_) {
      ok = false;
    }

    if (!ok) {
      // fallback
      el.textContent = v;
    }

    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: v, inputType: 'insertText' }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
    return true;
  }

  // Switch
  function setSwitchByLabel(labelText, desiredOn) {
    const label = findLabelEl(labelText);
    if (!label) return false;
    const root = findFieldRootByLabel(label);
    if (!root) return false;

    const input = root.querySelector('input[type="checkbox"][role="switch"], input[type="checkbox"]');
    if (!input) return false;

    const want = Boolean(desiredOn);
    const cur = Boolean(input.checked);
    if (cur === want) return true;

    input.focus();
    input.click();
    input.blur();
    return true;
  }

  async function waitFor(fn, { timeoutMs = 2000, intervalMs = 60 } = {}) {
    const t0 = Date.now();
    return new Promise((resolve) => {
      const tick = () => {
        const v = fn();
        if (v) return resolve(v);
        if (Date.now() - t0 > timeoutMs) return resolve(null);
        setTimeout(tick, intervalMs);
      };
      tick();
    });
  }

  // -----------------------------
  // message handling
  // -----------------------------
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== MSG_TYPE) return;

    (async () => {
      const p = msg.payload || {};

      // 既存項目（従来）
      if (p.title) setInputValueSmart(findInputByLabel('タイトル'), p.title);
      if (p.admin) setInputValueSmart(findInputByLabel('管理名称'), p.admin);

      if (p.displayGroup) setSelectLikeByLabel('表示グループ', p.displayGroup);
      if (p.category) setSelectLikeByLabel('カテゴリ', p.category);

      // 追加項目
      if (p.terms) {
        const pm = findProseMirrorByLabel('ご利用条件');
        if (pm && proseMirrorIsEmpty(pm)) replaceContentEditableText(pm, p.terms);
      }
      if (p.notes) {
        const pm = findProseMirrorByLabel('注意事項');
        if (pm && proseMirrorIsEmpty(pm)) replaceContentEditableText(pm, p.notes);
      }

      // 会員ひとりが利用可能な回数（CMSは初期値 1 のため、初期値のままなら上書きOK）
      if (p.coupon?.perUser != null && String(p.coupon.perUser).trim() !== '') {
        const inp = findInputByLabel('会員ひとりが利用可能な回数');
        setInputValueSmart(inp, p.coupon.perUser, { force: isUntouchedValue(inp) || String(inp?.value ?? '') === '' });
      }

      // 全体の利用回数制限（あり/なし）
      if (typeof p.coupon?.allLimitEnabled === 'boolean') {
        setSwitchByLabel('全体の利用回数制限', p.coupon.allLimitEnabled);

        if (p.coupon.allLimitEnabled) {
          // 出現を待つ
          await waitFor(() => findInputByLabel('全体で利用可能な回数'), { timeoutMs: 2500 });

          if (p.coupon.allLimitCount != null && String(p.coupon.allLimitCount).trim() !== '') {
            const inp = findInputByLabel('全体で利用可能な回数');
            setInputValueSmart(inp, p.coupon.allLimitCount, { force: true });
          }
        }
      }

      sendResponse({ ok: true });
    })();

    return true; // async
  });
})();
