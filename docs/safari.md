# Safari (on a Mac)

Safari runs the same code as Chrome. Apple only lets you wrap it into a Safari extension with Xcode on a
Mac, so these steps happen there. Written 2026-11-10.

## What you need

- A Mac with Xcode (free from the App Store) and Node.js.
- For your own Mac only: nothing else. To put it in the App Store: an Apple Developer account ($99 a year).

## Build and run

1. Get the code and build the Chrome copy, which Safari uses as well:
   ```sh
   git clone https://github.com/Maxaubert/more-options-for-youtube.git
   cd more-options-for-youtube
   npm install
   npm run build:chrome -- --no-zip
   ```
2. Turn it into an Xcode project:
   ```sh
   xcrun safari-web-extension-converter dist/chrome \
     --app-name "More Options for YouTube" \
     --bundle-identifier com.maxaubert.moreoptions \
     --swift --macos-only --copy-resources --no-open
   ```
   Leave out `--macos-only` to also get an iPhone and iPad version.
3. Open the new `.xcodeproj` in Xcode. Under Signing & Capabilities, pick your team (your Apple ID works
   for running it on your own Mac). Press Run (Cmd+R). A small app opens; you can close it.
4. In Safari: Settings > Advanced > tick "Show features for web developers". Then Develop > tick
   "Allow Unsigned Extensions". Safari forgets this tick each time it restarts, until the extension is
   signed for the App Store.
5. Safari > Settings > Extensions > tick "More Options for YouTube", and allow it on www.youtube.com.

## What to check

- Home page: Shorts and news rows are hidden; the popup opens from the toolbar.
- The popup: tabs, switches and the Filter out field save and apply at once.
- A video: start speed, quality and theater mode apply. These use the player script that runs in the
  page itself (`"world": "MAIN"` in the manifest). Safari 16.4 and newer support that world for scripts
  registered from code ([Apple forum](https://developer.apple.com/forums/thread/728849)); support for the
  manifest key was not confirmed when this was written. If speed, quality or theater do not apply, that is
  the reason, and the fix is to register `src/main.js` from a background script instead.
- Autoplay: let a video end and check the next one is not filtered or already watched.

## After a code change

Run `npm run build:chrome -- --no-zip` again, then Run in Xcode. With `--copy-resources` the project holds
its own copy, so run the converter again (step 2) if files were added or renamed.
