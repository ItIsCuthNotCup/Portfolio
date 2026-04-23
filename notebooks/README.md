# Portfolio notebooks

Each `.py` in this folder is a reproducible pipeline. Running one regenerates
the JSON artifacts the corresponding lab page on [jakecuth.com](https://jakecuth.com) fetches at runtime.

## Setup (once)

```bash
pip install -r notebooks/requirements.txt
```

## Churn model — `/work/churn-lab/`

Source: [Kaggle · Churn Modelling](https://www.kaggle.com/datasets/shrutimechlearn/churn-modelling) (included at `data/bank_churn.csv`).

```bash
python notebooks/churn_model.py
```

Writes nine JSON files to `assets/data/churn/`.

## Segmentation model — `/work/segmentation-lab/`

Source: [UCI · Online Retail II](https://archive.ics.uci.edu/dataset/502/online+retail+ii) (included at `data/online_retail_ii.csv.gz`).

```bash
python notebooks/segmentation_model.py
```

Writes seven JSON files to `assets/data/segmentation/`.

## Recommendation model — `/work/reco-lab/`

Source: [MovieLens ml-latest-small](https://grouplens.org/datasets/movielens/latest/) (auto-downloaded on first run to `data/ml-latest-small/` — gitignored).

Poster images come from [TMDB](https://www.themoviedb.org/settings/api). A free API key is required — sign up, grab a v3 "API Key (auth)", and export it:

```bash
export TMDB_API_KEY=your_key_here
python notebooks/reco_model.py
```

Writes six JSON files to `assets/data/reco/` in ~30 seconds (longer on first run due to the MovieLens download and ~400 TMDB lookups).

If `TMDB_API_KEY` is unset, the pipeline still runs end-to-end and writes null poster URLs — useful for schema checks, not useful for a live page.

## A/B test simulator — `/work/ab-test-lab/`

The live page runs its own simulation in JavaScript. This script exists as an
independent Python + scipy cross-check: same sample-size formula, same
two-proportion z-test, same peeking-bias Monte Carlo. Outputs reference
numbers the frontend fetches and prints alongside the live numbers.

```bash
python notebooks/ab_test_model.py
```

Writes `assets/data/ab-test/methodology.json` in ~2 seconds. The expected
punchline: nominal α = 0.05, empirical false-positive rate from peeking ≈
30–40%, an ~6–8× inflation.

## Reproducibility

`random_state=42` wherever randomness matters. No floats depend on hardware. All datasets are either included in the repo or publicly downloadable by the script, and the scripts are fully deterministic.
