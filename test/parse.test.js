const test = require("node:test");
const assert = require("node:assert/strict");
const Y = require("../src/parse.js");

const S = { ...Y.DEFAULTS };

test("ages in English", () => {
  assert.equal(Y.parseAgeDays("3 years ago"), 1095);
  assert.equal(Y.parseAgeDays("1 month ago"), 30);
  assert.equal(Y.parseAgeDays("Streamed 2 weeks ago"), 14);
  assert.equal(Y.parseAgeDays("5 hours ago"), 0);
  assert.equal(Y.parseAgeDays("1.2M views"), null);
});

test("ages in Norwegian", () => {
  assert.equal(Y.parseAgeDays("for 3 år siden"), 1095);
  assert.equal(Y.parseAgeDays("for 1 måned siden"), 30);
  assert.equal(Y.parseAgeDays("for 2 måneder siden"), 60);
  assert.equal(Y.parseAgeDays("Strømmet for 5 dager siden"), 5);
  assert.equal(Y.parseAgeDays("for 1 uke siden"), 7);
  assert.equal(Y.parseAgeDays("for 4 timer siden"), 0);
  assert.equal(Y.parseAgeDays("for 2 døgn siden"), 2);
  assert.equal(Y.parseAgeDays("for 2 d. siden"), 2);
});

test("views as spelled out in aria-labels", () => {
  assert.equal(Y.parseViews("108 avspillinger"), 108);
  assert.equal(Y.parseViews("1,2 millioner avspillinger"), 1200000);
  assert.equal(Y.parseViews("1.2 million views"), 1200000);
  assert.equal(Y.parseViews("12 thousand views"), 12000);
  assert.equal(Y.parseViews("1 avspilling"), 1);
  assert.equal(Y.parseViews("108"), null);
});

test("views in English", () => {
  assert.equal(Y.parseViews("1.2M views"), 1200000);
  assert.equal(Y.parseViews("12K views"), 12000);
  assert.equal(Y.parseViews("1,234 views"), 1234);
  assert.equal(Y.parseViews("1 view"), 1);
  assert.equal(Y.parseViews("No views"), 0);
  assert.equal(Y.parseViews("2.5B views"), 2500000000);
  assert.equal(Y.parseViews("1.2K watching"), null);
});

test("views in Norwegian", () => {
  assert.equal(Y.parseViews("1,2 mill. visninger"), 1200000);
  assert.equal(Y.parseViews("12 k visninger"), 12000);
  assert.equal(Y.parseViews("12k visninger"), 12000);
  assert.equal(Y.parseViews("1 234 visninger"), 1234);
  assert.equal(Y.parseViews("1 234 visninger"), 1234);
  assert.equal(Y.parseViews("3,4 mrd. visninger"), 3400000000);
  assert.equal(Y.parseViews("Ingen visninger"), 0);
});

test("badges", () => {
  assert.ok(Y.isMembersOnly("Members only"));
  assert.ok(Y.isMembersOnly("Members first"));
  assert.ok(Y.isMembersOnly("Bare for medlemmer"));
  assert.ok(Y.isMembersOnly("Kun for kanalmedlemmer"));
  assert.ok(!Y.isMembersOnly("New"));
  assert.ok(Y.isLiveBadge("LIVE"));
  assert.ok(Y.isLiveBadge("DIREKTE"));
  assert.ok(!Y.isLiveBadge("Live music compilation"));
  assert.ok(Y.isWatching("1.2K watching"));
  assert.ok(Y.isUpcoming("Premieres 12/11/26"));
  assert.ok(Y.isUpcoming("Scheduled for 20:00"));
  assert.ok(!Y.isUpcoming("Premiered 2 years ago"));
});

test("kind from link", () => {
  assert.equal(Y.kindFromHref("/watch?v=abc"), "video");
  assert.equal(Y.kindFromHref("/shorts/abc"), "shorts");
  assert.equal(Y.kindFromHref("/playables/xyz"), "playable");
  assert.equal(Y.kindFromHref("/watch?v=abc&list=RDabc&start_radio=1"), "mix");
  assert.equal(Y.kindFromHref("/watch?v=abc&list=PL123"), "playlist");
  assert.equal(Y.kindFromHref(null), "video");
});

const video = (extra) => ({ kind: "video", members: false, live: false, upcoming: false, ageDays: 10, views: 5000, watchedPct: null, ...extra });

test("default rules: shorts hidden, age and views left alone", () => {
  assert.equal(Y.decideTile(video({ kind: "shorts" }), S), "shorts");
  assert.equal(Y.decideTile(video({ kind: "playable" }), S), null);
  assert.equal(Y.decideTile(video({ ageDays: 3650, views: 3 }), S), null);
  assert.equal(Y.decideTile(video({ ageDays: 730 }), { ...S, maxAge: true }), "age");
  assert.equal(Y.decideTile(video({ kind: "mix" }), S), null);
  assert.equal(Y.decideTile(video({ live: true }), S), null);
});

test("optional rules", () => {
  const s = { ...S, mixes: true, playlists: true, live: true, watched: true, maxAge: true, minViews: true, minViewsValue: 1000 };
  assert.equal(Y.decideTile(video({ kind: "mix" }), s), "mixes");
  assert.equal(Y.decideTile(video({ kind: "playlist" }), s), "playlists");
  assert.equal(Y.decideTile(video({ upcoming: true }), s), "live");
  assert.equal(Y.decideTile(video({ watchedPct: 80 }), s), "watched");
  assert.equal(Y.decideTile(video({ watchedPct: 20 }), s), null);
  assert.equal(Y.decideTile(video({ views: 999 }), s), "views");
  assert.equal(Y.decideTile(video({ ageDays: 40 }), { ...s, maxAgeValue: 1, maxAgeUnit: "months" }), "age");
});

test("unknown age or views never hides", () => {
  const s = { ...S, minViews: true };
  assert.equal(Y.decideTile(video({ ageDays: null, views: null }), s), null);
});

test("channel vs views/date text", () => {
  for (const meta of ["9.7 million views", "9.7M", "9y ago", "9 years ago", "108 avspillinger", "108", "for 2 d. siden",
    "1.2K watching", "Streamed 3 days ago", "Premieres 12/11/26", "Strømmet for 2 år siden"]) {
    assert.ok(Y.isMetaText(meta), meta);
  }
  for (const channel of ["3Blue1Brown", "NRK", "Veritasium", "Kurzgesagt – In a Nutshell", "Linus Tech Tips"]) {
    assert.ok(!Y.isMetaText(channel), channel);
  }
});

test("members-only modes", () => {
  const m = video({ members: true, channel: "Vsauce" });
  assert.equal(Y.decideTile(m, S), "members"); // default: show only for channels you are a member of
  assert.equal(Y.decideTile({ ...m, member: true }, S), null);
  assert.equal(Y.decideTile({ ...m, member: true }, { ...S, membersMode: "always" }), "members");
  assert.equal(Y.decideTile(m, { ...S, membersMode: "never" }), null);
  assert.equal(Y.decideTile(m, { ...S, enabled: false }), null); // the master switch turns everything off
});

test("memberships page", () => {
  const html =
    '..."title":{"simpleText":"Vsauce"},"navigationEndpoint":{"browseEndpoint":{"canonicalBaseUrl":"/@Vsauce"}}' +
    '..."title":{"simpleText":"Tom \\"Quotes\\" Scott"},"x":{"canonicalBaseUrl":"/@TomScott"}';
  const list = Y.parseChannelList(html);
  assert.ok(list.names.has("vsauce") && list.names.has('tom "quotes" scott'));
  assert.deepEqual([...list.handles], ["@vsauce", "@tomscott"]);
  assert.ok(Y.inChannelList({ channel: "VSAUCE" }, list));
  assert.ok(Y.inChannelList({ channel: "x", handle: "@TomScott" }, list));
  assert.ok(!Y.inChannelList({ channel: "Other" }, list));
  assert.ok(!Y.inChannelList({ channel: "Vsauce" }, null));
});

test("block lists", () => {
  assert.deepEqual(Y.parseList("Linus Tech Tips\nMrBeast, clickbait\n\n mrbeast "), ["linus tech tips", "mrbeast", "clickbait"]);
  const s = { ...S, blockChannels: "MrBeast\n@somehandle", blockWords: "reaction" };
  assert.equal(Y.decideTile(video({ channel: "MrBeast" }), s), "blocked");
  assert.equal(Y.decideTile(video({ channel: "mrbeast " }), s), "blocked");
  assert.equal(Y.decideTile(video({ channel: "Mr" }), s), null);
  assert.equal(Y.decideTile(video({ channel: "X", handle: "@SomeHandle" }), s), "blocked");
  assert.equal(Y.decideTile(video({ title: "My REACTION to it" }), s), "blocked");
  assert.equal(Y.decideTile(video({ title: "Calm video" }), s), null);
  assert.equal(Y.decideTile(video({ channel: "MrBeast" }), { ...s, enabled: false }), null);
});

test("title rules", () => {
  const lines = (...l) => l.join("\n");
  assert.deepEqual(Y.parseTitleRules(lines("reaction, Clickbait", '@any "Shorts"', '@Some Channel "top 10" "*Ranked*"', '@chan only "review"', "@x word", "@nothing")), [
    { channel: null, only: false, words: ["reaction", "clickbait"] },
    { channel: null, only: false, words: ["shorts"] },
    { channel: "@some channel", only: false, words: ["top 10", "ranked"] },
    { channel: "@chan", only: true, words: ["review"] },
    { channel: "@x", only: false, words: ["word"] },
  ]);
  const s = { ...S, blockWords: lines("reaction", '@any "shorts"', '@Some Channel "top 10"', '@chan only "review" "before you buy"') };
  const c = (title, extra) => video({ channel: "Chan", title, ...extra });
  assert.equal(Y.decideTile(video({ title: "My REACTION" }), s), "blocked");
  assert.equal(Y.decideTile(video({ title: "Best shorts ever" }), s), "blocked");
  assert.equal(Y.decideTile(video({ channel: "Some Channel", title: "Top 10 games" }), s), "blocked");
  assert.equal(Y.decideTile(video({ channel: "Other", title: "Top 10 games" }), s), null);
  assert.equal(Y.decideTile(c("Game X - Before You Buy"), s), null);
  assert.equal(Y.decideTile(c("Game X review"), s), null);
  assert.equal(Y.decideTile(c("Top 10 games"), s), "keepOnly");
  assert.equal(Y.decideTile(c(""), s), null);
  assert.equal(Y.decideTile(video({ channel: "X", handle: "@Chan", title: "Vlog" }), s), "keepOnly");
  assert.equal(Y.decideTile(c("Top 10 games"), { ...s, enabled: false }), null);
});

test("0.3.8 keep-only lines move into the Titles field", () => {
  assert.equal(Y.migrateKeepOnly({ keepOnly: "", blockWords: "x" }), null);
  assert.deepEqual(Y.migrateKeepOnly({ keepOnly: "Chan: *Before you buy* | Review\nno colon", blockWords: "reaction\n" }), {
    keepOnly: "",
    blockWords: 'reaction\n@Chan only "before you buy" "review"',
  });
  const moved = Y.migrateKeepOnly({ keepOnly: "@chan: review", blockWords: "" });
  assert.equal(moved.blockWords, '@chan only "review"');
  assert.equal(Y.decideTile(video({ channel: "Chan", title: "Vlog" }), { ...S, ...moved }), "keepOnly");
});

test("video ids", () => {
  assert.equal(Y.videoIdFromHref("/watch?v=KfODG5REyss"), "KfODG5REyss");
  assert.equal(Y.videoIdFromHref("/watch?v=NiCgcUTL9_Q&pp=0gcJ"), "NiCgcUTL9_Q");
  assert.equal(Y.videoIdFromHref("/shorts/abcdefghijk"), "abcdefghijk");
  assert.equal(Y.videoIdFromHref("/playlist?list=PL1"), null);
});

test("quality", () => {
  const levels = ["hd1080", "hd720", "large", "medium", "small", "tiny", "auto"];
  assert.equal(Y.pickQuality(levels, "highest"), "hd1080");
  assert.equal(Y.pickQuality(levels, "2160"), "hd1080");
  assert.equal(Y.pickQuality(levels, "720"), "hd720");
  assert.equal(Y.pickQuality(levels, "480"), "large");
  assert.equal(Y.pickQuality(["auto"], "highest"), null);
});

test("subtitles", () => {
  const en = { languageCode: "en", kind: "" };
  const enAuto = { languageCode: "en", kind: "asr" };
  const nb = { languageCode: "nb", kind: "" };
  assert.equal(Y.pickSubtitles([en], "default"), null);
  assert.equal(Y.pickSubtitles([en], "off"), "off");
  assert.deepEqual(Y.pickSubtitles([en, nb], "no"), { track: nb });
  assert.deepEqual(Y.pickSubtitles([{ languageCode: "no" }], "no"), { track: { languageCode: "no" } });
  assert.deepEqual(Y.pickSubtitles([enAuto, en], "no"), { translate: en, to: "no" });
  assert.deepEqual(Y.pickSubtitles([enAuto, en], "en"), { track: en });
  assert.equal(Y.pickSubtitles([], "no"), null);
});

test("smart autoplay picks the first new video", () => {
  const c = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  assert.deepEqual(Y.pickNext(c, "a", new Set(["b"]), new Set(["c"])), { id: "d" });
  assert.equal(Y.pickNext(c, "a", new Set(["b", "c", "d"]), new Set()), null);
});

test("shelves", () => {
  assert.equal(Y.decideShelf({ shorts: true, playables: false, title: "Shorts" }, S), "shorts");
  assert.equal(Y.decideShelf({ shorts: false, playables: false, title: "YouTube Playables" }, S), null);
  assert.equal(Y.decideShelf({ shorts: false, playables: false, title: "YouTube Playables" }, { ...S, playables: true }), "playables");
  assert.equal(Y.decideShelf({ shorts: false, playables: false, title: "Breaking news" }, S), "news");
  assert.equal(Y.decideShelf({ shorts: false, playables: false, title: "Siste nytt" }, S), "news");
  assert.equal(Y.decideShelf({ shorts: false, playables: false, title: "Recommended" }, S), null);
  assert.equal(Y.decideShelf({ shorts: true, playables: false, title: "" }, { ...S, enabled: false }), null);
});
