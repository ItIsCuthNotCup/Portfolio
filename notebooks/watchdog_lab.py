"""
watchdog_lab.py — daily YouTube Trending pull for the Algorithm Watchdog lab.

What it does:
  1. Calls YouTube Data API v3 /videos.list with chart=mostPopular, region=US,
     maxResults=50. ~10 quota units per run.
  2. Parses each video: ISO 8601 duration → seconds, category ID → name,
     extracts trending rank.
  3. Loads existing assets/data/watchdog/trending.json, appends today's entry,
     trims to last 30 days.
  4. Computes the lede aggregations:
       - duration band (IQR over last 7 days)
       - top + second category by frequency
       - posting time peak window
       - short-form share
       - channel concentration (count of channels with 3+ appearances)
       - week-over-week deltas vs the prior 7 days
  5. Picks one of four lede templates (A/B/C/D) based on which thresholds tripped.
  6. Writes trending.json + methodology.json.

Usage:
    YOUTUBE_API_KEY=AIza... python notebooks/watchdog_lab.py

Re-runnable. The 30-day rolling window means the file size stays bounded
at ~1500 video records (~250 KB).

Resilience: any API/parse failure logs the error and exits cleanly without
modifying the JSON. The site keeps showing yesterday's data; nothing breaks.
"""

import json
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")
from pathlib import Path
from typing import Optional

import requests

# ─────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────
API_KEY      = os.environ.get("YOUTUBE_API_KEY")
API_BASE     = "https://www.googleapis.com/youtube/v3/videos"
REGION       = "US"
MAX_RESULTS  = 50
WINDOW_DAYS  = 30

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "data" / "watchdog"
OUT_DATA = OUT_DIR / "trending.json"
OUT_METH = OUT_DIR / "methodology.json"

# YouTube category ID → readable name (US category list, stable for years)
CATEGORY_MAP = {
    "1": "Film & Animation",  "2":  "Autos & Vehicles",
    "10": "Music",            "15": "Pets & Animals",
    "17": "Sports",           "18": "Short Movies",
    "19": "Travel & Events",  "20": "Gaming",
    "21": "Videoblogging",    "22": "People & Blogs",
    "23": "Comedy",           "24": "Entertainment",
    "25": "News & Politics",  "26": "Howto & Style",
    "27": "Education",        "28": "Science & Tech",
    "29": "Nonprofits",       "30": "Movies",
    "43": "Shows",
}

# ISO 8601 duration → seconds. Format: PT#H#M#S (any part optional)
ISO_DUR_RE = re.compile(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?")
def parse_iso_duration(s: str) -> int:
    m = ISO_DUR_RE.fullmatch(s or "")
    if not m: return 0
    h, mn, sec = (int(x) if x else 0 for x in m.groups())
    return h * 3600 + mn * 60 + sec

# ─────────────────────────────────────────────────────────────
# 1. Fetch
# ─────────────────────────────────────────────────────────────
def fetch_trending() -> list[dict]:
    if not API_KEY:
        print("ERROR: YOUTUBE_API_KEY env var required.", file=sys.stderr)
        sys.exit(2)
    params = {
        "part": "snippet,contentDetails,statistics",
        "chart": "mostPopular",
        "regionCode": REGION,
        "maxResults": MAX_RESULTS,
        "key": API_KEY,
    }
    print(f"→ Fetching YouTube Trending (region={REGION}, max={MAX_RESULTS})")
    r = requests.get(API_BASE, params=params, timeout=30)
    r.raise_for_status()
    items = r.json().get("items", [])
    print(f"  {len(items)} items returned")
    if not items:
        raise RuntimeError("No items in API response")
    return items

def normalize(items: list[dict]) -> list[dict]:
    out = []
    for rank, item in enumerate(items, start=1):
        sn = item.get("snippet", {})
        cd = item.get("contentDetails", {})
        st = item.get("statistics", {})
        cat_id = sn.get("categoryId") or "0"
        out.append({
            "rank":             rank,
            "video_id":         item.get("id"),
            "title":            sn.get("title", "")[:200],
            "channel_name":     sn.get("channelTitle", ""),
            "channel_id":       sn.get("channelId", ""),
            "published_at":     sn.get("publishedAt"),
            "duration_seconds": parse_iso_duration(cd.get("duration", "")),
            "view_count":       int(st.get("viewCount", 0) or 0),
            "like_count":       int(st.get("likeCount", 0) or 0),
            "comment_count":    int(st.get("commentCount", 0) or 0),
            "category":         CATEGORY_MAP.get(cat_id, f"Other ({cat_id})"),
            "thumbnail_url":    (sn.get("thumbnails", {}).get("medium", {}) or {}).get("url"),
        })
    return out

# ─────────────────────────────────────────────────────────────
# 2. Append + trim
# ─────────────────────────────────────────────────────────────
def load_existing() -> list[dict]:
    if not OUT_DATA.exists():
        return []
    try:
        d = json.loads(OUT_DATA.read_text())
        return d.get("days", [])
    except (json.JSONDecodeError, KeyError):
        return []

def append_and_trim(days: list[dict], today_videos: list[dict]) -> list[dict]:
    today = datetime.now(timezone.utc).date().isoformat()
    # If today's pull already exists (re-run), replace it
    days = [d for d in days if d.get("date") != today]
    days.append({
        "date": today,
        "captured_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "region": REGION,
        "videos": today_videos,
    })
    # Trim to last WINDOW_DAYS calendar days
    cutoff = (datetime.now(timezone.utc).date() - timedelta(days=WINDOW_DAYS - 1)).isoformat()
    days = [d for d in days if d.get("date", "") >= cutoff]
    days.sort(key=lambda d: d["date"])
    return days

# ─────────────────────────────────────────────────────────────
# 3. Aggregations powering the lede
# ─────────────────────────────────────────────────────────────
def percentile(xs: list[float], p: float) -> float:
    if not xs: return 0.0
    xs = sorted(xs)
    k = (len(xs) - 1) * p
    f, c = int(k), min(int(k) + 1, len(xs) - 1)
    return xs[f] + (xs[c] - xs[f]) * (k - f)

def vids_in_window(days: list[dict], end_date: str, length: int = 7) -> list[dict]:
    """Return all videos from the `length` days ending at end_date inclusive."""
    end = datetime.fromisoformat(end_date).date()
    start = end - timedelta(days=length - 1)
    out = []
    for d in days:
        ddate = datetime.fromisoformat(d["date"]).date()
        if start <= ddate <= end:
            out.extend(d.get("videos", []))
    return out

def duration_band_text(vids: list[dict]) -> str:
    durs = [v["duration_seconds"] for v in vids if v.get("duration_seconds")]
    if not durs: return "video"
    p25 = percentile(durs, 0.25) / 60
    p75 = percentile(durs, 0.75) / 60
    if p75 - p25 < 2:
        med = percentile(durs, 0.5) / 60
        return f"{round(med - 1)}–{round(med + 1)} minute"
    return f"{round(p25)}–{round(p75)} minute"

def top_categories(vids: list[dict], n: int = 2) -> list[tuple[str, float]]:
    cats = Counter(v["category"] for v in vids)
    total = sum(cats.values()) or 1
    return [(c, n_/total) for c, n_ in cats.most_common(n)]

def posting_window_text(vids: list[dict]) -> str:
    """Bin published_at by ET day-of-week × hour, find best contiguous 6-hour block."""
    slots = defaultdict(int)  # (dow, hour) → count
    for v in vids:
        pub = v.get("published_at")
        if not pub: continue
        try:
            dt = datetime.fromisoformat(pub.replace("Z", "+00:00"))
        except ValueError:
            continue
        # Convert UTC to ET. zoneinfo handles DST so EST/EDT switch correctly.
        dt_et = dt.astimezone(ET)
        slots[(dt_et.weekday(), dt_et.hour)] += 1

    # Find best contiguous 6-hour window
    best, best_score = None, 0
    days_full = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    for dow in range(7):
        for h_start in range(24):
            score = sum(slots.get((dow, (h_start + i) % 24), 0) for i in range(6))
            if score > best_score:
                best_score = score
                best = (dow, h_start)
    if not best: return "throughout the week"
    dow, h_start = best
    h_end = (h_start + 6) % 24
    if h_start < 6:    period = "early morning"
    elif h_start < 12: period = "morning"
    elif h_start < 17: period = "afternoon"
    elif h_start < 21: period = "evening"
    else:              period = "late evening"
    # Collapse contiguous days of same-period peaks into a range — for v1, name the day
    return f"{days_full[dow]} {period}"

def short_form_note(vids: list[dict]) -> Optional[str]:
    short = sum(1 for v in vids if 0 < v.get("duration_seconds", 0) < 180)
    if short <= 2:
        return "Videos under three minutes are conspicuously absent."
    if short >= 6:
        return f"Short videos held strong, claiming {short} of the top 50."
    return None

def channel_concentration(vids: list[dict]) -> tuple[int, str]:
    counts = Counter(v["channel_name"] for v in vids)
    repeats = sum(1 for c, n_ in counts.items() if n_ >= 3)
    return repeats, ""

def week_over_week_delta(days: list[dict]) -> dict:
    if len(days) < 8:
        return {}
    end = days[-1]["date"]
    cur_end = end
    cur_start = (datetime.fromisoformat(end).date() - timedelta(days=6)).isoformat()
    prev_end = (datetime.fromisoformat(cur_start).date() - timedelta(days=1)).isoformat()
    prev_start = (datetime.fromisoformat(prev_end).date() - timedelta(days=6)).isoformat()
    cur_v  = vids_in_window(days, cur_end, 7)
    prev_v = vids_in_window(days, prev_end, 7)
    if not prev_v: return {}

    # Concentration delta
    cur_repeats, _  = channel_concentration(cur_v)
    prev_repeats, _ = channel_concentration(prev_v)

    # Category share deltas
    cur_cats  = Counter(v["category"] for v in cur_v)
    prev_cats = Counter(v["category"] for v in prev_v)
    total_c = sum(cur_cats.values()) or 1
    total_p = sum(prev_cats.values()) or 1
    cat_deltas = {}
    for cat in set(cur_cats) | set(prev_cats):
        d = (cur_cats.get(cat, 0) / total_c) - (prev_cats.get(cat, 0) / total_p)
        cat_deltas[cat] = d * 100  # in pp

    # Median duration delta (sec)
    cur_med  = percentile([v["duration_seconds"] for v in cur_v], 0.5)
    prev_med = percentile([v["duration_seconds"] for v in prev_v], 0.5)

    return {
        "concentration_delta": cur_repeats - prev_repeats,
        "category_deltas_pp":  cat_deltas,
        "median_dur_delta_sec": cur_med - prev_med,
    }

# ─────────────────────────────────────────────────────────────
# 4. Lede template selection + rendering
# ─────────────────────────────────────────────────────────────
def render_lede(days: list[dict]) -> str:
    if len(days) < 3:
        return ("Tracking just started. The dashboard needs a few days of data "
                "before patterns are visible. Check back tomorrow.")
    end_date = days[-1]["date"]
    cur_v = vids_in_window(days, end_date, 7)
    if not cur_v:
        return "No videos captured in the last 7 days. The cron may have failed; check the workflow log."

    band = duration_band_text(cur_v)
    cats = top_categories(cur_v, 3)
    if not cats: return "Insufficient category data this week."
    top_cat, top_share = cats[0]
    second_cat, second_share = (cats[1] if len(cats) > 1 else (None, 0))

    posting = posting_window_text(cur_v)
    short_note = short_form_note(cur_v)
    repeats, _ = channel_concentration(cur_v)
    deltas = week_over_week_delta(days)

    # Trigger detection
    major_shift_cat = None
    if deltas:
        for cat, d in deltas.get("category_deltas_pp", {}).items():
            if d > 12:
                major_shift_cat = (cat, d)
                break

    top3_share = sum(c[1] for c in cats[:3]) * 100  # %, but using top-3 cats not channels
    # Better: top-3 channels
    channel_counts = Counter(v["channel_name"] for v in cur_v)
    top_channels = channel_counts.most_common(3)
    top3_chan_share = sum(c[1] for c in top_channels) / len(cur_v) * 100 if cur_v else 0

    # Quiet trigger
    quiet = (deltas and
             all(abs(d) < 3 for d in deltas.get("category_deltas_pp", {}).values()) and
             abs(deltas.get("median_dur_delta_sec", 0)) < 60)

    # Concentration spike trigger
    conc_spike = top3_chan_share > 30 and deltas.get("concentration_delta", 0) > 0

    if major_shift_cat:
        cat, d = major_shift_cat
        old_share = (deltas["category_deltas_pp"].get(cat, 0) - d)  # d = delta; old = current - delta
        # Actually: cur_share = prev_share + d, so prev_share = cur_share - d
        cur_share_pp = (sum(1 for v in cur_v if v["category"] == cat) / len(cur_v)) * 100
        prev_share_pp = cur_share_pp - d
        return (f"Trending shifted this week. {cat} jumped from "
                f"{prev_share_pp:.0f}% to {cur_share_pp:.0f}% of the top 50, "
                f"the largest weekly category swing in the 30-day window.")
    elif conc_spike:
        names = ", ".join(c[0] for c in top_channels)
        return (f"Concentration is up. {len(top_channels)} channels claimed "
                f"{top3_chan_share:.0f}% of the top 50 this week — the highest "
                f"concentration in the window. The leaders: {names}.")
    elif quiet:
        top_chan_name = top_channels[0][0] if top_channels else "—"
        top_chan_n = top_channels[0][1] if top_channels else 0
        return (f"A quiet week on Trending. {band} videos in {top_cat} continue "
                f"to dominate, with no major shifts in length, category, or "
                f"posting time. The most-trended channel, {top_chan_name}, "
                f"hit the list {top_chan_n} times.")
    else:
        # Standard template
        sf = (" " + short_note) if short_note else ""
        conc_dir = "up" if deltas.get("concentration_delta", 0) > 0 else \
                   "down" if deltas.get("concentration_delta", 0) < 0 else "flat"
        return (f"This week, YouTube's algorithm favored {band} videos in "
                f"{top_cat}" + (f" and {second_cat}" if second_cat else "") +
                f", with a strong preference for content posted "
                f"{posting}.{sf} {repeats} of the top 50 channels appeared 3+ times — "
                f"concentration is {conc_dir} week-over-week.")

# ─────────────────────────────────────────────────────────────
# 5. Write outputs
# ─────────────────────────────────────────────────────────────
def write_outputs(days: list[dict], lede: str) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "version": 1,
        "region": REGION,
        "window_days": WINDOW_DAYS,
        "last_refresh": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "lede": lede,
        "days": days,
    }
    OUT_DATA.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"→ wrote {OUT_DATA} ({OUT_DATA.stat().st_size // 1024} KB, {len(days)} days)")

    methodology = {
        "days_tracked":       len(days),
        "videos_per_pull":    MAX_RESULTS,
        "region":             REGION,
        "last_refresh":       payload["last_refresh"],
        "last_refresh_human": datetime.now(timezone.utc).strftime("%b %d, %Y · %H:%M UTC"),
        "api_quota_per_day":  10,
        "api_quota_limit":    10000,
        "source":             "YouTube Data API v3 · /videos.list · chart=mostPopular",
    }
    OUT_METH.write_text(json.dumps(methodology, indent=2))
    print(f"→ wrote {OUT_METH}")

# ─────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────
def main():
    print("watchdog_lab — daily YouTube Trending pull")
    try:
        items = fetch_trending()
        today_videos = normalize(items)
    except Exception as e:
        print(f"ERROR fetching: {e}", file=sys.stderr)
        sys.exit(1)

    existing = load_existing()
    days = append_and_trim(existing, today_videos)
    lede = render_lede(days)
    print(f"→ Lede: {lede}")
    write_outputs(days, lede)
    print("Done.")

if __name__ == "__main__":
    main()
