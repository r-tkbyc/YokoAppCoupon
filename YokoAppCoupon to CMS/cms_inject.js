(() => {
  const MSG_TYPE = "YK_COUPON_TO_CMS";
  const PAGE_PREFIX = "https://front-admin.taspapp.takashimaya.co.jp/store-coupons/new";

  function isTargetPage() {
    return location.href.startsWith(PAGE_PREFIX);
  }

  function normalizeLabelText(s) {
    return String(s || "")
      .replace(/\s+/g, "")
      .replace(/[*＊]/g, "")   // requiredの*を除去
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

  function fillIfEmpty(label, value) {
    const v = (value ?? "").toString().trim();
    if (!v) return { filled: false, reason: "payload empty" };

    const input = findInputByLabelText(label);
    if (!input) return { filled: false, reason: `${label}欄が見つかりません` };

    const current = (input.value || "").toString().trim();
    if (current) return { filled: false, reason: `${label}欄が既に入力済み（未上書き）` };

    setNativeValue(input, v);
    return { filled: true };
  }

  chrome.runtime.onMessage.addListener((msg) => {
    try {
      if (!msg || msg.type !== MSG_TYPE) return;
      if (!isTargetPage()) return;

      const f = msg.fields || {};
      const results = [];

      // タイトル/管理名称
      results.push({ name: "タイトル", ...fillIfEmpty("タイトル", f.title) });
      results.push({ name: "管理名称", ...fillIfEmpty("管理名称", f.admin) });

      // Mantine Selectも「label→input#id」で取れる前提（あなたのDOM断片どおり）
      results.push({ name: "表示グループ", ...fillIfEmpty("表示グループ", f.displayGroup) });
      results.push({ name: "カテゴリ", ...fillIfEmpty("カテゴリ", f.category) });

      const filled = results.filter(r => r.filled).map(r => r.name);

      // 「CMS側だけダイアログ」：1つでも入った時だけ出す（うるさくしない）
      if (filled.length > 0) {
        alert(`入力完了：${filled.join(" / ")}`);
      }
    } catch (e) {
      console.warn("[cms_inject]", e);
      alert("入力失敗（コンソール確認）");
    }
  });
})();
