"""Sign the extension as an unlisted Mozilla add-on.

The AMO API keys live in Windows Credential Manager (service "amo-yt-filter") and are passed to web-ext through
its environment only, so they are never printed or written to disk.

  python scripts/sign.py setup issuer   # copy the "JWT issuer" first; reads the clipboard
  python scripts/sign.py setup secret   # copy the "JWT secret" first
  python scripts/sign.py                # sign; the .xpi lands in web-ext-artifacts/
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import keyring

SERVICE = "amo-yt-filter"
ROOT = Path(__file__).resolve().parent.parent
IGNORE = ["test", "docs", "package.json", "package-lock.json", "scripts", "README.md", "node_modules"]


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


def sign() -> None:
    issuer, secret = keyring.get_password(SERVICE, "issuer"), keyring.get_password(SERVICE, "secret")
    if not issuer or not secret:
        sys.exit("No AMO keys saved. Run: python scripts/sign.py setup issuer, then setup secret.")
    env = {**os.environ, "WEB_EXT_API_KEY": issuer, "WEB_EXT_API_SECRET": secret}
    cmd = ["npx", "web-ext", "sign", "--channel", "unlisted", "--source-dir", str(ROOT),
           "--artifacts-dir", str(ROOT / "web-ext-artifacts"), "--ignore-files", *IGNORE]
    sys.exit(subprocess.run(cmd, env=env, cwd=ROOT, shell=os.name == "nt").returncode)


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "setup":
        setup(sys.argv[2])
    elif len(sys.argv) == 1:
        sign()
    else:
        sys.exit(__doc__)
