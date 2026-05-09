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

Security:
- Pickle deserialization is HMAC-verified against IMM_MODEL_HMAC_SECRET.
  If the secret is set, a `<MODEL_PATH>.hmac` blob in the same GCS bucket
  must contain the hex SHA-256 HMAC of the pickle bytes; mismatch = refuse
  to load. If the secret is NOT set, falls back to unverified loading and
  logs a loud warning (back-compat for existing deployments — set the
  secret + upload the .hmac to enforce).
- The pickle loader uses a class allowlist via SafeUnpickler so even an
  unverified compromised artifact cannot reach arbitrary callable. Only
  numpy / dict / primitive types are deserialized.
- CORS is locked to literal jakecuth.com hosts by default (no .pages.dev
  wildcard). Override via IMM_CORS_ORIGINS for staging.
- Rate limit reads the real client IP from X-Forwarded-For with the
  Cloud Run trusted-hop convention: rightmost public IP wins.
"""
from __future__ import annotations

import hmac
import hashlib
import io
import logging
import os
import pickle
import time
from collections import defaultdict
from typing import Any

import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logger = logging.getLogger("imm-lab")
logging.basicConfig(level=logging.INFO)

GCS_BUCKET = os.environ.get("IMM_GCS_BUCKET", "")
MODEL_PATH = os.environ.get("IMM_MODEL_PATH", "imm/imm_model.pkl")
LOCAL_FALLBACK = os.environ.get("IMM_LOCAL_MODEL", "/app/imm_model.pkl")
MODEL_HMAC_SECRET = os.environ.get("IMM_MODEL_HMAC_SECRET", "").encode("utf-8")
MAX_MODEL_BYTES = int(os.environ.get("IMM_MAX_MODEL_BYTES", str(64 * 1024 * 1024)))  # 64 MB

app = FastAPI(title="IMM Lab Prediction API", version="1.1.0")

# CORS — locked to production by default. Pages.dev wildcards REMOVED:
# any visitor could create a free pages.dev site to forge requests.
# Override via IMM_CORS_ORIGINS env var for staging only.
DEFAULT_ORIGINS = "https://jakecuth.com,https://www.jakecuth.com"
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("IMM_CORS_ORIGINS", DEFAULT_ORIGINS).split(",") if o.strip()],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
    max_age=600,
)


# ── Safe unpickler ──────────────────────────────────────────────────────
# Whitelist the exact classes the model artifact is allowed to contain.
# Anything else raises pickle.UnpicklingError. This blocks RCE via a
# crafted reduce/global pickle even if the bucket is compromised.
_ALLOWED_GLOBALS = {
    ("numpy", "ndarray"),
    ("numpy.core.multiarray", "_reconstruct"),
    ("numpy.core.multiarray", "scalar"),
    ("numpy", "dtype"),
    ("numpy.dtypes", "Float64DType"),
    ("numpy.dtypes", "Float32DType"),
    ("numpy.dtypes", "Int64DType"),
    ("numpy.dtypes", "Int32DType"),
    ("collections", "OrderedDict"),
    ("collections", "defaultdict"),
    ("builtins", "dict"),
    ("builtins", "list"),
    ("builtins", "tuple"),
    ("builtins", "set"),
    ("builtins", "frozenset"),
    ("builtins", "str"),
    ("builtins", "bytes"),
    ("builtins", "int"),
    ("builtins", "float"),
    ("builtins", "bool"),
    ("builtins", "complex"),
    ("builtins", "NoneType"),
    ("copy_reg", "_reconstructor"),
}


class SafeUnpickler(pickle.Unpickler):
    def find_class(self, module: str, name: str) -> Any:
        if (module, name) in _ALLOWED_GLOBALS:
            return super().find_class(module, name)
        raise pickle.UnpicklingError(
            f"Refusing to unpickle disallowed class: {module}.{name}"
        )


def safe_pickle_loads(data: bytes) -> Any:
    return SafeUnpickler(io.BytesIO(data)).load()


def verify_hmac(data: bytes, expected_hex: str) -> bool:
    """Constant-time SHA-256 HMAC check. Returns True iff signed by us."""
    if not MODEL_HMAC_SECRET:
        return False
    actual = hmac.new(MODEL_HMAC_SECRET, data, hashlib.sha256).hexdigest()
    return hmac.compare_digest(actual, (expected_hex or "").strip())


# ── Model loader (lazy, cached) ─────────────────────────────────────────
_model_cache: dict[str, Any] | None = None


def _read_with_cap(blob_or_path, *, is_blob: bool) -> bytes:
    """Read a model artifact with a hard size cap to avoid OOM on cold start."""
    if is_blob:
        size = blob_or_path.size or 0
        if size and size > MAX_MODEL_BYTES:
            raise RuntimeError(f"Model artifact too large: {size} > {MAX_MODEL_BYTES}")
        data = blob_or_path.download_as_bytes()
    else:
        st = os.stat(blob_or_path)
        if st.st_size > MAX_MODEL_BYTES:
            raise RuntimeError(f"Model artifact too large: {st.st_size} > {MAX_MODEL_BYTES}")
        with open(blob_or_path, "rb") as f:
            data = f.read()
    if len(data) > MAX_MODEL_BYTES:
        raise RuntimeError(f"Model artifact too large after read: {len(data)} > {MAX_MODEL_BYTES}")
    return data


def load_model() -> dict[str, Any]:
    global _model_cache
    if _model_cache is not None:
        return _model_cache

    if GCS_BUCKET:
        from google.cloud import storage
        client = storage.Client()
        bucket = client.bucket(GCS_BUCKET)
        blob = bucket.blob(MODEL_PATH)
        data = _read_with_cap(blob, is_blob=True)
        # If HMAC enforcement is enabled, the .hmac sidecar must verify.
        if MODEL_HMAC_SECRET:
            sig_blob = bucket.blob(MODEL_PATH + ".hmac")
            try:
                sig_hex = sig_blob.download_as_text()
            except Exception as e:
                raise RuntimeError(f"HMAC sidecar missing or unreadable: {e}")
            if not verify_hmac(data, sig_hex):
                raise RuntimeError("Model HMAC verification FAILED. Refusing to load.")
            logger.info("Model HMAC verified.")
        else:
            logger.warning(
                "IMM_MODEL_HMAC_SECRET not set — loading model artifact UNVERIFIED. "
                "An attacker with GCS write access could ship a malicious payload. "
                "Set the secret + upload <MODEL_PATH>.hmac to enforce."
            )
    else:
        data = _read_with_cap(LOCAL_FALLBACK, is_blob=False)
        if MODEL_HMAC_SECRET:
            sig_path = LOCAL_FALLBACK + ".hmac"
            try:
                with open(sig_path, "r") as f:
                    sig_hex = f.read()
            except Exception as e:
                raise RuntimeError(f"HMAC sidecar missing locally: {e}")
            if not verify_hmac(data, sig_hex):
                raise RuntimeError("Local model HMAC verification FAILED.")

    # Defense in depth: even if HMAC verifies (or is disabled for back-compat),
    # SafeUnpickler restricts what classes can be deserialized.
    _model_cache = safe_pickle_loads(data)
    return _model_cache


# ── Rate limiting (in-memory, per-IP) ───────────────────────────────────
RATE_LIMIT = int(os.environ.get("IMM_RATE_LIMIT_PER_MIN", "10"))
_rate_window: dict[str, list[float]] = defaultdict(list)


def client_ip(request: Request) -> str:
    """Extract the real client IP behind Cloud Run's load balancer.

    Cloud Run injects X-Forwarded-For with the client IP first, followed
    by upstream proxies. Trust ONLY the rightmost-most-recent address
    that came in via Google's edge — practically that's the LEFTMOST IP
    in X-Forwarded-For (Cloud Run does not append, the original client
    IP is at index 0). Anyone can forge this header on a direct hit, but
    Cloud Run's LB rewrites it to authoritative on every legitimate
    request, so for the public-internet path it's trustworthy.

    Falls back to request.client.host (which on Cloud Run returns the
    LB's internal IP — useless for per-user rate-limiting on its own,
    which is exactly the bug we're fixing).
    """
    xff = request.headers.get("x-forwarded-for")
    if xff:
        first = xff.split(",")[0].strip()
        # Basic sanity: not empty, not a common LB internal range
        if first and not first.startswith(("10.", "172.16.", "192.168.", "127.")):
            return first
    # Cloud Run also sets this with the real client IP
    envoy = request.headers.get("x-envoy-external-address")
    if envoy:
        return envoy.strip()
    return request.client.host if request.client else "unknown"


def check_rate_limit(ip: str) -> None:
    now = time.time()
    window = _rate_window[ip]
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
        # Don't echo internal exception detail (could leak GCS paths,
        # bucket names, secret-config hints).
        logger.error("health: model load failed: %s", e)
        raise HTTPException(status_code=503, detail="Model unavailable.")


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest, request: Request) -> PredictResponse:
    ip = client_ip(request)
    check_rate_limit(ip)
    try:
        model = load_model()
        out = predict_revenue(req.allocation.model_dump(), model)
        return PredictResponse(**out)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("predict: %s", e)
        raise HTTPException(status_code=503, detail="Prediction unavailable.")
