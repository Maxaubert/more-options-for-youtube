# Chrome Web Store listing

Text and answers for the Chrome Web Store Developer Dashboard (https://chrome.google.com/webstore/devconsole).
Written 2026-11-10. The store text itself is shared with AMO: see [store-listing.md](store-listing.md).

## Status

- Submitted for review 2026-11-10: version 0.5.2, public, free, all regions.
- Item ID: `igjngbapajhfjnbldgacaajdccpfnfcp`
- Store page (live after review): https://chromewebstore.google.com/detail/igjngbapajhfjnbldgacaajdccpfnfcp
- Publisher: "Max Aubert" (account aubert.mx@gmail.com), publisher ID `79aa3a03-308d-45ec-9fc4-c45581e688e7`,
  non-trader (EU), public contact email aubert@post.com (verified).
- Dashboard: https://chrome.google.com/u/1/webstore/devconsole/79aa3a03-308d-45ec-9fc4-c45581e688e7
- Lessons: Chrome extensions (Claude in Chrome) cannot script Web Store pages; Flare's browser panel can, but
  the card 3-D Secure check is blocked there (Flare issue #146), so pay in a normal browser.

## Upload

- Package: `npm run build:chrome` makes `web-ext-artifacts/more_options_for_youtube-chrome-<version>.zip`
  (the manifest without the Firefox-only keys).
- Every new upload needs a higher version than the last one in this store. Chrome and AMO count versions
  separately.
- Developer account: one-time $5 fee, paid by Max himself.

## Updates from the command line (API)

Set up 2026-11-10 with the Chrome Web Store API v2 and a service account (no browser needed after that):

- Google Cloud project "more-options-for-youtube" (account aubert.mx@gmail.com), Chrome Web Store API enabled.
- Service account `cws-publisher@more-options-for-youtube.iam.gserviceaccount.com`, added in the dashboard under
  Settings > Tjenestekonto (only one per publisher). It needs no Cloud roles.
- Its JSON key is in Windows Credential Manager, service `cws-yt-filter`, split into parts
  (`python scripts/publish-chrome.py setup key.json`, then delete the file).
- Release: bump the version, then `npm run publish:chrome` (builds, uploads, submits for review).
  `-- --dry-run` checks sign-in and status without uploading; `-- --upload-only` stops before submitting;
  `python scripts/publish-chrome.py status` shows the store state.

## Store listing tab

| Field | Value |
|---|---|
| Title | From the manifest: More Options for YouTube |
| Summary | From the manifest description (max 132 characters) |
| Description | The "Description" section of [store-listing.md](store-listing.md), as plain text (no markdown) |
| Category | Tools (under Productivity) |
| Language | English |
| Store icon | `icons/icon-128.png` (128 x 128) |
| Screenshots | `docs/store/chrome-1.png` to `chrome-3.png` (1280 x 800, the tabbed popup) |
| Homepage URL | https://github.com/Maxaubert/more-options-for-youtube |
| Support URL | https://github.com/Maxaubert/more-options-for-youtube/issues |

## Privacy tab

**Single purpose:**
Change how YouTube looks and plays for the user: hide the kinds of videos they choose (Shorts,
members-only, old, watched, filtered by channel or title), tidy the video grid, and set player defaults
such as speed, quality and subtitles.

**Permission justifications:**
- `storage`: saves the user's settings and the list of videos already played, in the browser only.
- Host permission `*://www.youtube.com/*`: the extension only works on YouTube. It reads the video tiles
  on YouTube pages to hide the ones the user filters out, sets the player defaults, and reads the user's
  own YouTube memberships page so members-only videos from channels they pay for stay visible.

**Remote code:** No, I am not using remote code. All code is in the package.

**Data usage:** collects none of the listed data types. Tick all three certifications (no selling, no
use outside the single purpose, no use for credit decisions).

**Privacy policy URL:** https://github.com/Maxaubert/more-options-for-youtube#privacy (no data is collected;
the README's Privacy section says so).

## Distribution tab

Public, all regions, free.
