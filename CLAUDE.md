# More Options for YouTube

A Manifest V3 browser extension that filters YouTube and sets player defaults. One codebase for
Firefox/Zen, Chrome/Edge and Safari. Plain JavaScript, no bundler.

## Layout

- `src/parse.js`: pure text and rule logic, no DOM. Covered by `test/parse.test.js`. Put new logic here.
- `src/content.js`: finds tiles and hides them, smart autoplay, the ⋮ menu item.
- `src/main.js`: runs in the page (`world: MAIN`) to use the YouTube player API.
- `src/compat.js`: maps `chrome.*` to `browser.*` in Chrome.
- `popup/`: `popup.html` (the small popup: most-used switches) and `options.html` (the settings page: every
  setting). Both run `settings.js` and share `ui.css`. Every input has `data-key` = a key in `YTF.DEFAULTS`.
- Themes: `src/themes.css` sets YouTube's colour variables. YouTube also uses scrambled variable names that change
  per release; `content.js` finds them by value (`themeVarOverrides` in `parse.js`). Themes need YouTube's dark theme.

## Commands

```bash
npm test               # unit tests (node:test)
npm run lint           # web-ext lint (Firefox)
npm run build:chrome   # dist/chrome + Chrome zip (also the Safari source)
npm run sign           # sign <version>.1 unlisted (.xpi) for the local Zen install
npm run publish:amo    # send <version> to the AMO listing for review
npm run publish:chrome # upload to the Chrome Web Store and send for review
```

## Release

- Gates: `npm test` and `npm run lint` must pass. Check popup changes headless (Playwright with a stubbed
  `browser` object). Never open windows on the user's screen without asking.
- Version: bump `manifest.json` and `package.json` together in the PR. Patch for fixes, minor for features.
- **On every merge with a version bump, update both stores and Zen right away (Max's rule, 2026-11-10).
  The merge yes covers these steps; do not ask again:**
  1. `npm run publish:amo`: sends the version to the AMO listing for review.
  2. `npm run publish:chrome -- --replace`: sends it to the Chrome Web Store (cancels a version still in review).
  3. `npm run sign`: signs `<version>.1` unlisted, then open that .xpi in Zen. The user clicks Add.
  Docs- or tooling-only PRs without a version bump need none of this.
- Why `.1`: AMO keeps one version list for both channels. The local build uses `<version>.1`, so the store
  always gets the clean version.
- Details: [docs/chrome-web-store.md](docs/chrome-web-store.md), [docs/safari.md](docs/safari.md) (built on a Mac),
  store text and status in [docs/store-listing.md](docs/store-listing.md).

## Secrets

AMO keys (`amo-yt-filter`) and the Chrome service account key (`cws-yt-filter`) are in Windows Credential
Manager. Never print them or write them to the repo.
