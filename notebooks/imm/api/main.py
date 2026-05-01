"""IMM Lab — Cloud Run prediction API.

POST /predict with a channel allocation; returns predicted weekly revenue
plus 90% CI computed over the posterior ensemble.

Loads the trained model artifact from Cloud Storage on cold start.
Frontend can drop this in by setting `window.IMM_API_URL = 'https://...'`
before imm-lab.js loads.

Local dev:
    uvicorn main:app --reload --port 8080

Deploy:
    See notebooks/imm/SETUP.md → "Deploy the prediction API to Cloud Run"
"""
from __future__ import annotations

import os
import pickle
import time
from collections import defaultdict
from typing import Any

import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

GCS_BUCKET = os.environ.get("IMM_GCS_BUCKET", "")
MODEL_PATH = os.environ.get("IMM_MODEL_PATH", "imm/imm_model.pkl")
LOCAL_FALLBACK = os.environ.get("IMM_LOCAL_MODEL", "/app/imm_model.pkl")

app = FastAPI(title="IMM Lab Prediction API", version="1.0.0")

# CORS — locked to the production origin in deploy; permissive for local dev.
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("IMM_CORS_ORIGINS", "https://jakecuth.com,https://jakecuth.pages.dev").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ── Model loader (lazy, cached) ─────────────────────────────────────────
_model_cache: dict[str, Any] | None = None


def load_model() -> dict[str, Any]:
    global _model_cache
    if _model_cache is not None:
        return _model_cache
    if GCS_BUCKET:
        from google.cloud import storage
        client = storage.Client()
        bucket = client.bucket(GCS_BUCKET)
        blob = bucket.blob(MODEL_PATH)
        data = blob.download_as_bytes()
        _model_cache = pickle.loads(data)
    else:
        with open(LOCAL_FALLBACK, "rb") as f:
            _model_cache = pickle.load(f)
    return _model_cache


# ── Rate limiting (in-memory, per-IP) ───────────────────────────────────
RATE_LIMIT = int(os.environ.get("IMM_RATE_LIMIT_PER_MIN", "10"))
_rate_window: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(ip: str) -> None:
    now = time.time()
    window = _rate_window[ip]
    # Drop events older than 60s
    while window and now - window[0] > 60:
        window.pop(0)
    if len(window) >= RATE_LIMIT:
        raise HTTPException(status_code=429, detail=f"Rate limited at {RATE_LIMIT} req/min")
    window.append(now)


# ── Request/response shapes ─────────────────────────────────────────────
class Allocation(BaseModel):
    tiktok_creator: float = Field(ge=0, le=500_000)
    instagram_creator: float = Field(ge=0, le=500_000)
    youtube_creator: float = Field(ge=0, le=500_000)
    meta_paid: float = Field(ge=0, le=500_000)
    tiktok_paid: float = Field(ge=0, le=500_000)
    paid_search: float = Field(ge=0, le=500_000)
    programmatic: float = Field(ge=0, le=500_000)
    retail_media: float = Field(ge=0, le=500_000)


class PredictRequest(BaseModel):
    allocation: Allocation


class PredictResponse(BaseModel):
    mean: float
    lo: float
    median: float
    hi: float
    library: str


# ── Math (Hill + adstock steady-state, vectorized) ──────────────────────
def predict_revenue(allocation: dict[str, float], model: dict[str, Any]) -> dict[str, float]:
    posteriors = model["posteriors"]
    diagnostics = model.get("diagnostics", {})
    baseline = model.get("baseline", 220_000)
    channel_ids = list(allocation.keys())
    n_samples = len(posteriors[channel_ids[0]])

    totals = np.full(n_samples, baseline, dtype=float)
    for cid in channel_ids:
        x = allocation[cid]
        samples = posteriors[cid]
        for i, p in enumerate(samples):
            xa = x / max(1e-9, 1 - p["lambda"])
            totals[i] += p["alpha"] * (xa ** p["s"]) / (p["kappa"] ** p["s"] + xa ** p["s"])
    totals.sort()
    return {
        "mean": float(totals.mean()),
        "lo": float(totals[int(len(totals) * 0.05)]),
        "median": float(totals[int(len(totals) * 0.50)]),
        "hi": float(totals[int(len(totals) * 0.95)]),
        "library": diagnostics.get("library", "imm-lab"),
    }


# ── Routes ──────────────────────────────────────────────────────────────
@app.get("/")
def root() -> dict[str, str]:
    return {"service": "imm-lab-api", "status": "ok"}


@app.get("/health")
def health() -> dict[str, str]:
    try:
        load_model()
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest, request: Request) -> PredictResponse:
    ip = request.client.host if request.client else "unknown"
    check_rate_limit(ip)
    model = load_model()
    out = predict_revenue(req.allocation.model_dump(), model)
    return PredictResponse(**out)
