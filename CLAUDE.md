# More Options for YouTube

A Manifest V3 browser extension that filters YouTube and sets player defaults. One codebase for
Firefox/Zen, Chrome/Edge and Safari. Plain JavaScript, no bundler.

## Layout

- `src/parse.js`: pure text and rule logic, no DOM. Covered by `test/parse.test.js`. Put new logic here.
- `src/content.js`: finds tiles and hides them, smart autoplay, the ⋮ menu item.
- `src/main.js`: runs in the page (`world: MAIN`) to use the YouTube player API.
- `src/compat.js`: maps `chrome.*` to `browser.*` in Chrome.
- `popup/`: the settings window (four tabs). Every input has `data-key` = a key in `YTF.DEFAULTS`.

## Commands

```bash
npm test               # unit tests (node:test)
npm run lint           # web-ext lint (Firefox)
npm run build:chrome   # dist/chrome + Chrome zip (also the Safari source)
npm run sign           # sign an unlisted Firefox build (.xpi) for the local Zen install
npm run publish:chrome # upload to the Chrome Web Store and send for review
```

## Release

- Gates: `npm test` and `npm run lint` must pass. Check popup changes headless (Playwright with a stubbed
  `browser` object). Never open windows on the user's screen without asking.
- Version: bump `manifest.json` and `package.json` together in the PR. Patch for fixes, minor for features.
- Local Zen install: `npm run sign`, then open the .xpi in Zen. The user clicks Add.
- AMO listed: AMO keeps one version list for both channels. After an unlisted signing of version N, the
  listed upload must be N+1: `npx web-ext sign --channel listed --approval-timeout 0` with the AMO keys
  from Credential Manager (see `scripts/sign.py`).
- Chrome Web Store: `npm run publish:chrome`. See [docs/chrome-web-store.md](docs/chrome-web-store.md).
- Safari: built on a Mac. See [docs/safari.md](docs/safari.md).
- Store text and status: [docs/store-listing.md](docs/store-listing.md).

## Secrets

AMO keys (`amo-yt-filter`) and the Chrome service account key (`cws-yt-filter`) are in Windows Credential
Manager. Never print them or write them to the repo.
