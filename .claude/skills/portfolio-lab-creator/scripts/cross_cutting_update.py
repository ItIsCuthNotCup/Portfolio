#!/usr/bin/env python3
"""
cross_cutting_update.py — wire a new lab into the site's nav.

After you create the new lab files, run this to update:
  - Nav dropdown on homepage + every existing lab
  - Lab-nav "Lab N of M" counter on every existing lab
  - Previously-last lab's lab-nav next link
  - Homepage labs grid (adds the new card)

Idempotent: safe to run twice. Detects existing entries and skips
them. Will not double-add cards.

Usage:
    python3 cross_cutting_update.py <slug> <fig> <name> <prev_slug>

Where:
  <slug>      = kebab-case lab name, e.g. "markov-chain"
  <fig>       = two-digit FIG number, e.g. "07"
  <name>      = display name, e.g. "Markov Chain"
  <prev_slug> = slug of the previously-last lab, e.g. "sketch"

Example:
    python3 cross_cutting_update.py markov-chain 07 "Markov Chain" sketch
"""

import re
import sys
from pathlib import Path

if len(sys.argv) < 5:
    print(__doc__)
    sys.exit(2)

NEW_SLUG = sys.argv[1]
NEW_FIG = sys.argv[2]
NEW_NAME = sys.argv[3]
PREV_SLUG = sys.argv[4]

SCRIPT = Path(__file__).resolve()
REPO_ROOT = SCRIPT
while not (REPO_ROOT / "index.html").exists():
    REPO_ROOT = REPO_ROOT.parent
    if REPO_ROOT == REPO_ROOT.parent:
        print("ERROR: could not find repo root")
        sys.exit(2)

ALL_LAB_DIRS = sorted([p.parent for p in (REPO_ROOT / "work").glob("*-lab/index.html")])
LAB_COUNT = len(ALL_LAB_DIRS)
ALL_LAB_PAGES = [d / "index.html" for d in ALL_LAB_DIRS]

# Defensive: previously-last lab might be the same as new lab if running
# this twice. Detect and warn.
prev_lab_dir = REPO_ROOT / "work" / f"{PREV_SLUG}-lab"
new_lab_dir = REPO_ROOT / "work" / f"{NEW_SLUG}-lab"
if not prev_lab_dir.exists():
    print(f"ERROR: prev lab not found: {prev_lab_dir}")
    sys.exit(2)
if not new_lab_dir.exists():
    print(f"ERROR: new lab files not yet created: {new_lab_dir}")
    print("Create the lab files first, then run this.")
    sys.exit(2)

print(f"Wiring up {NEW_NAME} (FIG. {NEW_FIG}) [slug: {NEW_SLUG}]")
print(f"Previously-last lab: {PREV_SLUG}")
print(f"Total labs after this update: {LAB_COUNT}")
print()


def edit_file(path, transform_fn):
    """Read file, apply transform_fn(text) -> text, write back."""
    text = path.read_text()
    new_text = transform_fn(text)
    if new_text != text:
        path.write_text(new_text)
        print(f"  edited: {path.relative_to(REPO_ROOT)}")
    else:
        print(f"  no change: {path.relative_to(REPO_ROOT)}")


# ──────────────────────────────────────────────────────────────
# Update nav dropdown on every page (homepage + every lab)
# ──────────────────────────────────────────────────────────────
print("Updating nav dropdown on every page...")

NEW_DROPDOWN_ENTRY = (
    f'        <a href="/work/{NEW_SLUG}-lab/" role="menuitem">{NEW_NAME}</a>'
)

def add_to_dropdown(text):
    if f'href="/work/{NEW_SLUG}-lab/"' in text:
        return text  # already there
    # Insert before the closing </div> of the dropdown menu, after the
    # last lab entry.
    return re.sub(
        r'(<a href="/work/[^"]+-lab/"[^>]*>[^<]+</a>\n)(\s*</div>)',
        lambda m: m.group(1) + NEW_DROPDOWN_ENTRY + "\n" + m.group(2),
        text,
        count=1,
    )

for page in [REPO_ROOT / "index.html"] + ALL_LAB_PAGES:
    edit_file(page, add_to_dropdown)


# ──────────────────────────────────────────────────────────────
# Update lab-nav counters on every lab
# ──────────────────────────────────────────────────────────────
print()
print(f"Bumping 'Lab N of M' counters to M={LAB_COUNT:02d}...")

def bump_counter(text):
    return re.sub(
        r"(Lab\s+\d+\s+of\s+)\d+",
        lambda m: m.group(1) + f"{LAB_COUNT:02d}",
        text,
    )

for page in ALL_LAB_PAGES:
    edit_file(page, bump_counter)


# ──────────────────────────────────────────────────────────────
# Update previously-last lab's "next" link to point at new lab
# ──────────────────────────────────────────────────────────────
print()
print(f"Updating {PREV_SLUG}-lab next link to point at new lab...")

NEW_NEXT_LINK = (
    f'<a href="/work/{NEW_SLUG}-lab/">Next: {NEW_NAME} (FIG. {NEW_FIG}) →</a>'
)

def replace_next_link(text):
    # Look for the "Back to Lab 01" pattern at the end of a lab-nav and
    # replace with "Next: <new>" pattern.
    text = re.sub(
        r'<a href="/work/[^"]+-lab/">Back to Lab 01[^<]*</a>',
        NEW_NEXT_LINK,
        text,
    )
    return text

prev_page = prev_lab_dir / "index.html"
edit_file(prev_page, replace_next_link)


# ──────────────────────────────────────────────────────────────
# Update homepage labs grid (add the new lab card)
# ──────────────────────────────────────────────────────────────
print()
print("Adding lab card to homepage labs grid...")

NEW_LAB_CARD = f'''    <a class="lab-card" href="/work/{NEW_SLUG}-lab/">
      <div class="mono lab-fig">FIG. {NEW_FIG}</div>
      <h3 class="serif lab-name">{NEW_NAME}</h3>
      <p class="lab-line">{{{{ TODO: 1-sentence business outcome }}}}</p>
      <div class="mono lab-arrow">Open the lab →</div>
    </a>'''

def add_lab_card(text):
    if f'href="/work/{NEW_SLUG}-lab/"' in text and "lab-card" in text and \
       text.count(f'/work/{NEW_SLUG}-lab/') > 1:
        # Card already exists (more than one reference means dropdown + card).
        return text
    # Find the last lab-card entry, insert new card after it.
    return re.sub(
        r'(    <a class="lab-card"[^>]*>.*?</a>\n)(  </div>\n</section>)',
        lambda m: m.group(1) + NEW_LAB_CARD + "\n" + m.group(2),
        text,
        count=1,
        flags=re.DOTALL,
    )

edit_file(REPO_ROOT / "index.html", add_lab_card)


print()
print("─" * 60)
print("Done. Next steps:")
print(f"  1. Edit homepage to fill in 'lab-line' for the new card")
print(f"     (search for 'TODO: 1-sentence business outcome')")
print(f"  2. Bump main.css cache-bust on every page if main.css changed")
print(f"  3. Run verify_lab.py to confirm the QA gate passes:")
print(f"     python3 .claude/skills/portfolio-lab-creator/scripts/verify_lab.py {NEW_SLUG}")
