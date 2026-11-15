// Pure player choices for main.js: no DOM, so node:test can cover it.
// Its own file, loaded only in the page world (manifest entry with world "MAIN"). Chromium injects a script
// file at most once per frame, whatever the world, so a file listed in both content-script entries runs in
// the first world only. That left main.js without its helpers in Chrome and Edge (fixed in 0.7.4).
// test/manifest.test.js checks that no file is listed in two entries.
(function (root) {
  "use strict";

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

  const YTFPlayer = { pickQuality, pickSubtitles };
  if (typeof module !== "undefined" && module.exports) module.exports = YTFPlayer;
  root.YTFPlayer = YTFPlayer;
})(typeof globalThis !== "undefined" ? globalThis : this);
