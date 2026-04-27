# Model Picker (FIG. 07)

A RAG over OpenRouter's public model catalog. Natural-language query in,
streamed recommendation plus side-by-side comparison table out. Both the
embedding and the generation route through OpenRouter using a single API
key — embeddings via `google/gemini-embedding-2-preview`, generation via
`google/gemini-2.0-flash-001`.

## Architecture

```
Browser
  ↓  POST /api/model-picker  { query }
Cloudflare Pages Function (functions/api/model-picker.js)
  ├─ Reject if missing key, malformed body, > 1500 chars, or off-topic
  ├─ Hashed-IP rate limit (10/hr, 30/day)  ← KV-backed
  ├─ Daily spend cap ($2/day)              ← KV-backed
  ├─ 24-hour query cache                    ← KV-backed
  ├─ Load /assets/data/model-picker/models.json
  ├─ Regex constraint extractor (price, context, modality, capability)
  ├─ Filter pool by hard constraints
  ├─ Embed query via OpenRouter
  ├─ Cosine similarity → top 4
  ├─ Build grounded system prompt
  └─ Stream generation (SSE) back to browser
```

A weekly GitHub Action re-runs `notebooks/model_picker_lab.py` to
rebuild `models.json`, so the index doesn't rot as new models ship.

## Files

```
work/model-picker-lab/index.html              # the lab page
assets/css/model-picker-lab.css                # page styles
assets/js/model-picker-lab.js                  # frontend
functions/api/model-picker.js                  # the streamed RAG endpoint
notebooks/model_picker_lab.py                  # builds models.json
.github/workflows/refresh-model-picker.yml     # weekly cron
assets/data/model-picker/models.json           # the index (stub on first ship)
assets/data/model-picker/methodology.json      # receipts panel data
```

## First-time setup

You need to do three things, in this order. Two of them are pasting
secrets — the code is already in the repo.

### 1. Add the OpenRouter key as a Cloudflare Pages secret

This is what the deployed Function reads at request time.

1. Cloudflare dashboard → **Workers & Pages** → your Pages project
2. **Settings** → **Variables and Secrets**
3. **Add** → Type: **Secret** → Production
4. Variable name: `OPENROUTER_API_KEY`
5. Value: your key (`sk-or-v1-…`)
6. Save, then trigger a redeploy (push to `main` or "Retry deployment"
   on the latest build)

### 2. Add the same key as a GitHub Actions secret

This is what the weekly cron uses to refresh the index.

1. GitHub → repo → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**
3. Name: `OPENROUTER_API_KEY`
4. Value: same key

### 3. Build the real catalog index

The repo ships with a 12-model **stub** so the page works on first deploy
(structural ranking only, no embeddings). Replace it with the real
indexed catalog by running the notebook locally once:

```bash
cd <repo>
pip install requests
OPENROUTER_API_KEY=sk-or-v1-... python notebooks/model_picker_lab.py
git add assets/data/model-picker/
git commit -m "model-picker: first real index"
git push
```

After that, the Sunday cron takes over.

## Optional: enable the safety layer (KV)

The Function is designed to read from a Cloudflare KV namespace called
`MODEL_PICKER_KV` for rate-limit counters, the daily spend tally, and
the 24-hour query cache. If the binding isn't present, the Function
**still works** — those layers just no-op (the function logs nothing,
caches nothing, doesn't enforce rate limits).

To enable:

1. Cloudflare dashboard → **Workers & Pages** → **KV**
2. **Create namespace** → name it `MODEL_PICKER_KV`
3. Back to your Pages project → **Settings** → **Functions** → **KV
   namespace bindings**
4. Variable name: `MODEL_PICKER_KV` → bind to the namespace you just made
5. Redeploy

Until you do this, the spend cap and rate limits aren't enforced. For
a first push that's fine; the Function still respects the input length
cap, the topic guard, and the output token cap on every call.

## Spend cap

Set in `functions/api/model-picker.js`:

```js
const DAILY_SPEND_CAP_USD = 2.00;
const ESTIMATED_COST_PER_CALL_USD = 0.0003;
```

That's a hard floor of ~6,600 calls/day before the cap trips. The cost
estimate is conservative — actual cost per call against
`gemini-2.0-flash-001` is closer to $0.0002. To raise the cap, edit the
constant and redeploy.

The cap only enforces when KV is bound (above). Without KV, the
spending limit is whatever you've set on OpenRouter's account page.
**Set a hard limit in your OpenRouter account billing page** as a
backstop regardless.

## Refresh cadence

`.github/workflows/refresh-model-picker.yml` runs every Sunday at
02:00 UTC. It:

1. Pulls the latest catalog from `https://openrouter.ai/api/v1/models`
2. Builds chunks
3. Embeds each chunk via `google/gemini-embedding-2-preview`
4. Writes `assets/data/model-picker/models.json` and
   `assets/data/model-picker/methodology.json`
5. Commits and pushes if anything changed
6. The push triggers the existing Pages deploy workflow

The job is also `workflow_dispatch`-able, so you can refresh on demand
from the Actions tab.

## Testing locally

```bash
# Run the indexing once (uses your OpenRouter key)
OPENROUTER_API_KEY=sk-or-v1-... python notebooks/model_picker_lab.py

# Lint the function
node --check functions/api/model-picker.js

# Lint the lab JS
node --check assets/js/model-picker-lab.js

# Dev server with Functions support (requires wrangler)
npx wrangler pages dev .
# Then open http://localhost:8788/work/model-picker-lab/
```

## Hardening notes

- The Function never returns 5xx — Cloudflare's edge replaces 5xx with
  its branded HTML, which would break the JSON contract with the
  frontend. Runtime errors come back as `200 { ok: false, error }`.
- Output is hard-capped at 400 tokens regardless of what the user (or
  a prompt-injection attempt) asks for.
- The system prompt explicitly instructs the model to refuse anything
  outside "recommend a model from the catalog excerpt below."
- Topic guard runs before any model call. Non-LLM-related queries get
  a polite refusal at zero cost.
- The IP is SHA-256 hashed before being used as a KV key. Logs (when
  enabled) only carry the hash, not the IP.

## Limitations to be honest about

- **Latency tier is inferred, not measured.** A real benchmark pass
  would replace the heuristic; today the field is a guess from
  provider class and parameter count.
- **Quality claims are restricted to the model card.** The system
  refuses to rank models on benchmarks it didn't run. Subjective
  language ("good at code") is grounded only when the card says so.
- **Stub mode skips embedding.** When `models.json` has no
  embeddings (the shipped state), ranking falls back to "cheapest
  first, larger context next." Run the notebook to switch to real
  semantic ranking.
- **New models that release between Sunday refreshes** aren't in the
  index until the next cron run.
