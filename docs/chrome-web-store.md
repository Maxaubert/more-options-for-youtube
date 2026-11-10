# Chrome Web Store

Answers for the Chrome Web Store dashboard, and how updates are sent. The store text is in
[store-listing.md](store-listing.md).

## Item

- Item ID: `igjngbapajhfjnbldgacaajdccpfnfcp`
- Store page (live after review): https://chromewebstore.google.com/detail/igjngbapajhfjnbldgacaajdccpfnfcp
- Publisher: "Max Aubert" (Google account aubert.mx@gmail.com), publisher ID `79aa3a03-308d-45ec-9fc4-c45581e688e7`.
  Non-trader (EU). Public contact email: aubert@post.com.
- Dashboard: https://chrome.google.com/u/1/webstore/devconsole/79aa3a03-308d-45ec-9fc4-c45581e688e7

## Send an update

1. Raise the version in `manifest.json` and `package.json`. It must be higher than the last version in
   this store. Chrome and AMO count versions separately.
2. Run `npm run publish:chrome`. It builds `dist/chrome`, uploads the zip and sends it for review.

If a version is still in review, Google refuses the upload. `npm run publish:chrome -- --replace` cancels
that review and sends the new version; the review starts again.

Other commands:
- `npm run publish:chrome -- --dry-run`: build and sign in, but upload nothing.
- `npm run publish:chrome -- --upload-only`: upload, but do not send for review.
- `python scripts/publish-chrome.py status`: show what the store has now.
- `python scripts/publish-chrome.py cancel`: cancel the version in review.

How sign-in works: Google Cloud project `more-options-for-youtube` has the Chrome Web Store API on.
The service account `cws-publisher@more-options-for-youtube.iam.gserviceaccount.com` is added in the
dashboard (Settings > Service account). Its key is in Windows Credential Manager (service `cws-yt-filter`).
To replace the key: make a new JSON key in Cloud Console, run `python scripts/publish-chrome.py setup key.json`,
then move the file to the Recycle Bin.

## Store listing tab

| Field | Value |
|---|---|
| Description | "Description" in [store-listing.md](store-listing.md), as plain text |
| Category | Tools (under Productivity) |
| Language | English |
| Store icon | `icons/icon-128.png` |
| Screenshots | `docs/store/screenshot-1.png` to `-3.png` (1280 x 800) |
| Homepage URL | https://github.com/Maxaubert/more-options-for-youtube |
| Support URL | https://github.com/Maxaubert/more-options-for-youtube/issues |

## Privacy tab

**Single purpose:** Change how YouTube looks and plays for the user: hide the kinds of videos they choose
(Shorts, members-only, old, watched, or filtered by channel and title), tidy the video grid, and set player
defaults such as speed, quality and subtitles.

**Why `storage`:** It saves the user's settings, their filter lists, and the list of videos already played.
Everything stays in the browser.

**Why the host permission `*://www.youtube.com/*`:** The extension only works on YouTube. It reads the video
tiles to hide the ones the user filters out, sets the player defaults, and reads the user's own memberships
page so members-only videos from channels they pay for stay visible.

**Remote code:** None. All code is in the package.

**Data use:** No data types collected. All three certifications ticked.

**Privacy policy URL:** https://github.com/Maxaubert/more-options-for-youtube#privacy

## Distribution tab

Free, public, all regions.

## Lessons (2026-11-10)

- Claude in Chrome cannot control Web Store pages; Chrome blocks extensions there. Flare's browser panel can.
- Flare's panel cannot do the card check (3-D Secure) or save downloads. Do those in a normal browser.
