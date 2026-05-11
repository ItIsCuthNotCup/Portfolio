/* ═══════════════════════════════════════════════════════════════
   hero-ascii.js — scroll-driven ASCII instrument

   Four scroll-driven phases share one canvas on the right rail.

     phase A · CONTOUR (scroll 0.0vh → 0.5vh)
         Sparse 2-octave value-noise topography. Only cells above
         a density threshold render, so the field reads as quiet
         contours, not a wall of code.

     phase B · MELT    (scroll 0.5vh → 1.1vh)
         Each cell has a hashed delay; as melt progress advances,
         cells accelerate downward, fade, and exit the bottom.
         By the end the canvas is empty.

     phase C · EMPTY   (scroll 1.1vh → 1.4vh)
         Quiet beat. Nothing renders.

     phase D · DONUT   (scroll 1.4vh → 2.4vh)
         Classic donut.c torus, ASCII-shaded by Lambert reflection,
         rotating on two axes. Fades in over the first 15% of the
         phase and out over the last 25%.

     phase E · GONE    (scroll > 2.4vh)
         Canvas cleared. No work per frame except clearRect.

   The .scene-stage host is position:fixed so it persists across
   scroll. We listen to window.scroll, normalize by innerHeight,
   and dispatch to one of the four draw paths each frame.

   Accessibility
     - aria-hidden + pointer-events:none on canvas.
     - prefers-reduced-motion: renders one static contour frame and
       stops; no scroll-driven phases.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const HOST_ID = 'scene-canvas';

  // 72-step density ramp for the contour field.
  const D = " .'`-\"_,:~;+!|ijl/trcnIPwY1LV\\{CcxzksKv3Ju2Fa]o7T5G9?6$XZAB8USH%&QM@DO0NW#";
  // 12-step luminance ramp for the donut (donut.c original).
  const DR = ".,-~:;=!*#$@";

  const CELL_W = 7;
  const CELL_H = 11;
  const FONT_PX = 11;
  const FONT_FAMILY =
    "ui-monospace, 'DM Mono', 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace";

  // ── Contour field parameters ──────────────────────────────────
  const FREQ_X  = 0.022;
  const FREQ_Y  = 0.026;
  const DRIFT_X = 0.055;
  const DRIFT_Y = 0.028;
  const MORPH   = 0.040;
  const OCTAVES = 2;

  // Contrast stretch — empirical p5–p95 of the field.
  const STRETCH_LO = 0.24;
  const STRETCH_HI = 0.56;
  const STRETCH_R  = STRETCH_HI - STRETCH_LO;

  const ISO_BANDS = 5;
  const ISO_WIDTH = 0.018;
  const ISO_BOOST = 0.22;

  // Threshold below which cells are skipped (gives the sparse,
  // editorial contour look instead of a dense wall).
  const SPARSE_CUT = 0.42;

  // ── Phase boundaries (scroll viewport-heights) ────────────────
  const P_CONTOUR_END = 0.5;
  const P_MELT_END    = 1.1;
  const P_EMPTY_END   = 1.4;
  const P_DONUT_END   = 2.4;

  const TARGET_FPS = 30;
  const FRAME_MIN  = 1000 / TARGET_FPS;

  // ── Helpers ───────────────────────────────────────────────────
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function prefersReducedMotion() {
    return window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function resolveInk() {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue('--ink').trim();
    return v || '#111111';
  }
  function hexToRGB(hex) {
    if (!hex || hex.charAt(0) !== '#') return [17, 17, 17];
    const h = hex.length === 4
      ? '#' + hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3]
      : hex;
    return [
      parseInt(h.slice(1, 3), 16),
      parseInt(h.slice(3, 5), 16),
      parseInt(h.slice(5, 7), 16),
    ];
  }
  function rgba(rgb, a) {
    return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a.toFixed(3) + ')';
  }

  // Deterministic per-cell hash → [0, 1).
  function hash2(ix, iy) {
    const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }
  function hash3(ix, iy, iz) {
    const n = Math.sin(ix * 127.1 + iy * 311.7 + iz * 74.7) * 43758.5453;
    return n - Math.floor(n);
  }

  // 3D value noise w/ smoothstep interpolation.
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

  // ── Mount ─────────────────────────────────────────────────────
  const host = document.getElementById(HOST_ID);
  if (!host) return;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none;';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let cols = 0, rows = 0;
  let cssW = 0, cssH = 0;

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

  // ── Scroll progress, normalized to viewport heights ──────────
  let scrollP = 0;
  function onScroll() {
    const vh = window.innerHeight || 1;
    scrollP = window.scrollY / vh;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ── Phase A: contour ─────────────────────────────────────────
  function drawContour(t, rgb, alpha) {
    const dx = t * DRIFT_X;
    const dy = t * DRIFT_Y;
    const dz = t * MORPH;
    ctx.fillStyle = rgba(rgb, alpha);
    for (let r = 0; r < rows; r++) {
      const sy = r * FREQ_Y + dy;
      const py = r * CELL_H;
      for (let c = 0; c < cols; c++) {
        const sx = c * FREQ_X + dx;
        let v = field(sx, sy, dz);
        v = (v - STRETCH_LO) / STRETCH_R;
        v = clamp(v, 0, 1);

        const phase = v * ISO_BANDS;
        const distInV = Math.abs(phase - Math.round(phase)) / ISO_BANDS;
        if (distInV < ISO_WIDTH) {
          v += ISO_BOOST * (1 - distInV / ISO_WIDTH);
          if (v > 1) v = 1;
        }
        if (v < SPARSE_CUT) continue;
        const idx = Math.min(D.length - 1, Math.floor(v * D.length));
        const ch = D.charAt(idx);
        if (ch !== ' ') ctx.fillText(ch, c * CELL_W, py);
      }
    }
  }

  // ── Phase B: melt ────────────────────────────────────────────
  // Each cell drops independently. Hash-seeded delay + quadratic fall.
  function drawMelt(t, m, rgb) {
    const dx = t * DRIFT_X;
    const dy = t * DRIFT_Y;
    const dz = t * MORPH;
    const fallScale = cssH + 80;
    for (let r = 0; r < rows; r++) {
      const sy = r * FREQ_Y + dy;
      const py = r * CELL_H;
      for (let c = 0; c < cols; c++) {
        const h = hash2(c, r);
        // Earlier cells (low h) start dropping first.
        const lm = clamp((m - h * 0.55) / 0.45, 0, 1);
        if (lm >= 1) continue;
        const alpha = (1 - lm) * (1 - lm);
        if (alpha < 0.01) continue;

        const sx = c * FREQ_X + dx;
        let v = field(sx, sy, dz);
        v = (v - STRETCH_LO) / STRETCH_R;
        v = clamp(v, 0, 1);
        if (v < SPARSE_CUT) continue;

        const idx = Math.min(D.length - 1, Math.floor(v * D.length));
        const ch = D.charAt(idx);
        if (ch === ' ') continue;

        const drop = lm * lm * fallScale;
        ctx.fillStyle = rgba(rgb, alpha);
        ctx.fillText(ch, c * CELL_W, py + drop);
      }
    }
  }

  // ── Phase D: donut ───────────────────────────────────────────
  // Classic donut.c. zBuffer per cell, Lambert luminance into a 12-glyph ramp.
  let donutA = 0, donutB = 0;
  let zbuf = null, dout = null, zbufSize = 0;
  function ensureDonutBuffers() {
    const n = cols * rows;
    if (zbufSize !== n) {
      zbuf = new Float32Array(n);
      dout = new Int8Array(n);
      zbufSize = n;
    }
  }
  function drawDonut(rgb, alpha) {
    ensureDonutBuffers();
    zbuf.fill(0);
    dout.fill(-1);

    donutA += 0.035;
    donutB += 0.020;
    const cosA = Math.cos(donutA), sinA = Math.sin(donutA);
    const cosB = Math.cos(donutB), sinB = Math.sin(donutB);

    // Sizing — pick the smaller dim (accounting for cell aspect) and
    // size the torus so R1+R2 = 3 maps to ~⅔ of available cells.
    const aspectAdj = CELL_W / CELL_H;                  // ≈ 0.636
    const minDim = Math.min(cols * aspectAdj, rows);
    const R1 = 1, R2 = 2;
    const K2 = 5;
    const K1 = (minDim * K2 * 0.30) / (R1 + R2);

    for (let theta = 0; theta < Math.PI * 2; theta += 0.07) {
      const cosT = Math.cos(theta), sinT = Math.sin(theta);
      for (let phi = 0; phi < Math.PI * 2; phi += 0.02) {
        const cosP = Math.cos(phi), sinP = Math.sin(phi);
        const cX = R2 + R1 * cosT;
        const cY = R1 * sinT;
        const x = cX * (cosB * cosP + sinA * sinB * sinP) - cY * cosA * sinB;
        const y = cX * (sinB * cosP - sinA * cosB * sinP) + cY * cosA * cosB;
        const z = K2 + cosA * cX * sinP + cY * sinA;
        const ooz = 1 / z;

        // Project. Compensate for cell aspect on the y axis.
        const xp = (cols  >> 1) + ((K1 * ooz * x / aspectAdj) | 0);
        const yp = (rows  >> 1) - ((K1 * ooz * y) | 0);
        if (xp < 0 || xp >= cols || yp < 0 || yp >= rows) continue;

        const L = (cosP * cosT * sinB
                   - cosA * cosT * sinP
                   - sinA * sinT
                   + cosB * (cosA * sinT - cosT * sinA * sinP));
        if (L <= 0) continue;

        const idx = xp + cols * yp;
        if (ooz > zbuf[idx]) {
          zbuf[idx] = ooz;
          const li = (L * 8) | 0;
          dout[idx] = li > 11 ? 11 : li < 0 ? 0 : li;
        }
      }
    }

    ctx.fillStyle = rgba(rgb, alpha);
    for (let y = 0; y < rows; y++) {
      const py = y * CELL_H;
      const rowStart = cols * y;
      for (let x = 0; x < cols; x++) {
        const i = rowStart + x;
        const li = dout[i];
        if (li < 0) continue;
        ctx.fillText(DR.charAt(li), x * CELL_W, py);
      }
    }
  }

  // ── Loop ─────────────────────────────────────────────────────
  const reduced = prefersReducedMotion();
  const t0 = performance.now();
  let last = 0;

  function drawFrame(now) {
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, cssW, cssH);
    const rgb = hexToRGB(resolveInk());
    const p = scrollP;

    if (p < P_CONTOUR_END) {
      drawContour(t, rgb, 1);
    } else if (p < P_MELT_END) {
      const m = (p - P_CONTOUR_END) / (P_MELT_END - P_CONTOUR_END);
      drawMelt(t, m, rgb);
    } else if (p < P_EMPTY_END) {
      // empty pause — already cleared
    } else if (p < P_DONUT_END) {
      const sp = (p - P_EMPTY_END) / (P_DONUT_END - P_EMPTY_END);
      let alpha = 1;
      if (sp < 0.15)       alpha = sp / 0.15;
      else if (sp > 0.75)  alpha = (1 - sp) / 0.25;
      drawDonut(rgb, clamp(alpha, 0, 1));
    }
    // p ≥ P_DONUT_END: gone. Canvas was already cleared.
  }

  function loop(now) {
    if ((now - last) >= FRAME_MIN) {
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
