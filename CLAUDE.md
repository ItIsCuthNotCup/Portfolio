# CLAUDE.md — Working memory for the jakecuth.com portfolio repo

This file is read by Claude at the start of every session that opens
this repo. Anything written here is the contract.

## Where the repo actually lives

The user's iCloud-synced location:

```
~/Library/Mobile Documents/com~apple~CloudDocs/Desktop - Jacob's MacBook Air/Apps/Portfolio
```

…which appears as `~/Desktop/Desktop - Jacob's MacBook Air/Apps/Portfolio`
when iCloud Desktop & Documents Sync is enabled. The user has TWO
Desktop folders in iCloud (a sync artifact from switching Macs); the
real repo is in the one with the Mac name appended. The plain
`~/Desktop/Apps/Portfolio` does NOT exist — looking there returns nothing.

## Hard rules — non-negotiable

### 1. Verify rendered output before claiming a change is done.
Static analysis ("the CSS looks right", "tests pass") is not enough.
For any visible change, do one of:
- WebFetch the live URL after deploy and inspect the response
- Curl the page and grep for the exact change
- Run jsdom or a headless renderer against the file
- Ask the user to screenshot before declaring done

The contact section has shipped broken twice because I edited CSS,
"reasoned" that it was correct, and shipped without checking. Stop.

### 2. CSS deletes are dangerous. Surgically remove, never sweep.
When removing a CSS block, list every selector inside it and confirm
each is unused before deleting. Recurring failure mode: deleting a
parent block (`.contact-form ...`) and accidentally taking out
adjacent rules (`.contact-ctas`) because they were near it in the file.

### 3. Cache-bust EVERY HTML reference to a changed asset.
The site pulls `main.css?v=N` and `main.js?v=N` on every page (homepage
+ five labs). When CSS or JS changes, increment the version on every
page that references it. Otherwise the user sees stale assets and
blames the code.

### 4. Never emit 5xx from a Cloudflare Pages Function.
Cloudflare's edge replaces 5xx responses with its own branded HTML
error page, even when the function returns valid JSON. Use 200 with
`{ ok: false, error: "..." }` for runtime errors. Reserve actual
status codes only for client-side validation (400) and method-not-
allowed (405).

### 5. Don't drive the user's browser to handle their secrets.
If a task involves API keys, env vars, or anything in a settings
dashboard, write the code, push it, and have the USER paste the
secret into Cloudflare. Never request_access to Chrome to do it
yourself — the user can do it faster and safer.

### 6. For shipped ML models: preprocessing parity matters more than model quality.
If the training pipeline preprocessed inputs in a specific way
(centered, cropped, normalized, color-channel-ordered), the
inference path in the browser MUST replicate that exactly. The
sketch lab shipped initially with a 480-canvas-direct-downsample-
to-28x28 path; training data was centered and tightly fit. Result:
the model defaulted to its no-signal prior (sun/lightning/mountain)
on every prediction. The model was fine. The preprocessing was
destroying the input.

Before declaring an ML demo working: synthesize 3-4 trivial
inputs (centered circle, line, etc.), run them through the SAME
pipeline the browser uses, and verify the predictions are sane.
If "centered circle" doesn't return what you'd expect, the bug
is in preprocessing.

## Site structure

```
~/Desktop/Desktop - Jacob's MacBook Air/Apps/Portfolio/
├── index.html                       # homepage
├── _headers                         # Cloudflare Pages headers (cache, CSP, HSTS)
├── assets/
│   ├── css/main.css                 # global styles + per-section blocks
│   ├── css/<lab>-lab.css            # per-lab styles (where present)
│   ├── js/main.js                   # global JS (scroll, scene stage, etc.)
│   └── js/<lab>-lab.js              # per-lab logic
├── functions/
│   └── api/model-picker.js          # CF Pages Function — RAG over OpenRouter
├── work/
│   # Model Labs section (FIG. 01–16, in homepage order)
│   ├── churn-lab/                   # FIG. 01
│   ├── segmentation-lab/            # FIG. 02
│   ├── reco-lab/                    # FIG. 03
│   ├── ab-test-lab/                 # FIG. 04
│   ├── funnel-sim-lab/              # FIG. 05
│   ├── sketch-lab/                  # FIG. 06 — ONNX in-browser
│   ├── model-picker-lab/            # FIG. 07 — calls /api/model-picker
│   ├── jobs-lab/                    # FIG. 08
│   ├── time-use-lab/                # FIG. 09
│   ├── watchdog-lab/                # FIG. 10 — daily cron-refreshed data
│   ├── agi-forecast-lab/            # FIG. 11
│   ├── logistic-regression-lab/     # FIG. 12
│   ├── model-atlas-lab/             # FIG. 13 — gateway to deeper model demos
│   ├── imm-lab/                     # FIG. 14 — pings imm-lab-api on Cloud Run
│   ├── productivity-lab/            # FIG. 15
│   ├── llm-learning-lab/            # FIG. 16
│   # Tests section
│   ├── escape-velocity-lab/         # TEST. 01
│   ├── semiconductor-lab/           # TEST. 02
│   # Deeper model demos reachable from model-atlas-lab
│   ├── dbscan-lab/  decision-tree-lab/  gradient-boosting-lab/
│   ├── isolation-forest-lab/  kmeans-lab/  knn-lab/
│   ├── linear-regression-lab/  mlp-lab/  naive-bayes-lab/
│   └── random-forest-lab/  ridge-lasso-lab/  svm-lab/
└── notebooks/                       # Python: training + validation
```

Cowork's file picker shows the `index.html` files as a flat list without
folder paths — they're not duplicates. The user's Cowork "Portfolio"
folder mount is currently empty/wrong; the actual working folder is the
path above. When adding a lab, register it in BOTH the labs grid in
`/index.html` AND the Labs dropdown in the masthead nav.

## Conventions to preserve (don't drift from these)

- **Typography**: Newsreader (serif) for display, DM Mono for chrome
  labels, dateline, and FIG numbers
- **Colors**: `--paper`, `--ink`, `--ink-soft`, `--ink-dim`, `--accent`
  (red). Do not introduce new accent colors
- **Section labels**: small caps, mono, format `§ I · LABEL TEXT` or
  `FIG. NN · LABEL TEXT`
- **Figure numbering**: numeric, never letters (we migrated G→01..K→05)
- **No em dashes in body prose** (user preference — use periods or commas)
- **Hero subhead**: business-outcome framing, three sentences max
- **Each lab opens with**: §-label → big serif H1 → `lab-biz-line`
  italic translation → existing kicker → dateline grid
- **Lab-to-lab nav**: prev/next at bottom of every lab, format
  "Lab NN of 05"
- **Build stamp on funnel sim**: gated behind `?debug=1`, hidden by default

## Stack constraints

- **No build step**. Pure HTML + vanilla JS + CSS. No React, no Vue,
  no bundler. Match this for every new lab.
- **No analytics**. The site has no GA, no Plausible, no tracking.
  Don't add any.
- **No backend except as last resort**. The contact form was reverted
  to a `mailto:` link after Resend integration failures. Default to
  static. New labs must be client-side computation.
- **Deploy**: GitHub Actions → Cloudflare Pages. Push to `main` =
  auto-deploy in ~60s.

## Recurring user preferences

- **Never resume-style framing**. The site is editorial, not corporate.
  No "Download Resume" buttons, no recruiter-brief PDFs, no
  "References available" blocks. LinkedIn handles the resume.
- **The user arrives warm from LinkedIn**. They've already seen the
  resume. Site's job is to demonstrate work, not re-state credentials.
- **Direct over clever**. H1s should say what the model does in plain
  language. Save the editorial twist for the italic accent word.
- **Receipts are sacred**. Real numbers from notebooks, not aspirational.

## Session-end discipline

Before declaring a task complete:
1. Re-read the diff. Spot any accidental deletions outside the
   intended scope.
2. If visible change, fetch the live URL or render locally to confirm.
3. Bump cache-bust versions on every HTML page that references the
   changed asset.
4. Update this file if a non-obvious lesson was learned.
