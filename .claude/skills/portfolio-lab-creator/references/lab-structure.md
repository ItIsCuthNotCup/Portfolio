# Lab page structure — section by section

Every lab follows the same structure. This file documents each
section so you can match the pattern without guessing.

## Page skeleton

```
<head>
  <meta>...</meta>
  <link rel="stylesheet" href="/assets/css/main.css?v=N">
  <link rel="stylesheet" href="/assets/css/<slug>-lab.css">
  ...
</head>
<body>
  <header class="masthead">...</header>
  <main class="<prefix>-main">
    <section class="<prefix>-hero">...</section>          <!-- FIG. NN + H1 -->
    <hr class="rule">
    <section class="<prefix>-section">...</section>       <!-- § I — PROBLEM -->
    <hr class="hair">
    <section class="<prefix>-section">...</section>       <!-- § II · FIG. NN.1 — DEMO -->
    <hr class="hair">
    <section class="<prefix>-section">...</section>       <!-- § III — HOW IT WORKS -->
    <hr class="hair">
    <section class="<prefix>-section">...</section>       <!-- § IV · FIG. NN.2 — additional viz / adversarial -->
    <hr class="hair">
    <section class="<prefix>-section">...</section>       <!-- § V — RECEIPTS -->
    <hr class="hair">
    <section class="<prefix>-section colophon">...</section>  <!-- § VI — METHODOLOGY + lab-nav -->
    <footer class="colophon mono">...</footer>
  </main>
  ...
  <script src="/assets/js/main.js?v=N"></script>
  <script src="/assets/js/<slug>-lab.js?v=1"></script>
</body>
```

The `<prefix>` is a 2-3 letter abbreviation derived from the slug
(`fs-` for funnel-sim, `sk-` for sketch, `ab-` for ab-test). Pick
one that doesn't collide with other labs.

## Masthead

Identical across all labs. Copy verbatim from the most recent lab.
The only thing that changes is which dropdown entry has
`class="active" aria-current="page"`.

```html
<header class="masthead">
  <div class="mono masthead-dateline">
    Vol. <span style="color:var(--accent)">XII</span> · No.
    <span id="masthead-issue">04</span> ·
    <span id="masthead-date">Apr 2026</span>
  </div>
  <div class="masthead-name">
    <a href="/"><span class="serif">Jake <span class="serif-italic">Cuth.</span></span></a>
  </div>
  <nav class="mono masthead-nav">
    <a href="/#projects">Projects</a>
    <div class="nav-dropdown">
      <button class="nav-dropdown-toggle has-active" type="button"
              aria-haspopup="menu" aria-expanded="false">
        Labs <span class="nav-caret" aria-hidden="true">▾</span>
      </button>
      <div class="nav-dropdown-menu" role="menu">
        <a href="/work/churn-lab/" role="menuitem">Churn Model</a>
        <!-- ...all other labs in order... -->
        <a href="/work/<slug>-lab/" class="active" aria-current="page" role="menuitem"><name></a>
      </div>
    </div>
    <a href="/#education">Education</a>
    <a href="/#contact" class="btn-pill">Get in touch ↗</a>
  </nav>
</header>
```

The dropdown menu must list every existing lab in order plus the
new one. The current lab gets `class="active" aria-current="page"`.
NEVER change the order of existing labs in the dropdown.

## Hero

```html
<section class="<prefix>-hero">
  <div class="mono section-label">
    <span class="idx">FIG. NN</span>
    <span>{{short editorial subhead, ~5 words}}</span>
  </div>
  <h1 class="serif big-display <prefix>-title">
    {{title_main}}<br>
    <span class="serif-italic" style="color:var(--accent)">{{title_accent}}</span>
  </h1>
  <p class="lab-biz-line">
    {{biz_line — 2 sentences, italic, business outcome focused}}
  </p>
  <p class="<prefix>-kicker">
    {{methodology kicker — 3-ish sentences, what's on the page,
      what runs live, what's measured}}
  </p>
  <div class="mono <prefix>-dateline">
    <div><div class="label">Filed</div><div class="value" id="dateline-time"></div></div>
    <div><div class="label">Engine</div><div class="value">{{engine description, e.g. "ONNX Runtime Web · WASM"}}</div></div>
    <div><div class="label">Source</div><div class="value">
      <a href="https://github.com/ItIsCuthNotCup/Portfolio/blob/main/notebooks/<slug>_model.py"
         target="_blank" rel="noopener" style="border-bottom:1px solid">
         notebooks/<slug>_model.py ↗
      </a>
    </div></div>
  </div>
</section>
```

The H1 pattern is "phrase, italic accent" — the accent is one or
two words in italic Newsreader, red. Examples:

- Churn: `The customers about to leave.` (accent: "about to leave.")
- Funnel: `The leak in the funnel.` (accent: "funnel.")
- Sketch: `Drawing, classified live.` (accent: "live.")

The biz-line is the business-outcome translation. It sits between
the H1 and the methodology kicker. ~50 words, italic, written so
a hiring manager understands what the model returns in dollars.

The dateline grid has 3 cells: Filed (date, JS-populated), Engine
(one-line tech), Source (GitHub link to the notebook).

## § I — Problem

A 2-3 paragraph framing of why this kind of model matters. NOT
"here's how it works." It's the editorial voice setting up the
demo. Each existing lab has one — read 2-3 of them to absorb the
voice before writing yours.

```html
<section class="<prefix>-section">
  <div class="mono section-label">
    <span class="idx">§ I</span>
    <span>{{problem framing label, e.g. "Why funnel averages lie"}}</span>
  </div>
  <div class="<prefix>-prose">
    <p class="<prefix>-lede">{{italic lede sentence}}</p>
    <p>{{paragraph 2}}</p>
    <p>{{paragraph 3 — typically the editorial turn}}</p>
  </div>
</section>
```

## § II — The interactive demo (FIG. NN.1)

This is the centerpiece. Either a canvas, a control panel + viz,
a form, or whatever the lab does interactively. The structure
varies per lab but the section-label format is consistent:

```html
<section class="<prefix>-section <prefix>-section-demo">
  <div class="mono section-label">
    <span class="idx">§ II · FIG. NN.1</span>
    <span>{{label, e.g. "The classifier — draw something"}}</span>
  </div>
  <p class="<prefix>-note">{{1-line orienting note}}</p>

  <!-- the interactive UI -->
  ...
</section>
```

## § III — How it works

3-card grid explaining the three core technical decisions. Use
the `<prefix>-how-grid` + `<prefix>-how-card` pattern from the
sketch lab.

Each card has:
- A mono "Fig. A/B/C" sub-label (these are local step markers,
  NOT part of the global figure numbering)
- A serif title
- A paragraph

## § IV — Additional visualization (FIG. NN.2)

Optional. Used when the lab benefits from a second view (the
adversarial gallery in sketch, the scenario fingerprints in
funnel-sim, the K-selection elbow plot in segmentation).

If included, label format is `§ IV · FIG. NN.2` to keep the
figure numbering coherent.

## § V — Receipts

A grid of stat cells. Pulled from `assets/data/<slug>/methodology.json`
if the lab has a notebook, otherwise hardcoded.

```html
<section class="<prefix>-section">
  <div class="mono section-label">
    <span class="idx">§ V</span>
    <span>Receipts</span>
  </div>
  <div class="<prefix>-receipts" id="<prefix>-receipts">
    <!-- populated from methodology.json by JS, OR hardcoded:
         <div class="<prefix>-receipt">
           <div class="<prefix>-receipt-label">label</div>
           <div class="<prefix>-receipt-value">value<span class="small">unit</span></div>
         </div>
    -->
  </div>
</section>
```

## § VI — Methodology + lab-nav + back link

The closing section. 4-card method-grid (Engine, Model spec,
Reading list, Limitations) followed by lab-nav prev/next followed
by back-to-portfolio CTAs.

```html
<section class="<prefix>-section <prefix>-colophon-section">
  <div class="mono section-label">
    <span class="idx">§ VI</span>
    <span>Methodology &amp; Colophon</span>
  </div>
  <div class="method-grid">
    <div>
      <div class="mono method-head">{{Engine | Pipeline}}</div>
      <p>{{1 paragraph}}</p>
    </div>
    <div>
      <div class="mono method-head">{{Inference | Model spec}}</div>
      <p>{{1 paragraph}}</p>
    </div>
    <div>
      <div class="mono method-head">Reading list</div>
      <p>
        <a href="..." target="_blank" rel="noopener" style="border-bottom:1px solid">{{ref 1}} ↗</a><br>
        <a href="..." target="_blank" rel="noopener" style="border-bottom:1px solid">{{ref 2}} ↗</a><br>
        <a href="..." target="_blank" rel="noopener" style="border-bottom:1px solid">{{ref 3}} ↗</a>
      </p>
    </div>
    <div>
      <div class="mono method-head">Limitations</div>
      <p>{{honest 1 paragraph about what the model can't do}}</p>
    </div>
  </div>

  <nav class="lab-nav mono" aria-label="Lab navigation">
    <a href="/work/<prev_slug>-lab/">← Prev: {{prev_name}} (FIG. NN_PREV)</a>
    <span>Lab NN of MM</span>
    <a href="/work/<next_slug>-lab/">Next: {{next_name}} (FIG. NN_NEXT) →</a>
    <!-- For the last lab in the series, the next link should point
         back to lab 01 with text "Back to Lab 01: <name>" -->
  </nav>

  <div class="method-ctas">
    <a href="/" class="btn-outline">← Back to the portfolio</a>
    <a href="https://github.com/ItIsCuthNotCup/Portfolio/blob/main/notebooks/<slug>_model.py"
       target="_blank" rel="noopener" class="btn-outline">
      View the script on GitHub ↗
    </a>
  </div>
</section>
```

## Footer (colophon)

Copy verbatim from any existing lab.

```html
<footer class="colophon mono">
  <div>Set in Newsreader &amp; DM Mono · Printed on the open web</div>
  <div>© Jacob Cuthbertson · MMXXVI</div>
  <div>
    <a href="https://github.com/jacobcuthbertson" target="_blank" rel="noopener">GitHub</a> ·
    <a href="https://www.codewars.com/users/jacobcuthbertson" target="_blank" rel="noopener">Codewars</a> ·
    <a href="https://www.linkedin.com/in/jacobcuthbertson/" target="_blank" rel="noopener">LinkedIn</a>
  </div>
</footer>
```

## Theme switcher + scripts

The site has a paper / blueprint / graphite theme switcher. Always
include it after the footer:

```html
<div class="theme-switcher">
  <div class="theme-btn active" data-t="paper" title="Editorial Paper"></div>
  <div class="theme-btn" data-t="blueprint" title="Blueprint"></div>
  <div class="theme-btn" data-t="graphite" title="Graphite + Acid"></div>
</div>
```

Then load the global script + the lab-specific script (with
cache-bust):

```html
<script src="/assets/js/main.js?v=N"></script>
<script src="/assets/js/<slug>-lab.js?v=1"></script>
```
