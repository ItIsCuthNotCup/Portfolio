"""
logistic_regression_model.py

Reference implementation of the in-browser logistic regression
demonstrated at /work/logistic-regression-lab/. Same update rule,
same loss, same L2-on-weights-only convention as the JS. The JS
in assets/js/logistic-regression-lab.js converges to the same
weights as this script, to within four decimal places, on the
same toy dataset.

Run:
    python3 logistic_regression_model.py

Dependencies:
    numpy
"""

from __future__ import annotations

import numpy as np


def sigmoid(z: np.ndarray) -> np.ndarray:
    """Numerically stable sigmoid."""
    out = np.empty_like(z, dtype=float)
    pos = z >= 0
    out[pos] = 1.0 / (1.0 + np.exp(-z[pos]))
    ez = np.exp(z[~pos])
    out[~pos] = ez / (1.0 + ez)
    return out


def log_loss(y: np.ndarray, p: np.ndarray, eps: float = 1e-7) -> float:
    """Average binary cross-entropy."""
    p = np.clip(p, eps, 1 - eps)
    return float(-(y * np.log(p) + (1 - y) * np.log(1 - p)).mean())


def fit(
    X: np.ndarray,
    y: np.ndarray,
    lr: float = 0.30,
    l2: float = 0.005,
    n_iter: int = 4000,
    seed: int = 0,
) -> tuple[np.ndarray, list[float]]:
    """
    Fit logistic regression by full-batch gradient descent.

    X : (n, 2) features in [-1, 1].
    y : (n,) labels in {0, 1}.
    lr : learning rate.
    l2 : L2 penalty applied to weights only (not bias).

    Returns (weights, loss_history) where weights has shape (3,)
    laid out as [bias, w1, w2] to match the JS state.
    """
    rng = np.random.default_rng(seed)
    w = rng.uniform(-0.1, 0.1, size=3)  # [bias, w1, w2]

    n = X.shape[0]
    history: list[float] = []
    for _ in range(n_iter):
        z = w[0] + X @ w[1:]
        p = sigmoid(z)
        err = p - y
        g0 = err.mean()
        gw = (err[:, None] * X).mean(axis=0)
        # L2 on weights only
        gw = gw + l2 * w[1:]
        w[0] -= lr * g0
        w[1:] -= lr * gw
        history.append(log_loss(y, p))
    return w, history


def make_blobs(n_per: int = 30, sd: float = 0.18, seed: int = 1) -> tuple[np.ndarray, np.ndarray]:
    """The 'blobs' preset on the lab page: two well-separated Gaussians."""
    rng = np.random.default_rng(seed)
    pos = rng.normal(loc=[-0.45, 0.30], scale=sd, size=(n_per, 2))
    neg = rng.normal(loc=[0.45, -0.30], scale=sd, size=(n_per, 2))
    X = np.vstack([pos, neg])
    y = np.concatenate([np.ones(n_per), np.zeros(n_per)])
    return X, y


def accuracy(y: np.ndarray, p: np.ndarray) -> float:
    return float(((p >= 0.5).astype(int) == y).mean())


def main() -> None:
    X, y = make_blobs()
    w, hist = fit(X, y)
    p = sigmoid(w[0] + X @ w[1:])
    print(f"final weights: bias={w[0]:+.4f}  w1={w[1]:+.4f}  w2={w[2]:+.4f}")
    print(f"final loss:    {hist[-1]:.4f}")
    print(f"accuracy:      {accuracy(y, p) * 100:.1f}%")
    print(f"iterations:    {len(hist)}")
    # Sanity check: the boundary sign of (w1 / w2) should slope from
    # upper-left (positive blob center) to lower-right (negative
    # blob center). For our blob centers, w1 should be negative
    # (positive class is at x = -0.45), w2 should be positive.
    assert w[1] < 0, "expected w1 < 0 for positive class to the left"
    assert w[2] > 0, "expected w2 > 0 for positive class above"
    print("sanity:        boundary slope orientation matches expected")


if __name__ == "__main__":
    main()
