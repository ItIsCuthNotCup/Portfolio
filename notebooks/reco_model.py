"""
reco_model.py — reproducible movie-recommendation pipeline for the
MovieLens ml-latest-small dataset. Generates all JSON artifacts consumed by
/work/reco-lab/ on the portfolio site.

Run:
    export TMDB_API_KEY=<your_key>      # https://www.themoviedb.org/settings/api
    python notebooks/reco_model.py

Inputs (auto-downloaded on first run):
    data/ml-latest-small/ratings.csv
    data/ml-latest-small/movies.csv
    data/ml-latest-small/tags.csv
    data/ml-latest-small/links.csv

Outputs (written to assets/data/reco/):
    movies.json              curated ~200 titles with TMDB poster URLs
    similarity_content.json  top-20 neighbors per movie (TF-IDF genres+tags)
    similarity_collab.json   top-20 neighbors per movie (item-item CF)
    similarity_hybrid.json   top-20 neighbors per movie (weighted blend)
    rows.json                curated homepage rows (genre, decade, top picks)
    methodology.json         dataset sizes, timestamps, hyperparameters

No runtime API calls, no backend. The frontend fetches the above JSON only.
"""

from __future__ import annotations

import io
import json
import os
import time
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# ── Paths & config ─────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "ml-latest-small"
OUT_DIR = ROOT / "assets" / "data" / "reco"
OUT_DIR.mkdir(parents=True, exist_ok=True)

MOVIELENS_URL = "https://files.grouplens.org/datasets/movielens/ml-latest-small.zip"
TMDB_API_KEY = os.environ.get("TMDB_API_KEY", "").strip()
TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w342"

# Curation thresholds — picked to yield ~200 titles with good visual coverage.
MIN_RATINGS = 50
MIN_AVG_RATING = 3.3
TOP_K_NEIGHBORS = 20
HYBRID_ALPHA = 0.5  # 0.5 * content + 0.5 * collab

SEED = 42
np.random.seed(SEED)


# ══════════════════════════════════════════════════════════════════
# 1. DATA LOADING
# ══════════════════════════════════════════════════════════════════
def ensure_movielens() -> None:
    """Download + extract ml-latest-small if not already present."""
    if (DATA_DIR / "ratings.csv").exists():
        return
    DATA_DIR.parent.mkdir(parents=True, exist_ok=True)
    print(f"[reco] downloading MovieLens ml-latest-small → {DATA_DIR}")
    with urlopen(MOVIELENS_URL, timeout=60) as resp:
        payload = resp.read()
    with zipfile.ZipFile(io.BytesIO(payload)) as zf:
        zf.extractall(DATA_DIR.parent)


def load_movielens() -> dict[str, pd.DataFrame]:
    ensure_movielens()
    return {
        "ratings": pd.read_csv(DATA_DIR / "ratings.csv"),
        "movies":  pd.read_csv(DATA_DIR / "movies.csv"),
        "tags":    pd.read_csv(DATA_DIR / "tags.csv"),
        "links":   pd.read_csv(DATA_DIR / "links.csv"),
    }


# ══════════════════════════════════════════════════════════════════
# 2. CURATION
# ══════════════════════════════════════════════════════════════════
def curate_movies(ml: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Filter to well-rated, well-known titles that have a TMDB id."""
    ratings = ml["ratings"]
    movies = ml["movies"]
    links = ml["links"]

    agg = (
        ratings.groupby("movieId")
        .agg(num_ratings=("rating", "size"), avg_rating=("rating", "mean"))
        .reset_index()
    )

    df = (
        movies.merge(agg, on="movieId")
        .merge(links[["movieId", "tmdbId"]], on="movieId")
    )
    df = df[df["num_ratings"] >= MIN_RATINGS]
    df = df[df["avg_rating"] >= MIN_AVG_RATING]
    df = df.dropna(subset=["tmdbId"])
    df["tmdbId"] = df["tmdbId"].astype(int)

    # Parse year from "Toy Story (1995)" → 1995
    df["year"] = (
        df["title"].str.extract(r"\((\d{4})\)$")[0]
        .astype("Int64")
    )
    df["title_clean"] = df["title"].str.replace(r"\s*\(\d{4}\)$", "", regex=True)

    # Rank by a simple popularity-adjusted rating (IMDB-style weighted rating).
    # weight = v / (v + m) where v = num_ratings, m = threshold
    m = MIN_RATINGS
    C = df["avg_rating"].mean()
    df["score"] = (df["num_ratings"] / (df["num_ratings"] + m)) * df["avg_rating"] + (
        m / (df["num_ratings"] + m)
    ) * C
    df = df.sort_values("score", ascending=False).reset_index(drop=True)
    return df


def build_top_tags(ml: dict[str, pd.DataFrame], movie_ids: set[int]) -> dict[int, list[str]]:
    """Per-movie top user tags (for explainability on the frontend)."""
    tags = ml["tags"][ml["tags"]["movieId"].isin(movie_ids)].copy()
    tags["tag"] = tags["tag"].astype(str).str.lower().str.strip()
    counts = (
        tags.groupby(["movieId", "tag"]).size().reset_index(name="n")
        .sort_values(["movieId", "n"], ascending=[True, False])
    )
    out: dict[int, list[str]] = {}
    for mid, grp in counts.groupby("movieId"):
        out[int(mid)] = grp["tag"].head(6).tolist()
    return out


# ══════════════════════════════════════════════════════════════════
# 3. TMDB POSTER FETCH
# ══════════════════════════════════════════════════════════════════
def fetch_tmdb_posters(tmdb_ids: list[int]) -> dict[int, str | None]:
    """Look up /movie/{id} for each tmdbId; return {tmdbId: poster_url or None}.

    No API key → returns all None so the pipeline still runs end to end.
    """
    if not TMDB_API_KEY:
        print("[reco] TMDB_API_KEY not set — emitting null poster URLs")
        return {tid: None for tid in tmdb_ids}

    out: dict[int, str | None] = {}
    for i, tid in enumerate(tmdb_ids):
        url = f"https://api.themoviedb.org/3/movie/{tid}?api_key={TMDB_API_KEY}"
        req = Request(url, headers={"User-Agent": "jakecuth.com/reco-lab/1.0"})
        try:
            with urlopen(req, timeout=10) as resp:
                body = json.loads(resp.read().decode("utf-8"))
            path = body.get("poster_path")
            out[tid] = TMDB_POSTER_BASE + path if path else None
        except Exception as e:  # noqa: BLE001
            print(f"[reco] tmdb fetch failed for {tid}: {e}")
            out[tid] = None
        # Gentle rate limit — TMDB allows ~40/10s.
        if (i + 1) % 30 == 0:
            time.sleep(1.0)
            print(f"[reco] tmdb {i + 1}/{len(tmdb_ids)}")
    return out


# ══════════════════════════════════════════════════════════════════
# 4. SIMILARITY MATRICES
# ══════════════════════════════════════════════════════════════════
def build_content_sim(curated: pd.DataFrame, top_tags: dict[int, list[str]]) -> np.ndarray:
    """TF-IDF over genres + top user tags → cosine similarity."""
    docs = []
    for _, row in curated.iterrows():
        mid = int(row["movieId"])
        genres = row["genres"].replace("|", " ").replace("(no genres listed)", "")
        tag_str = " ".join(top_tags.get(mid, []))
        # Repeat genres to give them weight over tags in the TF-IDF.
        docs.append(f"{genres} {genres} {tag_str}".lower().strip())

    vec = TfidfVectorizer(min_df=1, ngram_range=(1, 2), token_pattern=r"[A-Za-z][A-Za-z\-]+")
    X = vec.fit_transform(docs)
    return cosine_similarity(X).astype(np.float32)


def build_collab_sim(ratings: pd.DataFrame, curated: pd.DataFrame) -> np.ndarray:
    """Item-item cosine over mean-centered user ratings."""
    movie_ids = curated["movieId"].tolist()
    r = ratings[ratings["movieId"].isin(movie_ids)].copy()

    # Mean-centre per user so "everyone rates 5" doesn't dominate.
    user_means = r.groupby("userId")["rating"].transform("mean")
    r["rating_c"] = r["rating"] - user_means

    mat = r.pivot_table(
        index="userId", columns="movieId", values="rating_c", fill_value=0.0,
    )
    # Reindex columns to match curated order
    mat = mat.reindex(columns=movie_ids, fill_value=0.0)
    sim = cosine_similarity(mat.T.values).astype(np.float32)
    return sim


def top_k_neighbors(sim: np.ndarray, movie_ids: list[int], k: int = TOP_K_NEIGHBORS) -> dict[str, list[list[float]]]:
    """For each movie row i, return the top-k most similar other movies.

    Emits {movieId (str): [[neighbor_id, similarity], ...]}.
    """
    neighbors: dict[str, list[list[float]]] = {}
    n = sim.shape[0]
    for i in range(n):
        row = sim[i].copy()
        row[i] = -1.0  # drop self
        idx = np.argpartition(-row, kth=k)[:k]
        idx = idx[np.argsort(-row[idx])]
        pairs = [[int(movie_ids[j]), round(float(row[j]), 4)] for j in idx if row[j] > 0]
        neighbors[str(movie_ids[i])] = pairs
    return neighbors


# ══════════════════════════════════════════════════════════════════
# 5. HOMEPAGE ROW CURATION
# ══════════════════════════════════════════════════════════════════
def build_rows(curated: pd.DataFrame) -> list[dict]:
    """Curated homepage rows — genres + decades, Netflix-style."""
    rows: list[dict] = []

    # Top picks — seeded globally top-rated, overwritten per-user on the frontend.
    rows.append({
        "id": "top-picks",
        "title": "Top Picks",
        "kind": "seeded",
        "ids": curated.head(20)["movieId"].tolist(),
    })

    # Popular genre rows
    genre_priority = [
        ("Drama", "Dramas"),
        ("Comedy", "Comedies"),
        ("Action", "Action"),
        ("Thriller", "Thrillers"),
        ("Sci-Fi", "Sci-Fi & Fantasy"),
        ("Horror", "Horror"),
        ("Crime", "Crime"),
        ("Romance", "Romance"),
        ("Animation", "Animated"),
        ("Documentary", "Documentaries"),
    ]
    for tag, title in genre_priority:
        sub = curated[curated["genres"].str.contains(tag, na=False, regex=False)]
        if len(sub) >= 8:
            rows.append({
                "id": f"genre-{tag.lower().replace(' ', '-').replace('-', '_')}",
                "title": title,
                "kind": "genre",
                "ids": sub.head(20)["movieId"].tolist(),
            })

    # Decade rows (feels very editorial)
    decades = [(1990, "The '90s"), (1980, "The '80s"), (2000, "The 2000s")]
    for start, title in decades:
        mask = (curated["year"] >= start) & (curated["year"] < start + 10)
        sub = curated[mask]
        if len(sub) >= 8:
            rows.append({
                "id": f"decade-{start}",
                "title": title,
                "kind": "decade",
                "ids": sub.head(20)["movieId"].tolist(),
            })
    return rows


# ══════════════════════════════════════════════════════════════════
# 6. SERIALIZATION
# ══════════════════════════════════════════════════════════════════
def write_json(name: str, obj) -> None:
    path = OUT_DIR / f"{name}.json"
    with path.open("w", encoding="utf-8") as f:
        json.dump(obj, f, separators=(",", ":"))
    size_kb = path.stat().st_size / 1024
    print(f"[reco] wrote {name}.json ({size_kb:.1f} KB)")


# ══════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════
def main() -> None:
    t0 = time.time()
    ml = load_movielens()
    print(
        f"[reco] MovieLens loaded — "
        f"{len(ml['ratings']):,} ratings · "
        f"{len(ml['movies']):,} movies · "
        f"{ml['ratings']['userId'].nunique():,} users"
    )

    curated = curate_movies(ml)
    print(f"[reco] curated to {len(curated)} titles (≥{MIN_RATINGS} ratings, avg ≥ {MIN_AVG_RATING})")

    top_tags = build_top_tags(ml, set(curated["movieId"].tolist()))

    # Posters
    posters = fetch_tmdb_posters(curated["tmdbId"].tolist())
    curated["poster"] = curated["tmdbId"].map(posters)

    # If we have TMDB keys but posters missing, drop those titles so the grid
    # doesn't render holes. If no key at all, keep them and emit nulls.
    if TMDB_API_KEY:
        before = len(curated)
        curated = curated[curated["poster"].notna()].reset_index(drop=True)
        print(f"[reco] dropped {before - len(curated)} titles missing TMDB posters")

    movie_ids = curated["movieId"].astype(int).tolist()

    # Similarity matrices
    print("[reco] building content-based similarity …")
    sim_content = build_content_sim(curated, top_tags)
    print("[reco] building collaborative similarity …")
    sim_collab = build_collab_sim(ml["ratings"], curated)
    print("[reco] blending hybrid similarity …")
    sim_hybrid = HYBRID_ALPHA * sim_content + (1 - HYBRID_ALPHA) * sim_collab

    # Top-K neighbors per algorithm
    content_neighbors = top_k_neighbors(sim_content, movie_ids)
    collab_neighbors = top_k_neighbors(sim_collab, movie_ids)
    hybrid_neighbors = top_k_neighbors(sim_hybrid, movie_ids)

    # Assemble movies.json (frontend-friendly)
    movies_payload = {
        "poster_base": TMDB_POSTER_BASE,
        "movies": [
            {
                "id": int(row["movieId"]),
                "tmdbId": int(row["tmdbId"]),
                "title": row["title_clean"],
                "year": int(row["year"]) if pd.notna(row["year"]) else None,
                "genres": [g for g in row["genres"].split("|") if g != "(no genres listed)"],
                "avg_rating": round(float(row["avg_rating"]), 2),
                "num_ratings": int(row["num_ratings"]),
                "poster": row["poster"],
                "tags": top_tags.get(int(row["movieId"]), []),
            }
            for _, row in curated.iterrows()
        ],
    }

    # Rows
    rows = build_rows(curated)

    # Methodology + receipts
    methodology = {
        "dataset": "MovieLens ml-latest-small",
        "source": "https://grouplens.org/datasets/movielens/latest/",
        "num_ratings": int(len(ml["ratings"])),
        "num_users": int(ml["ratings"]["userId"].nunique()),
        "num_movies_total": int(len(ml["movies"])),
        "num_movies_displayed": int(len(curated)),
        "min_ratings_threshold": MIN_RATINGS,
        "min_avg_rating": MIN_AVG_RATING,
        "top_k_neighbors": TOP_K_NEIGHBORS,
        "hybrid_alpha": HYBRID_ALPHA,
        "precomputed_pairs": int(len(curated) * TOP_K_NEIGHBORS * 3),
        "poster_source": "TMDB" if TMDB_API_KEY else "placeholder",
        "regenerated_at": datetime.now(timezone.utc).isoformat(),
        "build_seconds": None,  # filled just before write
    }

    # Serialize
    write_json("movies", movies_payload)
    write_json("similarity_content", {
        "alg": "content",
        "note": "TF-IDF on genres(×2) + top user tags, cosine similarity.",
        "neighbors": content_neighbors,
    })
    write_json("similarity_collab", {
        "alg": "collab",
        "note": "Item-item cosine on mean-centered user ratings.",
        "neighbors": collab_neighbors,
    })
    write_json("similarity_hybrid", {
        "alg": "hybrid",
        "note": f"alpha * content + (1-alpha) * collab, alpha={HYBRID_ALPHA}.",
        "neighbors": hybrid_neighbors,
    })
    write_json("rows", {"rows": rows})

    methodology["build_seconds"] = round(time.time() - t0, 1)
    write_json("methodology", methodology)

    print(f"[reco] done in {methodology['build_seconds']}s")


if __name__ == "__main__":
    main()
