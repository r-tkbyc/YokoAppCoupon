(() => {
  const MSG_TYPE = "YK_COUPON_TO_CMS";
  const PAGE_PREFIX = "https://front-admin.taspapp.takashimaya.co.jp/store-coupons/new";

  function log(...args) { console.log("[cms_inject]", ...args); }
  function warn(...args) { console.warn("[cms_inject]", ...args); }

  function isOnTargetPage() {
    return location.href.startsWith(PAGE_PREFIX);
  }

  function normalizeLabelText(s) {
    return (s || "")
      .replace(/[\u00A0\u3000]/g, " ")
      .replace(/\*/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function findInputByLabelText(labelText) {
    const want = normalizeLabelText(labelText);

    // Mantineの label[for] -> input#id を優先
    const labels = Array.from(document.querySelectorAll("label"));
    for (const lab of labels) {
      const t = normalizeLabelText(lab.textContent);
      if (t !== want) continue;

      const forId = lab.getAttribute("for");
      if (forId) {
        const el = document.getElementById(forId);
        if (el) return el;
      }

      // fallback: 近傍から探す
      const root = lab.closest(".mantine-InputWrapper-root") || lab.parentElement;
      if (root) {
        const input = root.querySelector("input, textarea, select");
        if (input) return input;
      }
    }

    // 最後のfallback：placeholder
    const byPh = document.querySelector(`input[placeholder="${labelText}"]`);
    return byPh || null;
  }

  function setNativeValue(el, value) {
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc?.set) desc.set.call(el, value);
    else el.value = value;
  }

  function dispatchInputEvents(el) {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  async function selectMantineOptionByText(inputEl, optionText) {
    const want = normalizeLabelText(optionText);
    if (!want) return false;

    // クリックしてドロップダウンを出す
    try {
      inputEl.scrollIntoView({ block: "center" });
    } catch {}
    inputEl.focus();
    inputEl.click();

    // typeahead：値を入れて候補を出す
    setNativeValue(inputEl, optionText);
    dispatchInputEvents(inputEl);

    // 候補の描画を少し待つ（Mantineはportalでbody直下に出ることが多い）
    await sleep(80);

    // role=option を優先
    const optionEls = Array.from(document.querySelectorAll('[role="option"], [data-combobox-option], [data-combobox-option-value]'));
    const hit = optionEls.find(el => normalizeLabelText(el.textContent) === want);

    if (hit) {
      hit.scrollIntoView?.({ block: "nearest" });
      hit.click();
      await sleep(30);
      return normalizeLabelText(inputEl.value) === want;
    }

    // それでも見つからない場合：Enter確定を試す
    const evDown = new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true });
    const evUp = new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true });
    inputEl.dispatchEvent(evDown);
    inputEl.dispatchEvent(evUp);
    await sleep(50);

    // 反映されていれば成功扱い（完全一致でなくても、値が入っていればOKにする）
    return normalizeLabelText(inputEl.value).length > 0;
  }

  async function safeFillTextByLabel(label, value, doneList) {
    const v = (value || "").trim();
    if (!v) return;

    const el = findInputByLabelText(label);
    if (!el) {
      warn("input not found:", label);
      return;
    }
    if ((el.value || "").trim() !== "") return; // 空欄のみ

    setNativeValue(el, v);
    dispatchInputEvents(el);
    doneList.push(label);
  }

  async function safeSelectByLabel(label, value, doneList) {
    const v = (value || "").trim();
    if (!v) return;

    const el = findInputByLabelText(label);
    if (!el) {
      warn("select input not found:", label);
      return;
    }
    if ((el.value || "").trim() !== "") return; // 既に入ってるなら触らない

    const ok = await selectMantineOptionByText(el, v);
    if (ok) doneList.push(label);
    else warn("select failed:", label, v);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (!isOnTargetPage()) return;
    if (!msg || msg.__type !== MSG_TYPE) return;

    (async () => {
      log("received", msg);

      const done = [];

      // テキスト
      await safeFillTextByLabel("タイトル", msg.title, done);
      await safeFillTextByLabel("管理名称", msg.admin_name, done);

      // セレクト（Mantine Select）
      await safeSelectByLabel("表示グループ", msg.display_group, done);
      await safeSelectByLabel("カテゴリ", msg.category, done);

      if (done.length > 0) {
        alert(`入力完了：${done.join(" / ")}`);
      } else {
        alert("入力対象がありません（または既に入力済みです）");
      }
    })();
  });

  log("cms_inject loaded");
})();
