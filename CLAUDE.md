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

## Site structure

```
~/Desktop/Desktop - Jacob's MacBook Air/Apps/Portfolio/
├── index.html                       # homepage
├── assets/
│   ├── css/main.css                 # global styles + per-section blocks
│   ├── css/<lab>-lab.css            # one per lab
│   ├── js/main.js                   # global JS (scroll, scene stage, etc.)
│   └── js/<lab>-lab.js              # one per lab
├── work/
│   ├── churn-lab/index.html         # FIG. 01
│   ├── segmentation-lab/index.html  # FIG. 02
│   ├── reco-lab/index.html          # FIG. 03
│   ├── ab-test-lab/index.html       # FIG. 04
│   └── funnel-sim-lab/index.html    # FIG. 05
└── notebooks/                       # Python: training + validation
```

Six `index.html` files in total. Cowork's file picker shows them as a
flat list without folder paths — they're not duplicates. The user's
Cowork "Portfolio" folder mount is currently empty/wrong; the actual
working folder is the path above.

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
