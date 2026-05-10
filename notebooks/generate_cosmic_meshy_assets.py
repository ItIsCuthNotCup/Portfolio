"""
generate_cosmic_meshy_assets.py — generate eight detailed GLB assets
for /work/cosmic-engines-lab/ via the Meshy AI Text-to-3D API.

Run from repo root:

    MESHY_API_KEY=msy_xxx python3 notebooks/generate_cosmic_meshy_assets.py

Each object goes through preview -> refine -> download. Output lands at
/assets/models/cosmic-engines/<id>.glb. The lab's viewer.js does a HEAD
check on each path at runtime and uses the GLB if present, falls back to
the procedural scene if not. So the page works whether this script has
finished or not.

Idempotent: skips any object whose GLB already exists unless --force.
Fail-soft: catches per-object errors so one failed generation doesn't
take down the rest of the batch. Manifest written at the end.

The eight prompts come straight from
docs/cosmic-engines-meshy-pipeline.md. If you change a prompt there,
update it here too.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

API_BASE = "https://api.meshy.ai/openapi/v2/text-to-3d"
ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "models" / "cosmic-engines"
MANIFEST_PATH = OUT_DIR / "_meshy_manifest.json"

POLL_INTERVAL_S = 8
POLL_TIMEOUT_S = 600          # 10 min per task
DOWNLOAD_TIMEOUT_S = 120

OBJECTS = [
    {
        "id": "quasar",
        "prompt": (
            "A stylized scientific 3D model of a quasar engine: central dark sphere "
            "representing a black hole shadow, luminous flattened accretion disk, two "
            "symmetrical polar plasma jet structures, cosmic dust swirls, sci-fi "
            "educational visualization, no text, no logos, dark matter-like materials, "
            "emissive blue violet amber accents, clean topology"
        ),
        "art_style": "realistic",
    },
    {
        "id": "blackhole",
        "prompt": (
            "A stylized 3D model of a black hole accretion disk: central dark circular "
            "shadow, warped glowing ring, layered plasma disk, gravitational lensing "
            "inspired arcs, cinematic scientific visualization, no text, no logos, "
            "PBR materials, clean topology"
        ),
        "art_style": "realistic",
    },
    {
        "id": "pulsar",
        "prompt": (
            "A stylized 3D model of a pulsar: compact neutron star sphere with crustal "
            "surface texture, two opposite lighthouse radiation beams, magnetic axis "
            "visualized with glowing rings, energetic particle traces, educational "
            "sci-fi style, no text, no logos"
        ),
        "art_style": "realistic",
    },
    {
        "id": "magnetar",
        "prompt": (
            "A stylized 3D model of a magnetar: small dense neutron star with dramatic "
            "looping magnetic field lines, electric blue and violet plasma arcs, "
            "compact spherical core, scientific educational visualization, no labels, "
            "no logos"
        ),
        "art_style": "realistic",
    },
    {
        "id": "grb",
        "prompt": (
            "A stylized 3D model of a gamma-ray burst: bright compact core, two "
            "opposing relativistic jet cones, expanding spherical afterglow shell, "
            "beamed plasma traces, dark cosmic context, no text, no logos"
        ),
        "art_style": "realistic",
    },
    {
        "id": "supernova",
        "prompt": (
            "A stylized 3D model of an expanding supernova remnant: spherical "
            "shockwave shell, colorful plasma filaments, central fading star core, "
            "cosmic dust, scientific visualization, no text, no logos"
        ),
        "art_style": "realistic",
    },
    {
        "id": "merger",
        "prompt": (
            "A stylized 3D model of two neutron stars merging: two compact glowing "
            "spheres, spiral accretion trails, ejecta ring, gravitational wave "
            "ripples suggested by circular arcs, cinematic scientific visualization, "
            "no text, no logos"
        ),
        "art_style": "realistic",
    },
    {
        "id": "lens",
        "prompt": (
            "A stylized 3D model representing gravitational lensing: central massive "
            "dark galaxy-like object, curved arcs of background light wrapping around "
            "it, starfield fragments, glassy spacetime distortion aesthetic, "
            "educational sci-fi visualization, no text, no logos"
        ),
        "art_style": "realistic",
    },
]


# ─── Helpers ────────────────────────────────────────────────────────


def http_post(url: str, body: dict, headers: dict, timeout: int = 60) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def http_get(url: str, headers: dict, timeout: int = 60) -> dict:
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def download(url: str, dest: Path, timeout: int = 120) -> int:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        data = resp.read()
    dest.write_bytes(data)
    return len(data)


def submit_preview(api_key: str, obj: dict) -> str:
    body = {
        "mode": "preview",
        "prompt": obj["prompt"],
        "art_style": obj.get("art_style", "realistic"),
        "ai_model": "meshy-6",
        "topology": "triangle",
        "target_polycount": 30000,
        "should_remesh": True,
        "negative_prompt": "low quality, low resolution, low poly, ugly, blurry, text, logo, watermark, label",
    }
    res = http_post(
        API_BASE,
        body,
        headers={"Authorization": f"Bearer {api_key}"},
    )
    return res.get("result") or res.get("id")


def submit_refine(api_key: str, preview_task_id: str) -> str:
    body = {
        "mode": "refine",
        "preview_task_id": preview_task_id,
        "enable_pbr": True,
        "texture_richness": "high",
    }
    res = http_post(
        API_BASE,
        body,
        headers={"Authorization": f"Bearer {api_key}"},
    )
    return res.get("result") or res.get("id")


def poll_task(api_key: str, task_id: str, label: str) -> dict:
    deadline = time.time() + POLL_TIMEOUT_S
    last_status = None
    while time.time() < deadline:
        try:
            data = http_get(
                f"{API_BASE}/{task_id}",
                headers={"Authorization": f"Bearer {api_key}"},
            )
        except urllib.error.HTTPError as e:
            print(f"  [{label}] poll error: {e.code} {e.reason}", flush=True)
            time.sleep(POLL_INTERVAL_S)
            continue

        status = data.get("status")
        progress = data.get("progress", 0)
        if status != last_status:
            print(f"  [{label}] status={status} progress={progress}%", flush=True)
            last_status = status

        if status == "SUCCEEDED":
            return data
        if status in ("FAILED", "CANCELED", "EXPIRED"):
            raise RuntimeError(f"task {task_id} ended with status {status}")
        time.sleep(POLL_INTERVAL_S)
    raise TimeoutError(f"task {task_id} timed out after {POLL_TIMEOUT_S}s")


def generate_one(api_key: str, obj: dict, force: bool = False) -> dict:
    out_path = OUT_DIR / f"{obj['id']}.glb"
    if out_path.exists() and not force:
        return {
            "id": obj["id"],
            "status": "skip",
            "path": str(out_path.relative_to(ROOT)),
            "size": out_path.stat().st_size,
        }

    print(f"\n=== {obj['id']} ===", flush=True)

    # 1. preview
    preview_id = submit_preview(api_key, obj)
    print(f"  preview submitted: {preview_id}", flush=True)
    poll_task(api_key, preview_id, "preview")

    # 2. refine (gives PBR textures)
    refine_id = submit_refine(api_key, preview_id)
    print(f"  refine submitted: {refine_id}", flush=True)
    refined = poll_task(api_key, refine_id, "refine")

    # 3. download
    glb_url = (refined.get("model_urls") or {}).get("glb")
    if not glb_url:
        raise RuntimeError(f"no glb url in refined response for {obj['id']}")
    size = download(glb_url, out_path, timeout=DOWNLOAD_TIMEOUT_S)
    print(f"  saved {out_path.relative_to(ROOT)} ({size} bytes)", flush=True)
    return {
        "id": obj["id"],
        "status": "ok",
        "preview_task": preview_id,
        "refine_task": refine_id,
        "path": str(out_path.relative_to(ROOT)),
        "size": size,
    }


# ─── Entry ──────────────────────────────────────────────────────────


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true",
                    help="regenerate even if GLB already exists")
    ap.add_argument("--only", nargs="*",
                    help="only generate these object ids")
    args = ap.parse_args()

    api_key = os.environ.get("MESHY_API_KEY")
    if not api_key:
        print("MESHY_API_KEY env var not set", file=sys.stderr)
        return 2

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    targets = OBJECTS
    if args.only:
        wanted = set(args.only)
        targets = [o for o in OBJECTS if o["id"] in wanted]
        if not targets:
            print(f"no matching objects for: {args.only}", file=sys.stderr)
            return 2

    results = []
    for obj in targets:
        try:
            results.append(generate_one(api_key, obj, force=args.force))
        except Exception as e:
            print(f"!! {obj['id']} failed: {e}", flush=True)
            results.append({"id": obj["id"], "status": "fail", "error": str(e)})

    MANIFEST_PATH.write_text(json.dumps(results, indent=2))
    print(f"\nmanifest -> {MANIFEST_PATH.relative_to(ROOT)}")

    fails = [r for r in results if r.get("status") == "fail"]
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
