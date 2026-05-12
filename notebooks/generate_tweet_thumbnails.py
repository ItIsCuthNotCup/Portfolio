"""
generate_tweet_thumbnails.py — produces a 1200×675 Twitter thumbnail PNG for every lab.
Run from repo root:

    python notebooks/generate_tweet_thumbnails.py

Outputs land in /assets/twitter-thumbs/<slug>.png.
Uses the same graphite + amber palette as the OG cards and the live site.
"""

from __future__ import annotations

import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# ── Paths ──────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "work"
OUT = ROOT / "assets" / "twitter-thumbs"
OUT.mkdir(parents=True, exist_ok=True)

# ── Brand tokens (graphite theme) ──────────────────────────────────
W, H = 1200, 675
BG = (20, 19, 17)            # --paper graphite
PAPER2 = (28, 26, 23)         # --paper-2
INK = (240, 235, 224)         # off-white headline
INK_DIM = (170, 162, 145)     # secondary text
AMBER = (245, 197, 66)        # close to oklch(0.88 0.18 100)
RULE = (90, 84, 72)           # divider rule

# ── Fonts ──────────────────────────────────────────────────────────
# Try Linux paths first, fall back to macOS system fonts
_FONT_DIR = Path("/System/Library/Fonts/Supplemental")
SERIF_PATH = str(_FONT_DIR / "Times New Roman.ttf") if (_FONT_DIR / "Times New Roman.ttf").exists() else "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"
SERIF_ITAL = str(_FONT_DIR / "Times New Roman.ttf") if (_FONT_DIR / "Times New Roman.ttf").exists() else "/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf"
MONO_PATH  = str(_FONT_DIR / "Courier New.ttf") if (_FONT_DIR / "Courier New.ttf").exists() else "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"


def load(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


# ── Lab metadata extraction ────────────────────────────────────────
RE_FIG = re.compile(r'FIG\.\s*(\d+(?:\.\d+)?)')
RE_OGT = re.compile(r'<meta\s+property="og:title"\s+content="([^"]+)"')
RE_OGD = re.compile(r'<meta\s+property="og:description"\s+content="([^"]+)"')


def clean_title(t: str) -> str:
    t = re.sub(r'\s*[—–-]\s*Jake Cuth\.?\s*$', '', t)
    return t.strip()


def split_em(title: str) -> tuple[str, str]:
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
    for size in (84, 76, 68, 60, 54, 48):
        font = load(SERIF_PATH, size)
        lines = wrap(draw, text, font, max_w)
        if len(lines) <= max_lines:
            return font, lines
    return load(SERIF_PATH, 48), wrap(draw, text, load(SERIF_PATH, 48), max_w)[:max_lines]


# ── Renderer ───────────────────────────────────────────────────────
def render(meta: dict, out_path: Path) -> None:
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # Subtle frame
    d.rectangle((36, 36, W - 36, H - 36), outline=RULE, width=1)

    # ── Top row: FIG marker only (no wordmark — twitter card is a
    # topic thumbnail, not a brand stamp) ──
    mono_sm = load(MONO_PATH, 16)

    if meta["fig"]:
        fig_text = f"§ FIG. {meta['fig']}"
        fig_w = measure(d, fig_text, mono_sm)
        d.text((W - 64 - fig_w, 56), fig_text, font=mono_sm, fill=AMBER)

    # ── Title ──
    head, tail = split_em(meta["title"])
    max_w = W - 128
    title_font, head_lines = fit_title(d, head, max_w, max_lines=3)
    line_h = int(title_font.size * 1.12)
    title_block_h = line_h * len(head_lines)

    y0 = int((H - title_block_h) / 2) - 10
    for i, line in enumerate(head_lines):
        d.text((64, y0 + i * line_h), line, font=title_font, fill=INK)

    # Italic kicker beneath head
    if tail:
        kicker_font = load(SERIF_ITAL, max(26, int(title_font.size * 0.4)))
        kicker_lines = wrap(d, tail, kicker_font, max_w)[:2]
        ky = y0 + title_block_h + 12
        for i, kl in enumerate(kicker_lines):
            d.text((64, ky + i * int(kicker_font.size * 1.2)), kl, font=kicker_font, fill=INK_DIM)

    # ── Bottom rule + tagline ──
    rule_y = H - 96
    d.line([(64, rule_y), (W - 64, rule_y)], fill=RULE, width=1)

    foot_font = load(MONO_PATH, 14)
    foot_left = "DATA SYSTEMS THAT SHIP"
    d.text((64, rule_y + 18), foot_left, font=foot_font, fill=INK_DIM)

    bullet = "● AI ENGINEER · NYC"
    bw = measure(d, bullet, foot_font)
    d.text((W - 64 - bw, rule_y + 18), bullet, font=foot_font, fill=AMBER)

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

    print(f"[twitter-thumbs] generating {len(labs)} cards → {OUT.relative_to(ROOT)}/")
    for meta in labs:
        out = OUT / f"{meta['slug']}.png"
        render(meta, out)
        kb = out.stat().st_size / 1024
        print(f"  {meta['slug']:30s} FIG {meta['fig'] or '-':>5}  {kb:5.0f} KB")

    # Default card. Topic framing, not personal branding — same
    # constraint as the per-lab cards.
    default_meta = {
        "slug": "default",
        "fig": "",
        "title": "Live ML labs — Built in the browser",
        "desc": "Interactive ML and data labs you can run, break, and inspect. No build step, no tracking.",
    }
    render(default_meta, OUT / "default.png")
    print(f"  {'default':30s}        {(OUT / 'default.png').stat().st_size / 1024:5.0f} KB")
    print(f"[twitter-thumbs] done")


if __name__ == "__main__":
    main()
