"""Sign the extension with Mozilla (AMO): an unlisted build for the local Zen install, or the listed store version.

AMO keeps one version list for both channels, so a version can be used only once. The local build therefore
gets the version "<manifest version>.1" (for example 0.5.5.1) and the store gets the clean version (0.5.5).

The AMO API keys live in Windows Credential Manager (service "amo-yt-filter") and are passed to web-ext through
its environment only, so they are never printed or written to disk.

  python scripts/sign.py setup issuer   # copy the "JWT issuer" first; reads the clipboard
  python scripts/sign.py setup secret   # copy the "JWT secret" first
  python scripts/sign.py                # unlisted <version>.1 for Zen; the .xpi lands in web-ext-artifacts/
  python scripts/sign.py listed         # send <version> to the public listing for review (npm run publish:amo)
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import keyring

SERVICE = "amo-yt-filter"
ROOT = Path(__file__).resolve().parent.parent
SHIP = ["manifest.json", "LICENSE", "src", "popup", "icons"]  # what goes in the package


def clipboard() -> str:
    out = subprocess.run(["powershell", "-NoProfile", "-Command", "Get-Clipboard -Raw"],
                         capture_output=True, text=True, check=True)
    return out.stdout.strip()


def setup(name: str) -> None:
    if name not in ("issuer", "secret"):
        sys.exit("Use: setup issuer | setup secret")
    value = clipboard()
    if not value or " " in value or len(value) < 10:
        sys.exit("The clipboard does not look like an AMO key. Copy it from the AMO page and try again.")
    keyring.set_password(SERVICE, name, value)
    print(f"Saved the {name} ({len(value)} characters).")


def env() -> dict:
    issuer, secret = keyring.get_password(SERVICE, "issuer"), keyring.get_password(SERVICE, "secret")
    if not issuer or not secret:
        sys.exit("No AMO keys saved. Run: python scripts/sign.py setup issuer, then setup secret.")
    return {**os.environ, "WEB_EXT_API_KEY": issuer, "WEB_EXT_API_SECRET": secret}


def copy_package(dest: Path, version: str | None = None) -> None:
    """Copy only the shipped files to dest; optionally change the manifest version."""
    for name in SHIP:
        src = ROOT / name
        if src.is_dir():
            shutil.copytree(src, dest / name, ignore=shutil.ignore_patterns("__pycache__"))
        else:
            shutil.copy2(src, dest / name)
    if version:
        manifest = json.loads((dest / "manifest.json").read_text(encoding="utf-8"))
        manifest["version"] = version
        (dest / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def sign(channel: str) -> int:
    version = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))["version"]
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp)
        copy_package(src, f"{version}.1" if channel == "unlisted" else None)
        cmd = ["npx", "web-ext", "sign", "--channel", channel, "--source-dir", str(src),
               "--artifacts-dir", str(ROOT / "web-ext-artifacts")]
        if channel == "listed":
            cmd += ["--approval-timeout", "0"]  # do not wait for the human review
        return subprocess.run(cmd, env=env(), cwd=ROOT, shell=os.name == "nt").returncode


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "setup":
        setup(sys.argv[2])
    elif len(sys.argv) == 1:
        sys.exit(sign("unlisted"))
    elif sys.argv[1:] == ["listed"]:
        sys.exit(sign("listed"))
    else:
        sys.exit(__doc__)
