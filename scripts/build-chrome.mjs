// Builds the Chrome (and Safari) copy of the extension in dist/chrome and zips it for the Chrome Web Store.
// The code is the same as for Firefox; only the manifest drops the Firefox-only keys, which Chrome
// otherwise flags as unknown.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist", "chrome");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
delete manifest.browser_specific_settings;
writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
for (const dir of ["src", "popup", "icons"]) cpSync(join(root, dir), join(out, dir), { recursive: true });
cpSync(join(root, "LICENSE"), join(out, "LICENSE"));

if (!process.argv.includes("--no-zip")) {
  const name = `more_options_for_youtube-chrome-${manifest.version}.zip`;
  execSync(`npx web-ext build --source-dir "${out}" --artifacts-dir "${join(root, "web-ext-artifacts")}" --filename ${name} --overwrite-dest`, {
    cwd: root,
    stdio: "inherit",
  });
}
console.log("Chrome build in dist/chrome");
