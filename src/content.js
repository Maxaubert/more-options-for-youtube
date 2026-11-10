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
  // Channels the user pays a membership for, only needed for "Show if member"; refreshed at most once a day.
  let memberships = null;
  const MEMBERSHIPS_MAX_AGE = 24 * 3600 * 1000;

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

    const titleEl = tile.querySelector('#video-title, a[class*="LockupMetadataViewModelTitle"]');
    const channelEl = tile.querySelector('[data-ytf-part="channel"], ytd-channel-name #text, ytd-channel-name a');
    const avatar = tile.querySelector('[aria-label^="Go to channel "], [aria-label^="Gå til kanalen "]');
    const handleLink = tile.querySelector('a[href^="/@"]');
    const meta = labelsThenTexts(tile, META);
    const badges = labelsThenTexts(tile, BADGE);
    const styles = [...tile.querySelectorAll("[overlay-style]")].map((n) => n.getAttribute("overlay-style"));
    const progress = tile.querySelector(PROGRESS);
    const pct = progress ? parseFloat(progress.style.width) : NaN;

    return {
      id: Y.videoIdFromHref(href),
      link,
      kind,
      title: titleEl ? (titleEl.getAttribute("title") || titleEl.textContent || "").trim() : "",
      channel: channelEl
        ? channelEl.textContent.trim()
        : avatar
          ? avatar.getAttribute("aria-label").replace(/^(Go to channel|Gå til kanalen) /, "").trim()
          : "",
      handle: handleLink ? handleLink.getAttribute("href").slice(1).split(/[/?]/)[0] : "",
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
    // Only the home page is filtered on screen. Search, Subscriptions and the list next to a video stay as
    // YouTube shows them; autoplay still skips filtered videos on its own (candidates(), autoplaySkip) (Max, 2026-11-10).
    if (p === "/") return document.querySelector(HOME);
    return null;
  }

  // Only the outermost match: a yt-lockup-view-model inside a ytd-rich-item-renderer is the same video.
  const outermost = (root, sel) => [...root.querySelectorAll(sel)].filter((el) => !el.parentElement.closest(sel));

  // Label each piece of the text under a tile as channel or meta (views/date), and each line as
  // channel, meta or mixed, so the "hide channel names" and "hide views" switches hit the right one.
  const setAttr = (el, name, value) => {
    if (el.getAttribute(name) !== value) el.setAttribute(name, value);
  };
  function markParts(tile) {
    for (const row of tile.querySelectorAll('[class*="ContentMetadataViewModelMetadataRow"]')) {
      const kinds = new Set();
      for (const span of row.querySelectorAll('[class*="MetadataText"]')) {
        const kind = Y.isMetaText(span.getAttribute("aria-label") || span.textContent) ? "meta" : "channel";
        setAttr(span, "data-ytf-part", kind);
        kinds.add(kind);
      }
      if (kinds.size) setAttr(row, "data-ytf-row", kinds.size > 1 ? "mixed" : [...kinds][0]);
    }
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
    applySwitches();
    if (settings.enabled && settings.noPreview) {
      for (const v of document.querySelectorAll("ytd-video-preview video, #video-preview video")) if (!v.paused) v.pause();
    }
    const root = pageRoot();
    if (!root) {
      // Off the home page: undo marks left on other pages, because YouTube reuses those elements for other
      // videos. Never touch the home grid: it is still on screen right after you click a video, and
      // un-hiding tiles there made the grid jump as if you had clicked the wrong video.
      for (const el of document.querySelectorAll(`[${ATTR}]`)) if (!el.closest(HOME)) el.removeAttribute(ATTR);
      return;
    }
    for (const shelf of outermost(root, SHELF)) mark(shelf, Y.decideShelf(shelfInfo(shelf), settings));
    // YouTube recycles tile elements with new videos, so every tile is checked on every pass.
    for (const tile of outermost(root, TILE)) {
      if (tile.closest(`[${ATTR}]:not(${TILE})`)) continue; // inside a hidden shelf
      markParts(tile);
      const info = tileInfo(tile);
      info.member = Y.inChannelList(info, memberships);
      if (info.id && info.watchedPct != null && info.watchedPct >= settings.watchedPct) remember(watched, "ytfWatched", info.id);
      const reason = Y.decideTile(info, settings);
      noteTile(info, reason);
      mark(tile, reason);
    }
  }

  // CSS switches on <html> (content.css reads them) and the settings for main.js.
  function applySwitches() {
    const on = settings.enabled;
    const flags = {
      "data-ytf-nopreview": on && settings.noPreview,
      "data-ytf-hidetitles": on && settings.hideTitles,
      "data-ytf-hidechannels": on && settings.hideChannels,
      "data-ytf-hideavatars": on && settings.hideAvatars,
      "data-ytf-hidemeta": on && settings.hideMeta,
      "data-ytf-perrow": on && settings.perRow,
      "data-ytf-noendcards": on && settings.noEndCards,
      "data-ytf-nocomments": on && settings.noComments,
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
  // When a video ends, we pick the next one ourselves before YouTube does: the first sidebar video
  // that no filter hides, that has no watched bar and that was not played on this computer.
  // If YouTube still autoplays something else, we check it on arrival and skip it when it was
  // played, watched or filtered. A click or key press after the end means you chose the next
  // video yourself, so it is left alone.
  let endedAt = 0;
  let userAt = 0;
  let ourPick = "";
  // Set when YouTube moves on from a video at its end without the user (see Y.wasAutoplay).
  let navByAutoplay = false;
  document.addEventListener("yt-navigate-start", () => {
    const v = document.querySelector("#movie_player video");
    navByAutoplay = Y.wasAutoplay({
      fromWatch: location.pathname === "/watch",
      ended: v && v.ended,
      duration: v ? v.duration : 0,
      currentTime: v ? v.currentTime : 0,
      msSinceUser: Date.now() - userAt,
    });
  }, true);
  document.addEventListener("ended", (e) => {
    const player = e.target.closest && e.target.closest("#movie_player");
    if (!player || player.classList.contains("ad-showing")) return;
    endedAt = Date.now();
    pickBeforeYouTube(player);
  }, true);
  for (const type of ["pointerdown", "keydown"]) document.addEventListener(type, () => (userAt = Date.now()), true);

  // What we last saw of each video as a tile: why it was hidden, and its watched bar.
  const tileState = new Map();
  function noteTile(info, reason) {
    if (!info.id) return;
    tileState.delete(info.id);
    tileState.set(info.id, { reason, watchedPct: info.watchedPct });
    if (tileState.size > 1000) tileState.delete(tileState.keys().next().value);
  }

  // Sidebar videos smart autoplay may jump to. Filters are checked here too, so this also works when
  // the filters are not shown on the watch page.
  function candidates() {
    const side = document.querySelector("ytd-watch-flexy #secondary");
    if (!side) return [];
    return outermost(side, TILE)
      .map((t) => {
        const info = tileInfo(t);
        info.member = Y.inChannelList(info, memberships);
        const reason = Y.decideTile(info, settings);
        noteTile(info, reason);
        return reason ? null : info;
      })
      .filter((c) => c && c.kind === "video" && !c.members && !c.live && !c.upcoming && c.watchedPct == null);
  }

  // YouTube's own autoplay switch under the video; when it is off, nothing should play next.
  const autonavOn = () => {
    const toggle = document.querySelector(".ytp-autonav-toggle-button");
    return !toggle || toggle.getAttribute("aria-checked") === "true";
  };

  function pickBeforeYouTube(player) {
    const id = currentId();
    if (!settings.enabled || !settings.smartAutoplay || !id || !autonavOn()) return;
    if (new URLSearchParams(location.search).has("list")) return; // playlists play in their own order
    const video = player.querySelector("video");
    if (video && video.duration && video.currentTime < video.duration - 1) return;
    const next = Y.pickNext(candidates(), id, played, watched);
    if (!next) return;
    ourPick = next.id;
    next.link.click();
  }

  const saveTimers = {};
  function remember(set, key, id) {
    if (set.has(id)) return;
    set.add(id);
    clearTimeout(saveTimers[key]);
    // Merge with what other tabs saved meanwhile, so the last tab to save does not erase their videos.
    saveTimers[key] = setTimeout(async () => {
      const saved = (await browser.storage.local.get({ [key]: [] }))[key];
      saved.forEach((v) => set.add(v));
      await browser.storage.local.set({ [key]: [...set].slice(-2000) });
    }, 1000);
  }

  function onWatchPage() {
    const id = currentId();
    if (!id) return;
    const autoplayed = navByAutoplay || (endedAt && Date.now() - endedAt < 20000 && userAt < endedAt);
    navByAutoplay = false;
    endedAt = 0;
    const picked = ourPick === id;
    ourPick = "";
    const known = { played: new Set(played), watched, tile: tileState.get(id), settings };
    remember(played, "ytfPlayed", id);
    if (!settings.enabled || !settings.smartAutoplay || !autoplayed || picked) return;
    const why = Y.autoplaySkip(id, known);
    if (why) return skipRepeat(id, why !== "hidden");
    // Not known from a tile: wait for the player's title and channel (main.js), then check the filters.
    let tries = 0;
    const timer = setInterval(() => {
      let video = null;
      try {
        video = JSON.parse(ROOT.dataset.ytfVideo || "null");
      } catch {
        // ignore
      }
      const ready = video && video.id === id;
      if (ready || ++tries > 20 || currentId() !== id) clearInterval(timer);
      const late = ready && currentId() === id && Y.autoplaySkip(id, { ...known, video });
      if (late) skipRepeat(id, late !== "hidden");
    }, 250);
  }

  // resume: play the video anyway when the sidebar has nothing better (a repeat beats stopping dead,
  // but a filtered video stays paused).
  function skipRepeat(id, resume = true) {
    const video = document.querySelector("#movie_player video");
    if (video) video.pause();
    let tries = 0;
    const timer = setInterval(() => {
      if (currentId() !== id) return clearInterval(timer); // you moved on yourself
      const next = Y.pickNext(candidates(), id, played, watched);
      if (next || ++tries > 25) {
        clearInterval(timer);
        if (next) next.link.click();
        else if (video && resume) video.play();
      }
    }, 300);
  }

  // --- Shorts in the normal player ------------------------------------------------------------
  function shortsToWatch() {
    const m = /^\/shorts\/([\w-]{11})/.exec(location.pathname);
    if (m && settings.enabled && settings.shortsAsVideo) location.replace("/watch?v=" + m[1]);
  }

  // --- "Block channel" in a tile's ... menu ---------------------------------------------------
  // YouTube builds the menu itself in a shared popup, so after a click on a tile's menu button we
  // wait for the popup and add one entry to it.
  const BLOCK_ITEM = "ytf-block-item";
  document.addEventListener("pointerdown", (e) => {
    const button = e.target.closest && e.target.closest('[class*="MenuButton"], ytd-menu-renderer, #menu, button[aria-label]');
    const tile = button && button.closest(TILE);
    if (!tile || !settings.enabled || e.target.closest("a, h3")) return;
    const info = tileInfo(tile);
    const name = info.channel || (info.handle ? info.handle : "");
    if (!name) return;
    let tries = 0;
    const timer = setInterval(() => {
      const list = openMenuList();
      if (list || ++tries > 20) clearInterval(timer);
      if (list) addBlockItem(list, name);
    }, 100);
  }, true);

  function openMenuList() {
    const dropdown = [...document.querySelectorAll("ytd-popup-container tp-yt-iron-dropdown")].find(
      (d) => d.getAttribute("aria-hidden") !== "true" && getComputedStyle(d).display !== "none"
    );
    return dropdown && dropdown.querySelector("yt-list-view-model, tp-yt-paper-listbox#items, #items");
  }

  function addBlockItem(list, name) {
    for (const old of document.querySelectorAll("." + BLOCK_ITEM)) old.remove();
    const item = document.createElement("div");
    item.className = BLOCK_ITEM;
    item.setAttribute("role", "menuitem");
    item.tabIndex = 0;
    item.textContent = `Block channel: ${name}`;
    const block = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const { blockChannels } = await browser.storage.local.get({ blockChannels: "" });
      if (!Y.parseList(blockChannels).includes(name.toLowerCase())) {
        await browser.storage.local.set({ blockChannels: (blockChannels.trim() ? blockChannels.trim() + "\n" : "") + name });
      }
      item.remove();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
      document.body.click();
    };
    item.addEventListener("click", block);
    item.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && block(e));
    list.append(item);
  }

  // --- Wiring ---------------------------------------------------------------------------------
  let timer = 0;
  // No filtering between leaving a page and the next page being ready, so nothing moves under the click.
  let navigating = false;
  let navTimer = 0;
  document.addEventListener("yt-navigate-start", () => {
    navigating = true;
    clearTimeout(navTimer);
    navTimer = setTimeout(() => (navigating = false), 5000); // a page change YouTube cancels must not stop filtering
  }, true);

  function schedule() {
    if (timer || navigating) return;
    timer = setTimeout(() => {
      timer = 0;
      run();
    }, 150);
  }

  async function loadSettings() {
    settings = { ...Y.DEFAULTS, ...(await browser.storage.local.get(Y.DEFAULTS)) };
    const moved = Y.migrateKeepOnly(settings);
    if (moved) {
      Object.assign(settings, moved);
      browser.storage.local.set(moved); // triggers one more loadSettings, which finds nothing to move
    }
    if (settings.membersMode === "unlessMember") loadMemberships();
    schedule();
  }

  // Reads the memberships page with the user's own YouTube session (same site, nothing leaves YouTube).
  let membershipsLoading = false;
  async function loadMemberships() {
    if (membershipsLoading) return;
    membershipsLoading = true;
    try {
      const { ytfMemberships } = await browser.storage.local.get({ ytfMemberships: null });
      if (ytfMemberships && Date.now() - ytfMemberships.at < MEMBERSHIPS_MAX_AGE) {
        memberships = { names: new Set(ytfMemberships.names), handles: new Set(ytfMemberships.handles) };
      } else {
        const res = await fetch("/paid_memberships", { credentials: "include" });
        // Logged out, a consent page or an error: do not trust or keep the answer.
        if (!res.ok || !new URL(res.url).pathname.startsWith("/paid_memberships")) return;
        memberships = Y.parseChannelList(await res.text());
        const empty = !memberships.names.size && !memberships.handles.size;
        // An empty list may be a page YouTube changed; ask again after 15 minutes, not after a day.
        const at = empty ? Date.now() - MEMBERSHIPS_MAX_AGE + 15 * 60 * 1000 : Date.now();
        await browser.storage.local.set({
          ytfMemberships: { at, names: [...memberships.names], handles: [...memberships.handles] },
        });
      }
      schedule();
    } catch {
      // Logged out or the page changed: no memberships known, so members-only videos stay hidden.
    } finally {
      membershipsLoading = false;
    }
  }

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (Object.keys(changes).some((k) => k in Y.DEFAULTS)) loadSettings();
    // Videos played or watched in other tabs count here too.
    if (changes.ytfPlayed) (changes.ytfPlayed.newValue || []).forEach((v) => played.add(v));
    if (changes.ytfWatched) (changes.ytfWatched.newValue || []).forEach((v) => watched.add(v));
  });
  // sendResponse instead of a returned promise: Chrome does not accept a promise as the reply.
  browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === "ytf-stats") {
      run();
      sendResponse({ active: !!pageRoot(), counts });
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
    navigating = false;
    shortsToWatch();
    if (location.pathname === "/watch") onWatchPage();
    schedule();
  });

  (async () => {
    const saved = await browser.storage.local.get({ ytfPlayed: [], ytfWatched: [] });
    saved.ytfPlayed.forEach((id) => played.add(id));
    saved.ytfWatched.forEach((id) => watched.add(id));
    await loadSettings();
    shortsToWatch();
    if (location.pathname === "/watch" && currentId()) remember(played, "ytfPlayed", currentId());
  })();
})();
