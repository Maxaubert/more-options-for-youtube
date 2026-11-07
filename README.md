<div align="center">

# YT Filter

A quiet YouTube home page. Hide what you never want to see, and set rules for the rest.

[![Firefox](https://img.shields.io/badge/Zen%20%2F%20Firefox-extension-E5484D?logo=firefoxbrowser&logoColor=white)](#install)
[![Manifest](https://img.shields.io/badge/Manifest-V3-E5484D)](manifest.json)
![Private](https://img.shields.io/badge/repo-private-555)

</div>

## What it hides

| Switch | What disappears from the home page |
|---|---|
| Shorts | Shorts shelves and single Shorts tiles |
| Playables | YouTube Playables (games) |
| News | "Breaking news" and "Trending" rows |
| Live | Livestreams, premieres and upcoming videos |
| Mixes | Auto-generated "Mix" tiles |
| Playlists | Playlist tiles |
| Watched | Videos you have already watched past a percentage you set |
| Older than | Videos older than an age you set (default 1 year) |
| Fewer views than | Videos below a view count you set |
| **Members only** | **Always on.** Videos that look normal but need a paid channel membership |

The same filters can also run on Search, Subscriptions and the sidebar next to a video (one switch).

| Grid and playback | What it does |
|---|---|
| Videos per row | Fewer, bigger tiles (YouTube caps tiles at 700 px; this lifts it) |
| Hide titles / channel names / views, date and likes | Thumbnail-only grid, if you want it |
| No previews on hover | Thumbnails stay still; the inline preview player is hidden and paused |
| Autoplay skips watched and repeats | When autoplay lands on a video you already played or watched, it jumps to the first new one in the sidebar |
| Start at speed / quality, Theater mode | Applied once per video, so changing it by hand still works |
| Subtitles | YouTube decides, always off, always Norwegian (auto-translated when there is no Norwegian track) or always English |

Works with YouTube in English and Norwegian. Settings live in the toolbar popup and apply
immediately. On a page the filters cover, the popup also counts what it hid, and why.

## Install

The extension is signed by Mozilla as an **unlisted** add-on (private, not in the store).

1. Run `npm run sign` (needs the AMO API keys, see below). The signed file lands in `web-ext-artifacts/`.
2. Open the `.xpi` in Zen and click **Add**.

**API keys (once):** create them at
[addons.mozilla.org/developers/addon/api/key](https://addons.mozilla.org/developers/addon/api/key/), copy each one and store it in
Windows Credential Manager with `python scripts/sign.py setup issuer` and `python scripts/sign.py setup secret`
(each reads your clipboard). The keys are never printed or written to a file.

## Develop

```bash
npm test          # parser and rule tests (node:test, no browser)
npm run lint      # web-ext lint
npm run dev       # run in a throwaway Firefox profile
```

| File | Job |
|---|---|
| `src/parse.js` | Pure text reading: ages, view counts, badges. Tested |
| `src/content.js` | Finds tiles and shelves and hides the ones that match; smart autoplay; CSS switches |
| `src/main.js` | Runs in the page itself to call the YouTube player (speed, quality, theater, subtitles) |
| `popup/` | Settings and the "hidden on this page" counter |

YouTube changes its page often. When something stops being hidden, the fix is usually a selector in
`src/content.js` or a phrase in `src/parse.js` (add a test for it).
