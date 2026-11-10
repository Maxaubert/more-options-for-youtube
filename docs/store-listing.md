# Store text

One source for the text on both stores. Firefox (AMO) uses this file as is.
The Chrome Web Store uses the same text as plain text, with no markdown. Chrome-only answers are in
[chrome-web-store.md](chrome-web-store.md).

## Status

Every merge with a version bump goes to both stores (see the Release section in [CLAUDE.md](../CLAUDE.md)),
so each store has the newest version in review or live. To check:
- AMO: Developer Hub > More Options for YouTube > Manage Status & Versions.
- Chrome: `python scripts/publish-chrome.py status`.

Neither store had the add-on public on 2026-11-10; both were reviewing 0.5.5.

## Name

More Options for YouTube.
Mozilla does not want a name that starts with someone else's brand. "… for YouTube" is the safe form.

## Summary (max 250 characters on AMO, 132 on Chrome)

The manifest `description` is the summary on both stores:
Hide Shorts, members-only and old videos, block channels, skip repeats in autoplay, and set your player defaults.

## Description

A calmer YouTube, on your terms.

**Hide what you never want to see**
- Shorts, Playables, news and trending rows, live streams, mixes and playlists, each with its own switch
- Members-only videos: the ones that look normal until you click and hit a paywall. By default you only see them from channels you are a paying member of
- Videos older than an age you pick, with fewer views than a number you pick, or already watched past a percentage you pick
- Channels and title words you list, or straight from a video's ⋮ menu with "Block channel"
- Filter a channel by title: show only one series from a channel, or hide some of its titles

Works on the home page and in the list next to a video. Search and Subscriptions stay as YouTube shows them.

**A tidier grid**
- Choose how many videos per row for bigger thumbnails
- Hide titles, channel names, channel icons, or views, dates and likes, one switch each
- No more videos playing when you hover over a thumbnail

**Your player, your defaults**
- Autoplay that skips videos you have already watched or played, and never plays a video your filters hide
- Start every video at your speed, quality and in theater mode
- Subtitles always off, or always in Norwegian or English (auto-translated when needed)
- Open Shorts in the normal player, hide end cards, hide comments

Everything sits in four tabs in the toolbar popup, in large, clear type, and changes apply instantly.
Reads YouTube in English and Norwegian.

**Privacy:** no data leaves your browser. No accounts, no tracking, no analytics. Settings are stored
locally by your browser. The only request the extension makes is to read your own YouTube memberships
page, with your own YouTube session.

Like it? You can support it at https://ko-fi.com/maxaubert

**Open source:** the code is on GitHub at https://github.com/Maxaubert/more-options-for-youtube (MIT licence).
Bug reports and ideas are welcome there.

## AMO fields

| Field | Value |
|---|---|
| Categories | Appearance; Photos, Music & Videos |
| Tags | youtube, shorts, filter, autoplay, accessibility |
| Licence | MIT |
| Privacy policy | Not needed. The add-on collects no data (`data_collection_permissions: none`). |
| Support | The GitHub link in the description |
| Source code | Not needed. The code is not minified or bundled. |
| Contributions URL | https://ko-fi.com/maxaubert |
| Screenshots | `docs/store/screenshot-1.png` to `-3.png` (1280 x 800, the tabbed popup) |

## To do on AMO (Max, in the Developer Hub)

- [ ] Upload the new screenshots (Edit Product Page > Media).
- [ ] Set the Contributions URL.
