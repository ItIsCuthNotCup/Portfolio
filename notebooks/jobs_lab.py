"""
jobs_lab.py — build the AI & Jobs lab dataset.

What it does:
  1. Pulls three peer-reviewed occupation-level AI exposure datasets:
       - Eloundou et al. (2023, OpenAI)         — github.com/openai/GPTs-are-GPTs
       - Felten, Raj & Seamans AIOE (2023)      — github.com/AIOE-Data/AIOE
       - Yale Budget Lab (Feb 2026, harmonized) — budgetlab.yale.edu
  2. Joins them on six-digit SOC 2018.
  3. Applies a BLS layer with employment + median wage from BLS OEWS via
     the public BLS API (api.bls.gov), keyed by BLS_API_KEY env var when
     present (500 queries/day) or no-key (25/day, fine for top ~600 SOCs).
     Hand-curated 2024-34 projection figures cover the seven featured
     comparison pairs and top-employment occupations.
  4. Adds a robotics exposure score by SOC major group (heuristic; not
     a measured per-occupation value — Webb's pct_robots requires direct
     BLS .xlsx access which the bot-blocker still gates).
  5. Z-scores each AI measure and computes a composite.
  6. Writes assets/data/jobs/occupations.json and methodology.json.

Usage:
    BLS_API_KEY=your-key python notebooks/jobs_lab.py
    # or, no-key tier (limited to 25 queries/day per IP):
    python notebooks/jobs_lab.py

Re-run if any of the upstream files change. Eloundou's repo is stable;
Felten's appendix updates rarely; Yale Budget Lab refreshes
periodically. BLS OEWS publishes annually each spring.

Schema warning from the design brief: BLS Employment Projections
occasionally aggregate occupation codes (e.g., 13-1020 collapses three
SOCs). Always join on the EP "occupation code," not stripped SOC.

OEWS series ID format (25 chars):
    OEU + N + 0000000(area) + 000000(industry) + {SOC6} + 0 + {dtype}
where dtype 01 = employment, 04 = mean annual wage. SOCs ending in
multiple zeros (15-1299, 13-1020, etc.) are aggregate codes that OEWS
generally does not publish — the build skips them automatically when
the API returns no data.
"""

import io
import json
import os
import sys
import time
from pathlib import Path

import requests
import pandas as pd

BLS_API_KEY = os.environ.get("BLS_API_KEY")
BLS_API_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/"
BLS_BATCH   = 50  # max series per request
BLS_PAUSE_S = 0.4 # be polite

# ─────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────
ELOUNDOU_URL = "https://raw.githubusercontent.com/openai/GPTs-are-GPTs/main/data/occ_level.csv"
FELTEN_URL   = "https://github.com/AIOE-Data/AIOE/raw/main/AIOE_DataAppendix.xlsx"
YBL_URL      = "https://budgetlab.yale.edu/sites/default/files/2026-02/TBL-Data-AI-Exposure-What-do-we-know-202602-Updated.xlsx"

ROOT = Path(__file__).resolve().parents[1]
OUT  = ROOT / "assets" / "data" / "jobs"
OUT.mkdir(parents=True, exist_ok=True)

REQUEST_TIMEOUT = 60

# ─────────────────────────────────────────────────────────────
# Curated BLS layer
# (SOC code → 2024 employment in thousands, May 2024 median wage,
# 2024-34 projected % change, education tier 1..7, OJT level)
# Sources: BLS Employment Projections (Aug 2025), OEWS National May 2024.
# ─────────────────────────────────────────────────────────────
BLS = {
    # Featured comparison pairs (the lede of Section VI)
    "23-2011": (350.4, 61010, 0.0, 4, "Moderate"),
    "29-1171": (288.6, 132050, 46.0, 6, "None"),
    "15-1251": (140.6, 99700, -10.0, 5, "None"),
    "15-1252": (1898.4, 132270, 17.0, 5, "None"),
    "41-2011": (3338.3, 30710, -11.0, 1, "Short"),
    "35-3023": (3676.2, 30710, 5.0, 1, "Short"),
    "43-4051": (2858.7, 39680, -5.0, 2, "Short"),
    "31-1121": (3934.0, 33530, 21.0, 2, "Short"),
    "53-3032": (2086.0, 54320, 4.0, 2, "Short"),
    "47-2111": (818.7, 61590, 9.0, 2, "Apprenticeship"),
    "27-1024": (245.6, 61300, 2.0, 5, "None"),
    "39-5012": (566.9, 35256, 5.0, 3, "None"),
    "53-7065": (2829.7, 38600, 6.0, 1, "Short"),
    "51-4121": (430.6, 51000, -2.0, 2, "Moderate"),
    # Top US occupations by employment
    "29-1141": (3361.7, 86070, 6.0, 5, "None"),
    "41-2031": (3613.4, 33890, -1.0, 1, "Short"),
    "43-9061": (2769.7, 40240, -3.0, 2, "Short"),
    "43-4171": (1097.6, 35330, -5.0, 2, "Short"),
    "53-3031": (1972.5, 47660, 4.0, 2, "Short"),
    "53-7051": (716.1, 41280, 5.0, 1, "Short"),
    "47-2031": (1031.4, 56350, 4.0, 2, "Apprenticeship"),
    "47-2152": (495.8, 61550, 6.0, 2, "Apprenticeship"),
    "37-2011": (2280.0, 35020, 6.0, 1, "Short"),
    "11-1021": (3454.7, 101280, 6.0, 5, "None"),
    "13-2011": (1538.4, 79880, 6.0, 5, "None"),
    "13-2052": (272.2, 99580, 17.0, 5, "None"),
    "23-1011": (731.3, 145760, 5.0, 7, "None"),
    "29-1228": (757.1, 239200, 4.0, 7, "Internship"),
    "29-2061": (640.4, 56430, 6.0, 4, "None"),
    "31-1131": (1412.6, 33700, 4.0, 2, "Short"),
    "25-2021": (1530.6, 65190, -1.0, 5, "None"),
    "25-2031": (1077.5, 65440, 0.0, 5, "None"),
    "25-1099": (1372.0, 84380, 7.0, 7, "None"),
    "11-9021": (524.5, 116080, 7.0, 5, "Moderate"),
    "13-1071": (837.6, 67650, 5.0, 5, "None"),
    "13-1111": (892.9, 99410, 9.0, 5, "None"),
    "13-1161": (823.4, 76080, 8.0, 5, "None"),
    "27-3023": (44.9, 57500, -3.0, 5, "None"),
    "27-3031": (273.8, 71640, -3.0, 5, "None"),
    "27-3091": (53.0, 60820, -2.0, 5, "Short"),
    "33-3051": (665.0, 74910, 4.0, 3, "Moderate"),
    "33-2011": (320.7, 53580, 5.0, 3, "Long"),
    "35-1011": (162.7, 61210, 7.0, 3, "None"),
    "35-2011": (122.1, 32790, 4.0, 1, "Short"),
    "35-2014": (1437.5, 35160, 8.0, 1, "Short"),
    "35-3011": (530.3, 33010, -1.0, 1, "Short"),
    "35-3031": (2316.7, 31940, 0.0, 1, "Short"),
    "37-1011": (300.5, 50560, 8.0, 2, "Short"),
    "39-9011": (1148.7, 30370, 7.0, 1, "Short"),
    "41-1011": (1161.0, 49830, 1.0, 2, "Moderate"),
    "41-3091": (1387.8, 70480, 6.0, 2, "Moderate"),
    "43-3031": (1465.8, 47440, -5.0, 3, "Moderate"),
    "43-5071": (701.0, 39720, -2.0, 2, "Short"),
    "43-6014": (3286.6, 44280, -10.0, 2, "Short"),
    "47-1011": (754.0, 75820, 8.0, 2, "Moderate"),
    "47-2061": (1023.4, 47100, 4.0, 1, "Moderate"),
    "49-3023": (725.7, 47770, 0.0, 3, "Long"),
    "49-9071": (756.6, 46550, 4.0, 2, "Long"),
    "51-1011": (596.5, 67880, 0.0, 2, "Long"),
    "51-2090": (570.3, 41410, -2.0, 1, "Short"),
    "51-3011": (113.8, 33490, -3.0, 1, "Short"),
    "51-9111": (357.4, 41470, -1.0, 1, "Moderate"),
    "53-3033": (982.3, 49150, 4.0, 1, "Short"),
    "53-7062": (3076.1, 36510, 1.0, 1, "Short"),
    "53-7064": (217.3, 35720, 0.0, 1, "Short"),
    # AI / tech stack
    "15-1212": (170.2, 124910, 33.0, 5, "None"),
    "15-1232": (514.1, 60810, -7.0, 4, "Moderate"),
    "15-1241": (177.2, 130390, 4.0, 5, "None"),
    "15-1244": (376.8, 102040, 6.0, 5, "Moderate"),
    "15-1245": (175.9, 117450, 9.0, 5, "None"),
    "15-2031": (38.2, 116440, 11.0, 5, "None"),
    "15-2041": (33.2, 112590, 34.0, 6, "None"),
    "15-2051": (203.8, 112590, 36.0, 5, "None"),
    "17-2061": (28.5, 134810, 5.0, 5, "None"),
    "27-1014": (51.4, 81910, 8.0, 5, "None"),
    "27-1027": (10.7, 109530, 7.0, 5, "None"),
    "11-9032": (270.4, 105550, 4.0, 6, "Moderate"),
    "21-1012": (357.8, 64940, 4.0, 6, "None"),
    "27-1011": (8.7, 65130, 1.0, 5, "None"),
    "27-2042": (53.7, 53860, 6.0, 5, "Long"),
    "27-1023": (32.4, 60270, -1.0, 5, "None"),
    "27-1029": (66.3, 58110, 1.0, 5, "None"),
    "27-3041": (45.4, 86730, -10.0, 5, "Short"),
    "27-3043": (118.8, 73690, -5.0, 5, "Long"),
    "13-1051": (74.2, 78310, 4.0, 5, "None"),
    "13-1198": (211.4, 75290, 6.0, 5, "Moderate"),
    "11-2021": (404.1, 156580, 8.0, 5, "Moderate"),
    "13-1041": (337.7, 75690, -3.0, 5, "Moderate"),
    "23-1023": (38.6, 167680, -1.0, 7, "Internship"),
    "13-2031": (152.5, 88220, 6.0, 5, "Moderate"),
    "13-2061": (80.5, 81860, 14.0, 5, "Moderate"),
    "13-2071": (282.4, 78250, 5.0, 5, "Moderate"),
}

# ─────────────────────────────────────────────────────────────
# BLS narratives — short qualitative notes per occupation. v1 ships
# narratives only for the high-importance occupations from the brief.
# ─────────────────────────────────────────────────────────────
NARRATIVES = {
    "23-2011": "BLS notes AI tools (large language models) increasingly handle document review, contract analysis, and case research, suppressing demand growth that previously trended +14%.",
    "15-1251": "Generative AI coding tools take on routine programming tasks. BLS revised projection from positive growth to -10% as junior coding work gets automated.",
    "15-1252": "Demand for full-stack development, system architecture, and AI integration grows even as code generation gets cheaper — productivity gains expected to drive new project starts.",
    "29-1171": "Aging population drives sustained demand. NPs are licensed to provide many physician services at lower cost. Tasks remain high-touch, low-AI-exposure.",
    "43-4051": "AI assistants and chatbots automate Tier-1 ticket triage. Klarna's 700-agent equivalent in 2024 was a bellwether — partial reversal in 2025 shows the limits.",
    "53-3032": "BLS notes long-haul trucking faces eventual exposure to autonomous driving, but commercial deployment timelines remain uncertain. Drayage and final-mile remain robust.",
    "53-7065": "Amazon now operates >1 million robots in fulfillment (July 2025). Despite high robotics exposure, e-commerce demand growth keeps absolute headcount rising near-term.",
    "27-1024": "Generative image models compress production timelines on routine assets. Higher-end design and brand work increasingly differentiated.",
    "39-5012": "In-person service. Low automation exposure. Steady growth from population and discretionary spending.",
    "47-2111": "Skilled trade with strong physical-task component. Aging workforce + sustained construction demand keep growth positive.",
}

# Featured pairs (the "compare two jobs" mode starters)
FEATURED_PAIRS = [
    ("23-2011", "29-1171", "Paralegal vs. Nurse Practitioner",
     "Same credential tier, opposite outcomes. The clearest illustration that 'more education = safer' no longer holds."),
    ("15-1251", "15-1252", "Computer Programmer vs. Software Developer",
     "Same SOC major group. AI redraws within a discipline — automating the codable part, leaving design and architecture."),
    ("41-2011", "35-3023", "Cashier vs. Fast Food Worker",
     "Both ~$31k, no credential. Shows how the speed of robotics deployment differs even between adjacent service jobs."),
    ("43-4051", "31-1121", "Customer Service Rep vs. Home Health Aide",
     "Two of the largest occupations in the US economy heading in opposite directions."),
    ("53-3032", "47-2111", "Truck Driver vs. Electrician",
     "Both blue-collar, ~$60k, HS-level. Physical AI is a different story than embodied factory robotics."),
    ("27-1024", "39-5012", "Graphic Designer vs. Cosmetologist",
     "Lower-credentialed work proves more secure than higher-credentialed creative work — the inversion in one comparison."),
    ("53-7065", "51-4121", "Warehouse Stocker vs. Welder",
     "Same blue-collar tier, different exposures. High robotics exposure ≠ near-term displacement when demand growth is fast."),
]

# Robotics exposure heuristic by SOC major group.
# Webb's pct_robots is the gold standard; without that file (BLS 403),
# we synthesize a defensible proxy using the SOC major group.
ROBOTICS_BY_MAJOR = {
    "51": 0.85, "53": 0.65, "45": 0.55, "47": 0.45, "49": 0.35,
    "35": 0.55, "37": 0.30, "39": 0.20, "31": 0.20, "33": 0.15,
    "29": 0.10, "25": 0.10, "21": 0.10, "23": 0.10, "27": 0.20,
    "19": 0.15, "17": 0.20, "15": 0.10, "13": 0.10, "11": 0.10,
    "41": 0.30, "43": 0.20,
}
ROBOTICS_OVERRIDES = {
    "53-3032": 0.55, "53-7065": 0.85, "29-1141": 0.10,
    "39-5012": 0.05, "47-2111": 0.10, "47-2152": 0.10, "31-1121": 0.10,
}

def robotics_score(soc):
    if soc in ROBOTICS_OVERRIDES:
        return ROBOTICS_OVERRIDES[soc]
    return ROBOTICS_BY_MAJOR.get(soc[:2], 0.20)

# ─────────────────────────────────────────────────────────────
# Pipeline
# ─────────────────────────────────────────────────────────────
def fetch_bls_oews(socs):
    """Pull employment (datatype 01) + mean annual wage (datatype 04) for
    every SOC via the BLS API. Returns dict of soc -> {'employment': X,
    'mean_wage': Y}. Skips SOCs the API returns no data for (aggregates).
    """
    def build_id(soc6, dtype):
        return f"OEUN000000000000{soc6}{dtype:02d}"

    sid_to_meta = {}
    for s in socs:
        s6 = s.replace('-', '')
        for dt in (1, 4):
            sid_to_meta[build_id(s6, dt)] = (s, dt)

    all_ids = list(sid_to_meta.keys())
    print(f"→ BLS OEWS: requesting {len(all_ids)} series for {len(socs)} SOCs")
    if BLS_API_KEY:
        print(f"  using BLS_API_KEY (500 queries/day)")
    else:
        print(f"  no key set — limited to 25 queries/day per IP")

    results = {}
    for i in range(0, len(all_ids), BLS_BATCH):
        batch = all_ids[i:i+BLS_BATCH]
        body = {
            "seriesid": batch,
            "startyear": "2024",
            "endyear":   "2024",
        }
        if BLS_API_KEY:
            body["registrationkey"] = BLS_API_KEY
        try:
            r = requests.post(BLS_API_URL, json=body, timeout=30)
            r.raise_for_status()
            payload = r.json()
            if payload.get("status") != "REQUEST_SUCCEEDED":
                print(f"  WARN batch {i//BLS_BATCH}: {payload.get('message')}")
                if any("threshold" in m for m in (payload.get("message") or [])):
                    print("  rate limit hit — stopping")
                    break
            for s in payload.get("Results", {}).get("series", []):
                sid = s["seriesID"]
                if not s["data"]:
                    continue
                try:
                    v = float(s["data"][0]["value"])
                except (ValueError, KeyError, TypeError):
                    continue
                results[sid] = v
            if (i // BLS_BATCH + 1) % 5 == 0:
                print(f"  batch {i//BLS_BATCH + 1}: {len(results)} series resolved")
            time.sleep(BLS_PAUSE_S)
        except Exception as e:
            print(f"  batch {i//BLS_BATCH} error: {e}")
            break

    # Reshape to per-SOC dict
    by_soc = {}
    for sid, v in results.items():
        soc, dt = sid_to_meta[sid]
        by_soc.setdefault(soc, {})
        by_soc[soc]["employment" if dt == 1 else "mean_wage"] = v

    print(f"  resolved BLS data for {len(by_soc)} of {len(socs)} SOCs")
    return by_soc

def fetch_eloundou():
    print(f"→ Fetching Eloundou {ELOUNDOU_URL}")
    df = pd.read_csv(ELOUNDOU_URL)
    df['soc'] = df['O*NET-SOC Code'].str[:7]
    base = df[df['O*NET-SOC Code'].str.endswith('.00')].copy()
    grp = base.groupby('soc').agg({
        'Title': 'first',
        'dv_rating_alpha': 'mean',
        'dv_rating_beta': 'mean',
        'human_rating_beta': 'mean',
    }).reset_index()
    print(f"  {len(grp)} 6-digit SOCs")
    return grp

def fetch_felten():
    print(f"→ Fetching Felten AIOE {FELTEN_URL}")
    r = requests.get(FELTEN_URL, timeout=REQUEST_TIMEOUT)
    r.raise_for_status()
    df = pd.read_excel(io.BytesIO(r.content), sheet_name='Appendix A')
    df = df[['SOC Code', 'Occupation Title', 'AIOE']].rename(columns={
        'SOC Code': 'soc', 'Occupation Title': 'title_felten', 'AIOE': 'aioe',
    })
    print(f"  {len(df)} rows")
    return df

def fetch_ybl():
    print(f"→ Fetching Yale Budget Lab {YBL_URL}")
    r = requests.get(YBL_URL, timeout=REQUEST_TIMEOUT)
    r.raise_for_status()
    df = pd.read_excel(io.BytesIO(r.content), sheet_name='F1', header=5)
    df = df.rename(columns={
        'SOC2018': 'soc', 'Occupation': 'title_ybl',
        'PCA Weighted Score': 'ybl_pca', 'Z-Score Variance': 'ybl_var',
    })
    df = df[['soc', 'title_ybl', 'ybl_pca', 'ybl_var']].dropna(subset=['soc'])
    print(f"  {len(df)} SOCs")
    return df

def zscore(s):
    valid = s.dropna()
    return (s - valid.mean()) / valid.std()

def build():
    e = fetch_eloundou()
    f = fetch_felten()
    y = fetch_ybl()

    m = e.merge(f, on='soc', how='outer').merge(y, on='soc', how='outer')
    m['title'] = m['Title'].fillna(m['title_felten']).fillna(m['title_ybl'])
    m = m.dropna(subset=['title'])

    m['z_eloundou'] = zscore(m['dv_rating_beta'])
    m['z_felten']   = zscore(m['aioe'])
    m['z_ybl']      = zscore(m['ybl_pca'])
    m['ai_composite'] = m[['z_eloundou', 'z_felten', 'z_ybl']].mean(axis=1, skipna=True)
    m['robotics_score'] = m['soc'].apply(robotics_score)

    # Pull live BLS OEWS for every SOC the API will return.
    socs = [s for s in m['soc'].dropna().tolist() if s]
    bls_api = fetch_bls_oews(socs)

    occupations = []
    for _, row in m.iterrows():
        soc = row['soc']
        curated = BLS.get(soc)
        api     = bls_api.get(soc)

        # Merge: curated wins on projection + education + OJT (those need the
        # EP .xlsx which is bot-blocked); API wins on employment + wage when
        # we got fresher numbers from it.
        if curated:
            employment_k = curated[0]
            wage         = curated[1]
            projected    = curated[2]
            edu          = curated[3]
            ojt          = curated[4]
            # If API has fresher numbers, swap them in (employment in
            # thousands, wage in USD). API employment is raw count, divide
            # by 1000 to match curated units.
            if api and 'employment' in api:
                employment_k = round(api['employment'] / 1000, 1)
            if api and 'mean_wage' in api:
                wage = int(api['mean_wage'])
            bls_block = {
                'employment_thousands': employment_k,
                'median_wage_usd':      wage,
                'projected_pct_change': projected,
                'education_tier':       edu,
                'on_the_job_training':  ojt,
                'source': 'curated+api' if api else 'curated',
            }
        elif api and 'employment' in api and 'mean_wage' in api:
            # API-only path — every SOC we don't hand-curate but BLS publishes.
            bls_block = {
                'employment_thousands': round(api['employment'] / 1000, 1),
                'median_wage_usd':      int(api['mean_wage']),
                'projected_pct_change': None,
                'education_tier':       None,
                'on_the_job_training':  None,
                'source': 'api',
            }
        else:
            bls_block = None

        rec = {
            'soc': soc,
            'title': row['title'],
            'major_group': soc[:2],
            'ai': {
                'eloundou_beta':       _round(row['dv_rating_beta']),
                'eloundou_human_beta': _round(row['human_rating_beta']),
                'felten_aioe':         _round(row['aioe']),
                'ybl_pca':             _round(row['ybl_pca']),
            },
            'ai_composite_z': _round(row['ai_composite']),
            'robotics_score': round(float(row['robotics_score']), 3),
            'bls': bls_block,
            'narrative': NARRATIVES.get(soc),
        }
        occupations.append(rec)

    occupations.sort(key=lambda r: (r['bls'] is None, -(r.get('ai_composite_z') or -99)))
    return occupations

def _round(v, n=4):
    if pd.isna(v): return None
    return round(float(v), n)

def write(occupations):
    payload = {
        'version': 1,
        'generated_at': pd.Timestamp.utcnow().isoformat(timespec='seconds'),
        'sources': {
            'eloundou': 'github.com/openai/GPTs-are-GPTs · occ_level.csv',
            'felten':   'github.com/AIOE-Data/AIOE · Appendix A',
            'ybl':      "Yale Budget Lab · 'AI Exposure: What do we know?' (Feb 2026) PCA-weighted score",
            'robotics': 'Heuristic by SOC major group; Webb pct_robots not currently accessible',
            'bls':      'BLS Employment Projections 2024-34 (Aug 2025) + OEWS National May 2024 — hand-curated subset',
        },
        'education_labels': [
            '', 'No formal credential', 'High school diploma', 'Postsecondary non-degree',
            "Associate's degree", "Bachelor's degree", "Master's degree", 'Doctoral or professional',
        ],
        'featured_pairs': [
            {'a': p[0], 'b': p[1], 'label': p[2], 'blurb': p[3]} for p in FEATURED_PAIRS
        ],
        'occupations': occupations,
    }
    out_main = OUT / 'occupations.json'
    out_main.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"→ Wrote {out_main} ({out_main.stat().st_size // 1024} KB, {len(occupations)} occupations)")

    methodology = {
        'occupation_count': len(occupations),
        'with_bls_data':    sum(1 for o in occupations if o['bls']),
        'last_refresh':     payload['generated_at'],
        'last_refresh_human': pd.Timestamp.utcnow().strftime('%b %d, %Y · %H:%M UTC'),
        'sources_count': 3,
        'composite_method': 'Mean of z-scored AI exposure measures (Eloundou β, Felten AIOE, Yale Budget Lab PCA)',
        'robotics_method':  'Heuristic by SOC major group with curated overrides',
    }
    out_meth = OUT / 'methodology.json'
    out_meth.write_text(json.dumps(methodology, indent=2))
    print(f"→ Wrote {out_meth}")

def main():
    print("jobs_lab — building exposure dataset")
    occs = build()
    write(occs)
    print("Done.")

if __name__ == '__main__':
    main()
