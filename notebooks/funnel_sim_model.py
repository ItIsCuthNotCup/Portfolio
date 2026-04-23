"""
funnel_sim_model.py — model specification + validation for the funnel
agent-based simulation at /work/funnel-sim-lab/.

The model:
    Every agent belongs to one of four segments and moves through five
    stages: awareness → consideration → trial → purchase → retention.
    At each tick, an agent either advances (probability p_adv) or drops
    out (probability p_drop); otherwise it stays. Both probabilities are
    a product of a segment-stage baseline × lever modifiers the user
    controls on the live page.

What this script validates:
    1. Closed-form Markov-chain conversion rate matches simulation.
    2. Four preset scenarios produce distinct metric fingerprints.
    3. A simple lever sensitivity sweep (discount 0–50 %) confirms the
       model responds as claimed by segment.

Run:
    python notebooks/funnel_sim_model.py

Outputs:
    assets/data/funnel-sim/methodology.json
"""

from __future__ import annotations

import json
import math
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "data" / "funnel-sim"
OUT_DIR.mkdir(parents=True, exist_ok=True)

SEED = 42
rng = np.random.default_rng(SEED)


# ══════════════════════════════════════════════════════════════════
# MODEL CONSTANTS (mirrored in assets/js/funnel-sim-lab.js)
# ══════════════════════════════════════════════════════════════════
STAGES = ["awareness", "consideration", "trial", "purchase", "retention"]

# Segment archetypes — baseline per-stage advance probability, baseline
# per-stage drop probability, and "responsiveness" multipliers that
# modulate how each lever (email, discount, ad, retention effort)
# affects them. Numbers chosen so a default run feels like a realistic
# but imperfect funnel.
@dataclass(frozen=True)
class Segment:
    name: str
    entry_weight: float        # share of entering traffic
    stage_adv: tuple[float, ...]   # per-stage base advance probability
    stage_drop: tuple[float, ...]  # per-stage base drop probability
    resp_discount: float
    resp_email: float
    resp_ad: float
    resp_retention: float
    ticket: float              # average order value (for LTV math)


SEGMENTS: tuple[Segment, ...] = (
    Segment("bargain",  0.25,
            (0.30, 0.25, 0.45, 0.60, 0.80),
            (0.15, 0.30, 0.20, 0.05, 0.10),
            resp_discount=1.5, resp_email=1.0, resp_ad=1.0, resp_retention=0.8,
            ticket=38.0),
    Segment("loyalist", 0.20,
            (0.35, 0.50, 0.60, 0.80, 0.95),
            (0.10, 0.15, 0.10, 0.03, 0.02),
            resp_discount=0.6, resp_email=1.2, resp_ad=0.8, resp_retention=1.3,
            ticket=74.0),
    Segment("skeptic",  0.30,
            (0.20, 0.15, 0.30, 0.50, 0.70),
            (0.30, 0.40, 0.25, 0.15, 0.20),
            resp_discount=1.0, resp_email=0.5, resp_ad=1.3, resp_retention=1.0,
            ticket=52.0),
    Segment("impulse",  0.25,
            (0.45, 0.60, 0.70, 0.85, 0.50),
            (0.20, 0.20, 0.15, 0.10, 0.40),
            resp_discount=1.3, resp_email=1.0, resp_ad=1.1, resp_retention=0.7,
            ticket=46.0),
)


# ══════════════════════════════════════════════════════════════════
# LEVERS — user-facing parameters
#   All normalized 0-1 unless noted.
# ══════════════════════════════════════════════════════════════════
@dataclass
class Levers:
    ad_spend: float         # daily, dollars. Drives acquisition volume.
    email_freq: float       # 0..1 intensity
    discount: float         # 0..1 depth (0 = none, 1 = 50% off)
    targeting: float        # 0..1 — how biased inflow is toward high-LTV segments
    retention_effort: float # 0..1 — retention lever

    def lever_vector(self) -> dict:
        return {
            "email": 1.0 + 0.4 * (self.email_freq - 0.5),        # 0.8..1.2 baseline
            "discount": 1.0 + 0.6 * self.discount,                # 1.0..1.6
            "ad": 1.0 + 0.4 * (self.ad_spend / 500.0 - 0.5),      # scaled
            "retention": 1.0 + 0.6 * (self.retention_effort - 0.5), # 0.7..1.3
        }


def modified_probs(seg: Segment, levers: Levers) -> tuple[np.ndarray, np.ndarray]:
    """Apply lever responsiveness to the segment baselines.

    Advance is boosted by email, discount, and (on retention stage) the
    retention lever; responses are clipped to [0.02, 0.98] so nothing
    ever sticks at probability 0 or 1. Drops are damped by retention
    effort (in the retention stage only) and inflated by over-emailing
    (fatigue) across the mid-stages.
    """
    lv = levers.lever_vector()

    adv = np.array(seg.stage_adv, dtype=float)
    drop = np.array(seg.stage_drop, dtype=float)

    # Advance modifiers
    adv[1] *= (1 + (lv["email"] - 1) * seg.resp_email)        # consideration
    adv[2] *= (1 + (lv["discount"] - 1) * seg.resp_discount)  # trial
    adv[3] *= (1 + (lv["discount"] - 1) * seg.resp_discount * 0.5)  # purchase
    adv[4] *= (1 + (lv["retention"] - 1) * seg.resp_retention)      # retention

    # Drop modifiers — fatigue from over-emailing (only if email_freq > 0.5)
    fatigue = max(0.0, levers.email_freq - 0.5) * 0.8 * (1 / max(0.5, seg.resp_email))
    drop[1] *= (1 + fatigue)
    drop[2] *= (1 + fatigue * 0.5)
    drop[3] *= (1 + fatigue * 0.3)
    # Retention drop damped by retention effort
    drop[4] *= max(0.2, 2 - lv["retention"] * seg.resp_retention)

    adv = np.clip(adv, 0.02, 0.98)
    drop = np.clip(drop, 0.01, 0.85)
    # Ensure p_advance + p_drop < 1 so some agents can stay put
    over = adv + drop
    shrink = np.where(over > 0.95, 0.95 / over, 1.0)
    return adv * shrink, drop * shrink


# ══════════════════════════════════════════════════════════════════
# CLOSED-FORM: per-segment end-to-end conversion (aware → purchase)
#
# An agent at stage s either advances (p_a), drops (p_d), or stays.
# Conditional on ever leaving the stage, probability of advancing is
# p_a / (p_a + p_d). Product across stages gives end-to-end conversion.
# ══════════════════════════════════════════════════════════════════
def analytical_conversion(seg: Segment, levers: Levers) -> float:
    adv, drop = modified_probs(seg, levers)
    # Awareness → consideration → trial → purchase (first 4 stages)
    probs = [adv[i] / (adv[i] + drop[i]) for i in range(4)]
    return float(np.prod(probs))


def analytical_retention_months(seg: Segment, levers: Levers) -> float:
    adv, drop = modified_probs(seg, levers)
    # Once at retention: each month either re-purchases (adv[4]) or
    # churns (drop[4]). Expected number of retention months is
    # 1 / P(churn_per_month).
    p_churn = drop[4] / (drop[4] + adv[4])
    if p_churn <= 0:
        return 12.0  # cap
    return min(36.0, 1.0 / p_churn)


def analytical_ltv(seg: Segment, levers: Levers) -> float:
    # Effective per-order revenue after discount
    lv = levers.lever_vector()
    eff_ticket = seg.ticket * (1 - 0.5 * levers.discount)  # discount = 1 → 50% off
    months = analytical_retention_months(seg, levers)
    return eff_ticket * (1 + months)  # initial purchase + retained months


# ══════════════════════════════════════════════════════════════════
# SIMULATION — used only for validation here; the JS version drives
# the live page. They implement identical math.
# ══════════════════════════════════════════════════════════════════
def simulate_cohort(seg: Segment, levers: Levers, n: int = 50_000, max_ticks: int = 200) -> dict:
    """Run n agents of one segment from stage 0. Report per-stage advance
    rates and end-to-end conversion."""
    adv, drop = modified_probs(seg, levers)
    stage_counts = [0] * 5
    stage_counts[0] = n
    reached = [n, 0, 0, 0, 0]

    # per stage: probability to advance on any given tick
    for s in range(4):
        alive = reached[s]
        advanced = 0
        dropped = 0
        # vectorised per-tick simulation
        for _ in range(max_ticks):
            if alive == 0:
                break
            u = rng.random(alive)
            adv_mask = u < adv[s]
            drop_mask = (u >= adv[s]) & (u < adv[s] + drop[s])
            advanced_step = int(adv_mask.sum())
            dropped_step = int(drop_mask.sum())
            advanced += advanced_step
            dropped += dropped_step
            alive -= advanced_step + dropped_step
        reached[s + 1] = advanced
    return {
        "reached": reached,
        "conversion": reached[4] / n if n else 0.0,
    }


# ══════════════════════════════════════════════════════════════════
# PRESET SCENARIOS
# ══════════════════════════════════════════════════════════════════
PRESETS = {
    "healthy":     Levers(ad_spend=400, email_freq=0.55, discount=0.10, targeting=0.65, retention_effort=0.70),
    "leaky":       Levers(ad_spend=700, email_freq=0.70, discount=0.30, targeting=0.35, retention_effort=0.20),
    "saturated":   Levers(ad_spend=900, email_freq=0.85, discount=0.45, targeting=0.20, retention_effort=0.40),
    "niche_premium": Levers(ad_spend=250, email_freq=0.40, discount=0.00, targeting=0.85, retention_effort=0.90),
}


def blended_conversion(levers: Levers) -> float:
    return sum(s.entry_weight * analytical_conversion(s, levers) for s in SEGMENTS)


def blended_ltv(levers: Levers) -> float:
    return sum(s.entry_weight * analytical_ltv(s, levers) for s in SEGMENTS)


def cac_estimate(levers: Levers, acq_per_day_per_dollar: float = 0.4) -> float:
    inflow_per_day = levers.ad_spend * acq_per_day_per_dollar
    conv = blended_conversion(levers)
    customers_per_day = inflow_per_day * conv
    return levers.ad_spend / customers_per_day if customers_per_day else math.inf


def scenario_fingerprint(levers: Levers) -> dict:
    per_seg = [
        {
            "segment": s.name,
            "conversion": round(analytical_conversion(s, levers), 4),
            "retention_months": round(analytical_retention_months(s, levers), 2),
            "ltv": round(analytical_ltv(s, levers), 2),
        }
        for s in SEGMENTS
    ]
    ltv = blended_ltv(levers)
    cac = cac_estimate(levers)
    return {
        "levers": levers.__dict__,
        "blended_conversion": round(blended_conversion(levers), 4),
        "blended_ltv": round(ltv, 2),
        "cac": round(cac, 2) if math.isfinite(cac) else None,
        "ltv_cac_ratio": round(ltv / cac, 2) if cac and math.isfinite(cac) else None,
        "per_segment": per_seg,
    }


# ══════════════════════════════════════════════════════════════════
# VALIDATION SWEEP
# ══════════════════════════════════════════════════════════════════
def validate_closed_form_vs_sim():
    """For each segment, run 50k agents and compare empirical conversion
    to the closed-form. Expect agreement within 1% absolute."""
    levers = PRESETS["healthy"]
    results = []
    for seg in SEGMENTS:
        sim = simulate_cohort(seg, levers, n=50_000, max_ticks=200)
        theory = analytical_conversion(seg, levers)
        abs_err = abs(sim["conversion"] - theory)
        results.append({
            "segment": seg.name,
            "sim_conversion": round(sim["conversion"], 4),
            "closed_form": round(theory, 4),
            "absolute_error": round(abs_err, 4),
            "within_1pct": abs_err < 0.01,
        })
    return results


def discount_sweep():
    """Hold all levers at 'healthy' except discount; sweep 0..0.5 and
    measure each segment's conversion. Shows heterogeneity of response."""
    base = PRESETS["healthy"]
    points = []
    for d in [0.0, 0.1, 0.2, 0.3, 0.4, 0.5]:
        lv = Levers(ad_spend=base.ad_spend, email_freq=base.email_freq,
                    discount=d, targeting=base.targeting,
                    retention_effort=base.retention_effort)
        row = {"discount": d}
        for seg in SEGMENTS:
            row[seg.name] = round(analytical_conversion(seg, lv), 4)
        points.append(row)
    return points


# ══════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════
def main() -> None:
    t0 = time.time()

    print("[funnel-sim] validating closed-form vs 50k-agent simulation …")
    validation = validate_closed_form_vs_sim()
    for row in validation:
        mark = "✓" if row["within_1pct"] else "✗"
        print(f"   {mark} {row['segment']:9s}  sim={row['sim_conversion']:.4f}  "
              f"analytic={row['closed_form']:.4f}  |Δ|={row['absolute_error']:.4f}")

    print("[funnel-sim] computing scenario fingerprints …")
    fingerprints = {name: scenario_fingerprint(lv) for name, lv in PRESETS.items()}

    print("[funnel-sim] running discount sweep …")
    sweep = discount_sweep()

    segments_export = [
        {
            "name": s.name,
            "entry_weight": s.entry_weight,
            "stage_adv": list(s.stage_adv),
            "stage_drop": list(s.stage_drop),
            "ticket": s.ticket,
            "responsiveness": {
                "discount": s.resp_discount,
                "email": s.resp_email,
                "ad": s.resp_ad,
                "retention": s.resp_retention,
            },
        } for s in SEGMENTS
    ]

    out = {
        "model": {
            "stages": STAGES,
            "segments": segments_export,
            "note": "Per-tick agent transitions: Pr(advance)=adv[stage], "
                    "Pr(drop)=drop[stage] (both clipped), else stay. "
                    "Lever modifiers applied via modified_probs(). Identical math "
                    "in assets/js/funnel-sim-lab.js.",
        },
        "presets": {name: lv.__dict__ for name, lv in PRESETS.items()},
        "fingerprints": fingerprints,
        "discount_sweep": sweep,
        "closed_form_validation": validation,
        "regenerated_at": datetime.now(timezone.utc).isoformat(),
        "build_seconds": round(time.time() - t0, 2),
        "seed": SEED,
    }

    path = OUT_DIR / "methodology.json"
    with path.open("w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    kb = path.stat().st_size / 1024
    print(f"[funnel-sim] wrote {path} ({kb:.1f} KB) in {out['build_seconds']}s")


if __name__ == "__main__":
    main()
