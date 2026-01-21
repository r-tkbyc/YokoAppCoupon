(() => {
  const MSG_TYPE = "YK_COUPON_TO_CMS";
  const PAGE_PREFIX = "https://front-admin.taspapp.takashimaya.co.jp/store-coupons/new";

  function isTargetPage() {
    return location.href.startsWith(PAGE_PREFIX);
  }

  function normalizeText(s) {
    return String(s || "")
      .replace(/\s+/g, "")
      .replace(/[*＊]/g, "")
      .replace(/[：:]/g, "");
  }

  function ensureToast() {
    let el = document.getElementById("__yk_tocms_toast");
    if (el) return el;

    el = document.createElement("div");
    el.id = "__yk_tocms_toast";
    el.style.cssText = [
      "position:fixed",
      "left:50%",
      "bottom:24px",
      "transform:translateX(-50%)",
      "background:rgba(20,20,20,.92)",
      "border:1px solid rgba(255,255,255,.18)",
      "color:#fff",
      "padding:10px 14px",
      "border-radius:10px",
      "font-size:12px",
      "z-index:2147483647",
      "opacity:0",
      "pointer-events:none",
      "transition:opacity .2s ease"
    ].join(";");

    document.documentElement.appendChild(el);
    return el;
  }

  function toast(msg) {
    const el = ensureToast();
    el.textContent = msg;
    el.style.opacity = "1";
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (el.style.opacity = "0"), 1400);
  }

  function findInputByLabelText(labelText) {
    const want = normalizeText(labelText);

    // label[for] → #id（Mantineの構造に合わせる）
    const labels = Array.from(document.querySelectorAll("label[for]"));
    for (const lab of labels) {
      const t = normalizeText(lab.textContent);
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
    // React/Mantineに確実に認識させる
    const setter =
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set ||
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")?.set;

    if (setter) setter.call(input, value);
    else input.value = value;

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function findOpenListbox() {
    // Mantine Comboboxの listbox を広めに探索
    return (
      document.querySelector('[role="listbox"]') ||
      document.querySelector('.mantine-Combobox-options') ||
      document.querySelector('.mantine-Select-dropdown')
    );
  }

  async function safeFillText(label, value) {
    const input = findInputByLabelText(label);
    if (!input) return { filled: false, reason: `${label}欄が見つかりません` };

    const current = (input.value || "").trim();
    if (current) return { filled: false, reason: `${label}欄が既に入力済みです（安全のため未上書き）` };

    setNativeValue(input, value);
    return { filled: true };
  }

  async function safeFillSelect(label, value) {
    const input = findInputByLabelText(label);
    if (!input) return { filled: false, reason: `${label}欄が見つかりません` };

    const current = (input.value || "").trim();
    if (current) return { filled: false, reason: `${label}は既に選択済みです（安全のため未上書き）` };

    // クリックして候補を開く
    input.focus();
    input.click();

    // DOMが出るまで少し待つ
    await sleep(60);

    const listbox = findOpenListbox();
    if (!listbox) {
      // 候補DOMが見えない場合は setNativeValue を試す（ダメ元）
      setNativeValue(input, value);
      return { filled: true, fallback: true };
    }

    const want = normalizeText(value);
    const options = Array.from(listbox.querySelectorAll('[role="option"], .mantine-Combobox-option, .mantine-Select-item'));
    const hit = options.find((el) => normalizeText(el.textContent) === want);

    if (!hit) {
      // 候補が見つからない：一旦入力だけは入れる（場合によっては確定されない）
      setNativeValue(input, value);
      // Enterで確定を試す
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
      return { filled: true, fallback: true };
    }

    hit.click();
    return { filled: true };
  }

  chrome.runtime.onMessage.addListener((msg) => {
    (async () => {
      try {
        if (!msg || msg.type !== MSG_TYPE) return;
        if (!isTargetPage()) return;

        const title = (msg.fields?.title ?? "").toString().trim();
        const adminName = (msg.fields?.adminName ?? "").toString().trim();
        const displayGroup = (msg.fields?.displayGroup ?? "").toString().trim();
        const category = (msg.fields?.category ?? "").toString().trim();

        const filled = [];
        const skipped = [];

        // タイトル（必須想定）
        if (title) {
          const r = await safeFillText("タイトル", title);
          if (r.filled) filled.push("タイトル");
          else if (r.reason) skipped.push(r.reason);
        }

        // 管理名称（任意）
        if (adminName) {
          const r = await safeFillText("管理名称", adminName);
          if (r.filled) filled.push("管理名称");
          else if (r.reason) skipped.push(r.reason);
        }

        // 表示グループ（Select）
        if (displayGroup) {
          const r = await safeFillSelect("表示グループ", displayGroup);
          if (r.filled) filled.push("表示グループ");
          else if (r.reason) skipped.push(r.reason);
        }

        // カテゴリ（Select）
        if (category) {
          const r = await safeFillSelect("カテゴリ", category);
          if (r.filled) filled.push("カテゴリ");
          else if (r.reason) skipped.push(r.reason);
        }

        if (filled.length > 0) {
          toast(`入力完了：${filled.join(" / ")}`);
        } else if (skipped.length > 0) {
          toast(`未入力：${skipped[0]}`);
        } else {
          toast("未入力：受信データが空です");
        }
      } catch (e) {
        console.warn("[cms_inject]", e);
        toast("入力失敗（コンソール確認）");
      }
    })();
  });
})();
