"""
churn_model.py — reproducible churn-model pipeline for the Kaggle
"Churn Modelling" dataset. Generates all JSON artifacts consumed by
/work/churn-lab/ on the portfolio site.

Run:
    python notebooks/churn_model.py

Inputs:
    data/bank_churn.csv

Outputs (written to assets/data/churn/):
    metrics.json
    roc_curves.json
    pr_curves.json
    predictions.json
    shap_summary.json
    lr_scoring.json
    fairness.json
    threshold_sweep.json
    data_profile.json
"""

from __future__ import annotations

import json
import os
import random
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, average_precision_score,
    roc_curve, precision_recall_curve, confusion_matrix,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier
import shap

# ── Paths & reproducibility ────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "data" / "bank_churn.csv"
OUT_DIR = ROOT / "assets" / "data" / "churn"
OUT_DIR.mkdir(parents=True, exist_ok=True)

SEED = 42
random.seed(SEED)
np.random.seed(SEED)

NUMERIC_FEATURES = [
    "CreditScore", "Age", "Tenure", "Balance",
    "NumOfProducts", "EstimatedSalary",
]
BINARY_FEATURES = ["HasCrCard", "IsActiveMember", "Gender"]  # Gender label-encoded
GEO_FEATURES = ["Geography_Germany", "Geography_Spain"]      # France = baseline
FEATURE_ORDER = NUMERIC_FEATURES + BINARY_FEATURES + GEO_FEATURES


# ── Helpers ────────────────────────────────────────────────────────
def dump(path: Path, payload) -> None:
    path.write_text(json.dumps(payload, separators=(",", ":")))
    kb = path.stat().st_size / 1024
    print(f"  wrote {path.relative_to(ROOT)}  ({kb:.1f} KB)")


def round_list(arr, n=5):
    """Round floats and sanitize inf/nan (sklearn roc_curve returns inf for the
    first threshold, which crashes JSON.parse on the browser side)."""
    out = []
    for v in arr:
        v = float(v)
        if np.isinf(v):
            v = 1.0 if v > 0 else 0.0
        elif np.isnan(v):
            v = 0.0
        out.append(round(v, n))
    return out


# ── 1. Load & preprocess ───────────────────────────────────────────
print(f"Loading {CSV_PATH.relative_to(ROOT)} …")
df = pd.read_csv(CSV_PATH)
df = df.drop(columns=["RowNumber", "CustomerId", "Surname"])

# Label-encode Gender (Female=0, Male=1) — deterministic
df["Gender"] = (df["Gender"] == "Male").astype(int)

# One-hot Geography (France as baseline)
geo_dummies = pd.get_dummies(df["Geography"], prefix="Geography")
for col in ["Geography_France", "Geography_Germany", "Geography_Spain"]:
    if col not in geo_dummies.columns:
        geo_dummies[col] = 0
df = pd.concat(
    [df.drop(columns=["Geography"]), geo_dummies[["Geography_Germany", "Geography_Spain"]]],
    axis=1,
)

# Cast booleans to int so downstream joins are clean
for col in BINARY_FEATURES + GEO_FEATURES:
    df[col] = df[col].astype(int)

# Keep raw Geography/Gender labels for the fairness audit
df_raw = pd.read_csv(CSV_PATH)[["Geography", "Gender"]]

y = df["Exited"].astype(int).values
X_df = df[FEATURE_ORDER].copy()

# Stratified 80/20 split
X_train_df, X_test_df, y_train, y_test, idx_train, idx_test = train_test_split(
    X_df, y, np.arange(len(df)),
    test_size=0.20, stratify=y, random_state=SEED,
)

# StandardScaler on numeric only
scaler = StandardScaler()
X_train = X_train_df.copy()
X_test = X_test_df.copy()
X_train[NUMERIC_FEATURES] = scaler.fit_transform(X_train[NUMERIC_FEATURES])
X_test[NUMERIC_FEATURES] = scaler.transform(X_test[NUMERIC_FEATURES])

numeric_means = dict(zip(NUMERIC_FEATURES, scaler.mean_.tolist()))
numeric_stds = dict(zip(NUMERIC_FEATURES, scaler.scale_.tolist()))

print(f"  n_total={len(df)}  n_train={len(X_train)}  n_test={len(X_test)}")
print(f"  class balance: churned={y.mean():.3f}")


# ── 2. Train models ────────────────────────────────────────────────
print("\nTraining models …")

lr = LogisticRegression(class_weight="balanced", max_iter=1000, random_state=SEED)
lr.fit(X_train.values, y_train)

rf = RandomForestClassifier(
    n_estimators=300, class_weight="balanced",
    random_state=SEED, n_jobs=-1,
)
rf.fit(X_train.values, y_train)

# scale_pos_weight from train set class imbalance (~3.9 for this dataset)
pos_ratio = (y_train == 0).sum() / max(1, (y_train == 1).sum())
xgb = XGBClassifier(
    n_estimators=300, max_depth=5, learning_rate=0.08,
    scale_pos_weight=pos_ratio,
    random_state=SEED, eval_metric="logloss",
    tree_method="hist", n_jobs=-1,
)
xgb.fit(X_train.values, y_train)

models = {"lr": lr, "rf": rf, "xgb": xgb}
model_labels = {"lr": "Logistic Regression", "rf": "Random Forest", "xgb": "XGBoost"}


# ── 3. Metrics ─────────────────────────────────────────────────────
print("\nScoring …")

def score(model, X, y_true, y_pred_threshold=0.5):
    proba = model.predict_proba(X.values if hasattr(X, "values") else X)[:, 1]
    pred = (proba >= y_pred_threshold).astype(int)
    return {
        "accuracy":  accuracy_score(y_true, pred),
        "precision": precision_score(y_true, pred, zero_division=0),
        "recall":    recall_score(y_true, pred, zero_division=0),
        "f1":        f1_score(y_true, pred, zero_division=0),
        "roc_auc":   roc_auc_score(y_true, proba),
        "pr_auc":    average_precision_score(y_true, proba),
        "confusion": confusion_matrix(y_true, pred).tolist(),
        "proba":     proba,
        "pred":      pred,
    }

scored = {k: score(m, X_test, y_test) for k, m in models.items()}
for k, s in scored.items():
    print(f"  {k:3s}  acc={s['accuracy']:.3f}  f1={s['f1']:.3f}  "
          f"auc={s['roc_auc']:.3f}  pr_auc={s['pr_auc']:.3f}")


# ── metrics.json ──
metrics_payload = {
    "models": [
        {
            "key": k,
            "label": model_labels[k],
            "accuracy":  round(s["accuracy"], 4),
            "precision": round(s["precision"], 4),
            "recall":    round(s["recall"], 4),
            "f1":        round(s["f1"], 4),
            "roc_auc":   round(s["roc_auc"], 4),
            "pr_auc":    round(s["pr_auc"], 4),
            "confusion": s["confusion"],
        }
        for k, s in scored.items()
    ],
    "seed": SEED,
    "test_size": len(y_test),
}
dump(OUT_DIR / "metrics.json", metrics_payload)


# ── 4. ROC / PR curves ─────────────────────────────────────────────
def thin(xs, ys, n=100):
    """Downsample curve arrays to ~n points, preserving endpoints."""
    xs = np.asarray(xs); ys = np.asarray(ys)
    if len(xs) <= n:
        return xs.tolist(), ys.tolist()
    idx = np.linspace(0, len(xs) - 1, n).astype(int)
    idx = np.unique(idx)
    return xs[idx].tolist(), ys[idx].tolist()

roc_payload = {"models": []}
pr_payload = {"models": []}
for k, s in scored.items():
    fpr, tpr, thr = roc_curve(y_test, s["proba"])
    # thin and bring along thresholds
    idx = np.linspace(0, len(fpr) - 1, 100).astype(int)
    idx = np.unique(idx)
    roc_payload["models"].append({
        "key": k, "label": model_labels[k],
        "fpr": round_list(fpr[idx]),
        "tpr": round_list(tpr[idx]),
        "thr": round_list(thr[idx]),
    })
    p, r, thr2 = precision_recall_curve(y_test, s["proba"])
    idx2 = np.linspace(0, len(p) - 1, 100).astype(int)
    idx2 = np.unique(idx2)
    thr2_padded = np.concatenate([thr2, [1.0]])  # precision_recall_curve returns n-1 thresholds
    pr_payload["models"].append({
        "key": k, "label": model_labels[k],
        "precision": round_list(p[idx2]),
        "recall":    round_list(r[idx2]),
        "thr":       round_list(thr2_padded[idx2]),
    })
dump(OUT_DIR / "roc_curves.json", roc_payload)
dump(OUT_DIR / "pr_curves.json", pr_payload)


# ── 5. Best model + predictions.json ───────────────────────────────
# Pick best by ROC-AUC
best_key = max(scored, key=lambda k: scored[k]["roc_auc"])
print(f"\nBest model by ROC-AUC: {best_key} ({model_labels[best_key]})")

best = scored[best_key]
preds_payload = {
    "best_model": best_key,
    "best_model_label": model_labels[best_key],
    "n": int(len(y_test)),
    "y_true": [int(v) for v in y_test],
    "y_proba": round_list(best["proba"], 4),
}
dump(OUT_DIR / "predictions.json", preds_payload)


# ── 6. LR scoring payload (for live widget) ────────────────────────
lr_coefs = dict(zip(FEATURE_ORDER, lr.coef_[0].tolist()))
lr_payload = {
    "feature_order": FEATURE_ORDER,
    "numeric_features": NUMERIC_FEATURES,
    "means": {k: round(v, 4) for k, v in numeric_means.items()},
    "stds":  {k: round(v, 4) for k, v in numeric_stds.items()},
    "coefficients": {k: round(v, 5) for k, v in lr_coefs.items()},
    "intercept": round(float(lr.intercept_[0]), 5),
    "geography_values": ["France", "Germany", "Spain"],
    "gender_values": ["Female", "Male"],
    "feature_hints": {
        "CreditScore":     {"min": 350, "max": 850,    "step": 1,    "default": 650},
        "Age":             {"min": 18,  "max": 92,     "step": 1,    "default": 38},
        "Tenure":          {"min": 0,   "max": 10,     "step": 1,    "default": 5},
        "Balance":         {"min": 0,   "max": 250000, "step": 100,  "default": 76000},
        "NumOfProducts":   {"min": 1,   "max": 4,      "step": 1,    "default": 1},
        "EstimatedSalary": {"min": 0,   "max": 200000, "step": 100,  "default": 100000},
    },
}
dump(OUT_DIR / "lr_scoring.json", lr_payload)


# ── 7. SHAP on XGBoost ─────────────────────────────────────────────
print("\nComputing SHAP values …")
rng = np.random.RandomState(SEED)
sample_n = min(500, len(X_test))
sample_idx = rng.choice(len(X_test), size=sample_n, replace=False)
X_test_arr = X_test.values
X_sample = X_test_arr[sample_idx]

explainer = shap.TreeExplainer(xgb)
shap_values = explainer.shap_values(X_sample)  # shape (n, n_features)

mean_abs = np.abs(shap_values).mean(axis=0)
feat_importance = sorted(
    [(FEATURE_ORDER[i], float(mean_abs[i])) for i in range(len(FEATURE_ORDER))],
    key=lambda t: t[1], reverse=True,
)

# Top 2 features: emit (raw feature value, shap value) pairs
X_test_raw = X_test_df.values  # pre-scaling (numeric cols are in their natural units)
X_sample_raw = X_test_raw[sample_idx]

top2 = [feat_importance[0][0], feat_importance[1][0]]
dependence = {}
for fname in top2:
    col = FEATURE_ORDER.index(fname)
    pairs = [
        [round(float(X_sample_raw[i, col]), 4), round(float(shap_values[i, col]), 5)]
        for i in range(sample_n)
    ]
    dependence[fname] = pairs

shap_payload = {
    "model": "xgb",
    "feature_order": FEATURE_ORDER,
    "mean_abs_shap": [{"feature": f, "value": round(v, 5)} for f, v in feat_importance],
    "top2_features": top2,
    "dependence": dependence,
    "sample_size": sample_n,
}
dump(OUT_DIR / "shap_summary.json", shap_payload)


# ── 8. Fairness audit on best model ────────────────────────────────
print("\nFairness audit …")
raw_test = df_raw.iloc[idx_test].reset_index(drop=True)
y_proba_best = best["proba"]
y_pred_best = (y_proba_best >= 0.5).astype(int)

def group_stats(mask, label, group_value):
    n = int(mask.sum())
    if n == 0:
        return None
    yt = y_test[mask]; yp = y_pred_best[mask]; pp = y_proba_best[mask]
    return {
        "group":        label,
        "value":        group_value,
        "n":            n,
        "churn_rate":   round(float(yt.mean()), 4),
        "prediction_rate": round(float(yp.mean()), 4),
        "accuracy":     round(float(accuracy_score(yt, yp)), 4),
        "precision":    round(float(precision_score(yt, yp, zero_division=0)), 4),
        "recall":       round(float(recall_score(yt, yp, zero_division=0)), 4),
    }

fairness_rows = []
for geo in ["France", "Germany", "Spain"]:
    mask = (raw_test["Geography"] == geo).values
    r = group_stats(mask, "Geography", geo)
    if r: fairness_rows.append(r)
for g in ["Female", "Male"]:
    mask = (raw_test["Gender"] == g).values
    r = group_stats(mask, "Gender", g)
    if r: fairness_rows.append(r)

fairness_payload = {
    "model": best_key,
    "model_label": model_labels[best_key],
    "threshold": 0.5,
    "rows": fairness_rows,
    "overall": {
        "churn_rate":      round(float(y_test.mean()), 4),
        "prediction_rate": round(float(y_pred_best.mean()), 4),
        "accuracy":        round(float(accuracy_score(y_test, y_pred_best)), 4),
    },
}
dump(OUT_DIR / "fairness.json", fairness_payload)


# ── 9. Threshold sweep on best model ───────────────────────────────
print("\nThreshold sweep …")
thresholds = np.linspace(0.05, 0.95, 20)
sweep_rows = []
for t in thresholds:
    pred = (y_proba_best >= t).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_test, pred).ravel()
    sweep_rows.append({
        "threshold": round(float(t), 3),
        "precision": round(float(precision_score(y_test, pred, zero_division=0)), 4),
        "recall":    round(float(recall_score(y_test, pred, zero_division=0)), 4),
        "tp": int(tp), "fp": int(fp), "tn": int(tn), "fn": int(fn),
    })

sweep_payload = {
    "model": best_key,
    "model_label": model_labels[best_key],
    "rows": sweep_rows,
    "cost_model": {
        "cost_fn": 500,
        "cost_fp": 50,
        "description": "$500 per false negative (missed churner), $50 per false positive (wasted retention spend)."
    },
}
dump(OUT_DIR / "threshold_sweep.json", sweep_payload)


# ── 10. Data profile ───────────────────────────────────────────────
print("\nData profile …")
source = pd.read_csv(CSV_PATH)
profile_payload = {
    "row_count":   int(len(source)),
    "churn_count": int(source["Exited"].sum()),
    "churn_rate":  round(float(source["Exited"].mean()), 4),
    "features": [
        {"name": c, "dtype": str(source[c].dtype)}
        for c in source.columns if c not in {"RowNumber", "CustomerId", "Surname"}
    ],
    "splits": {
        "train": int(len(y_train)),
        "test":  int(len(y_test)),
        "train_churn_rate": round(float(y_train.mean()), 4),
        "test_churn_rate":  round(float(y_test.mean()), 4),
    },
    "numeric_summary": {
        col: {
            "min":  round(float(source[col].min()), 2),
            "max":  round(float(source[col].max()), 2),
            "mean": round(float(source[col].mean()), 2),
            "std":  round(float(source[col].std()), 2),
        } for col in NUMERIC_FEATURES
    },
    "geography_counts": source["Geography"].value_counts().to_dict(),
    "gender_counts":    source["Gender"].value_counts().to_dict(),
    "seed": SEED,
    "regenerated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
}
dump(OUT_DIR / "data_profile.json", profile_payload)


print("\n✔ done. 9 JSON files written to assets/data/churn/.")
