// Settings popup: every input has data-key matching a key in YTF.DEFAULTS and saves on change.
(async function () {
  "use strict";
  const Y = globalThis.YTF;
  const inputs = [...document.querySelectorAll("[data-key]")];
  const settings = { ...Y.DEFAULTS, ...(await browser.storage.local.get(Y.DEFAULTS)) };
  const moved = Y.migrateKeepOnly(settings);
  if (moved) {
    Object.assign(settings, moved);
    await browser.storage.local.set(moved);
  }

  // Text boxes grow with their text instead of showing a resize handle.
  const fit = (el) => {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + 2 + "px";
  };

  // Lines in the Filter out field that look typed wrong, shown under the field as you type.
  const warn = (el) => {
    const box = document.getElementById("filter-warn");
    const problems = Y.checkTitleRules(el.value);
    box.replaceChildren(...problems.map((p) => Object.assign(document.createElement("span"), { textContent: p })));
    box.hidden = !problems.length;
    el.setAttribute("aria-invalid", problems.length ? "true" : "false");
  };

  function read(el) {
    if (el.type === "checkbox") return el.checked;
    if (el.type === "number") {
      const n = Number(el.value);
      return Number.isFinite(n) && el.value !== "" ? n : Y.DEFAULTS[el.dataset.key];
    }
    return el.value;
  }

  for (const el of inputs) {
    const v = settings[el.dataset.key];
    if (el.type === "checkbox") el.checked = v;
    else el.value = v;
    if (el.tagName === "TEXTAREA") {
      fit(el);
      el.addEventListener("input", () => fit(el));
    }
    if (el.dataset.key === "blockWords") {
      warn(el);
      el.addEventListener("input", () => warn(el));
    }
    el.addEventListener("change", async () => {
      await browser.storage.local.set({ [el.dataset.key]: read(el) });
      document.body.classList.toggle("off", !document.querySelector('[data-key="enabled"]').checked);
      setTimeout(showStats, 300);
    });
  }
  document.body.classList.toggle("off", !settings.enabled);

  async function showStats() {
    const footer = document.getElementById("stats");
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    let res = null;
    try {
      res = await browser.tabs.sendMessage(tab.id, { type: "ytf-stats" });
    } catch {
      // Not a YouTube tab: no content script to answer.
    }
    // The count only makes sense on a page the filters work on; elsewhere the footer stays hidden.
    footer.hidden = !res || !res.active;
    if (footer.hidden) return;
    const parts = Object.entries(res.counts).sort((a, b) => b[1] - a[1]);
    const total = parts.reduce((sum, [, n]) => sum + n, 0);
    footer.replaceChildren();
    const strong = document.createElement("strong");
    strong.textContent = `Hidden here: ${total}`;
    footer.append(strong);
    if (parts.length) footer.append(` (${parts.map(([k, n]) => `${Y.REASONS[k]} ${n}`).join(", ")})`);
  }

  showStats();
})();
