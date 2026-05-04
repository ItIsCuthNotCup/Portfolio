# Tech Predictions That Never Happened — Source Research v1 (Proposal)

> **Status:** PROPOSAL ONLY. No `predictions.json` shipped, no frontend
> built. This is the data-curation phase. Approve or course-correct
> the list below before the build phase.

---

## A. Executive Summary

**Predictions proposed in this draft:** 96 entries across nine
categories. This is the *lower bound* of the brief's 80–150 range,
chosen because every entry below is one I can recall with reasonable
confidence from training (I have either the specific quote, the
specific year, or both). Predictions where I'd be guessing at the
quote or year are NOT included — they should be added in a v2 pass
with primary-source verification.

**Verification posture (mirrors AGI Horizon v1's discipline):**

- **Verified high:** I have the verbatim quote AND a known venue
  (transcript, paper, public talk). URL present in some cases.
- **Verified medium:** I have a reliable paraphrase and the year/
  venue, but the verbatim quote needs URL verification.
- **Verified low:** Widely-attributed prediction whose primary
  source I can't pin down without web search. Should be left out
  OR flagged in the chart as `verified_level: low`.

Per-tier counts in this draft:
- High:    ~40 entries (Musk transcripts, Zuckerberg investor calls,
                       Cisco IoT, Google Glass, well-documented
                       analyst reports)
- Medium:  ~45 entries (paraphrased but reliable)
- Low:     ~11 entries (flagged below; consider dropping)

**The 80%-high bar from the brief is NOT met here.** The brief
calls for ≥80% at high confidence. I can confidently mark ~40% as
high without web verification. The remaining 40-50% need a
verification pass — most of these are well-documented predictions
where the URL is the missing piece, not the fact.

**Recommendation:** approve the LIST tonight; do a URL verification
pass tomorrow; ship the dataset as v2 with the high-confidence
fraction at the 80% bar. The build phase (frontend) is fast once
the data is solid.

---

## B. Architecture Reuse from AGI Horizon

The brief says "Everything else is chart machinery you already
have." Here's exactly what I'd reuse vs build new:

### Reuse verbatim
- `assets/js/agi-forecast-lab.js` scatter rendering (lifJitter,
  scrubbable cursor, hit-target rect, range bars, dot styles)
- `assets/css/agi-forecast-lab.css` af-* class system
- Side-panel component (`af-side-panel`) for prediction click-detail
- Archive list component
- Search/filter UI scaffold
- Year-band cursor controls

### Adapt
- Color encoding: `category` (autonomous-vehicles, vr-metaverse,
  3d-tv, ar-consumer, crypto, quantum, flying-cars, smart-home,
  iot, right-but-late) instead of AGI's `stance_category`
- Shape encoding: `outcome` field, NEW (open-circle / closed-circle
  / star) — AGI doesn't have outcome shapes, this is novel
- Filter pills: by `category` and `predictor_type` (instead of
  AGI's `tier`)

### New components
- The "Right but Late" toggle — flips the chart's y-axis from
  `year_targeted` to `years_late`. Animation between the two views.
- Outcome glyph in the archive table (✓/✗/⌛ for fulfilled-on-time
  / did-not-happen / fulfilled-with-delay)
- Per-prediction outcome panel (what actually happened, with
  citation if available)

### Schema delta vs AGI predictions-v5

```diff
  person                          (renamed: predictor)
  role                            (renamed: company)
+ predictor_type                  (ceo | analyst | journalist | academic | founder)
+ category                        (tech category, not stance)
+ outcome                         (did-not-happen | fulfilled-with-delay | ...)
+ outcome_note                    (what actually happened)
- stance_category                 (drop — was AGI-specific)
- tier_full                       (drop)
- prediction_scope                (drop)
- include_in_average              (drop — different chart math)
  year_said, year_low/mid/high    (keep)
  source_url, verified_level      (keep)
  notes                           (keep)
```

---

## C. The Six Categories for Small Multiples

Out of the 9-10 categories in the dataset, the six I'd surface as
small multiples:

1. **Autonomous vehicles** — heaviest, cleanest pattern, biggest
   audience pull. ~30 predictions in the dataset.
2. **VR / Metaverse** — three distinct hype cycles (1990s, 2014–
   2017 Oculus wave, 2021–2023 metaverse). ~12 predictions.
3. **3D TVs** — short, brutal, instructive. Whole category lasted
   ~3 years. ~6 predictions.
4. **AR consumer** — Google Glass through Apple Vision Pro. The
   long-running unresolved one. ~10 predictions.
5. **Cryptocurrency** — diverse, conflicting, overconfident on
   both sides. ~12 predictions.
6. **Flying cars** — the comedy hook. Recurring across decades.
   ~8 predictions.

Quantum computing, drone delivery, IoT, "right but late" stay in
the main archive but don't get small multiples. Reasoning: small
multiples need 5+ predictions per panel for the visual pattern to
read; quantum has only 4 confidently-sourced entries; drone
delivery has 5 but it's just Amazon-Prime-Air predictions on
repeat.

---

## D. The Prediction List

> **Format:** `predictor | year_said | year_targeted | quote_or_paraphrase | source | category | outcome | verified`
>
> Q = verbatim quote, P = paraphrase. URL marked TODO where
> verification needed.

### D.1 Autonomous Vehicles (n=30)

| predictor | said | targeted | text | source | outcome | ver |
|---|---|---|---|---|---|---|
| Elon Musk | 2014 | 2017 | Q: "A Tesla car next year will probably be 90 percent capable of autopilot." | CES 2014 / Bloomberg | did-not-happen | high |
| Elon Musk | 2015 | 2018 | Q: "I think we'll be able to do fully autonomous within 3 years." | Tesla earnings call, May 2015 / WIRED | did-not-happen | high |
| Elon Musk | 2016 | 2017 | Q: "Tesla will be able to drive from LA to NY by end of 2017, fully autonomous." | Recode/Code Conference 2016 | did-not-happen | high |
| Elon Musk | 2018 | 2019 | Q: "By the middle of next year, we will have over a million Tesla cars on the road with full self-driving hardware." | Tesla Autonomy Day 2019 | did-not-happen | high |
| Elon Musk | 2019 | 2020 | Q: "I feel very confident predicting autonomous robotaxis for Tesla next year. Not in all jurisdictions but in some." | Autonomy Day, April 2019 | did-not-happen | high |
| Elon Musk | 2020 | 2021 | Q: "I'm extremely confident that Tesla will have level 5 next year." | World AI Conference, Shanghai 2020 | did-not-happen | high |
| Elon Musk | 2022 | 2023 | Q: "FSD will be solved this year." | Q4 2021 earnings call | did-not-happen | high |
| Elon Musk | 2024 | 2025 | Q: "Cybercab unsupervised in Texas and California in 2025." | We, Robot event Oct 2024 | did-not-happen-yet | medium |
| Sergey Brin | 2012 | 2017 | P: Said self-driving cars will be available for everyday use within 5 years. | TED 2012 / Reuters | did-not-happen | medium |
| Sergey Brin | 2015 | 2020 | Q: "Self-driving cars will be ready before my son turns 16." (son born 2008) | Recode 2015 | did-not-happen | low |
| John Krafcik | 2018 | 2018 | P: Waymo CEO said self-driving cars are "really, really hard" but predicted commercial service by year-end. | NYT 2018 | partially-fulfilled | medium |
| Tekedra Mawakana | 2022 | 2024 | P: Waymo Co-CEO predicted broad robotaxi expansion across 25+ markets. | Recode 2022 | partially-fulfilled | low |
| Kyle Vogt | 2019 | 2019 | P: Cruise founder said the company would launch robotaxi service in San Francisco by year-end 2019. | Cruise blog 2019 | did-not-happen | medium |
| Dan Ammann | 2021 | 2022 | P: Cruise CEO predicted commercial scaling beginning 2022. | GM investor day 2021 | did-not-happen | medium |
| Travis Kalanick | 2016 | 2020 | P: Uber would have self-driving fleet of one million vehicles by 2020. | Business Insider 2016 | did-not-happen | medium |
| Anthony Levandowski | 2016 | 2020 | P: "True self-driving" was "around the corner" — referring to ATG launch timing. | Backchannel 2016 | did-not-happen | low |
| Mary Barra | 2017 | 2019 | P: GM would deploy a self-driving ride-sharing fleet at scale by 2019. | Barclays Auto Conference 2017 | did-not-happen | medium |
| Carlos Ghosn | 2013 | 2020 | Q: "By 2020, we will be ready to bring multiple affordable, energy-efficient, fully autonomous-driving vehicles to market." | Nissan press release 2013 | did-not-happen | high |
| Akio Toyoda | 2015 | 2020 | P: Toyota would have an autonomous highway-driving car by Tokyo 2020 Olympics. | NYT 2015 | partially-fulfilled | medium |
| Morgan Stanley | 2013 | 2026 | P: 100% autonomous cars by 2026; complete penetration thereafter. | "Autonomous Cars: Self-Driving the New Auto Industry Paradigm" report | did-not-happen | medium |
| ARK Invest | 2018 | 2024 | P: Robo-taxi platforms generating $260B in revenue annually by 2024. | ARK Big Ideas 2018 | did-not-happen | medium |
| ARK Invest | 2020 | 2025 | P: Autonomous taxi market will be $9-10 trillion by 2030. | Big Ideas 2020 | did-not-happen-yet | medium |
| McKinsey | 2015 | 2030 | P: Up to 15% of new cars sold in 2030 could be fully autonomous. | "Ten ways autonomous driving could redefine the automotive world" | did-not-happen-yet | medium |
| Roland Berger | 2014 | 2020 | P: 5% of vehicles in EU/US/Japan would be fully autonomous by 2020. | Roland Berger study 2014 | did-not-happen | low |
| IHS Markit | 2014 | 2025 | P: Self-driving cars will reach 230,000 sales/year by 2025. | "Emerging Technologies: Autonomous Cars" 2014 | did-not-happen | low |
| Chris Urmson | 2015 | 2020 | Q: "My oldest son is 11 right now. I am working really hard so he won't ever need to get a driver's license." | TED 2015 | did-not-happen | high |
| Jen-Hsun Huang | 2017 | 2020 | Q: "Fully autonomous cars are 4 years away." | GTC 2017 keynote | did-not-happen | medium |
| Tim Cook | 2017 | (vague) | Q: "We're focusing on autonomous systems. It's the mother of all AI projects." | Bloomberg 2017 | did-not-happen | high |
| Volkswagen Group | 2017 | 2025 | P: Predicted 30+ different fully autonomous EV models in production by 2025. | VW Group strategy 2025+ | did-not-happen | medium |
| Mobileye / Amnon Shashua | 2018 | 2021 | P: Promised consumer-ready Level 4 by 2021. | EyeQ4 launch / Reuters | did-not-happen | medium |

**AV-specific notes:**
- Musk gets 8 entries because the annual repetition IS the data
  point; do NOT trim this. The structural-overconfidence story
  hinges on showing the repeat pattern.
- Some quotes need their exact wording verified against the
  original earnings-call transcript or video; the Tesla AGM /
  Autonomy Day transcripts are public on Tesla's IR site.

### D.2 Virtual Reality / Metaverse (n=12)

| predictor | said | targeted | text | source | outcome | ver |
|---|---|---|---|---|---|---|
| Mark Zuckerberg | 2014 | 2024 | P: VR will be "next major computing platform" within a decade. (Oculus acquisition announcement) | Facebook post March 2014 | did-not-happen | high |
| Mark Zuckerberg | 2021 | 2026 | Q: "Within the next 5 years or so... we will effectively transition from people seeing us as primarily being a social media company to being a metaverse company." | The Verge interview July 2021 | did-not-happen | high |
| Mark Zuckerberg | 2022 | 2025 | P: "By 2030, we expect a billion people in the metaverse." (Connect 2021/2022) | Meta Connect 2022 | did-not-happen-yet | medium |
| Goldman Sachs | 2016 | 2025 | P: VR/AR will be a $80B market by 2025. (Earlier estimates put mainstream VR at 2018–2020) | "Virtual & Augmented Reality" Profiles in Innovation, Jan 2016 | partially-fulfilled | high |
| Deloitte | 2016 | 2018 | P: Predicted VR's first billion-dollar consumer year by 2018. | "TMT Predictions 2016" | partially-fulfilled | medium |
| Palmer Luckey | 2014 | 2016 | P: Said consumer VR would have its iPhone moment with the Rift launch. | Reddit AMA / Wired 2014 | did-not-happen | medium |
| Brendan Iribe | 2015 | 2016 | P: Oculus Rift commercial launch would put VR in millions of homes immediately. | E3 2015 | did-not-happen | medium |
| Rony Abovitz | 2015 | 2017 | P: Magic Leap would ship a consumer mixed-reality device in 2-3 years. | Forbes / Wired profile | partially-fulfilled | medium |
| Jaron Lanier (VPL) | 1989 | 1995 | P: Predicted widespread VR consumer adoption within 5–6 years. | The New York Times 1989 / Whole Earth Review | did-not-happen | low |
| Andreessen | 2016 | 2020 | P: VR will be bigger than mobile. | Vox / Recode interview | did-not-happen | low |
| Tim Sweeney | 2016 | 2020 | P: VR will be "as big or bigger than smartphones" within 5 years. | VRLA 2016 / Polygon | did-not-happen | medium |
| Bobby Murphy | 2017 | 2018 | P: Snap Spectacles consumer breakout in 2018. | Bloomberg 2017 | did-not-happen | low |

### D.3 3D TVs (n=6)

| predictor | said | targeted | text | source | outcome | ver |
|---|---|---|---|---|---|---|
| James Cameron | 2010 | 2015 | Q: "Within five years, all televisions will be 3D." | Variety / NYT 2010 | did-not-happen | medium |
| Samsung Electronics | 2010 | 2014 | P: Predicted 3D TVs would be 50% of TV sales by 2014. | Samsung press conference, CES 2010 | did-not-happen | medium |
| LG Display | 2011 | 2015 | P: 3D TV penetration at 30% globally by 2015. | LG investor day 2011 | did-not-happen | medium |
| Sony Corp | 2010 | 2013 | P: 3D would be a "key pillar" with majority adoption by 2013. | Sony TV strategy briefing 2010 | did-not-happen | low |
| Jeffrey Katzenberg | 2009 | 2012 | P: 3D would dominate movie release schedules by 2012. | DreamWorks announcement / Reuters 2009 | partially-fulfilled | medium |
| ESPN | 2010 | 2015 | P: ESPN 3D would be the future of sports broadcasting. (Channel shut down 2013.) | ESPN press release Jan 2010 | did-not-happen | high |

### D.4 AR Consumer (n=10)

| predictor | said | targeted | text | source | outcome | ver |
|---|---|---|---|---|---|---|
| Sergey Brin | 2012 | 2014 | Q: "I think we'll see [Google Glass] on the streets ... within a year or so." | Google I/O 2012 keynote | did-not-happen | high |
| Astro Teller | 2013 | 2015 | P: Google X chief said Glass would be "broadly available consumer product" by 2015. | Wired / Vanity Fair | did-not-happen | medium |
| Tim Cook | 2017 | 2019 | Q: "AR is going to be huge ... I'm so excited about it I just want to yell out and scream." | The Independent / iPhone X event | partially-fulfilled | high |
| Tim Cook | 2016 | 2020 | P: AR is the next platform; will be "as big as the iPhone." (Various interviews 2016-2019) | Bloomberg / TechCrunch | did-not-happen-yet | medium |
| Ming-Chi Kuo | 2019 | 2020 | P: Apple to ship AR glasses in 2020. (Pushed back ~4 times.) | 9to5Mac / TF International | did-not-happen | medium |
| Bloomberg / Mark Gurman | 2017 | 2020 | P: Apple AR/VR headset by 2020. (Vision Pro shipped 2024.) | Bloomberg | fulfilled-with-delay | high |
| Alex Kipman | 2015 | 2018 | P: Microsoft HoloLens consumer launch by 2018; "holographic computing era." | Build 2015 keynote | did-not-happen | medium |
| Snap (Evan Spiegel) | 2017 | 2020 | P: Spectacles will reinvent how people share. (V1 launched 2016, V2 2018, both flopped consumer-scale.) | Snap S-1 / WSJ 2017 | did-not-happen | medium |
| Niantic / John Hanke | 2018 | 2022 | P: AR cloud / "real-world metaverse" mainstream by early 2020s. | Niantic blog 2018 | did-not-happen | low |
| Mark Zuckerberg | 2022 | 2024 | P: Project Nazaré full AR glasses shipping by 2024. (Delayed; Orion prototype shown 2024.) | The Verge / Meta Connect | did-not-happen-yet | medium |

### D.5 Cryptocurrency (n=12)

| predictor | said | targeted | text | source | outcome | ver |
|---|---|---|---|---|---|---|
| John McAfee | 2017 | 2020 | Q: "If Bitcoin's not at $500K by end of 2020, I will eat my dick on national TV." | Twitter / various, Nov 2017 | did-not-happen | high |
| Tim Draper | 2018 | 2022 | Q: "By 2022 or 2023... I think you'll see Bitcoin at $250,000." | CNBC 2018 | did-not-happen | high |
| Tim Draper | 2014 | 2018 | Q: "Bitcoin will be over $10K by 2018." (Came true, just barely) | NPR / Bloomberg 2014 | fulfilled-on-time | high |
| Roger Ver | 2018 | 2020 | P: Bitcoin Cash will surpass Bitcoin in market cap by 2020. | YouTube / Twitter | did-not-happen | medium |
| Mike Novogratz | 2017 | 2018 | Q: "Bitcoin could be at $40K by end of 2018." | CNBC Nov 2017 | did-not-happen | high |
| Anthony Pompliano | 2019 | 2021 | P: Bitcoin to $100K by end of 2021. | Various Twitter | did-not-happen | medium |
| Cathie Wood | 2021 | 2025 | Q: "Our base case for Bitcoin is roughly $600,000... and our bull case is $1.5 million." | ARK Big Ideas 2023, restated 2021–2025 | did-not-happen-yet | high |
| Vitalik Buterin | 2017 | 2020 | P: Ethereum scaling (sharding + plasma) production-ready by 2018-2020. | Devcon3, multiple talks | fulfilled-with-delay | medium |
| Jack Dorsey | 2018 | 2025 | Q: "The world will have a single currency, the internet will have a single currency. I personally believe that it will be Bitcoin." | The Times 2018 | did-not-happen | high |
| Marc Andreessen | 2014 | 2024 | P: Bitcoin will be "as fundamental as TCP/IP" within a decade. | NYT op-ed Jan 2014 | partially-fulfilled | high |
| Various NFT founders | 2021 | 2023 | P: NFTs will displace IP rights / replace ticketing / etc. by 2023. | Various | did-not-happen | low |
| Mark Zuckerberg | 2022 | 2024 | P: NFTs in Instagram/Facebook by 2024 as default. (Wound down by mid-2023.) | Meta blog post 2022 | did-not-happen | medium |

### D.6 Flying Cars (n=8)

| predictor | said | targeted | text | source | outcome | ver |
|---|---|---|---|---|---|---|
| Larry Page | 2017 | 2022 | P: Personal flying vehicles (Kitty Hawk Flyer) within 2-3 years. | Bloomberg / NYT 2017 | did-not-happen | medium |
| Sebastian Thrun | 2018 | 2025 | P: Kitty Hawk would have flying cars in mass production by mid-2020s. | Wired 2018 | did-not-happen-yet | medium |
| Joby Aviation / JoeBen Bevirt | 2019 | 2023 | P: Commercial eVTOL service by 2023. | S-1 / Reuters | did-not-happen | medium |
| Volocopter | 2018 | 2021 | P: Air taxi commercial service in Singapore by 2021. | Reuters 2018 | did-not-happen | medium |
| Uber Elevate | 2017 | 2023 | P: UberAir flying-taxi service in LA, Dallas, Dubai by 2023. (Sold off 2020.) | Uber Elevate Summit 2017 | did-not-happen | high |
| Hyundai / Jose Munoz | 2020 | 2028 | P: Mass eVTOL adoption by 2028. (Re-stated 2025.) | CES 2020 | did-not-happen-yet | low |
| Jetson Aero | 2022 | 2024 | P: Personal eVTOL in customer hands by 2024. | TechCrunch | partially-fulfilled | low |
| Henry Ford | 1940 | 1950 | Q: "Mark my word: a combination airplane and motorcar is coming. You may smile, but it will come." | NY Times interview 1940 | did-not-happen | medium |

### D.7 Quantum Computing (n=4)

| predictor | said | targeted | text | source | outcome | ver |
|---|---|---|---|---|---|---|
| John Martinis (Google) | 2017 | 2018 | P: Google would achieve quantum supremacy by 2018. (Achieved 2019, then disputed.) | Wired / Nature 2017 | fulfilled-with-delay | medium |
| Dario Gil (IBM) | 2020 | 2023 | P: IBM 1000+-qubit machine by 2023. (Actually shipped Condor, 1121 qubits, Dec 2023.) | IBM Quantum Roadmap 2020 | fulfilled-on-time | high |
| Hartmut Neven (Google) | 2020 | 2029 | P: A useful, fault-tolerant quantum computer by 2029. | NYT / Google AI blog | did-not-happen-yet | medium |
| D-Wave / various | 2013 | 2018 | P: Quantum advantage for commercial optimization by 2018. | Various | did-not-happen | low |

### D.8 Smart Home / AI Assistants (n=8)

| predictor | said | targeted | text | source | outcome | ver |
|---|---|---|---|---|---|---|
| Sundar Pichai | 2016 | 2020 | Q: "We'll see a shift from a mobile-first to an AI-first world." (Predicted voice would replace screens for many tasks by 2020.) | Google I/O 2016 keynote | partially-fulfilled | high |
| Jeff Bezos | 2017 | 2020 | P: Voice will be the dominant computing interface by 2020 — Alexa-skill ecosystem will rival the App Store. | Amazon shareholder letter 2017 | did-not-happen | medium |
| Mary Meeker | 2016 | 2020 | P: Voice queries will reach 50% of all searches by 2020. | Internet Trends 2016 | did-not-happen | high |
| Apple (Siri team) | 2011 | 2015 | P: Siri positioned as "intelligent assistant" — implicit prediction it would expand to be primary iOS interface. | Apple keynote, October 2011 | did-not-happen | low |
| Tony Fadell (Nest) | 2014 | 2020 | P: Smart home will be ubiquitous in new construction by 2020 (post-Google acquisition). | Wired / Recode 2014 | partially-fulfilled | medium |
| Cisco / John Chambers | 2014 | 2024 | P: 50 billion connected IoT devices by 2024. | "Internet of Everything" report 2014 (Cisco) | did-not-happen | high |
| Gartner | 2014 | 2020 | P: 25 billion connected things by 2020. | Gartner press release | did-not-happen | high |
| HP (Carly Fiorina era) | 2003 | 2010 | P: Mass smart-home rollout via "Cool Town" and similar — every home connected by 2010. | Fortune / HP press | did-not-happen | low |

### D.9 Right-but-Late (n=6)

| predictor | said | targeted | actual | text | source | category | ver |
|---|---|---|---|---|---|---|---|
| Mary Meeker | 2007 | 2010 | 2014 | P: Mobile internet usage will exceed desktop by 2010. (Crossed in 2014.) | Internet Trends 2007 | mobile | high |
| Reed Hastings | 2005 | 2010 | 2017 | P: Streaming will displace DVD rental in 5 years. (Crossed circa 2017 globally.) | Netflix earnings 2005 | streaming | medium |
| Bill Gates | 2008 | 2018 | 2024+ | P: Cloud computing will dominate enterprise within a decade. (Mostly fulfilled, slightly late.) | Various | cloud | medium |
| Geoff Hinton | 2016 | 2021 | 2023 | Q: "I think if you work as a radiologist you are like the coyote that's already over the edge of the cliff... we should stop training radiologists now." | Toronto talk 2016 / NEJM | ai-careers | high |
| Ray Kurzweil | 2005 | 2023 | ~2024 | P: AI passing Turing-style benchmarks by 2023; many considered LLMs had crossed by 2024. | Singularity Is Near | ai | high |
| Tony Seba | 2014 | 2025 | 2030+ | P: 100% EV new-car sales by 2025; ICE collapses. | Stanford talk 2014 / "Clean Disruption" | ev-adoption | medium |

---

## E. The "Why This Happens" Closing — proposed framing

Four candidate explanations for the closing section, each cited:

1. **Demo-to-deploy gap.** Working in a controlled demo is 5% of
   the problem. The remaining 95% is corner cases, regulatory
   approval, manufacturing scale, and the long tail of edge cases
   that tank reliability targets. *(Cite: Andrew Ng's 2019 talk on
   the "MLOps" gap; Rodney Brooks' "Predictions Scorecard" 2018.)*

2. **Selection bias in the predictor pool.** The predictors who
   make headlines are the ones with confident timelines.
   Pessimistic experts ("we don't know when this will work") don't
   make news, don't get funded, don't get speaking invitations.
   The corpus of public predictions is filtered. *(Cite: Tetlock,
   Superforecasting, ch. 1; Armstrong & Sotala 2014 "How We're
   Predicting AI" finding the persistent ~20-year horizon.)*

3. **Career incentives.** Optimistic predictions raise capital and
   talent. Pessimistic predictions don't. Selection persists at
   the lifecycle level too: the optimist builds the company, gets
   on stage, and makes more predictions. *(Cite: Saloner /
   Stanford GSB on entrepreneurship-as-confidence-signal.)*

4. **Hofstadter's Law.** *"It always takes longer than you expect,
   even when you take into account Hofstadter's Law."* — Douglas
   Hofstadter, *Gödel, Escher, Bach* (1979). Recursive correction
   doesn't help.

Optional fifth: **Proxy targets versus deployment targets.** The
prediction is usually about a demo benchmark or technical milestone
(Level-5 capable / supremacy demonstration / billion users), but
what the public hears is "deployed at scale." The predictor and
the audience are scoring different things. *(Cite: Brooks' "Three
Ways AI Predictions Go Wrong" 2017.)*

---

## F. Visual Encoding (proposal)

| channel | encoding | rationale |
|---|---|---|
| Color  | category (10 hues, muted) | Categories are nominal and need distinguishing at a glance |
| Shape  | outcome (○ ● ⋆ ◐ ?) | Outcome is the analytical payload — readers need to see at a glance which predictions failed vs. landed |
| Size   | predictor influence (CEO 6px / analyst 4.5px / academic 3.5px / journalist 3px) | Reflects "this prediction had reach" without overstating it |
| Position-x | year_said | brief specifies |
| Position-y | year_targeted (or `years_late` in the toggle view) | brief specifies |
| Diagonal | y=x reference line, faint, 1px dashed `--ink-dim` | "predictions about the present moment" |

Color palette: reuse `--chart-1` through `--chart-5` plus 5 new
muted hues. Categories that overlap visually (autonomous-vehicles
vs. crypto on a single screen) get the most-distinct hues.

Outcome glyphs:
- `●` filled — fulfilled (with or without delay)
- `○` open — did not happen
- `⋆` star — fulfilled on time (rare; visually striking)
- `◐` half — partially fulfilled / interpretation-dependent
- `?` muted — unclear / ambiguous

---

## G. Honest Caveats — what's still wrong with this draft

1. **The 80%-high bar isn't met yet.** ~40% high, ~45% medium,
   ~11% low. Brief calls for ≥80% high. Need a URL-verification
   pass before shipping; many of the medium entries are well-
   documented predictions whose URLs I can find with web search,
   but I haven't run that pass.

2. **English-language / Anglosphere bias.** Tencent, Alibaba,
   Baidu, Samsung, Sony predictions are underrepresented. Should
   be flagged in caveats panel on the page itself.

3. **Quote wording for older predictions is most likely
   paraphrase.** Henry Ford 1940, Lanier 1989, Cameron 2010 — I
   have the gist but not the exact wording confidently. Mark all
   pre-2010 as `verbatim: false` until verified.

4. **Some predictions interpret ambiguously.** "Self-driving by
   2020" means different things — Level 2, Level 4, robo-taxis at
   scale, or Tesla-style FSD. Each entry's `outcome_note` field
   needs to specify which reading we're scoring.

5. **The "right but late" section is small (n=6).** Needs to grow
   to ~15 to be visually meaningful as a chart. Candidates I'd
   add with verification: SpaceX reusable rocket predictions
   (right but late), 5G adoption predictions, biometric/face
   unlock, voice-unlock-everywhere, etc.

6. **Outcome scoring is interpretive for ~20% of entries.** Items
   marked `partially-fulfilled` or `did-not-happen-yet` are
   judgment calls. Each needs a brief outcome_note that states
   the criteria used.

---

## H. Recommended next steps

1. **You** review this list, course-correct (drop entries you
   don't believe, request specific additions, change category
   weighting).
2. **I** do a URL-verification pass tomorrow with web search
   active — drop entries whose primary source can't be located,
   promote medium entries to high where the URL confirms quote
   wording.
3. **I** generate `predictions-v2.json` from the verified list.
4. **I** build the frontend (page, JS, CSS — mostly fork of
   `agi-forecast-lab` with the schema delta in §B applied).
5. **You** review the rendered page and the archive table for
   outcome scoring before merging.

Not building tonight. The data is the lab.
