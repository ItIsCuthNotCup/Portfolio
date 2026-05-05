# PROJECT BRIEF — Inside DeepSeek-V4

A visual explainer of the architecture innovations in DeepSeek-V4, framed
as a side-by-side comparison: what most people assume modern LLMs do vs.
what DeepSeek-V4 actually does. The headline result is that V4 uses ~10%
of the KV cache and ~27% of the FLOPs of V3.2 at 1M-token context, and
the lab walks through HOW.

This lab is a portfolio piece for jakecuth.com, a senior data analyst's
editorial-style portfolio site. Match the existing site's structure and
voice exactly. Inspect /work/agi-forecast-lab/ and /work/imm-lab/ for
typography, tone, chart machinery, and section pacing.

This lab is being **built by DeepSeek-V4** with **Claude Code** as the
orchestrator. It must surface that attribution prominently in the same
sticky banner pattern used by `escape-velocity-lab` and
`productivity-predictions-lab` (the `.ev-kimi-banner` class).

## Site context

- Newsreader (serif) + DM Mono. Small-caps section labels: "§ I",
  "FIG. 14.1". Masthead: "Vol. XII · No. 05 · May 2026" (or current).
- Editorial restraint. FT/NYT-Upshot sensibility. No marketing flourish.
- Sentence-case headers. Footnoted sources at end of each section.
- URL slug: /work/deepseek-v4-lab/
- Title: "Inside DeepSeek-V4."
- Subtitle: "Five things most people assume modern LLMs do, and what
  DeepSeek-V4 does instead."
- Listed under the **Tests** dropdown as `TEST. 05` (not the FIG. NN
  Labs section).

## Goal

A visual essay with 5 paired comparisons. Each comparison has:
1. A "what people assume" diagram of the standard LLM behavior.
2. A "what DeepSeek-V4 actually does" diagram.
3. ~150-300 words of editorial prose explaining the comparison.
4. A small "receipts" box with the specific config from the V4 paper
   (compression rates, head counts, etc.) for credibility.

The reader should leave with five new mental models for how a frontier
LLM actually works, not five new equations.

## Audience

The hiring-manager-of-an-analytics-team reader. The "I'm in tech, not
ML, but I follow this stuff" reader. The "I've heard of attention, I've
not implemented attention" reader. Explain it like you're writing for
a smart Economist reader who is ML-curious. Drop the equations into
expandable "for the curious" sections — don't lead with them.

## Voice

Dry, observational, slightly amused. The editorial point across all five
comparisons is the same: *the popular mental model of how LLMs work is
already 5+ years out of date.* Frontier models in 2026 share less with
the original 2017 Transformer than people assume. Don't say this
explicitly until the conclusion — let the comparisons make the case.

## The five comparisons (the spine of the lab)

### § I. Attention: from "everything attends to everything" to a zoom-out hierarchy

**Assumption:** Quadratic attention. Every token sees every other token.
The famous attention matrix from "Attention Is All You Need."

**Reality:** Hybrid attention. Two layer types interleaved:
- **CSA (Compressed Sparse Attention):** Take every m=4 tokens, compress
  to 1 entry. Then a "lightning indexer" picks the top-k=512 (or 1024)
  most relevant compressed entries. Query attends only to those + a
  sliding window of recent tokens.
- **HCA (Heavily Compressed Attention):** Take every m'=128 tokens,
  compress to 1 entry. Dense attention over the (now tiny) compressed
  sequence + sliding window.

The visual metaphor: standard attention is reading every word on every
page of a book before answering. V4 attention is reading the recent
paragraph in detail, the recent chapter as bullet summaries, and the
rest of the book as one-sentence summaries per chapter — and only
fetching the chapter summaries that look relevant.

**Visuals required:**
- Side-by-side diagram. Left: full N×N attention grid (the standard
  assumption). Right: a zoom-out hierarchy showing the same query token
  with a sliding window of recent uncompressed tokens, a CSA layer of
  4-to-1 compressed entries (with top-k selected ones highlighted), and
  an HCA layer of 128-to-1 compressed entries.
- Optional small companion: animated KV cache size growth across the
  two regimes as sequence length goes from 0 → 1M tokens. The standard
  curve goes linear-to-the-moon. The V4 curve flattens dramatically.

**Receipts box:**
- CSA: m=4, top-k=1024 (Pro) or 512 (Flash), 64 indexer query heads,
  indexer head dim 128
- HCA: m'=128
- Sliding window: n_win=128 tokens
- Number of query heads: 128 (Pro) / 64 (Flash)
- KV cache reduction at 1M context vs. standard BF16 GQA8: ~50×

### § II. KV cache: from linear growth to ~10% of V3.2

**Assumption:** Every token added means another KV entry stored, forever,
in 16-bit precision. Memory grows linearly with conversation length.
This is why long-context LLMs are expensive.

**Reality:** Compression at every layer + mixed precision storage:
- CSA layers store 1 entry per 4 tokens.
- HCA layers store 1 entry per 128 tokens.
- BF16 only for rotary positional embedding dimensions; FP8 for the rest
  (cuts KV cache nearly in half on top of the compression).
- Indexer QK path runs in FP4.
- Result: at 1M context, V4-Pro has 10% of V3.2's KV cache. V4-Flash has 7%.

**Visuals required:**
- Side-by-side bar chart showing the per-layer KV memory cost. Left:
  the standard "16-bit, 1 entry per token" baseline. Right: V4's mixed
  per-layer reality, with each bar broken down by CSA / HCA / SWA
  contributions. Use tiny labels showing precision (FP8 / BF16 / FP4).
- A line chart of accumulated KV cache size in GB across sequence length
  0 → 1M tokens, with three series: GQA8 baseline, V3.2, V4-Pro, V4-Flash.
  Match the chart from Figure 1 of the paper (the "9.5× / 13.7× smaller"
  one). Use the same axes the paper uses.

**Receipts box:**
- CSA compression: 1/4
- HCA compression: 1/128
- Storage precision: FP8 main + BF16 RoPE + FP4 indexer
- KV cache @ 1M tokens vs. BF16 GQA8 baseline: ~2%
- KV cache @ 1M tokens vs. DeepSeek-V3.2: 10% (Pro), 7% (Flash)

### § III. Residual connections: from one stream to four braided streams

**Assumption:** Every transformer layer does `x_out = x_in + f(x_in)`.
A single residual stream that all layers add to. This is the simplest,
most stable design, and it's been the default since the 2017 paper.

**Reality:** Manifold-Constrained Hyper-Connections (mHC). Four parallel
residual streams. Each layer mixes them via a learned residual matrix
B that's projected onto the *Birkhoff polytope* — the manifold of
doubly-stochastic matrices (rows sum to 1, columns sum to 1, all
non-negative). The projection happens via a 20-step Sinkhorn-Knopp
iteration every forward pass.

The point of the manifold constraint: it bounds the spectral norm of
B at 1, which keeps the residual signal from exploding or collapsing
across deep stacks of layers. Plain hyper-connections train unstably;
this fix keeps them stable.

**Visuals required:**
- Side-by-side schematic. Left: a single river flowing through layers,
  each layer adding a tributary. Right: four braided rivers flowing
  through layers, each layer mixing them via a small grid (the doubly-
  stochastic matrix). Show the mixing matrix as a 4×4 grid where rows
  and columns visibly sum to 1.
- Optional: a tiny visual of the Sinkhorn-Knopp iteration normalizing
  rows then columns, rows then columns, until convergence.

**Receipts box:**
- Hyper-connection expansion factor: n_hc = 4
- Sinkhorn-Knopp iterations per forward pass: 20
- AdamW (not Muon) used for the static biases and gating factors of mHC

### § IV. The optimizer: from AdamW to Muon

**Assumption:** Modern LLMs are trained with AdamW. This has been the
default since GPT-2. Almost every public model uses it.

**Reality:** DeepSeek-V4 uses **Muon** for the majority of parameters.
Muon orthogonalizes the gradient before stepping. Specifically: take
the gradient matrix M, compute its singular value decomposition
M = UΣV^T, then step in the direction of UV^T — the same gradient
direction, but with all singular values normalized to 1. They use a
hybrid Newton-Schulz iteration (10 steps in two stages) instead of a
real SVD because real SVD is too expensive.

The intuition: AdamW's update is shaped by the gradient itself, which
can be very stretched. Muon's update is "shape-only" — the direction
structure of the gradient with all magnitudes equalized. Result: faster
convergence, better stability at trillion-parameter scale.

AdamW is still used for embeddings, prediction head, and RMSNorm
weights — anywhere matrix orthogonalization doesn't make sense.

**Visuals required:**
- Side-by-side schematic. Left: AdamW step — show a stretched ellipse
  (the gradient) as the update vector. Right: Muon step — show the
  same ellipse being normalized to a sphere via Newton-Schulz, then
  the step taken in that normalized direction.
- Optional: a small visual of the Newton-Schulz iteration converging
  the singular values to 1 over 10 steps.

**Receipts box:**
- Optimizer: Muon for most params, AdamW for embeddings / head / RMSNorm
- Newton-Schulz: 10 iterations, 2-stage (fast then stabilizing)
- Hybrid coefficients: (3.4445, -4.7750, 2.0315) for first 8 steps;
  (2, -1.5, 0.5) for final 2

### § V. Numerical precision: from BF16 to FP4

**Assumption:** LLM weights are stored in 16-bit floats (BF16 or FP16).
Maybe 8-bit (FP8) at deployment via post-hoc quantization. This is
where the "175 billion parameters × 2 bytes = 350 GB" math comes from.

**Reality:** DeepSeek-V4 trains with mixed precision built in:
- MoE expert weights live in **FP4** (4 bits) with quantization-aware
  training. The model is trained to behave well under FP4 quantization
  rather than being post-hoc compressed.
- The attention indexer's QK path also runs in FP4.
- Index scores are quantized from FP32 to BF16 — a 2× speedup on the
  top-k selector with 99.7% recall preserved.

The entire QAT pipeline runs in the existing FP8 training framework via
an exact lossless FP4-to-FP8 dequantization trick: FP8 has 2 more
exponent bits than FP4, so as long as the per-block scale factor ratio
fits within FP8's dynamic range, the quantization is reversible.

**Visuals required:**
- A precision ladder diagram: BF16 (16 bits) → FP8 (8 bits) → FP4
  (4 bits). Show byte-level cell layouts. Highlight which V4 components
  use which precision (MoE experts in FP4, KV main in FP8, KV RoPE in
  BF16, indexer QK in FP4).
- A small companion chart: memory usage of a 1.6T-parameter model
  stored at each precision. The visual punchline is that FP4 storage
  for the experts is what makes 1.6T parameters fit on real hardware.

**Receipts box:**
- MoE expert weight precision: FP4 (MXFP4)
- KV main precision: FP8
- KV RoPE precision: BF16
- Indexer QK path precision: FP4
- Index score precision: BF16 (down from FP32) with 99.7% recall

## The opening hook (above the fold)

> The popular mental model of how a Large Language Model works is
> already five years out of date. Most people picture the 2017
> Transformer: every token attends to every other token, residual
> connections add layer outputs to inputs, AdamW shuffles weights
> toward the loss minimum, and weights live comfortably in 16-bit
> floats. This was the original recipe. It is no longer what
> frontier models do.
>
> In the technical report for DeepSeek-V4, released this month, the
> DeepSeek team describes a 1.6-trillion-parameter open-source model
> that handles a one-million-token context using 27% of the FLOPs and
> 10% of the KV cache of its predecessor. Five architectural changes
> make this possible. None of them is part of the popular mental
> model. All of them are worth understanding.
>
> Below: five things most people assume modern LLMs do, and what
> DeepSeek-V4 does instead.

## The closing (after § V)

> Five comparisons. Five places where the public mental model of how
> LLMs work has fallen behind what frontier labs are actually shipping.
> The 2017 Transformer is still in the family tree, but DeepSeek-V4
> shares less with it than the popular discourse suggests.
>
> The throughline: efficiency at scale isn't won by one big idea. It's
> won by a stack of compromises — compress here, sparsify there,
> constrain a manifold, normalize a singular value, drop two bits of
> precision — that compound multiplicatively. The headline number is
> 27% FLOPs and 10% KV cache. The boring truth is that no single
> change in this paper produced that result. They all did, together.
>
> If frontier-LLM efficiency feels mysterious, this is why. It isn't
> one trick. It's five.

## Visual direction

- Match site palette and typography exactly
- Two-color charts max — accent + neutral
- The "side-by-side" diagrams are the heart of the lab. They should
  feel like before/after photos, not abstract schematics. The reader
  should be able to point at the difference in 1 second.
- Math equations stay in expandable "for the curious" sections, not
  inline
- All numerical claims sourced to the V4 paper with §-level references
  in the receipts boxes

## Constraints

- **No build step.** Pure HTML + vanilla JS + CSS. No React, no Vue,
  no bundler. Match this for every new lab.
- Static page. All diagrams are SVG. No backend.
- Page weight under 800KB total.
- Mobile: side-by-side diagrams stack to top/bottom on narrow viewports.
- Honest caveats section: this lab is a *visual* explainer; full
  technical accuracy lives in the paper. Link prominently.

## Honest caveats to surface

- This lab simplifies for visual clarity. The paper is the source of
  truth; link prominently to https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro
- Some innovations (DeepSeekMoE, Multi-Token Prediction) are inherited
  from V3 and not "new" in V4. The lab doesn't try to cover every V4
  detail — only the five most impactful, most under-covered changes.
- The "what people assume" framing is a generalization. ML researchers
  know all of these aren't universal. The lab is written for the
  educated non-specialist, not for ML researchers.
- The 27% FLOPs and 10% KV cache numbers are at 1M-token context vs.
  V3.2. At shorter contexts, the gap is smaller.

## Deliverables

1. New /work/deepseek-v4-lab/index.html page
2. /assets/css/deepseek-v4-lab.css with .ev-kimi-banner restyled to
   credit DeepSeek-V4 (built by) + Claude Code (orchestrator)
3. Optional /assets/js/deepseek-v4-lab.js for the two animated charts
4. Five paired-comparison SVG diagrams
5. Two supporting line charts (KV cache curve, FLOPs curve) replicating
   Figure 1 of the V4 paper
6. README.md documenting the source paper, claim-by-claim citations, and
   the simplifications made for visual clarity
