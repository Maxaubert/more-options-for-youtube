// Pure text reading for YT Filter: no DOM, so node:test can cover it.
// YouTube shows English or Norwegian depending on the account, so every phrase has both.
(function (root) {
  "use strict";

  const DEFAULTS = {
    enabled: true,
    shorts: true,
    playables: true,
    news: true,
    live: false,
    mixes: false,
    playlists: false,
    watched: false,
    watchedPct: 50,
    maxAge: true,
    maxAgeValue: 1,
    maxAgeUnit: "years",
    minViews: false,
    minViewsValue: 1000,
    everywhere: true, // also Search, Subscriptions and the sidebar next to a video
    // Grid
    perRow: false,
    perRowValue: 3,
    hideTitles: false,
    hideChannels: false,
    hideMeta: false,
    // Playback
    noPreview: true,
    smartAutoplay: true,
    speed: false,
    speedValue: "1.25",
    quality: false,
    qualityValue: "highest",
    theater: false,
    subtitles: "default", // default | off | no | en
  };

  const REASONS = {
    members: "Members only",
    shorts: "Shorts",
    playables: "Playables",
    news: "News rows",
    live: "Live / upcoming",
    mixes: "Mixes",
    playlists: "Playlists",
    watched: "Watched",
    age: "Too old",
    views: "Too few views",
  };

  const UNIT_DAYS = { days: 1, weeks: 7, months: 30, years: 365 };

  // English "3 years ago", "Streamed 2 months ago"; Norwegian "for 3 år siden", "Strømmet for 2 måneder siden".
  const AGE_EN = /(\d+)\s*(second|minute|hour|day|week|month|year)s?\s+ago/i;
  // The screen shows "for 2 d. siden"; the aria-label (read first) says "for 2 døgn siden".
  const AGE_NO = /for\s+(\d+)\s*(sekund|minutt|time|døgn|dag|uke|måned|år|d)[a-zæøå]*\.?\s+siden/i;
  const AGE_UNIT = {
    second: 0, minute: 0, hour: 0, day: 1, week: 7, month: 30, year: 365,
    sekund: 0, minutt: 0, time: 0, "døgn": 1, dag: 1, d: 1, uke: 7, "måned": 30, "år": 365,
  };

  function parseAgeDays(text) {
    if (!text) return null;
    const m = AGE_EN.exec(text) || AGE_NO.exec(text);
    if (!m) return null;
    return Number(m[1]) * AGE_UNIT[m[2].toLowerCase()];
  }

  // "1.2M views", "1,234 views", "1,2 mill. visninger", "12 k visninger", "1 234 visninger", "No views".
  // aria-labels spell it out: "1.2 million views", "1,2 millioner avspillinger".
  const VIEWS = new RegExp(
    "(\\d+(?:[.,\\s\\u00a0\\u202f]\\d+)*)\\s*" +
      "(thousand|tusen|millioner|million|milliarder|milliard|billion|mill\\.?|mio\\.?|mrd\\.?|bn|k|m|b)?\\s*" +
      "(?:views?|visninger|visning|avspillinger|avspilling)(?![a-zæøå])",
    "i"
  );
  const NO_VIEWS = /\b(no views|ingen visninger|ingen avspillinger)\b/i;
  const MULT = {
    k: 1e3, thousand: 1e3, tusen: 1e3,
    m: 1e6, mill: 1e6, mio: 1e6, million: 1e6, millioner: 1e6,
    b: 1e9, bn: 1e9, mrd: 1e9, billion: 1e9, milliard: 1e9, milliarder: 1e9,
  };

  function parseViews(text) {
    if (!text) return null;
    if (NO_VIEWS.test(text)) return 0;
    const m = VIEWS.exec(text);
    if (!m) return null;
    const suffix = (m[2] || "").toLowerCase().replace(".", "");
    if (suffix) {
      // With a suffix the separator is a decimal point: "1.2M", "1,2 mill."
      const n = parseFloat(m[1].replace(/[\s  ]/g, "").replace(",", "."));
      return Math.round(n * MULT[suffix]);
    }
    // Without one every separator groups thousands: "1,234", "1 234", "1.234".
    return Number(m[1].replace(/[.,\s  ]/g, ""));
  }

  const MEMBERS = /\bmembers[ -](only|first)\b|\b(bare|kun) for (kanal)?medlemmer\b|\bmedlemmer først\b|\bbare medlemmer\b/i;
  const LIVE_BADGE = /^\s*(live|live now|direkte|direktesendt)\s*$/i;
  const WATCHING = /\bwatching\b|\bser på\b/i;
  const UPCOMING = /\bupcoming\b|\bpremieres\b|\bscheduled for\b|\bplanlagt\b|\bpremiere om\b|\bventer\b/i;
  const NEWS_TITLE = /breaking news|top news|trending|siste nytt|toppnyheter|nyheter|populært nå|trender/i;
  const PLAYABLES_TITLE = /playables/i;

  const isMembersOnly = (text) => MEMBERS.test(text || "");
  const isLiveBadge = (text) => LIVE_BADGE.test(text || "");
  const isWatching = (text) => WATCHING.test(text || "");
  const isUpcoming = (text) => UPCOMING.test(text || "");
  const isNewsTitle = (text) => NEWS_TITLE.test(text || "");
  const isPlayablesTitle = (text) => PLAYABLES_TITLE.test(text || "");

  // Kind of tile from its main link.
  function kindFromHref(href) {
    if (!href) return "video";
    if (/\/shorts\//.test(href)) return "shorts";
    if (/\/playables\b/.test(href)) return "playable";
    if (/[?&]list=RD|[?&]start_radio=1/.test(href)) return "mix";
    if (/[?&]list=/.test(href)) return "playlist";
    return "video";
  }

  // info: {kind, members, live, upcoming, ageDays, views, watchedPct}. Returns a REASONS key or null.
  function decideTile(info, s) {
    if (info.members) return "members";
    if (!s.enabled) return null;
    if (info.kind === "shorts" && s.shorts) return "shorts";
    if (info.kind === "playable" && s.playables) return "playables";
    if (info.kind === "mix" && s.mixes) return "mixes";
    if (info.kind === "playlist" && s.playlists) return "playlists";
    if ((info.live || info.upcoming) && s.live) return "live";
    if (s.watched && info.watchedPct != null && info.watchedPct >= s.watchedPct) return "watched";
    if (s.maxAge && info.ageDays != null && info.ageDays > s.maxAgeValue * (UNIT_DAYS[s.maxAgeUnit] || 365)) return "age";
    if (s.minViews && info.views != null && info.views < s.minViewsValue) return "views";
    return null;
  }

  // shelf: {shorts, playables, title}.
  function decideShelf(shelf, s) {
    if (!s.enabled) return null;
    if (shelf.shorts && s.shorts) return "shorts";
    if ((shelf.playables || isPlayablesTitle(shelf.title)) && s.playables) return "playables";
    if (isNewsTitle(shelf.title) && s.news) return "news";
    return null;
  }

  function videoIdFromHref(href) {
    if (!href) return null;
    const m = /[?&]v=([\w-]{11})|\/shorts\/([\w-]{11})/.exec(href);
    return m ? m[1] || m[2] : null;
  }

  // YouTube player quality names, best first. Target is "highest" or a height like "1080".
  const QUALITY = ["highres", "hd2160", "hd1440", "hd1080", "hd720", "large", "medium", "small", "tiny"];
  const QUALITY_HEIGHT = { highres: 4320, hd2160: 2160, hd1440: 1440, hd1080: 1080, hd720: 720, large: 480, medium: 360, small: 240, tiny: 144 };

  function pickQuality(available, target) {
    const levels = QUALITY.filter((q) => available.includes(q));
    if (!levels.length) return null;
    if (target === "highest") return levels[0];
    const max = Number(target);
    return levels.find((q) => QUALITY_HEIGHT[q] <= max) || levels[levels.length - 1];
  }

  // Caption track to switch to. tracks: [{languageCode, kind}] from the player. Returns
  // {track} to pick one, {translate: track} to auto-translate it, "off", or null to leave YouTube alone.
  function pickSubtitles(tracks, want) {
    if (want === "off") return "off";
    if (want !== "no" && want !== "en") return null;
    const codes = want === "no" ? ["nb", "no", "nn"] : ["en"];
    const matches = (t) => codes.some((c) => (t.languageCode || "").toLowerCase().split("-")[0] === c);
    const exact = tracks.filter(matches);
    if (exact.length) return { track: exact.find((t) => t.kind !== "asr") || exact[0] };
    if (!tracks.length) return null;
    return { translate: tracks.find((t) => t.kind !== "asr") || tracks[0], to: want === "no" ? "no" : "en" };
  }

  // Next video for smart autoplay: first candidate not played, not watched and not the current one.
  function pickNext(candidates, current, played, watched) {
    return candidates.find((c) => c.id && c.id !== current && !played.has(c.id) && !watched.has(c.id)) || null;
  }

  const YTF = {
    DEFAULTS, REASONS, UNIT_DAYS,
    parseAgeDays, parseViews, isMembersOnly, isLiveBadge, isWatching, isUpcoming, isNewsTitle,
    isPlayablesTitle, kindFromHref, decideTile, decideShelf,
    videoIdFromHref, pickQuality, pickSubtitles, pickNext,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = YTF;
  root.YTF = YTF;
})(typeof globalThis !== "undefined" ? globalThis : this);
