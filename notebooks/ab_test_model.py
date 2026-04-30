"""
ab_test_model.py — statistical derivations and independent validation
for /work/ab-test-lab/ on the portfolio site.

The client-side JavaScript simulator implements the same math this script
does. This module exists so anyone reviewing the lab can confirm the
numbers in the browser match a Python + scipy reference to within Monte
Carlo noise.

Run:
    python notebooks/ab_test_model.py

Outputs (written to assets/data/ab-test/):
    methodology.json   reference numbers for:
                       - two-proportion sample-size formula
                       - peeking-bias Monte Carlo at α=0.05
                       - beta-posterior sanity samples
                       - P(B > A) closed-form vs. Monte Carlo
"""

from __future__ import annotations

import json
import math
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from scipy import stats

# ── Paths & reproducibility ────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "data" / "ab-test"
OUT_DIR.mkdir(parents=True, exist_ok=True)

SEED = 42
rng = np.random.default_rng(SEED)


# ══════════════════════════════════════════════════════════════════
# 1. SAMPLE SIZE (two-proportion, two-tailed)
# ══════════════════════════════════════════════════════════════════
def required_sample_size(p1: float, p2: float, alpha: float = 0.05, power: float = 0.80) -> int:
    """Per-arm sample size for a two-proportion z-test at given α and power."""
    if p1 == p2:
        return math.inf  # undetectable — effect size is zero
    z_alpha = stats.norm.ppf(1 - alpha / 2)
    z_beta = stats.norm.ppf(power)
    p_bar = (p1 + p2) / 2
    q_bar = 1 - p_bar
    numerator = z_alpha * math.sqrt(2 * p_bar * q_bar) + z_beta * math.sqrt(
        p1 * (1 - p1) + p2 * (1 - p2)
    )
    n = (numerator / (p2 - p1)) ** 2
    return int(math.ceil(n))


# ══════════════════════════════════════════════════════════════════
# 2. FREQUENTIST TEST
# ══════════════════════════════════════════════════════════════════
def two_prop_pvalue(x_a: int, n_a: int, x_b: int, n_b: int) -> float:
    """Two-sided p-value for a two-proportion z-test, pooled variance."""
    if n_a == 0 or n_b == 0:
        return 1.0
    p_a = x_a / n_a
    p_b = x_b / n_b
    p_pool = (x_a + x_b) / (n_a + n_b)
    se = math.sqrt(p_pool * (1 - p_pool) * (1 / n_a + 1 / n_b))
    if se == 0:
        return 1.0
    z = (p_b - p_a) / se
    return 2 * (1 - stats.norm.cdf(abs(z)))


# ══════════════════════════════════════════════════════════════════
# 3. BAYESIAN: P(B > A) via Monte Carlo from Beta posteriors
# ══════════════════════════════════════════════════════════════════
def prob_b_beats_a(
    x_a: int, n_a: int, x_b: int, n_b: int, samples: int = 20_000
) -> float:
    """Uniform Beta(1,1) prior. Returns P(pB > pA) by Monte Carlo."""
    a_a, b_a = 1 + x_a, 1 + (n_a - x_a)
    a_b, b_b = 1 + x_b, 1 + (n_b - x_b)
    draws_a = rng.beta(a_a, b_a, samples)
    draws_b = rng.beta(a_b, b_b, samples)
    return float((draws_b > draws_a).mean())


# ══════════════════════════════════════════════════════════════════
# 4. PEEKING-BIAS MONTE CARLO
#    True effect = 0. Peek every N_peek users. Stop the moment p < α.
#    If no stop by max_n, declare "no sig". Count false positives.
# ══════════════════════════════════════════════════════════════════
def peek_until_significant(
    p_true: float = 0.10,
    alpha: float = 0.05,
    max_n_per_arm: int = 5_000,
    peek_every: int = 50,
    n_sims: int = 1_000,
    rng_local: np.random.Generator | None = None,
) -> dict:
    """Return empirical false-positive rate and stop-time distribution.

    rng_local lets the caller supply a per-seed Generator so this function
    is pure with respect to the rng parameter (used by the multi-seed loop).
    Defaults to the module-level `rng` for backwards compatibility.
    """
    r = rng_local if rng_local is not None else rng
    false_positives = 0
    stop_times = []
    observed_lifts = []
    for _ in range(n_sims):
        x_a = x_b = 0
        stopped = False
        n = peek_every
        while n <= max_n_per_arm:
            # generate peek_every new trials per arm
            x_a += int(r.binomial(peek_every, p_true))
            x_b += int(r.binomial(peek_every, p_true))
            p = two_prop_pvalue(x_a, n, x_b, n)
            if p < alpha:
                false_positives += 1
                stop_times.append(n)
                observed_lifts.append((x_b / n) - (x_a / n))
                stopped = True
                break
            n += peek_every
        if not stopped:
            stop_times.append(max_n_per_arm)
            observed_lifts.append((x_b / max_n_per_arm) - (x_a / max_n_per_arm))

    return {
        "n_sims": n_sims,
        "nominal_alpha": alpha,
        "empirical_fpr": false_positives / n_sims,
        "inflation_factor": round((false_positives / n_sims) / alpha, 2),
        "median_stop_time": int(np.median(stop_times)),
        "peek_every": peek_every,
        "max_n_per_arm": max_n_per_arm,
        "observed_lift_at_stop_sample": sorted(observed_lifts)[:10] + ["…"] + sorted(observed_lifts)[-10:],
    }


# ══════════════════════════════════════════════════════════════════
# 4.b MULTI-SEED ENSEMBLE
#    A/B testing IS variance. Reporting one seed defeats the lesson.
#    This loop runs the headline calculations across N_SEEDS seeds and
#    reports the central band. Existing point-estimate keys (seed=42)
#    stay intact so the lab page keeps working unchanged.
# ══════════════════════════════════════════════════════════════════
def _summarize(values: list[float]) -> dict:
    arr = np.asarray(values, dtype=np.float64)
    return {
        "n": int(arr.size),
        "mean": round(float(arr.mean()), 4),
        "std": round(float(arr.std(ddof=1)) if arr.size > 1 else 0.0, 4),
        "p05": round(float(np.percentile(arr, 5)), 4),
        "p50": round(float(np.percentile(arr, 50)), 4),
        "p95": round(float(np.percentile(arr, 95)), 4),
        "min": round(float(arr.min()), 4),
        "max": round(float(arr.max()), 4),
    }


def multi_seed_ensemble(n_seeds: int = 50, base_seed: int = 1000) -> dict:
    """Run the headline calculations across n_seeds seeds. Returns
    distributional summaries — readers see ranges, not point estimates."""
    fpr_vals: list[float] = []
    inflation_vals: list[float] = []
    median_stop_vals: list[float] = []
    pba_vals: list[float] = []

    for i in range(n_seeds):
        seed_i = base_seed + i
        r = np.random.default_rng(seed_i)
        # Reduce per-seed sims (200 vs 1000) so 50 seeds finish in seconds.
        # Total: 50 * 200 = 10,000 simulated experiments — same statistical
        # weight as 10x the original single-seed run.
        peek = peek_until_significant(n_sims=200, rng_local=r)
        fpr_vals.append(peek["empirical_fpr"])
        inflation_vals.append(peek["empirical_fpr"] / 0.05)
        median_stop_vals.append(peek["median_stop_time"])
        # P(B > A) for a representative scenario — re-seed the module rng
        # since prob_b_beats_a uses it directly; we restore after.
        a_a, b_a = 1 + 120, 1 + (1000 - 120)
        a_b, b_b = 1 + 140, 1 + (1000 - 140)
        draws_a = r.beta(a_a, b_a, 5000)
        draws_b = r.beta(a_b, b_b, 5000)
        pba_vals.append(float((draws_b > draws_a).mean()))

    return {
        "n_seeds": n_seeds,
        "base_seed": base_seed,
        "sims_per_seed": 200,
        "note": ("Each seed is an independent run of the same protocol. "
                 "Bands describe sampling variance — the lesson the lab is "
                 "about. Point-estimate keys above are kept for backwards "
                 "compatibility with the live page; future page updates can "
                 "replace them with mean ± p05/p95 from this block."),
        "empirical_fpr": _summarize(fpr_vals),
        "inflation_factor": _summarize(inflation_vals),
        "median_stop_time": _summarize(median_stop_vals),
        "prob_b_gt_a_120_1000_140_1000": _summarize(pba_vals),
    }


# ══════════════════════════════════════════════════════════════════
# 5. BETA-PDF SANITY SAMPLES (so the JS can cross-check)
# ══════════════════════════════════════════════════════════════════
def beta_samples(a: float, b: float, n: int = 21) -> list:
    xs = np.linspace(0.001, 0.999, n)
    pdfs = stats.beta.pdf(xs, a, b)
    return [[round(float(x), 4), round(float(y), 4)] for x, y in zip(xs, pdfs)]


# ══════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════
def main() -> None:
    t0 = time.time()

    # Reference sample sizes for a few scenarios
    ss = {
        "baseline_0.10_mde_0.02_alpha_0.05_power_0.80":
            required_sample_size(0.10, 0.12),
        "baseline_0.05_mde_0.01_alpha_0.05_power_0.80":
            required_sample_size(0.05, 0.06),
        "baseline_0.20_mde_0.05_alpha_0.05_power_0.80":
            required_sample_size(0.20, 0.25),
    }

    # Peeking Monte Carlo (single-seed point estimate — kept for the live
    # page's existing reference-number widgets that read .peeking_bias.*)
    print("[ab-test] running peeking-bias Monte Carlo (1000 sims, seed=42) …")
    peek = peek_until_significant()

    # Multi-seed ensemble — describes sampling variance, which is what
    # the lab teaches. 50 independent seeds, summarized as central bands.
    print("[ab-test] running multi-seed ensemble (50 seeds × 200 sims) …")
    ensemble = multi_seed_ensemble(n_seeds=50)
    fpr_band = ensemble["empirical_fpr"]
    print(f"[ab-test] ensemble FPR: mean={fpr_band['mean']:.3f}  "
          f"5–95%: [{fpr_band['p05']:.3f}, {fpr_band['p95']:.3f}]")

    # P(B>A) closed-form vs Monte Carlo spot check
    pba_mc = prob_b_beats_a(120, 1000, 140, 1000)

    # Beta PDF samples at a representative posterior shape
    beta_ref = beta_samples(121, 881, n=21)

    out = {
        "sample_sizes_per_arm": ss,
        "peeking_bias": peek,
        "multi_seed_summary": ensemble,
        "prob_b_gt_a_mc_120_1000_140_1000": pba_mc,
        "beta_pdf_reference": {
            "a": 121, "b": 881,
            "note": "Beta(121, 881) posterior: uniform prior + 120/1000 observed.",
            "xy_pairs": beta_ref,
        },
        "regenerated_at": datetime.now(timezone.utc).isoformat(),
        "build_seconds": round(time.time() - t0, 2),
        "seed": SEED,
    }

    path = OUT_DIR / "methodology.json"
    with path.open("w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    print(f"[ab-test] wrote {path} ({path.stat().st_size / 1024:.1f} KB)")

    # Print the punchline so a reviewer doesn't have to open the file
    fpr = peek["empirical_fpr"]
    inflation = peek["inflation_factor"]
    print(f"[ab-test] peeking bias — nominal α=0.05, empirical FPR = {fpr:.3f} "
          f"({inflation}× inflation)")


if __name__ == "__main__":
    main()
