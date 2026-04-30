# FIG. 11 — AGI Forecast Atlas

> Planning doc. Not built yet. Iterating with Cuth.
> Last updated: 2026-04-29 · v0.3

## Changelog
- **v0.5** (2026-04-29): Merged ChatGPT batch 3 (40 CSV rows). Adopted
  richer schema from the CSV: `source_url`, `verified_level` (high /
  medium / low), `source_quality` (primary / news / secondary /
  synthesis), `stance_category` (optimist / skeptic / safety-aware /
  etc.), and crucially `include_in_average` — a flag that excludes
  framework rows, definitional disputes, task milestones, and
  workforce-only forecasts from the headline median/mean. Dataset is
  now `predictions-v4.json` (250 rows, 140 unique entries, 202
  plottable, 187 in the average pool). The new median holds at **2030**
  and the new mean is **2036.4** — basically unchanged from v3, which
  is itself a finding worth surfacing in the lab.
- **v0.4** (2026-04-29): Replaced generic FIG. 11.1 scatter with
  signature visualization: **The Horizon** — animated lift-bar timeline
  with playhead scrubber. Each prediction is a vertical bar rising
  from the year it was said up to the year it forecasted. Press play
  and predictions accumulate left-to-right across 76 years; the +20
  diagonal becomes visible as a faint, glowing crest along which most
  bars terminate. This is the lab's signature visual.
- **v0.3** (2026-04-29): Merged ChatGPT batch 2 (19 rows). Five
  structural additions: DeepMind's AGI Levels framework (0–5),
  jagged-frontier task-specific predictions (Bestseller 2028, Surgery
  2050, etc.), Metaculus historical trajectory (2020:2070 → 2024:2029
  → 2026:2031 stabilization), HLMI vs FAOL 69-year gap detail
  (-48 years on FAOL between 2022 and 2023 surveys), and a four-camp
  synthesis (Frontier 2025–28 / Calibrated Market 2029–32 / Academic
  2040–47 / Economic Adoption 2100+). Dataset now `predictions-v3.json`
  (210 rows, 130 unique entries, 166 plottable). Three new sections
  proposed in the story arc.
- **v0.2** (2026-04-29): Merged ChatGPT batch 1 (8 rows). Two genuinely
  new framings landed: Hassabis "3–5 years" (sharper than v1's 5–10y)
  and Amodei "1–2 years for coding." Dataset is now `predictions-v2.json`
  (191 rows, 120 unique figures, 148 plottable). Added new question for
  Cuth: should domain-specific predictions (coding-AGI, math-AGI) get
  their own visual cut?
- **v0.1** (2026-04-29): Initial plan. v1 dataset from compass research.

---

## Premise (one paragraph)

Every notable figure in AI has a public guess for when artificial general
intelligence arrives. They've been making those guesses for seventy years.
The average prediction has, almost without exception, been "about twenty
years from now" — said in 1965, said in 1993, said in 2025. The dataset
of who said what, when, with what definition, is the most under-told
story in the AI conversation. This lab puts every named prediction on
one page, lets the reader interrogate it, and drops the punchline: the
median is a moving target.

---

## Three possible angles (pick one)

### Angle A — "The Twenty-Year Horizon" 🟡 RECOMMENDED

The whole story is the Armstrong/Sotala finding: predictions cluster
15–25 years from when they're uttered, regardless of the year. This is
empirically true across 70 years of data. Today's predictions of
2027–2035 sit on the same diagonal as Simon's 1965 prediction of 1985.

**Why this works:** It's a single big claim, the data backs it
cleanly, the visualization is one chart (a scatter with a diagonal),
and it lands a punch — the reader leaves with a frame they didn't
arrive with.

**Headline:** *"The future is always twenty years out."*

### Angle B — "The 2022 Compression"

Lead with the ChatGPT shock. Pre-GPT-4 expert medians sat at
2050–2080. Post-ChatGPT they collapsed to 2027–2035. That's the
biggest single shift in expert opinion in the history of the field,
and it happened in 18 months.

**Why this is weaker:** It's true but it's a sub-story of Angle A.
And a reader who arrives skeptical of AI hype gets the wrong takeaway
("the experts now agree it's soon!") rather than the right one ("the
experts have always thought it was soon, and they've always been
moved by the news cycle").

### Angle C — "Pick a person, see their bet"

Just a person/dashboard tool. Filter, hover, read.

**Why this is weakest:** No story. We've already built one
dashboard-style lab (jobs). Reader bounces.

**→ Going with Angle A.** Angle B becomes a section inside it.

---

## Working titles (in order of preference)

1. **"The future is always *twenty years out.*"** (H1)
2. "The forecast." (one-word)
3. "When does AGI arrive?" (literal)
4. "Seventy years of *almost ready.*"

`FIG. 11 · The AGI horizon`

---

## Story arc (sections)

Sequence assumes the reader has heard "AGI by 2030" in the news and
arrives mildly skeptical. We're going to validate their skepticism,
then complicate it, then leave them better-informed.

### Hero
Big serif H1 with the punchline. Three-sentence biz line that says:
this page maps every public prediction of when AGI arrives, made by
researchers, executives, and forecasters going back to 1950, and shows
why the answer has stayed the same for seventy years.

Dateline: filed today · sources: [list] · coverage: 183 predictions
from 120 named figures (and growing).

### § I — Lede
"Everyone agrees AGI is coming. They have for seventy years."
A two-paragraph lede that names Simon (1965), Minsky (1970), Vinge
(1993), Kurzweil (1999), Hassabis (2025) — and shows that each was
predicting roughly twenty years out from when they said it. Set up
the reveal.

### § II · FIG. 11.1 — **The Horizon** *(redesigned v0.4)*

The lab's signature visualization. Replaces the generic scatter with
a custom timeline that *visually performs* the 20-year-out claim
rather than just plotting it.

#### The visual

A wide editorial canvas (1280 × 540 desktop, vertical-stacking on
mobile). Aesthetic: editorial paper meets observatory. Should feel
inevitable, not flashy.

**Layout:**
- X-axis: **year said** — 1950 → 2030, decade ticks in mono
- Y-axis: **year predicted** — 1950 → 2100 with an "off-chart" band
  at the top for outliers (Brooks 2300, Hanson 2070+, etc.)
- Three reference lines drawn first, in increasing weight:
  - `y = x` (today line) — 1px hairline `--ink-dim`
  - `y = x + 20` (**the horizon**) — 1.5px accent red, slight glow
  - `y = x + 50` — 1px dashed `--ink-soft`

**Each prediction is a "lift":**
- A thin vertical line rising from `(year_said, year_said)` on the
  today line up to `(year_said, year_mid)` — a literal visual lift
  from "now" to "predicted future"
- A small filled dot at the top
- For predictions with ranges: render as a vertical bar from
  `year_low` → `year_high`, with a horizontal tick at `year_mid`
- Lift color: by camp, using muted editorial palette
  - Frontier industry: warm ochre (`#C77B3D`)
  - Academic: cool slate (`#5F7280`)
  - Tech exec: graphite (`#3D3D3D`)
  - Public intellectual: parchment (`#9C8B6E`)
  - Survey aggregate: accent red (`#A8332E`) at lower opacity
- Opacity: recent predictions full strength, pre-2010 predictions
  at 60% opacity (visual depth-of-field cue)

**Why it works:** The +20 horizon emerges as a *crest* along which
the dots terminate. Simon's 1965 → 1985 lift sits on it. Hassabis's
2025 → 2030 sits on it. The reader doesn't have to be told about
the 20-year bias; it's visible as the silhouette.

#### The motion (the part that goes off the rails)

A **playhead** at the bottom — a thin vertical accent line with a
small mono date label that travels left-to-right.

- Default state: playhead parked at 1950, all predictions hidden
- "Play" button (mono pill, lower left): playhead sweeps from 1950
  to 2026 over ~14 seconds (2-3s "wasted" on the empty 1950–1985
  era, then the density picks up)
- As the playhead passes each `year_said`, the corresponding lift
  fades in over 200ms with a faint upward motion — like the
  prediction is being *uttered* into the chart
- A counter in the top-right tracks live as the playhead moves:
  - "Predictions made: 0 → 210"
  - "Median target: — → 2030"
  - "Average lift: — → 21.3 years" *(the horizon-bias number,
    revealed as the data accumulates)*
- Drag the playhead to scrub manually; predictions appear/disappear
  responsively
- Auto-stops at 2026 with all predictions visible
- Reset link returns to 1950

A second pass is the *narrative ticker* below the chart. As the
playhead crosses key years (1965, 1970, 1993, 1999, 2014, 2022,
2023, 2025), a ribbon underneath fades in a single editorial
sentence — e.g., at 2022: *"GPT-3.5 ships. The medians collapse."*
At 1970: *"Minsky: 'three to eight years.'"* These are the
breadcrumbs that turn the animation from chart-toy into story.

#### The interactions

- **Hover any lift:** that prediction lights up (full opacity, accent
  glow, slight thickness increase). All others drop to 25%. Tooltip
  appears above with: name, role at time, year said → predicted
  year, confidence (if numeric), source title, and the first ~120
  characters of the quote. Click for the full card.
- **Click any lift:** opens a side panel (slide in from right) with
  full quote, source title + URL, and the person's other predictions
  highlighted in the chart with connecting lines (showing their
  trajectory).
- **Camp filter pills above chart:** "All / Frontier / Academic /
  Tech execs / Public / Surveys." Clicking dims other camps to 15%.
  Multiple selections additive.
- **Time-window slider:** drag handles to limit the playhead range
  ("show only predictions made between [1990] and [2026]"). Useful
  for zooming into the post-2022 compression specifically.
- **"Show the horizon" toggle:** lets the reader turn off the +20
  line if they want to look at the data unannotated, then turn it
  back on. The reveal is the point.

#### Why this fits the site

Editorial paper aesthetic preserved: serif headings, mono labels,
muted palette, faint hairlines, FIG. number. Goes off the rails
only in motion — and the motion is *content*, not decoration. The
playhead is functionally a scrubber over a meaningful axis.

#### Technical notes

- All hand-rolled SVG. No D3, no library. Animation via
  `requestAnimationFrame` with eased lerp on opacity + Y-position.
- Scrubber is a single `<input type="range">` skinned to mono.
- Touch-device support: tap-and-hold to scrub.
- Mobile: degrades to a vertical version where year_said is the
  top-down axis and lifts extend to the right. Same data, different
  geometry. Still scrubable.
- Accessibility: `prefers-reduced-motion` respected — playhead jumps
  to 2026 immediately, no fade animation. Tooltip available via
  keyboard navigation through all dots in `year_said` order.

What the reader sees, end state: dense thicket of vertical bars
rising from the today line, with a clear bright crest along the +20
horizon, a few long-tail outliers reaching toward 2100, and the
sharp post-2022 compression visible as a wall of bars stacked
between 2022 and 2026. The story is in the silhouette.

### § III · FIG. 11.2 — The 2022 compression
Two-panel comparison or animated transition:
- Panel A: predictions made 2010–2022, histogram of predicted year
- Panel B: predictions made 2023–2026, histogram of predicted year
- Show the median collapsing: ESPAI 2022 → 2059, ESPAI 2023 → 2047,
  Metaculus 2020 → 2055, Metaculus 2024 → 2028.
- Caption explains: ChatGPT shipped November 2022.

### § IV · FIG. 11.3 — Where the four camps land *(updated v0.3)*
Bimodal disagreement made visible. Adopting ChatGPT's four-camp
synthesis as the explicit frame:

- **The Frontier Industry Average (2025–28).** OpenAI, Anthropic,
  xAI, NVIDIA. Aggressive, capital-driven, fundraising-aligned.
- **The Calibrated Market Average (2029–32).** Metaculus, Pro
  Forecasters, Samotsvety. Accounts for regulatory + hardware drag.
- **The Academic Survey Average (2040–47).** ESPAI, Müller-Bostrom,
  Cotra. The broader scientific community on HLMI.
- **The Economic Adoption Average (2100+).** ESPAI's FAOL median.
  When labor is *actually* automated, not just when it *can* be.

Visual: four horizontal bands, each labeled, with the data dots
plotted on top. Caption: *the gap between Sam Altman and the
average AI researcher is twenty years. The gap between AGI being
possible and AGI being deployed is sixty more.*

### § V · FIG. 11.4 — The minds that changed
For each of ~6–8 people with multiple dated predictions on record:
trajectory line showing how their personal forecast moved over time.
- **Hinton:** 2018 "30–50y" → 2023 "5–20y" → 2024 "20y w/ 50%"
- **Cotra:** 2020 "2050" → 2022 "2040" → 2023 "2036"
- **Kokotajlo:** 2018 "2050" → 2020 "2030" → 2022 "2027" → 2025 "2029" → 2026 "early 2030s"
- **Musk:** 2020 "2025" → 2023 "2028–29" → 2024 "2025–26" → 2026 "this year"
- **Hassabis:** 2024 "10y" → 2025 "5–10y" → 2026 "decade"
- **Amodei:** 2023 "2025–26" → 2024 "2026+" → 2026 "2027"

Each is its own small line on a shared time axis. The pattern: most
people's timelines have *compressed* over the last four years.

### § VI · FIG. 11.5 — Pick a year
Interactive widget. User picks a target year (slider 2025 → 2080).
Page shows:
- Headline number: "X people in our dataset predict AGI in Y."
- Sortable card grid of those people, with their quote and source.
- A small running tally above: "you are looking at the company of
  [tier breakdown]."

This is the playable part. Lets the reader explore the long tail
(Brooks 2300, Hanson 2070+) or the short head (Altman, Musk,
Aschenbrenner around 2026–27).

### § VII · FIG. 11.6 — The jagged frontier *(new in v0.3)*
The 2023 ESPAI survey asked researchers when AI would reach
human-level performance on **specific tasks**, not "AGI" in general.
The result is a calendar, not a date:

- 2026: Transcribe speech in noisy environments
- 2027: Win World Series of Poker · Code a website from scratch
- 2028: Write an NYT bestseller
- 2033: Build a small house (robotics)
- 2040: Discover new physical laws
- 2050: Perform full surgical procedures

Visual: a horizontal calendar strip, 2025 → 2055. Each task plotted
as a labeled tick. The point of the figure: AGI is not a single
event but a **rolling automation**. The cracks (coding,
transcription) come a decade before the floors (surgery, physics).

Caption: *the cracks come first. Coding falls before surgery.*

### § VIII · FIG. 11.7 — The capability staircase *(new in v0.3)*
DeepMind's "Levels of AGI" framework (Morris et al. 2023) maps
where we are versus where each level lands. Render as a literal
staircase: six steps rising left to right, each labeled with level
number, designation, projected year.

- Level 0 (No AI): historical
- Level 1 (Emerging): achieved 2022–23
- Level 2 (Competent · 50th pctile): 2025–26
- Level 3 (Expert · 90th pctile): 2027–28
- Level 4 (Virtuoso · 99th pctile): 2029–30
- Level 5 (Superhuman): 2030+

Caption: *each step is a different definition of the same word.*

### § IX · FIG. 11.8 — The 69-year gap *(new in v0.3)*
The killer detail from ESPAI 2023. On the same survey:
- 50% probability of HLMI (AI *can* do every task) → **2047**
- 50% probability of FAOL (AI *does* every task) → **2116**

A single chart, two timelines, 69 years between them. Caption:
*the gap between "possible" and "deployed" is bigger than the
gap between "now" and "possible."*

This is the most under-reported statistic in the AGI conversation
and probably the lab's biggest single insight after the 20-year
horizon.

### § X — Why so wrong, so often?
Short prose section explaining the Armstrong/Sotala 20-year-out bias,
the definitional drift problem (AGI ≠ HLMI ≠ FAOL ≠ ASI ≠ TAI),
the incentive structures (lab CEOs benefit from short timelines for
fundraising; safety researchers benefit from "soon enough to matter";
academic skeptics benefit from "current paradigm won't work"), and
the new physical bottlenecks (compute, energy, the Data Wall) that
might bend the diagonal flatter.

Brief mention of the alignment-risk numbers from ESPAI: 10% median
chance of "extremely bad" outcomes among researchers; 16% mean among
safety specifically. Not the lab's main story but worth surfacing.

End with the open question: are 2026's predictions the first to
break the pattern, or are they the same diagonal in new clothes?

### § XI — Methodology & Colophon
Sources, definitions, the "what counts as a prediction" rules, link
to the raw dataset, link to the source markdown, list of every person
included, caveats (single-year midpoints flatten ranges; ESPAI
medians treat aggregate as one row; etc.).

Lab-to-lab nav, prev/next.

---

## Visualizations — design notes

All charts: hand-rolled SVG, no library. Match Time-Use Atlas (lab 09)
and Jobs (lab 08) visual language.

| Chart | Data | Library | Shape |
|---|---|---|---|
| FIG. 11.1 **The Horizon** | year_said × year_mid | SVG + rAF | Animated lift bars + playhead scrubber + narrative ticker |
| FIG. 11.2 compression | year_mid binned (pre/post 2022) | SVG | Paired histograms |
| FIG. 11.3 camps (4-band) | year_mid by camp | SVG | Horizontal bands w/ dots |
| FIG. 11.4 minds | per-person trajectory | SVG | Connected dots over time |
| FIG. 11.5 picker | year_mid filtered | HTML+SVG | Card grid + tally |
| FIG. 11.6 jagged frontier | task × year_50pct | SVG | Calendar strip 2025→2055 |
| FIG. 11.7 staircase | DeepMind levels 0–5 | SVG | Six rising steps |
| FIG. 11.8 69-year gap | HLMI vs FAOL timeline | SVG | Two parallel timelines |

Color: existing palette, accent red for the +20 diagonal and active
selections only. No new colors.

---

## Interactions

Single mode: hover/click. No animations on initial load beyond a
faint fade-in. Mobile: scatter degrades to "tap dot" (hover not
available); legend collapses to scrollable strip.

- Filter chips at top of FIG. 11.1: "All / Frontier labs / Academics
  / Tech execs / Public / Surveys" — clicking dims other dots
- Year-said slider: drag to filter "show predictions made between
  [1990] and [2026]"
- Click any dot: side card with full quote, source title, all other
  predictions by that person
- Year picker (FIG. 11.5): slider 2025–2080 with 1-year steps
- Reset link returns to default state

---

## Data — what we have, what we need

### Current (v4)

`assets/data/agi-forecast/predictions-v4.json` — **250 rows** from
140 unique people/groups. **202 plottable.** **187 in the average
pool.** Schema enriched in v4 with:
- `source_url` (URL for the click-through card)
- `verified_level` (high / medium / low) — primary-source confidence
- `source_quality` (primary / news / secondary / synthesis / survey)
- `stance_category` (optimist / skeptic / safety-aware / aggregate)
- `include_in_average` (excludes definitions, milestones, task
  predictions, framework rows from headline aggregates)
- `organization`, `expert_type`, `claim_summary` (CSV columns)

Verified-level distribution: 8 high · 233 medium · 9 low. The "high"
rows (Anthropic OSTP submission, AI Impacts ESPAI 2023, Reuters,
Guardian, samaltman.com Reflections) become the lab's footnoted
authoritative anchors.

Earlier versions kept for audit:
- `predictions-v3.json` — 210 rows
- `predictions-v2.json` — 191 rows
- `predictions-v1.json` — 183 rows

Source documents:
- `source-research-v1.md` — original compass markdown
- `source-research-v2-chatgpt-batch1.md` — ChatGPT batch 1 (8 rows)
- `source-research-v3-chatgpt-batch2.md` — ChatGPT batch 2
  (long-form synthesis)
- `source-research-v4-chatgpt-batch3.csv` — ChatGPT batch 3
  (40-row structured CSV with URLs and verification flags)

### What ChatGPT's research should fill (highest leverage)

1. **Per-person Lex Fridman quotes.** The compass research lists
   ~15 high-value Lex guests with timelines but only some are
   captured. Filling these out (Carmack, Wolfram, Keller, Silver,
   Vinyals, Karmack, Hotz, etc.) would push us toward 200–250 rows.
2. **AI Impacts ESPAI 2023 individual respondents.** The 2,778
   individuals are downloadable; even a 100-person sample would
   massively strengthen the survey-aggregate tier and give us
   distribution shape.
3. **Specific quote text for paraphrased rows.** Many rows are P:
   (paraphrase). For the click-card view we want Q: (verbatim)
   wherever possible. Priority targets: Hassabis, Amodei, Suleyman,
   Sutskever, Bengio.
4. **Mind-change source attribution.** For each of the §V trajectory
   lines we want the exact dated quote that captures each move,
   not just the year. Currently we have most but not all.
5. **Geographic/cultural breakdown.** The 2017 NIPS survey found
   Asian respondents median = 30y vs North American = 74y. Any more
   recent data on this would be a sharp callout.
6. **Confidence/probability normalization.** Many rows have stated
   confidence ("50%", "95% CI", etc.); a clean numeric column for
   plotting dot opacity would help.
7. **Source URLs.** Currently we have source titles (Tweet, Book,
   Podcast). For the click-card view we want a URL field.

### Probably out-of-scope for v1

- Manifold/Polymarket per-trader data
- Twitter/X individual posts (vs single per-person summary)
- Pre-1990 historical predictions beyond the "famous wrong" examples
  already in the dataset

---

## Tech / structure (matches existing labs)

```
work/agi-forecast-lab/
  index.html              ← FIG. 11 page
  PLAN.md                 ← this file (planning, not deployed)

assets/
  css/agi-forecast-lab.css     ← prefix `af-`
  js/agi-forecast-lab.js       ← loads predictions-v1.json
  data/agi-forecast/
    predictions-v1.json   ← parsed dataset
    source-research-v1.md ← raw research
    methodology.json      ← coverage stats, last-updated, definitions
```

No backend. No build step. Pure static. Cache-bust on every HTML
reference when CSS/JS changes (CLAUDE.md hard rule #3).

Cross-cutting updates when shipping:
- Add to nav dropdown on all 10+ existing labs (becomes 11)
- Update homepage `labs-grid` with FIG. 11 card
- Update `Lab N of 10` → `Lab N of 11` on every lab footer
- Update prev/next nav on watchdog-lab to point forward to FIG. 11
- Bump `main.css` cache version

---

## Open questions for Cuth

These are the design decisions I want your call on before I build:

1. **Title / H1.** Going with *"The future is always twenty years out."*
   unless you push back. Alternatives are listed above.

2. **Lab number.** This becomes FIG. 11 (after Watchdog). Confirms
   at "Lab 11 of 11" once shipped. OK?

3. **The 20-year-out claim.** This is the sharpest editorial angle
   and it's empirically true in the data. But it's also the most
   *opinionated* lab on the site — most other labs are descriptive.
   Are you comfortable with a lab that takes a position?

4. **Survey aggregates as single rows.** Each ESPAI is one row
   representing thousands of researchers. Should it plot as one big
   dot (high confidence) or get its own visual treatment (a band
   instead of a point)?

5. **Definitional drift handling.** Some predictions are about
   "AGI", others "HLMI", "TAI", "Singularity". Do we plot them all
   together (with concept as a tooltip field) or split FIG. 11.1
   into two views (strict vs broad)?

6. **The provocation at the end.** I want to end with "are 2026's
   predictions the first to break the pattern, or are they the same
   diagonal in new clothes?" — i.e., put the question to the reader
   without answering it. OK or too cute?

7. **Mobile.** The forecast plane is dense. Mobile probably needs to
   degrade to a per-tier strip plot rather than a full scatter.
   Acceptable?

8. **Domain-specific predictions** (added v0.2). Amodei now has two
   live forecasts: "1–2 years for coding" and "10 years for full
   AGI." That's likely going to keep happening as labs ship narrow
   superhuman systems before general ones. Options:
   - (a) Keep all predictions on one chart, color/shape-code by
     concept (full AGI vs coding-AGI vs math-AGI vs HLMI vs ASI).
   - (b) Hide narrow ones from the main scatter; surface them in a
     dedicated "the cracks come first" section.
   - (c) Make concept a filter, so the reader can choose.
   With batch 2 we now have a full **jagged frontier** dataset
   (FIG. 11.6) so I lean toward **(b) + (c)**: hide narrow ones
   from the main forecast plane (keeps that chart clean and on-message
   for the 20-year-horizon point), and give them their own dedicated
   calendar in §VII. The concept-filter option is then a future
   enhancement if the reader wants to dig.

9. **The 69-year HLMI/FAOL gap** (added v0.3). This is the most
   under-reported number in the conversation: experts say AGI is
   *possible* by 2047 but *deployed* by 2116. That's a longer gap
   than the gap to "possible" itself. I want to make this its own
   section (FIG. 11.8). Concern: will general readers care about a
   69-year timeline? Counterargument: the punchline is *exactly* the
   thing that translates AGI from sci-fi to "your job in 2050."
   Worth featuring? Yes/no.

10. **DeepMind Levels staircase** (added v0.3). The Morris et al.
    framework gives us a clean visual: Level 1 (Emerging, achieved
    2023) → Level 5 (Superhuman, 2030+). It's a frontier-lab framework
    so it's optimistic by design. Including it could feel like
    parroting OpenAI/DeepMind marketing. Counterargument: it's
    factually a useful framework regardless of source, and we annotate
    it with skeptic positions. Include? My call: yes, include, but
    explicitly note the framework's lab-of-origin in the caption.

11. **The Horizon — narrative ticker** (added v0.4). I want a thin
    ribbon under the animated chart that fades in a single editorial
    sentence at key playhead years (1965, 1970, 1993, 1999, 2014,
    2022, 2023, 2025). Concern: feels overdetermined / "guides the
    reader too hard." Counterargument: without it, the animation is
    a chart-toy. With it, the animation is a story. Lean toward
    keeping it but happy to drop. Your call.

12. **The Horizon — auto-play on view vs. press-to-play** (added
    v0.4). Two options:
    - (a) Auto-plays once when the section scrolls into view, then
      stops. Reader can replay or scrub.
    - (b) Static screenshot of end state by default; "Play the
      seventy years" button to start the animation.
    I lean (b) — respects the reader's attention, doesn't ambush
    with motion, and the button itself is editorial copy. Your call.

13. **The verification badge** (added v0.5). The CSV brought in
    `verified_level` (high/medium/low). I want to render a small mono
    glyph next to each tooltip / click-card indicating the source
    quality:
    - `■` (filled) — primary source (essay, blog, OSTP submission,
      verbatim transcript)
    - `▣` (half) — news report / news-quoted interview
    - `▢` (empty) — secondary synthesis (Wikipedia, syntheses, etc.)
    Most rows are currently medium. As you and ChatGPT do more
    primary-source verification we can flip rows to high. The badge
    creates a visible feedback loop. Worth adding? My call: yes.

14. **The unmoved median** (added v0.5). Across four batches and 250
    rows, the median has held at 2030 and the mean has moved less
    than one year. This stability is its own story — the forecast
    distribution is dense enough that new data doesn't move the
    needle. I want a small mono callout somewhere in §I or §VII
    that says: *"After two hundred fifty predictions across seven
    decades, the median sits at 2030. It hasn't moved as the dataset
    has grown."* Editorial gold. Keep, drop, or move?

---

## Build phases (when we're ready)

1. **Phase 1 — Page skeleton + data load + scatter.** Hero, § I prose,
   FIG. 11.1 working with hover + click. Verify on three themes.
2. **Phase 2 — Compression + camps.** FIG. 11.2 and 11.3.
3. **Phase 3 — Trajectories + picker.** FIG. 11.4 and 11.5.
4. **Phase 4 — Prose sections + methodology + cross-cutting.** § VII,
   § VIII, nav updates, homepage card, cache bumps.
5. **Phase 5 — QA.** Verify rendered output (CLAUDE.md hard rule #1),
   curl the live URL, em-dash sweep, check on mobile.

Estimated build time: probably one solid session (4–6 hours of
edits) once the plan is locked.

---

## Summary statistics from the v4 dataset

- **Total rows:** 250 (v1: 183 + batch1: 8 + batch2: 19 + batch3: 40)
- **Unique people/groups:** 140
- **Plottable rows:** 202
- **In headline-average pool:** 187 (excludes framework / task /
  definition-dispute / workforce-milestone rows)
- **Verified-level breakdown:** 8 high · 233 medium · 9 low
- **By prediction type:** 237 agi_year · 7 task_year · 6 agi_level
- **Time span:** 1950 (Turing) → 2026 (frontier-lab CEOs)
- **Most-cited single year:** 2030
- **Median predicted year (modern era, in-average):** **2030**
- **Mean predicted year (modern era, in-average):** **2036.4**

Stability note across batches:

| Version | Rows | Median | Mean |
|---|---|---|---|
| v1 | 183 | 2030 | ~2037 |
| v2 | 191 | 2030 | ~2037 |
| v3 | 210 | 2030 | ~2037 |
| v4 | 250 | **2030** | **2036.4** |

The aggregates barely move as the dataset grows. The forecast cloud
is dense enough that adding 67 more rows shifts the median by zero
years and the mean by less than one. This stability *is itself a
story* — and it should be visible somewhere in the lab.

### The four-camp synthesis (numbers to call out in the lab)

- **Frontier Industry Average:** 2025–2028
- **Calibrated Market Average:** 2029–2032
- **Academic Survey Average (HLMI):** 2040–2047
- **Economic Adoption Average (FAOL):** 2100+

### The jagged frontier (50% probability years)

- 2026: Speech transcription
- 2027: WSOP poker · Coding a website
- 2028: NYT bestseller
- 2033: House construction
- 2040: New physical laws
- 2050: Surgery

---

## Next step

Cuth reviews this plan, adds / pushes back. ChatGPT's additional
research arrives. We merge it into `predictions-v2.json` and update
this file to v0.2 with any structural changes. Then build Phase 1.
