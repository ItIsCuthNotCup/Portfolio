/* ═══════════════════════════════════════════════════════════════
   hero-ascii.js — contour field v5

   A quiet, abstract ASCII topography. Multi-octave value noise
   drifts slowly across the canvas; cells are tone-mapped through
   the same 72-glyph density ramp the rest of the site uses, with
   subtle contour highlights at fixed isolines so the field reads
   as a topographic map rather than blur.

   Replaces v4 (cinematic walking humanoid). The figure read as
   noise at low cell-resolution; this reads as data.

   PIPELINE PER FRAME
     1. Each cell samples a 2-octave 3D value-noise field at
        (col*FREQ_X + drift, row*FREQ_Y + drift, t*MORPH).
     2. Field is contrast-stretched into [0, 1].
     3. Density v → ASCII glyph from D ramp.
     4. Narrow contour highlights at ISO_BANDS isolines so
        topographic structure reads at a glance.

   No IK, no physics, no particles. One canvas, one pass per frame.

   Accessibility
     - aria-hidden + pointer-events:none on canvas.
     - Respects prefers-reduced-motion: renders one static frame.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const HOST_ID = 'scene-canvas';
  const HERO_ID = 'hero';

  // 72-step pure-ASCII density ramp (same as v4).
  const D = " .'`-\"_,:~;+!|ijl/trcnIPwY1LV\\{CcxzksKv3Ju2Fa]o7T5G9?6$XZAB8USH%&QM@DO0NW#";
  const D_LAST = D.length - 1;

  // Cell metrics — fixed; no adaptive fallback needed at this cost.
  const CELL_W = 7;
  const CELL_H = 11;
  const FONT_PX = 11;
  const FONT_FAMILY =
    "ui-monospace, 'DM Mono', 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace";

  // Field parameters.
  const FREQ_X = 0.020;   // noise units per cell, x
  const FREQ_Y = 0.024;   // noise units per cell, y
  const DRIFT_X = 0.055;  // noise units / sec along x
  const DRIFT_Y = 0.028;  // noise units / sec along y
  const MORPH   = 0.040;  // structural morph rate (3rd dim)
  const OCTAVES = 2;
  const TARGET_FPS = 30;
  const FRAME_MIN = 1000 / TARGET_FPS;

  // Field contrast stretch — empirical p5–p95 of the noise field is
  // ≈[0.21, 0.55]; map that to [0, 1] so the full glyph ramp is used.
  const STRETCH_LO = 0.24;
  const STRETCH_HI = 0.56;
  const STRETCH_R  = STRETCH_HI - STRETCH_LO;

  // Contour highlights.
  const ISO_BANDS = 5;
  const ISO_WIDTH = 0.018;
  const ISO_BOOST = 0.22;

  // ── Helpers
  function resolveInk() {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
    return v || '#111111';
  }
  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // Deterministic hash → [0, 1)
  function hash3(ix, iy, iz) {
    const n = Math.sin(ix * 127.1 + iy * 311.7 + iz * 74.7) * 43758.5453;
    return n - Math.floor(n);
  }

  // 3D value noise with smoothstep interpolation.
  function valueNoise3(x, y, z) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = x - ix, fy = y - iy, fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const uz = fz * fz * (3 - 2 * fz);

    const c000 = hash3(ix,     iy,     iz);
    const c100 = hash3(ix + 1, iy,     iz);
    const c010 = hash3(ix,     iy + 1, iz);
    const c110 = hash3(ix + 1, iy + 1, iz);
    const c001 = hash3(ix,     iy,     iz + 1);
    const c101 = hash3(ix + 1, iy,     iz + 1);
    const c011 = hash3(ix,     iy + 1, iz + 1);
    const c111 = hash3(ix + 1, iy + 1, iz + 1);

    const x00 = c000 * (1 - ux) + c100 * ux;
    const x10 = c010 * (1 - ux) + c110 * ux;
    const x01 = c001 * (1 - ux) + c101 * ux;
    const x11 = c011 * (1 - ux) + c111 * ux;
    const y0  = x00  * (1 - uy) + x10  * uy;
    const y1  = x01  * (1 - uy) + x11  * uy;
    return y0 * (1 - uz) + y1 * uz;
  }

  // 2-octave fBm-style sample.
  function field(x, y, z) {
    let v = 0, amp = 1, total = 0;
    let fx = x, fy = y, fz = z;
    for (let o = 0; o < OCTAVES; o++) {
      v += amp * valueNoise3(fx, fy, fz);
      total += amp;
      amp *= 0.55;
      fx *= 2.0; fy *= 2.0; fz *= 1.7;
    }
    return v / total;
  }

  // ── Mount
  const host = document.getElementById(HOST_ID);
  if (!host) return;
  const hero = document.getElementById(HERO_ID);

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none;';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let cols = 0, rows = 0;
  let cssW = 0, cssH = 0;
  const reduced = prefersReducedMotion();

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = host.getBoundingClientRect();
    cssW = Math.max(1, Math.floor(rect.width));
    cssH = Math.max(1, Math.floor(rect.height));
    canvas.width  = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width  = cssW + 'px';
    canvas.style.height = cssH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.max(1, Math.floor(cssW / CELL_W));
    rows = Math.max(1, Math.floor(cssH / CELL_H));
    ctx.font = FONT_PX + 'px ' + FONT_FAMILY;
    ctx.textBaseline = 'top';
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  // Pause when hero is offscreen.
  let visible = true;
  if (hero && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
    }, { threshold: 0 });
    io.observe(hero);
  }

  // ── Render
  const t0 = performance.now();
  let last = 0;

  function drawFrame(now) {
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = resolveInk();

    const dx = t * DRIFT_X;
    const dy = t * DRIFT_Y;
    const dz = t * MORPH;

    for (let r = 0; r < rows; r++) {
      const sy = r * FREQ_Y + dy;
      const py = r * CELL_H;
      for (let c = 0; c < cols; c++) {
        const sx = c * FREQ_X + dx;
        let v = field(sx, sy, dz);

        // Contrast stretch into [0, 1].
        v = (v - STRETCH_LO) / STRETCH_R;
        v = clamp(v, 0, 1);

        // Contour isoline boost.
        const phase = v * ISO_BANDS;
        const distInV = Math.abs(phase - Math.round(phase)) / ISO_BANDS;
        if (distInV < ISO_WIDTH) {
          v += ISO_BOOST * (1 - distInV / ISO_WIDTH);
          if (v > 1) v = 1;
        }

        const idx = Math.min(D_LAST, Math.floor(v * D.length));
        const ch = D.charAt(idx);
        if (ch !== ' ') ctx.fillText(ch, c * CELL_W, py);
      }
    }
  }

  function loop(now) {
    if (visible && (now - last) >= FRAME_MIN) {
      last = now;
      drawFrame(now);
    }
    requestAnimationFrame(loop);
  }

  if (reduced) {
    drawFrame(performance.now());
  } else {
    requestAnimationFrame(loop);
  }
})();
