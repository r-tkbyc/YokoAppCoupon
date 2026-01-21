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
      .replace(/[：:]/g, "");  // 念のため
  }

  function findInputByLabelText(labelText) {
    const want = normalizeLabelText(labelText);

    // label[for] → input#id で特定（あなたのDOM断片に一致）
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

    // フォールバック：placeholder
    const byPh = document.querySelector('input[placeholder="タイトル"]');
    if (byPh) return byPh;

    return null;
  }

  function setNativeValue(input, value) {
    // Reactに確実に認識させる定番手法
    const setter =
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set ||
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")?.set;
  
    if (setter) setter.call(input, value);
    else input.value = value;
  
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  

  function safeFillTitle(titleValue) {
    const input = findInputByLabelText("タイトル");
    if (!input) return { filled: false, reason: "タイトル欄が見つかりません" };

    const current = (input.value || "").trim();
    if (current) return { filled: false, reason: "タイトル欄が既に入力済みです（安全のため未上書き）" };

    setNativeValue(input, titleValue);
    return { filled: true };
  }

  chrome.runtime.onMessage.addListener((msg) => {
    try {
      if (!msg || msg.type !== MSG_TYPE) return;
      if (!isTargetPage()) return;

      const title = (msg.fields?.title ?? "").trim();
      if (!title) return;

      const res = safeFillTitle(title);

      if (res.filled) {
        alert("入力完了：タイトル");
      } else if (res.reason) {
        alert(`未入力：${res.reason}`);
      }
    } catch (e) {
      console.warn("[cms_inject]", e);
      alert("入力失敗（コンソール確認）");
    }
  });
})();
