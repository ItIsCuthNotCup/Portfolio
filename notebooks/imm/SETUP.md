# IMM Lab — GCP setup

What you need to do, in order. Everything below assumes you have:

- A Google Cloud account with billing enabled
- `gcloud` CLI installed locally (`brew install --cask google-cloud-sdk`)
- Python 3.11+ on your Mac

The lab page itself works **right now** with the precomputed JSONs already
committed to `assets/data/imm-lab/`. The steps below are about replacing
those pseudo-posteriors with a real Meridian fit and standing up the live
prediction API. None of them are required to ship the page.

---

## 1. Create the project

```bash
# Pick any project ID — must be globally unique
export IMM_GCP_PROJECT="cuth-imm-lab"

gcloud projects create "$IMM_GCP_PROJECT" --name="IMM Lab"
gcloud config set project "$IMM_GCP_PROJECT"

# Link billing (replace BILLING_ACCOUNT_ID with yours from console)
gcloud beta billing projects link "$IMM_GCP_PROJECT" \
  --billing-account=BILLING_ACCOUNT_ID
```

## 2. Set the cost guardrails FIRST (before anything else)

The lab promises "$1/month" so this matters more than the model.

```bash
# Enable billing budget API
gcloud services enable billingbudgets.googleapis.com

# Create a $5/month budget alert (Console UI is easier than CLI here)
# Console → Billing → Budgets & alerts → Create budget
#   Name:       imm-lab-cap
#   Scope:      Project: cuth-imm-lab
#   Budget:     $5/month
#   Thresholds: 50%, 90%, 100%
#   Email:      your address
```

Then enable the BigQuery hard quota:

```bash
gcloud services enable bigquery.googleapis.com
gcloud alpha services quota update \
  --service=bigquery.googleapis.com \
  --consumer="projects/$IMM_GCP_PROJECT" \
  --metric=bigquery.googleapis.com/quota/query/usage \
  --value=100  # 100 GB/day hard cap (well under free tier)
```

If `gcloud alpha services quota update` is not enabled in your project,
do this in Console → IAM & Admin → Quotas → BigQuery → "Query usage per day".

## 3. Enable the APIs

```bash
gcloud services enable \
  bigquery.googleapis.com \
  storage.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

## 4. Authenticate locally

```bash
gcloud auth application-default login
```

This stores credentials at `~/.config/gcloud/application_default_credentials.json`
which the Python clients pick up automatically.

## 5. Run the training pipeline

```bash
cd "/Users/jacobcuthbertson/Desktop/Desktop - Jacob's MacBook Air/Apps/Portfolio"

# Create a venv (skip if you have a global Python env you prefer)
python3.11 -m venv .venv
source .venv/bin/activate

pip install -r notebooks/imm/requirements.txt

# Run training — generates synth panel, pushes to BQ, fits model, exports JSON
export IMM_GCP_PROJECT="cuth-imm-lab"
export IMM_GCP_DATASET="imm_lab"
export IMM_GCS_BUCKET="cuth-imm-lab-artifacts"

python notebooks/imm/imm_lab.py
```

The script:
- Generates the deterministic 104-week panel
- Creates BigQuery dataset `imm_lab` and loads `weekly_panel`
- Reads it back via `notebooks/imm/sql/03_modeling_input.sql` (proves the pipeline)
- Fits Meridian (or PyMC fallback if Meridian isn't installable on your Python)
- Validates: prints `8 / 8 channels inside 90% CI`
- Writes real posterior summaries to `assets/data/imm-lab/model.json`
- Pickles the trained model and uploads to `gs://cuth-imm-lab-artifacts/imm/imm_model.pkl`

If the Meridian install gives you trouble, the script automatically falls
back to a hand-rolled PyMC model. Both produce the same JSON contract for
the frontend.

## 6. Deploy the prediction API to Cloud Run (optional)

```bash
cd notebooks/imm/api

# Build & push the image
gcloud builds submit --tag "gcr.io/$IMM_GCP_PROJECT/imm-lab-api"

# Deploy to Cloud Run with hard limits
gcloud run deploy imm-lab-api \
  --image="gcr.io/$IMM_GCP_PROJECT/imm-lab-api" \
  --region=us-central1 \
  --allow-unauthenticated \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=1 \
  --concurrency=20 \
  --set-env-vars="IMM_GCS_BUCKET=cuth-imm-lab-artifacts,IMM_RATE_LIMIT_PER_MIN=10,IMM_CORS_ORIGINS=https://jakecuth.com,https://jakecuth.pages.dev"

# Grab the URL
gcloud run services describe imm-lab-api --region=us-central1 --format="value(status.url)"
```

Then expose it to the frontend by editing `work/imm-lab/index.html`:

```html
<script>window.IMM_API_URL = 'https://imm-lab-api-xxxxx.run.app';</script>
<script src="/assets/js/imm-lab.js?v=1"></script>
```

The frontend already works without this; the live API is only needed if
you want predictions to go through Cloud Run (which is the
stack-alignment story for the interview).

## 7. Lifecycle policy on Cloud Storage

```bash
# Auto-delete artifacts older than 90 days
gsutil lifecycle set <(cat <<'EOF'
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 90}
      }
    ]
  }
}
EOF
) "gs://cuth-imm-lab-artifacts"
```

## 8. (Optional) Cloud Build trigger for the model retrain

If you want the model to retrain on every push to `notebooks/imm/`, add
a `cloudbuild.yaml` and connect a trigger to the GitHub repo. Skipping
the YAML here — it's an interview talking point, not load-bearing for
the lab.

---

## Cost expectation

Running the steps above keeps the project at **$0/month** under
sustained free-tier usage:

| Service        | Free tier                | Realistic IMM Lab usage |
|----------------|--------------------------|-------------------------|
| BigQuery       | 1 TB queries / mo        | <1 MB / mo              |
| Cloud Storage  | 5 GB / mo                | ~2 MB                   |
| Cloud Run      | 2M req, 360k vCPU-sec/mo | ~100 req / mo           |
| Cloud Build    | 120 build-min / mo       | <5 build-min / mo       |
| Artifact Reg.  | 0.5 GB free              | ~50 MB                  |

The $5/month budget cap is a paranoia layer, not an expectation.

## What's saved to git

Committed:
- `notebooks/imm/imm_lab.py` (training pipeline)
- `notebooks/imm/generate_synth.js` (deterministic panel generator — JS twin)
- `notebooks/imm/sql/*.sql` (the three BigQuery queries)
- `notebooks/imm/api/main.py`, `Dockerfile`, `requirements.txt` (Cloud Run)
- `notebooks/imm/SETUP.md` (this file)
- `assets/data/imm-lab/data.json` (synthetic panel, ~50 KB)
- `assets/data/imm-lab/model.json` (posterior summaries, ~310 KB)

Not committed (`.gitignore`):
- `models/imm/imm_model.pkl` (trained artifact — pushed to GCS instead)
- `.venv/`
- `__pycache__/`

---

## Troubleshooting

**Meridian install fails on Mac**
Meridian depends on JAX which sometimes has wheel issues on Apple Silicon
under certain Python versions. The PyMC fallback in `imm_lab.py` produces
the same frontend contract — for the interview, mention you used Meridian
"where the install path was clean" and PyMC otherwise. Both are
defensible.

**`gcloud builds submit` is slow**
First build pulls the python:3.11-slim base (~50MB) plus all wheels.
Subsequent builds are cached and complete in <60s.

**Cloud Run cold-start latency**
The first `/predict` request after idle takes ~3-4s while the container
spins up and downloads `imm_model.pkl` from GCS. Subsequent requests in
the same instance are <100ms. For the demo, hit `/healthz` once to warm
the instance before showing the what-if tool.

**Rate limit triggers during demo**
The default is 10 req/min per IP. The slider in the frontend debounces
to ~3 req/sec, so a noisy reviewer can hit the cap in 4 seconds. Either
bump `IMM_RATE_LIMIT_PER_MIN` for the demo, or rely on the frontend's
client-side computation (which ignores the API entirely if `IMM_API_URL`
isn't set).
