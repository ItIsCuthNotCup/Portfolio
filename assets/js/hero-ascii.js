/* ═══════════════════════════════════════════════════════════════
   hero-ascii.js — cinematic ASCII humanoid

   A single <canvas> inside #scene-canvas. Anatomical silhouette,
   IK-clean walking gait, perspective walk-in from horizon to
   foreground, top-down evaporation melt driven by hero scroll.

   PIPELINE PER FRAME
     1. Compute pose (joint positions) from walk phase + depth.
     2. Rasterize the body as anatomical CONTOURS (not stick segments)
        into a sub-cell density grid (2× resolution) for AA.
     3. Apply directional lighting (key light upper-left, fill from
        lower-right, ambient base) → modulate density.
     4. Downsample density grid to one value per ASCII cell.
     5. Apply melt cull: cells above the per-row jittered melt line
        evaporate; transition characters drift downward.
     6. Map cells to characters from a 64-step ramp.
     7. Composite: atmosphere → silhouette → falling chars → puddle.

   The silhouette uses cross-section contours: each body part is a
   list of (centerY, halfWidth) samples that together describe a
   closed shape (head, neck, deltoid, bicep, forearm, hand, torso,
   pelvis, thigh, calf, foot). The walk gait uses forward kinematics
   with a heel-toe stance/swing model so feet plant cleanly and don't
   slide while the figure walks toward camera.

   Honors prefers-reduced-motion. Pauses when fully off-screen and
   fully melted. DPR-clamped. No external libs, no global side
   effects. Cleanup via dispose().
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const HOST_ID = 'scene-canvas';
  const HERO_ID = 'hero';

  // ── 64-step density ramp (light → dense). The longer the ramp,
  //    the smoother the volumetric reading.
  const D = " .'`,:_-~+!|iltcjnxzkasvIJVYC1Z3uoFTLECPGkHmNXMRDQ0$&8B%@█▓▒░◼◾●◆■";
  const D_N = D.length;

  // ── Cell metrics. Smaller cells = more detail. 5×7 px gives ~92×78
  //    cells in a 460×560 box — heavy enough to read anatomy, cheap
  //    enough to compute every frame.
  const CELL_W = 5;
  const CELL_H = 7;
  const FONT_PX = 9;
  const FONT_FAMILY = "ui-monospace, 'DM Mono', 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace";

  // ── Sub-cell oversampling for AA. SS=2 means we rasterize into a
  //    grid that's 2x in each dimension, then downsample to cells.
  const SS = 2;

  // ── Walk cycle period (seconds) at full size
  const WALK_PERIOD = 1.05;

  // ── Entry walk total duration (seconds)
  const ENTRY_DURATION = 3.6;

  function resolveInk() {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
    return v || '#111111';
  }
  function prefersReducedMotion() {
    return window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smoothstep(a, b, x) {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function smootherstep(a, b, x) {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // ───────────────────────────────────────────────────────────────
  // ANATOMICAL CONTOUR DEFINITIONS
  //
  // Each list describes a body-part outline as a series of cross-
  // sections (yOffset from part top, halfWidth as fraction of part
  // length). The rasterizer fills the volume between the centerline
  // and the outline.
  //
  // Coordinates are in "part-local" space (0..1 along axis). The
  // pose model places each part in figure-space and the rasterizer
  // composes them.
  // ───────────────────────────────────────────────────────────────

  // Head: egg-shape with subtle jaw narrowing
  const HEAD_CONTOUR = [
    [0.00, 0.42],  // crown
    [0.10, 0.50],
    [0.22, 0.55],
    [0.36, 0.58],  // widest (cranium)
    [0.50, 0.57],  // temples
    [0.62, 0.55],  // cheekbones
    [0.74, 0.50],  // jaw
    [0.86, 0.40],  // jaw line
    [0.94, 0.30],
    [1.00, 0.00],  // chin
  ];

  // Neck: short tapered cylinder
  const NECK_CONTOUR = [
    [0.00, 0.24],  // top (under chin)
    [0.50, 0.26],
    [1.00, 0.32],  // base (broadens to trapezius)
  ];

  // Torso (front view): broad shoulders → V-taper to waist
  const TORSO_CONTOUR = [
    [0.00, 0.66],  // shoulders/deltoids
    [0.05, 0.74],  // deltoid caps
    [0.12, 0.72],  // upper chest
    [0.22, 0.66],  // mid chest
    [0.32, 0.58],  // sternum
    [0.42, 0.50],  // ribcage
    [0.52, 0.45],  // upper waist
    [0.62, 0.42],  // narrowest waist
    [0.72, 0.46],  // lower waist
    [0.82, 0.55],  // upper hip
    [0.92, 0.60],  // hip
    [1.00, 0.55],  // hip bottom (transitions to legs)
  ];

  // Upper arm (bicep): tapers from shoulder cap to elbow
  const BICEP_CONTOUR = [
    [0.00, 0.42],
    [0.18, 0.45],
    [0.40, 0.42],
    [0.62, 0.38],
    [0.82, 0.34],
    [1.00, 0.30],
  ];

  // Forearm: tapers further to wrist
  const FOREARM_CONTOUR = [
    [0.00, 0.32],
    [0.16, 0.36],  // forearm flexor bulge
    [0.34, 0.34],
    [0.56, 0.30],
    [0.78, 0.24],
    [1.00, 0.20],
  ];

  // Hand: short oval with subtle finger hint
  const HAND_CONTOUR = [
    [0.00, 0.28],
    [0.30, 0.36],
    [0.55, 0.34],
    [0.80, 0.28],
    [1.00, 0.22],
  ];

  // Thigh: broad at hip, tapers to knee
  const THIGH_CONTOUR = [
    [0.00, 0.50],
    [0.18, 0.52],
    [0.42, 0.48],
    [0.65, 0.42],
    [0.84, 0.36],
    [1.00, 0.32],
  ];

  // Calf: bulge mid-shin then taper to ankle
  const CALF_CONTOUR = [
    [0.00, 0.32],
    [0.20, 0.40],  // calf muscle
    [0.42, 0.38],
    [0.65, 0.32],
    [0.85, 0.25],
    [1.00, 0.18],
  ];

  // Foot: low horizontal pad, heel back
  const FOOT_CONTOUR = [
    [0.00, 0.22],  // heel
    [0.20, 0.22],
    [0.55, 0.20],
    [0.80, 0.16],
    [1.00, 0.10],  // toe
  ];

  // ───────────────────────────────────────────────────────────────
  // POSE
  //
  // Returns joint positions in figure-space (x: -0.5..+0.5, y: 0..1)
  // for a given walk phase. Walking flag controls whether legs cycle.
  // ───────────────────────────────────────────────────────────────
  function buildPose(phase, walking) {
    const TAU = Math.PI * 2;
    const stride = walking ? 1 : 0;

    const legL_p = phase;
    const legR_p = (phase + 0.5) % 1;

    // Heel-toe walking step: stance (foot planted) then swing (foot lifted)
    function stepKinematics(p) {
      let hipAng, kneeBend, lift;
      if (p < 0.6) {
        // STANCE: leg sweeps from forward to backward as body advances
        const t = p / 0.6;
        hipAng = lerp(-0.36, 0.34, t);
        kneeBend = 0.06 + Math.sin(t * Math.PI) * 0.05;  // micro-bend at midstance
        lift = 0;
      } else {
        // SWING: knee bends sharply, leg swings forward
        const t = (p - 0.6) / 0.4;
        hipAng = lerp(0.34, -0.36, t);
        kneeBend = 0.65 * Math.sin(t * Math.PI) + 0.12;
        lift = 0.07 * Math.sin(t * Math.PI);
      }
      return {
        hipAng: hipAng * stride,
        kneeBend: kneeBend * stride,
        lift: lift * stride,
        // ankle dorsiflexion: heel up at toe-off, toe up at heel-strike
        ankleAng: walking ? Math.sin((p - 0.5) * TAU) * 0.18 : 0,
      };
    }

    const L = stepKinematics(legL_p);
    const R = stepKinematics(legR_p);

    // Hip sway (side-to-side as weight transfers to stance leg)
    const hipSway = Math.sin(phase * TAU + Math.PI * 0.2) * 0.012 * stride;
    // Vertical bob (double frequency: lowest at midstance of each step)
    const bob = (1 - Math.abs(Math.sin(phase * TAU))) * 0.018 * stride;
    // Slight forward lean while walking
    const lean = walking ? 0.022 : 0;
    // Counter-rotation: shoulders rotate opposite to hips
    const shoulderRot = Math.sin(phase * TAU) * 0.025 * stride;
    const hipRot = -shoulderRot * 0.6;

    // Vertical anchor points (figure-space y, 0=crown, 1=soles)
    const yCrown = 0.020 + bob;
    const yChin = yCrown + 0.108;
    const yShoulder = yChin + 0.045;
    const yChest = yShoulder + 0.10;
    const yWaist = yShoulder + 0.20;
    const yHip = yShoulder + 0.30;

    const wHead = 0.108;
    const wShoulder = 0.225;
    const wHip = 0.176;

    const cx = 0.0 + hipSway;

    const head = [cx, yCrown + 0.045];
    const chin = [cx, yChin];
    const neck = [cx, yShoulder - 0.012];
    const shoulderC = [cx + lean * 0.5, yShoulder];
    const chest = [cx + lean * 0.6, yChest];
    const waist = [cx + lean, yWaist];
    const hipC = [cx + lean * 1.2, yHip];

    // Shoulder caps (with counter-rotation)
    const shoulderL = [
      cx - wShoulder * 0.5 + shoulderRot * 0.04 - lean * 0.3,
      yShoulder + Math.abs(shoulderRot) * 0.012,
    ];
    const shoulderR = [
      cx + wShoulder * 0.5 + shoulderRot * 0.04 - lean * 0.3,
      yShoulder + Math.abs(shoulderRot) * 0.012,
    ];

    const hipL = [cx - wHip * 0.5 + hipRot * 0.04 + lean * 1.2, yHip];
    const hipR = [cx + wHip * 0.5 + hipRot * 0.04 + lean * 1.2, yHip];

    // Arm swing (opposite to legs)
    const armSwingL = -L.hipAng * 0.85;
    const armSwingR = -R.hipAng * 0.85;
    const elbowBendL = 0.55 + Math.abs(armSwingL) * 0.45;
    const elbowBendR = 0.55 + Math.abs(armSwingR) * 0.45;

    const lUpperArm = 0.155;
    const lForearm = 0.155;
    const lThigh = 0.225;
    const lCalf = 0.205;

    function armPositions(shoulder, swing, bend) {
      const sx = Math.sin(swing) * lUpperArm;
      const sy = Math.cos(swing) * lUpperArm;
      const elbow = [shoulder[0] + sx, shoulder[1] + sy];
      const faAng = swing - bend * 0.45;
      const fx = Math.sin(faAng) * lForearm;
      const fy = Math.cos(faAng) * lForearm;
      const hand = [elbow[0] + fx, elbow[1] + fy];
      // Wrist orientation for hand contour
      const wristAng = faAng - 0.1;
      return { elbow, hand, upperAng: swing, foreAng: faAng, wristAng };
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
      // Foot orientation: ankle dorsiflexion
      const footAng = calfAng + Math.PI / 2 - k.ankleAng;
      const heel = [ankle[0] - Math.cos(footAng) * 0.018, ankle[1] - Math.sin(footAng) * 0.018];
      const toe = [ankle[0] + Math.cos(footAng) * 0.052, ankle[1] + Math.sin(footAng) * 0.052];
      return { knee, ankle, heel, toe, thighAng: ang, calfAng, footAng };
    }

    const armL = armPositions(shoulderL, armSwingL, elbowBendL);
    const armR = armPositions(shoulderR, armSwingR, elbowBendR);
    const legLp = legPositions(hipL, L);
    const legRp = legPositions(hipR, R);

    return {
      head, chin, neck, shoulderC, chest, waist, hipC,
      shoulderL, shoulderR, hipL, hipR,
      armL, armR,
      legL: legLp, legR: legRp,
      bob, lean, shoulderRot, hipRot,
      widths: {
        head: wHead,
        shoulder: wShoulder,
        hip: wHip,
      },
    };
  }

  // ───────────────────────────────────────────────────────────────
  // RASTERIZATION (sub-cell density grid)
  //
  // density: Float32Array of length (cols*SS) * (rows*SS)
  // contour: list of [yT, halfW] samples in part-local space (0..1)
  //
  // The rasterizer projects the contour along an axis (from p1→p2),
  // perpendicular axis = halfW × partLengthFactor. For each sub-cell
  // inside the resulting envelope, density += weight × softness.
  // ───────────────────────────────────────────────────────────────

  function rasterizeContour(d, cols, rows, p1, p2, contour, scaleW, weight, lightDir) {
    // Walk along the axis and stamp a disc at each step. Disc radius
    // is sampled from the contour at parameter t. Step density
    // ensures overlapping discs form a smooth body shape regardless
    // of segment orientation.
    const ax = p2[0] - p1[0];
    const ay = p2[1] - p1[1];
    const len = Math.sqrt(ax * ax + ay * ay) || 0.0001;
    const ux = ax / len, uy = ay / len;
    const px = -uy, py = ux; // perpendicular (for lighting bias)

    // Pre-extract contour x-axis for fast lookup
    const STEPS = Math.max(4, Math.ceil(len * 1.6));
    let cIdx = 0;
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      // Advance cIdx to bracket t
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
          // Directional lighting based on perpendicular projection
          let lite = 1;
          if (lightDir) {
            const off = dx * px + dy * py;
            // Surface normal in perp direction; light dot product
            const dot = -(off / r) * (lightDir[0] * px + lightDir[1] * py);
            lite = clamp(0.5 + 0.5 * dot, 0.45, 1.35);
          }
          const v = fall * weight * lite;
          if (v > d[y * cols + x]) d[y * cols + x] = v;
        }
      }
    }
  }

  function rasterizeEllipse(d, cols, rows, cx, cy, rx, ry, weight, lightDir) {
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
        const fall = 1 - dd;
        let lite = 1;
        if (lightDir) {
          const nx = dx / Math.max(0.001, dd);
          const ny = dy / Math.max(0.001, dd);
          const dot = -(nx * lightDir[0] + ny * lightDir[1]);
          lite = clamp(0.55 + 0.45 * dot, 0.4, 1.4);
        }
        d[y * cols + x] = Math.max(d[y * cols + x], fall * weight * lite);
      }
    }
  }

  // ───────────────────────────────────────────────────────────────
  // BODY RASTERIZER — composes all parts into the sub-cell grid
  // ───────────────────────────────────────────────────────────────
  function rasterizeBody(d, cols, rows, pose, scale, anchor) {
    const figH = rows * scale * 0.92;
    const figW = figH * 0.42;
    const cx0 = anchor.cx;
    const cy0 = anchor.cyBottom;

    // Light direction (upper-left key, normalized)
    const lightDir = [-0.55, -0.83];

    // Map figure-space [x,y] → sub-cell coords
    const fx = (p) => cx0 + p[0] * figW;
    const fy = (p) => cy0 - figH + p[1] * figH;

    // Part length factor — used for contour scaleW (which is the
    // perpendicular thickness). We pass figW × halfW directly.
    const partScale = figW;

    // Head — egg-shaped, slightly tilted forward by lean
    {
      const top = [fx(pose.head) - pose.lean * partScale * 0.15,
                   fy(pose.head) - pose.widths.head * figW * 0.7];
      const bot = [fx(pose.chin), fy(pose.chin)];
      rasterizeContour(d, cols, rows, top, bot, HEAD_CONTOUR,
        pose.widths.head * partScale * 1.4, 1.0, lightDir);
    }

    // Neck
    rasterizeContour(d, cols, rows,
      [fx(pose.chin), fy(pose.chin)],
      [fx(pose.neck), fy(pose.neck)],
      NECK_CONTOUR, partScale * 0.18, 0.85, lightDir);

    // Torso (shoulders → hip line)
    {
      const top = [fx(pose.shoulderC), fy(pose.shoulderC)];
      const bot = [fx(pose.hipC), fy(pose.hipC) + 0.3];
      rasterizeContour(d, cols, rows, top, bot, TORSO_CONTOUR,
        partScale * 0.34, 1.0, lightDir);
    }

    // Arms — left
    rasterizeContour(d, cols, rows,
      [fx(pose.shoulderL), fy(pose.shoulderL)],
      [fx(pose.armL.elbow), fy(pose.armL.elbow)],
      BICEP_CONTOUR, partScale * 0.18, 1.0, lightDir);
    rasterizeContour(d, cols, rows,
      [fx(pose.armL.elbow), fy(pose.armL.elbow)],
      [fx(pose.armL.hand), fy(pose.armL.hand)],
      FOREARM_CONTOUR, partScale * 0.16, 0.95, lightDir);
    // Hand (short oval at the end of the forearm)
    rasterizeEllipse(d, cols, rows,
      fx(pose.armL.hand), fy(pose.armL.hand),
      partScale * 0.04, partScale * 0.07, 0.95, lightDir);

    // Arms — right
    rasterizeContour(d, cols, rows,
      [fx(pose.shoulderR), fy(pose.shoulderR)],
      [fx(pose.armR.elbow), fy(pose.armR.elbow)],
      BICEP_CONTOUR, partScale * 0.18, 1.0, lightDir);
    rasterizeContour(d, cols, rows,
      [fx(pose.armR.elbow), fy(pose.armR.elbow)],
      [fx(pose.armR.hand), fy(pose.armR.hand)],
      FOREARM_CONTOUR, partScale * 0.16, 0.95, lightDir);
    rasterizeEllipse(d, cols, rows,
      fx(pose.armR.hand), fy(pose.armR.hand),
      partScale * 0.04, partScale * 0.07, 0.95, lightDir);

    // Legs — left
    rasterizeContour(d, cols, rows,
      [fx(pose.hipL), fy(pose.hipL)],
      [fx(pose.legL.knee), fy(pose.legL.knee)],
      THIGH_CONTOUR, partScale * 0.18, 1.0, lightDir);
    rasterizeContour(d, cols, rows,
      [fx(pose.legL.knee), fy(pose.legL.knee)],
      [fx(pose.legL.ankle), fy(pose.legL.ankle)],
      CALF_CONTOUR, partScale * 0.15, 1.0, lightDir);

    // Legs — right
    rasterizeContour(d, cols, rows,
      [fx(pose.hipR), fy(pose.hipR)],
      [fx(pose.legR.knee), fy(pose.legR.knee)],
      THIGH_CONTOUR, partScale * 0.18, 1.0, lightDir);
    rasterizeContour(d, cols, rows,
      [fx(pose.legR.knee), fy(pose.legR.knee)],
      [fx(pose.legR.ankle), fy(pose.legR.ankle)],
      CALF_CONTOUR, partScale * 0.15, 1.0, lightDir);

    // Feet
    rasterizeContour(d, cols, rows,
      [fx(pose.legL.heel), fy(pose.legL.heel)],
      [fx(pose.legL.toe), fy(pose.legL.toe)],
      FOOT_CONTOUR, partScale * 0.08, 0.95, lightDir);
    rasterizeContour(d, cols, rows,
      [fx(pose.legR.heel), fy(pose.legR.heel)],
      [fx(pose.legR.toe), fy(pose.legR.toe)],
      FOOT_CONTOUR, partScale * 0.08, 0.95, lightDir);
  }

  // Soft contact-shadow under the figure
  function rasterizeShadow(d, cols, rows, anchor, depth, figW) {
    const yShadow = anchor.cyBottom + 0.5;
    const span = figW * 0.85 * (0.4 + depth * 0.6);
    const cx0 = anchor.cx;
    const intensity = 0.35 * (0.3 + depth * 0.7);
    const yI = Math.round(yShadow);
    const yI2 = Math.min(rows - 1, yI + 1);
    if (yI < 0 || yI >= rows) return;
    for (let dx = -span; dx <= span; dx++) {
      const x = Math.round(cx0 + dx);
      if (x < 0 || x >= cols) continue;
      const fall = 1 - Math.abs(dx) / span;
      const v = fall * fall * intensity;
      d[yI * cols + x] = Math.max(d[yI * cols + x], v);
      if (yI2 !== yI) d[yI2 * cols + x] = Math.max(d[yI2 * cols + x], v * 0.6);
    }
  }

  // ───────────────────────────────────────────────────────────────
  // Atmospheric perspective: faint horizon dot pattern that the
  // figure walks out of. Pure visual flavor.
  // ───────────────────────────────────────────────────────────────
  function rasterizeAtmosphere(d, cols, rows, depth, time) {
    const horizonY = Math.floor(rows * 0.22);
    const intensity = lerp(0.18, 0.04, depth);
    if (intensity < 0.02) return;
    for (let y = Math.max(0, horizonY - 4); y <= horizonY + 4 && y < rows; y++) {
      const yFall = 1 - Math.abs(y - horizonY) / 5;
      for (let x = 0; x < cols; x += 2) {
        // Pseudo-random twinkle
        const n = (Math.sin(x * 0.93 + y * 1.7 + time * 0.3) +
                   Math.sin(x * 0.31 - y * 0.7 + time * 0.7)) * 0.5;
        if (n < 0.55) continue;
        d[y * cols + x] = Math.max(d[y * cols + x], yFall * intensity * (0.4 + n * 0.3));
      }
    }
  }

  // ───────────────────────────────────────────────────────────────
  // SUB-CELL DOWNSAMPLE (anti-alias) — average SSxSS sub-cells into
  // a single ASCII cell.
  // ───────────────────────────────────────────────────────────────
  function downsample(subD, subCols, subRows, outD, outCols, outRows) {
    const inv = 1 / (SS * SS);
    for (let y = 0; y < outRows; y++) {
      const ys = y * SS;
      for (let x = 0; x < outCols; x++) {
        const xs = x * SS;
        let sum = 0;
        for (let oy = 0; oy < SS; oy++) {
          const sy = ys + oy;
          if (sy >= subRows) continue;
          const rowStart = sy * subCols;
          for (let ox = 0; ox < SS; ox++) {
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
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);

    const ctx = canvas.getContext('2d');

    let dpr = 1;
    let cssW = 0, cssH = 0;
    let cols = 0, rows = 0;
    let subCols = 0, subRows = 0;
    let subDensity = null;
    let cellDensity = null;
    let shedTime = null;

    function resize() {
      const rect = host.getBoundingClientRect();
      cssW = Math.max(1, Math.round(rect.width));
      cssH = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.max(16, Math.floor(cssW / CELL_W));
      rows = Math.max(16, Math.floor(cssH / CELL_H));
      subCols = cols * SS;
      subRows = rows * SS;
      subDensity = new Float32Array(subCols * subRows);
      cellDensity = new Float32Array(cols * rows);
      shedTime = new Float32Array(cols * rows);
      ctx.font = `${FONT_PX}px ${FONT_FAMILY}`;
      ctx.textBaseline = 'top';
    }

    const ro = new ResizeObserver(() => { resize(); });
    ro.observe(host);
    resize();

    // ── Scroll progress
    let meltTarget = 0;
    let meltCurrent = 0;
    function readScroll() {
      const rect = hero.getBoundingClientRect();
      const scrolled = -rect.top;
      const span = Math.max(1, rect.height * 0.55);
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

    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (!visible && meltCurrent > 0.98) { last = now; return; }

      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      meltCurrent += (meltTarget - meltCurrent) * Math.min(1, dt * 8);
      const melt = meltCurrent;

      const elapsed = (now - startedAt) / 1000;
      const entryT = reduced ? 1 : Math.min(1, elapsed / ENTRY_DURATION);
      const depth = smootherstep(0, 1, entryT);
      const scale = lerp(0.18, 1.0, depth);
      const walking = !reduced;

      if (walking) phase = (phase + dt / WALK_PERIOD) % 1;

      // Anchor: figure walks from horizon-ish position (top, small) to
      // ground line at bottom (full-size).
      const horizonY = subRows * 0.30;
      const groundY = subRows * 0.97;
      const cyBottom = lerp(horizonY + subRows * 0.40, groundY, depth);
      const cxAnchor = lerp(subCols * 0.58, subCols * 0.50, depth);

      const pose = buildPose(walking ? phase : 0, walking);

      // Reset sub-density grid
      for (let i = 0; i < subDensity.length; i++) subDensity[i] = 0;

      // Atmosphere (faint dots near horizon, fades as figure walks in)
      rasterizeAtmosphere(subDensity, subCols, subRows, depth, elapsed);

      // Shadow
      const figH = subRows * scale * 0.92;
      const figW = figH * 0.42;
      if (depth > 0.18) {
        rasterizeShadow(subDensity, subCols, subRows,
          { cx: cxAnchor, cyBottom },
          depth, figW);
      }

      // Body
      rasterizeBody(subDensity, subCols, subRows, pose, scale,
        { cx: cxAnchor, cyBottom });

      // Distance fade (figure dimmer + softer at far depth)
      if (depth < 1) {
        const fade = lerp(0.55, 1.0, depth);
        for (let i = 0; i < subDensity.length; i++) subDensity[i] *= fade;
      }

      // Downsample sub-cell density into ASCII cells
      downsample(subDensity, subCols, subRows, cellDensity, cols, rows);

      // Apply melt (top-down evaporation with per-row jitter)
      const cellHorizon = Math.floor(rows * 0.30);
      const cellGround = Math.floor(rows * 0.97);
      const cyBottomCell = lerp(cellHorizon + rows * 0.40, cellGround, depth);
      const figHCell = rows * scale * 0.92;
      const figTopRow = Math.max(0, Math.floor(cyBottomCell - figHCell));
      const figBottomRow = Math.min(rows - 1, Math.ceil(cyBottomCell + 1));
      const figRows = Math.max(1, figBottomRow - figTopRow);
      const meltLine = figTopRow + Math.floor(melt * figRows * 1.05);

      for (let y = 0; y < rows; y++) {
        const jitter = Math.sin(y * 5.13) * 1.4 + Math.cos(y * 1.91) * 0.9;
        const myMeltLine = meltLine + jitter;
        const isShed = y < myMeltLine;
        const rowStart = y * cols;
        for (let x = 0; x < cols; x++) {
          const i = rowStart + x;
          if (isShed) {
            if (shedTime[i] === 0 && cellDensity[i] > 0.06) {
              shedTime[i] = elapsed + 0.0001;
            }
            cellDensity[i] = 0;
          } else {
            shedTime[i] = 0;
          }
        }
      }

      // Edge fray: cells immediately AT the melt line flicker between
      // shed and not-shed, stepping down a short ramp before vanishing.
      // (Achieved by applying a small probabilistic dim.)
      if (melt > 0 && melt < 1) {
        for (let dy = -2; dy <= 2; dy++) {
          const y = Math.floor(meltLine) + dy;
          if (y < 0 || y >= rows) continue;
          const dim = 1 - (3 - Math.abs(dy)) * 0.18;
          const rowStart = y * cols;
          for (let x = 0; x < cols; x++) {
            cellDensity[rowStart + x] *= clamp(dim, 0, 1);
          }
        }
      }

      // ── Draw
      ctx.clearRect(0, 0, cssW, cssH);
      const ink = resolveInk();
      ctx.fillStyle = ink;
      ctx.globalAlpha = 1;

      // Body cells
      for (let y = 0; y < rows; y++) {
        const rowStart = y * cols;
        const py = y * CELL_H;
        for (let x = 0; x < cols; x++) {
          const v = cellDensity[rowStart + x];
          if (v <= 0.04) continue;
          const idx = Math.min(D_N - 1, Math.floor(Math.min(1, v) * (D_N - 0.001)));
          ctx.fillText(D[idx], x * CELL_W, py);
        }
      }

      // Falling shed characters
      for (let y = 0; y < rows; y++) {
        const rowStart = y * cols;
        for (let x = 0; x < cols; x++) {
          const i = rowStart + x;
          const st = shedTime[i];
          if (st === 0) continue;
          const age = elapsed - st;
          if (age < 0 || age > 1.8) continue;
          const fall = age * age * 70;
          const drift = Math.sin((y * 0.4 + x * 0.6 + age * 2)) * 6;
          const alpha = Math.max(0, 1 - age / 1.8);
          // Step DOWN the density ramp as it ages
          const baseIdx = D_N - 6;
          const idx = Math.max(0, Math.min(D_N - 1, baseIdx - Math.floor(age * 12)));
          ctx.globalAlpha = 0.6 * alpha;
          ctx.fillText(D[idx], x * CELL_W + drift, y * CELL_H + fall);
        }
      }

      // Faint puddle near the bottom when melted
      if (melt > 0.5) {
        const pAlpha = Math.min(1, (melt - 0.5) / 0.5) * 0.5;
        ctx.globalAlpha = pAlpha;
        const puddleY = rows - 2;
        const puddleW = Math.floor(cols * 0.35);
        const startX = Math.floor((cxAnchor / SS) - puddleW / 2);
        for (let x = 0; x < puddleW; x++) {
          const xx = startX + x;
          if (xx < 0 || xx >= cols) continue;
          const noise = Math.sin(x * 0.6 + elapsed) * 0.2 + 0.45;
          const idx = Math.max(0, Math.min(D_N - 1, Math.floor(noise * 8)));
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
