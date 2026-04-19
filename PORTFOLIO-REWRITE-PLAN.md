# Portfolio Rewrite Plan — Reposition as Analytics Engineer

Based on the hiring-research document. Every recommendation maps back to a specific finding.

---

## The strategic problem

The current portfolio positions as "Senior BI Analyst & Georgia Tech Analytics grad student." That's truthful but sits in the wrong category for an Analytics Engineer search. The research is clear: recruiters keyword-scan for role identity in the first 7 seconds. "BI Analyst" reads as dashboards-and-reporting; "Analytics Engineer" reads as SQL mastery, data modeling, dbt, CI/CD, engineering rigor.

The work you've actually done (customer churn model, Salesforce Data Cloud segmentation, SQL server on AWS, global data consolidation) contains real AE-adjacent signal — but the copy describes it as marketing BI. Reframing is about *emphasis and vocabulary*, not fabrication.

---

## Ten concrete changes, ranked by impact

### 1. Rewrite the hero — highest-leverage copy on the site

**Research:** Hero sets the cognitive frame. Recruiters form an impression in 30 seconds. Formula = [Identity] + [What You Do/Build] + [For Whom or At What Scale]. Clarity beats cleverness.

**Current:**
- Eyebrow: "Top 3% on Codewars"
- Headline: "Intelligence that Drives Marketing."
- Sub: "Senior BI Analyst & Georgia Tech Analytics graduate student bridging raw data and strategic revenue growth."

**Problems:** "Marketing" anchor fights the AE repositioning. "Bridging raw data and strategic revenue growth" is abstract filler — triggers the skepticism flagged in Hansen & Wänke. Codewars badge is nice-to-have but not the strongest credibility anchor.

**Rewrite direction:**
- Headline should name the role explicitly ("Analytics Engineer" in the H1 or nav tagline).
- Sub should contain 2–3 precise anchors: a concrete system built, a scale metric, a tool stack. Example structure: "I build [thing] for [audience] using [stack]. Currently [context]."
- Replace the Codewars badge with the strongest credibility signal — a tool logo row (SQL, Python, dbt if applicable, Snowflake/AWS, Tableau) or a headline metric ("Churn model deployed to 10+ person team, serving marketing at a $35B-asset bank").

### 2. Add a stated philosophy line

**Research:** Ivanov — "State your philosophy plainly, such as 'I build data platforms that prioritise reliability over hype.'" Differentiates, contains keywords, signals judgment in one sentence.

**Add one line** under the hero sub or as an eyebrow to the about section. Something concrete and opinionated — not "data storytelling" or "actionable insights." Example direction: "I build data models that survive contact with stakeholders."

### 3. Promote Skills above Experience

**Research:** Zety — 39% of recruiters look at skills first, 37% at experience. Current order buries the keyword-match below the fold.

**Reorder:** Hero → **Skills (tool stack)** → Capabilities → Experience → Projects → Education.

Also restructure the skills grid itself. Current categories (Programming, Visualization, ML, Cloud) are BI-oriented. AE-oriented grouping:

- **SQL & Data Modeling** — SQL, dimensional modeling (Kimball), window functions, CTEs
- **Transformation & Pipelines** — dbt (if applicable), Alteryx, Python, R
- **Warehouses & Platforms** — Snowflake, BigQuery, AWS, GCP, Salesforce Data Cloud, Spark
- **BI & Semantic Layer** — Tableau, Power BI, Looker, Datorama
- **Engineering Practices** — Git, CI/CD, data testing, documentation

Only list what's true. If you haven't used dbt or Snowflake, don't list them — instead show the adjacent work (AWS SQL server, Data Cloud) as the AE signal.

### 4. Rewrite every experience bullet in PAR format

**Research:** PAR (Problem → Action → Result) is optimal for written portfolio copy. Lead with or end with the result. 15–30 words per bullet, 3–5 bullets per role.

**Current bullet:** "Built the bank's enterprise customer churn prediction model using Random Forest, enabling marketing teams to identify at-risk customers and target retention campaigns. Led a 10+ person cross-functional deployment team."

**Diagnosis:** Has the action + result but missing the problem (why did this need to exist?), lacks scale context (how many customers, how much data), and "enabling…" is a weak connector.

**Rewrite direction:**
- "With retention campaigns targeting everyone equally, [bank] had no way to prioritize at-risk customers. Built and deployed the enterprise churn model (Random Forest, [X]M-record dataset, [Y] features), leading a 10-person cross-functional team through productionization. Model now drives [specific downstream use]."

Apply this to every bullet. Specifics to add wherever possible: dataset size, number of stakeholders, number of dashboards consumed, $ impact, team size, timeline.

### 5. Kill every buzzword phrase

**Research:** "Data-driven," "leveraged," "actionable insights," "cross-functional collaboration," "passionate," "strategic," "driven" are drained of meaning and trigger skepticism.

**Search-and-destroy pass** on current copy:
- "Translating complex datasets into predictive models, executive dashboards, and actionable marketing intelligence." → delete "complex" and "actionable." Replace with concrete verbs.
- "bridging raw data and strategic revenue growth" → delete entirely.
- "Ready to transform your data?" (contact CTA) → replace with something specific, e.g. "Hiring for an analytics engineer?"
- Any "leveraged," "drove insights," "cross-functional" — rewrite with the specific action.

### 6. Add the "messy middle" to at least one project

**Research:** Acknowledged imperfection builds more trust than projected perfection. Showing tradeoffs and constraints separates senior from junior. "A real work sample has texture."

**On either the churn model or the Nissan Share of Voice project**, add 1–2 sentences about a real constraint — a tradeoff made, a thing you'd redesign, a limitation of the approach. Example: "Chose Random Forest over gradient boosting because the marketing team needed feature importance they could explain to leadership — a real accuracy/explainability tradeoff."

### 7. Restructure Personal Projects copy for specificity

**Research:** Specificity = perceived truth. Include scale + stack + constraint.

**Current RiskScore:** "A CVE vulnerability prioritization API that combines multi-source threat intelligence into a single composite risk score. Ships as both a REST API and an MCP server so AI agents can reason about supply-chain risk natively."

**Strengthen:** name the actual threat intel sources (NVD? EPSS? CISA KEV?), the scoring algorithm class, the deployment target (RapidAPI, self-hosted). Same treatment for Glass Cipher (name the data feeds — ADS-B? AIS? TLE?) and Claude Second Brain (number of notes, tag structure, search mechanism).

### 8. Prune the certifications list

**Research:** Credibility hierarchy — too many mid-tier certs dilute the strong ones. 12 certs reads as "compensating." Recruiter scan gives 9% of attention to education total.

**Keep:** Georgia Tech MS (in progress), Temple BBA, top 3–4 certs only. Move the rest to a LinkedIn link or collapse under a "View full credential list" disclosure. Keep the named universities (Washington, Duke, Colorado) — cut the Udemy/Lynda entries from the surface.

### 9. Add one "signature project" depth page

**Research:** 3–6 projects total. 1 signature showing depth + 2–3 showing range. Full case studies 300–600 words.

**Pick the strongest:** the churn model OR RiskScore. Write a dedicated case-study page with:
- The problem framed as a business question
- The data (sources, size, shape)
- The architecture/model decisions and *why*
- The tradeoffs and what you'd change
- The result with numbers
- A diagram or screenshot

This is the hiring-manager depth layer that separates you from "tutorial portfolio" candidates.

### 10. Fix mobile and scan hierarchy

**Research:** 60%+ of recruiters browse on mobile. Scannable structure matters more than total word count. Every section needs a heading, a single clear metric, and a hook to keep scrolling.

**Audit pass:** on each section, the *first* visible element when scrolled to should be either a number, a named tool, or a named company. Not a generic label like "Core Capabilities." Examples of stronger section labels:

- "Core Capabilities" → "What I Build"
- "Professional Experience" → "Work That Shipped"
- "Technical Arsenal" → "Stack"
- "Ready to transform your data?" → "Get in touch"

---

## What stays as-is

- The hero scroll-driven day→sunset→night background. It's distinctive, not generic SaaS, and aligns with the `.impeccable.md` "time tells a story" principle. This is a differentiator, don't touch it.
- The editorial/warm-dark aesthetic. It reads as "not a template."
- Epilogue + Figtree typography.
- The Personal Projects section's alternating-sides + black glass frames. Visual execution is fine — the copy is the only weakness.

---

## Order of operations for the rewrite

1. **Hero first** — 60% of the impression. Lock the headline, sub, and philosophy line before touching anything else.
2. **Skills section second** — reorder, regroup for AE. This is the keyword-scan target.
3. **Experience bullets** — PAR rewrite pass on every bullet. Add scale numbers.
4. **Buzzword purge** — global find/replace pass.
5. **Projects copy** — add stack specifics and scale.
6. **Signature project** — write the deep case study last. It's the biggest effort but lowest initial-scan impact.
7. **Certs prune** — quick cleanup.
8. **Section label pass** — 15-minute find-and-replace.

---

## What I need from you to finish the rewrite

For the rewrite to have real numbers instead of placeholders, I need:

- Churn model: dataset size (rows/customers), number of features, accuracy/AUC if known, revenue or retention impact if measurable.
- Salesforce Data Cloud segments: number of customers segmented, campaigns affected, actual ROI lift source.
- Nissan Share of Voice: number of reports, hours saved (you have 8–10/month), any named downstream decision.
- Dashboards total: "60+" is fine, but who consumed them? Exec team? Marketing ops? Call center leadership?
- RiskScore: actual threat intel sources used, scoring inputs.
- Glass Cipher: data feeds (ADS-B, AIS, satellite TLE?).
- Second Brain: rough note count, tag taxonomy.

Drop those numbers and I (or Claude Code) can do a disciplined rewrite pass that turns every claim into evidence.
