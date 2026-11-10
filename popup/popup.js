// Settings popup. Inputs and segmented button groups carry data-key matching a key in YTF.DEFAULTS and save on change.
// A group with data-switch also drives an on/off key: its "off" button turns that key off (speed, quality, per row).
(async function () {
  "use strict";
  const Y = globalThis.YTF;
  const settings = { ...Y.DEFAULTS, ...(await browser.storage.local.get(Y.DEFAULTS)) };
  const moved = Y.migrateKeepOnly(settings);
  if (moved) {
    Object.assign(settings, moved);
    await browser.storage.local.set(moved);
  }

  const save = async (patch) => {
    Object.assign(settings, patch);
    await browser.storage.local.set(patch);
    document.body.classList.toggle("off", !settings.enabled);
    setTimeout(showStats, 300);
  };

  // --- Tabs (the last one used is remembered on this computer) -------------------------------
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  function selectTab(tab) {
    for (const t of tabs) {
      t.setAttribute("aria-selected", String(t === tab));
      t.tabIndex = t === tab ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = t !== tab;
    }
    document.querySelector(".panes").scrollTop = 0;
    document.querySelectorAll("textarea").forEach(fit); // boxes in a hidden tab had no size yet
    try {
      localStorage.setItem("ytf-tab", tab.id);
    } catch {
      // storage blocked: the popup just opens on the first tab
    }
  }
  for (const t of tabs) {
    t.addEventListener("click", () => selectTab(t));
    t.addEventListener("keydown", (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      const next = tabs[(tabs.indexOf(t) + step + tabs.length) % tabs.length];
      selectTab(next);
      next.focus();
    });
  }

  // --- Text boxes grow with their text --------------------------------------------------------
  function fit(el) {
    if (el.offsetParent === null) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + 2 + "px";
  }

  // --- Filter out: read each rule back in plain words, with a warning under a line typed wrong -------
  const readBox = document.getElementById("filter-read");
  const make = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls, textContent: text });
  const SVG = "http://www.w3.org/2000/svg";
  function icon(id) {
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS(SVG, "use");
    use.setAttribute("href", "#" + id);
    svg.append(use);
    return svg;
  }
  function readBack(el) {
    const warnings = new Map();
    for (const w of Y.checkTitleRules(el.value)) {
      const m = /^Line (\d+): /.exec(w);
      if (m) warnings.set(Number(m[1]), w);
    }
    const out = [];
    el.value.split("\n").forEach((line, i) => {
      const rule = Y.parseTitleRules(line)[0];
      if (rule) {
        const row = make("div", "rl", "");
        row.append(
          make("span", "tag " + (rule.only ? "show" : "hide"), rule.only ? "Show only" : "Hide"),
          make("span", "who", rule.channel || "Any channel"),
          make("span", "what", rule.words.join(", "))
        );
        out.push(row);
      }
      const w = warnings.get(i + 1);
      if (w) {
        const box = make("div", "warnbox", "");
        box.append(icon("i-warn"), make("span", "", w));
        out.push(box);
      }
    });
    readBox.replaceChildren(...out);
    el.setAttribute("aria-invalid", warnings.size ? "true" : "false");
  }

  // --- Inputs ---------------------------------------------------------------------------------
  // A number box keeps to its min and max (the browser does not enforce them outside a form).
  // An empty or broken value falls back to the saved one.
  function read(el) {
    if (el.type === "checkbox") return el.checked;
    if (el.type === "number") {
      const n = Number(el.value);
      if (el.value === "" || !Number.isFinite(n)) return settings[el.dataset.key];
      const min = el.min === "" ? -Infinity : Number(el.min);
      const max = el.max === "" ? Infinity : Number(el.max);
      return Math.min(max, Math.max(min, Math.round(n)));
    }
    return el.value;
  }

  for (const el of document.querySelectorAll("input[data-key], select[data-key], textarea[data-key]")) {
    const v = settings[el.dataset.key];
    if (el.type === "checkbox") el.checked = v;
    else el.value = v;
    if (el.tagName === "TEXTAREA") el.addEventListener("input", () => fit(el));
    if (el.dataset.key === "blockWords") {
      readBack(el);
      el.addEventListener("input", () => readBack(el));
    }
    el.addEventListener("change", () => {
      const v = read(el);
      if (el.type === "number") el.value = v; // show the clamped value
      save({ [el.dataset.key]: v });
    });
    // Typed text is saved while typing too: the popup can close before "change" fires.
    if (el.tagName === "TEXTAREA" || el.type === "number") {
      let t = 0;
      el.addEventListener("input", () => {
        clearTimeout(t);
        t = setTimeout(() => {
          if (el.type === "number" && (el.value === "" || !Number.isFinite(Number(el.value)))) return;
          save({ [el.dataset.key]: read(el) });
        }, 300);
      });
    }
  }

  // --- Segmented button groups ----------------------------------------------------------------
  for (const seg of document.querySelectorAll(".seg[data-key]")) {
    const { key, switch: onKey } = seg.dataset;
    const buttons = [...seg.querySelectorAll("button")];
    const current = () => (onKey && !settings[onKey] ? "off" : String(settings[key]));
    const paint = () => buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === current())));
    paint();
    seg.addEventListener("click", async (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      const value = b.dataset.value;
      const patch = {};
      if (onKey) patch[onKey] = value !== "off";
      if (value !== "off") patch[key] = "number" in seg.dataset ? Number(value) : value;
      await save(patch);
      paint();
    });
  }

  document.body.classList.toggle("off", !settings.enabled);
  let saved = null;
  try {
    saved = localStorage.getItem("ytf-tab");
  } catch {
    // storage blocked
  }
  selectTab(document.getElementById(saved) || tabs[0]);

  // --- Hidden count ---------------------------------------------------------------------------
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
    footer.replaceChildren(make("b", "", String(total)), " hidden on this page");
    footer.title = parts.map(([k, n]) => `${Y.REASONS[k]}: ${n}`).join("\n");
  }

  showStats();
})();
