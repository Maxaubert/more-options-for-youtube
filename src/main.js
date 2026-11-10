// Runs in the page itself (content script world "MAIN"), because only the page can call the YouTube
// player's own API. Applies speed, quality, theater mode and subtitles once per video. Settings come
// from content.js through <html data-ytf-settings>, since this world has no extension APIs.
(function () {
  "use strict";
  const Y = globalThis.YTF;
  const MAX_TRIES = 30; // about 15 s: quality levels and caption tracks appear only once the video loads

  let doneFor = "";
  let tries = 0;

  const settings = () => {
    try {
      return { ...Y.DEFAULTS, ...JSON.parse(document.documentElement.dataset.ytfSettings || "{}") };
    } catch {
      return { ...Y.DEFAULTS };
    }
  };

  function applyQuality(p, s) {
    if (!s.quality) return true;
    const levels = p.getAvailableQualityLevels ? p.getAvailableQualityLevels() : [];
    if (!levels.length) return false;
    const q = Y.pickQuality(levels, s.qualityValue);
    if (q) {
      if (p.setPlaybackQualityRange) p.setPlaybackQualityRange(q, q);
      if (p.setPlaybackQuality) p.setPlaybackQuality(q);
    }
    return true;
  }

  function applySpeed(p, s) {
    if (!s.speed) return true;
    const rate = Number(s.speedValue) || 1;
    if (p.setPlaybackRate) p.setPlaybackRate(rate);
    const video = p.querySelector("video");
    if (video && video.playbackRate !== rate) video.playbackRate = rate;
    return true;
  }

  let theaterClickedFor = "";
  function applyTheater(s, id) {
    if (!s.theater) return true;
    const flexy = document.querySelector("ytd-watch-flexy");
    if (!flexy) return false;
    // One click per video: the attribute can lag behind the click, and a second click would undo it.
    if (!flexy.hasAttribute("theater") && theaterClickedFor !== id) {
      const button = document.querySelector(".ytp-size-button");
      if (!button) return false;
      button.click();
      theaterClickedFor = id;
    }
    return true;
  }

  function applySubtitles(p, s) {
    if (s.subtitles === "default") return true;
    if (s.subtitles === "off") {
      if (p.setOption) p.setOption("captions", "track", {});
      if (p.unloadModule) p.unloadModule("captions");
      return true;
    }
    if (!p.getOption || !p.setOption) return true;
    if (p.loadModule) p.loadModule("captions");
    const tracks = p.getOption("captions", "tracklist") || [];
    if (!tracks.length) return false; // not loaded yet, or the video has none (then we give up after MAX_TRIES)
    const pick = Y.pickSubtitles(tracks, s.subtitles);
    if (!pick || pick === "off") return true;
    if (pick.track) p.setOption("captions", "track", pick.track);
    else p.setOption("captions", "track", { ...pick.translate, translationLanguage: { languageCode: pick.to } });
    return true;
  }

  // The playing video's title and channel, straight from the player, for smart autoplay in content.js.
  function publishVideo(p, id) {
    try {
      const d = p.getVideoData ? p.getVideoData() : null;
      if (!d || d.video_id !== id || !d.title) return;
      const json = JSON.stringify({ id, title: d.title, channel: d.author || "" });
      if (document.documentElement.dataset.ytfVideo !== json) document.documentElement.dataset.ytfVideo = json;
    } catch {
      // player API changed: smart autoplay falls back to the sidebar tiles
    }
  }

  function apply() {
    if (location.pathname !== "/watch") return;
    const id = new URLSearchParams(location.search).get("v");
    const p = document.getElementById("movie_player");
    if (id && p) publishVideo(p, id);
    if (!id || !p || id === doneFor) return;
    const s = settings();
    if (!s.enabled) return;
    let ok = true;
    for (const step of [() => applySpeed(p, s), () => applyQuality(p, s), () => applyTheater(s, id), () => applySubtitles(p, s)]) {
      try {
        ok = step() && ok;
      } catch {
        // The player API changes now and then; one failing default must not block the others.
      }
    }
    if (ok || ++tries >= MAX_TRIES) {
      doneFor = id;
      tries = 0;
    }
  }

  document.addEventListener("yt-navigate-finish", () => {
    tries = 0;
    apply();
  });
  document.addEventListener("ytf-settings", () => {
    doneFor = "";
    tries = 0;
    apply();
  });
  setInterval(apply, 500);
})();
