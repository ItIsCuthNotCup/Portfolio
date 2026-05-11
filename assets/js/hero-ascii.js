/* ═══════════════════════════════════════════════════════════════
   hero-ascii.js — cinematic ASCII humanoid v4

   A single <canvas> inside #scene-canvas. Anatomical silhouette,
   IK-clean walking gait with foot-plant locking, perspective walk-in
   from horizon to foreground, idle breathing + weight shift while
   standing, top-down evaporation melt with organic drip tendrils
   driven by hero scroll.

   PIPELINE PER FRAME
     1. Compute pose (joints) from walk phase + depth + idle phase.
        Foot ground-Y is locked per leg during stance; knee position
        is solved by 2-bone IK so the leg can't stretch or slide.
     2. Rasterize body parts as anatomical contours into the sub-cell
        density grid (SS=3, 9 samples per ASCII cell).
        Includes hair mass, body, contact shadow, and atmosphere.
     3. Post-passes on the sub-cell grid:
          (a) downsample to cell grid
          (b) S-curve tone-map for punchy density→character contrast
          (c) silhouette edge brighten — adds rim-light feel
          (d) edge darkening — keeps interior cells readable
     4. Melt cull with organic per-cell timing variance and drip
        tendrils that reach below the main melt line.
     5. Map cells to characters from a 72-step pure-ASCII ramp.
     6. Particles overlay: foot-plant ripples + walk-in dust trail
        + falling shed characters.
     7. Canvas-level opacity fade-in on first paint + fade-out as
        melt completes.

   Performance:
     - Adaptive quality. First ~16 frames are measured; if avg frame
       cost exceeds the budget, SS drops to 2 and CELL_W/H scale up.
     - Pauses entirely when hero is fully out of viewport and melt is
       complete.
     - DPR clamped to 2.

   Accessibility:
     - aria-hidden + pointer-events:none on host and canvas.
     - Respects prefers-reduced-motion: static figure, no entry, no
       walk, no melt, no particles.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const HOST_ID = 'scene-canvas';
  const HERO_ID = 'hero';

  // 72-step pure-ASCII density ramp. Every glyph has internal
  // texture so the figure reads as ASCII art, not a silhouette blob.
  const D = " .'`-\"_,:~;+!|ijl/trcnIPwY1LV\\{CcxzksKv3Ju2Fa]o7T5G9?6$XZAB8USH%&QM@DO0NW#";
  const D_N = D.length;

  // Cell metrics. Adaptive: may grow if first frames are slow.
  let CELL_W = 6;
  let CELL_H = 9;
  let FONT_PX = 10;
  const FONT_FAMILY =
    "ui-monospace, 'DM Mono', 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace";

  // Sub-cell oversampling. SS=3 → 9 samples per ASCII cell.
  let SS = 3;

  const WALK_PERIOD = 1.1;
  const ENTRY_DURATION = 3.6;
  const FADE_IN_MS = 500;

  // ── Helpers
  function resolveInk() {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
    return v || '#111111';
  }
  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(a, b, x) {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function smootherstep(a, b, x) {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  function easeOutBack(t) {
    const c1 = 1.5;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  // Deterministic per-position noise (seeded sin hash)
  function cellNoise(x, y, seed) {
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 437.58) * 43758.5453;
    return n - Math.floor(n);
  }

  // S-curve tone mapping for density → character index.
  // Steeper sigmoid → harder edges, more contrast.
  function sCurve(v) {
    if (v <= 0) return 0;
    if (v >= 1) return 1;
    const a = 3.6;   // contrast (higher = steeper)
    const b = 0.40;  // midpoint (lower = more cells push to dense end)
    const x = clamp(v, 0, 1);
    const out = 1 / (1 + Math.exp(-a * (x - b) * 6));
    const f0 = 1 / (1 + Math.exp(a * b * 6));
    const f1 = 1 / (1 + Math.exp(-a * (1 - b) * 6));
    return (out - f0) / (f1 - f0);
  }

  // ───────────────────────────────────────────────────────────────
  // ANATOMICAL CONTOURS (cross-sections: [yT 0..1, halfW relative])
  // ───────────────────────────────────────────────────────────────

  const HEAD_CONTOUR = [
    [0.00, 0.42], [0.06, 0.50], [0.16, 0.55], [0.28, 0.58],
    [0.42, 0.59], [0.55, 0.58], [0.68, 0.54], [0.80, 0.46],
    [0.90, 0.34], [1.00, 0.10],
  ];

  // Hair mass — sits on top of crown, slightly asymmetric (swept right)
  const HAIR_CONTOUR = [
    [0.00, 0.20], [0.18, 0.48], [0.35, 0.62], [0.55, 0.66],
    [0.72, 0.62], [0.86, 0.52], [1.00, 0.38],
  ];

  const NECK_CONTOUR = [
    [0.00, 0.22], [0.50, 0.25], [1.00, 0.32],
  ];

  // Torso — broad shoulders → V-taper to waist → flare to hip
  const TORSO_CONTOUR = [
    [0.00, 0.64], [0.04, 0.74], [0.10, 0.72], [0.20, 0.66],
    [0.30, 0.58], [0.40, 0.49], [0.50, 0.43], [0.60, 0.41],
    [0.70, 0.45], [0.80, 0.54], [0.90, 0.59], [1.00, 0.54],
  ];

  const BICEP_CONTOUR = [
    [0.00, 0.40], [0.18, 0.45], [0.40, 0.42], [0.62, 0.37],
    [0.82, 0.32], [1.00, 0.28],
  ];

  const FOREARM_CONTOUR = [
    [0.00, 0.30], [0.14, 0.34], [0.32, 0.32], [0.56, 0.28],
    [0.78, 0.22], [1.00, 0.18],
  ];

  const THIGH_CONTOUR = [
    [0.00, 0.50], [0.18, 0.52], [0.42, 0.48], [0.65, 0.40],
    [0.84, 0.34], [1.00, 0.30],
  ];

  const CALF_CONTOUR = [
    [0.00, 0.30], [0.20, 0.40], [0.42, 0.36], [0.65, 0.30],
    [0.85, 0.23], [1.00, 0.16],
  ];

  const FOOT_CONTOUR = [
    [0.00, 0.22], [0.20, 0.22], [0.55, 0.20], [0.80, 0.14], [1.00, 0.08],
  ];

  // ───────────────────────────────────────────────────────────────
  // 2-BONE IK — given hip and foot positions, place the knee.
  //
  //   l1 = thigh length, l2 = calf length, forward = which side
  //   of the hip→foot line the knee bends to (+1 / -1).
  // ───────────────────────────────────────────────────────────────
  function ik2(hipX, hipY, footX, footY, l1, l2, forward) {
    const dx = footX - hipX;
    const dy = footY - hipY;
    let d = Math.sqrt(dx * dx + dy * dy);
    // Clamp foot to within reach (prevents stretching)
    const reach = l1 + l2 - 0.002;
    if (d > reach) {
      const k = reach / d;
      const fx = hipX + dx * k;
      const fy = hipY + dy * k;
      d = reach;
      // Recompute foot inside reach
      const ux = (fx - hipX) / d;
      const uy = (fy - hipY) / d;
      return {
        kneeX: hipX + ux * l1,
        kneeY: hipY + uy * l1,
        footX: fx,
        footY: fy,
      };
    }
    // Cosine law: distance from hip to knee-projection on hip-foot line
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const hSq = Math.max(0, l1 * l1 - a * a);
    const h = Math.sqrt(hSq);
    const ux = dx / d, uy = dy / d;
    // Perp axis (rotate +90°). `forward` selects which side knee bulges.
    const px = -uy * forward, py = ux * forward;
    return {
      kneeX: hipX + ux * a + px * h,
      kneeY: hipY + uy * a + py * h,
      footX, footY,
    };
  }

  // ───────────────────────────────────────────────────────────────
  // POSE — walking gait + idle stand with breath + weight shift
  //
  //   phase    walk phase 0..1 (only relevant when walking)
  //   walking  if true, produces stepping gait; if false, idle stand
  //   idleT    seconds elapsed in idle stand mode (for breath cycle)
  // ───────────────────────────────────────────────────────────────
  function buildPose(phase, walking, idleT) {
    const TAU = Math.PI * 2;

    // Per-leg step kinematics. Returns hipAngle and lift (foot Y).
    function stepKinematics(p) {
      let hipAng, lift;
      if (p < 0.58) {
        // STANCE: leg sweeps forward → back (no lift)
        const t = p / 0.58;
        hipAng = lerp(-0.34, 0.34, t);
        lift = 0;
      } else {
        // SWING: leg lifts and swings forward
        const t = (p - 0.58) / 0.42;
        hipAng = lerp(0.34, -0.34, t);
        lift = 0.075 * Math.sin(t * Math.PI);
      }
      return {
        hipAng: hipAng * (walking ? 1 : 0),
        lift: lift * (walking ? 1 : 0),
        isStance: p < 0.58,
        stancePhase: p < 0.58 ? p / 0.58 : 0,
      };
    }

    const legL_p = phase;
    const legR_p = (phase + 0.5) % 1;
    const L = stepKinematics(legL_p);
    const R = stepKinematics(legR_p);

    // Walking dynamics
    const hipSway   = walking ? Math.sin(phase * TAU + Math.PI * 0.2) * 0.014 : 0;
    const bob       = walking ? (1 - Math.abs(Math.sin(phase * TAU))) * 0.020 : 0;
    const lean      = walking ? 0.024 : 0;
    const shoulderRot = walking ? Math.sin(phase * TAU) * 0.028 : 0;

    // Idle dynamics: gentle breath (chest rise/fall ~4s) + weight
    // shift between feet (~7s). These overlay on the static pose
    // when the figure has finished walking in.
    const idleBreath = walking ? 0 : Math.sin(idleT * TAU / 4.0) * 0.008;
    const idleSway   = walking ? 0 : Math.sin(idleT * TAU / 7.0) * 0.012;
    const idleBob    = walking ? 0 : Math.sin(idleT * TAU / 4.0 + Math.PI) * 0.006;

    // Vertical anchors in figure-space (0=crown, 1=soles).
    // Classical 7.5-head proportions: head height ~13.5% of total.
    const yCrown    = 0.005 + bob + idleBob;
    const yChin     = yCrown + 0.135;        // head ~7.4H proportion
    const yShoulder = yChin + 0.045;
    const yChest    = yShoulder + 0.10;
    const yWaist    = yShoulder + 0.20 - idleBreath;
    const yHip      = yShoulder + 0.30;
    // Hip to soles = ~0.52, slightly less than total leg length so
    // the IK never has to stretch the leg to reach the ground.

    const wHead     = 0.115;
    const wShoulder = 0.235;
    const wHip      = 0.180;

    const cx = hipSway + idleSway;

    const head      = [cx, yCrown + 0.045];
    const hairTop   = [cx + 0.012, yCrown - 0.020];  // slight asymmetry
    const chin      = [cx, yChin];
    const neck      = [cx, yShoulder - 0.012];
    const shoulderC = [cx + lean * 0.5, yShoulder];
    const chest     = [cx + lean * 0.6, yChest - idleBreath];  // chest rises on inhale
    const waist     = [cx + lean, yWaist];
    const hipC      = [cx + lean * 1.2, yHip];

    const shoulderL = [
      cx - wShoulder * 0.5 + shoulderRot * 0.04 - lean * 0.3,
      yShoulder + Math.abs(shoulderRot) * 0.012,
    ];
    const shoulderR = [
      cx + wShoulder * 0.5 + shoulderRot * 0.04 - lean * 0.3,
      yShoulder + Math.abs(shoulderRot) * 0.012,
    ];

    const hipL = [cx - wHip * 0.5 + lean * 1.2, yHip];
    const hipR = [cx + wHip * 0.5 + lean * 1.2, yHip];

    // Arm swing (opposite legs). When idle, base elbow bend is small
    // (~5°) so arms hang naturally. When walking, base bend rises so
    // the forearm carries forward through the swing.
    const armSwingL = -L.hipAng * 0.85;
    const armSwingR = -R.hipAng * 0.85;
    const baseBend  = walking ? 0.40 : 0.08;
    const elbowBendL = baseBend + Math.abs(armSwingL) * 0.50;
    const elbowBendR = baseBend + Math.abs(armSwingR) * 0.50;

    // Limb lengths. Total leg = 0.535 with hip→sole distance = 0.52
    // gives the IK a small slack window so knees can bend on stance.
    const lUpperArm = 0.165;
    const lForearm  = 0.158;
    const lThigh    = 0.275;
    const lCalf     = 0.260;

    // When idle, arms hang slightly outward from the torso so they
    // visually separate (instead of fusing into the body column).
    function armPositions(shoulder, swing, bend, sideSign) {
      const idleOutward = walking ? 0 : 0.022 * sideSign;
      const sx = Math.sin(swing) * lUpperArm + idleOutward;
      const sy = Math.cos(swing) * lUpperArm;
      const elbow = [shoulder[0] + sx, shoulder[1] + sy];
      const faAng = swing - bend * 0.46;
      const fx = Math.sin(faAng) * lForearm + idleOutward * 0.6;
      const fy = Math.cos(faAng) * lForearm;
      const hand = [elbow[0] + fx, elbow[1] + fy];
      return { elbow, hand };
    }

    // Foot positioning + IK leg.
    //
    // For our front-ish view, feet plant at a fixed ground-Y per leg.
    // During stance, foot Y stays locked (no slide). During swing,
    // foot lifts proportional to step.lift. The horizontal x is the
    // hip x (slight outward splay).
    const groundY = 1.0;  // figure-space soles
    function legPositions(hip, k) {
      // Foot x: keep aligned with hip x (slight outward for both)
      const footOutward = hip[0] < cx ? -0.020 : 0.020;
      const footX = hip[0] + footOutward;
      const footY = groundY - k.lift;
      // 2-bone IK from hip → foot
      // forward sign: knees bulge slightly outward (away from body center)
      const forwardSign = hip[0] < cx ? -1 : 1;
      const ik = ik2(hip[0], hip[1], footX, footY, lThigh, lCalf, forwardSign);
      // Foot orientation: heel slightly back, toe forward + ankle dorsiflexion
      // During swing, toe lifts (heel-strike preparation)
      const footAng = walking
        ? Math.PI / 2 - Math.sin((k.stancePhase + 0.5) * TAU) * 0.12
        : Math.PI / 2;
      const heel = [
        ik.footX - Math.cos(footAng) * 0.020,
        ik.footY - Math.sin(footAng) * 0.020,
      ];
      const toe = [
        ik.footX + Math.cos(footAng) * 0.054,
        ik.footY + Math.sin(footAng) * 0.054,
      ];
      return {
        knee: [ik.kneeX, ik.kneeY],
        ankle: [ik.footX, ik.footY],
        heel, toe,
        isStance: k.isStance,
      };
    }

    const armL = armPositions(shoulderL, armSwingL, elbowBendL, -1);
    const armR = armPositions(shoulderR, armSwingR, elbowBendR, +1);
    const legLp = legPositions(hipL, L);
    const legRp = legPositions(hipR, R);

    return {
      head, hairTop, chin, neck, shoulderC, chest, waist, hipC,
      shoulderL, shoulderR, hipL, hipR,
      armL, armR,
      legL: legLp, legR: legRp,
      widths: { head: wHead, shoulder: wShoulder, hip: wHip },
    };
  }

  // ───────────────────────────────────────────────────────────────
  // RASTERIZATION
  // ───────────────────────────────────────────────────────────────

  function rasterizeContour(d, cols, rows, p1, p2, contour, scaleW, weight) {
    const ax = p2[0] - p1[0];
    const ay = p2[1] - p1[1];
    const len = Math.sqrt(ax * ax + ay * ay) || 0.0001;

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

  function rasterizeBody(d, cols, rows, pose, scale, anchor, depth) {
    // Wider, slightly shorter figure → reads as a person, not a column.
    // figH * 0.55 gives shoulder width ≈ 30% of total height (real human).
    const figH = rows * scale * 0.84;
    const figW = figH * 0.55;
    const cx0 = anchor.cx;
    const cy0 = anchor.cyBottom;

    const fx = (p) => cx0 + p[0] * figW;
    const fy = (p) => cy0 - figH + p[1] * figH;
    const partScale = figW;

    // 3/4 hinting: leading-side limbs scale slightly larger.
    const leadBoost = 1 + 0.06 * depth;
    const trailBoost = 1 - 0.04 * depth;

    // Hair (drawn first, behind head)
    {
      const top = [fx(pose.hairTop), fy(pose.hairTop)];
      const bot = [fx(pose.head), fy(pose.head) - pose.widths.head * figW * 0.2];
      rasterizeContour(d, cols, rows, top, bot, HAIR_CONTOUR,
        pose.widths.head * partScale * 2.05, 0.95);
    }

    // Head — bigger absolute multiplier so it reads as a head, not a dot
    {
      const top = [fx(pose.head), fy(pose.head)];
      const bot = [fx(pose.chin), fy(pose.chin)];
      rasterizeContour(d, cols, rows, top, bot, HEAD_CONTOUR,
        pose.widths.head * partScale * 1.95, 1.0);
    }

    // Neck — thicker
    rasterizeContour(d, cols, rows,
      [fx(pose.chin), fy(pose.chin)],
      [fx(pose.neck), fy(pose.neck)],
      NECK_CONTOUR, partScale * 0.22, 0.85);

    // Torso — thicker so the V-taper reads
    {
      const top = [fx(pose.shoulderC), fy(pose.shoulderC)];
      const bot = [fx(pose.hipC), fy(pose.hipC) + 0.3];
      rasterizeContour(d, cols, rows, top, bot, TORSO_CONTOUR,
        partScale * 0.46, 1.0);
    }

    // Arms — thicker so they separate from the torso
    const armList = [
      { sh: pose.shoulderL, arm: pose.armL, w: 0.23 * trailBoost },
      { sh: pose.shoulderR, arm: pose.armR, w: 0.23 * leadBoost },
    ];
    for (const a of armList) {
      rasterizeContour(d, cols, rows,
        [fx(a.sh), fy(a.sh)],
        [fx(a.arm.elbow), fy(a.arm.elbow)],
        BICEP_CONTOUR, partScale * a.w, 1.0);
      rasterizeContour(d, cols, rows,
        [fx(a.arm.elbow), fy(a.arm.elbow)],
        [fx(a.arm.hand), fy(a.arm.hand)],
        FOREARM_CONTOUR, partScale * (a.w * 0.89), 0.95);
      // Hand (slightly bigger ellipse)
      rasterizeEllipse(d, cols, rows,
        fx(a.arm.hand), fy(a.arm.hand),
        partScale * 0.055, partScale * 0.095, 0.95);
    }

    // Legs — thicker
    const legList = [
      { hp: pose.hipL, lg: pose.legL, w: 0.25 * trailBoost },
      { hp: pose.hipR, lg: pose.legR, w: 0.25 * leadBoost },
    ];
    for (const l of legList) {
      rasterizeContour(d, cols, rows,
        [fx(l.hp), fy(l.hp)],
        [fx(l.lg.knee), fy(l.lg.knee)],
        THIGH_CONTOUR, partScale * l.w, 1.0);
      rasterizeContour(d, cols, rows,
        [fx(l.lg.knee), fy(l.lg.knee)],
        [fx(l.lg.ankle), fy(l.lg.ankle)],
        CALF_CONTOUR, partScale * (l.w * 0.83), 1.0);
      // Feet: solid horizontal ellipse instead of contour. Reads as
      // a planted shoe rather than a smear.
      rasterizeEllipse(d, cols, rows,
        fx(l.lg.ankle) + partScale * 0.025,
        fy(l.lg.ankle) + 0.6,
        partScale * 0.075, partScale * 0.030, 1.0);
    }
  }

  // ───────────────────────────────────────────────────────────────
  // Edge-brighten: silhouette outline cells get a small density bump
  // so the figure reads against background. Works by detecting cells
  // with a low-density neighbor (i.e. edge pixels).
  // ───────────────────────────────────────────────────────────────
  function applyEdgeBrighten(cellD, cols, rows, threshold, boost) {
    const out = new Float32Array(cellD.length);
    for (let y = 0; y < rows; y++) {
      const rowStart = y * cols;
      for (let x = 0; x < cols; x++) {
        const i = rowStart + x;
        const v = cellD[i];
        if (v < threshold) { out[i] = v; continue; }
        // 4-neighbor gap test
        const left  = x > 0        ? cellD[i - 1]    : 0;
        const right = x < cols - 1 ? cellD[i + 1]    : 0;
        const up    = y > 0        ? cellD[i - cols] : 0;
        const down  = y < rows - 1 ? cellD[i + cols] : 0;
        const minN = Math.min(left, right, up, down);
        if (minN < threshold * 0.5) {
          out[i] = Math.min(1, v + boost);
        } else {
          out[i] = v;
        }
      }
    }
    for (let i = 0; i < cellD.length; i++) cellD[i] = out[i];
  }

  // ───────────────────────────────────────────────────────────────
  // Atmosphere — layered horizon particle field (parallax dust)
  // ───────────────────────────────────────────────────────────────
  function rasterizeAtmosphere(d, cols, rows, depth, elapsed) {
    const horizonY = Math.floor(rows * 0.22);
    const intensity = lerp(0.20, 0.03, depth);
    if (intensity < 0.02) return;
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

  // Contact shadow
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
  function downsample(subD, subCols, subRows, outD, outCols, outRows, ss) {
    const inv = 1 / (ss * ss);
    for (let y = 0; y < outRows; y++) {
      const ys = y * ss;
      for (let x = 0; x < outCols; x++) {
        const xs = x * ss;
        let sum = 0;
        for (let oy = 0; oy < ss; oy++) {
          const sy = ys + oy;
          if (sy >= subRows) continue;
          const rowStart = sy * subCols;
          for (let ox = 0; ox < ss; ox++) {
            const sx = xs + ox;
            if (sx >= subCols) continue;
            sum += subD[rowStart + sx];
          }
        }
        outD[y * outCols + x] = sum * inv;
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
    canvas.style.opacity = '0';     // fade in on first paint
    canvas.style.transition = 'opacity 320ms ease-out';
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);

    const ctx = canvas.getContext('2d');

    let dpr = 1;
    let cssW = 0, cssH = 0;
    let cols = 0, rows = 0;
    let subCols = 0, subRows = 0;
    let subDensity = null;
    let cellDensity = null;
    let shedData = null;  // [time, density] per cell

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
      shedData = new Float32Array(cols * rows * 2);
      ctx.font = `${FONT_PX}px ${FONT_FAMILY}`;
      ctx.textBaseline = 'top';
    }

    const ro = new ResizeObserver(() => { resize(); });
    ro.observe(host);
    resize();

    // Scroll progress → melt target
    let meltTarget = 0;
    let meltCurrent = 0;
    function readScroll() {
      const rect = hero.getBoundingClientRect();
      const scrolled = -rect.top;
      const span = Math.max(1, rect.height * 0.32);
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

    // Adaptive-quality state. Measure frame cost in the first window
    // and downgrade SS if too slow.
    let perfWindow = [];
    let perfChecked = false;
    function maybeDowngrade() {
      if (perfChecked) return;
      if (perfWindow.length < 16) return;
      perfChecked = true;
      const avg = perfWindow.reduce((a, b) => a + b, 0) / perfWindow.length;
      if (avg > 17) {
        // Slow device: drop SS, larger cells
        SS = 2;
        CELL_W = 7;
        CELL_H = 11;
        FONT_PX = 11;
        resize();
      }
    }

    // ── Particle systems (foot-plant ripples + walk-in dust trail)
    const ripples = [];          // {t0, x, y, life}
    const dust    = [];          // {t0, x, y, vx, vy, life}
    let lastFootStateL = false;  // was left foot in stance last frame?
    let lastFootStateR = false;

    // Idle phase starts ticking once entry walk completes
    let idleStartedAt = null;

    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (!visible && meltCurrent > 0.98) { last = now; return; }

      const dt = Math.min(0.05, (now - last) / 1000);
      const frameStart = now;
      last = now;

      meltCurrent += (meltTarget - meltCurrent) * Math.min(1, dt * 7.5);
      const melt = meltCurrent;

      const elapsed = (now - startedAt) / 1000;
      const enterRaw = reduced ? 1 : Math.min(1, elapsed / ENTRY_DURATION);
      const entryT = reduced ? 1 : easeOutBack(enterRaw);
      const depth = clamp(entryT, 0, 1);
      const scale = lerp(0.12, 1.0, depth);
      const walking = !reduced && enterRaw < 1;

      // Track idle time
      if (!walking && idleStartedAt === null) idleStartedAt = elapsed;
      const idleT = idleStartedAt === null ? 0 : (elapsed - idleStartedAt);

      if (walking) phase = (phase + dt / WALK_PERIOD) % 1;

      // Anchor: figure walks from far→close
      const horizonY = subRows * 0.28;
      const groundY  = subRows * 0.97;
      // Anchor: figure walks from far→close in DEPTH (vertical), but
      // stays centered horizontally in the slot at all depths.
      const cyBottom = lerp(horizonY + subRows * 0.44, groundY, depth);
      const cxAnchor = subCols * 0.50;
      // Cell-space equivalents (used by ground line, foot ripples,
      // melt cull, etc). Computed once here so all downstream code
      // shares the same numbers.
      const cellHorizon  = Math.floor(rows * 0.28);
      const cellGround   = Math.floor(rows * 0.97);
      const cyBottomCell = lerp(cellHorizon + rows * 0.44, cellGround, depth);
      const cxAnchorCell = cxAnchor / SS;

      const pose = buildPose(walking ? phase : 0, walking, idleT);

      // ── Reset sub-density grid
      for (let i = 0; i < subDensity.length; i++) subDensity[i] = 0;

      // ── Atmosphere
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
        { cx: cxAnchor, cyBottom }, depth);

      // ── Distance fade
      if (depth < 1) {
        const fade = lerp(0.48, 1.0, depth);
        for (let i = 0; i < subDensity.length; i++) subDensity[i] *= fade;
      }

      // ── Downsample
      downsample(subDensity, subCols, subRows, cellDensity, cols, rows, SS);

      // ── Edge brighten (rim-light feel)
      applyEdgeBrighten(cellDensity, cols, rows, 0.10, 0.30);

      // ── Interior fill: any interior cell (one with all neighbors
      // above the threshold) is bumped to a minimum density so the
      // body reads as solid, not Swiss-cheesed.
      {
        const FILL_MIN = 0.55;
        const FILL_THRESHOLD = 0.10;
        for (let y = 1; y < rows - 1; y++) {
          const rs = y * cols;
          for (let x = 1; x < cols - 1; x++) {
            const i = rs + x;
            const v = cellDensity[i];
            if (v < FILL_THRESHOLD) continue;
            // 8-neighbor: if all neighbors are also above threshold,
            // this cell is interior.
            const n =
              cellDensity[i - 1] +
              cellDensity[i + 1] +
              cellDensity[i - cols] +
              cellDensity[i + cols] +
              cellDensity[i - cols - 1] +
              cellDensity[i - cols + 1] +
              cellDensity[i + cols - 1] +
              cellDensity[i + cols + 1];
            const minN = Math.min(
              cellDensity[i - 1], cellDensity[i + 1],
              cellDensity[i - cols], cellDensity[i + cols]
            );
            if (minN > FILL_THRESHOLD && cellDensity[i] < FILL_MIN) {
              cellDensity[i] = FILL_MIN;
            }
            // Reference n to silence unused warnings (used in dev sweeps)
            void n;
          }
        }
      }

      // ── Ground line: faint dotted horizontal line at the figure's
      // foot level. Provides visual grounding so the figure isn't
      // floating in space.
      if (depth > 0.5) {
        const groundRow = Math.min(rows - 1, Math.floor(cyBottomCell));
        const figHCellLocal = rows * scale * 0.84;
        const figWCellLocal = figHCellLocal * 0.55;
        const span = figWCellLocal * 1.4;
        for (let dx = -span; dx <= span; dx++) {
          const x = Math.round(cxAnchorCell + dx);
          if (x < 0 || x >= cols) continue;
          // Only draw on every other cell for a dotted look
          if ((x & 1) === 0) continue;
          const fall = 1 - Math.abs(dx) / span;
          const v = fall * fall * 0.18 * smoothstep(0.5, 1.0, depth);
          const i = groundRow * cols + x;
          if (v > cellDensity[i]) cellDensity[i] = v;
        }
      }

      // ── Detect foot-plant events (transition from swing → stance)
      //     and emit a ground ripple.
      if (walking && depth > 0.4) {
        const figHCell = rows * scale * 0.84;
        const figWCell = figHCell * 0.55;
        const stanceL = pose.legL.isStance;
        const stanceR = pose.legR.isStance;
        if (stanceL && !lastFootStateL) {
          ripples.push({
            t0: elapsed,
            x: (cxAnchor / SS) + (pose.hipL[0] - 0) * figWCell,
            y: cyBottomCell + 0.5,
            life: 0.5,
          });
        }
        if (stanceR && !lastFootStateR) {
          ripples.push({
            t0: elapsed,
            x: (cxAnchor / SS) + (pose.hipR[0] - 0) * figWCell,
            y: cyBottomCell + 0.5,
            life: 0.5,
          });
        }
        lastFootStateL = stanceL;
        lastFootStateR = stanceR;

        // Walk-in dust trail: emit a few particles per second behind
        // each foot during the entry walk.
        if (cellNoise(elapsed * 1000 | 0, 0, 7) < dt * 8) {
          const useL = cellNoise(elapsed * 100 | 0, 1, 13) < 0.5;
          const hip = useL ? pose.hipL : pose.hipR;
          dust.push({
            t0: elapsed,
            x: (cxAnchor / SS) + hip[0] * figWCell + (cellNoise(elapsed, 0, 3) - 0.5) * 1.4,
            y: cyBottomCell + 0.4,
            vx: (cellNoise(elapsed, 1, 11) - 0.5) * 0.6,
            vy: -0.4 - cellNoise(elapsed, 2, 19) * 0.5,
            life: 1.2,
          });
        }
      }

      // ── Melt cull with organic drip tendrils
      const figHCell     = rows * scale * 0.84;
      const figTopRow    = Math.max(0, Math.floor(cyBottomCell - figHCell));
      const figRows      = Math.max(1, Math.floor(cyBottomCell + 1) - figTopRow);
      const meltRow      = figTopRow + Math.floor(melt * figRows * 1.05);

      for (let y = 0; y < rows; y++) {
        const perRowJitter = cellNoise(y, 0, 42) * 2.0;
        const myMeltLine = meltRow + perRowJitter;
        const rowStart = y * cols;
        for (let x = 0; x < cols; x++) {
          const i = rowStart + x;
          // Drip tendril: each column has a downward "finger" reaching
          // ahead of the main melt line. Tendril depth varies per
          // column via noise.
          const tendril = cellNoise(x, 0, 88) * 4.5 * smoothstep(0, 0.4, melt);
          const cellOffset = cellNoise(x, y, 17) * 2.0;
          const effectiveMeltLine = myMeltLine + cellOffset - tendril;

          if (y < effectiveMeltLine) {
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

      // ── Glow band at melt front
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

      // Fade in on first paint (CSS transition handles smoothing)
      const fadeIn = clamp(elapsed * 1000 / FADE_IN_MS, 0, 1);
      const fadeOut = clamp(1 - (melt - 0.75) / 0.25, 0, 1);
      const canvasAlpha = Math.min(fadeIn, fadeOut);
      canvas.style.opacity = String(canvasAlpha);
      if (canvasAlpha <= 0.005) {
        // Adaptive perf check still runs even if we skip draw
        if (!perfChecked) {
          perfWindow.push(performance.now() - frameStart);
          maybeDowngrade();
        }
        return;
      }

      const ink = resolveInk();
      ctx.globalAlpha = 1;
      ctx.fillStyle = ink;

      // ── Body cells with S-curve tone-map
      for (let y = 0; y < rows; y++) {
        const rowStart = y * cols;
        const py = y * CELL_H;
        for (let x = 0; x < cols; x++) {
          const v = cellDensity[rowStart + x];
          if (v <= 0.022) continue;
          const mapped = sCurve(v);
          const idx = Math.min(D_N - 1, Math.floor(mapped * (D_N - 0.001)));
          ctx.fillText(D[idx], x * CELL_W, py);
        }
      }

      // ── Foot-plant ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        const age = elapsed - r.t0;
        if (age > r.life) { ripples.splice(i, 1); continue; }
        const t = age / r.life;
        const radius = t * 4.5;
        const alpha = (1 - t) * 0.5;
        ctx.globalAlpha = alpha;
        // Draw a thin horizontal ripple ring
        for (let dx = -radius; dx <= radius; dx += 0.7) {
          const ang = Math.acos(clamp(dx / Math.max(0.01, radius), -1, 1));
          const dy = Math.sin(ang) * radius * 0.25;
          const xs = Math.round(r.x + dx);
          const ys = Math.round(r.y + dy);
          if (xs >= 0 && xs < cols && ys >= 0 && ys < rows) {
            ctx.fillText('.', xs * CELL_W, ys * CELL_H);
          }
        }
      }
      ctx.globalAlpha = 1;

      // ── Walk-in dust trail
      for (let i = dust.length - 1; i >= 0; i--) {
        const p = dust[i];
        const age = elapsed - p.t0;
        if (age > p.life) { dust.splice(i, 1); continue; }
        // Update position (Euler integration)
        const x = p.x + p.vx * age;
        const y = p.y + p.vy * age + 0.6 * age * age; // gravity
        const t = age / p.life;
        const alpha = (1 - t) * 0.45;
        const xs = Math.round(x);
        const ys = Math.round(y);
        if (xs < 0 || xs >= cols || ys < 0 || ys >= rows) continue;
        const ramp = ".'`,:;";
        const ch = ramp[Math.floor((1 - t) * ramp.length * 0.999)];
        ctx.globalAlpha = alpha;
        ctx.fillText(ch, xs * CELL_W, ys * CELL_H);
      }
      ctx.globalAlpha = 1;

      // ── Falling shed characters
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
          const mapped = sCurve(Math.min(1, origDensity));
          const baseIdx = Math.min(D_N - 1, Math.floor(mapped * (D_N - 0.001)));
          const idx = Math.max(0, baseIdx - Math.floor(age * 6));
          ctx.globalAlpha = 0.55 * alpha;
          ctx.fillText(D[idx], x * CELL_W + drift, y * CELL_H + fall);
        }
      }

      ctx.globalAlpha = 1;

      // Adaptive perf metric
      if (!perfChecked) {
        perfWindow.push(performance.now() - frameStart);
        maybeDowngrade();
      }
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
