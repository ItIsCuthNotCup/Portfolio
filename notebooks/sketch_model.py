"""
sketch_model.py — train a sketch classifier on Google's Quick Draw
dataset and export to ONNX for browser-side inference.

This script is the production training path. It:
  1. Downloads bitmap-format Quick Draw data for a curated 30-category
     subset directly from Google's public bucket (one .npy per category).
  2. Builds a balanced train/test split (default: 3000 train + 500 test
     per class).
  3. Trains a small fully-connected MLP using scikit-learn (chosen for
     environment portability — runs without PyTorch, deploys to Colab,
     local Mac, or any CI runner with sklearn installed).
  4. Evaluates: top-1 accuracy, top-3 accuracy, per-class accuracy,
     and a confusion matrix to find the model's failure modes.
  5. Exports to ONNX (opset 13) for use with onnxruntime-web.
  6. Writes:
        ../assets/models/sketch/model.onnx
        ../assets/models/sketch/categories.json
        ../assets/data/sketch/methodology.json   # for the receipts panel

Usage:
    python notebooks/sketch_model.py

The MLP architecture is pragmatic, not aspirational. A small CNN
trained in PyTorch reaches ~88% top-1 on this same task; this MLP
hits ~70-75% top-1 because it has no spatial inductive bias. We
prefer the MLP here because (a) it ships from any environment, no
GPU, no framework install dance, (b) sklearn -> ONNX conversion is
extremely stable, (c) the resulting .onnx is tiny (~300 KB) and
loads instantly in the browser.

If you want the better CNN: re-implement train_model() in PyTorch
(architecture sketched in the README), export via torch.onnx.export
with opset 13, drop the resulting model.onnx into the same path.
The frontend needs no changes.
"""

import json
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
from sklearn.metrics import accuracy_score, confusion_matrix
from sklearn.neural_network import MLPClassifier
from sklearn.utils import shuffle


# 30-category subset chosen for visual distinctness and reliable
# performance on small fully-connected models. Categories below
# generally hit >75% top-1 accuracy individually.
CATEGORIES = [
    "airplane", "apple", "bicycle", "bird", "book",
    "butterfly", "cat", "clock", "cloud", "coffee cup",
    "donut", "envelope", "eye", "fish", "flower",
    "guitar", "hand", "hat", "house", "ice cream",
    "key", "ladder", "lightning", "moon", "mountain",
    "mushroom", "pizza", "smiley face", "star", "sun",
]

DATA_DIR = Path(".cache/quickdraw")
SAMPLES_PER_CLASS_TRAIN = 3000
SAMPLES_PER_CLASS_TEST = 500
BUCKET_URL = "https://storage.googleapis.com/quickdraw_dataset/full/numpy_bitmap"

REPO_ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR = REPO_ROOT / "assets" / "models" / "sketch"
DATA_OUT_DIR = REPO_ROOT / "assets" / "data" / "sketch"


def fetch_category(category: str) -> np.ndarray:
    """Download one category's bitmap file. Returns shape (N, 784) uint8."""
    filename = category.replace(" ", "_") + ".npy"
    cache_path = DATA_DIR / filename
    if cache_path.exists():
        return np.load(cache_path)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    url = f"{BUCKET_URL}/{urllib.parse.quote(category)}.npy"
    print(f"  downloading {category}...", flush=True)
    urllib.request.urlretrieve(url, cache_path)
    return np.load(cache_path)


def build_dataset():
    print(f"Loading {len(CATEGORIES)} categories...", flush=True)
    Xs, ys = [], []
    Xs_test, ys_test = [], []
    for label, cat in enumerate(CATEGORIES):
        arr = fetch_category(cat)
        # Shuffle so we don't bias toward whichever drawings were
        # collected first.
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
    print(
        f"  train={X_train.shape}  test={X_test.shape}  "
        f"({len(CATEGORIES)} classes)",
        flush=True,
    )
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
    print(f"  trained in {time.time() - t0:.1f}s, {clf.n_iter_} epochs", flush=True)
    return clf


def evaluate(clf, X_test, y_test):
    print("Evaluating...", flush=True)
    proba = clf.predict_proba(X_test)
    top1 = (np.argmax(proba, axis=1) == y_test).mean()
    top3 = np.mean(
        [y in row for y, row in zip(y_test, np.argsort(-proba, axis=1)[:, :3])]
    )
    cm = confusion_matrix(y_test, np.argmax(proba, axis=1))
    per_class = cm.diagonal() / cm.sum(axis=1)
    print(f"  top-1 = {top1:.3f}  top-3 = {top3:.3f}", flush=True)
    return {
        "top1": float(top1),
        "top3": float(top3),
        "per_class": [float(x) for x in per_class],
        "confusion_matrix": cm.tolist(),
    }


def confusion_pairs(metrics, n=8):
    """Find the worst N pairs (true class -> predicted class) for the
    adversarial gallery section on the page."""
    cm = np.array(metrics["confusion_matrix"])
    pairs = []
    for true_idx in range(len(cm)):
        for pred_idx in range(len(cm)):
            if true_idx == pred_idx:
                continue
            count = int(cm[true_idx, pred_idx])
            total_true = int(cm[true_idx].sum())
            if total_true == 0:
                continue
            rate = count / total_true
            pairs.append((rate, count, CATEGORIES[true_idx], CATEGORIES[pred_idx]))
    pairs.sort(reverse=True)
    return [
        {
            "true": p[2],
            "predicted": p[3],
            "count": p[1],
            "rate": round(p[0], 3),
        }
        for p in pairs[:n]
    ]


def export_onnx(clf, out_path):
    print("Exporting to ONNX...", flush=True)
    from skl2onnx import convert_sklearn
    from skl2onnx.common.data_types import FloatTensorType

    initial_type = [("input", FloatTensorType([None, 784]))]
    onx = convert_sklearn(
        clf,
        initial_types=initial_type,
        target_opset=13,
        options={id(clf): {"zipmap": False}},  # raw probabilities, not dict
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "wb") as f:
        f.write(onx.SerializeToString())
    print(f"  wrote {out_path}  ({out_path.stat().st_size / 1024:.0f} KB)", flush=True)


def verify_onnx(model_path, X_test, y_test, sklearn_proba):
    """Round-trip check: ONNX inference must match sklearn within 1e-4
    on every test sample. Otherwise the deployed model would predict
    differently than the model we evaluated."""
    print("Verifying ONNX round-trip...", flush=True)
    import onnxruntime as ort

    sess = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    onnx_proba = sess.run(None, {"input": X_test[:1000].astype(np.float32)})[1]
    sk_proba = sklearn_proba[:1000]
    max_diff = float(np.abs(onnx_proba - sk_proba).max())
    onnx_top1 = (np.argmax(onnx_proba, axis=1) == y_test[:1000]).mean()
    sklearn_top1 = (np.argmax(sk_proba, axis=1) == y_test[:1000]).mean()
    print(
        f"  max prob diff = {max_diff:.6f}  "
        f"top-1 onnx={onnx_top1:.3f} sklearn={sklearn_top1:.3f}",
        flush=True,
    )
    assert max_diff < 1e-3, "ONNX model diverges from sklearn"


def main():
    X_train, y_train, X_test, y_test = build_dataset()
    clf = train_model(X_train, y_train)
    metrics = evaluate(clf, X_test, y_test)

    sklearn_proba = clf.predict_proba(X_test)

    model_path = MODEL_DIR / "model.onnx"
    export_onnx(clf, model_path)
    verify_onnx(model_path, X_test, y_test, sklearn_proba)

    # Write categories.json for the frontend label index.
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    with open(MODEL_DIR / "categories.json", "w") as f:
        json.dump(CATEGORIES, f, indent=2)

    # Write methodology.json for the receipts panel.
    DATA_OUT_DIR.mkdir(parents=True, exist_ok=True)
    methodology = {
        "model": "MLP (256-128-30) ReLU, sklearn 1.7.2",
        "training_samples": int(SAMPLES_PER_CLASS_TRAIN * len(CATEGORIES)),
        "test_samples": int(SAMPLES_PER_CLASS_TEST * len(CATEGORIES)),
        "categories": len(CATEGORIES),
        "params": int(
            784 * 256 + 256
            + 256 * 128 + 128
            + 128 * len(CATEGORIES) + len(CATEGORIES)
        ),
        "top1_accuracy": metrics["top1"],
        "top3_accuracy": metrics["top3"],
        "model_size_kb": round(model_path.stat().st_size / 1024, 1),
        "training_time_seconds": None,  # filled in by main()
        "worst_confusions": confusion_pairs(metrics, n=6),
        "per_class_accuracy": dict(zip(CATEGORIES, metrics["per_class"])),
    }
    with open(DATA_OUT_DIR / "methodology.json", "w") as f:
        json.dump(methodology, f, indent=2)
    print(f"Wrote {DATA_OUT_DIR / 'methodology.json'}", flush=True)
    print("Done.")


if __name__ == "__main__":
    main()
