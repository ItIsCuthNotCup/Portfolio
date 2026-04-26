# Conventions — typography, voice, copy

These conventions hold across every lab. New labs that drift from
them stick out and weaken the overall site coherence.

## Typography

- **Newsreader** — serif display, for H1/H2/title text and biz-line
  italic translations
- **DM Mono** — for ALL chrome (section labels, dateline, FIG numbers,
  receipts labels, percentages, tool buttons, lab-nav)
- **No other fonts.** Don't add Google Fonts links for new typefaces.

## Color palette

Defined as CSS variables in `assets/css/main.css`. Use them; do not
introduce new colors.

- `--paper` — page background (cream)
- `--ink` — primary text (near-black)
- `--ink-soft` — secondary text (gray-black)
- `--ink-dim` — tertiary text / dividers (light gray-black)
- `--accent` — single accent (red), used for FIG numbers, italic
  H1 accent words, and active states. Use sparingly.

## Section labels

Always mono, small caps, with a red FIG/§ index followed by a label
phrase:

```
§ I · Why funnel averages lie
§ II · FIG. 06.1 · The classifier — draw something
FIG. 06 · A neural net, drawn live
```

The dot separator (`·`) is U+00B7 (middle dot), not a period.

## Figure numbering

- Lab heros use `FIG. NN` where NN is a two-digit number (`FIG. 01`,
  `FIG. 06`)
- Sub-figures within a lab use `FIG. NN.X` (`FIG. 06.1`, `FIG. 06.2`)
- Sub-sub-figures (rare) use `FIG. NN.X.Y` or `FIG. NN.Xa/b`
- Local step labels inside how-it-works panels use `Fig. A`, `Fig. B`,
  `Fig. C` — these are SEPARATE from the global numbering; they're
  three-card-explainer markers
- Project frame-label captions on the homepage use generic `Fig. —
  product demo` without numbers

Never use letters for the global figure series. We migrated G→01
through K→05 specifically to fix this.

## Em dashes

**Don't use them in body prose.** The user has stated this as a
preference. Use periods or commas. Section labels and figure
captions use the `·` middle dot; if you need to indicate "a goes
to b", use the middle dot or "to".

Em dashes that ARE allowed (because they're typographic conventions,
not prose):
- The "Fig. — caption" pattern on homepage project frames
- Section labels with `—` separator are fine but `·` is preferred

## H1 pattern

Short direct statement, italic accent at the end (1-2 words),
italic accent in red:

```html
<h1 class="serif big-display <prefix>-title">
  {first part of phrase}<br>
  <span class="serif-italic" style="color:var(--accent)">{accent}.</span>
</h1>
```

Examples that work:
- `The customers about to leave.` / accent: "about to leave."
- `Drawing, classified live.` / accent: "live."
- `When A/B tests lie.` / accent: "lie."
- `The leak in the funnel.` / accent: "funnel."

Examples that don't:
- "A neural network for sketch recognition." (not direct enough)
- "Sketch Recognition Demo" (too plain)
- "Recognition!" (gimmicky)

## Lab biz-line

Italic Newsreader, sits between H1 and methodology kicker. The
business-outcome translation. Should answer "what does a hiring
manager get from this?" in 30-50 words.

```html
<p class="lab-biz-line">
  A small neural network that runs entirely in your browser. Trained
  once, deployed everywhere, costs nothing per call. The deployment
  shape every shippable ML demo needs.
</p>
```

Other examples:
- Churn: "A churn model, built and run in public. Finds the
  customers who are about to cancel so the company can save them.
  Every saved account is revenue already paid to acquire."
- Funnel: "An agent-based funnel simulation. Finds the one customer
  segment that's quietly killing conversion and fixes it without
  touching the three that already work."

The pattern: name the model type → say what it returns → translate
to dollars/revenue/cost.

## Methodology kicker

The `<prefix>-kicker` paragraph below the biz-line. ~3 sentences.
Methodology focused. Says what runs live, what data, what the
math is.

```html
<p class="<prefix>-kicker">
  Draw any of 30 categories on the canvas below. A classifier trained
  on 90,000 sketches from Google's Quick Draw dataset predicts what
  it sees on every stroke. Inference runs on your laptop in under
  50 ms. Nothing phoned home, no preloaded answers.
</p>
```

## What the site does NOT do

- No "Download Resume" buttons, no recruiter-brief PDFs, no
  "References available" blocks. The site is editorial, not
  corporate. LinkedIn handles the resume.
- No build step, no framework. Pure HTML + vanilla JS + CSS.
- No analytics. The site has no GA, no Plausible, no tracking.
- No emoji in body copy. (OK in JS console messages where the user
  won't see them.)
- No new accent colors.
