// Pure text reading for YT Filter: no DOM, so node:test can cover it.
// YouTube shows English or Norwegian depending on the account, so every phrase has both.
(function (root) {
  "use strict";

  // Defaults chosen by Max on 2026-11-07 for new users; personal settings start off.
  const DEFAULTS = {
    enabled: true,
    membersMode: "unlessMember", // always | unlessMember | never
    shorts: true,
    playables: false,
    news: true,
    live: false,
    mixes: false,
    playlists: false,
    watched: false,
    watchedPct: 50,
    maxAge: false,
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
    hideAvatars: false,
    hideMeta: false,
    // Playback
    noPreview: false,
    smartAutoplay: true,
    speed: false,
    speedValue: "1.25",
    quality: false,
    qualityValue: "highest",
    theater: false,
    subtitles: "default", // default | off | no | en
    shortsAsVideo: false, // open Shorts in the normal player
    noEndCards: false,
    noComments: false,
    // Block lists: one entry per line (or comma separated), matched without case
    blockChannels: "",
    blockWords: "",
    keepOnly: "", // 0.3.8 only; moved into blockWords by migrateKeepOnly
  };

  const REASONS = {
    members: "Members only",
    blocked: "Blocked",
    keepOnly: "Only-titles rule",
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

  // "Linus Tech Tips\nMrBeast, clickbait" -> ["linus tech tips", "mrbeast", "clickbait"]. Cached per text,
  // since every tile on every pass asks.
  const listCache = new Map();
  function parseList(text) {
    if (!text) return [];
    if (!listCache.has(text)) {
      if (listCache.size > 20) listCache.clear();
      listCache.set(text, [...new Set(text.split(/[\n,]/).map((x) => x.trim().toLowerCase()).filter(Boolean))]);
    }
    return listCache.get(text);
  }

  // Whether a tile's channel is the listed name c (lower case): the exact name or its @handle.
  function channelIs(info, c) {
    const channel = (info.channel || "").trim().toLowerCase();
    if (channel && (c === channel || c === "@" + channel || c.replace(/^@/, "") === channel)) return true;
    return !!info.handle && info.handle.toLowerCase() === c;
  }

  // Title rules, one per line (the "Titles" field):
  //   shorts                      block titles with "shorts" from any channel (old plain form, commas split)
  //   @any "shorts"               the same
  //   @channel "top 10" "ranked"  block those titles from one channel (name or @handle)
  //   @channel only "review"      keep only those titles from that channel, hide the rest
  // -> [{channel: "@channel" | null, only, words}]. "*" is ignored, so "*before you buy*" works too.
  const rulesCache = new Map();
  const cleanWord = (w) => w.replace(/[*"]/g, "").trim().toLowerCase();
  function parseTitleRules(text) {
    if (!text) return [];
    if (!rulesCache.has(text)) {
      if (rulesCache.size > 20) rulesCache.clear();
      const rules = [];
      for (const raw of text.split("\n")) {
        const line = raw.trim();
        if (!line.startsWith("@")) {
          const words = line.split(",").map(cleanWord).filter(Boolean);
          if (words.length) rules.push({ channel: null, only: false, words });
          continue;
        }
        const quote = line.indexOf('"');
        let head, words;
        if (quote >= 0) {
          head = line.slice(1, quote).trim();
          words = [...line.slice(quote).matchAll(/"([^"]*)"?/g)].map((m) => cleanWord(m[1])).filter(Boolean);
        } else {
          // No quotes: "@channel word" (a channel name with spaces needs the quotes)
          const [first, ...rest] = line.slice(1).split(/\s+/);
          head = first;
          words = [cleanWord(rest.join(" "))].filter(Boolean);
        }
        const only = /(^|\s)only$/i.test(head);
        if (only) head = head.replace(/(^|\s)only$/i, "").trim();
        const name = head.toLowerCase();
        if (!words.length || (!name && !only)) continue;
        rules.push({ channel: !name || name === "any" ? null : "@" + name, only, words });
      }
      rulesCache.set(text, rules);
    }
    return rulesCache.get(text);
  }

  const ruleFits = (info, r) => !r.channel || channelIs(info, r.channel);
  const titleHas = (title, r) => r.words.some((w) => title.includes(w));

  // Channel must match a listed name exactly (or its @handle); a block rule's word matches anywhere in the title.
  function isBlocked(info, s) {
    if (parseList(s.blockChannels).some((c) => channelIs(info, c))) return true;
    const title = (info.title || "").toLowerCase();
    return !!title && parseTitleRules(s.blockWords).some((r) => !r.only && ruleFits(info, r) && titleHas(title, r));
  }

  // With "only" rules for a channel, its videos stay only if the title holds one of their words.
  // A tile with no title read yet is left alone rather than hidden by mistake.
  function failsKeepOnly(info, s) {
    const title = (info.title || "").toLowerCase();
    if (!title) return false;
    const rules = parseTitleRules(s.blockWords).filter((r) => r.only && ruleFits(info, r));
    return rules.length > 0 && !rules.some((r) => titleHas(title, r));
  }

  // 0.3.8 had a separate "keepOnly" field ("Gameranx: before you buy | review"). Returns the storage
  // change that moves its lines into the Titles field as "@Gameranx only ..." rules, or null.
  function migrateKeepOnly(s) {
    if (!s.keepOnly) return null;
    const moved = s.keepOnly
      .split("\n")
      .map((line) => {
        const at = line.indexOf(":");
        if (at < 0) return "";
        const words = line.slice(at + 1).split("|").map(cleanWord).filter(Boolean);
        const name = line.slice(0, at).trim().replace(/^@/, "");
        return name && words.length ? `@${name} only ${words.map((w) => `"${w}"`).join(" ")}` : "";
      })
      .filter(Boolean);
    const words = (s.blockWords || "").trim();
    return { keepOnly: "", blockWords: [words, ...moved].filter(Boolean).join("\n") };
  }

  // Members-only videos: hidden unless the mode is "never", or "unlessMember" and the user pays for that channel.
  function hideMembers(info, s) {
    if (!info.members || !s.enabled || s.membersMode === "never") return false;
    return !(s.membersMode === "unlessMember" && info.member);
  }

  // Whether a tile's channel is in a channel list: list = {names: Set, handles: Set}, lower case.
  function inChannelList(info, list) {
    if (!list) return false;
    const name = (info.channel || "").trim().toLowerCase();
    const handle = (info.handle || "").toLowerCase();
    return (!!name && list.names.has(name)) || (!!handle && list.handles.has(handle));
  }

  // Channel names and @handles from the HTML of youtube.com/paid_memberships (the user's channel memberships).
  // The page layout is not documented, so every short plain text and every @handle counts; page headings in
  // the list never match a real channel name on a tile.
  function parseChannelList(html) {
    const names = new Set();
    const handles = new Set();
    for (const m of html.matchAll(/"simpleText":"((?:[^"\\]|\\.){1,80})"/g)) {
      try {
        names.add(JSON.parse('"' + m[1] + '"').trim().toLowerCase());
      } catch {
        // malformed escape: skip
      }
    }
    for (const m of html.matchAll(/"canonicalBaseUrl":"\/(@[^"]+)"/g)) handles.add(decodeURIComponent(m[1]).toLowerCase());
    return { names, handles };
  }

  // info: {kind, members, member, live, upcoming, ageDays, views, watchedPct, channel, handle, title}.
  // Returns a REASONS key or null.
  function decideTile(info, s) {
    if (hideMembers(info, s)) return "members";
    if (!s.enabled) return null;
    if (isBlocked(info, s)) return "blocked";
    if (failsKeepOnly(info, s)) return "keepOnly";
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

  // One piece of the line under a tile: views, date, live or premiere info ("meta"), or else the channel.
  // The screen can show short forms ("9.7M", "9y ago"), so plain numbers and "ago" count as meta too.
  const META_WORDS = /\b(ago|streamed|premiered|premieres|views?|watching|scheduled)\b|siden|strømmet|visninger|avspillinger|premiere|ser på/i;
  function isMetaText(text) {
    if (!text) return false;
    return parseViews(text) != null || parseAgeDays(text) != null || META_WORDS.test(text) || /^\d[\d.,\s]*[kmb]?$/i.test(text.trim());
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
    isPlayablesTitle, kindFromHref, decideTile, decideShelf, parseList, isBlocked, parseTitleRules, failsKeepOnly, migrateKeepOnly, hideMembers, inChannelList, parseChannelList,
    isMetaText, videoIdFromHref, pickQuality, pickSubtitles, pickNext,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = YTF;
  root.YTF = YTF;
})(typeof globalThis !== "undefined" ? globalThis : this);
