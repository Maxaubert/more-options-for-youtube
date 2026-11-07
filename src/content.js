// Finds tiles and shelves on YouTube pages and marks the ones to hide, sets the CSS switches on <html>,
// and runs smart autoplay. Hiding is a data attribute plus one CSS rule (content.css), so undoing it is
// just removing the attribute. Player defaults (speed, quality, theater, subtitles) live in main.js,
// which runs in the page itself; this script hands it the settings through a data attribute.
(function () {
  "use strict";
  const Y = globalThis.YTF;
  const ATTR = "data-ytf-hidden";
  const ROOT = document.documentElement;

  const HOME = 'ytd-browse[page-subtype="home"]';
  // Grid tiles (home, subscriptions), search results, the sidebar next to a video, and the new lockups used everywhere.
  const TILE =
    "ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model";
  const SHELF = "ytd-rich-section-renderer, ytd-reel-shelf-renderer, grid-shelf-view-model, ytd-shelf-renderer";
  // Old tiles use kebab-case classes, the new yt-lockup-view-model tiles camelCase ("ytContentMetadataViewModelMetadataText").
  const META =
    '#metadata-line span, span.inline-metadata-item, [class*="metadata-text"], [class*="MetadataText"], [class*="metadata-row"] span';
  const BADGE =
    '[class*="badge"], [class*="Badge"], ytd-badge-supported-renderer, badge-shape, ytd-thumbnail-overlay-time-status-renderer';
  const PROGRESS =
    'ytd-thumbnail-overlay-resume-playback-renderer #progress, [class*="WatchedProgressBarSegment"], [class*="ProgressBarSegment"]';
  const LINK = 'a[href*="/watch"], a[href*="/shorts/"], a[href*="/playables"], a[href*="list="]';

  let settings = { ...Y.DEFAULTS };
  let counts = {};
  // Smart autoplay memory: videos opened on this computer, and videos YouTube showed with a watched bar.
  const played = new Set();
  const watched = new Set();

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
  const currentId = () => new URLSearchParams(location.search).get("v");

  function tileInfo(tile) {
    const link = tile.querySelector(LINK);
    const href = link && link.getAttribute("href");
    let kind = Y.kindFromHref(href);
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
      id: Y.videoIdFromHref(href),
      link,
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

  // The part of the page to filter, or null. The home feed stays in the DOM while a video plays,
  // so the path decides, not just the element.
  function pageRoot() {
    const p = location.pathname;
    if (p === "/") return document.querySelector(HOME);
    if (!settings.everywhere) return null;
    if (p === "/results") return document.querySelector("ytd-search:not([hidden])");
    if (p === "/feed/subscriptions") return document.querySelector('ytd-browse[page-subtype="subscriptions"]');
    if (p === "/watch") return document.querySelector("ytd-watch-flexy #secondary");
    return null;
  }

  // Only the outermost match: a yt-lockup-view-model inside a ytd-rich-item-renderer is the same video.
  const outermost = (root, sel) => [...root.querySelectorAll(sel)].filter((el) => !el.parentElement.closest(sel));

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
    applySwitches();
    if (settings.enabled && settings.noPreview) {
      for (const v of document.querySelectorAll("ytd-video-preview video, #video-preview video")) if (!v.paused) v.pause();
    }
    const root = pageRoot();
    if (!root) return;
    for (const shelf of outermost(root, SHELF)) mark(shelf, Y.decideShelf(shelfInfo(shelf), settings));
    // YouTube recycles tile elements with new videos, so every tile is checked on every pass.
    for (const tile of outermost(root, TILE)) {
      if (tile.closest(`[${ATTR}]:not(${TILE})`)) continue; // inside a hidden shelf
      const info = tileInfo(tile);
      if (info.id && info.watchedPct != null && info.watchedPct >= settings.watchedPct) remember(watched, "ytfWatched", info.id);
      mark(tile, Y.decideTile(info, settings));
    }
  }

  // CSS switches on <html> (content.css reads them) and the settings for main.js.
  function applySwitches() {
    const on = settings.enabled;
    const flags = {
      "data-ytf-nopreview": on && settings.noPreview,
      "data-ytf-hidetitles": on && settings.hideTitles,
      "data-ytf-hidechannels": on && settings.hideChannels,
      "data-ytf-hidemeta": on && settings.hideMeta,
      "data-ytf-perrow": on && settings.perRow,
    };
    for (const [name, value] of Object.entries(flags)) {
      if (value && !ROOT.hasAttribute(name)) ROOT.setAttribute(name, "");
      if (!value && ROOT.hasAttribute(name)) ROOT.removeAttribute(name);
    }
    const perRow = String(Math.min(8, Math.max(1, Number(settings.perRowValue) || 3)));
    if (ROOT.style.getPropertyValue("--ytf-per-row") !== perRow) ROOT.style.setProperty("--ytf-per-row", perRow);
    const json = JSON.stringify(settings);
    if (ROOT.dataset.ytfSettings !== json) {
      ROOT.dataset.ytfSettings = json;
      document.dispatchEvent(new CustomEvent("ytf-settings"));
    }
  }

  // --- Smart autoplay -------------------------------------------------------------------------
  // When a video ends and YouTube autoplays one that was already played or watched, jump to the
  // first video in the sidebar that is neither. A click or key press after the end means you chose
  // the next video yourself, so it is left alone.
  let endedAt = 0;
  let userAt = 0;
  document.addEventListener("ended", (e) => {
    if (e.target.closest && e.target.closest("#movie_player")) endedAt = Date.now();
  }, true);
  for (const type of ["pointerdown", "keydown"]) document.addEventListener(type, () => (userAt = Date.now()), true);

  const saveTimers = {};
  function remember(set, key, id) {
    if (set.has(id)) return;
    set.add(id);
    clearTimeout(saveTimers[key]);
    saveTimers[key] = setTimeout(() => browser.storage.local.set({ [key]: [...set].slice(-2000) }), 1000);
  }

  function onWatchPage() {
    const id = currentId();
    if (!id) return;
    const autoplayed = endedAt && Date.now() - endedAt < 20000 && userAt < endedAt;
    endedAt = 0;
    const repeat = played.has(id) || watched.has(id);
    remember(played, "ytfPlayed", id);
    if (settings.enabled && settings.smartAutoplay && autoplayed && repeat) skipRepeat(id);
  }

  function skipRepeat(id) {
    const video = document.querySelector("#movie_player video");
    if (video) video.pause();
    let tries = 0;
    const timer = setInterval(() => {
      const side = document.querySelector("ytd-watch-flexy #secondary");
      const candidates = side
        ? outermost(side, TILE)
            .filter((t) => !t.hasAttribute(ATTR))
            .map(tileInfo)
            .filter((c) => c.kind === "video" && !c.members && !c.live && !c.upcoming && c.watchedPct == null)
        : [];
      const next = Y.pickNext(candidates, id, played, watched);
      if (next || ++tries > 25) {
        clearInterval(timer);
        if (next) next.link.click();
        else if (video) video.play(); // nothing new in the sidebar: keep the repeat rather than stop dead
      }
    }, 300);
  }

  // --- Wiring ---------------------------------------------------------------------------------
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

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && Object.keys(changes).some((k) => k in Y.DEFAULTS)) loadSettings();
  });
  browser.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "ytf-stats") {
      run();
      return Promise.resolve({ active: !!pageRoot(), counts });
    }
  });

  // The player rewrites its own text many times a second; those changes never add tiles.
  const insidePlayer = (m) => {
    const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
    return el && el.closest("#movie_player");
  };
  new MutationObserver((muts) => {
    if (!muts.every(insidePlayer)) schedule();
  }).observe(ROOT, { childList: true, subtree: true, characterData: true });
  document.addEventListener("yt-navigate-finish", () => {
    if (location.pathname === "/watch") onWatchPage();
    schedule();
  });

  (async () => {
    const saved = await browser.storage.local.get({ ytfPlayed: [], ytfWatched: [] });
    saved.ytfPlayed.forEach((id) => played.add(id));
    saved.ytfWatched.forEach((id) => watched.add(id));
    await loadSettings();
    if (location.pathname === "/watch" && currentId()) remember(played, "ytfPlayed", currentId());
  })();
})();
