"""
TEMPLATE — copy to notebooks/{{slug}}_model.py and adapt.

This is the training pipeline scaffolding used by ML-backed labs.
It writes:
    assets/models/{{slug}}/model.onnx
    assets/models/{{slug}}/categories.json
    assets/data/{{slug}}/methodology.json

Constraints (see references/ml-pipeline.md):
- Sandbox-runnable: no PyTorch (out of disk space). Use sklearn.
- skl2onnx for export. Verify ONNX round-trip vs sklearn.
- Cache raw data in .cache/{{slug}}/ (gitignored).
"""

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
from sklearn.metrics import accuracy_score, confusion_matrix
from sklearn.neural_network import MLPClassifier
from sklearn.utils import shuffle


# ── Configure ────────────────────────────────────────────────
SLUG = "{{slug}}"
DATA_DIR = Path(".cache") / SLUG
SAMPLES_PER_CLASS_TRAIN = 3000
SAMPLES_PER_CLASS_TEST = 500

REPO_ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR = REPO_ROOT / "assets" / "models" / SLUG
DATA_OUT_DIR = REPO_ROOT / "assets" / "data" / SLUG

# Define your category list. Each entry must be visually/feature-
# distinguishable from the others or accuracy will collapse.
CATEGORIES = [
    # "category1", "category2", ...
]


def fetch_class_data(category: str) -> np.ndarray:
    """Replace with your data source. Should return shape (N, n_features)
    of uint8 or float32, one row per sample."""
    raise NotImplementedError("Replace with your data fetch logic.")


def build_dataset():
    print(f"Loading {len(CATEGORIES)} categories...", flush=True)
    Xs, ys, Xs_test, ys_test = [], [], [], []
    for label, cat in enumerate(CATEGORIES):
        arr = fetch_class_data(cat)
        rng = np.random.default_rng(42 + label)
        idx = rng.permutation(len(arr))
        train_idx = idx[:SAMPLES_PER_CLASS_TRAIN]
        test_idx = idx[SAMPLES_PER_CLASS_TRAIN : SAMPLES_PER_CLASS_TRAIN + SAMPLES_PER_CLASS_TEST]
        Xs.append(arr[train_idx])
        ys.append(np.full(len(train_idx), label, dtype=np.int64))
        Xs_test.append(arr[test_idx])
        ys_test.append(np.full(len(test_idx), label, dtype=np.int64))

    X_train = np.concatenate(Xs).astype(np.float32) / 255.0
    y_train = np.concatenate(ys)
    X_test = np.concatenate(Xs_test).astype(np.float32) / 255.0
    y_test = np.concatenate(ys_test)
    X_train, y_train = shuffle(X_train, y_train, random_state=0)
    print(f"  train={X_train.shape}  test={X_test.shape}", flush=True)
    return X_train, y_train, X_test, y_test


def train_model(X_train, y_train):
    print("Training MLP...", flush=True)
    t0 = time.time()
    clf = MLPClassifier(
        hidden_layer_sizes=(256, 128),
        activation="relu",
        solver="adam",
        alpha=1e-4,
        batch_size=256,
        learning_rate_init=1e-3,
        max_iter=20,
        early_stopping=True,
        validation_fraction=0.1,
        n_iter_no_change=4,
        verbose=False,
        random_state=42,
    )
    clf.fit(X_train, y_train)
    elapsed = time.time() - t0
    print(f"  trained in {elapsed:.1f}s, {clf.n_iter_} epochs", flush=True)
    return clf, elapsed


def evaluate(clf, X_test, y_test):
    print("Evaluating...", flush=True)
    proba = clf.predict_proba(X_test)
    top1 = float((np.argmax(proba, axis=1) == y_test).mean())
    top3 = float(np.mean([y in row for y, row in zip(y_test, np.argsort(-proba, axis=1)[:, :3])]))
    cm = confusion_matrix(y_test, np.argmax(proba, axis=1))
    per_class = (cm.diagonal() / cm.sum(axis=1)).tolist()
    print(f"  top-1 = {top1:.3f}  top-3 = {top3:.3f}", flush=True)
    return {
        "top1": top1,
        "top3": top3,
        "per_class": per_class,
        "confusion_matrix": cm.tolist(),
    }


def confusion_pairs(metrics, n=8):
    cm = np.array(metrics["confusion_matrix"])
    pairs = []
    for true_idx in range(len(cm)):
        total_true = int(cm[true_idx].sum())
        if total_true == 0: continue
        for pred_idx in range(len(cm)):
            if true_idx == pred_idx: continue
            count = int(cm[true_idx, pred_idx])
            if count == 0: continue
            pairs.append((count / total_true, count, CATEGORIES[true_idx], CATEGORIES[pred_idx]))
    pairs.sort(reverse=True)
    return [
        {"true": p[2], "predicted": p[3], "count": p[1], "rate": round(p[0], 3)}
        for p in pairs[:n]
    ]


def export_onnx(clf, n_features, out_path):
    print("Exporting to ONNX...", flush=True)
    from skl2onnx import convert_sklearn
    from skl2onnx.common.data_types import FloatTensorType

    initial_type = [("input", FloatTensorType([None, n_features]))]
    onx = convert_sklearn(
        clf, initial_types=initial_type, target_opset=13,
        options={id(clf): {"zipmap": False}},
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "wb") as f:
        f.write(onx.SerializeToString())
    size_kb = out_path.stat().st_size / 1024
    print(f"  wrote {out_path}  ({size_kb:.0f} KB)", flush=True)
    return size_kb


def verify_onnx(model_path, X_test, sklearn_proba):
    import onnxruntime as ort
    print("Verifying ONNX round-trip...", flush=True)
    sess = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    onnx_proba = sess.run(None, {"input": X_test[:1000].astype(np.float32)})[1]
    max_diff = float(np.abs(onnx_proba - sklearn_proba[:1000]).max())
    print(f"  max prob diff = {max_diff:.6f}", flush=True)
    assert max_diff < 1e-3, "ONNX model diverges from sklearn"


def main():
    X_train, y_train, X_test, y_test = build_dataset()
    clf, train_seconds = train_model(X_train, y_train)
    metrics = evaluate(clf, X_test, y_test)
    sklearn_proba = clf.predict_proba(X_test)

    n_features = X_train.shape[1]
    model_path = MODEL_DIR / "model.onnx"
    size_kb = export_onnx(clf, n_features, model_path)
    verify_onnx(model_path, X_test, sklearn_proba)

    # categories.json — frontend label index
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    with open(MODEL_DIR / "categories.json", "w") as f:
        json.dump(CATEGORIES, f, indent=2)

    # methodology.json — receipts panel
    DATA_OUT_DIR.mkdir(parents=True, exist_ok=True)
    methodology = {
        "model": "MLP (256-128-N) ReLU, sklearn",
        "training_samples": int(SAMPLES_PER_CLASS_TRAIN * len(CATEGORIES)),
        "test_samples": int(SAMPLES_PER_CLASS_TEST * len(CATEGORIES)),
        "categories": len(CATEGORIES),
        "params": int(
            n_features * 256 + 256
            + 256 * 128 + 128
            + 128 * len(CATEGORIES) + len(CATEGORIES)
        ),
        "top1_accuracy": metrics["top1"],
        "top3_accuracy": metrics["top3"],
        "model_size_kb": round(size_kb, 1),
        "training_time_seconds": round(train_seconds, 1),
        "worst_confusions": confusion_pairs(metrics, n=6),
        "per_class_accuracy": dict(zip(CATEGORIES, metrics["per_class"])),
    }
    with open(DATA_OUT_DIR / "methodology.json", "w") as f:
        json.dump(methodology, f, indent=2)
    print(f"Wrote {DATA_OUT_DIR / 'methodology.json'}", flush=True)
    print("Done.")


if __name__ == "__main__":
    main()
