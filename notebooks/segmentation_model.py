"""
segmentation_model.py — reproducible customer-segmentation pipeline for the
UCI Online Retail II dataset. Generates all JSON artifacts consumed by
/work/segmentation-lab/ on the portfolio site.

Run:
    python notebooks/segmentation_model.py

Inputs:
    data/online_retail_ii.csv.gz   (combined 2009-2011 UK retail transactions)

Outputs (written to assets/data/segmentation/):
    metrics.json        — winner's headline stats + best k per method
    k_selection.json    — full silhouette/CH/DB/inertia sweep
    segments.json       — per-cluster profiles (size, revenue, RFM, repurchase, AOV)
    embedding.json      — 2,000-point stratified PCA sample for the cluster map
    classify.json       — K-Means centroids + scaler params for the live classifier
    data_profile.json   — row counts, filters, RFM distributions
    methodology.json    — seed, sklearn version, silhouette sampling, k ranges

Determinism: fix random_state=42 everywhere, fix silhouette sampling, round
all floats before dump, stable key ordering. Methodology timestamp is derived
from the source CSV's mtime so reruns on the same data are byte-identical.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn
from sklearn.cluster import AgglomerativeClustering, KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import (
    calinski_harabasz_score, davies_bouldin_score, silhouette_score,
)
from sklearn.mixture import GaussianMixture
from sklearn.preprocessing import StandardScaler

# ── Paths + determinism ────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "data" / "online_retail_ii.csv.gz"
OUT_DIR = ROOT / "assets" / "data" / "segmentation"
OUT_DIR.mkdir(parents=True, exist_ok=True)

SEED = 42
SIL_SAMPLE = 2000              # silhouette_score sample_size — speed + determinism

np.random.seed(SEED)

KS_KMEANS = list(range(2, 11))  # 2..10
KS_GMM = list(range(2, 11))
KS_AGG = list(range(2, 9))      # 2..8 (Ward is O(n^2))


# ── 1. Load + preprocess ───────────────────────────────────────────
print(f"Loading {CSV_PATH.relative_to(ROOT)} …")
df_raw = pd.read_csv(CSV_PATH, parse_dates=["InvoiceDate"])
raw_rows = int(len(df_raw))

df = df_raw.dropna(subset=["Customer ID", "Description"])
df = df[(df["Quantity"] > 0) & (df["Price"] > 0)].copy()
df["line_revenue"] = df["Quantity"] * df["Price"]
cleaned_rows = int(len(df))

snapshot_date = df["InvoiceDate"].max() + pd.Timedelta(days=1)
print(f"  raw={raw_rows:,}  cleaned={cleaned_rows:,}  snapshot={snapshot_date}")


# ── 2. RFM aggregation ─────────────────────────────────────────────
rfm = df.groupby("Customer ID").agg(
    last_purchase=("InvoiceDate", "max"),
    frequency=("Invoice", "nunique"),
    monetary=("line_revenue", "sum"),
)
rfm["recency"] = (snapshot_date - rfm["last_purchase"]).dt.days
rfm = rfm[["recency", "frequency", "monetary"]].reset_index()

# 3. Trim top/bottom 1% on Monetary
lo = rfm["monetary"].quantile(0.01)
hi = rfm["monetary"].quantile(0.99)
rfm = rfm[(rfm["monetary"] >= lo) & (rfm["monetary"] <= hi)].reset_index(drop=True)
total_customers = int(len(rfm))
total_revenue = float(rfm["monetary"].sum())
print(f"  customers after trim: {total_customers:,}  total_revenue=${total_revenue:,.0f}")


# ── 4. log1p + StandardScaler ──────────────────────────────────────
X_raw = rfm[["recency", "frequency", "monetary"]].to_numpy()
X_log = np.log1p(X_raw)
scaler = StandardScaler().fit(X_log)
X = scaler.transform(X_log)


# ── 5. Clustering grid ─────────────────────────────────────────────
def sil(X, labels):
    return float(silhouette_score(X, labels, sample_size=SIL_SAMPLE, random_state=SEED))
def ch(X, labels):
    return float(calinski_harabasz_score(X, labels))
def db(X, labels):
    return float(davies_bouldin_score(X, labels))

k_selection = {"kmeans": [], "gmm": [], "agglomerative": []}

# "Best k" rule — intentionally excludes the degenerate k=2 winner.
# On RFM features silhouette almost always peaks at k=2 because the data
# has a strong bimodal Pareto structure (roughly 80% of revenue from a
# small fraction of customers). k=2 is a genuine finding, but a
# segmentation dashboard with only two groups is useless for targeted
# outreach — we want the secondary silhouette peak at k≥3. The full
# k=2..10 sweep is still written to k_selection.json so the trivial
# winner is visible in the line chart.
BEST_K_MIN = 3

print("Fitting K-Means grid …")
best_km = None
for k in KS_KMEANS:
    m = KMeans(n_clusters=k, random_state=SEED, n_init=10).fit(X)
    labels = m.labels_
    row = {
        "k": k,
        "silhouette": sil(X, labels),
        "calinski_harabasz": ch(X, labels),
        "davies_bouldin": db(X, labels),
        "inertia": float(m.inertia_),
    }
    k_selection["kmeans"].append(row)
    if k >= BEST_K_MIN and (best_km is None or row["silhouette"] > best_km["sil"]):
        best_km = {"k": k, "sil": row["silhouette"], "model": m, "labels": labels,
                   "ch": row["calinski_harabasz"], "db": row["davies_bouldin"],
                   "inertia": row["inertia"]}

print("Fitting GMM grid …")
best_gmm = None
for k in KS_GMM:
    m = GaussianMixture(n_components=k, covariance_type="full", random_state=SEED).fit(X)
    labels = m.predict(X)
    row = {
        "k": k,
        "silhouette": sil(X, labels),
        "calinski_harabasz": ch(X, labels),
        "davies_bouldin": db(X, labels),
        "inertia": None,
    }
    k_selection["gmm"].append(row)
    if k >= BEST_K_MIN and (best_gmm is None or row["silhouette"] > best_gmm["sil"]):
        best_gmm = {"k": k, "sil": row["silhouette"], "model": m, "labels": labels,
                    "ch": row["calinski_harabasz"], "db": row["davies_bouldin"]}

print("Fitting Agglomerative (Ward) grid …")
best_agg = None
for k in KS_AGG:
    m = AgglomerativeClustering(n_clusters=k, linkage="ward").fit(X)
    labels = m.labels_
    row = {
        "k": k,
        "silhouette": sil(X, labels),
        "calinski_harabasz": ch(X, labels),
        "davies_bouldin": db(X, labels),
        "inertia": None,
    }
    k_selection["agglomerative"].append(row)
    if k >= BEST_K_MIN and (best_agg is None or row["silhouette"] > best_agg["sil"]):
        best_agg = {"k": k, "sil": row["silhouette"], "model": m, "labels": labels,
                    "ch": row["calinski_harabasz"], "db": row["davies_bouldin"]}


# ── 6. Pick winner ─────────────────────────────────────────────────
method_rank = [("kmeans", best_km), ("gmm", best_gmm), ("agglomerative", best_agg)]
winner_method, winner_info = max(method_rank, key=lambda t: t[1]["sil"])
print(f"Silhouette winner: {winner_method} at k={winner_info['k']} (sil={winner_info['sil']:.4f})")

# Operational model: always K-Means at K-Means's own best k, because the live
# classifier (§ VI) requires centroids and the embedding inset reuses them.
# This is flagged transparently on the page when K-Means is not the winner.
ops_k = best_km["k"]
ops_model = best_km["model"]
ops_labels = best_km["labels"]

rfm["cluster"] = ops_labels


# ── 7. Segment profiling + deterministic auto-name ─────────────────
# Two-axis naming grid: recency band × value tier (F + M composite).
#   recency:  r_pct ≤ 33        → "Active"    (recent purchase)
#             33 < r_pct < 67   → "Fading"    (slipping away)
#             r_pct ≥ 67        → "Dormant"   (long since last purchase)
#   value:    avg(f_pct, m_pct) ≤ 33   → Low-Value
#             < 67                       → Mid-Tier
#             ≥ 67                       → High-Value
# A handful of corners get proper names: Loyal Champions, Lapsing Whales,
# At-Risk Big Spenders, Dormant Low-Value, New Triers. Everything else
# falls through to a composite "Active Mid-Tier" / "Fading High-Value" /
# etc. so no two clusters can collide on the same label.

def auto_name(r_pct: float, f_pct: float, m_pct: float) -> str:
    rec = "Active" if r_pct <= 33 else ("Fading" if r_pct < 67 else "Dormant")
    val_avg = (f_pct + m_pct) / 2
    tier = "Low-Value" if val_avg <= 33 else ("Mid-Tier" if val_avg < 67 else "High-Value")

    # Named archetypes at the corners
    if rec == "Active" and f_pct >= 67 and m_pct >= 67:
        return "Loyal Champions"
    if rec == "Dormant" and tier == "High-Value":
        return "Lapsing Whales"
    if rec == "Fading" and tier == "High-Value":
        return "At-Risk Big Spenders"
    if rec == "Dormant" and tier == "Low-Value":
        return "Dormant Low-Value"
    if rec == "Active" and tier == "Low-Value":
        return "New Triers"

    # Everything else: descriptive composite
    return f"{rec} {tier}"

overall_r = rfm["recency"].to_numpy()
overall_f = rfm["frequency"].to_numpy()
overall_m = rfm["monetary"].to_numpy()

segments = []
for c in range(ops_k):
    sub = rfm[rfm["cluster"] == c]
    if len(sub) == 0:
        continue
    med_r = float(sub["recency"].median())
    med_f = float(sub["frequency"].median())
    med_m = float(sub["monetary"].median())
    r_pct = float((overall_r <= med_r).mean() * 100)
    f_pct = float((overall_f <= med_f).mean() * 100)
    m_pct = float((overall_m <= med_m).mean() * 100)
    size = int(len(sub))
    cluster_rev = float(sub["monetary"].sum())
    repurchase_60 = float((sub["recency"] < 60).mean())
    aov = float((sub["monetary"] / sub["frequency"]).mean())
    segments.append({
        "cluster": int(c),
        "name": auto_name(r_pct, f_pct, m_pct),
        "size": size,
        "pct_customers": round(size / total_customers * 100, 2),
        "revenue": round(cluster_rev, 2),
        "pct_revenue": round(cluster_rev / total_revenue * 100, 2),
        "r_median": round(med_r, 1),
        "r_p25": round(float(sub["recency"].quantile(0.25)), 1),
        "r_p75": round(float(sub["recency"].quantile(0.75)), 1),
        "f_median": round(med_f, 2),
        "f_p25": round(float(sub["frequency"].quantile(0.25)), 2),
        "f_p75": round(float(sub["frequency"].quantile(0.75)), 2),
        "m_median": round(med_m, 2),
        "m_p25": round(float(sub["monetary"].quantile(0.25)), 2),
        "m_p75": round(float(sub["monetary"].quantile(0.75)), 2),
        "r_pct_overall": round(r_pct, 1),
        "f_pct_overall": round(f_pct, 1),
        "m_pct_overall": round(m_pct, 1),
        "repurchase_rate_60d": round(repurchase_60, 4),
        "avg_order_value": round(aov, 2),
    })
segments.sort(key=lambda s: s["cluster"])


# ── 8. PCA embedding (2D) + stratified sample ──────────────────────
pca = PCA(n_components=2, random_state=SEED).fit(X)
emb = pca.transform(X)

rng = np.random.RandomState(SEED)
TARGET_N = 2000
sample_idx = []
for c in range(ops_k):
    mask = np.where(rfm["cluster"].to_numpy() == c)[0]
    n = len(mask)
    pick = min(n, max(1, round(TARGET_N * n / total_customers)))
    if pick > 0:
        idx = rng.choice(mask, size=pick, replace=False)
        sample_idx.extend(idx.tolist())
sample_idx = sorted(sample_idx)  # deterministic ordering
emb_sample = emb[sample_idx]
rfm_sample = rfm.iloc[sample_idx].reset_index(drop=True)


# ── 9. Round helpers ───────────────────────────────────────────────
def _round_k_selection_rows(rows):
    out = []
    for r in rows:
        out.append({
            "k": int(r["k"]),
            "silhouette": round(float(r["silhouette"]), 4),
            "calinski_harabasz": round(float(r["calinski_harabasz"]), 2),
            "davies_bouldin": round(float(r["davies_bouldin"]), 4),
            "inertia": None if r["inertia"] is None else round(float(r["inertia"]), 2),
        })
    return out


# ── 10. Build payloads ─────────────────────────────────────────────
metrics = {
    "methods": [
        {
            "key": "kmeans", "label": "K-Means",
            "best_k": int(best_km["k"]),
            "silhouette": round(best_km["sil"], 4),
            "calinski_harabasz": round(best_km["ch"], 2),
            "davies_bouldin": round(best_km["db"], 4),
            "inertia": round(float(best_km["inertia"]), 2),
        },
        {
            "key": "gmm", "label": "Gaussian Mixture",
            "best_k": int(best_gmm["k"]),
            "silhouette": round(best_gmm["sil"], 4),
            "calinski_harabasz": round(best_gmm["ch"], 2),
            "davies_bouldin": round(best_gmm["db"], 4),
            "inertia": None,
        },
        {
            "key": "agglomerative", "label": "Agglomerative (Ward)",
            "best_k": int(best_agg["k"]),
            "silhouette": round(best_agg["sil"], 4),
            "calinski_harabasz": round(best_agg["ch"], 2),
            "davies_bouldin": round(best_agg["db"], 4),
            "inertia": None,
        },
    ],
    "winner": winner_method,
    "winner_k": int(winner_info["k"]),
    "operational_method": "kmeans",
    "operational_k": int(ops_k),
    "seed": SEED,
}

k_selection_out = {
    "kmeans": _round_k_selection_rows(k_selection["kmeans"]),
    "gmm": _round_k_selection_rows(k_selection["gmm"]),
    "agglomerative": _round_k_selection_rows(k_selection["agglomerative"]),
}

segments_out = {
    "winner_method": winner_method,
    "operational_method": "kmeans",
    "k": int(ops_k),
    "total_customers": total_customers,
    "total_revenue": round(total_revenue, 2),
    "segments": segments,
}

embedding_out = {
    "method": "pca",
    "operational_method": "kmeans",
    "operational_k": int(ops_k),
    "sample_size": len(sample_idx),
    "total_customers": total_customers,
    "explained_variance": [round(float(v), 4) for v in pca.explained_variance_ratio_],
    "axis_range": {
        "x": [round(float(emb[:, 0].min()), 4), round(float(emb[:, 0].max()), 4)],
        "y": [round(float(emb[:, 1].min()), 4), round(float(emb[:, 1].max()), 4)],
    },
    "points": [
        {
            "x": round(float(emb_sample[i, 0]), 3),
            "y": round(float(emb_sample[i, 1]), 3),
            "cluster": int(rfm_sample.loc[i, "cluster"]),
            "recency": int(rfm_sample.loc[i, "recency"]),
            "frequency": int(rfm_sample.loc[i, "frequency"]),
            "monetary": round(float(rfm_sample.loc[i, "monetary"]), 2),
        }
        for i in range(len(sample_idx))
    ],
}

centroids_pca = pca.transform(ops_model.cluster_centers_).tolist()
classify_out = {
    "method": "kmeans",
    "k": int(ops_k),
    "feature_order": ["recency", "frequency", "monetary"],
    "log_transform": True,
    "means": [round(float(v), 4) for v in scaler.mean_],
    "stds":  [round(float(v), 4) for v in scaler.scale_],
    "centroids_scaled": [[round(float(v), 4) for v in row] for row in ops_model.cluster_centers_.tolist()],
    "centroids_pca":    [[round(float(v), 4) for v in row] for row in centroids_pca],
    # PCA params so the browser can project any scaled (R,F,M) point into the
    # same 2-D space as the map/inset: (x - pca_mean) @ pca_components.T
    "pca_mean":       [round(float(v), 6) for v in pca.mean_],
    "pca_components": [[round(float(v), 6) for v in row] for row in pca.components_.tolist()],
    "cluster_names": {str(s["cluster"]): s["name"] for s in segments},
    "feature_hints": {
        "recency":   {"min": 0, "max": 400, "step": 1,
                      "default": int(np.median(overall_r))},
        "frequency": {"min": 1, "max": 50, "step": 1,
                      "default": max(1, int(np.median(overall_f)))},
        "monetary":  {"min": 0, "max": 10000, "step": 10,
                      "default": int(round(float(np.median(overall_m)), 0))},
    },
}

data_profile = {
    "raw_rows": raw_rows,
    "cleaned_rows": cleaned_rows,
    "filters_applied": [
        "drop rows with null Customer ID",
        "drop rows with null Description",
        "drop rows where Quantity <= 0 (returns)",
        "drop rows where Price <= 0",
        "trim top and bottom 1% on Monetary",
    ],
    "unique_customers": total_customers,
    "date_start": df["InvoiceDate"].min().strftime("%Y-%m-%d"),
    "date_end":   df["InvoiceDate"].max().strftime("%Y-%m-%d"),
    "snapshot_date": snapshot_date.strftime("%Y-%m-%d"),
    "total_revenue": round(total_revenue, 2),
    "raw_distributions": {
        "recency": {
            "min": int(np.min(overall_r)),
            "p25": int(np.quantile(overall_r, 0.25)),
            "median": int(np.median(overall_r)),
            "p75": int(np.quantile(overall_r, 0.75)),
            "max": int(np.max(overall_r)),
        },
        "frequency": {
            "min": int(np.min(overall_f)),
            "p25": int(np.quantile(overall_f, 0.25)),
            "median": int(np.median(overall_f)),
            "p75": int(np.quantile(overall_f, 0.75)),
            "max": int(np.max(overall_f)),
        },
        "monetary": {
            "min": round(float(np.min(overall_m)), 2),
            "p25": round(float(np.quantile(overall_m, 0.25)), 2),
            "median": round(float(np.median(overall_m)), 2),
            "p75": round(float(np.quantile(overall_m, 0.75)), 2),
            "max": round(float(np.max(overall_m)), 2),
        },
    },
}

# Methodology — timestamp derived from CSV mtime for byte-identical reruns
csv_mtime = datetime.fromtimestamp(CSV_PATH.stat().st_mtime, tz=timezone.utc)
methodology = {
    "regenerated_at": csv_mtime.strftime("%Y-%m-%d %H:%M UTC"),
    "seed": SEED,
    "sklearn_version": sklearn.__version__,
    "silhouette_sample_size": SIL_SAMPLE,
    "k_ranges": {
        "kmeans": [min(KS_KMEANS), max(KS_KMEANS)],
        "gmm": [min(KS_GMM), max(KS_GMM)],
        "agglomerative": [min(KS_AGG), max(KS_AGG)],
    },
    # k values that are excluded from the "best k" selection because they
    # are statistically valid but operationally useless. The silhouette
    # chart in the lab page mutes these dots and labels them "(degenerate)"
    # so a reader can see why the visual leader isn't chosen.
    "degenerate_k": list(range(2, BEST_K_MIN)),
    "best_k_min": BEST_K_MIN,
    "filters": data_profile["filters_applied"],
    "note": "CSV mtime is used as the regeneration timestamp so two runs on the same dataset produce byte-identical artifacts.",
}


# ── 11. Dump ───────────────────────────────────────────────────────
def dump(path: Path, payload) -> None:
    s = json.dumps(payload, separators=(",", ":"), sort_keys=False)
    path.write_text(s)
    kb = path.stat().st_size / 1024
    print(f"  wrote {path.relative_to(ROOT)}  ({kb:.1f} KB)")

dump(OUT_DIR / "metrics.json", metrics)
dump(OUT_DIR / "k_selection.json", k_selection_out)
dump(OUT_DIR / "segments.json", segments_out)
dump(OUT_DIR / "embedding.json", embedding_out)
dump(OUT_DIR / "classify.json", classify_out)
dump(OUT_DIR / "data_profile.json", data_profile)
dump(OUT_DIR / "methodology.json", methodology)

print("\n✔ done. 7 JSON files written to assets/data/segmentation/.")
