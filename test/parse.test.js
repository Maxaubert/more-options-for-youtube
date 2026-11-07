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

test("members-only is hidden even with everything off", () => {
  assert.equal(Y.decideTile(video({ members: true }), { ...S, enabled: false }), "members");
});

test("default rules: shorts and over a year", () => {
  assert.equal(Y.decideTile(video({ kind: "shorts" }), S), "shorts");
  assert.equal(Y.decideTile(video({ ageDays: 365 }), S), null);
  assert.equal(Y.decideTile(video({ ageDays: 730 }), S), "age");
  assert.equal(Y.decideTile(video({ kind: "mix" }), S), null);
  assert.equal(Y.decideTile(video({ live: true }), S), null);
});

test("optional rules", () => {
  const s = { ...S, mixes: true, playlists: true, live: true, watched: true, minViews: true, minViewsValue: 1000 };
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

test("shelves", () => {
  assert.equal(Y.decideShelf({ shorts: true, playables: false, title: "Shorts" }, S), "shorts");
  assert.equal(Y.decideShelf({ shorts: false, playables: false, title: "YouTube Playables" }, S), "playables");
  assert.equal(Y.decideShelf({ shorts: false, playables: false, title: "Breaking news" }, S), "news");
  assert.equal(Y.decideShelf({ shorts: false, playables: false, title: "Siste nytt" }, S), "news");
  assert.equal(Y.decideShelf({ shorts: false, playables: false, title: "Recommended" }, S), null);
  assert.equal(Y.decideShelf({ shorts: true, playables: false, title: "" }, { ...S, enabled: false }), null);
});
