# Humanoid Robots Lab — asset pipeline

How to upgrade a robot in this lab from a procedural proxy to a verified GLB
without breaking anything else on the page.

## TL;DR

1. Generate or model a clean GLB for the robot.
2. Optimize and remove logos.
3. Drop it at `/assets/models/humanoid-robots/<id>.glb`.
4. Flip `asset.verifiedModel` to `true` in `assets/data/humanoid-robots/catalog.json`.
5. Bump the catalog cache-bust query string if needed.

The lab does the rest. The fallback path is non-throwing — if the file is
missing or the load fails, the procedural proxy renders silently in its
place.

## Recommended workflow

### 1. Reference material

Collect official reference images **manually and legally**. Pull from each
company's own product pages, press kits, and posted demo footage. Do **not**
scrape full image grids from third-party sites.

If you need additional angles, an image model can produce neutral
front/side/back renders in a clean studio style — but mark them as
inspirations, not as captured product photography.

### 2. Image-to-3D

Pick a tool with editorial-friendly output:

- **Hunyuan3D** (Tencent, open weights) — solid topology, free.
- **Meshy.ai** — fast iteration, paid tier for commercial-use models.
- **Tripo / Tripo3D** — strong silhouette accuracy, paid tier for higher poly.
- **Luma Genie** — good for organic forms, weaker on hard-surface mech.
- Manual modeling in **Blender** if you want a guaranteed-clean topology.

### 3. Cleanup in Blender

- Decimate to under **80k triangles** for the detail-mode model.
- Build a separate **<20k triangle** version for lineup mode if needed.
- Bake or generate PBR textures at **1K–2K max** unless the robot truly needs
  more.
- Strip any embedded text, serial numbers, logos, or proprietary internal
  mechanisms from the geometry **before** export.
- Confirm scale is in meters with the feet at origin and head pointing up
  the Y axis.

### 4. Optimize

```sh
# glTF Transform
gltf-transform optimize input.glb output.glb \
    --instance --texture-compress webp --simplify 0.7

# or gltfpack (alternative)
gltfpack -i input.glb -o output.glb -cc -tc
```

Target a **3–8 MB** final size whenever possible.

### 5. Drop in

```sh
cp output.glb /assets/models/humanoid-robots/<robot-id>.glb
```

The id matches the catalog entry (e.g. `figure-03`, `atlas-electric`).

### 6. Flip the flag

In `assets/data/humanoid-robots/catalog.json`, set:

```json
"asset": {
  "glbPath": "/assets/models/humanoid-robots/<robot-id>.glb",
  "posterPath": "/assets/posters/humanoid-robots/<robot-id>.webp",
  "verifiedModel": true
}
```

After deploy the lab will start serving the verified model, and the viewer
chip in the toolbar will read **Verified model** instead of **Visual proxy
(procedural)**.

## OpenRouter usage notes

OpenRouter is convenient for generating **reference prompts**, **draft copy**,
and **code scaffolding** during the offline asset pipeline. It is **not** used
at page runtime. The lab itself fetches no AI APIs.

- Keep the OpenRouter key out of the frontend at all costs.
- Generate references locally; commit only the resulting GLB / poster files.
- Do not commit the API key to the repo (the existing site `.gitignore`
  already covers `.env*`).

## Reusable image-to-3D prompt template

```text
Create a legally safe editorial 3D reference for a humanoid robot inspired by
publicly visible design cues of <ROBOT_NAME>. Do not include logos, brand
marks, serial numbers, or proprietary internal mechanisms. Produce a full-body
neutral A-pose / T-pose robot with accurate broad proportions:
  height:        <HEIGHT>
  body style:    <BODY_STYLE>
  head / face:   <HEAD_DESCRIPTION>
  torso shape:   <TORSO_DESCRIPTION>
  arms / hands:  <ARM_DESCRIPTION>
  legs / feet:   <LEG_DESCRIPTION>
  materials:     <MATERIALS>
Use clean studio lighting, orthographic front / side / back views, high
detail, realistic product-design finish, web-ready topology target, PBR
materials, GLB export target.
```

Plug in the per-robot `visualProfile` fields from `catalog.json` when filling
this in.

## Asset checklist (per robot)

- [ ] **Topology**: under 80k tris for detail mode; under 20k for lineup.
- [ ] **Textures**: 1K–2K max unless justified.
- [ ] **No logos / text** baked into geometry or textures.
- [ ] **Silhouette** matches the robot's recognizable shape cues (height,
      faceplate, hand bulk, leg bend).
- [ ] **Sources / license** documented in lab notes if the original assets
      are reused under a permissive license.
- [ ] **Optimized GLB** (`gltf-transform optimize` or `gltfpack`).
- [ ] **Poster** (optional): 1200×1500 webp at `/assets/posters/humanoid-robots/<id>.webp`.

## Legal / licensing cautions

- This page is **editorial / educational**. Spec quotes are short and
  attributed; no commentary should be confused with company endorsement.
- **Do not redistribute proprietary CAD files** even if you find them on
  the open internet.
- Do **not** copy official marketing renders into the repo.
- Avoid logos on procedural and verified bodies unless you have written
  permission from the company.
- Treat the "top 10" as an editorial selection, not a definitive ranking.
