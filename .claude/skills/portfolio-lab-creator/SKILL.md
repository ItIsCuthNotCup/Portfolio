---
name: portfolio-lab-creator
description: Create a new "Model Examples" lab page for jakecuth.com end-to-end. Use this skill whenever the user asks for a new lab, new model demo, new dashboard, additional FIG entry, or a new page in the /work/ section of the portfolio. Also use when the user mentions running a scheduled job to add labs automatically. The skill handles the entire pipeline — page structure, CSS, JS, optional ML training pipeline, cross-cutting nav updates across the homepage and all existing labs, the QA gates that must pass before any commit, and the safe-deploy guardrails so the site cannot be broken by an unattended run. If anything in the spec is ambiguous, default to matching the patterns of existing labs in /work/ rather than inventing.
---

# portfolio-lab-creator

You are about to add a new lab to jakecuth.com. The site is a static
editorial portfolio with five (and counting) interactive ML/analytics
labs at `/work/<slug>-lab/`. Each lab is a complete, self-contained
page that demonstrates one model or technique with live in-browser
computation.

This skill is the playbook. It exists because the same person who
built the existing labs is no longer always the one adding them, and
the site is fragile to drift — a misplaced CSS rule or skipped
cache-bust has broken the contact section, the role-cycle, the funnel
sim, and the labs grid in past sessions. The QA gates here are not
optional.

## Rules that take precedence over everything else

These come from `/CLAUDE.md` at the repo root. They are not negotiable
and they apply to every change you make in this skill.

1. **Verify rendered output before claiming a change is done.** Static
   reasoning isn't enough for visible changes. Run `scripts/verify_lab.py`
   (described below). If it doesn't pass, do not commit.
2. **CSS deletes are surgical, never sweeping.** When a lab is removed
   or a component is renamed, list every selector you intend to remove
   and confirm each is unused before deleting. Adjacent rules have been
   killed by careless block deletes more than once.
3. **Cache-bust every HTML reference to a changed asset.** When `main.css`
   or `main.js` changes, increment the version on every page that
   references them — homepage + every existing lab. The site has no
   build step; the version query string is the only invalidation.
4. **Never emit 5xx from a Cloudflare Pages Function.** Cloudflare's
   edge replaces 5xx responses with its own branded HTML error page.
   Use 200 with `{ ok: false, error: "..." }` for runtime errors.
5. **Don't drive the user's browser to handle their secrets.** If a
   lab needs API keys, write the code, push it, and have the user
   paste the secret into Cloudflare. Never request browser access to
   do it yourself.
6. **For shipped ML models: preprocessing parity matters more than
   model quality.** If training pipeline preprocessed inputs in a
   specific way (centered, cropped, normalized, color-channel-ordered),
   the inference path in the browser MUST replicate that exactly. See
   `references/ml-pipeline.md`.

## When to use this skill

Triggers (any of these):

- "Add a new lab", "Create a new model demo", "Build a [topic] lab"
- "I want a lab about X" / "Make a page that shows Y"
- "Run the scheduled lab job" / "Auto-generate today's lab"
- The user references `/work/` or "FIG. NN" and wants to add to it
- The user mentions extending the "Model Examples" dropdown

Do NOT use for:
- Editing copy on an existing lab (just edit the file directly)
- Fixing bugs in an existing lab (just fix; don't run this whole flow)
- Anything outside `/work/` (homepage hero, contact section, etc.)

## High-level workflow

These steps are sequential. Do not skip any. The QA gate at step 8
is the contract — without it, the site can be broken by a scheduled
unattended run, which defeats the purpose of this skill.

1. **Capture the lab idea.** What does it demonstrate? What's the
   user-visible interaction? Name the lab and its slug. Pick a FIG
   number (next integer after the highest existing).
2. **Decide if it needs a model.** See "ML pipeline decision" below.
3. **Read the lab pattern.** Open the most recent existing lab
   (`work/sketch-lab/index.html`) and treat its structure as the
   spec. Match every section, every label format, every dateline
   field. See `references/lab-structure.md`.
4. **Generate the new lab files** from `templates/`. Substitute the
   placeholders. Save to:
   - `work/<slug>-lab/index.html`
   - `assets/css/<slug>-lab.css`
   - `assets/js/<slug>-lab.js`
   - (optional) `notebooks/<slug>_model.py`
   - (optional) `assets/models/<slug>/` for trained model files
   - (optional) `assets/data/<slug>/methodology.json` for receipts
5. **If the lab uses a trained model**, run the notebook to generate
   the model files. See `references/ml-pipeline.md`.
6. **Cross-cutting updates** — the new lab must be wired into the
   site's existing nav. See `references/cross-cutting.md` for the
   exact list of files and edits.
7. **SEO wiring** — every new lab needs full meta tags, three
   JSON-LD blocks, a per-lab OG image, a sitemap entry, an
   llms.txt entry, and a Related-labs aside. See
   `references/seo.md` for the complete contract; without these,
   the lab is effectively invisible to Google, Bing, and AI
   search. Run the helpers in this order:
   - `python3 notebooks/generate_og_images.py` (per-lab card)
   - `python3 notebooks/wire_og_images.py` (rewrites og:image lines)
   Manually update `sitemap.xml` and `llms.txt`. The
   `cross_cutting_update.py` script does NOT touch these — they
   need human judgment about priority and section placement.
8. **Bump cache-bust versions** on every HTML page that links the
   modified `main.css` or `main.js`.
9. **Run the QA gate**: `python3 .claude/skills/portfolio-lab-creator/scripts/verify_lab.py <slug>`.
   This is the contract. It checks:
   - Every JS-referenced ID exists in the HTML
   - Every asset file exists at the expected path
   - All FIG numbers are unique and sequential
   - Lab counter ("Lab N of M") is consistent across all labs
   - Nav dropdown lists every existing lab on every page
   - Cache-bust versions are consistent
   - Any ONNX model loads and produces an output of the expected shape
   - Homepage labs grid shows the right number of cards
   - JS files pass `node --check`
   - Optional Python notebook (if exists) passes a basic syntax check
   - SEO contract: per-lab OG image exists at the expected path,
     `sitemap.xml` has a `<url>` entry for the new slug, `llms.txt`
     mentions the new slug, canonical and og:url present, and the
     description length is 60–160 chars (see `references/seo.md`)
10. **Commit.** Only after the QA gate returns 0. Use a descriptive
    message that names the FIG number and slug. Do NOT push from
    this skill on an interactive run — leave that to the user. On
    a SCHEDULED run, push only if both the QA gate AND a
    post-commit smoke render in jsdom both pass (see "Scheduled
    mode" below). The post-push deploy GitHub Action will ping
    IndexNow automatically — no manual step required.

## ML pipeline decision

Most existing labs are pure client-side computation (no model
training). Some (sketch, churn, recommendation) ship a trained
model. Decide based on the topic:

- **No model needed** if the lab demonstrates an algorithm whose
  parameters can be set live by the user (A/B test simulator, funnel
  sim, simple physics demo). Math runs in JS. No notebook required.
- **Trained model needed** if the lab demonstrates supervised or
  unsupervised learning on real data (sketch recognition, churn
  classifier, recommender). Notebook trains, exports to ONNX or
  static JSON, frontend loads at runtime.

If a model is needed, see `references/ml-pipeline.md` for:
- Training environment constraints (no PyTorch in sandbox; sklearn
  + skl2onnx is the path of least resistance)
- ONNX export contract (input/output names and shapes)
- Browser-side preprocessing parity rules
- The methodology.json schema the receipts panel reads

## File layout for a new lab

A complete lab "<slug>-lab" produces these files (copy structure
exactly; existing labs all match):

```
work/<slug>-lab/
└── index.html

assets/
├── css/<slug>-lab.css
├── js/<slug>-lab.js
├── models/<slug>/                       # only if ML-backed
│   ├── model.onnx
│   └── categories.json (or similar)
└── data/<slug>/                         # only if there's a receipts panel
    └── methodology.json

notebooks/
└── <slug>_model.py                      # only if ML-backed
```

## Cross-cutting updates required

A new lab is not "done" until ALL of these are also updated:

- Homepage `index.html`:
  - Add a 7th (or whatever-th) lab card to `.labs-grid`
  - Add the slug to the nav dropdown
  - The labs grid CSS may need to swap layout (5x1 → 3x2, 3x2 →
    3x3, etc. depending on count). See `references/cross-cutting.md`.
- Every existing lab in `work/*-lab/index.html`:
  - Add the new slug to its nav dropdown
  - Update lab-nav prev/next: `Lab N of M` → bump M
  - The previous "last" lab's lab-nav next link must point to the
    new lab instead of looping back to lab 01

`references/cross-cutting.md` has the exact list of files and the
search-and-replace operations.

## Templates

`templates/` contains starter files with placeholders in `{{double_braces}}`.
Substitute every placeholder. Required ones:

- `{{slug}}` — kebab-case lab name, e.g. `markov-chain` (used in URLs and class names)
- `{{name}}` — display name, e.g. `Markov Chain`
- `{{fig_number}}` — two-digit string, e.g. `07`
- `{{section_letter}}` — used in subsection labels, e.g. `07.1`, `07.2`
- `{{title_main}}` — H1 main text, e.g. `States, transitions,`
- `{{title_accent}}` — H1 italic accent word, e.g. `everywhere.`
- `{{biz_line}}` — italic translation of what the model does in
  business terms (see `references/conventions.md`)
- `{{kicker}}` — methodology paragraph (~3 sentences)
- `{{problem_paragraphs}}` — § I content
- `{{methodology_pipeline}}`, `{{methodology_inference}}`,
  `{{methodology_reading_list}}`, `{{methodology_limitations}}`
- `{{prev_slug}}`, `{{prev_fig}}`, `{{prev_name}}` — for the lab-nav
- `{{lab_count}}` — total labs after this one is added (e.g. `06`)

## Scheduled mode

When invoked from a scheduled task (no user in the loop):

1. **Pick the topic from a queue.** The user maintains
   `notebooks/lab_topic_queue.txt`, one topic per line. Read the
   first uncommented line. If empty or missing, abort with a status
   line; do not invent a topic.
2. **Build the lab end-to-end** following the same workflow as
   interactive mode.
3. **Run the QA gate.** If it fails, abort. Do NOT commit a broken
   lab. Write a status file at `notebooks/.lab_creator_log.md`
   describing what failed.
4. **Smoke render in jsdom** of the new lab page AND the homepage
   AND one randomly-chosen existing lab. Confirms cross-cutting
   updates didn't break anything. If any fail, abort.
5. **Commit and push** only if every gate passes. Use commit message:
   `lab: add FIG. NN <slug> [auto, scheduled run]`.
6. **On any failure**, leave the working tree untouched (`git stash`
   any partial changes), write the status file, and exit nonzero.

The point of scheduled mode is that **a broken site is much worse
than a missing lab**. When in doubt, abort.

## Site conventions to preserve

These come from `references/conventions.md`. Skim that file in full
before writing any new copy.

- Typography: Newsreader (serif display) + DM Mono. No other fonts.
- Section labels: small caps mono, `§ N · LABEL TEXT` or `FIG. NN ·
  LABEL TEXT`.
- Figure numbering: numeric (`FIG. 06`, `FIG. 06.1`), never letters.
- No em dashes in body prose. Use periods or commas.
- H1 pattern: short direct statement with one italic accent word
  in red (`var(--accent)`).
- Lab biz-line below H1: italic Newsreader, business-outcome framing.
- No resume framing. The site is editorial, not corporate. No
  "Download Resume", no recruiter-brief PDFs.
- No build step, no framework. Pure HTML + vanilla JS + CSS.
- Analytics: Cloudflare Web Analytics is enabled at the Pages
  level (auto-injected, privacy-respecting, no cookies). Don't
  add any second analytics provider — one is enough.
- No new accent colors. Stick to `--paper`, `--ink`, `--ink-soft`,
  `--ink-dim`, `--accent`.

## Reference files in this skill

Read the relevant ones before / during your work:

- `references/lab-structure.md` — the section-by-section anatomy of
  a lab page, with the markup pattern for each
- `references/conventions.md` — typography, voice, copy rules
- `references/cross-cutting.md` — exactly which files to edit when
  adding a lab and the exact search/replace operations
- `references/seo.md` — meta tags, JSON-LD, OG image, sitemap,
  llms.txt, related-labs aside. Required for every new lab; not
  optional polish.
- `references/ml-pipeline.md` — for ML-backed labs: training
  environment, ONNX export contract, methodology schema, browser
  preprocessing parity
- `references/qa-checklist.md` — what `verify_lab.py` checks and how
  to interpret each failure

## Templates in this skill

Don't write a new lab from scratch. Copy the templates and
substitute placeholders.

- `templates/index.html` — full lab page boilerplate
- `templates/lab.css` — page-specific styles
- `templates/lab.js` — JS skeleton with canvas/visualization stubs
- `templates/notebook.py` — training pipeline boilerplate (if model-backed)

## Scripts in this skill

- `scripts/verify_lab.py <slug>` — the QA gate. MUST pass before
  commit. Returns 0 on success, nonzero with a printed list of
  failures otherwise.
- `scripts/cross_cutting_update.py <slug> <fig> <name>` — applies
  the search/replace operations across the homepage and all
  existing labs to add the new lab to nav + lab-nav. Idempotent;
  safe to run twice.
- `scripts/render_check.mjs <slug>` — renders the new lab page in
  jsdom, asserts every element ID referenced by the lab's JS exists
  in the HTML, exits nonzero on miss.

## Failure modes seen in past labs (for your awareness)

Every one of these has happened. The QA gate covers them now, but
knowing them helps you avoid them.

1. **CSS block delete took an adjacent rule.** Removing the form
   CSS killed `.contact-ctas`. Site silently rendered buttons
   stacked on top of the kicker text.
2. **Cache-bust forgotten on labs.** Updated `main.css` but didn't
   bump versions on lab pages. Some pages showed new styles, others
   showed stale.
3. **Stale CDN routing on apex domain.** `jakecuth.com` and
   `www.jakecuth.com` resolved to different deployments for a few
   hours during DNS propagation. The QA gate now hits both.
4. **ONNX preprocessing mismatch.** Trained model expected centered
   28x28 white-on-black; browser sent uncentered black-on-white.
   Predictions defaulted to the model's prior. Fixed by bbox-cropping
   in JS. The ml-pipeline reference now demands a parity check.
5. **Pages Function returned 5xx.** Cloudflare replaced the JSON
   body with its branded error HTML. Frontend got `<!DOCTYPE` and
   barfed. Functions in this site never emit 5xx; they use 200 +
   `ok: false`.

## Ship checklist (use this every time)

Before declaring done, walk through this list:

- [ ] All new files committed at the right paths
- [ ] Every existing lab nav dropdown has the new entry
- [ ] Every existing lab's "Lab N of M" reflects the new total
- [ ] Last-existing-lab's lab-nav next link points to new lab
- [ ] Homepage labs grid shows new card; grid layout updated if
      switching from N×1 to N×2 or similar
- [ ] `main.css` and `main.js` cache-bust versions bumped where
      they were modified, AND every page that references them
      has the new version
- [ ] If model-backed: methodology.json present, model.onnx loads,
      preprocessing parity check passes
- [ ] **SEO contract from `references/seo.md`:**
  - [ ] All meta tags present: canonical, og:type/title/description/
        image/url/site_name/locale, article:published_time,
        article:modified_time, twitter:card/title/description/
        image/site/creator, theme-color
  - [ ] Three JSON-LD blocks present: BreadcrumbList, Article,
        WebApplication
  - [ ] `assets/og/<slug>-lab.png` exists (1200×630) — generated
        by `notebooks/generate_og_images.py`
  - [ ] `og:image` and `twitter:image` URLs use
        `https://www.jakecuth.com/...` (not bare apex)
  - [ ] `sitemap.xml` has a `<url>` for the new lab
  - [ ] `llms.txt` has a bullet for the new lab in the right section
  - [ ] Related-labs aside renders on the new lab and links to 3
        cluster-mates
  - [ ] Description meta is 60–160 characters
- [ ] `scripts/verify_lab.py <slug>` exits 0
- [ ] On scheduled run: smoke render in jsdom of new lab + homepage
      + one random existing lab all succeed
- [ ] Commit message includes FIG number, slug, and "[auto]" if
      scheduled
- [ ] On scheduled run only: `git push` succeeded (deploy Action
      will then auto-ping IndexNow with all sitemap URLs)
