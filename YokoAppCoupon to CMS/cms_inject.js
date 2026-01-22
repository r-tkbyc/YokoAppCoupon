// CMS side content script
// - Receives payload from background
// - Fills CMS form fields (safe: only fill empty fields)

(() => {
  const MSG_TYPE = "YK_COUPON_TO_CMS";

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function normLabelText(s) {
    return String(s || "")
      .replace(/[\s\u00A0]+/g, "")
      .replace(/[＊*]/g, "")
      .replace(/[！!]/g, "")
      .trim();
  }

  function setNativeValue(el, value) {
    const v = String(value ?? "");
    if (!el) return;

    const proto =
      el.tagName === "TEXTAREA"
        ? window.HTMLTextAreaElement?.prototype
        : window.HTMLInputElement?.prototype;

    const desc = proto ? Object.getOwnPropertyDescriptor(proto, "value") : null;
    const setter = desc?.set;
    if (setter) setter.call(el, v);
    else el.value = v;
  }

  function dispatchInputEvents(el) {
    try {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
    } catch {}
  }

  function fillIfEmpty(el, value) {
    if (!el) return false;
    const cur = String(el.value ?? "").trim();
    if (cur) return false;

    try { el.focus?.(); } catch {}
    setNativeValue(el, value);
    dispatchInputEvents(el);
    try { el.blur?.(); } catch {}
    return true;
  }

  function findControlByLabel(labelText, allowedTags = ["INPUT", "TEXTAREA"]) {
    const target = normLabelText(labelText);
    const labels = Array.from(document.querySelectorAll("label[for]"));

    for (const lab of labels) {
      if (normLabelText(lab.textContent) !== target) continue;
      const id = lab.getAttribute("for");
      if (!id) continue;
      const el = document.getElementById(id);
      if (!el) continue;
      if (!allowedTags.includes(el.tagName)) continue;
      return el;
    }
    return null;
  }

  function findInputByPlaceholder(placeholderText) {
    const p = String(placeholderText || "");
    return (
      document.querySelector(`input[placeholder="${CSS.escape(p)}"]`) ||
      document.querySelector(`textarea[placeholder="${CSS.escape(p)}"]`)
    );
  }

  async function setMantineSelectByLabel(labelText, value) {
    const input = findControlByLabel(labelText, ["INPUT"]);
    if (!input) return false;

    // 既に選択済みなら触らない
    const cur = String(input.value ?? "").trim();
    if (cur) return false;

    // まず開く
    try { input.focus(); } catch {}
    try { input.click(); } catch {}
    await sleep(60);

    const listId = input.getAttribute("aria-controls") || input.getAttribute("aria-owns");
    let list = listId ? document.getElementById(listId) : null;

    if (!list) {
      const lists = Array.from(document.querySelectorAll('[role="listbox"]'));
      list = lists.length ? lists[lists.length - 1] : null;
    }

    if (list) {
      const options = Array.from(list.querySelectorAll('[role="option"]'));
      const opt = options.find((o) => String(o.textContent || "").trim() === String(value || "").trim());
      if (opt) {
        opt.click();
        await sleep(40);
        return true;
      }
    }

    // fallback: 直書き（ダメなら何もしない）
    setNativeValue(input, value);
    dispatchInputEvents(input);
    return true;
  }

  function fillTextByLabelOrPlaceholder(label, value, placeholderFallback) {
    let el = findControlByLabel(label, ["INPUT", "TEXTAREA"]);
    if (!el && placeholderFallback) el = findInputByPlaceholder(placeholderFallback);
    return fillIfEmpty(el, value);
  }

  async function handle(fields) {
    const filled = [];

    // タイトル / 管理名称（label → placeholderフォールバック）
    if (fields.title) {
      if (fillTextByLabelOrPlaceholder("タイトル", fields.title, "タイトル")) filled.push("タイトル");
    }
    if (fields.admin) {
      if (fillTextByLabelOrPlaceholder("管理名称", fields.admin, "管理名称")) filled.push("管理名称");
    }

    // 表示グループ / カテゴリ（Mantine Select想定）
    if (fields.displayGroup) {
      if (await setMantineSelectByLabel("表示グループ", fields.displayGroup)) filled.push("表示グループ");
    }
    if (fields.category) {
      if (await setMantineSelectByLabel("カテゴリ", fields.category)) filled.push("カテゴリ");
    }

    // ここから先は「CMS側のlabelが一致していれば」入る（DOM断片が揃ったら精密化）
    if (fields.brandFloor) {
      if (fillTextByLabelOrPlaceholder("ブランド入居フロア", fields.brandFloor, null)) filled.push("ブランド入居フロア");
    }
    if (fields.brandName) {
      if (fillTextByLabelOrPlaceholder("ブランド名", fields.brandName, null)) filled.push("ブランド名");
    }
    if (fields.terms) {
      if (fillTextByLabelOrPlaceholder("ご利用条件", fields.terms, null)) filled.push("ご利用条件");
    }
    if (fields.notes) {
      if (fillTextByLabelOrPlaceholder("注意事項", fields.notes, null)) filled.push("注意事項");
    }

    // 通知（CMS側だけ）
    if (filled.length) {
      alert(`入力完了：${filled.join(" / ")}`);
    }

    return filled;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== MSG_TYPE) return;

    const fields = msg.fields || {};
    (async () => {
      try {
        const filled = await handle(fields);
        sendResponse({ ok: true, filled });
      } catch (e) {
        console.warn("[CMS] apply failed:", e);
        sendResponse({ ok: true, filled: [] });
      }
    })();

    return true; // async sendResponse
  });
})();
