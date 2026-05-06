# QA checklist — what verify_lab.py checks

`scripts/verify_lab.py <slug>` runs every check in this list. It
exits 0 only when ALL pass. Treat its output as the contract.

## Why this matters

The site has been broken multiple times by changes that "looked
right." The verify script exists so a scheduled unattended run
cannot push a broken state. If the script fails, the run aborts.

## Checks performed

### 1. New lab files exist at expected paths

- `work/<slug>-lab/index.html`
- `assets/css/<slug>-lab.css`
- `assets/js/<slug>-lab.js`

If any are missing, the lab wasn't created. Hard fail.

### 2. JS-referenced IDs and classes resolve in the HTML

Parses the JS for `getElementById('xxx')` and
`querySelector('.xxx')` calls, then checks each ID exists in the
HTML. Catches typos and orphaned references.

Dynamically-created elements (e.g. buttons added by
`document.createElement`) won't be in the HTML; the script
distinguishes by checking if the JS that creates them references
`createElement`. False positives on this check are warnings, not
failures.

### 3. ONNX model loads and produces expected output

If the lab has `assets/models/<slug>/model.onnx`:
- File exists and is non-empty
- `onnxruntime.InferenceSession.create()` succeeds in Python
- A synthetic input of the expected shape produces an output of
  the expected shape
- Output tensor names include either `probabilities` or `output`
  or something the frontend's fallback can find

### 4. Cross-cutting nav consistency

For every HTML page that renders the nav dropdown:
- The dropdown lists every existing lab in order
- Order matches across all pages (no drift)
- The current page's entry has `class="active"`

### 5. Lab-nav counter consistency

- Every `Lab N of M` counter has the same M
- M equals the actual number of lab pages in `work/*-lab/`
- Each lab's N matches its FIG number
- The previously-last lab's "next" link points to the new lab
  (not back to lab 01)

### 6. Cache-bust version consistency

- `main.css?v=N` — N is the same on every page that references it
- `main.js?v=N` — same
- No page references an asset without a version query string

### 7. Homepage labs grid

- Card count = number of lab pages
- Each card's `href` resolves to an actual lab page
- FIG number on each card matches the FIG in that lab's hero

### 8. JS files pass syntax check

`node --check assets/js/<slug>-lab.js` exits 0. Same for
`assets/js/main.js` if it was modified.

### 9. Methodology JSON schema (if exists)

If `assets/data/<slug>/methodology.json` exists, it parses as JSON
and contains the keys the receipts panel reads (see `ml-pipeline.md`).

### 10. No em dashes in body prose

Greps the lab's HTML for U+2014 (em dash). Allowed locations:
- Inside `<title>`, `<meta>` tags (SEO)
- Inside `class="frame-label"` or similar typographic captions
- Inside `<pre>` or `<code>` blocks

Em dashes in `<p>`, `<h1-6>`, or `lab-biz-line` blocks fail the
check.

### 11. Required HTML elements present

Every lab MUST have:
- `<header class="masthead">` with the same structure as other labs
- `.section-label` with `FIG. NN` for the hero
- `.lab-biz-line` paragraph below the H1
- `.lab-nav` at the bottom of the methodology section
- `<footer class="colophon mono">` at the end

### 12. Robots / SEO basics

- `<title>` is present and non-empty
- `<meta name="description">` is present and non-empty
- `<meta property="og:title">` and `og:description` are present
- Title format matches the pattern: `<Name> — Jake Cuth.`

## Reading the verify_lab.py output

The script prints each check with ✓ or ✗ and exits with the count
of failures. Example clean run:

```
$ python3 .claude/skills/portfolio-lab-creator/scripts/verify_lab.py markov-chain
✓ Lab files exist
✓ JS references resolve (12/12 IDs found)
✓ Cross-cutting nav consistent
✓ Lab-nav counter consistent (Lab N of 07 across 7 pages)
✓ Cache-bust versions match (main.css=12, main.js=7)
✓ Homepage labs grid: 7 cards, all hrefs valid
✓ JS syntax check passes
✓ No em dashes in body prose
✓ Required HTML elements present
✓ Title/meta tags valid

QA gate: PASS
```

Example failure:

```
✗ Lab-nav counter inconsistent:
    work/churn-lab/: "Lab 01 of 06"
    work/markov-lab/: "Lab 07 of 07"
    Expected M=07 across all labs.
✗ Previously-last lab's next link broken:
    work/sketch-lab/ next link points to /work/churn-lab/
    Expected: /work/markov-lab/
QA gate: FAIL (2 failures)
```

## SEO checks (run alongside the structural checks above)

Per `references/seo.md`, every new lab must satisfy these. The
verify script enforces all of them; failure aborts commit:

- **Required meta tags present**: title, description (60–160 chars),
  canonical, og:type, og:title, og:description, og:image, og:url,
  og:site_name, og:locale, article:published_time,
  article:modified_time, twitter:card, twitter:title,
  twitter:description, twitter:image, twitter:site, twitter:creator,
  theme-color
- **Three JSON-LD blocks present and parse as valid JSON**:
  BreadcrumbList, Article, WebApplication
- **Per-lab OG image exists**: `assets/og/<slug>-lab.png` is a real
  PNG file, 1200×630
- **OG image URL points at www host**:
  `https://www.jakecuth.com/assets/og/<slug>-lab.png?v=N` (NOT bare
  apex — apex breaks some social scrapers)
- **Sitemap entry exists**: `sitemap.xml` has a `<url>` block whose
  `<loc>` ends with `/work/<slug>-lab/`
- **llms.txt entry exists**: `llms.txt` mentions
  `/work/<slug>-lab/` somewhere
- **Twitter handle is `@ItsCuthulhu`** for both site and creator
- **No duplicate canonical URLs**: no other page on the site uses
  the same `<link rel="canonical">` value

## When to override the QA gate

Never. If the gate fails, fix the lab. Do not commit.

If the gate's check itself is wrong (false positive), update the
script. Do not commit a workaround in the lab.
