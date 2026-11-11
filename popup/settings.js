// Settings for the popup (popup.html) and the settings page (options.html). Inputs and segmented button groups
// carry data-key matching a key in YTF.DEFAULTS and save on change. A group with data-switch also drives an
// on/off key: its "off" button turns that key off (speed, quality, per row). A change made in one window
// shows up in the other right away.
(async function () {
  "use strict";
  const Y = globalThis.YTF;
  const settings = { ...Y.DEFAULTS, ...(await browser.storage.local.get(Y.DEFAULTS)) };
  const moved = Y.migrateKeepOnly(settings);
  if (moved) {
    Object.assign(settings, moved);
    await browser.storage.local.set(moved);
  }

  const stats = document.getElementById("stats");
  const save = async (patch) => {
    Object.assign(settings, patch);
    await browser.storage.local.set(patch);
    document.body.classList.toggle("off", !settings.enabled);
    if (stats) setTimeout(showStats, 300);
  };

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
  // A checkbox with data-on / data-off stores those values in place of true / false (the Black theme switch).
  function read(el) {
    if (el.type === "checkbox") return "on" in el.dataset ? (el.checked ? el.dataset.on : el.dataset.off) : el.checked;
    if (el.type === "number") {
      const n = Number(el.value);
      if (el.value === "" || !Number.isFinite(n)) return settings[el.dataset.key];
      const min = el.min === "" ? -Infinity : Number(el.min);
      const max = el.max === "" ? Infinity : Number(el.max);
      return Math.min(max, Math.max(min, Math.round(n)));
    }
    return el.value;
  }

  const inputs = [...document.querySelectorAll("input[data-key], select[data-key], textarea[data-key]")];
  function paintInput(el) {
    const v = settings[el.dataset.key];
    if (el.type === "checkbox") el.checked = "on" in el.dataset ? v === el.dataset.on : v;
    else if (el.value !== String(v)) el.value = v;
    if (el.type === "range") showValue(el);
    if (el.tagName === "TEXTAREA") fit(el);
    if (el.dataset.key === "blockWords") readBack(el);
  }

  // A slider shows its value next to it, as "1.25×".
  function showValue(el) {
    const out = document.querySelector(`output[data-for="${el.dataset.key}"]`);
    if (out) out.textContent = Number(el.value) + "×";
  }

  for (const el of inputs) {
    paintInput(el);
    if (el.type === "range") el.addEventListener("input", () => showValue(el));
    if (el.tagName === "TEXTAREA") el.addEventListener("input", () => fit(el));
    if (el.dataset.key === "blockWords") el.addEventListener("input", () => readBack(el));
    el.addEventListener("change", () => {
      const v = read(el);
      if (el.type === "number") el.value = v; // show the clamped value
      save({ [el.dataset.key]: v });
    });
    // Typed text, a dragged colour or slider are saved while they change too: the popup can close before "change" fires.
    if (el.tagName === "TEXTAREA" || el.type === "number" || el.type === "color" || el.type === "range") {
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
  const segPainters = [];
  for (const seg of document.querySelectorAll(".seg[data-key]")) {
    const { key, switch: onKey } = seg.dataset;
    const buttons = [...seg.querySelectorAll("button")];
    const current = () => (onKey && !settings[onKey] ? "off" : String(settings[key]));
    const paint = () => buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === current())));
    paint();
    segPainters.push(paint);
    seg.addEventListener("click", async (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      const value = b.dataset.value;
      const patch = {};
      if (onKey) patch[onKey] = value !== "off";
      if (value !== "off" || !onKey) patch[key] = "number" in seg.dataset ? Number(value) : value;
      await save(patch);
      paintAll();
    });
  }

  function paintAll() {
    for (const el of inputs) if (el !== document.activeElement) paintInput(el);
    segPainters.forEach((paint) => paint());
    document.body.classList.toggle("off", !settings.enabled);
  }

  // The other window (popup or settings page) changed something: show it here.
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    let mine = false;
    for (const [key, { newValue }] of Object.entries(changes)) {
      if (!(key in Y.DEFAULTS)) continue;
      settings[key] = newValue === undefined ? Y.DEFAULTS[key] : newValue;
      mine = true;
    }
    if (mine) paintAll();
  });

  document.body.classList.toggle("off", !settings.enabled);

  // --- Popup: All settings opens the settings page in a tab -----------------------------------
  const openAll = document.getElementById("open-settings");
  if (openAll) {
    openAll.addEventListener("click", async () => {
      await browser.runtime.openOptionsPage();
      window.close();
    });
  }

  // --- Settings page: the section list marks the section in view ------------------------------
  const links = [...document.querySelectorAll(".toc a")];
  if (links.length) {
    const byId = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
    const mark = (id) => links.forEach((a) => a.setAttribute("aria-current", String(a === byId.get(id))));
    const seen = new Map();
    const watch = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target.id, e.isIntersecting);
      const first = [...byId.keys()].find((id) => seen.get(id));
      if (first) mark(first);
    }, { rootMargin: "-10% 0px -60% 0px" });
    for (const id of byId.keys()) watch.observe(document.getElementById(id));
    // A short last section never reaches the band above: at the bottom of the page, mark it.
    const last = links[links.length - 1].getAttribute("href").slice(1);
    addEventListener("scroll", () => {
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) mark(last);
    }, { passive: true });
    for (const a of links) a.addEventListener("click", () => setTimeout(() => mark(a.getAttribute("href").slice(1)), 600));
    mark(links[0].getAttribute("href").slice(1));
  }

  // --- Popup: hidden count --------------------------------------------------------------------
  async function showStats() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    let res = null;
    try {
      res = await browser.tabs.sendMessage(tab.id, { type: "ytf-stats" });
    } catch {
      // Not a YouTube tab: no content script to answer.
    }
    // The count only makes sense on a page the filters work on; elsewhere it stays hidden.
    stats.hidden = !res || !res.active;
    if (stats.hidden) return;
    const parts = Object.entries(res.counts).sort((a, b) => b[1] - a[1]);
    const total = parts.reduce((sum, [, n]) => sum + n, 0);
    stats.replaceChildren(make("b", "", String(total)), " hidden on this page");
    stats.title = parts.map(([k, n]) => `${Y.REASONS[k]}: ${n}`).join("\n");
  }

  if (stats) showStats();
})();
