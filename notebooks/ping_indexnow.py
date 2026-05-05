"""
ping_indexnow.py — push every URL in sitemap.xml to IndexNow (Bing,
Yandex, Naver, ChatGPT search, etc.). Run after a deploy so search
engines crawl the new content within minutes instead of days.

    python notebooks/ping_indexnow.py

The IndexNow protocol:
- A key file at https://www.jakecuth.com/<key>.txt confirms ownership.
- A POST to api.indexnow.org with a list of URLs triggers a recrawl.
- One key works for all participating engines (Bing fans out to peers).

Setup is already done: the key file lives at the repo root and ships
with each Cloudflare Pages deploy.
"""

from __future__ import annotations

import json
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOST = "www.jakecuth.com"
KEY  = "fa21add8723315e733624411374972b1"
ENDPOINT = "https://api.indexnow.org/indexnow"


def sitemap_urls() -> list[str]:
    tree = ET.parse(ROOT / "sitemap.xml")
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    locs = [u.text.strip() for u in tree.iter(f"{{{ns['sm']}}}loc") if u.text]
    # Force www host so the response 200s; apex resolves but Bing prefers
    # the canonical host the key file is served from.
    return [u.replace("https://jakecuth.com/", f"https://{HOST}/") for u in locs]


def main() -> int:
    urls = sitemap_urls()
    print(f"[indexnow] pinging {len(urls)} urls via {ENDPOINT}")

    body = {
        "host": HOST,
        "key": KEY,
        "keyLocation": f"https://{HOST}/{KEY}.txt",
        "urlList": urls,
    }
    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            print(f"[indexnow] HTTP {resp.status}  {resp.reason}")
            return 0 if resp.status < 400 else 1
    except urllib.error.HTTPError as e:
        # 200/202 are success. 400 = bad request, 403 = key/host mismatch,
        # 422 = url not under host. Print both code and body.
        body = e.read().decode("utf-8", errors="ignore")[:300]
        print(f"[indexnow] HTTP {e.code}  {e.reason}\n  body: {body}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
