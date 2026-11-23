// Guards the content-script entries in manifest.json. Chromium (Chrome, Edge) injects a script file at most
// once per frame, whatever its world. A file listed in two entries then runs only in the first one, so the
// other entry silently misses it. That broke the player defaults in Chrome up to 0.7.3: parse.js was in both
// the isolated and the MAIN-world entry, and main.js found no window.YTF. Firefox injects it in both worlds.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const entries = manifest.content_scripts;

test("no content script file is listed in two entries", () => {
  const seen = new Map();
  entries.forEach((entry, i) => {
    for (const file of entry.js || []) {
      assert.ok(!seen.has(file), `${file} is in content_scripts[${seen.get(file)}] and [${i}]; Chromium injects it only once`);
      seen.set(file, i);
    }
  });
});

// A fake watch page with a stub player, enough for main.js to apply speed and quality.
function fakePage() {
  const calls = [];
  const video = { playbackRate: 1 };
  const player = {
    getAvailableQualityLevels: () => ["hd1080", "hd720", "large", "auto"],
    setPlaybackQualityRange: (a, b) => calls.push(["range", a, b]),
    setPlaybackQuality: (q) => calls.push(["quality", q]),
    setPlaybackRate: (r) => calls.push(["rate", r]),
    getVideoData: () => ({ video_id: "abcdefghijk", title: "A video", author: "Someone" }),
    querySelector: () => video,
  };
  const listeners = {};
  const timers = [];
  const document = {
    documentElement: { dataset: {} },
    getElementById: (id) => (id === "movie_player" ? player : null),
    querySelector: () => null,
    addEventListener: (type, fn) => (listeners[type] = listeners[type] || []).push(fn),
    dispatch: (type) => (listeners[type] || []).forEach((fn) => fn()),
  };
  const sandbox = {
    document,
    location: { pathname: "/watch", search: "?v=abcdefghijk" },
    URLSearchParams,
    setInterval: (fn) => timers.push(fn),
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  return { sandbox, calls, video, timers };
}

test("the MAIN-world entry runs on its own files and applies speed and quality", () => {
  const mainEntries = entries.filter((e) => e.world === "MAIN");
  assert.ok(mainEntries.length > 0, "manifest has a MAIN-world content script");
  for (const entry of mainEntries) {
    // Only this entry's files: in Chromium nothing from the isolated entry reaches the page world.
    const { sandbox, calls, video, timers } = fakePage();
    const ctx = vm.createContext(sandbox);
    for (const file of entry.js) vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), ctx, { filename: file });

    // Before content.js publishes settings, nothing happens and nothing throws.
    assert.doesNotThrow(() => timers.forEach((fn) => fn()));
    assert.deepEqual(calls, []);

    sandbox.document.documentElement.dataset.ytfSettings = JSON.stringify({
      enabled: true, speed: true, speedValue: "1.5", quality: true, qualityValue: "720", theater: false, subtitles: "default",
    });
    sandbox.document.dispatch("ytf-settings");
    assert.deepEqual(calls, [["rate", 1.5], ["range", "hd720", "hd720"], ["quality", "hd720"]]);
    assert.equal(video.playbackRate, 1.5);
  }
});
