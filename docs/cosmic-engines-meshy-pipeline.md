# Cosmic Engines · Asset Pipeline (Meshy, optional)

The `/work/cosmic-engines-lab/` page ships with **zero pre-baked 3D assets**.
Every cosmic object renders procedurally via Three.js primitives, particle
systems, and additive blending. The page is fully interactive without any
GLB downloads.

This doc explains how to optionally generate decorative GLB assets with
[Meshy AI](https://meshy.ai) and drop them into the lab as overrides.

---

## Hard rules

1. **Meshy is offline-only.** No Meshy API call ever runs from the browser.
   The `assets/js/cosmic-engines-lab/viewer.js` only does a `HEAD` check
   against the static asset path, then loads via Three.js GLTFLoader.
2. **No keys in the frontend.** `MESHY_API_KEY` lives in your shell env
   when you run the optional generator script. It is never bundled, never
   committed, never shipped.
3. **Procedural fallback always works.** If a GLB is missing or fails to
   decode, the viewer falls back to the procedural scene without a visible
   error.

## Asset slot per object

The viewer expects optional decorative GLBs at:

```
/assets/models/cosmic-engines/<id>.glb
```

Where `<id>` is one of:

- `quasar`
- `blackhole`
- `pulsar`
- `magnetar`
- `grb`
- `supernova`
- `merger`
- `lens`

When a `.glb` is present, the viewer loads it and centers/scales it into
roughly a 2.5-unit cube. When it is absent (or returns a non-200), the
viewer renders the procedural scene from `procedural.js` instead.

## Generating with Meshy (manual workflow)

The simplest workflow is the Meshy web UI:

1. Open https://meshy.ai/dashboard
2. Use **Text-to-3D** (or **Image-to-3D** if you have a reference render).
3. Paste one of the prompts below.
4. Choose `glb` as the export format.
5. Wait for the preview, then run **Refine**.
6. Download the GLB. Optimize (see "optimize" step below).
7. Save as `assets/models/cosmic-engines/<id>.glb`.

### Prompts

These are the exact prompts to paste, one per object.

#### `quasar.glb`

> Create a stylized scientific 3D model of a quasar engine: central dark
> sphere representing a black hole shadow, luminous flattened accretion
> disk, two symmetrical polar plasma jet structures, cosmic dust swirls,
> high-detail sci-fi educational visualization, no text, no logos, no
> labels, dark matter-like materials, emissive blue violet amber accents,
> optimized for web GLB, clean topology, transparent-friendly components.

#### `blackhole.glb`

> Create a stylized 3D model of a black hole accretion disk: central dark
> circular shadow, warped glowing ring, layered plasma disk, gravitational
> lensing inspired arcs, cinematic scientific visualization, no text, no
> logos, optimized for web GLB, PBR materials, clean topology.

#### `pulsar.glb`

> Create a stylized 3D model of a pulsar: compact neutron star sphere,
> two opposite lighthouse radiation beams, magnetic axis visualized with
> glowing rings, energetic particle traces, educational sci-fi style, no
> text, no logos, optimized for web GLB.

#### `magnetar.glb`

> Create a stylized 3D model of a magnetar: small dense neutron star with
> dramatic magnetic field loops, electric blue and violet plasma arcs,
> compact spherical core, scientific educational visualization, no labels,
> no logos, optimized for web GLB.

#### `grb.glb`

> Create a stylized 3D model of a gamma-ray burst: bright compact core,
> two opposing relativistic jet cones, expanding spherical afterglow shell,
> beamed plasma traces, dark cosmic context, no text, no logos, optimized
> for web GLB.

#### `supernova.glb`

> Create a stylized 3D model of an expanding supernova remnant: spherical
> shockwave shell, colorful plasma filaments, central fading star core,
> cosmic dust, scientific visualization, no text, no logos, optimized web
> GLB.

#### `merger.glb`

> Create a stylized 3D model of two neutron stars merging: two compact
> glowing spheres, spiral accretion trails, ejecta ring, gravitational
> wave ripples suggested by circular arcs, cinematic scientific
> visualization, no text, no logos, optimized web GLB.

#### `lens.glb`

> Create a stylized 3D model representing gravitational lensing: central
> massive dark galaxy-like object, curved arcs of background light wrapping
> around it, starfield fragments, glassy spacetime distortion aesthetic,
> educational sci-fi visualization, no text, no logos, optimized for web
> GLB.

## Optimize before publishing

Each GLB should sit between **3 MB and 8 MB**. Larger files defeat the
point (procedural is already free).

Recommended pipelines:

```
# glTF Transform (best results)
gltf-transform optimize input.glb output.glb --simplify --weld --texture-compress webp

# OR gltfpack (faster, simpler)
gltfpack -i input.glb -o output.glb -cc -tc
```

After optimizing, drop the file into:

```
assets/models/cosmic-engines/<id>.glb
```

Reload the lab page. The viewer's bottom-right tag will switch from
`Procedural · stylized` to `GLB asset · loaded`.

## Optional script (not shipped)

If you want a programmatic batch run, you can write a one-off Node or
Python script that uses Meshy's REST API. Sketch:

```python
# scripts/generate_cosmic_meshy_assets.py — DO NOT RUN UNLESS NEEDED
# Reads MESHY_API_KEY from env. Creates one preview-then-refine task
# per object. Polls until done. Writes the GLB URLs to a manifest.
# Does NOT auto-download into the public folder; you decide which to keep.
```

This script is intentionally **not** shipped in the repo. The reason is
operational: Meshy generations take cents to dollars per object, and a
batch run in CI is the kind of thing that races a billing alarm. Keep
the workflow manual until you actively want to refresh assets.

## Why procedural is the default

Cosmic objects are inherently abstract — even the "real" Event Horizon
Telescope image of M87* is a deconvolved interferogram, not a photograph.
A clean procedural scene (a ring + particles + jets) reads as scientific
faster than a Meshy mesh, which tends to invent surface detail that
isn't physically meaningful.

The Meshy slot exists because some objects (especially the lensing scene
and the merger ejecta cloud) can benefit from a more painterly look once
you have a 3D-art-direction pass. But the page is intentionally designed
to look complete without it.
