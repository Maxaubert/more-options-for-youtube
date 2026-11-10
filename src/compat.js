// Chrome names the extension API "chrome"; Firefox and Safari call it "browser". Both return promises
// in Manifest V3, so the rest of the code can use "browser" everywhere. Loaded first in the content
// script and the popup (not in the page's own world, which has neither).
if (typeof globalThis.browser === "undefined" && typeof globalThis.chrome !== "undefined") {
  globalThis.browser = globalThis.chrome;
}
