# Humanoid Robots Lab — implementation notes

Companion to the lab at `/work/humanoid-robots-lab/`. Records the
architecture decisions and the deltas from the original spec the user
sent (which assumed a Next.js + React + R3F stack).

## Stack reality check

The user's prompt asked for TypeScript + React + Next + @react-three/fiber +
@react-three/drei. The site itself is **vanilla HTML + CSS + JS with no
build step** (CLAUDE.md hard rule). The user later clarified that the lab
can break the rest of the site's aesthetic, but no signal was given that
the no-build rule should be relaxed.

So the implementation collapses the React stack to vanilla equivalents:

| User asked for                  | What we built                                       |
|---------------------------------|-----------------------------------------------------|
| Next.js route `/labs/...`       | `work/humanoid-robots-lab/index.html` (site convention) |
| React + JSX                     | Vanilla DOM with template literals                  |
| TypeScript                      | JS + JSDoc-friendly schema; types live in the catalog file |
| `@react-three/fiber`            | Plain `THREE.WebGLRenderer` + render loop           |
| `@react-three/drei` `<OrbitControls>` | `three/addons/controls/OrbitControls.js`     |
| `<Canvas>` / `<Suspense>`       | Single `<canvas>` injected by `scene.js`            |
| `useEffect` / hook reactivity   | Tiny pub/sub `state.js` + URL hash sync             |
| CSS Modules / Tailwind          | One self-contained `humanoid-robots-lab.css`        |

Everything else maps 1:1. No functional capability is lost.

## File layout

```
work/humanoid-robots-lab/index.html    Lab page (HTML + JSON-LD + importmap)
assets/css/humanoid-robots-lab.css     Self-contained design system (white/black/Figtree)
assets/data/humanoid-robots/
  catalog.json                          21 robots × 10 companies + meta
assets/js/humanoid-robots-lab/
  main.js               Entry point. Wires state → UI → viewer.
  state.js              Pub/sub state + URL hash sync.
  data.js               Catalog loader + `byCompany` / `byId` / etc.
  scene.js              Three.js scene factory (one canvas, lights, OrbitControls).
  viewer.js             Switches robots, disposes old one, idle-rotate.
  procedural.js         Builds a robot Group from primitives by visualProfile.
  gltf-loader.js        Load-or-fallback. HEAD-checks the GLB; falls back silently.
  selectors.js          Company pills + generation timeline.
  detail-panel.js       Specs grid with confidence badges + sources.
  diff-panel.js         "What changed from <prev>?" bullets.
  hotspots.js           Body-region overlay buttons + readout.
  lineup.js             Side-by-side mode (single canvas, low-poly proxies).
  matrix.js             Comparison table.
  sources.js            Methodology block + flat citations.
  ui-helpers.js         escapeHtml + spec-cell + confidence-badge helpers.
  reduced-motion.js     `prefersReducedMotion()`.
assets/models/humanoid-robots/.gitkeep    Drop verified GLB here.
assets/posters/humanoid-robots/.gitkeep   Optional poster fallback.
assets/og/humanoid-robots-lab.png         Social card.
docs/humanoid-robot-asset-pipeline.md     Asset workflow.
docs/humanoid-robots-lab-notes.md         (this file)
```

## Data model

The schema mirrors the user's TypeScript spec. Every catalog entry uses:

```json
{
  "id":              "<unique kebab-case id>",
  "companyId":       "<companies[].id>",
  "displayName":     "Tesla Optimus Gen 2",
  "yearIntroduced":  { "value": "...", "confidence": "official|reported|estimated|unknown" },
  "status":          { "value": "...", "confidence": "..." },
  "...specs...":     { "value": "...", "confidence": "..." },
  "summary":         "...",
  "differentiators": ["..."],
  "previousGenerationId": "<id> or null",
  "changesFromPrevious": [
    { "category": "form|mobility|manipulation|ai|deployment|safety", "text": "...", "confidence": "..." }
  ],
  "visualProfile":   { "bodyStyle": "...", "primaryTone": "...", "...": "..." },
  "asset":           { "glbPath": "...", "posterPath": "...", "verifiedModel": false },
  "sources":         [{ "label": "...", "url": "...", "type": "official|reported|..." }]
}
```

Where a number isn't disclosed publicly, the field is `{ "value": null,
"confidence": "unknown" }` and renders as **"Not publicly confirmed"** in
the panel. We never invent.

## How to add a new generation

1. Add a `robots[]` entry following the schema.
2. Set `previousGenerationId` to the prior generation's id and add 3-6
   `changesFromPrevious` items.
3. Add a `visualProfile` block. Reuse one of the six existing `bodyStyle`
   tokens (`smooth-consumer`, `industrial-athletic`, `warehouse-digit`,
   `soft-home`, `research-platform`, `service-robot`) and override
   `primaryTone` / `secondaryTone` / per-robot flags
   (`hasBlackFaceplate`, `screenFace`, `chestLight`, `largeHands`,
   `reverseKnees`, `softSuit`, `bulkyShoulders`).
4. Drop a `featuredPerCompany.<companyId>` mapping to the new id if it
   should become the company's headline robot in lineup + matrix.
5. Add at least one `sources[]` entry.

That's it. The page is fully data-driven and rebinds on next load.

## How to swap a procedural robot for a verified GLB

See `docs/humanoid-robot-asset-pipeline.md` for the full pipeline.

In short:
1. Drop `<id>.glb` at `/assets/models/humanoid-robots/`.
2. In `catalog.json`, set the matching robot's `asset.verifiedModel: true`.
3. Reload. The lab probes for the file, switches the viewer chip from
   "Visual proxy" to "Verified model", and renders the real geometry.

If the GLB is missing or fails to load, the procedural proxy renders
silently in its place — no visible runtime errors.

## Performance notes

- DPR clamped to 1.5 (above that the GPU does work without visible benefit
  on integrated graphics).
- One WebGL context for the detail viewer. The lineup canvas is created
  on demand and disposed when the user leaves lineup mode.
- Old robot Groups are recursively disposed (geometries + materials) on
  switch.
- No env map. Lighting is ambient + key + fill + rim + a soft contact
  shadow plane.
- IntersectionObserver pauses the render loop when the canvas leaves the
  viewport.
- Reduced-motion preference disables the auto-rotate on the detail viewer.

## Accessibility

- Every button has an `aria-pressed` + `aria-label` where appropriate.
- The viewer canvas carries an `aria-label` describing its purpose.
- All robot information also lives in text in the side panel and the
  comparison matrix — the page is fully usable without WebGL.
- Keyboard: Esc returns to detail mode from lineup; tab order follows the
  visual order of company pills → timeline → detail panel.
- `prefers-reduced-motion` is respected for both the viewer's auto-rotate
  and any CSS transitions.

## Deviations from the user's spec (and why)

| User spec                                              | What shipped                                             | Why                                                                  |
|--------------------------------------------------------|----------------------------------------------------------|----------------------------------------------------------------------|
| Route `/labs/humanoid-robots`                          | `/work/humanoid-robots-lab/`                             | Site convention. User accepted "closest equivalent."                 |
| TypeScript                                             | Vanilla JS + JSDoc-friendly schema                       | Site has no build step.                                              |
| React / R3F / drei                                     | Three.js core + addons via importmap                     | No build step; collapses the React tree without losing capability.   |
| Hotspots inside the canvas                             | HTML overlay buttons in a side panel                     | More robust than mesh raycasting; better a11y.                       |
| Per-robot R3F `<Suspense>`                             | Loading flag in `viewer.js` + status chip in toolbar     | Same UX, no React.                                                    |
| Lineup mode "or static cards"                          | Single shared low-poly Three scene                       | More cohesive look; performance still fine on a MacBook Air.         |
| `Sticky section nav if straightforward`                | Yes — top of `.hr-section-nav`                           | Standard sticky pattern.                                              |

## Things to watch

- **Catalog completeness.** Many official spec pages don't disclose runtime,
  payload, or DoF. Those fields are explicitly null + "not publicly confirmed."
  Resist filling them in from secondary commentary.
- **Tesla generations** are deliberately conservative. Gen 3 is marked
  `expected` / `estimated` because Tesla has not posted a final spec.
- **Visual proxies** are deliberately not labeled with company logos.
  They lean on shape, color, and silhouette cues to be recognizable.
- **The dark site → white lab transition** is intentional. This lab opts
  out of the global midnight theme via a self-contained CSS file.

## Future work

- Real GLB drops for the top 4 platforms (Figure 03, Optimus Gen 2,
  Atlas Electric, Apollo) following the asset pipeline.
- A second viewer chip toggling "anatomy view" — wireframe + labeled
  components — once verified geometry is in place.
- A small comparison-arrow widget showing "this robot vs the average of
  its category" once enough confirmed specs exist.
