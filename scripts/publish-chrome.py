"""Upload a new version to the Chrome Web Store and submit it for review (Chrome Web Store API v2).

Uses a Google Cloud service account that is added to the publisher in the Chrome Web Store dashboard
(Settings > Service account). Its JSON key lives in Windows Credential Manager (service "cws-yt-filter"),
split into parts because one entry holds at most 2560 bytes. Nothing is printed or written to disk.

  python scripts/publish-chrome.py setup PATH\\TO\\key.json   # once; then delete the downloaded key file
  python scripts/publish-chrome.py status                     # what the store has now
  python scripts/publish-chrome.py --dry-run                  # build and sign in, but upload nothing
  python scripts/publish-chrome.py                            # build, upload and submit for review
  python scripts/publish-chrome.py --upload-only              # build and upload, submit by hand later

API reference: https://developer.chrome.com/docs/webstore/using-api (checked 2026-11-10).
"""

from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path

import keyring
import requests
from google.auth.transport.requests import Request
from google.oauth2 import service_account

SERVICE = "cws-yt-filter"
PUBLISHER = "79aa3a03-308d-45ec-9fc4-c45581e688e7"
ITEM = "igjngbapajhfjnbldgacaajdccpfnfcp"
SCOPE = "https://www.googleapis.com/auth/chromewebstore"
API = f"https://chromewebstore.googleapis.com/v2/publishers/{PUBLISHER}/items/{ITEM}"
UPLOAD = f"https://chromewebstore.googleapis.com/upload/v2/publishers/{PUBLISHER}/items/{ITEM}:upload"
ROOT = Path(__file__).resolve().parent.parent
CHUNK = 1000  # characters per Credential Manager entry (stored as UTF-16, limit 2560 bytes)


def setup(path: str) -> None:
    info = json.loads(Path(path).read_text(encoding="utf-8"))
    if info.get("type") != "service_account" or "private_key" not in info:
        sys.exit("That file is not a service account key (JSON).")
    keep = {k: info[k] for k in ("client_email", "private_key", "token_uri", "project_id") if k in info}
    text = json.dumps(keep)
    parts = [text[i:i + CHUNK] for i in range(0, len(text), CHUNK)]
    old = int(keyring.get_password(SERVICE, "parts") or 0)
    for i, part in enumerate(parts):
        keyring.set_password(SERVICE, f"part{i}", part)
    for i in range(len(parts), old):
        keyring.delete_password(SERVICE, f"part{i}")
    keyring.set_password(SERVICE, "parts", str(len(parts)))
    print(f"Saved the key for {keep['client_email']} in {len(parts)} parts. Delete the downloaded file now.")


def credentials() -> service_account.Credentials:
    count = keyring.get_password(SERVICE, "parts")
    if not count:
        sys.exit("No key saved. Run: python scripts/publish-chrome.py setup PATH\\TO\\key.json")
    info = json.loads("".join(keyring.get_password(SERVICE, f"part{i}") for i in range(int(count))))
    info["type"] = "service_account"
    creds = service_account.Credentials.from_service_account_info(info, scopes=[SCOPE])
    creds.refresh(Request())
    return creds


def call(method: str, url: str, token: str, **kw) -> dict:
    r = requests.request(method, url, headers={"Authorization": f"Bearer {token}"}, timeout=120, **kw)
    if not r.ok:
        sys.exit(f"{method} {url.split('/items/')[-1]} failed: HTTP {r.status_code}\n{r.text[:2000]}")
    return r.json() if r.text else {}


def build() -> Path:
    version = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))["version"]
    subprocess.run(["node", str(ROOT / "scripts" / "build-chrome.mjs")], cwd=ROOT, check=True)
    zip_path = ROOT / "web-ext-artifacts" / f"more_options_for_youtube-chrome-{version}.zip"
    if not zip_path.exists():
        sys.exit(f"Build did not make {zip_path.name}")
    return zip_path


def main(args: list[str]) -> None:
    if args[:1] == ["setup"] and len(args) == 2:
        return setup(args[1])
    if args == ["status"]:
        print(json.dumps(call("GET", f"{API}:fetchStatus", credentials().token), indent=2))
        return
    unknown = set(args) - {"--dry-run", "--upload-only"}
    if unknown:
        sys.exit(__doc__)

    zip_path = build()
    token = credentials().token
    status = call("GET", f"{API}:fetchStatus", token)
    print("Store status before upload:\n" + json.dumps(status, indent=2))
    if "--dry-run" in args:
        print(f"Dry run: would upload {zip_path.name} ({zip_path.stat().st_size} bytes). Nothing sent.")
        return

    r = requests.post(UPLOAD, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/zip"},
                      data=zip_path.read_bytes(), timeout=300)
    if not r.ok:
        sys.exit(f"Upload failed: HTTP {r.status_code}\n{r.text[:2000]}")
    result = r.json()
    state = result.get("uploadState")
    for _ in range(30):
        if state != "UPLOAD_IN_PROGRESS":
            break
        time.sleep(5)
        state = call("GET", f"{API}:fetchStatus", token).get("lastAsyncUploadState", state)
    print(f"Upload: {state}\n" + json.dumps(result, indent=2))
    if state not in ("SUCCEEDED", "UPLOAD_SUCCEEDED", None):
        sys.exit("Upload did not succeed; not submitting.")
    if "--upload-only" in args:
        print("Uploaded. Submit it in the dashboard, or run this script again without --upload-only.")
        return
    print("Submitted for review:\n" + json.dumps(call("POST", f"{API}:publish", token, json={}), indent=2))


if __name__ == "__main__":
    main(sys.argv[1:])
