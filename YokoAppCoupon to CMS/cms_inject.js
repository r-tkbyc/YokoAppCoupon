(() => {
  const MSG_TYPE = "YK_COUPON_TO_CMS";
  const PAGE_PREFIX = "https://front-admin.taspapp.takashimaya.co.jp/store-coupons/new";

  function isTargetPage() {
    return location.href.startsWith(PAGE_PREFIX);
  }

  function normalizeLabelText(s) {
    return String(s || "")
      .replace(/\s+/g, "")
      .replace(/[*＊]/g, "")
      .replace(/[：:]/g, "");
  }

  function findInputByLabelText(labelText) {
    const want = normalizeLabelText(labelText);
    const labels = Array.from(document.querySelectorAll("label[for]"));
    for (const lab of labels) {
      const t = normalizeLabelText(lab.textContent);
      if (t === want) {
        const id = lab.getAttribute("for");
        if (!id) continue;
        const el = document.getElementById(id);
        if (el && el.tagName === "INPUT") return el;
      }
    }
    return null;
  }

  function setNativeValue(input, value) {
    const setter =
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set ||
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")?.set;

    if (setter) setter.call(input, value);
    else input.value = value;

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function ensureToast() {
    let el = document.getElementById("__yk_toast");
    if (el) return el;

    el = document.createElement("div");
    el.id = "__yk_toast";
    el.style.cssText = [
      "position:fixed",
      "left:50%",
      "bottom:24px",
      "transform:translateX(-50%)",
      "background:rgba(30,30,30,.95)",
      "border:1px solid #3b3b3b",
      "color:#dedede",
      "font-size:12px",
      "padding:8px 10px",
      "border-radius:8px",
      "z-index:2147483647",
      "opacity:0",
      "pointer-events:none",
      "transition:opacity .2s ease"
    ].join(";");
    document.body.appendChild(el);
    return el;
  }

  function toast(msg) {
    const el = ensureToast();
    el.textContent = msg;
    el.style.opacity = "1";
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (el.style.opacity = "0"), 1400);
  }

  function safeFillText(label, value) {
    const input = findInputByLabelText(label);
    if (!input) return { ok: false, reason: `${label}欄が見つかりません` };

    const current = (input.value || "").trim();
    if (current) return { ok: false, reason: `${label}欄は既に入力済み（未上書き）` };

    setNativeValue(input, value);
    return { ok: true };
  }

  function visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  async function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function safePickMantineSelect(label, value) {
    if (!value) return { ok: false, reason: `${label}が空（送信値なし）` };

    const input = findInputByLabelText(label);
    if (!input) return { ok: false, reason: `${label}欄が見つかりません` };

    const current = (input.value || "").trim();
    if (current) return { ok: false, reason: `${label}は既に選択済み（未上書き）` };

    // 1) クリックでドロップダウンを開く
    input.focus();
    input.click();
    input.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await sleep(80);

    // 2) listboxを探して、該当項目をクリック
    for (let i = 0; i < 12; i++) {
      const listboxes = Array.from(document.querySelectorAll('[role="listbox"]')).filter(visible);
      const box = listboxes[0];

      if (box) {
        const opts = Array.from(
          box.querySelectorAll('[role="option"], [data-combobox-option], div, li')
        ).filter(visible);

        const hit = opts.find((n) => (n.textContent || "").trim() === value);
        if (hit) {
          hit.click();
          await sleep(80);

          const after = (input.value || "").trim();
          if (after) return { ok: true };
        }
      }

      await sleep(80);
    }

    // 3) 最後の手段：値だけ入れてイベント（選択として扱われない場合もある）
    setNativeValue(input, value);
    return { ok: (input.value || "").trim() === value, reason: "候補クリックは失敗（フォールバック入力）" };
  }

  chrome.runtime.onMessage.addListener((msg) => {
    try {
      if (!msg || msg.type !== MSG_TYPE) return;
      if (!isTargetPage()) return;

      const fields = msg.fields || {};
      const title = String(fields.title || "").trim();
      const adminName = String(fields.adminName || "").trim();
      const displayGroup = String(fields.displayGroup || "").trim();
      const category = String(fields.category || "").trim();

      const done = [];
      const skipped = [];

      if (title) {
        const r = safeFillText("タイトル", title);
        if (r.ok) done.push("タイトル");
        else skipped.push(r.reason);
      }

      if (adminName) {
        const r = safeFillText("管理名称", adminName);
        if (r.ok) done.push("管理名称");
        else skipped.push(r.reason);
      }

      // Mantine Select
      (async () => {
        if (displayGroup) {
          const r = await safePickMantineSelect("表示グループ", displayGroup);
          if (r.ok) done.push("表示グループ");
          else skipped.push(r.reason);
        }

        if (category) {
          const r = await safePickMantineSelect("カテゴリ", category);
          if (r.ok) done.push("カテゴリ");
          else skipped.push(r.reason);
        }

        if (done.length) {
          toast(`入力完了：${done.join(" / ")}`);
        } else {
          toast("未入力（既に入力済み or 欄が未検出）");
          if (skipped.length) console.warn("[cms_inject] skipped:", skipped);
        }
      })();
    } catch (e) {
      console.warn("[cms_inject]", e);
      toast("入力失敗（コンソール確認）");
    }
  });
})();
