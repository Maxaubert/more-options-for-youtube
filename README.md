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

Works with YouTube in English and Norwegian. Settings live in the toolbar popup and apply
immediately. The popup also counts what it hid on the current page, and why.

> [!NOTE]
> It only filters the home page (`youtube.com/`). Search, Subscriptions and watch pages are untouched.

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
| `src/content.js` | Finds tiles and shelves on the page and hides the ones that match |
| `popup/` | Settings and the "hidden on this page" counter |

YouTube changes its page often. When something stops being hidden, the fix is usually a selector in
`src/content.js` or a phrase in `src/parse.js` (add a test for it).
