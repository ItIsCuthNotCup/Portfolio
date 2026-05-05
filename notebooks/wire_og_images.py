"""
wire_og_images.py — replace each lab's shared og:image / twitter:image
with its per-lab card. Run from repo root after generate_og_images.py:

    python notebooks/wire_og_images.py

Idempotent: re-running on already-patched files is a no-op.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "work"
OG_DIR = ROOT / "assets" / "og"

# Match either old shared card or any existing per-lab card, so reruns work.
RE_OG = re.compile(
    r'<meta\s+property="og:image"\s+content="https://jakecuth\.com/[^"]+"\s*/?>',
)
RE_TW = re.compile(
    r'<meta\s+name="twitter:image"\s+content="https://jakecuth\.com/[^"]+"\s*/?>',
)


def patch(html: str, slug: str) -> tuple[str, int]:
    # NOTE: use www. — apex jakecuth.com isn't currently reachable, so a
    # bare-apex og:image URL fails when Twitter/Facebook crawlers fetch
    # it. The canonical link tag still points to apex (correct for SEO);
    # only the og:image / twitter:image are pinned to the working host.
    new_url = f'https://www.jakecuth.com/assets/og/{slug}.png?v=1'
    og_line = f'<meta property="og:image" content="{new_url}">'
    tw_line = f'<meta name="twitter:image" content="{new_url}">'
    n = 0
    if RE_OG.search(html):
        html = RE_OG.sub(og_line, html, count=1)
        n += 1
    if RE_TW.search(html):
        html = RE_TW.sub(tw_line, html, count=1)
        n += 1
    return html, n


def main() -> None:
    patched = 0
    skipped = 0
    for d in sorted(WORK.iterdir()):
        idx = d / "index.html"
        if not idx.exists():
            continue
        slug = d.name
        png = OG_DIR / f"{slug}.png"
        if not png.exists():
            print(f"  skip {slug}: no card at {png.name}")
            skipped += 1
            continue
        text = idx.read_text(encoding="utf-8")
        new, n = patch(text, slug)
        if n == 0:
            print(f"  noop {slug}: no og:image / twitter:image found")
            continue
        if new != text:
            idx.write_text(new, encoding="utf-8")
            print(f"  wire {slug}: {n} line(s) patched")
            patched += 1
    print(f"[og-wire] {patched} pages patched, {skipped} skipped")

    # Also patch the homepage to use default.png — bigger SEO win,
    # since the index is the most-shared URL.
    home = ROOT / "index.html"
    if home.exists():
        text = home.read_text(encoding="utf-8")
        new = RE_OG.sub(
            '<meta property="og:image" content="https://www.jakecuth.com/assets/og/default.png?v=1">',
            text, count=1,
        )
        new = RE_TW.sub(
            '<meta name="twitter:image" content="https://www.jakecuth.com/assets/og/default.png?v=1">',
            new, count=1,
        )
        if new != text:
            home.write_text(new, encoding="utf-8")
            print("[og-wire] index.html → default.png")


if __name__ == "__main__":
    main()
