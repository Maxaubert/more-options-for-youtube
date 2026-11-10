# Store listing draft (addons.mozilla.org)

Draft for the public listing. **Max submits it himself**; nothing here is uploaded automatically.
Status 2026-11-10: 0.3.9 (channel title filters) uploaded to the listed channel with `web-ext sign --channel listed`.

## Name

More Options for YouTube (checked free on AMO 2026-11-07; "Better YouTube" is taken twice).
Mozilla's rules discourage starting a name with someone else's brand, so "… for YouTube" is the safe form.

## Summary (max 250 characters)

Hide Shorts, members-only videos and old or low-view videos. Block channels and words, stop hover
previews, skip repeats in autoplay, and start every video at your speed, quality and subtitles.

## Description

A calmer YouTube, on your terms.

**Hide what you never want to see**
- Shorts, Playables, news and trending rows, live streams, mixes and playlists, each with its own switch
- Members-only videos: the ones that look normal until you click and hit a paywall. By default you only see them from channels you are a paying member of
- Videos older than an age you pick, or with fewer views than a number you pick
- Videos you have already watched
- Channels and title words you list, or straight from a video's ⋮ menu with "Block channel"
- Keep only some videos from a channel, for example only the "Before you buy" videos from Gameranx

Works on the home page, and if you like on Search, Subscriptions and the list next to a video.

**A tidier grid**
- Choose how many videos per row for bigger thumbnails
- Hide titles, channel names, channel icons, or views and dates, one switch each
- No more videos playing when you hover over a thumbnail

**Your player, your defaults**
- Autoplay that skips videos you have already watched or played, so it stops looping the same few
- Start every video at your speed, quality and in theater mode
- Subtitles always off, or always in Norwegian or English (auto-translated when needed)
- Open Shorts in the normal player, hide end cards, hide comments

Everything is a switch in the toolbar popup, in large, clear type, and changes apply instantly.
Reads YouTube in English and Norwegian.

**Privacy:** no data leaves your browser. No accounts, no tracking, no analytics. Settings are stored
locally by your browser.

**Open source:** the code is on GitHub at https://github.com/Maxaubert/more-options-for-youtube (MIT licence). Bug
reports and ideas are welcome there.

## Fields

| Field | Value |
|---|---|
| Categories | Appearance; Photos, Music & Videos |
| Tags | youtube, shorts, filter, autoplay, accessibility |
| License | MIT (`LICENSE`) |
| Privacy policy | Not required: the add-on collects no data (`data_collection_permissions: none` in the manifest) |
| Support | None for now (Max, 2026-11-07); the GitHub link is in the description |
| Source code | Not needed: the code is not minified or bundled |
| Screenshots | `docs/store/screenshot-1.png` to `-3.png` (1280x800, made from the real popup) |

## Still to do before submitting

- [x] Icon: Max's play + plus (icons/icon.svg). Note: close to the YouTube logo; Max chose to submit it as is and change it if review objects
- [x] Screenshots (docs/store/)
- [x] License (MIT) and support contact (none)
- [x] Max reviewed a local preview of the page (2026-11-07)
- [x] Submitted for review 2026-11-07: version 0.3.3, listed, MIT, categories Appearance + Photos, Music & Videos (status "nominated")
- [ ] Screenshots on AMO (Edit Product Page > Media) and Contributions URL https://ko-fi.com/maxaubert

## How to submit (Max does this)

The add-on already exists on AMO as unlisted (same ID, `yt-filter@loftspace`), so the public listing is a new
version of it. Every upload needs a version number AMO has not seen; the unlisted ones used 0.1.0 to 0.3.1, 0.3.4 to 0.3.6 and 0.3.8.

Pattern (2026-11-10): sign version N unlisted for the local install (`npm run sign`), then bump to N+1 and
upload that to the listed channel:
`npx web-ext sign --channel listed --approval-timeout 0` with the AMO keys from `scripts/sign.py` in the environment.

1. Build the upload file: `npm run build` (makes `web-ext-artifacts/more_options_for_youtube-<version>.zip`).
2. AMO Developer Hub → My Add-ons → More Options for YouTube → Upload New Version → "On this site".
3. Upload the zip, answer "No" to the source code question, and fill in the listing from this file.
