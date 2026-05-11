/* ═══════════════════════════════════════════════════════════════
   hero-ascii.js — scroll-driven ASCII instrument

   Eight scroll-driven phases share one canvas on the right rail. The
   sequence reads: ambient texture → dissolves → three rotating data
   objects, each held long, with brief beats of silence between.

     scroll (vh)   phase
     ───────────   ─────────────────────────────────────────────────
     0.00 → 0.40   CONTOUR · sparse 2-octave value-noise field
     0.40 → 0.85   MELT    · per-cell hashed delay + quadratic fall
     0.85 → 1.00   gap
     1.00 → 2.00   DONUT   · classic donut.c torus, two-axis spin
     2.00 → 2.15   gap
     2.15 → 3.15   TENSOR  · wireframe cube, two-axis rotation
     3.15 → 3.30   gap
     3.30 → 4.30   LORENZ  · attractor trajectory, age-shaded trail
     > 4.30        gone — canvas cleared once and held

   Each rotating-object phase fades in over the first 12% of its
   window and out over the last 14%, so the canvas is never empty
   for more than the 0.15vh gap between objects.

   Why these three objects:
     · DONUT  — surface (luminance-shaded torus)
     · TENSOR — structure (rotating wireframe cube; reads as matrix)
     · LORENZ — flow (chaotic point trail from dx/dt = σ(y-x), …)

   Accessibility
     · aria-hidden + pointer-events:none on canvas.
     · prefers-reduced-motion: a single contour frame, then idle.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const HOST_ID = 'scene-canvas';

  // 72-step density ramp for the contour field.
  const D = " .'`-\"_,:~;+!|ijl/trcnIPwY1LV\\{CcxzksKv3Ju2Fa]o7T5G9?6$XZAB8USH%&QM@DO0NW#";
  // 12-step luminance ramp for the donut (donut.c original).
  const DR = ".,-~:;=!*#$@";
  // 7-step trail ramp for the Lorenz attractor.
  const LR = ".,:+*#@";

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

  // Cells under this density are skipped. 0.28 keeps the topographic
  // contour structure intact without filling the field with debris.
  const SPARSE_CUT = 0.28;

  // ── Phase boundaries (scroll viewport-heights) ────────────────
  const P_CONTOUR_END = 0.40;
  const P_MELT_END    = 0.85;
  const P_GAP1_END    = 1.00;
  const P_DONUT_END   = 2.00;
  const P_GAP2_END    = 2.15;
  const P_CUBE_END    = 3.15;
  const P_GAP3_END    = 3.30;
  const P_LORENZ_END  = 4.30;

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
  // Standard 12% fade-in, 14% fade-out envelope for object phases.
  function envelope(sp) {
    if (sp < 0.12)      return sp / 0.12;
    if (sp > 1 - 0.14)  return (1 - sp) / 0.14;
    return 1;
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
  let aspectAdj = CELL_W / CELL_H;

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

  // ── Phase A: CONTOUR ─────────────────────────────────────────
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

  // ── Phase B: MELT ────────────────────────────────────────────
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

  // ── Phase D: DONUT ───────────────────────────────────────────
  // Classic donut.c. Lambert luminance into a 12-glyph ramp.
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

        const xp = (cols >> 1) + ((K1 * ooz * x / aspectAdj) | 0);
        const yp = (rows >> 1) - ((K1 * ooz * y) | 0);
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

  // ── Phase F: TENSOR CUBE (wireframe) ─────────────────────────
  // 8 vertices, 12 edges, two-axis rotation. Edges stroked with '#',
  // vertices overpainted with '@'.
  const CUBE_V = [
    [-1,-1,-1],[ 1,-1,-1],[ 1, 1,-1],[-1, 1,-1],
    [-1,-1, 1],[ 1,-1, 1],[ 1, 1, 1],[-1, 1, 1],
  ];
  const CUBE_E = [
    [0,1],[1,2],[2,3],[3,0],
    [4,5],[5,6],[6,7],[7,4],
    [0,4],[1,5],[2,6],[3,7],
  ];
  let cubeA = 0, cubeB = 0;
  let cubeCellMark = null;
  function ensureCubeMark() {
    const n = cols * rows;
    if (!cubeCellMark || cubeCellMark.length !== n) {
      cubeCellMark = new Uint8Array(n);
    }
  }
  function drawCube(rgb, alpha) {
    ensureCubeMark();
    cubeCellMark.fill(0);

    cubeA += 0.022;
    cubeB += 0.031;
    const cosA = Math.cos(cubeA), sinA = Math.sin(cubeA);
    const cosB = Math.cos(cubeB), sinB = Math.sin(cubeB);

    const minDim = Math.min(cols * aspectAdj, rows);
    const K2 = 5;
    const K1 = minDim * 0.45 * K2 / 3; // half-extent of cube ≈ √3

    // Project 8 vertices.
    const P = new Array(8);
    for (let i = 0; i < 8; i++) {
      const x = CUBE_V[i][0], y0 = CUBE_V[i][1], z = CUBE_V[i][2];
      // Rotate Y (B) then X (A).
      const x1 =  x * cosB + z * sinB;
      const z1 = -x * sinB + z * cosB;
      const y1 =  y0 * cosA - z1 * sinA;
      const z2 =  y0 * sinA + z1 * cosA;

      const projZ = K2 + z2;
      const ooz = 1 / projZ;
      const px = (cols >> 1) + (K1 * x1 / aspectAdj) * ooz;
      const py = (rows >> 1) - (K1 * y1) * ooz;
      P[i] = [px, py, z2];
    }

    ctx.fillStyle = rgba(rgb, alpha);

    // Stroke each edge with '#' along a line.
    for (let e = 0; e < CUBE_E.length; e++) {
      const a = P[CUBE_E[e][0]], b = P[CUBE_E[e][1]];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const steps = Math.max(Math.abs(dx), Math.abs(dy)) | 0;
      if (steps === 0) continue;
      for (let s = 0; s <= steps; s++) {
        const tt = s / steps;
        const ix = (a[0] + dx * tt) | 0;
        const iy = (a[1] + dy * tt) | 0;
        if (ix < 0 || ix >= cols || iy < 0 || iy >= rows) continue;
        const key = ix + cols * iy;
        if (cubeCellMark[key]) continue;
        cubeCellMark[key] = 1;
        ctx.fillText('#', ix * CELL_W, iy * CELL_H);
      }
    }

    // Vertices overpaint as '@' for emphasis.
    for (let i = 0; i < 8; i++) {
      const ix = P[i][0] | 0, iy = P[i][1] | 0;
      if (ix < 0 || ix >= cols || iy < 0 || iy >= rows) continue;
      ctx.fillText('@', ix * CELL_W, iy * CELL_H);
    }
  }

  // ── Phase H: LORENZ ATTRACTOR ────────────────────────────────
  // dx/dt = σ(y-x), dy/dt = x(ρ-z)-y, dz/dt = xy-βz
  // Ring buffer of the last N points; trail shaded by age.
  const LORENZ_N = 700;
  const lorenzTraj = new Float32Array(LORENZ_N * 3);
  let lorenzHead = 0, lorenzFilled = 0;
  let lx = 0.1, ly = 0, lz = 0;
  let lorenzWarmed = false;

  function stepLorenz(dt) {
    const SG = 10, RO = 28, BE = 8 / 3;
    const dx = SG * (ly - lx);
    const dy = lx * (RO - lz) - ly;
    const dz = lx * ly - BE * lz;
    lx += dx * dt;
    ly += dy * dt;
    lz += dz * dt;
    lorenzTraj[lorenzHead * 3]     = lx;
    lorenzTraj[lorenzHead * 3 + 1] = ly;
    lorenzTraj[lorenzHead * 3 + 2] = lz;
    lorenzHead = (lorenzHead + 1) % LORENZ_N;
    if (lorenzFilled < LORENZ_N) lorenzFilled++;
  }
  function warmLorenz() {
    if (lorenzWarmed) return;
    // Burn-in onto the attractor so the trail doesn't show the
    // transient spiral from initial condition (0.1, 0, 0).
    for (let i = 0; i < 800; i++) {
      const SG = 10, RO = 28, BE = 8 / 3;
      const dx = SG * (ly - lx);
      const dy = lx * (RO - lz) - ly;
      const dz = lx * ly - BE * lz;
      lx += dx * 0.008;
      ly += dy * 0.008;
      lz += dz * 0.008;
    }
    lorenzWarmed = true;
  }
  function drawLorenz(rgb, alpha) {
    warmLorenz();
    // Advance simulation. While trail is filling, step harder so the
    // user sees a full butterfly the moment Lorenz fades in.
    const ITERS = lorenzFilled < LORENZ_N ? 18 : 6;
    for (let i = 0; i < ITERS; i++) stepLorenz(0.008);

    // Slow spin around Y so the butterfly precesses.
    const A = (performance.now() - t0) * 0.00025;
    const cosA = Math.cos(A), sinA = Math.sin(A);

    // The attractor lives roughly within x ∈ [-22, 22], y ∈ [-30, 30],
    // z ∈ [0, 55]. Center on (0, 0, 25) before projecting.
    const K2 = 75;
    const minDim = Math.min(cols * aspectAdj, rows);
    const K1 = minDim * 2.2;

    // Bucket points by trail-age for batched fillStyle.
    const bx = [[], [], [], []];
    const by = [[], [], [], []];
    const bg = [[], [], [], []];

    for (let i = 0; i < lorenzFilled; i++) {
      const idx = (lorenzHead - 1 - i + LORENZ_N) % LORENZ_N;
      const age = i / lorenzFilled; // 0 newest, ~1 oldest

      const x = lorenzTraj[idx * 3];
      const y = lorenzTraj[idx * 3 + 1];
      const z = lorenzTraj[idx * 3 + 2] - 25;

      const nx =  x * cosA + z * sinA;
      const nz = -x * sinA + z * cosA;

      const projZ = K2 + nz;
      const ooz = 1 / projZ;
      const px = (cols >> 1) + ((K1 * nx / aspectAdj) * ooz) | 0;
      const py = (rows >> 1) - ((K1 * y) * ooz) | 0;
      if (px < 0 || px >= cols || py < 0 || py >= rows) continue;

      const bucket = age < 0.20 ? 0 : age < 0.45 ? 1 : age < 0.75 ? 2 : 3;
      const glyphIdx = 6 - bucket * 2; // 6, 4, 2, 0 → '@', '*', ':', '.'
      bx[bucket].push(px);
      by[bucket].push(py);
      bg[bucket].push(glyphIdx);
    }

    const alphaScale = [1.00, 0.72, 0.46, 0.22];
    for (let b = 0; b < 4; b++) {
      if (bx[b].length === 0) continue;
      ctx.fillStyle = rgba(rgb, alpha * alphaScale[b]);
      for (let i = 0; i < bx[b].length; i++) {
        ctx.fillText(LR.charAt(bg[b][i]), bx[b][i] * CELL_W, by[b][i] * CELL_H);
      }
    }
  }

  // ── Loop ─────────────────────────────────────────────────────
  const reduced = prefersReducedMotion();
  const t0 = performance.now();
  let last = 0;
  let goneCleared = false;

  function drawFrame(now) {
    const t = (now - t0) / 1000;
    const p = scrollP;
    const rgb = hexToRGB(resolveInk());

    // GONE — clear once when we cross the boundary, then idle.
    if (p >= P_LORENZ_END) {
      if (!goneCleared) {
        ctx.clearRect(0, 0, cssW, cssH);
        goneCleared = true;
      }
      return;
    }
    goneCleared = false;
    ctx.clearRect(0, 0, cssW, cssH);

    if (p < P_CONTOUR_END) {
      drawContour(t, rgb, 1);

    } else if (p < P_MELT_END) {
      const m = (p - P_CONTOUR_END) / (P_MELT_END - P_CONTOUR_END);
      drawMelt(t, m, rgb);

    } else if (p < P_GAP1_END) {
      // empty beat

    } else if (p < P_DONUT_END) {
      const sp = (p - P_GAP1_END) / (P_DONUT_END - P_GAP1_END);
      drawDonut(rgb, clamp(envelope(sp), 0, 1));

    } else if (p < P_GAP2_END) {
      // empty beat

    } else if (p < P_CUBE_END) {
      const sp = (p - P_GAP2_END) / (P_CUBE_END - P_GAP2_END);
      drawCube(rgb, clamp(envelope(sp), 0, 1));

    } else if (p < P_GAP3_END) {
      // empty beat

    } else if (p < P_LORENZ_END) {
      const sp = (p - P_GAP3_END) / (P_LORENZ_END - P_GAP3_END);
      drawLorenz(rgb, clamp(envelope(sp), 0, 1));
    }
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
