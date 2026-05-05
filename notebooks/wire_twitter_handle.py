"""
wire_twitter_handle.py — adds twitter:site / twitter:creator meta tags to
every HTML page on the site (homepage, labs, notes, listing pages).
Idempotent: re-running on already-patched pages is a no-op.

    python notebooks/wire_twitter_handle.py
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HANDLE = "@ItsCuthulhu"

# Tags we want to ensure are present, in this exact order, immediately after
# the existing twitter:image line (which every page already has).
SITE_TAG    = f'<meta name="twitter:site" content="{HANDLE}">'
CREATOR_TAG = f'<meta name="twitter:creator" content="{HANDLE}">'

RE_TW_IMG  = re.compile(r'(<meta\s+name="twitter:image"\s+content="[^"]+"\s*/?>)')
RE_TW_SITE = re.compile(r'<meta\s+name="twitter:site"\s+content="[^"]+"\s*/?>')
RE_TW_CRTR = re.compile(r'<meta\s+name="twitter:creator"\s+content="[^"]+"\s*/?>')


def patch(html: str) -> tuple[str, bool]:
    """Insert site/creator tags right after twitter:image. No-op if already
    set or twitter:image is missing."""
    if RE_TW_SITE.search(html) and RE_TW_CRTR.search(html):
        # Both present — replace handle in case it changed.
        html = RE_TW_SITE.sub(SITE_TAG, html, count=1)
        html = RE_TW_CRTR.sub(CREATOR_TAG, html, count=1)
        return html, False
    m = RE_TW_IMG.search(html)
    if not m:
        return html, False
    insertion = "\n  " + SITE_TAG + "\n  " + CREATOR_TAG
    new = html[:m.end()] + insertion + html[m.end():]
    return new, True


def main() -> None:
    paths = []
    paths.append(ROOT / "index.html")
    paths += sorted((ROOT / "work").glob("*/index.html"))
    paths += sorted((ROOT / "notes").glob("*/index.html"))
    paths.append(ROOT / "notes" / "index.html")
    # de-dup while keeping order
    seen = set()
    paths = [p for p in paths if p.exists() and not (p in seen or seen.add(p))]

    patched = noop = 0
    for p in paths:
        text = p.read_text(encoding="utf-8")
        new, changed = patch(text)
        if new != text:
            p.write_text(new, encoding="utf-8")
            patched += 1
            print(f"  wire {p.relative_to(ROOT)}")
        else:
            noop += 1
    print(f"[twitter] {patched} patched, {noop} unchanged → handle = {HANDLE}")


if __name__ == "__main__":
    main()
