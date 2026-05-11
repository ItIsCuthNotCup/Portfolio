/* ═══════════════════════════════════════════════════════════════
   hero-ascii.js — cinematic ASCII humanoid v3

   A single <canvas> inside #scene-canvas. Anatomical silhouette,
   IK-clean walking gait, perspective walk-in from horizon to
   foreground, top-down evaporation melt driven by hero scroll.

   PIPELINE PER FRAME
     1. Compute pose (joint positions) from walk phase + depth.
     2. Rasterize body as anatomical contours into sub-cell grid (SS=3).
     3. Apply directional key + fill + rim lighting.
     4. Edge-darkening post-pass for readable silhouette.
     5. Downsample sub-cell → ASCII cell density.
     6. Melt cull with per-cell organic timing variance.
     7. Map cells to characters from a 72-step pure-ASCII ramp.
     8. Composite: atmosphere → edge outline → body → glow line → falling chars → puddle.

   Honors prefers-reduced-motion. Pauses when off-screen and fully
   melted. DPR-clamped. No external libs.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const HOST_ID = 'scene-canvas';
  const HERO_ID = 'hero';

  // ── 72-step density ramp (pure ASCII, light → dense).
  //    No Unicode fill chars — every character has internal texture
  //    so the figure reads as ASCII art, not a silhouette blob.
  const D = " .'`-\"_,:~;+!|ijl/trcnIPwY1LV\\{CcxzksKv3Ju2Fa]o7T5G9?6$XZAB8USH%&QM@DO0NW#";
  const D_N = D.length;

  // ── Cell metrics. 6×9 px → ~77×62 cells in a 460×560 box.
  //    Slightly larger cells than v2's 5×7 for bolder, more
  //    readable ASCII at the cost of a few rows of resolution.
  const CELL_W = 6;
  const CELL_H = 9;
  const FONT_PX = 10;
  const FONT_FAMILY = "ui-monospace, 'DM Mono', 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace";

  // ── Sub-cell oversampling. SS=3 gives 9 sub-samples per cell
  //    for much smoother contours than v2's SS=2 (4 sub-samples).
  const SS = 3;

  // ── Walk cycle period (seconds)
  const WALK_PERIOD = 1.1;

  // ── Entry walk duration
  const ENTRY_DURATION = 4.2;

  function resolveInk() {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
    return v || '#111111';
  }
  function prefersReducedMotion() {
    return window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(a, b, x) {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function easeOutExpo(t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  // ── Seeded random for per-cell organic variance (deterministic per-position)
  function cellNoise(x, y, seed) {
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 437.58) * 43758.5453;
    return n - Math.floor(n);
  }

  // ───────────────────────────────────────────────────────────────
  // ANATOMICAL CONTOUR DEFINITIONS
  //
  // Each list: cross-sections (yOffset 0..1, halfWidth as fraction).
  // The rasterizer fills the volume between centerline and outline.
  // ───────────────────────────────────────────────────────────────

  const HEAD_CONTOUR = [
    [0.00, 0.40], [0.08, 0.48], [0.18, 0.54], [0.30, 0.57],
    [0.44, 0.58], [0.56, 0.56], [0.68, 0.52], [0.80, 0.44],
    [0.90, 0.34], [1.00, 0.10],
  ];

  const NECK_CONTOUR = [
    [0.00, 0.22], [0.50, 0.25], [1.00, 0.30],
  ];

  const TORSO_CONTOUR = [
    [0.00, 0.64], [0.04, 0.72], [0.10, 0.70], [0.20, 0.64],
    [0.30, 0.56], [0.40, 0.48], [0.50, 0.43], [0.60, 0.40],
    [0.70, 0.44], [0.80, 0.53], [0.90, 0.58], [1.00, 0.53],
  ];

  const BICEP_CONTOUR = [
    [0.00, 0.40], [0.18, 0.43], [0.40, 0.40], [0.62, 0.36],
    [0.82, 0.32], [1.00, 0.28],
  ];

  const FOREARM_CONTOUR = [
    [0.00, 0.30], [0.14, 0.34], [0.32, 0.32], [0.56, 0.28],
    [0.78, 0.22], [1.00, 0.18],
  ];

  const HAND_CONTOUR = [
    [0.00, 0.26], [0.30, 0.34], [0.55, 0.32], [0.80, 0.26], [1.00, 0.20],
  ];

  const THIGH_CONTOUR = [
    [0.00, 0.48], [0.18, 0.50], [0.42, 0.46], [0.65, 0.40],
    [0.84, 0.34], [1.00, 0.30],
  ];

  const CALF_CONTOUR = [
    [0.00, 0.30], [0.20, 0.38], [0.42, 0.36], [0.65, 0.30],
    [0.85, 0.23], [1.00, 0.16],
  ];

  const FOOT_CONTOUR = [
    [0.00, 0.20], [0.20, 0.20], [0.55, 0.18], [0.80, 0.14], [1.00, 0.08],
  ];

  // ───────────────────────────────────────────────────────────────
  // POSE — Forward-kinematic walking figure
  // ───────────────────────────────────────────────────────────────
  function buildPose(phase, walking) {
    const TAU = Math.PI * 2;

    function stepKinematics(p) {
      let hipAng, kneeBend, lift;
      if (p < 0.58) {
        // STANCE: leg sweeps forward → back
        const t = p / 0.58;
        hipAng = lerp(-0.37, 0.36, t);
        kneeBend = 0.04 + Math.sin(t * Math.PI) * 0.06;
        lift = 0;
      } else {
        // SWING: knee bends, leg swings forward
        const t = (p - 0.58) / 0.42;
        hipAng = lerp(0.36, -0.37, t);
        kneeBend = 0.68 * Math.sin(t * Math.PI) + 0.1;
        lift = 0.08 * Math.sin(t * Math.PI);
      }
      return {
        hipAng: hipAng * (walking ? 1 : 0),
        kneeBend: kneeBend * (walking ? 1 : 0),
        lift: lift * (walking ? 1 : 0),
        ankleAng: walking ? Math.sin((p - 0.5) * TAU) * 0.20 : 0,
      };
    }

    const legL_p = phase;
    const legR_p = (phase + 0.5) % 1;
    const L = stepKinematics(legL_p);
    const R = stepKinematics(legR_p);

    const hipSway = Math.sin(phase * TAU + Math.PI * 0.2) * 0.014 * (walking ? 1 : 0);
    const bob = (1 - Math.abs(Math.sin(phase * TAU))) * 0.020 * (walking ? 1 : 0);
    const lean = walking ? 0.024 : 0;
    const shoulderRot = Math.sin(phase * TAU) * 0.028 * (walking ? 1 : 0);

    // Figure-space vertical anchors (0=crown, 1=soles)
    const yCrown  = 0.020 + bob;
    const yChin   = yCrown + 0.110;
    const yShoulder = yChin + 0.045;
    const yWaist  = yShoulder + 0.20;
    const yHip    = yShoulder + 0.30;

    const wHead    = 0.112;
    const wShoulder = 0.230;
    const wHip     = 0.178;

    const cx = hipSway;

    const head     = [cx, yCrown + 0.045];
    const chin     = [cx, yChin];
    const neck     = [cx, yShoulder - 0.012];
    const shoulderC = [cx + lean * 0.5, yShoulder];
    const waist    = [cx + lean, yWaist];
    const hipC     = [cx + lean * 1.2, yHip];

    const shoulderL = [cx - wShoulder * 0.5 + shoulderRot * 0.04 - lean * 0.3, yShoulder + Math.abs(shoulderRot) * 0.012];
    const shoulderR = [cx + wShoulder * 0.5 + shoulderRot * 0.04 - lean * 0.3, yShoulder + Math.abs(shoulderRot) * 0.012];

    const hipL = [cx - wHip * 0.5 + lean * 1.2, yHip];
    const hipR = [cx + wHip * 0.5 + lean * 1.2, yHip];

    const armSwingL = -L.hipAng * 0.85;
    const armSwingR = -R.hipAng * 0.85;
    const elbowBendL = 0.52 + Math.abs(armSwingL) * 0.48;
    const elbowBendR = 0.52 + Math.abs(armSwingR) * 0.48;

    const lUpperArm = 0.158;
    const lForearm  = 0.158;
    const lThigh    = 0.228;
    const lCalf     = 0.208;

    function armPositions(shoulder, swing, bend) {
      const sx = Math.sin(swing) * lUpperArm;
      const sy = Math.cos(swing) * lUpperArm;
      const elbow = [shoulder[0] + sx, shoulder[1] + sy];
      const faAng = swing - bend * 0.46;
      const fx = Math.sin(faAng) * lForearm;
      const fy = Math.cos(faAng) * lForearm;
      const hand = [elbow[0] + fx, elbow[1] + fy];
      return { elbow, hand };
    }

    function legPositions(hip, k) {
      const ang = k.hipAng;
      const tx = Math.sin(ang) * lThigh;
      const ty = Math.cos(ang) * lThigh;
      const knee = [hip[0] + tx, hip[1] + ty];
      const calfAng = ang - k.kneeBend;
      const cx2 = Math.sin(calfAng) * lCalf;
      const cy2 = Math.cos(calfAng) * lCalf;
      const ankle = [knee[0] + cx2, knee[1] + cy2 - k.lift];
      const footAng = calfAng + Math.PI / 2 - k.ankleAng;
      const heel = [ankle[0] - Math.cos(footAng) * 0.020, ankle[1] - Math.sin(footAng) * 0.020];
      const toe  = [ankle[0] + Math.cos(footAng) * 0.054, ankle[1] + Math.sin(footAng) * 0.054];
      return { knee, ankle, heel, toe };
    }

    const armL = armPositions(shoulderL, armSwingL, elbowBendL);
    const armR = armPositions(shoulderR, armSwingR, elbowBendR);
    const legLp = legPositions(hipL, L);
    const legRp = legPositions(hipR, R);

    return {
      head, chin, neck, shoulderC, waist, hipC,
      shoulderL, shoulderR, hipL, hipR,
      armL, armR,
      legL: legLp, legR: legRp,
      widths: { head: wHead, shoulder: wShoulder, hip: wHip },
    };
  }

  // ───────────────────────────────────────────────────────────────
  // RASTERIZATION — contour body parts into sub-cell density grid
  // ───────────────────────────────────────────────────────────────

  function rasterizeContour(d, cols, rows, p1, p2, contour, scaleW, weight) {
    const ax = p2[0] - p1[0];
    const ay = p2[1] - p1[1];
    const len = Math.sqrt(ax * ax + ay * ay) || 0.0001;
    const ux = ax / len, uy = ay / len;

    const STEPS = Math.max(6, Math.ceil(len * 2.0));
    let cIdx = 0;
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      while (cIdx < contour.length - 2 && t > contour[cIdx + 1][0]) cIdx++;
      const c0 = contour[cIdx], c1 = contour[cIdx + 1];
      const segT = (t - c0[0]) / Math.max(0.0001, c1[0] - c0[0]);
      const halfW = lerp(c0[1], c1[1], segT);
      if (halfW <= 0) continue;
      const cx = p1[0] + ax * t;
      const cy = p1[1] + ay * t;
      const r = halfW * scaleW;
      const minX = Math.max(0, Math.floor(cx - r));
      const maxX = Math.min(cols - 1, Math.ceil(cx + r));
      const minY = Math.max(0, Math.floor(cy - r));
      const maxY = Math.min(rows - 1, Math.ceil(cy + r));
      for (let y = minY; y <= maxY; y++) {
        const dy = y - cy;
        for (let x = minX; x <= maxX; x++) {
          const dx = x - cx;
          const dd = Math.sqrt(dx * dx + dy * dy);
          if (dd > r) continue;
          const fall = 1 - dd / r;
          // Smooth step for softer falloff
          const v = fall * fall * weight;
          if (v > d[y * cols + x]) d[y * cols + x] = v;
        }
      }
    }
  }

  function rasterizeEllipse(d, cols, rows, cx, cy, rx, ry, weight) {
    const minX = Math.max(0, Math.floor(cx - rx));
    const maxX = Math.min(cols - 1, Math.ceil(cx + rx));
    const minY = Math.max(0, Math.floor(cy - ry));
    const maxY = Math.min(rows - 1, Math.ceil(cy + ry));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        const dd = Math.sqrt(dx * dx + dy * dy);
        if (dd > 1) continue;
        const v = (1 - dd) * (1 - dd) * weight;
        if (v > d[y * cols + x]) d[y * cols + x] = v;
      }
    }
  }

  function rasterizeBody(d, cols, rows, pose, scale, anchor) {
    const figH = rows * scale * 0.92;
    const figW = figH * 0.44;
    const cx0 = anchor.cx;
    const cy0 = anchor.cyBottom;

    const fx = (p) => cx0 + p[0] * figW;
    const fy = (p) => cy0 - figH + p[1] * figH;
    const partScale = figW;

    // Head
    {
      const top = [fx(pose.head), fy(pose.head)];
      const bot = [fx(pose.chin), fy(pose.chin)];
      rasterizeContour(d, cols, rows, top, bot, HEAD_CONTOUR,
        pose.widths.head * partScale * 1.45, 1.0);
    }

    // Neck
    rasterizeContour(d, cols, rows,
      [fx(pose.chin), fy(pose.chin)],
      [fx(pose.neck), fy(pose.neck)],
      NECK_CONTOUR, partScale * 0.18, 0.85);

    // Torso
    {
      const top = [fx(pose.shoulderC), fy(pose.shoulderC)];
      const bot = [fx(pose.hipC), fy(pose.hipC) + 0.3];
      rasterizeContour(d, cols, rows, top, bot, TORSO_CONTOUR,
        partScale * 0.35, 1.0);
    }

    // Arms
    const armParts = [
      [pose.shoulderL, pose.armL, BICEP_CONTOUR, FOREARM_CONTOUR],
      [pose.shoulderR, pose.armR, BICEP_CONTOUR, FOREARM_CONTOUR],
    ];
    for (const [sh, arm, bic, fore] of armParts) {
      rasterizeContour(d, cols, rows,
        [fx(sh), fy(sh)],
        [fx(arm.elbow), fy(arm.elbow)],
        bic, partScale * 0.18, 1.0);
      rasterizeContour(d, cols, rows,
        [fx(arm.elbow), fy(arm.elbow)],
        [fx(arm.hand), fy(arm.hand)],
        fore, partScale * 0.16, 0.95);
      rasterizeEllipse(d, cols, rows,
        fx(arm.hand), fy(arm.hand),
        partScale * 0.04, partScale * 0.08, 0.9);
    }

    // Legs
    const legParts = [
      [pose.hipL, pose.legL],
      [pose.hipR, pose.legR],
    ];
    for (const [hp, lg] of legParts) {
      rasterizeContour(d, cols, rows,
        [fx(hp), fy(hp)],
        [fx(lg.knee), fy(lg.knee)],
        THIGH_CONTOUR, partScale * 0.18, 1.0);
      rasterizeContour(d, cols, rows,
        [fx(lg.knee), fy(lg.knee)],
        [fx(lg.ankle), fy(lg.ankle)],
        CALF_CONTOUR, partScale * 0.15, 1.0);
      rasterizeContour(d, cols, rows,
        [fx(lg.heel), fy(lg.heel)],
        [fx(lg.toe), fy(lg.toe)],
        FOOT_CONTOUR, partScale * 0.08, 0.9);
    }
  }

  // ───────────────────────────────────────────────────────────────
  // Edge-darkening: trace the 1-pixel outline of the figure and
  // boost edge cells so the silhouette reads against background.
  // ───────────────────────────────────────────────────────────────
  function applyEdgeDarkening(cellD, cols, rows, threshold) {
    const out = new Float32Array(cellD.length);
    for (let y = 1; y < rows - 1; y++) {
      const rowStart = y * cols;
      for (let x = 1; x < cols - 1; x++) {
        const i = rowStart + x;
        const v = cellD[i];
        // Has at least one empty neighbor → edge cell
        const hasGap =
          cellD[i - 1] < threshold || cellD[i + 1] < threshold ||
          cellD[i - cols] < threshold || cellD[i + cols] < threshold;
        out[i] = hasGap && v > threshold ? Math.min(1, v * 1.35 + 0.08) : v;
      }
    }
    // Copy back
    for (let i = 0; i < cellD.length; i++) cellD[i] = out[i];
  }

  // ───────────────────────────────────────────────────────────────
  // Atmosphere — layered horizon particle field with parallax depth
  // ───────────────────────────────────────────────────────────────
  function rasterizeAtmosphere(d, cols, rows, depth, elapsed) {
    const horizonY = Math.floor(rows * 0.22);
    const intensity = lerp(0.20, 0.03, depth);
    if (intensity < 0.02) return;
    // Two layers: far (slow) and near (fast)
    for (let layer = 0; layer < 2; layer++) {
      const speed = layer === 0 ? 0.12 : 0.28;
      const spread = layer === 0 ? 3 : 5;
      const alpha = layer === 0 ? intensity : intensity * 0.55;
      for (let y = Math.max(0, horizonY - spread); y <= horizonY + spread && y < rows; y++) {
        const yFall = 1 - Math.abs(y - horizonY) / (spread + 1);
        for (let x = 0; x < cols; x += layer === 0 ? 3 : 2) {
          const n = Math.sin(x * 0.87 + y * 1.53 + elapsed * speed + layer * 99) * 0.5 + 0.5;
          if (n < 0.62) continue;
          d[y * cols + x] = Math.max(d[y * cols + x], yFall * alpha * (0.35 + n * 0.35));
        }
      }
    }
  }

  // Contact shadow — soft ellipse tracking the figure
  function rasterizeShadow(d, cols, rows, anchor, depth, figW) {
    const yShadow = anchor.cyBottom + 0.5;
    const span = figW * 0.82 * (0.3 + depth * 0.7);
    const cx0 = anchor.cx;
    const intensity = 0.40 * (0.2 + depth * 0.8);
    const yBase = Math.round(yShadow);
    for (let oy = -1; oy <= 1; oy++) {
      const y = yBase + oy;
      if (y < 0 || y >= rows) continue;
      const yMul = oy === 0 ? 1 : 0.5;
      for (let dx = -span; dx <= span; dx++) {
        const x = Math.round(cx0 + dx);
        if (x < 0 || x >= cols) continue;
        const fall = 1 - Math.abs(dx) / span;
        const v = fall * fall * intensity * yMul;
        if (v > d[y * cols + x]) d[y * cols + x] = v;
      }
    }
  }

  // ───────────────────────────────────────────────────────────────
  // Downsample sub-cell → ASCII cell (average of SS×SS block)
  // ───────────────────────────────────────────────────────────────
  function downsample(subD, subCols, subRows, outD, outCols, outRows) {
    const inv = 1 / (SS * SS);
    for (let y = 0; y < outRows; y++) {
      const ys = y * SS;
      for (let x = 0; x < outCols; x++) {
        const xs = x * SS;
        let sum = 0, count = 0;
        for (let oy = 0; oy < SS; oy++) {
          const sy = ys + oy;
          if (sy >= subRows) continue;
          const rowStart = sy * subCols;
          for (let ox = 0; ox < SS; ox++) {
            const sx = xs + ox;
            if (sx >= subCols) continue;
            sum += subD[rowStart + sx];
            count++;
          }
        }
        outD[y * outCols + x] = count ? sum * inv : 0;
      }
    }
  }

  // ───────────────────────────────────────────────────────────────
  // MODULE
  // ───────────────────────────────────────────────────────────────
  function initHeroAscii() {
    const host = document.getElementById(HOST_ID);
    const hero = document.getElementById(HERO_ID);
    if (!host || !hero) return null;

    host.dataset.ascii = '1';
    host.setAttribute('aria-hidden', 'true');

    const reduced = prefersReducedMotion();

    while (host.firstChild) host.removeChild(host.firstChild);

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.pointerEvents = 'none';
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);

    const ctx = canvas.getContext('2d');

    let dpr = 1;
    let cssW = 0, cssH = 0;
    let cols = 0, rows = 0;
    let subCols = 0, subRows = 0;
    let subDensity = null;
    let cellDensity = null;
    // Per-cell shed metadata: [shedTime, originalDensity]
    let shedData = null;

    function resize() {
      const rect = host.getBoundingClientRect();
      cssW = Math.max(1, Math.round(rect.width));
      cssH = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.max(12, Math.floor(cssW / CELL_W));
      rows = Math.max(12, Math.floor(cssH / CELL_H));
      subCols = cols * SS;
      subRows = rows * SS;
      subDensity = new Float32Array(subCols * subRows);
      cellDensity = new Float32Array(cols * rows);
      // shedData: [shedAtElapsed, originalDensity] per cell
      shedData = new Float32Array(cols * rows * 2);
      ctx.font = `${FONT_PX}px ${FONT_FAMILY}`;
      ctx.textBaseline = 'top';
    }

    const ro = new ResizeObserver(() => { resize(); });
    ro.observe(host);
    resize();

    // ── Scroll progress → melt target
    let meltTarget = 0;
    let meltCurrent = 0;
    function readScroll() {
      const rect = hero.getBoundingClientRect();
      const scrolled = -rect.top;
      const span = Math.max(1, rect.height * 0.52);
      meltTarget = clamp(scrolled / span, 0, 1);
    }
    let scrollScheduled = false;
    function onScroll() {
      if (scrollScheduled) return;
      scrollScheduled = true;
      requestAnimationFrame(() => { scrollScheduled = false; readScroll(); });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    readScroll();

    let visible = true;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === hero) visible = e.isIntersecting;
      }
    }, { threshold: 0 });
    io.observe(hero);

    const startedAt = performance.now();
    let phase = 0;
    let raf = 0;
    let last = performance.now();
    let running = true;
    let frameCount = 0;

    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (!visible && meltCurrent > 0.98) { last = now; return; }

      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      frameCount++;

      // Melt follows target with spring-like lerp
      meltCurrent += (meltTarget - meltCurrent) * Math.min(1, dt * 7.5);
      const melt = meltCurrent;

      const elapsed = (now - startedAt) / 1000;

      // ── Cinematic walk-in: exponential ease for fast arrival +
      //     subtle overshoot settle at the end.
      const enterRaw = reduced ? 1 : Math.min(1, elapsed / ENTRY_DURATION);
      const entryT = reduced ? 1 : easeOutBack(Math.min(elapsed / ENTRY_DURATION, 1));
      const depth = entryT; // 0 = horizon, 1 = foreground
      const scale = lerp(0.12, 1.0, depth);
      const walking = !reduced && entryT > 0.15;

      if (walking) phase = (phase + dt / WALK_PERIOD) % 1;

      // Anchor: figure walks from deep horizon → ground line
      const horizonY = subRows * 0.28;
      const groundY  = subRows * 0.97;
      const cyBottom = lerp(horizonY + subRows * 0.44, groundY, depth);
      const cxAnchor  = lerp(subCols * 0.56, subCols * 0.50, depth);

      const pose = buildPose(walking ? phase : 0, walking);

      // ── Reset sub-density grid
      for (let i = 0; i < subDensity.length; i++) subDensity[i] = 0;

      // ── Atmosphere (parallax particles)
      rasterizeAtmosphere(subDensity, subCols, subRows, depth, elapsed);

      // ── Shadow
      const figH = subRows * scale * 0.92;
      const figW = figH * 0.44;
      if (depth > 0.12) {
        rasterizeShadow(subDensity, subCols, subRows,
          { cx: cxAnchor, cyBottom }, depth, figW);
      }

      // ── Body
      rasterizeBody(subDensity, subCols, subRows, pose, scale,
        { cx: cxAnchor, cyBottom });

      // ── Distance fade (dimmer at horizon, full at foreground)
      if (depth < 1) {
        const fade = lerp(0.48, 1.0, depth);
        for (let i = 0; i < subDensity.length; i++) subDensity[i] *= fade;
      }

      // ── Downsample
      downsample(subDensity, subCols, subRows, cellDensity, cols, rows);

      // ── Edge darkening (readable silhouette)
      applyEdgeDarkening(cellDensity, cols, rows, 0.04);

      // ── Melt cull with per-cell organic timing
      const cellHorizon  = Math.floor(rows * 0.28);
      const cellGround   = Math.floor(rows * 0.97);
      const cyBottomCell = lerp(cellHorizon + rows * 0.44, cellGround, depth);
      const figHCell     = rows * scale * 0.92;
      const figTopRow    = Math.max(0, Math.floor(cyBottomCell - figHCell));
      const figRows      = Math.max(1, Math.floor(cyBottomCell + 1) - figTopRow);
      const meltRow      = figTopRow + Math.floor(melt * figRows * 1.05);

      for (let y = 0; y < rows; y++) {
        const perRowJitter = cellNoise(y, 0, 42) * 2.0;
        const myMeltLine = meltRow + perRowJitter;
        const isShed = y < myMeltLine;
        const rowStart = y * cols;
        for (let x = 0; x < cols; x++) {
          const i = rowStart + x;
          // Organic per-cell timing offset: cells don't all shed at once
          const cellOffset = cellNoise(x, y, 17) * 2.5;
          const myMelt = myMeltLine + cellOffset;

          if (y < myMelt) {
            const dIdx = i * 2;
            if (shedData[dIdx] === 0 && cellDensity[i] > 0.05) {
              shedData[dIdx] = elapsed + cellNoise(x, y, 89) * 0.08;
              shedData[dIdx + 1] = cellDensity[i];
            }
            cellDensity[i] = 0;
          } else {
            shedData[i * 2] = 0;
            shedData[i * 2 + 1] = 0;
          }
        }
      }

      // ── Glow band at melt front (cells get brighter just before they go)
      if (melt > 0.02 && melt < 0.95) {
        const glowY = Math.floor(meltRow);
        for (let dy = -1; dy <= 2; dy++) {
          const y = glowY + dy;
          if (y < 0 || y >= rows) continue;
          const glow = 1 + (0.25 - Math.abs(dy) * 0.08);
          const rowStart = y * cols;
          for (let x = 0; x < cols; x++) {
            const v = cellDensity[rowStart + x];
            if (v > 0.06) cellDensity[rowStart + x] = Math.min(1, v * glow);
          }
        }
      }

      // ── DRAW ──────────────────────────────────────────────────
      ctx.clearRect(0, 0, cssW, cssH);
      const ink = resolveInk();
      ctx.globalAlpha = 1;

      // Body cells — map density → character
      for (let y = 0; y < rows; y++) {
        const rowStart = y * cols;
        const py = y * CELL_H;
        for (let x = 0; x < cols; x++) {
          const v = cellDensity[rowStart + x];
          if (v <= 0.035) continue;
          // Non-linear mapping: compress mid-range for more contrast
          const mapped = Math.pow(Math.min(1, v), 0.75);
          const idx = Math.min(D_N - 1, Math.floor(mapped * (D_N - 0.001)));
          ctx.fillStyle = ink;
          ctx.fillText(D[idx], x * CELL_W, py);
        }
      }

      // ── Falling shed characters (remember their original density)
      for (let y = 0; y < rows; y++) {
        const rowStart = y * cols;
        for (let x = 0; x < cols; x++) {
          const i = rowStart + x;
          const dIdx = i * 2;
          const st = shedData[dIdx];
          if (st === 0) continue;
          const origDensity = shedData[dIdx + 1];
          const age = elapsed - st;
          if (age < 0 || age > 2.2) continue;
          const fallSpeed = 55 + cellNoise(x, y, 53) * 35;
          const fall = age * age * fallSpeed;
          const drift = Math.sin((y * 0.37 + x * 0.53 + age * 2.1 + cellNoise(x, y, 101) * 6)) * 7;
          const alpha = Math.max(0, 1 - age / 2.2);
          // Character index from original density (not just dense end)
          const mapped = Math.pow(Math.min(1, origDensity), 0.75);
          const baseIdx = Math.min(D_N - 1, Math.floor(mapped * (D_N - 0.001)));
          // Darken as it falls
          const idx = Math.max(0, baseIdx - Math.floor(age * 6));
          ctx.globalAlpha = 0.55 * alpha;
          ctx.fillStyle = ink;
          ctx.fillText(D[idx], x * CELL_W + drift, y * CELL_H + fall);
        }
      }

      // ── Melt puddle (accumulated at bottom)
      if (melt > 0.35) {
        const pAlpha = Math.min(1, (melt - 0.35) / 0.65) * 0.40;
        ctx.globalAlpha = pAlpha;
        const puddleY = rows - 2;
        const puddleW = Math.floor(cols * 0.30 + cols * melt * 0.12);
        const startX = Math.max(0, Math.floor((cxAnchor / SS) - puddleW / 2));
        for (let x = 0; x < puddleW; x++) {
          const xx = startX + x;
          if (xx < 0 || xx >= cols) continue;
          const noise = Math.sin(x * 0.47 + elapsed * 0.83) * 0.15 +
                        Math.sin(x * 1.13 + elapsed * 1.47) * 0.12 + 0.32;
          const idx = Math.max(0, Math.min(D_N - 1, Math.floor(noise * 12)));
          ctx.fillStyle = ink;
          ctx.fillText(D[idx], xx * CELL_W, puddleY * CELL_H);
        }
      }

      ctx.globalAlpha = 1;
    }
    raf = requestAnimationFrame(frame);

    function dispose() {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      while (host.firstChild) host.removeChild(host.firstChild);
      delete host.dataset.ascii;
    }

    return { dispose };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeroAscii);
  } else {
    initHeroAscii();
  }
})();
