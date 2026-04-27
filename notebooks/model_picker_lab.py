"""
model_picker_lab.py — build the searchable index for the Model Picker lab.

What it does:
  1. Pulls the public OpenRouter model catalog from
     https://openrouter.ai/api/v1/models (no auth required for listing).
  2. For each model, builds a chunk: provider, name, ID, context length,
     input/output prices per 1M tokens, modalities (text/vision/audio),
     tool/function calling support, JSON mode support, reasoning flag,
     latency tier (heuristic), open-source flag, and a one-line "best
     for" tagline derived from the description (no scraped benchmarks).
  3. Embeds each chunk via OpenRouter's embeddings endpoint using
     google/gemini-embedding-2-preview (so embedding + generation share
     a single API key).
  4. Writes:
        ../assets/data/model-picker/models.json        # full index
        ../assets/data/model-picker/methodology.json   # receipts panel

Usage:
    OPENROUTER_API_KEY=sk-or-v1-... python notebooks/model_picker_lab.py

Re-run weekly. The GitHub Action at
.github/workflows/refresh-model-picker.yml automates this.
"""

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

# ─────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
EMBED_MODEL = "google/gemini-embedding-2-preview"
LIST_URL    = "https://openrouter.ai/api/v1/models"
EMBED_URL   = "https://openrouter.ai/api/v1/embeddings"

ROOT      = Path(__file__).resolve().parents[1]
OUT_DIR   = ROOT / "assets" / "data" / "model-picker"
MODELS_OUT      = OUT_DIR / "models.json"
METHODOLOGY_OUT = OUT_DIR / "methodology.json"

REQUEST_TIMEOUT = 60
EMBED_BATCH_DELAY_MS = 60  # be polite

# ─────────────────────────────────────────────────────────────
# Heuristics
# ─────────────────────────────────────────────────────────────
OPEN_SOURCE_PROVIDERS = {
    "meta-llama", "mistralai", "qwen", "deepseek", "google/gemma",
    "microsoft/phi", "nousresearch", "01-ai", "huggingfaceh4",
    "alibaba", "x-ai/grok-2-mini",  # very partial, expand as needed
}
OPEN_SOURCE_KEYWORDS = ("llama", "mistral", "mixtral", "qwen", "deepseek",
                        "gemma", "phi-", "yi-", "command-r", "olmo")

# Latency tier inferred from provider class + model size cues. NOT measured.
def latency_tier(model_id: str, name: str) -> str:
    s = (model_id + " " + name).lower()
    if any(k in s for k in ("flash", "mini", "haiku", "8b", "9b", "small",
                            "instant", "lite", "nano")):
        return "fast"
    if any(k in s for k in ("opus", "ultra", "405b", "70b", "72b", "thinking",
                            "reasoning", "o1")):
        return "slow"
    return "medium"

# Reasoning flag: model card text often says so explicitly.
def is_reasoning(model: dict) -> bool:
    s = ((model.get("description") or "") + " " + (model.get("id") or "")).lower()
    return any(k in s for k in ("reasoning", "chain-of-thought",
                                "o1-", "deepseek-r1", "thinking"))

def is_open_source(model_id: str) -> bool:
    s = model_id.lower()
    if any(s.startswith(p) for p in OPEN_SOURCE_PROVIDERS):
        return True
    return any(k in s for k in OPEN_SOURCE_KEYWORDS)

# ─────────────────────────────────────────────────────────────
# Pull catalog
# ─────────────────────────────────────────────────────────────
def fetch_catalog() -> list[dict]:
    print(f"→ Fetching catalog from {LIST_URL}")
    r = requests.get(LIST_URL, timeout=REQUEST_TIMEOUT)
    r.raise_for_status()
    data = r.json().get("data", [])
    print(f"  {len(data)} models returned")
    return data

# ─────────────────────────────────────────────────────────────
# Build chunks
# ─────────────────────────────────────────────────────────────
def build_chunks(models: list[dict]) -> list[dict]:
    chunks = []
    for m in models:
        mid = m.get("id") or ""
        if not mid:
            continue
        provider = mid.split("/")[0] if "/" in mid else "unknown"
        name = m.get("name") or mid

        pricing = m.get("pricing") or {}
        # OpenRouter prices are USD per token. Multiply by 1e6 for "$/M tokens".
        try:
            input_per_m  = float(pricing.get("prompt", 0))     * 1_000_000
        except (TypeError, ValueError):
            input_per_m = None
        try:
            output_per_m = float(pricing.get("completion", 0)) * 1_000_000
        except (TypeError, ValueError):
            output_per_m = None

        context_length = m.get("context_length")
        try:
            context_length = int(context_length) if context_length is not None else None
        except (TypeError, ValueError):
            context_length = None

        max_output = None
        try:
            max_output = m.get("top_provider", {}).get("max_completion_tokens")
            if max_output is not None:
                max_output = int(max_output)
        except (TypeError, ValueError, AttributeError):
            max_output = None

        # Modalities: OpenRouter exposes "architecture.modality" sometimes,
        # or "input_modalities" depending on schema version.
        arch = m.get("architecture") or {}
        input_modalities = (
            arch.get("input_modalities")
            or (arch.get("modality") or "").split("+")
            or []
        )
        modalities = {
            "text":  True,
            "vision": any("image" in (x or "").lower() for x in input_modalities),
            "audio":  any("audio" in (x or "").lower() for x in input_modalities),
        }

        # Capabilities: parse the supported parameters list.
        supported = set((m.get("supported_parameters") or []))
        capabilities = {
            "tools":     "tools" in supported or "tool_choice" in supported,
            "json":      "response_format" in supported or "json_object" in supported,
            "reasoning": is_reasoning(m) or "reasoning" in supported,
        }

        description = (m.get("description") or "").strip()
        # Best-for tagline: prefer the first sentence of the description if
        # short enough, otherwise a deterministic fallback. Never invent
        # claims that aren't in the model card.
        tagline = make_tagline(name, description, capabilities, modalities)

        chunk_text = build_chunk_text(
            provider=provider, name=name, mid=mid,
            input_per_m=input_per_m, output_per_m=output_per_m,
            context_length=context_length, max_output=max_output,
            modalities=modalities, capabilities=capabilities,
            tagline=tagline, description=description,
        )

        chunks.append({
            "id": mid,
            "provider": provider,
            "name": name,
            "context_length": context_length,
            "max_output_tokens": max_output,
            "input_price_per_m":  round(input_per_m, 4) if input_per_m is not None else None,
            "output_price_per_m": round(output_per_m, 4) if output_per_m is not None else None,
            "modalities": modalities,
            "capabilities": capabilities,
            "is_open_source": is_open_source(mid),
            "latency_tier": latency_tier(mid, name),
            "tagline": tagline,
            "description": description[:600],
            "chunk_text": chunk_text,
            "embedding": None,  # filled in by embed step
        })
    return chunks

def make_tagline(name: str, description: str, caps: dict, mods: dict) -> str:
    # Try first sentence of description if short.
    if description:
        first = description.replace("\n", " ").split(". ")[0].strip()
        if 20 < len(first) < 110:
            return first.rstrip(".").strip()

    bits = []
    if mods.get("vision"):    bits.append("vision-capable")
    if caps.get("reasoning"): bits.append("reasoning-tuned")
    if caps.get("tools"):     bits.append("tool-calling")
    if not bits:
        bits.append("general-purpose chat")
    return f"{name}: " + ", ".join(bits)

def build_chunk_text(*, provider, name, mid, input_per_m, output_per_m,
                     context_length, max_output, modalities, capabilities,
                     tagline, description) -> str:
    lines = []
    lines.append(f"{name} ({mid}) by {provider}.")
    if input_per_m is not None and output_per_m is not None:
        lines.append(f"Input price ${input_per_m:.3f} per million tokens, output ${output_per_m:.3f} per million tokens.")
    if context_length:
        lines.append(f"Context window {context_length:,} tokens" + (f", max output {max_output:,}." if max_output else "."))
    mods = [k for k, v in modalities.items() if v]
    caps = [k for k, v in capabilities.items() if v]
    if mods: lines.append("Modalities: " + ", ".join(mods) + ".")
    if caps: lines.append("Capabilities: " + ", ".join(caps) + ".")
    lines.append(f"Best for: {tagline}.")
    if description:
        lines.append("Description: " + description[:400])
    return " ".join(lines)

# ─────────────────────────────────────────────────────────────
# Embeddings
# ─────────────────────────────────────────────────────────────
def embed_chunks(chunks: list[dict]) -> int:
    if not OPENROUTER_API_KEY:
        print("ERROR: OPENROUTER_API_KEY env var is required.", file=sys.stderr)
        sys.exit(2)

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://jakecuth.com/work/model-picker-lab/",
        "X-Title": "jakecuth.com · model-picker · indexing",
    }

    embedded = 0
    for i, ch in enumerate(chunks):
        body = {"model": EMBED_MODEL, "input": ch["chunk_text"]}
        try:
            r = requests.post(EMBED_URL, headers=headers, json=body, timeout=REQUEST_TIMEOUT)
            r.raise_for_status()
            payload = r.json()
            vec = payload["data"][0]["embedding"]
            ch["embedding"] = vec
            embedded += 1
            if i % 25 == 0:
                print(f"  embedded {i + 1}/{len(chunks)} ({ch['id']})")
            time.sleep(EMBED_BATCH_DELAY_MS / 1000)
        except Exception as e:
            print(f"  ! embed failed for {ch['id']}: {e}", file=sys.stderr)
            ch["embedding"] = None
    return embedded

# ─────────────────────────────────────────────────────────────
# Output
# ─────────────────────────────────────────────────────────────
def write_outputs(chunks: list[dict]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    valid = [c for c in chunks if c.get("embedding")]
    print(f"→ Writing {len(valid)} chunks (of {len(chunks)} attempted) to {MODELS_OUT}")
    payload = {
        "version": 1,
        "embedding_model": EMBED_MODEL,
        "embedding_dim": len(valid[0]["embedding"]) if valid else 0,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "chunks": valid,
    }
    MODELS_OUT.write_text(json.dumps(payload, separators=(",", ":")))

    methodology = {
        "model_count": len(valid),
        "last_refresh": payload["generated_at"],
        "last_refresh_human": datetime.now(timezone.utc).strftime("%b %d, %Y · %H:%M UTC"),
        "embedding_model": EMBED_MODEL,
        "generation_model": "google/gemini-2.0-flash-001",
        "avg_cost_per_query": "0.02",  # ~$0.0002 → "0.02" cents
        "ttft_target_ms": "1800",
        "daily_spend_cap": "2.00",
        "cache_ttl_hours": "24",
    }
    METHODOLOGY_OUT.write_text(json.dumps(methodology, indent=2))
    print(f"→ Wrote methodology to {METHODOLOGY_OUT}")

# ─────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────
def main():
    print("model_picker_lab — building the index")
    catalog = fetch_catalog()
    chunks = build_chunks(catalog)
    print(f"→ Built {len(chunks)} chunks. Embedding…")
    embed_chunks(chunks)
    write_outputs(chunks)
    print("Done.")

if __name__ == "__main__":
    main()
