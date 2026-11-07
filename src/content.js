// Finds tiles and shelves on the YouTube home page and marks the ones to hide.
// Hiding is a data attribute plus one CSS rule (content.css), so undoing it is just removing the attribute.
(function () {
  "use strict";
  const Y = globalThis.YTF;
  const ATTR = "data-ytf-hidden";

  // Only the home feed; YouTube keeps other pages in their own ytd-browse elements.
  const HOME = 'ytd-browse[page-subtype="home"]';
  const TILE = "ytd-rich-item-renderer";
  const SHELF = "ytd-rich-section-renderer, ytd-reel-shelf-renderer";
  // Old tiles use kebab-case classes, the new yt-lockup-view-model tiles camelCase ("ytContentMetadataViewModelMetadataText").
  const META =
    '#metadata-line span, span.inline-metadata-item, [class*="metadata-text"], [class*="MetadataText"], [class*="metadata-row"] span';
  const BADGE =
    '[class*="badge"], [class*="Badge"], ytd-badge-supported-renderer, badge-shape, ytd-thumbnail-overlay-time-status-renderer';
  const PROGRESS =
    'ytd-thumbnail-overlay-resume-playback-renderer #progress, [class*="WatchedProgressBarSegment"], [class*="ProgressBarSegment"]';

  let settings = { ...Y.DEFAULTS };
  let counts = {};

  const texts = (el, sel) => [...el.querySelectorAll(sel)].map((n) => (n.textContent || "").trim()).filter(Boolean);
  const labels = (el, sel) => [...el.querySelectorAll(sel)].map((n) => n.getAttribute("aria-label")).filter(Boolean);
  // The aria-label holds the full text ("108 avspillinger") where the screen shows a short form ("108").
  const labelsThenTexts = (el, sel) => [...labels(el, sel), ...texts(el, sel)];
  const firstOf = (list, fn) => {
    for (const t of list) {
      const v = fn(t);
      if (v != null) return v;
    }
    return null;
  };

  function tileInfo(tile) {
    const link = tile.querySelector('a[href*="/watch"], a[href*="/shorts/"], a[href*="/playables"], a[href*="list="]');
    let kind = Y.kindFromHref(link && link.getAttribute("href"));
    if (kind === "video" && tile.querySelector("ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2")) kind = "shorts";
    if (kind === "video" && tile.querySelector("yt-collection-thumbnail-view-model, yt-collections-stack, ytd-playlist-thumbnail")) {
      kind = "playlist";
    }

    const meta = labelsThenTexts(tile, META);
    const badges = labelsThenTexts(tile, BADGE);
    const styles = [...tile.querySelectorAll("[overlay-style]")].map((n) => n.getAttribute("overlay-style"));
    const progress = tile.querySelector(PROGRESS);
    const pct = progress ? parseFloat(progress.style.width) : NaN;

    return {
      kind,
      members: badges.some(Y.isMembersOnly) || meta.some(Y.isMembersOnly),
      live: styles.includes("LIVE") || badges.some(Y.isLiveBadge) || meta.some(Y.isWatching),
      upcoming: styles.includes("UPCOMING") || meta.some(Y.isUpcoming) || badges.some(Y.isUpcoming),
      ageDays: firstOf(meta, Y.parseAgeDays),
      views: firstOf(meta, Y.parseViews),
      watchedPct: Number.isFinite(pct) ? pct : null,
    };
  }

  function shelfInfo(shelf) {
    const title = texts(shelf, '#title, #title-text, h2, [class*="shelf-header"] span')[0] || "";
    return {
      title,
      shorts:
        !!shelf.querySelector('ytd-rich-shelf-renderer[is-shorts], a[href*="/shorts/"], ytm-shorts-lockup-view-model') ||
        shelf.matches("ytd-reel-shelf-renderer"),
      playables: !!shelf.querySelector('a[href*="/playables"]'),
    };
  }

  function mark(el, reason) {
    if (reason) {
      if (el.getAttribute(ATTR) !== reason) el.setAttribute(ATTR, reason);
      counts[reason] = (counts[reason] || 0) + 1;
    } else if (el.hasAttribute(ATTR)) {
      el.removeAttribute(ATTR);
    }
  }

  function run() {
    counts = {};
    // The home feed stays in the DOM while a video plays; skip it then, the player changes text constantly.
    const home = location.pathname === "/" && document.querySelector(HOME);
    if (!home) return;
    for (const shelf of home.querySelectorAll(SHELF)) mark(shelf, Y.decideShelf(shelfInfo(shelf), settings));
    // YouTube recycles tile elements with new videos, so every tile is checked on every pass.
    for (const tile of home.querySelectorAll(TILE)) {
      if (tile.closest(`[${ATTR}]:not(${TILE})`)) continue; // inside a hidden shelf
      mark(tile, Y.decideTile(tileInfo(tile), settings));
    }
  }

  let timer = 0;
  function schedule() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = 0;
      run();
    }, 150);
  }

  async function loadSettings() {
    settings = { ...Y.DEFAULTS, ...(await browser.storage.local.get(Y.DEFAULTS)) };
    schedule();
  }

  browser.storage.onChanged.addListener((_changes, area) => {
    if (area === "local") loadSettings();
  });
  browser.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "ytf-stats") {
      run();
      return Promise.resolve({ home: location.pathname === "/" && !!document.querySelector(HOME), counts });
    }
  });

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  document.addEventListener("yt-navigate-finish", schedule);
  loadSettings();
})();
