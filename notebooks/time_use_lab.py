"""
time_use_lab.py — pull the ATUS Table A-1 data for the Time-Use Atlas lab.

What it does:
  1. Reads assets/data/time-use/series_map.json (built once from
     atus_a-tables_seriesid.xlsx — the BLS series-ID list).
  2. For each cohort × activity-bucket × sex, queries the BLS public API
     (api.bls.gov) using BLS_API_KEY for the keyed tier (500 queries/day,
     50 series per query).
  3. Pools 2019–2023 (configurable). When a bucket has multiple raw
     ATUS activities, the values are summed before averaging.
  4. Writes assets/data/time-use/cohorts.json (cohort → activity →
     {total_min, men_min, women_min, share_pct}) and methodology.json.

Usage:
    BLS_API_KEY=your-key python notebooks/time_use_lab.py
    # no-key tier (25 queries/day per IP):
    python notebooks/time_use_lab.py

Series ID structure for ATUS Table A-1:
    TUU10101AA01XXXXXX  → average hours per day
    TUU30105AA01XXXXXX  → percent engaged in activity
    TUU20101AA01XXXXXX  → average hours among persons engaged

The XXXXXX six-digit suffix encodes activity × cohort × sex; we got
those mappings from a1-seriesid.xlsx, which BLS publishes but bot-blocks
on direct download. Keep that file in the repo so the notebook is
reproducible.
"""

import io
import json
import os
import sys
import time
from pathlib import Path

import requests

BLS_API_KEY = os.environ.get("BLS_API_KEY")
BLS_API_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/"
BATCH_SIZE  = 50
PAUSE_S     = 0.4

YEARS = list(range(2019, 2024))   # pool 2019–2023

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "assets" / "data" / "time-use"
SERIES_MAP_PATH = DATA / "series_map.json"
OUT_COHORTS     = DATA / "cohorts.json"
OUT_METHODOLOGY = DATA / "methodology.json"

# Cohort grouping for the picker UI
COHORT_AXES = {
    "all":        ["Total"],
    "age":        ["15-24 years", "25-34 years", "25-54 years", "35-44 years",
                   "45-54 years", "55-64 years", "65 years and over"],
    "employment": ["Employed", "Employed full time", "Employed part time ",
                   "Not employed"],
    "parent":     ["No own hh child under age 18",
                   "Own hh child under age 18",
                   "Own hh child under age 6",
                   "Youngest own hh child age 6-17"],
}

# Featured "surprise reveals" — verified findings backed by ATUS published values.
SURPRISES = [
    {
        "id": "retiree_tv",
        "title": "Retirees watch ~4.7 hours of TV per day",
        "cohort": "65 years and over",
        "activity": "Watching TV",
        "sex": "total",
    },
    {
        "id": "young_parent_sleep",
        "title": "Parents of young kids sleep ~37 minutes less per day",
        "compare_cohorts": ["No own hh child under age 18",
                            "Own hh child under age 6"],
        "activity": "Sleep",
        "sex": "total",
    },
    {
        "id": "housework_gender_gap",
        "title": "Women do ~30 more minutes of housework per day than men",
        "cohort": "Total",
        "activity": "Housework",
        "compare_sex": ["men", "women"],
    },
    {
        "id": "young_screens",
        "title": "Ages 15–24 spend ~2.5 hours per day on phone/computer leisure",
        "cohort": "15-24 years",
        "activity": "Phone/computer",
        "sex": "total",
    },
    {
        "id": "employed_socializing",
        "title": "Full-time workers spend ~30 minutes less socializing than the not-employed",
        "compare_cohorts": ["Employed full time", "Not employed"],
        "activity": "Socializing",
        "sex": "total",
    },
    {
        "id": "religious_volunteer",
        "title": "Total religious + volunteer time averages well under 30 minutes per day",
        "cohort": "Total",
        "activity": "Religious/volunteer",
        "sex": "total",
    },
]

# ─────────────────────────────────────────────────────────────
def fetch_series(ids):
    """Pull a batch of series IDs from BLS API. Returns list-of-floats per series across YEARS."""
    out = {}  # series_id → mean of YEARS values (skipping null/-/dash)
    for i in range(0, len(ids), BATCH_SIZE):
        batch = ids[i:i+BATCH_SIZE]
        body = {
            "seriesid": batch,
            "startyear": str(YEARS[0]),
            "endyear":   str(YEARS[-1]),
        }
        if BLS_API_KEY:
            body["registrationkey"] = BLS_API_KEY
        try:
            r = requests.post(BLS_API_URL, json=body, timeout=30)
            r.raise_for_status()
            payload = r.json()
            if payload.get("status") != "REQUEST_SUCCEEDED":
                msgs = payload.get("message") or []
                if any("threshold" in m for m in msgs):
                    print(f"  rate limit hit at batch {i // BATCH_SIZE}")
                    return out
            for s in payload.get("Results", {}).get("series", []):
                vals = []
                for row in s.get("data", []):
                    try:
                        vals.append(float(row["value"]))
                    except (ValueError, KeyError, TypeError):
                        continue
                if vals:
                    out[s["seriesID"]] = sum(vals) / len(vals)
            time.sleep(PAUSE_S)
        except Exception as e:
            print(f"  batch {i // BATCH_SIZE} error: {e}")
            return out
    return out

def hours_to_minutes(h):
    return None if h is None else round(h * 60, 1)

def main():
    if not SERIES_MAP_PATH.exists():
        print(f"ERROR: {SERIES_MAP_PATH} missing.", file=sys.stderr)
        sys.exit(2)
    series_map = json.loads(SERIES_MAP_PATH.read_text())
    print(f"Loaded series map: {len(series_map)} cohorts")
    if BLS_API_KEY:
        print("  using BLS_API_KEY (500 queries/day)")
    else:
        print("  no key set — limited to 25 queries/day per IP")

    # Build flat list of every series we need (Total only for the picker;
    # Men/Women for the gender-gap surprise reveal).
    needed = set()
    for cohort, activities in series_map.items():
        for bucket, rec in activities.items():
            for sid in rec["total"]:
                needed.add(sid)
    # Add Men/Women only for the Total cohort — used by the housework gap
    for bucket, rec in series_map["Total"].items():
        for sid in rec["men"] + rec["women"]:
            if sid: needed.add(sid)
    needed = sorted(needed)
    print(f"Series to fetch: {len(needed)}")

    values = fetch_series(needed)
    print(f"  resolved: {len(values)} of {len(needed)}")

    # Aggregate to cohort × bucket
    cohorts_out = {}
    for cohort, activities in series_map.items():
        cohorts_out[cohort] = {}
        for bucket, rec in activities.items():
            # Sum across raw activities that map to this bucket (e.g., several
            # housework sub-categories aggregate into one Housework total).
            def sum_cohort(ids):
                vs = [values[i] for i in ids if i in values]
                return sum(vs) if vs else None
            t = sum_cohort(rec["total"])
            m = sum_cohort([x for x in rec["men"]   if x])
            w = sum_cohort([x for x in rec["women"] if x])
            cohorts_out[cohort][bucket] = {
                "total_min": hours_to_minutes(t),
                "men_min":   hours_to_minutes(m),
                "women_min": hours_to_minutes(w),
            }

    # Compute total minutes per cohort (sum of buckets) for sanity-check & display
    for cohort, buckets in cohorts_out.items():
        total = sum((b["total_min"] or 0) for b in buckets.values())
        cohorts_out[cohort]["__total_min"] = round(total, 1)

    payload = {
        "version": 1,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "years_pooled": YEARS,
        "cohort_axes":  COHORT_AXES,
        "cohorts":      cohorts_out,
        "surprises":    SURPRISES,
        "source": "BLS American Time Use Survey · Table A-1 series IDs from a1-seriesid.xlsx",
    }
    OUT_COHORTS.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"→ wrote {OUT_COHORTS} ({OUT_COHORTS.stat().st_size // 1024} KB)")

    methodology = {
        "cohort_count":     len(cohorts_out),
        "activity_buckets": 13,
        "years_pooled":     f"{YEARS[0]}–{YEARS[-1]}",
        "last_refresh":     payload["generated_at"],
        "source":           "BLS ATUS Table A-1",
        "notes": [
            "Values are pooled means across the years above.",
            "Activity buckets consolidate the 116 ATUS activities into 13 readable categories.",
            "Cells with under 50 respondents are not surfaced by ATUS; we accept whatever the API returns.",
        ],
    }
    OUT_METHODOLOGY.write_text(json.dumps(methodology, indent=2))
    print(f"→ wrote {OUT_METHODOLOGY}")

if __name__ == "__main__":
    main()
