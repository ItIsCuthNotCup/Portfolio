// ─────────────────────────────────────────────────────────────
// Humanoid Robots Lab — procedural robot builder
// Returns a THREE.Group of primitives shaped by visualProfile.
// Used as a fallback when no verified GLB exists for a robot, and as the
// low-poly proxy in lineup mode.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

const REF_HEIGHT_M = 1.7; // unit body is sized to this; lineup uses real heights to scale

// Build a robot. opts:
//   profile:      visualProfile object from catalog
//   lod:          'detail' (full body) | 'lineup' (low-poly proxy)
//   castShadow:   default true; off for lineup (perf)
export function buildProceduralRobot({ profile, lod = 'detail', castShadow = true } = {}) {
  const root = new THREE.Group();
  root.name = 'procedural-robot';
  root.userData.isProcedural = true;

  const cfg = resolveProfile(profile || {});
  const isLineup = lod === 'lineup';

  // Geometry segment counts: low-poly for lineup, smooth for detail.
  const seg = isLineup
    ? { capsule: { rad: 6, length: 4, cap: 4 }, sphere: 8 }
    : { capsule: { rad: 14, length: 8, cap: 8 }, sphere: 24 };

  // Materials. Body / accent / face / joint. Reused across parts of one robot
  // to keep draw calls down.
  const matBody  = makeMat(cfg.primary,   cfg.bodyMetal,  cfg.bodyRough);
  const matAccent= makeMat(cfg.secondary, cfg.accentMetal, cfg.accentRough);
  const matFace  = makeMat(cfg.faceColor, cfg.faceMetal,  cfg.faceRough, cfg.faceEmissive);
  const matJoint = makeMat(cfg.jointColor, 0.6, 0.35);

  // ── Pelvis (origin) ──────────────────────────────────────────────
  // Whole body is positioned with feet at y=0, head around y=1.7.
  const torsoH = 0.55;
  const pelvisH = 0.18;
  const upperLegH = 0.45;
  const lowerLegH = 0.45;
  const footH = 0.05;
  const upperArmL = 0.34;
  const lowerArmL = 0.34;
  const headR = 0.13;
  const neckH = 0.06;

  // Feet baseline at y=0, then stack up
  const footY      = footH / 2;
  const lowerLegY  = footH + lowerLegH / 2;
  const upperLegY  = footH + lowerLegH + upperLegH / 2;
  const pelvisY    = footH + lowerLegH + upperLegH + pelvisH / 2;
  const torsoY     = pelvisY + pelvisH / 2 + torsoH / 2;
  const shoulderY  = torsoY + torsoH / 2 - 0.08;
  const neckY      = torsoY + torsoH / 2 + neckH / 2;
  const headY      = neckY + neckH / 2 + headR;

  // ── Pelvis ───────────────────────────────────────────────────────
  const pelvis = mkBox(0.32, pelvisH, 0.22, matBody);
  pelvis.position.set(0, pelvisY, 0);
  add(root, pelvis, castShadow);

  // ── Torso (the chest) ────────────────────────────────────────────
  // Two stacked shapes: lower torso a soft trapezoid (shorter), upper torso
  // a wider chest. Slight taper down toward pelvis = smooth-consumer look.
  const torsoLowerY = pelvisY + pelvisH / 2 + 0.10;
  const torsoLower = mkCapsule(0.16, 0.20, seg.capsule, matBody);
  torsoLower.position.set(0, torsoLowerY, 0);
  add(root, torsoLower, castShadow);

  const chestW = cfg.bulkyShoulders ? 0.46 : 0.38;
  const chestD = 0.22;
  const chestH = cfg.softSuit ? 0.40 : 0.35;
  const chest = mkBox(chestW, chestH, chestD, matBody, true);
  chest.position.set(0, torsoY + 0.04, 0);
  add(root, chest, castShadow);

  // Optional chest-emissive light (Apollo style)
  if (cfg.chestLight) {
    const chestLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, seg.sphere, seg.sphere),
      new THREE.MeshStandardMaterial({
        color: 0xffffff, emissive: 0x4ec3ff, emissiveIntensity: 1.6,
        roughness: 0.2, metalness: 0,
      }),
    );
    chestLight.position.set(0, torsoY + 0.02, chestD / 2 + 0.005);
    root.add(chestLight);
  }

  // ── Head + face ─────────────────────────────────────────────────
  // Digit famously has no head; replace with a horizontal sensor bar.
  if (cfg.headStyle === 'sensor-bar') {
    const bar = mkBox(0.30, 0.05, 0.10, matAccent);
    bar.position.set(0, neckY + 0.04, 0);
    add(root, bar, castShadow);
  } else {
    const neck = mkCapsule(0.04, 0.04, seg.capsule, matJoint);
    neck.position.set(0, neckY, 0);
    add(root, neck, castShadow);

    const head = mkSphere(headR, seg.sphere, matBody);
    head.position.set(0, headY, 0);
    add(root, head, castShadow);

    if (cfg.hasBlackFaceplate) {
      const face = new THREE.Mesh(
        new THREE.BoxGeometry(headR * 1.55, headR * 1.0, 0.022),
        matFace,
      );
      face.position.set(0, headY, headR - 0.004);
      add(root, face, false);
    }

    if (cfg.screenFace) {
      const screen = new THREE.Mesh(
        new THREE.BoxGeometry(headR * 1.55, headR * 1.1, 0.014),
        new THREE.MeshStandardMaterial({
          color: cfg.secondary, emissive: cfg.secondary, emissiveIntensity: 0.55,
          roughness: 0.25, metalness: 0,
        }),
      );
      screen.position.set(0, headY, headR - 0.004);
      add(root, screen, false);
    }
  }

  // ── Arms (mirror left + right) ───────────────────────────────────
  const armOff = chestW / 2 + 0.04;
  for (const side of [-1, 1]) {
    // Shoulder ball
    const sh = mkSphere(cfg.bulkyShoulders ? 0.075 : 0.055, seg.sphere, matJoint);
    sh.position.set(side * armOff, shoulderY, 0);
    add(root, sh, castShadow);

    // Upper arm
    const upper = mkCapsule(0.045, upperArmL, seg.capsule, matBody);
    upper.position.set(side * armOff, shoulderY - upperArmL / 2 - 0.02, 0);
    add(root, upper, castShadow);

    // Elbow
    const elbow = mkSphere(0.05, seg.sphere, matJoint);
    elbow.position.set(side * armOff, shoulderY - upperArmL - 0.04, 0);
    add(root, elbow, castShadow);

    // Lower arm
    const lower = mkCapsule(0.04, lowerArmL, seg.capsule, matBody);
    lower.position.set(side * armOff, shoulderY - upperArmL - lowerArmL / 2 - 0.06, 0);
    add(root, lower, castShadow);

    // Hand
    const handSize = cfg.largeHands ? 0.10 : 0.07;
    const hand = mkBox(handSize, 0.13, handSize * 0.7, matAccent, true);
    hand.position.set(side * armOff, shoulderY - upperArmL - lowerArmL - 0.13, 0);
    add(root, hand, castShadow);

    // Optional finger boxes for dexterous hands (Sanctuary)
    if (cfg.largeHands && !isLineup) {
      for (let f = 0; f < 4; f++) {
        const finger = mkBox(0.014, 0.06, 0.018, matAccent);
        finger.position.set(
          side * armOff - 0.025 + f * 0.018,
          shoulderY - upperArmL - lowerArmL - 0.21,
          0,
        );
        add(root, finger, false);
      }
    }
  }

  // ── Legs (mirror left + right) ───────────────────────────────────
  const hipOff = 0.10;
  for (const side of [-1, 1]) {
    const upper = mkCapsule(0.07, upperLegH, seg.capsule, matBody);
    upper.position.set(side * hipOff, upperLegY, 0);
    add(root, upper, castShadow);

    const knee = mkSphere(0.06, seg.sphere, matJoint);
    knee.position.set(side * hipOff, upperLegY - upperLegH / 2 - 0.04, 0);
    add(root, knee, castShadow);

    const lower = mkCapsule(0.06, lowerLegH, seg.capsule, matBody);
    // reverse-bent (Digit) angles the lower leg backwards visually
    if (cfg.reverseKnees) {
      lower.position.set(side * hipOff, lowerLegY, -0.06);
      lower.rotation.x = -0.18;
    } else {
      lower.position.set(side * hipOff, lowerLegY, 0);
    }
    add(root, lower, castShadow);

    const foot = mkBox(0.13, footH, 0.22, matAccent, true);
    foot.position.set(side * hipOff, footY, 0.025);
    add(root, foot, castShadow);
  }

  // Pose: athletic crouch for industrial-athletic style
  if (cfg.athleticPose && !isLineup) {
    root.children.forEach(child => {
      if (child.position.y > 0.2) child.position.y -= 0.04;
    });
  }

  // Center the body so feet sit on y=0; orient facing camera.
  root.position.set(0, 0, 0);

  return root;
}

// Dispose every geometry + material under a root group. Call when switching
// robots to keep memory flat.
export function disposeRobot(root) {
  if (!root) return;
  root.traverse(node => {
    if (node.isMesh) {
      node.geometry?.dispose?.();
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      mats.forEach(m => m?.dispose?.());
    }
  });
}

// ── helpers ─────────────────────────────────────────────────────────
function add(group, mesh, withShadow) {
  if (withShadow) {
    mesh.castShadow = true;
    mesh.receiveShadow = false;
  }
  group.add(mesh);
}
function mkBox(w, h, d, mat) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}
function mkCapsule(r, length, segCfg, mat) {
  const g = new THREE.CapsuleGeometry(r, length, segCfg.cap, segCfg.rad);
  return new THREE.Mesh(g, mat);
}
function mkSphere(r, sphereSeg, mat) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, sphereSeg, sphereSeg), mat);
}
function makeMat(color, metalness, roughness, emissive) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    metalness, roughness,
    ...(emissive ? { emissive: new THREE.Color(emissive), emissiveIntensity: 0.4 } : {}),
  });
}

// Resolve a visualProfile into a fully-defaulted styling spec. Lets the
// catalog stay terse (only override what's distinctive) while the builder
// always sees a complete object.
function resolveProfile(p) {
  const styleDefaults = {
    'smooth-consumer':     { bodyMetal: 0.55, bodyRough: 0.30, accentMetal: 0.7, accentRough: 0.25, athleticPose: false },
    'industrial-athletic': { bodyMetal: 0.50, bodyRough: 0.45, accentMetal: 0.4, accentRough: 0.55, athleticPose: true,  bulkyShoulders: true },
    'warehouse-digit':     { bodyMetal: 0.30, bodyRough: 0.55, accentMetal: 0.4, accentRough: 0.55, headStyle: 'sensor-bar', reverseKnees: true },
    'soft-home':           { bodyMetal: 0.05, bodyRough: 0.95, accentMetal: 0.1, accentRough: 0.95 },
    'research-platform':   { bodyMetal: 0.45, bodyRough: 0.40, accentMetal: 0.5, accentRough: 0.40 },
    'service-robot':       { bodyMetal: 0.35, bodyRough: 0.40, accentMetal: 0.5, accentRough: 0.30, screenFace: true },
  };
  const base = styleDefaults[p.bodyStyle] || styleDefaults['smooth-consumer'];

  return {
    primary:        p.primaryTone   || '#d8d8d8',
    secondary:      p.secondaryTone || '#1a1a1a',
    faceColor:      p.faceColor     || '#0a0a0a',
    jointColor:     p.jointColor    || '#3a3a3a',
    faceMetal:      0.85,
    faceRough:      0.10,
    faceEmissive:   p.faceEmissive  || null,
    bodyMetal:      base.bodyMetal,
    bodyRough:      base.bodyRough,
    accentMetal:    base.accentMetal,
    accentRough:    base.accentRough,
    bulkyShoulders: p.bulkyShoulders ?? base.bulkyShoulders ?? false,
    softSuit:       p.softSuit ?? false,
    athleticPose:   base.athleticPose ?? false,
    hasBlackFaceplate: p.hasBlackFaceplate ?? false,
    screenFace:     p.screenFace ?? base.screenFace ?? false,
    reverseKnees:   p.reverseKnees ?? base.reverseKnees ?? false,
    headStyle:      p.headStyle ?? base.headStyle ?? 'spherical',
    chestLight:     p.chestLight ?? false,
    largeHands:     p.largeHands ?? false,
  };
}

export const PROCEDURAL_REF_HEIGHT = REF_HEIGHT_M;
