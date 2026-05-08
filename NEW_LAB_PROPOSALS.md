# New Lab Proposals — Mind-Blowing Topics for jakecuth.com

> Generated 2026-05-08. Each proposal follows the `portfolio-lab-creator` skill structure.
> Three are fully spec'd for immediate build. The remaining seven are queued for future scheduling.

---

## The Shortlist: 10 Topics That Would Blow People's Minds

| # | Slug | Name | Why It Is Mind-Blowing | Build Complexity |
|---|------|------|------------------------|------------------|
| 1 | `tokenization` | **Token Lab** | Your name is not a word to an LLM. It is 2-7 subword fragments. An emoji can be 4 tokens. Watch BPE merge them live. | Pure JS |
| 2 | `bandit` | **Bandit Lab** | The explore-exploit dilemma, live. Thompson Sampling vs UCB1 vs Epsilon-Greedy. Real-time regret curves prove why smart exploration beats random guessing. | Pure JS |
| 3 | `diffusion` | **Diffusion Lab** | Noise in, structure out. A toy 2D diffusion model running in your browser. Place a shape, watch it dissolve into Gaussian noise, then walk it back step by step. | Pure JS + Canvas |
| 4 | `causal` | **Causal Lab** | Correlation is not causation. Build a DAG, add a confounder, and watch the aggregated correlation *reverse* when you stratify. Simpson's Paradox, made visceral. | Pure JS |
| 5 | `conformal` | **Conformal Lab** | A statistical guarantee no other model gives you. Set any confidence level. The prediction set adapts its size to keep that guarantee. Uncertainty, quantified. | Pure JS |
| 6 | `mcts` | **MCTS Lab** | Play Connect Four against an AI that shows you its tree. Watch Monte Carlo Tree Search balance exploration and exploitation in the game tree, move by move. | Pure JS |
| 7 | `mechanistic` | **Mechanistic Lab** | A 2-layer transformer, anatomized. Type a sequence, see attention patterns, logit lens projections, and induction heads fire in real time. | ONNX + JS |
| 8 | `embedding` | **Embedding Lab** | King minus man plus woman equals queen, in 2D. Drag vectors, perform analogies, find nearest neighbors. Word geometry, tangible. | Static JSON + JS |
| 9 | `genetic` | **Genetic Lab** | Evolution in a browser. Set mutation rate and population size, then watch a population evolve a path through a maze generation by generation. | Pure JS + Canvas |
| 10 | `adversarial` | **Adversarial Lab** | Draw a digit. Then nudge a few pixels imperceptibly until the classifier flips from "7" to "3". See exactly how fragile neural nets are. | ONNX + JS |

---

## How the Three Were Selected

The portfolio already has strong coverage in:
- **Classical ML** (Model Atlas: 12 algorithms)
- **Business analytics** (A/B tests, funnel sim, churn, segmentation, reco)
- **AI macro** (AGI forecasts, jobs, semiconductor supply chain, tech predictions)
- **LLM anatomy** (Attention paper, How LLMs Learn, DeepSeek-V4, LeWorldModel)

The gaps are:
1. **No NLP fundamentals** — Nothing shows how text becomes numbers. Tokenization is the invisible first step of every LLM call.
2. **No decision theory / RL** — Bandits are the foundation of recommendations, ads, and clinical trials. The explore-exploit narrative is timeless.
3. **No generative AI** — Diffusion powers Stable Diffusion, DALL-E, Midjourney. A toy version demystifies the entire class.

These three are also **pure client-side computation** (no API keys, no server), which aligns with the site's deployment model.

---

# Deep Spec: Token Lab

**Slug:** `tokenization`  
**Prefix:** `tk`  
**FIG Number:** `S14` (next after S13)  
**Name:** Token Lab  
**Lab Count After Add:** 41

## Editorial Frame

**H1:**  
```
Text, chopped into
pieces an LLM can count.
```
Accent: `pieces an LLM can count.`

**Biz-line:**  
*A live Byte Pair Encoding visualizer. Type any text and watch the algorithm merge the most frequent adjacent pairs into new tokens, one greedy step at a time. The same process that turns Shakespeare into 50,257 vocabulary slots inside GPT-2.*

**Kicker:**  
Enter text below. The algorithm starts with individual bytes (256 possible values), then iteratively merges the most frequent pair into a new token. Watch the vocabulary grow, the token count shrink, and the compression ratio climb. Every modern LLM does this before it sees a single parameter.

**Engine:** Pure JS · No model · BPE algorithm

## § I · Why LLMs do not read words

**Lede:** *Large language models do not see words. They see integers.*

**Body:**  
Before a transformer processes "hello world," the text must become a sequence of numbers. The naive approach, splitting on spaces, fails on misspellings, rare words, and languages without word boundaries. The clever approach, used by GPT-2, GPT-4, and Llama, is Byte Pair Encoding: start with single bytes, then greedily merge the most frequent adjacent pair into a new token. Repeat 50,000 times.

The result is a vocabulary where common words become single tokens (" the" = token 220), rare words decompose into fragments ("Tokenization" = "Token" + "ization"), and an emoji can explode into four separate integers. This lab runs the real algorithm on your text, step by step, so you can see exactly where the boundaries fall.

## § II · FIG. S14.1 · The tokenizer — type something

**Layout:** A two-column interface.

**Left panel:**
- Textarea for user input (default: a paragraph of public-domain text, e.g. the opening of *Pride and Prejudice* or the US Constitution preamble)
- "Step" button: performs one BPE merge
- "Auto-play" toggle: runs merges at 300ms intervals
- "Reset" button: returns to byte-level tokenization
- Slider: target vocabulary size (16, 32, 64, 128, 256, 512)

**Right panel:**
- **Token stream visualization:** Each token is a colored pill. Single-byte tokens are gray. Newly merged tokens pulse with the accent color. Hover shows the token's byte sequence and its frequency.
- **Merge history:** A scrolling list of each merge rule, e.g. `␣ + t → ␣t` (freq: 47)`
- **Stats bar:** Token count, vocabulary size, compression ratio (chars / tokens)

**The algorithm (client-side JS):**
```javascript
function bpeStep(tokens, pairCounts) {
  // tokens: array of integers (current token IDs)
  // pairCounts: Map of "a,b" -> frequency
  const maxPair = argmax(pairCounts);
  const newTokenId = nextId++;
  vocab[newTokenId] = vocab[maxPair.a] + vocab[maxPair.b];
  // Replace all occurrences of (a,b) with newTokenId
  tokens = mergeAdjacent(tokens, maxPair.a, maxPair.b, newTokenId);
  return tokens;
}
```

**Special case — the GPT-2 edge case:**  
The demo includes a toggle for "GPT-2 mode," which uses the actual first 256 merge rules from the GPT-2 tokenizer (preloaded as JSON). Users can see how GPT-2 tokenizes their text, including the infamous leading-space-as-token behavior (`Ġ` = space prefix).

## § III · How it works

**Three cards:**

**Fig. A · Start with bytes**  
BPE begins with 256 possible tokens, one for each byte value. Every character, including spaces and newlines, is a single token. The vocabulary is tiny but the sequence is long.

**Fig. B · Merge the winners**  
At each step, scan the entire sequence for the most frequent adjacent pair. Create a new token representing that pair. Replace every occurrence. The vocabulary grows by one. The sequence shrinks.

**Fig. C · Stop when rich enough**  
Training stops at a target vocabulary size, typically 32k-200k. At inference, the same merge rules are applied greedily. The result is a reversible compression: any text can be encoded to tokens and decoded back perfectly.

## § IV · FIG. S14.2 · The edge cases

**A grid of surprising tokenizations:**

| Input | GPT-2 Tokens | Note |
|-------|--------------|------|
| `hello` | 1 token | Common word, merged early |
| `Tokenization` | 2 tokens | `Token` + `ization` |
| `127381` | 5 tokens | Numbers split per digit or pair |
| `🚀` | 4 tokens | Emoji decomposes into UTF-8 bytes, then merges |
| `aaaaaaaaaa` | 1 token | Repeating patterns compress beautifully |
| `supercalifragilistic` | 3-4 tokens | Rare words fragment predictably |

Users can click any example to load it into the main tokenizer.

## § V · Receipts

Hardcoded stats (no notebook needed):

| Label | Value |
|-------|-------|
| Base tokens | 256 (byte values) |
| GPT-2 vocab size | 50,257 |
| GPT-4 vocab size | ~100,256 |
| Average English tokens per word | 1.3 |
| Average tokens per emoji | 3-5 |
| Algorithm time complexity | O(n · merges) |

## § VI · Methodology & Colophon

**Engine:** Pure JavaScript implementation of the classic BPE algorithm (Sennrich et al., 2016). No external tokenizer library. UTF-8 encoding handled natively via `TextEncoder`.

**Inference:** The GPT-2 mode loads the first 256 merge rules from OpenAI's public tokenizer vocabulary, serialized as a 12 KB JSON file. Full GPT-2 mode (all 50,000 rules) is available as a 340 KB JSON download toggle.

**Reading list:**
- Sennrich et al. — *Neural Machine Translation of Rare Words with Subword Units* (2016)
- Karpathy — *Let's build the GPT Tokenizer* (video, 2024)
- OpenAI — GPT-2 tokenizer source (`encoder.json`, `vocab.bpe`)

**Limitations:** This is the *training* algorithm, not the optimized inference encoder. Real-world tokenizers use finite-state transducers for O(n) encoding. The demo is O(n · merges) per step, which is fine for short text but would choke on a book.

**Lab-nav:** Prev: UAP Files (S13) → Next: (S15, to be determined)

---

## File Structure

```
work/tokenization-lab/
└── index.html

assets/
├── css/tokenization-lab.css
├── js/tokenization-lab.js
└── data/tokenization/
    └── gpt2_merges_256.json   # first 256 GPT-2 merge rules
```

No Python notebook required. The BPE algorithm runs entirely client-side.

---

# Deep Spec: Bandit Lab

**Slug:** `bandit`  
**Prefix:** `bd`  
**FIG Number:** `S15`  
**Name:** Bandit Lab  
**Lab Count After Add:** 41

## Editorial Frame

**H1:**  
```
The best lever is
not the one that paid last.
```
Accent: `not the one that paid last.`

**Biz-line:**  
*A live multi-armed bandit simulator. Tests four strategies side by side on the same hidden reward distribution. Shows why the slot machine that paid most recently is rarely the one that pays most overall, and how much that mistake costs.*

**Kicker:**  
Five arms. Hidden reward probabilities. Pull levers, watch algorithms learn, and compare cumulative regret in real time. Thompson Sampling, UCB1, Epsilon-Greedy, and Random play 500 rounds on identical ground truth. Nothing is preloaded. Every run is new.

**Engine:** Pure JS · Monte Carlo · Beta distributions

## § I · Why the winning variant is usually a trap

**Lede:** *The slot machine that just paid out is not more likely to pay again.*

**Body:**  
Every product team has faced this. Variant B converts at 4.2% after 100 users. Variant A converts at 2.1%. The team ships B. Six months later, B's true rate is 2.8% and A's is 3.5%. The early lead was noise, and the team spent six months sending traffic to the wrong variant.

The multi-armed bandit problem formalizes this. You have K options. Each has an unknown reward probability. You can pull one lever per round. The goal is not to find the best arm eventually. It is to maximize cumulative reward while learning. The metric that captures this is *regret*: the difference between what you earned and what an oracle would have earned always picking the best arm.

This lab simulates four strategies on identical hidden distributions. The same ground truth, four different fates.

## § II · FIG. S15.1 · The casino — pull the levers

**Layout:** A control panel plus four live charts.

**Control panel:**
- Number of arms: 3-10 (slider)
- Number of rounds: 100-5000 (slider)
- "New Game" button: samples new hidden reward probabilities from Beta(2,2)
- "Run All" button: simulates all four strategies simultaneously
- "Step" button: advances one round at a time

**Strategy cards (4 columns):**

1. **Random** — Baseline. Pulls uniformly. Expected regret: linear.
2. **Epsilon-Greedy** — Exploits the best-known arm with probability 1-ε, explores randomly with probability ε. ε = 0.1 default.
3. **UCB1** — Upper Confidence Bound. Selects arm with highest `mean_reward + sqrt(2·ln(total_pulls) / arm_pulls)`. No tuning parameters.
4. **Thompson Sampling** — Bayesian. Each arm gets a Beta(α, β) posterior. Sample from each, pick the highest sample. Naturally balances exploration (uncertain arms can draw high) and exploitation (good arms draw high consistently).

**Per-strategy visualizations:**
- **Cumulative regret curve:** Line chart, y-axis = regret, x-axis = round. Random goes linear. Smart algorithms bend toward logarithmic.
- **Arm selection heatmap:** A bar chart showing how many times each arm was pulled. Early on, bars are even (exploration). Later, the best arm dominates.
- **Posterior distributions (Thompson only):** Beta distributions for each arm, updated live. Watch uncertain arms start wide and narrow as evidence accumulates.

**Math in JS:**
```javascript
// Thompson Sampling
function thompsonSelect(arms) {
  let bestArm = 0, bestSample = 0;
  for (let i = 0; i < arms.length; i++) {
    const sample = rbeta(arms[i].alpha, arms[i].beta);
    if (sample > bestSample) { bestSample = sample; bestArm = i; }
  }
  return bestArm;
}

// UCB1
function ucbSelect(arms, totalPulls) {
  return argmax(arms.map(a => 
    a.mean + Math.sqrt(2 * Math.log(totalPulls) / a.pulls)
  ));
}
```

## § III · How it works

**Fig. A · The explore-exploit dilemma**  
You cannot maximize reward without information, and you cannot gain information without sacrificing reward. Every strategy is a different compromise. Random explores perfectly but never exploits. Greedy exploits immediately but may lock onto a suboptimal arm.

**Fig. B · Optimism in the face of uncertainty**  
UCB1 adds a confidence bonus to under-sampled arms. An arm with few pulls gets a large bonus, encouraging exploration. As pulls accumulate, the bonus shrinks and the empirical mean dominates. No hyperparameters needed. The formula is self-tuning.

**Fig. C · Probability matching**  
Thompson Sampling maintains a full posterior distribution over each arm's reward probability. Instead of picking the arm with the highest *estimate*, it samples from each distribution and picks the highest *sample*. Uncertain arms occasionally produce lucky high samples, ensuring they get tested. This is the algorithm behind many modern ad-placement and recommendation systems.

## § IV · FIG. S15.2 · The cost of impatience

**A scenario explorer:**

Users select from preset ground-truth configurations:
- **Easy:** One arm at 0.8, others at 0.2. All algorithms converge quickly.
- **Close call:** Two arms at 0.45 and 0.50. Hard to distinguish. Shows why Thompson Sampling shines.
- **Deceptive:** Best arm starts with a string of losses. Epsilon-Greedy abandons it. Thompson Sampling recovers.
- **Non-stationary:** Reward probabilities drift over time. (Advanced toggle; adds exponential decay to posteriors.)

A summary table shows final regret for each strategy across 100 Monte Carlo runs.

## § V · Receipts

Hardcoded:

| Label | Value |
|-------|-------|
| Regret bound (Random) | O(T) linear |
| Regret bound (Epsilon-Greedy) | O(T) linear (worst case) |
| Regret bound (UCB1) | O(√(KT·ln T)) |
| Regret bound (Thompson) | O(√(KT·ln T)) |
| Typical pulls to identify best arm | 50-100 per arm |
| Real-world use | Google Ads, Netflix reco, clinical trials |

## § VI · Methodology & Colophon

**Engine:** Pure JavaScript Monte Carlo simulation. Beta random variates generated via the Marsaglia method. No external libraries.

**Model spec:** Bernoulli reward arms with hidden probabilities drawn from Beta(2,2). All four strategies receive identical ground-truth on each "New Game." Regret computed against an oracle with perfect foresight.

**Reading list:**
- Lattimore & Szepesvari — *Bandit Algorithms* (Cambridge, 2020)
- Chapelle & Li — *An Empirical Evaluation of Thompson Sampling* (NIPS 2011)
- Auer et al. — *Finite-time Analysis of the Multiarmed Bandit Problem* (ML 2002)

**Limitations:** Real bandit problems are rarely stationary. User preferences drift, ads fatigue, and inventory changes. This demo assumes fixed reward probabilities. The non-stationary toggle is a simplified exponential decay, not a full restless bandit.

**Lab-nav:** Prev: Token Lab (S14) → Next: Diffusion Lab (S16)

---

## File Structure

```
work/bandit-lab/
└── index.html

assets/
├── css/bandit-lab.css
└── js/bandit-lab.js
```

No Python notebook. Pure simulation.

---

# Deep Spec: Diffusion Lab

**Slug:** `diffusion`  
**Prefix:** `df`  
**FIG Number:** `S16`  
**Name:** Diffusion Lab  
**Lab Count After Add:** 41

## Editorial Frame

**H1:**  
```
Noise, guided back
to structure it never knew.
```
Accent: `to structure it never knew.`

**Biz-line:**  
*A toy diffusion model in two dimensions. Place points on a canvas, watch the forward process dissolve them into Gaussian noise, then guide the reverse process step by step until structure re-emerges. The core idea behind Stable Diffusion, DALL-E, and every modern image generator.*

**Kicker:**  
The canvas below runs a simplified diffusion process. You draw a simple shape (or pick a preset). The forward pass adds noise according to a beta schedule. The reverse pass uses a tiny neural network trained to predict the noise at each step, then subtracts it. Twenty steps from chaos to coherence. All in your browser.

**Engine:** ONNX Runtime Web · Tiny U-Net · Canvas 2D

## § I · Why noise is the medium

**Lede:** *The most powerful image generators do not paint. They unerase.*

**Body:**  
Generative models used to work by directly learning P(image). GANs pit two networks against each other in an adversarial game. VAEs learn a compressed latent space. Both are hard to train and prone to mode collapse.

Diffusion models took a different path. Instead of learning to generate images directly, they learn to *denoise* them. The training process is almost absurdly simple: take a clean image, add random Gaussian noise, and train a neural network to predict the noise that was added. At inference, start with pure noise and repeatedly apply the denoiser. After enough steps, structure emerges from chaos.

This lab distills that process to its essence. A 2D canvas. A tiny U-Net. And a slider that walks you from t=0 (clean) to t=T (noise) and back again.

## § II · FIG. S16.1 · The canvas — draw, diffuse, denoise

**Layout:** Full-width canvas with a floating control panel.

**Canvas (512×512):**
- Users can draw simple shapes (circle, square, line, freehand) in black on white
- Preset shapes: smiley face, checkerboard, spiral, text "AI"
- A "Diffuse" button runs the forward process: x_t = sqrt(ᾱ_t)·x_0 + sqrt(1-ᾱ_t)·ε
- A "Denoise" button runs the reverse process step by step
- Step slider: drag from t=0 to t=T to see intermediate states

**The toy model:**  
Because a full image U-Net is too large for the browser, the demo uses a **1D/2D toy diffusion model**:
- Input: a 32×32 grayscale image (or 64 points in 2D for the point-cloud mode)
- Model: a tiny 3-layer MLP with sinusoidal time embedding
- Training: done offline in a Python notebook, exported to ONNX (~45 KB)
- Inference: ONNX Runtime Web in the browser

**Two modes:**

1. **Image mode:** Users draw on a 32×32 grid (upsampled to 512×512 for display). The model predicts noise at each pixel.
2. **Point-cloud mode:** Users place 10-50 colored points. The forward process jitters each point's (x,y) coordinates. The reverse model learns to guide points back to their original positions. This is the clearest visualization of "noise in, structure out."

**Forward process math:**
```
x_t = sqrt(ᾱ_t) * x_0 + sqrt(1 - ᾱ_t) * ε
where α_t = 1 - β_t
      ᾱ_t = prod(s=1..t) α_s
      β_t increases linearly from 1e-4 to 0.02
```

**Reverse process (simplified DDPM):**
```
predicted_noise = model(x_t, t)
x_{t-1} = (x_t - sqrt(1-ᾱ_t)*predicted_noise) / sqrt(ᾱ_t)
          + sqrt(β_t) * z
where z ~ N(0,1) for t > 1, z = 0 for t = 1
```

## § III · How it works

**Fig. A · The forward pass**  
Start with a clean image x_0. At each step t, add Gaussian noise scaled by β_t. After T steps, the image is statistically indistinguishable from pure noise. The schedule controls how fast noise accumulates. Linear is simple; cosine is gentler.

**Fig. B · Learn the score**  
The neural network does not learn to output images. It learns to predict the noise ε that was added. Equivalently, it learns the "score function" — the gradient of the log probability density. This is easier to learn than generating images directly.

**Fig. C · The reverse walk**  
Start with x_T ~ N(0,1). At each step, predict the noise, subtract it (with appropriate scaling), add a small amount of randomness for stochasticity, and move to x_{t-1}. After T steps, you have x_0. The randomness is crucial; without it, the process collapses to the mean.

## § IV · FIG. S16.2 · The schedule explorer

**An interactive comparison of noise schedules:**

Three small canvases show the same image under different schedules:
- **Linear:** β_t increases linearly. Simple, but adds too much noise early.
- **Cosine:** ᾱ_t follows a cosine curve. Gentler start, better quality. (Nichol & Dhariwal, 2021)
- **Sigmoid:** Smoother transition. Used in some modern variants.

Below each canvas: a line chart showing β_t over time, and the final reconstruction quality (MSE vs ground truth).

**Advanced toggle — Classifier-Free Guidance:**  
A slider for guidance scale ω. At ω=1, standard sampling. At ω>1, the denoising step moves further in the direction of the conditional prediction. This is the trick that makes text-to-image models follow prompts so precisely.

## § V · Receipts

From `notebooks/diffusion_model.py` training:

| Label | Value |
|-------|-------|
| Model params | ~12,000 |
| Input resolution | 32 × 32 grayscale |
| Training steps | 10,000 |
| Dataset | synthetic shapes + MNIST subset |
| ONNX size | ~45 KB |
| Inference time | ~80 ms per step (WASM) |
| DDPM steps | 20 (toy) / 1000 (full) |

## § VI · Methodology & Colophon

**Engine:** A 3-layer MLP with sinusoidal time embeddings, trained in PyTorch, exported to ONNX via `torch.onnx.export`. Inference runs in ONNX Runtime Web with the WASM backend. No GPU required.

**Model spec:** The network takes a flattened 32×32 image plus a scalar timestep t, passes through [1024, 512, 1024] layers with SiLU activations, and outputs a 32×32 noise prediction. Trained on 5,000 synthetic shapes (circles, lines, text) with MSE loss against added noise.

**Reading list:**
- Ho et al. — *Denoising Diffusion Probabilistic Models* (NeurIPS 2020)
- Nichol & Dhariwal — *Improved Denoising Diffusion Probabilistic Models* (2021)
- Sohl-Dickstein et al. — *Deep Unsupervised Learning using Nonequilibrium Thermodynamics* (ICML 2015)

**Limitations:** This is a toy. A 32×32 grayscale model with 12k parameters cannot generate photorealistic images. It exists to make the diffusion mechanism tangible. Real systems use U-Nets or Transformers (DiT) with hundreds of millions of parameters, operating in latent space. The classifier-free guidance toggle is a simplified scalar interpolation, not the full conditional null-prediction pipeline.

**Lab-nav:** Prev: Bandit Lab (S15) → Next: (S17, to be determined)

---

## File Structure

```
work/diffusion-lab/
└── index.html

assets/
├── css/diffusion-lab.css
├── js/diffusion-lab.js
├── models/diffusion/
│   ├── model.onnx
│   └── categories.json
└── data/diffusion/
    └── methodology.json

notebooks/
└── diffusion_model.py
```

**Training notebook outline (`notebooks/diffusion_model.py`):**
```python
import torch, torch.nn as nn
import numpy as np
from sklearn.datasets import make_moons  # or synthetic shapes

class TinyDiffusion(nn.Module):
    def __init__(self):
        super().__init__()
        self.time_embed = SinusoidalEmbedding(64)
        self.net = nn.Sequential(
            nn.Linear(1024 + 64, 1024), nn.SiLU(),
            nn.Linear(1024, 512), nn.SiLU(),
            nn.Linear(512, 1024)
        )
    def forward(self, x, t):
        t_emb = self.time_embed(t)
        x_flat = x.view(x.size(0), -1)
        return self.net(torch.cat([x_flat, t_emb], dim=-1)).view_as(x)

# Train on synthetic 32x32 shapes
# Export to ONNX
```

---

# Appendix: Build Order Recommendation

If building only one: **Token Lab**. It requires no model training, no notebook, and no asset pipeline. It is pure HTML/CSS/JS and can ship in a single session. The "wow" moment is immediate (type your name, see it split).

If building two: add **Bandit Lab**. Also pure JS, strong narrative, and complements the existing A/B Test Simulator perfectly (bandits are the adaptive alternative to fixed-horizon A/B tests).

If building all three: **Diffusion Lab** last, because it requires the ML pipeline (training, ONNX export, preprocessing parity checks).

---

# Appendix: Topics 4-10 (Brief Specs for Future Scheduling)

## 4. Causal Lab (`causal`)
**Pitch:** Interactive Simpson's Paradox. Users build a DAG with three nodes (Treatment, Outcome, Confounder), set conditional probabilities, and watch the aggregated correlation reverse when stratified by the confounder. A "do-calculus" toggle performs graph surgery and shows the true causal effect.
**Complexity:** Pure JS. No model.
**Biz-line:** *A live causal inference demo. Shows why the drug that looks harmful in aggregate data is actually beneficial for every subgroup. Simpson's Paradox, with do-calculus.*

## 5. Conformal Lab (`conformal`)
**Pitch:** Users drag a confidence slider (80% to 99%). A simple 1D regression model makes predictions, and the prediction set (interval) grows or shrinks to maintain the exact coverage guarantee. Shows 20 test points; the ones that fall outside the set are highlighted, proving the guarantee empirically.
**Complexity:** Pure JS. No model.
**Biz-line:** *A prediction interval with a mathematical guarantee. Set any confidence level. The set adapts. No distributional assumptions, no retraining, no Bayesian priors. Distribution-free uncertainty quantification.*

## 6. MCTS Lab (`mcts`)
**Pitch:** Play Connect Four against an AI. After each AI move, an interactive tree visualization shows the MCTS process: selection (UCB1 in the tree), expansion, simulation (random rollout), and backpropagation. Users can adjust simulation count per move and see quality improve.
**Complexity:** Pure JS + Canvas.
**Biz-line:** *Play Connect Four against an AI that shows you its thoughts. Monte Carlo Tree Search visualized move by move. The algorithm behind AlphaGo, running in your browser.*

## 7. Mechanistic Lab (`mechanistic`)
**Pitch:** A 2-layer, 4-head, 64-dim transformer trained on a tiny task (e.g., modular addition or sequence completion). Exported to ONNX. Users type a short sequence and see: attention heatmaps per head, logit lens projections at each layer, and induction head pattern detection. Extends the Attention Lab into actual circuit tracing.
**Complexity:** ONNX + JS. Requires training.
**Biz-line:** *A transformer small enough to dissect. Two layers, four heads, and every internal computation visible. Type a sequence, watch induction heads fire, and see how predictions evolve layer by layer.*

## 8. Embedding Lab (`embedding`)
**Pitch:** A 2D projection of GloVe word embeddings (pre-trained, shipped as ~200 KB JSON). Users search for words, see them plotted, drag vectors to perform analogies (king - man + woman), and see nearest neighbors update live. A "semantic compass" shows directions for gender, royalty, and verb tense.
**Complexity:** Static JSON + JS. No training.
**Biz-line:** *Word arithmetic in two dimensions. King minus man plus woman equals queen, visually. A live explorer over 5,000 GloVe embeddings showing that language has geometry.*

## 9. Genetic Lab (`genetic`)
**Pitch:** Users draw a target shape (or upload a simple SVG path). A population of 100 random polygons evolves toward the target via mutation, crossover, and selection. Controls for mutation rate, population size, and selection pressure (tournament vs roulette). Watch fitness climb over generations.
**Complexity:** Pure JS + Canvas.
**Biz-line:** *Evolution as an optimization algorithm. A population of random shapes breeds, mutates, and selects its way toward a target image. Set the mutation rate, press play, and watch Darwinian optimization in real time.*

## 10. Adversarial Lab (`adversarial`)
**Pitch:** A tiny MNIST classifier (ONNX, ~30 KB) runs in the browser. Users draw a digit on a 28×28 canvas. The model predicts the class. Then a "Perturb" button applies the Fast Gradient Sign Method (FGSM) with increasing epsilon. Users see pixels change almost imperceptibly while the prediction confidence collapses and eventually flips.
**Complexity:** ONNX + JS. Requires training a small MNIST model.
**Biz-line:** *A neural network that runs in your browser, and an attack that breaks it. Draw a digit, then nudge a handful of pixels until the model is confidently wrong. The fragility of modern AI, made visible.*
