#!/usr/bin/env python3
"""
verify_lab.py — QA gate for portfolio-lab-creator skill.

Run this BEFORE committing a new lab. Exits 0 only if every check
passes. The point: a scheduled unattended run should NEVER be able
to commit a broken lab. If you see this script fail, fix the lab.
Do not work around the script.

Usage:
    python3 .claude/skills/portfolio-lab-creator/scripts/verify_lab.py <slug>

Run from the repo root.
"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path

# Resolve repo root by walking up from the script location until
# we see index.html.
SCRIPT = Path(__file__).resolve()
REPO_ROOT = SCRIPT
while not (REPO_ROOT / "index.html").exists():
    REPO_ROOT = REPO_ROOT.parent
    if REPO_ROOT == REPO_ROOT.parent:
        print("ERROR: could not find repo root (no index.html in any parent)")
        sys.exit(2)

failures = []
warnings = []


def fail(msg):
    failures.append(msg)
    print(f"  ✗ {msg}")


def warn(msg):
    warnings.append(msg)
    print(f"  ! {msg}")


def ok(msg):
    print(f"  ✓ {msg}")


def section(name):
    print(f"\n[{name}]")


# ──────────────────────────────────────────────────────────────
# Setup: enumerate all lab pages, find the new lab
# ──────────────────────────────────────────────────────────────

if len(sys.argv) < 2:
    print("usage: verify_lab.py <slug>")
    sys.exit(2)

NEW_SLUG = sys.argv[1]
NEW_LAB_DIR = REPO_ROOT / "work" / f"{NEW_SLUG}-lab"
NEW_LAB_HTML = NEW_LAB_DIR / "index.html"

ALL_LABS = sorted([p.parent.name for p in (REPO_ROOT / "work").glob("*-lab/index.html")])
LAB_COUNT = len(ALL_LABS)
ALL_LAB_PAGES = [(REPO_ROOT / "work" / lab / "index.html") for lab in ALL_LABS]
HOMEPAGE = REPO_ROOT / "index.html"

print(f"Repo:       {REPO_ROOT}")
print(f"New slug:   {NEW_SLUG}")
print(f"All labs:   {ALL_LABS}")
print(f"Lab count:  {LAB_COUNT}")


# ──────────────────────────────────────────────────────────────
# Check 1: New lab files exist
# ──────────────────────────────────────────────────────────────
section("Lab files exist")

required = [
    NEW_LAB_HTML,
    REPO_ROOT / "assets" / "css" / f"{NEW_SLUG}-lab.css",
    REPO_ROOT / "assets" / "js" / f"{NEW_SLUG}-lab.js",
]
for p in required:
    if p.exists() and p.stat().st_size > 0:
        ok(f"{p.relative_to(REPO_ROOT)} ({p.stat().st_size} bytes)")
    else:
        fail(f"missing or empty: {p.relative_to(REPO_ROOT)}")

if not NEW_LAB_HTML.exists():
    print("\nFATAL: cannot continue without new lab HTML")
    sys.exit(1)

new_html = NEW_LAB_HTML.read_text()
new_js = (REPO_ROOT / "assets" / "js" / f"{NEW_SLUG}-lab.js").read_text() \
    if (REPO_ROOT / "assets" / "js" / f"{NEW_SLUG}-lab.js").exists() else ""


# ──────────────────────────────────────────────────────────────
# Check 2: JS-referenced IDs resolve in HTML
# ──────────────────────────────────────────────────────────────
section("JS references resolve")

referenced_ids = set(re.findall(r"getElementById\(['\"]([^'\"]+)['\"]\)", new_js))
# For dynamically-created elements, JS uses createElement; warn don't fail.
dynamic_creates = re.findall(r"createElement\(['\"]([^'\"]+)['\"]\)", new_js)

missing = []
for ref_id in sorted(referenced_ids):
    if f'id="{ref_id}"' not in new_html and f"id='{ref_id}'" not in new_html:
        missing.append(ref_id)

if missing:
    fail(f"{len(missing)} ID(s) referenced by JS but not in HTML: {missing}")
else:
    ok(f"{len(referenced_ids)} IDs referenced, all found in HTML")


# ──────────────────────────────────────────────────────────────
# Check 3: JS syntax
# ──────────────────────────────────────────────────────────────
section("JS syntax check")

js_path = REPO_ROOT / "assets" / "js" / f"{NEW_SLUG}-lab.js"
if js_path.exists():
    try:
        subprocess.check_output(["node", "--check", str(js_path)], stderr=subprocess.STDOUT)
        ok(f"{js_path.relative_to(REPO_ROOT)} parses cleanly")
    except subprocess.CalledProcessError as e:
        fail(f"syntax error in {js_path.name}: {e.output.decode()[:200]}")
    except FileNotFoundError:
        warn("node not available; skipping JS syntax check")


# ──────────────────────────────────────────────────────────────
# Check 4: Cross-cutting nav consistency
# ──────────────────────────────────────────────────────────────
section("Cross-cutting nav dropdown")

# Build expected dropdown entries by looking at every lab page's
# title (the H1 text). Ground truth is "what's in the work folder".
expected_slugs = ALL_LABS  # already sorted alphabetically

def extract_dropdown_slugs(html):
    """Parse the nav dropdown menu and return list of lab slugs."""
    m = re.search(
        r'<div class="nav-dropdown-menu"[^>]*>(.*?)</div>',
        html, re.DOTALL)
    if not m:
        return None
    inner = m.group(1)
    # Find <a href="/work/<slug>-lab/" ...>
    return re.findall(r'href="/work/([^/]+)-lab/"', inner)

# Check homepage + every lab page
pages_to_check = [(HOMEPAGE, "homepage")] + [(p, p.parent.name) for p in ALL_LAB_PAGES]
for page_path, page_name in pages_to_check:
    html = page_path.read_text()
    found = extract_dropdown_slugs(html)
    if found is None:
        fail(f"{page_name}: no nav dropdown found")
        continue
    found_slugs = sorted([f"{s}-lab" for s in found])
    if set(found_slugs) != set(expected_slugs):
        missing_in_page = set(expected_slugs) - set(found_slugs)
        extra_in_page = set(found_slugs) - set(expected_slugs)
        msg = f"{page_name}: dropdown drift"
        if missing_in_page:
            msg += f"  missing: {sorted(missing_in_page)}"
        if extra_in_page:
            msg += f"  extra: {sorted(extra_in_page)}"
        fail(msg)
    else:
        ok(f"{page_name}: dropdown lists all {len(expected_slugs)} labs")


# ──────────────────────────────────────────────────────────────
# Check 5: Lab-nav "Lab N of M" counter consistency
# ──────────────────────────────────────────────────────────────
section("Lab-nav counter consistency")

counter_re = re.compile(r"Lab\s+(\d+)\s+of\s+(\d+)")
counters = {}
for lab_page in ALL_LAB_PAGES:
    html = lab_page.read_text()
    m = counter_re.search(html)
    if not m:
        fail(f"{lab_page.parent.name}: no 'Lab N of M' counter found")
        continue
    counters[lab_page.parent.name] = (int(m.group(1)), int(m.group(2)))

ms = set(c[1] for c in counters.values())
if len(ms) > 1:
    fail(f"counter M drift: {counters}")
elif ms and next(iter(ms)) != LAB_COUNT:
    fail(f"counter M is {next(iter(ms))} but actual lab count is {LAB_COUNT}")
else:
    ok(f"all {len(counters)} labs report 'Lab N of {LAB_COUNT}'")


# ──────────────────────────────────────────────────────────────
# Check 6: Cache-bust version consistency
# ──────────────────────────────────────────────────────────────
section("Cache-bust versions")

def find_versions(html, asset):
    return set(re.findall(rf"{asset}\?v=(\d+)", html))

main_css_versions = set()
main_js_versions = set()
for page_path, page_name in pages_to_check:
    html = page_path.read_text()
    css_v = find_versions(html, r"main\.css")
    js_v = find_versions(html, r"main\.js")
    main_css_versions.update(css_v)
    main_js_versions.update(js_v)

if len(main_css_versions) > 1:
    fail(f"main.css cache-bust drift: versions seen = {sorted(main_css_versions)}")
elif not main_css_versions:
    warn("no main.css version found anywhere — links may lack ?v=N")
else:
    ok(f"main.css cache-bust consistent at v={next(iter(main_css_versions))}")

if len(main_js_versions) > 1:
    fail(f"main.js cache-bust drift: versions seen = {sorted(main_js_versions)}")
elif not main_js_versions:
    warn("no main.js version found anywhere")
else:
    ok(f"main.js cache-bust consistent at v={next(iter(main_js_versions))}")


# ──────────────────────────────────────────────────────────────
# Check 7: Homepage labs grid
# ──────────────────────────────────────────────────────────────
section("Homepage labs grid")

home_html = HOMEPAGE.read_text()
# Find all .lab-card links
card_hrefs = re.findall(r'<a class="lab-card" href="(/work/[^"]+)"', home_html)
if len(card_hrefs) != LAB_COUNT:
    fail(f"homepage shows {len(card_hrefs)} lab cards but {LAB_COUNT} labs exist")
else:
    ok(f"{len(card_hrefs)} cards on homepage matches {LAB_COUNT} labs")

# Each card href should resolve
for href in card_hrefs:
    target = REPO_ROOT / href.lstrip("/") / "index.html"
    if not target.exists():
        fail(f"homepage card href {href} does not resolve to a lab page")


# ──────────────────────────────────────────────────────────────
# Check 8: Required HTML elements in the new lab
# ──────────────────────────────────────────────────────────────
section("New lab structural elements")

required_patterns = [
    ('<header class="masthead">', "masthead"),
    # section-label can be combined with "mono" so we just check the substring
    ('section-label', "section-label class"),
    ('FIG. ', "FIG. number in section labels"),
    ('class="lab-biz-line"', "lab-biz-line element"),
    ('class="lab-nav', "lab-nav at bottom"),
    ('class="colophon mono"', "colophon footer"),
    ('Get in touch', "contact CTA in masthead nav"),
]
for pattern, label in required_patterns:
    if pattern in new_html:
        ok(f"has {label}")
    else:
        fail(f"missing required: {label} (pattern: '{pattern}')")


# ──────────────────────────────────────────────────────────────
# Check 9: Title and meta tags
# ──────────────────────────────────────────────────────────────
section("SEO metadata")

title_match = re.search(r"<title>([^<]+)</title>", new_html)
if not title_match:
    fail("no <title> tag")
elif "Jake Cuth." not in title_match.group(1):
    fail(f"<title> doesn't follow pattern '<Name> — Jake Cuth.': '{title_match.group(1)}'")
else:
    ok(f"<title> = '{title_match.group(1)}'")

if 'name="description"' not in new_html:
    fail("missing <meta name='description'>")
else:
    ok("has meta description")

if 'property="og:title"' not in new_html:
    fail("missing og:title")
else:
    ok("has og:title")


# ──────────────────────────────────────────────────────────────
# Check 10: No em dashes in body prose
# ──────────────────────────────────────────────────────────────
section("Em dash sweep (prose only)")

# Em dashes are allowed in typographic chrome (section labels, frame
# labels, dateline values, etc.) — anywhere with class containing
# "label" or "mono". Banned only in <p>, <h1-6>, .biz-line, .lede,
# and similar prose containers. To enforce this without a real HTML
# parser, we strip all the allowed contexts before counting.
body_match = re.search(r"<body[^>]*>(.*?)</body>", new_html, re.DOTALL)
if body_match:
    body = body_match.group(1)
    # Strip HTML comments
    body = re.sub(r"<!--.*?-->", "", body, flags=re.DOTALL)
    # Strip pre/code/script/style blocks
    body = re.sub(r"<pre.*?</pre>", "", body, flags=re.DOTALL)
    body = re.sub(r"<code.*?</code>", "", body, flags=re.DOTALL)
    body = re.sub(r"<script.*?</script>", "", body, flags=re.DOTALL)
    body = re.sub(r"<style.*?</style>", "", body, flags=re.DOTALL)
    # Strip the entire <header> (masthead has em dashes in section labels
    # of dropdown items sometimes; not body prose either way)
    body = re.sub(r"<header.*?</header>", "", body, flags=re.DOTALL)
    body = re.sub(r"<footer.*?</footer>", "", body, flags=re.DOTALL)
    # Strip any element whose class attribute contains "label", "mono",
    # "fig", "kicker"... allowing em dashes in typographic chrome.
    # Iterate to handle nested divs that wouldn't match in a single pass.
    chrome_re = re.compile(
        r'<(\w+)[^>]*class="[^"]*(label|mono|fig|kicker|note|caption|dateline|frame|how-fig|adv-rank|receipt-label)[^"]*"[^>]*>.*?</\1>',
        re.DOTALL,
    )
    for _ in range(8):
        new_body = chrome_re.sub("", body)
        if new_body == body:
            break
        body = new_body
    # Strip elements whose ONLY content is a standalone em dash —
    # these are JS placeholders for "no value yet" and not prose.
    body = re.sub(r'<(\w+)[^>]*>\s*—\s*</\1>', "", body)

    em_dash_count = body.count("—")
    if em_dash_count > 0:
        # Show a snippet of context for each em dash to make debugging easy
        ctx_snippets = []
        for m in re.finditer(r".{0,40}—.{0,40}", body):
            ctx_snippets.append(m.group(0).replace("\n", " ").strip())
        fail(f"{em_dash_count} em dash(es) in body prose (not allowed per conventions)")
        for s in ctx_snippets[:5]:
            print(f"      context: ...{s}...")
    else:
        ok("no em dashes in body prose")


# ──────────────────────────────────────────────────────────────
# Check 11: ONNX model loads (if present)
# ──────────────────────────────────────────────────────────────
section("ONNX model (if present)")

model_path = REPO_ROOT / "assets" / "models" / NEW_SLUG / "model.onnx"
if model_path.exists():
    try:
        import onnxruntime as ort  # type: ignore
        sess = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
        inputs = sess.get_inputs()
        outputs = sess.get_outputs()
        ok(f"model loads, {len(inputs)} input(s), {len(outputs)} output(s)")
        for inp in inputs:
            ok(f"  input: {inp.name} shape={inp.shape} dtype={inp.type}")
        for out in outputs:
            ok(f"  output: {out.name} shape={out.shape} dtype={out.type}")
    except ImportError:
        warn("onnxruntime not installed; skipping model load check")
    except Exception as e:
        fail(f"model load failed: {e}")
else:
    ok("no ONNX model expected (none at assets/models/<slug>/)")


# ──────────────────────────────────────────────────────────────
# Check 12: methodology.json (if present)
# ──────────────────────────────────────────────────────────────
section("methodology.json (if present)")

meth_path = REPO_ROOT / "assets" / "data" / NEW_SLUG / "methodology.json"
if meth_path.exists():
    try:
        d = json.loads(meth_path.read_text())
        required_keys = ["model", "categories", "model_size_kb"]
        for k in required_keys:
            if k not in d:
                warn(f"methodology.json missing key: {k}")
            else:
                ok(f"methodology.json has '{k}'")
    except json.JSONDecodeError as e:
        fail(f"methodology.json invalid JSON: {e}")
else:
    ok("no methodology.json expected")


# ──────────────────────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────────────────────
print()
print("=" * 60)
if failures:
    print(f"QA gate: FAIL ({len(failures)} failure(s), {len(warnings)} warning(s))")
    for f in failures:
        print(f"  ✗ {f}")
    sys.exit(1)
else:
    print(f"QA gate: PASS ({len(warnings)} warning(s), 0 failures)")
    if warnings:
        for w in warnings:
            print(f"  ! {w}")
    sys.exit(0)
