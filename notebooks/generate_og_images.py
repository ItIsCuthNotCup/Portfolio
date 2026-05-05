"""
generate_og_images.py — produces a 1200x630 OpenGraph PNG for every lab in
/work/. Run from repo root:

    python notebooks/generate_og_images.py

Outputs land in /assets/og/<slug>.png and use the same graphite + amber
palette as the live site.

The generator reads each lab's index.html for FIG number + og:title +
og:description rather than maintaining a parallel inventory. New labs
created via the portfolio-lab-creator skill will be picked up
automatically the next time this script runs.
"""

from __future__ import annotations

import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# ── Paths ──────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "work"
OUT = ROOT / "assets" / "og"
OUT.mkdir(parents=True, exist_ok=True)

# ── Brand tokens (graphite theme) ──────────────────────────────────
W, H = 1200, 630
BG = (20, 19, 17)            # --paper graphite
PAPER2 = (28, 26, 23)         # --paper-2
INK = (240, 235, 224)         # off-white headline
INK_DIM = (170, 162, 145)     # secondary text
AMBER = (245, 197, 66)        # close to oklch(0.88 0.18 100)
RULE = (90, 84, 72)           # divider rule

# ── Fonts (sandbox has Liberation Serif + DejaVu Sans Mono) ────────
SERIF_PATH = "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"
SERIF_ITAL = "/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf"
MONO_PATH  = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"


def load(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


# ── Lab metadata extraction ────────────────────────────────────────
RE_FIG = re.compile(r'FIG\.\s*(\d+(?:\.\d+)?)')
RE_OGT = re.compile(r'<meta\s+property="og:title"\s+content="([^"]+)"')
RE_OGD = re.compile(r'<meta\s+property="og:description"\s+content="([^"]+)"')


def clean_title(t: str) -> str:
    """Strip ' — Jake Cuth.' suffix and similar tails."""
    t = re.sub(r'\s*[—–-]\s*Jake Cuth\.?\s*$', '', t)
    return t.strip()


def split_em(title: str) -> tuple[str, str]:
    """Most og:titles split on em-dash: HEADLINE — kicker. Return both."""
    if " — " in title:
        head, tail = title.split(" — ", 1)
        return head.strip(), tail.strip()
    return title.strip(), ""


def extract(idx_html: Path) -> dict | None:
    text = idx_html.read_text(encoding="utf-8", errors="ignore")
    fig = RE_FIG.search(text)
    ogt = RE_OGT.search(text)
    ogd = RE_OGD.search(text)
    if not ogt:
        return None
    return {
        "slug": idx_html.parent.name,
        "fig": fig.group(1) if fig else "",
        "title": clean_title(ogt.group(1)),
        "desc": ogd.group(1) if ogd else "",
    }


# ── Text wrapping helpers ──────────────────────────────────────────
def measure(draw: ImageDraw.ImageDraw, text: str, font) -> int:
    return int(draw.textlength(text, font=font))


def wrap(draw, text: str, font, max_w: int) -> list[str]:
    words = text.split()
    lines, line = [], ""
    for w in words:
        cand = (line + " " + w).strip()
        if measure(draw, cand, font) <= max_w:
            line = cand
        else:
            if line:
                lines.append(line)
            line = w
    if line:
        lines.append(line)
    return lines


def fit_title(draw, text: str, max_w: int, max_lines: int = 3) -> tuple[ImageFont.FreeTypeFont, list[str]]:
    """Find the largest serif font size that fits text in <= max_lines."""
    for size in (96, 88, 80, 72, 66, 60, 54):
        font = load(SERIF_PATH, size)
        lines = wrap(draw, text, font, max_w)
        if len(lines) <= max_lines:
            return font, lines
    return load(SERIF_PATH, 54), wrap(draw, text, load(SERIF_PATH, 54), max_w)[:max_lines]


# ── Renderer ───────────────────────────────────────────────────────
def render(meta: dict, out_path: Path) -> None:
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # Subtle paper-2 panel as a background "card" — matches the editorial frame
    d.rectangle((40, 40, W - 40, H - 40), outline=RULE, width=1)

    # ── Top row: wordmark + FIG marker ──
    mono_sm = load(MONO_PATH, 18)
    wordmark = "JAKECUTH.COM"
    d.text((72, 72), wordmark, font=mono_sm, fill=INK_DIM)

    if meta["fig"]:
        fig_text = f"§ FIG. {meta['fig']}"
        fig_w = measure(d, fig_text, mono_sm)
        d.text((W - 72 - fig_w, 72), fig_text, font=mono_sm, fill=AMBER)

    # ── Title ──
    head, tail = split_em(meta["title"])
    max_w = W - 144  # 72px margin each side
    title_font, head_lines = fit_title(d, head, max_w, max_lines=3)
    line_h = int(title_font.size * 1.15)
    title_block_h = line_h * len(head_lines)

    # Vertical centering of title block, biased slightly above center
    y0 = int((H - title_block_h) / 2) - 20
    for i, line in enumerate(head_lines):
        d.text((72, y0 + i * line_h), line, font=title_font, fill=INK)

    # Italic kicker beneath head, if present
    if tail:
        kicker_font = load(SERIF_ITAL, max(28, int(title_font.size * 0.42)))
        kicker_lines = wrap(d, tail, kicker_font, max_w)[:2]
        ky = y0 + title_block_h + 14
        for i, kl in enumerate(kicker_lines):
            d.text((72, ky + i * int(kicker_font.size * 1.25)), kl, font=kicker_font, fill=INK_DIM)

    # ── Bottom rule + tagline ──
    rule_y = H - 110
    d.line([(72, rule_y), (W - 72, rule_y)], fill=RULE, width=1)

    foot_font = load(MONO_PATH, 16)
    foot_left = "DATA SYSTEMS THAT SHIP"
    d.text((72, rule_y + 24), foot_left, font=foot_font, fill=INK_DIM)

    # Right-aligned amber bullet so the card always has a touch of color
    bullet = "● ML ENGINEER · NYC"
    bw = measure(d, bullet, foot_font)
    d.text((W - 72 - bw, rule_y + 24), bullet, font=foot_font, fill=AMBER)

    img.save(out_path, "PNG", optimize=True)


# ── Main ───────────────────────────────────────────────────────────
def main() -> None:
    labs = []
    for d in sorted(WORK.iterdir()):
        idx = d / "index.html"
        if not idx.exists():
            continue
        meta = extract(idx)
        if meta is None:
            print(f"  skip {d.name}: no og:title")
            continue
        labs.append(meta)

    print(f"[og] generating {len(labs)} cards → {OUT.relative_to(ROOT)}/")
    for meta in labs:
        out = OUT / f"{meta['slug']}.png"
        render(meta, out)
        kb = out.stat().st_size / 1024
        print(f"  {meta['slug']:30s} FIG {meta['fig'] or '-':>5}  {kb:5.0f} KB")

    # Default card for the homepage / fallback
    default_meta = {
        "slug": "default",
        "fig": "",
        "title": "Jake Cuth — Data Systems That Ship",
        "desc": "ML engineer building production data systems and live ML labs you can break in your browser.",
    }
    render(default_meta, OUT / "default.png")
    print(f"  {'default':30s}        {(OUT / 'default.png').stat().st_size / 1024:5.0f} KB")
    print(f"[og] done")


if __name__ == "__main__":
    main()
