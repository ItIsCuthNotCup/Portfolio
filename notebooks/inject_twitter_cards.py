"""
inject_twitter_cards.py — ensures twitter:card + twitter:image point to the
new 1200×675 twitter-thumbs for every lab. Run from repo root:
    python notebooks/inject_twitter_cards.py
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "work"

RE_OG_IMAGE = re.compile(
    r'<meta\s+property="og:image"\s+content="https://[^"]+/assets/og/([^"?]+)(?:\?v=\d+)?"\s*>'
)
RE_TW_IMAGE = re.compile(
    r'\n?\s*<meta\s+name="twitter:image"\s+content="[^"]*"\s*>'
)
RE_TW_CARD = re.compile(
    r'\n?\s*<meta\s+name="twitter:card"\s+content="[^"]*"\s*>'
)


def inject(idx_html: Path) -> bool:
    text = idx_html.read_text(encoding="utf-8", errors="ignore")

    m = RE_OG_IMAGE.search(text)
    if not m:
        return False

    slug = m.group(1)
    # Use www host. Per references/seo.md: apex jakecuth.com routes
    # differently in some social scrapers, so og:image and
    # twitter:image always point at www.jakecuth.com.
    new_tw = (
        f'\n  <meta name="twitter:card" content="summary_large_image">'
        f'\n  <meta name="twitter:image" content="https://www.jakecuth.com/assets/twitter-thumbs/{slug}">'
    )

    # Remove existing twitter:image and twitter:card lines
    text = RE_TW_IMAGE.sub('', text)
    text = RE_TW_CARD.sub('', text)

    # Insert right after og:image
    og_line = m.group(0)
    text = text.replace(og_line, og_line + new_tw, 1)

    idx_html.write_text(text, encoding="utf-8")
    return True


def main() -> None:
    changed = 0
    skipped = 0
    for d in sorted(WORK.iterdir()):
        idx = d / "index.html"
        if not idx.exists():
            continue
        if inject(idx):
            print(f"  + {d.name}")
            changed += 1
        else:
            skipped += 1

    print(f"\n[twitter-cards] {changed} updated, {skipped} skipped")


if __name__ == "__main__":
    main()
