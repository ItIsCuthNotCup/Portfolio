// ─── Cosmic Engines · procedural builders ──────────────────────────
// Each builder returns a THREE.Group containing primitive meshes that
// stand in for one cosmic object. Stylized, not physically exact.
// All builders also expose an optional `tick(dt, t)` method on the
// returned group for scene animation.
// ────────────────────────────────────────────────────────────────────

import * as THREE from 'three';

// ─── Shared helpers ────────────────────────────────────────────────

const TAU = Math.PI * 2;

function makeGlowSprite(color, size = 1.0, opacity = 0.7) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const r = c.width / 2;
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
  const hex = '#' + new THREE.Color(color).getHexString();
  grad.addColorStop(0.0, hexA(hex, 1.0));
  grad.addColorStop(0.4, hexA(hex, 0.6));
  grad.addColorStop(1.0, hexA(hex, 0.0));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    color: 0xffffff,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(size, size, size);
  return s;
}

function hexA(hex, a) {
  // hex like "#aabbcc"
  return `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;
}

function makeParticleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.4)');
  g.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const PARTICLE_TEX = makeParticleTexture();

function makeStarfield(count = 400, radius = 18) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = radius * (0.7 + Math.random() * 0.3);
    const u = Math.random() * 2 - 1;
    const phi = Math.random() * TAU;
    const sq = Math.sqrt(1 - u * u);
    positions[i * 3 + 0] = r * sq * Math.cos(phi);
    positions[i * 3 + 1] = r * sq * Math.sin(phi);
    positions[i * 3 + 2] = r * u;
    sizes[i] = 0.04 + Math.random() * 0.08;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const m = new THREE.PointsMaterial({
    map: PARTICLE_TEX,
    size: 0.08,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    color: 0xffffff
  });
  return new THREE.Points(g, m);
}

// ─── 1. Quasar / AGN ───────────────────────────────────────────────
// Central black hole shadow, accretion disk, polar jets, host glow.
// Used both for the hero and the Engine Room viewer.

export function buildQuasar({ jetIntensity = 1.0 } = {}) {
  const group = new THREE.Group();

  // Central black sphere (event horizon shadow)
  const coreGeo = new THREE.SphereGeometry(0.32, 48, 48);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const core = new THREE.Mesh(coreGeo, coreMat);
  group.add(core);

  // Photon ring — thin emissive ring at ~1.5x the shadow
  const ringGeo = new THREE.TorusGeometry(0.55, 0.018, 32, 128);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffd28a,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  // Soft inner glow
  const halo = makeGlowSprite(0xffd28a, 1.6, 0.55);
  group.add(halo);

  // Accretion disk — particle ring of two color bands
  const diskInner = 0.7;
  const diskOuter = 2.4;
  const N = 1800;
  const positions = new Float32Array(N * 3);
  const colors = new Float32Array(N * 3);
  const speeds = new Float32Array(N);
  const radii = new Float32Array(N);
  const tmpC = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const r = diskInner + Math.pow(Math.random(), 1.6) * (diskOuter - diskInner);
    const ang = Math.random() * TAU;
    const z = (Math.random() - 0.5) * 0.04 * (1 - (r - diskInner) / (diskOuter - diskInner));
    positions[i * 3 + 0] = Math.cos(ang) * r;
    positions[i * 3 + 1] = z;
    positions[i * 3 + 2] = Math.sin(ang) * r;
    radii[i] = r;
    speeds[i] = 0.85 / Math.sqrt(r); // Keplerian-ish
    // color: hot inner (amber), cool outer (violet)
    const t = Math.min(1, (r - diskInner) / (diskOuter - diskInner));
    tmpC.setRGB(1.0 - 0.3 * t, 0.7 - 0.45 * t, 0.4 + 0.45 * t);
    colors[i * 3 + 0] = tmpC.r;
    colors[i * 3 + 1] = tmpC.g;
    colors[i * 3 + 2] = tmpC.b;
  }
  const diskGeo = new THREE.BufferGeometry();
  diskGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  diskGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const diskMat = new THREE.PointsMaterial({
    map: PARTICLE_TEX,
    size: 0.07,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const disk = new THREE.Points(diskGeo, diskMat);
  group.add(disk);

  // Polar jets — two columns of particles
  const jetCount = 280;
  function buildJet(direction) {
    const p = new Float32Array(jetCount * 3);
    const seeds = new Float32Array(jetCount);
    for (let i = 0; i < jetCount; i++) {
      const r = Math.random();
      const t = Math.pow(r, 1.5);
      const radial = 0.05 + (1 - t) * 0.2;
      const ang = Math.random() * TAU;
      p[i * 3 + 0] = Math.cos(ang) * radial;
      p[i * 3 + 1] = direction * (0.4 + t * 5.0);
      p[i * 3 + 2] = Math.sin(ang) * radial;
      seeds[i] = r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
    const m = new THREE.PointsMaterial({
      map: PARTICLE_TEX,
      size: 0.18,
      sizeAttenuation: true,
      color: 0x9fc8ff,
      transparent: true,
      opacity: 0.85 * jetIntensity,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    return new THREE.Points(g, m);
  }
  const jetUp = buildJet(+1);
  const jetDown = buildJet(-1);
  group.add(jetUp, jetDown);

  // Faint host-galaxy haze (a flattened cloud)
  const hostHalo = makeGlowSprite(0x6f8cff, 6.0, 0.18);
  group.add(hostHalo);

  // Background starfield
  const stars = makeStarfield(500, 14);
  group.add(stars);

  // animation state
  let rotPhase = 0;
  group.userData.tick = (dt /* sec */, t /* sec since start */) => {
    rotPhase += dt;
    // disk rotation: each particle has individual angular velocity (speed[i])
    const pos = diskGeo.attributes.position.array;
    for (let i = 0; i < N; i++) {
      const r = radii[i];
      const ang = Math.atan2(pos[i * 3 + 2], pos[i * 3 + 0]) + speeds[i] * dt * 0.6;
      pos[i * 3 + 0] = Math.cos(ang) * r;
      pos[i * 3 + 2] = Math.sin(ang) * r;
    }
    diskGeo.attributes.position.needsUpdate = true;

    // jets — push particles outward, recycle
    const upPos = jetUp.geometry.attributes.position.array;
    const dnPos = jetDown.geometry.attributes.position.array;
    for (let i = 0; i < jetCount; i++) {
      upPos[i * 3 + 1] += dt * (1.4 + 1.6 * Math.random());
      if (upPos[i * 3 + 1] > 5.4) {
        upPos[i * 3 + 1] = 0.4;
      }
      dnPos[i * 3 + 1] -= dt * (1.4 + 1.6 * Math.random());
      if (dnPos[i * 3 + 1] < -5.4) {
        dnPos[i * 3 + 1] = -0.4;
      }
    }
    jetUp.geometry.attributes.position.needsUpdate = true;
    jetDown.geometry.attributes.position.needsUpdate = true;

    // gentle ring spin
    ring.rotation.z += dt * 0.05;
    halo.material.opacity = 0.5 + 0.08 * Math.sin(t * 1.4);
  };

  group.userData.setJetIntensity = (v) => {
    jetUp.material.opacity = 0.85 * v;
    jetDown.material.opacity = 0.85 * v;
  };

  return group;
}

// ─── 2. Black Hole ─────────────────────────────────────────────────

export function buildBlackHole() {
  const group = new THREE.Group();

  // Dark sphere (shadow)
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 48, 48),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );
  group.add(core);

  // Photon ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.78, 0.022, 32, 128),
    new THREE.MeshBasicMaterial({
      color: 0xffb066,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  // Inner accretion disk — flatter and closer than a quasar
  const N = 1200;
  const inner = 0.95, outer = 2.6;
  const positions = new Float32Array(N * 3);
  const colors = new Float32Array(N * 3);
  const radii = new Float32Array(N);
  const speeds = new Float32Array(N);
  const tmpC = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const r = inner + Math.pow(Math.random(), 1.4) * (outer - inner);
    const ang = Math.random() * TAU;
    positions[i * 3 + 0] = Math.cos(ang) * r;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 0.05;
    positions[i * 3 + 2] = Math.sin(ang) * r;
    radii[i] = r;
    speeds[i] = 0.7 / Math.sqrt(r);
    const t = (r - inner) / (outer - inner);
    tmpC.setRGB(1.0 - 0.2 * t, 0.7 - 0.4 * t, 0.4 - 0.3 * t);
    colors[i * 3 + 0] = tmpC.r;
    colors[i * 3 + 1] = tmpC.g;
    colors[i * 3 + 2] = tmpC.b;
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  dg.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const disk = new THREE.Points(dg, new THREE.PointsMaterial({
    map: PARTICLE_TEX,
    size: 0.085,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  group.add(disk);

  // Faint lensing arcs — two thin ellipses tilted forward to fake light bending
  const arcMat = new THREE.MeshBasicMaterial({
    color: 0xfff0d0,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.012, 16, 96, Math.PI * 0.7), arcMat);
  arc.rotation.x = Math.PI / 2.2;
  arc.rotation.z = Math.PI / 6;
  group.add(arc);

  // Subtle background haze
  const haze = makeGlowSprite(0xff9a4d, 5.5, 0.18);
  group.add(haze);

  group.userData.tick = (dt) => {
    const pos = dg.attributes.position.array;
    for (let i = 0; i < N; i++) {
      const r = radii[i];
      const ang = Math.atan2(pos[i * 3 + 2], pos[i * 3 + 0]) + speeds[i] * dt * 0.7;
      pos[i * 3 + 0] = Math.cos(ang) * r;
      pos[i * 3 + 2] = Math.sin(ang) * r;
    }
    dg.attributes.position.needsUpdate = true;
    ring.rotation.z += dt * 0.04;
  };
  return group;
}

// ─── 3. Pulsar ─────────────────────────────────────────────────────

export function buildPulsar() {
  const group = new THREE.Group();

  // Compact glowing sphere
  const star = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 32, 32),
    new THREE.MeshStandardMaterial({
      color: 0xc8f5ff,
      emissive: 0x88e0ff,
      emissiveIntensity: 1.5,
      roughness: 0.4,
      metalness: 0.1
    })
  );
  group.add(star);

  // Glow halo
  const halo = makeGlowSprite(0xa0eaff, 1.3, 0.6);
  group.add(halo);

  // Magnetic axis tilted off rotation axis
  const beamGroup = new THREE.Group();
  beamGroup.rotation.z = Math.PI * 0.15; // tilt the beam axis off the spin axis

  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x9ff0ff,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  // Use cones for the beams
  const beamUp = new THREE.Mesh(new THREE.ConeGeometry(0.55, 4.5, 32, 1, true), beamMat);
  beamUp.position.y = 2.25;
  const beamDown = beamUp.clone();
  beamDown.rotation.x = Math.PI;
  beamDown.position.y = -2.25;
  beamGroup.add(beamUp, beamDown);

  // Tighter inner core beams
  const inMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const innerUp = new THREE.Mesh(new THREE.ConeGeometry(0.2, 4.4, 24, 1, true), inMat);
  innerUp.position.y = 2.25;
  const innerDown = innerUp.clone();
  innerDown.rotation.x = Math.PI;
  innerDown.position.y = -2.25;
  beamGroup.add(innerUp, innerDown);

  group.add(beamGroup);

  // Magnetic ring
  const magRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.01, 12, 96),
    new THREE.MeshBasicMaterial({ color: 0x9ff0ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  magRing.rotation.x = Math.PI / 2;
  beamGroup.add(magRing);

  group.userData.tick = (dt, t) => {
    group.rotation.y += dt * 2.0; // fast spin
    star.material.emissiveIntensity = 1.4 + 0.3 * Math.sin(t * 6);
    halo.material.opacity = 0.55 + 0.1 * Math.sin(t * 6);
    // beam pulse
    inMat.opacity = 0.5 + 0.4 * Math.abs(Math.sin(t * 3));
  };
  return group;
}

// ─── 4. Magnetar ───────────────────────────────────────────────────

export function buildMagnetar() {
  const group = new THREE.Group();

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 32, 32),
    new THREE.MeshStandardMaterial({
      color: 0x6a4cff,
      emissive: 0x6a4cff,
      emissiveIntensity: 1.2,
      roughness: 0.35,
      metalness: 0.0
    })
  );
  group.add(core);

  // Magnetic field arcs — tubes formed by curves
  const arcs = [];
  const arcCount = 8;
  const arcMat = new THREE.MeshBasicMaterial({
    color: 0xc8a8ff,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  for (let i = 0; i < arcCount; i++) {
    const ang = (i / arcCount) * TAU;
    const a = Math.cos(ang), b = Math.sin(ang);
    const pts = [];
    for (let j = 0; j <= 32; j++) {
      const t = j / 32;
      // Big loop from north pole-ish to south pole-ish
      const theta = Math.PI * t;
      const r = 0.45 + 1.2 * Math.sin(theta);
      pts.push(new THREE.Vector3(a * r, Math.cos(theta) * 1.5, b * r));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.02, 8, false), arcMat);
    arcs.push(tube);
    group.add(tube);
  }

  // Halo
  const halo = makeGlowSprite(0xb088ff, 1.6, 0.55);
  group.add(halo);

  // Flare sparks — particle ring that occasionally brightens
  const flare = makeGlowSprite(0xffffff, 0.7, 0.0);
  flare.position.set(0.5, 0.35, 0.1);
  group.add(flare);

  let nextFlareT = 1.5 + Math.random() * 2;
  let flareLife = 0;

  group.userData.tick = (dt, t) => {
    group.rotation.y += dt * 0.4;
    halo.material.opacity = 0.5 + 0.08 * Math.sin(t * 1.3);
    // flare cycle
    if (flareLife > 0) {
      flareLife -= dt;
      flare.material.opacity = Math.max(0, flareLife);
    } else if (t > nextFlareT) {
      nextFlareT = t + 1.6 + Math.random() * 2;
      flareLife = 0.6;
      const ang = Math.random() * TAU;
      const phi = Math.random() * Math.PI - Math.PI / 2;
      flare.position.set(Math.cos(ang) * Math.cos(phi) * 0.55, Math.sin(phi) * 0.55, Math.sin(ang) * Math.cos(phi) * 0.55);
    }
  };
  return group;
}

// ─── 5. Gamma-Ray Burst ────────────────────────────────────────────

export function buildGRB() {
  const group = new THREE.Group();

  // Burst core
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xffe0a0 })
  );
  group.add(core);
  const halo = makeGlowSprite(0xffaa55, 1.5, 0.7);
  group.add(halo);

  // Two narrow opposing cones (the relativistic jet beams)
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xff8a3f,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const beamUp = new THREE.Mesh(new THREE.ConeGeometry(0.3, 5.5, 32, 1, true), beamMat);
  beamUp.position.set(0, 2.75, 0);
  const beamDown = beamUp.clone();
  beamDown.rotation.x = Math.PI;
  beamDown.position.y = -2.75;
  group.add(beamUp, beamDown);

  // Inner hot spine
  const spineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const spineUp = new THREE.Mesh(new THREE.ConeGeometry(0.07, 5.4, 16, 1, true), spineMat);
  spineUp.position.set(0, 2.7, 0);
  const spineDown = spineUp.clone();
  spineDown.rotation.x = Math.PI;
  spineDown.position.y = -2.7;
  group.add(spineUp, spineDown);

  // Expanding particle ring (afterglow shell)
  const N = 240;
  const ringPos = new Float32Array(N * 3);
  const ringSeed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * TAU;
    ringPos[i * 3 + 0] = Math.cos(ang) * 0.5;
    ringPos[i * 3 + 1] = (Math.random() - 0.5) * 0.1;
    ringPos[i * 3 + 2] = Math.sin(ang) * 0.5;
    ringSeed[i] = ang;
  }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.BufferAttribute(ringPos, 3));
  const rm = new THREE.PointsMaterial({
    map: PARTICLE_TEX,
    size: 0.13,
    color: 0xffd28a,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const ring = new THREE.Points(rg, rm);
  group.add(ring);

  let cycle = 0;
  group.userData.tick = (dt, t) => {
    cycle += dt;
    if (cycle > 3.6) cycle = 0;
    const phase = cycle / 3.6;
    // intensity pulse
    spineMat.opacity = 0.5 + 0.5 * Math.exp(-phase * 6);
    beamMat.opacity = 0.55 + 0.4 * Math.exp(-phase * 4);
    halo.material.opacity = 0.5 + 0.5 * Math.exp(-phase * 5);
    // ring expansion
    const radius = 0.4 + phase * 2.2;
    const pos = rg.attributes.position.array;
    for (let i = 0; i < N; i++) {
      const ang = ringSeed[i];
      pos[i * 3 + 0] = Math.cos(ang) * radius;
      pos[i * 3 + 2] = Math.sin(ang) * radius;
    }
    rg.attributes.position.needsUpdate = true;
    rm.opacity = 0.7 * (1 - phase);
  };
  return group;
}

// ─── 6. Supernova ──────────────────────────────────────────────────

export function buildSupernova() {
  const group = new THREE.Group();

  // Faded central remnant
  const remnant = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff3a3 })
  );
  group.add(remnant);
  const halo = makeGlowSprite(0xffd066, 1.0, 0.8);
  group.add(halo);

  // Expanding shell of particles
  const N = 1400;
  const positions = new Float32Array(N * 3);
  const dirs = new Float32Array(N * 3);
  const colors = new Float32Array(N * 3);
  const tmpC = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1;
    const phi = Math.random() * TAU;
    const sq = Math.sqrt(1 - u * u);
    const dx = sq * Math.cos(phi);
    const dy = sq * Math.sin(phi);
    const dz = u;
    dirs[i * 3 + 0] = dx;
    dirs[i * 3 + 1] = dy;
    dirs[i * 3 + 2] = dz;
    const r0 = Math.random() * 0.3 + 0.2;
    positions[i * 3 + 0] = dx * r0;
    positions[i * 3 + 1] = dy * r0;
    positions[i * 3 + 2] = dz * r0;
    const t = Math.random();
    tmpC.setRGB(1.0, 0.8 - 0.5 * t, 0.4 - 0.3 * t);
    colors[i * 3 + 0] = tmpC.r;
    colors[i * 3 + 1] = tmpC.g;
    colors[i * 3 + 2] = tmpC.b;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  sg.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const sm = new THREE.PointsMaterial({
    map: PARTICLE_TEX,
    size: 0.09,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const shell = new THREE.Points(sg, sm);
  group.add(shell);

  let cycle = 0;
  group.userData.tick = (dt, t) => {
    cycle += dt;
    const period = 6.0;
    if (cycle > period) {
      cycle = 0;
      // re-seed positions to inner radius
      const pos = sg.attributes.position.array;
      for (let i = 0; i < N; i++) {
        const r0 = Math.random() * 0.2 + 0.15;
        pos[i * 3 + 0] = dirs[i * 3 + 0] * r0;
        pos[i * 3 + 1] = dirs[i * 3 + 1] * r0;
        pos[i * 3 + 2] = dirs[i * 3 + 2] * r0;
      }
    }
    const phase = cycle / period;
    const speed = 0.8 + (1 - phase) * 1.2;
    const pos = sg.attributes.position.array;
    for (let i = 0; i < N; i++) {
      pos[i * 3 + 0] += dirs[i * 3 + 0] * dt * speed * (0.6 + 0.6 * Math.random());
      pos[i * 3 + 1] += dirs[i * 3 + 1] * dt * speed * (0.6 + 0.6 * Math.random());
      pos[i * 3 + 2] += dirs[i * 3 + 2] * dt * speed * (0.6 + 0.6 * Math.random());
    }
    sg.attributes.position.needsUpdate = true;
    sm.opacity = 0.9 * (1 - phase * 0.6);
    halo.material.opacity = 0.85 - 0.5 * phase;
  };
  return group;
}

// ─── 7. Neutron Star Merger ────────────────────────────────────────

export function buildMerger() {
  const group = new THREE.Group();

  // Two compact spheres orbiting
  const matA = new THREE.MeshStandardMaterial({
    color: 0xe5f7ff, emissive: 0xb0e0ff, emissiveIntensity: 1.2, roughness: 0.4, metalness: 0.1
  });
  const matB = new THREE.MeshStandardMaterial({
    color: 0xfff3c8, emissive: 0xffd06a, emissiveIntensity: 1.2, roughness: 0.4, metalness: 0.1
  });
  const a = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 24), matA);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 24), matB);
  group.add(a, b);

  const haloA = makeGlowSprite(0xb0e0ff, 0.7, 0.85);
  const haloB = makeGlowSprite(0xffd06a, 0.7, 0.85);
  group.add(haloA, haloB);

  // Gravitational-wave rings — two flat tori expanding in the orbital plane
  const gwMat = new THREE.MeshBasicMaterial({
    color: 0x88a8ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  const gw1 = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.005, 8, 96), gwMat.clone());
  gw1.rotation.x = Math.PI / 2;
  const gw2 = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.005, 8, 96), gwMat.clone());
  gw2.rotation.x = Math.PI / 2;
  const gw3 = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.005, 8, 96), gwMat.clone());
  gw3.rotation.x = Math.PI / 2;
  group.add(gw1, gw2, gw3);
  const gwScales = [0.0, 0.33, 0.66];

  // Ejecta ring (kilonova material)
  const N = 220;
  const epos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * TAU + Math.random() * 0.2;
    const r = 0.5 + Math.random() * 0.1;
    epos[i * 3 + 0] = Math.cos(ang) * r;
    epos[i * 3 + 1] = (Math.random() - 0.5) * 0.04;
    epos[i * 3 + 2] = Math.sin(ang) * r;
  }
  const eg = new THREE.BufferGeometry();
  eg.setAttribute('position', new THREE.BufferAttribute(epos, 3));
  const em = new THREE.PointsMaterial({
    map: PARTICLE_TEX,
    size: 0.12,
    color: 0xffe1a1,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const eject = new THREE.Points(eg, em);
  group.add(eject);

  let cycle = 0;
  let radius = 0.55;
  group.userData.tick = (dt, t) => {
    cycle += dt;
    const period = 5.5;
    if (cycle > period) { cycle = 0; radius = 0.55; }
    const phase = cycle / period;

    // shrinking orbit
    radius = 0.55 * (1 - phase * 0.92);
    const w = 0.8 + phase * 8;
    const ang = t * w;
    a.position.set(Math.cos(ang) * radius, 0, Math.sin(ang) * radius);
    b.position.set(-Math.cos(ang) * radius, 0, -Math.sin(ang) * radius);
    haloA.position.copy(a.position);
    haloB.position.copy(b.position);

    // GW rings expand
    [gw1, gw2, gw3].forEach((m, i) => {
      gwScales[i] += dt * 0.45;
      if (gwScales[i] > 1.0) gwScales[i] = 0.0;
      const s = 0.4 + gwScales[i] * 4.0;
      m.scale.set(s, s, 1);
      m.material.opacity = 0.55 * (1 - gwScales[i]);
    });

    // ejecta visible only after merge
    em.opacity = phase > 0.85 ? 0.8 * (1 - (phase - 0.85) / 0.15) : 0;
    matA.emissiveIntensity = 1.2 + phase * 2.5;
    matB.emissiveIntensity = 1.2 + phase * 2.5;
  };
  return group;
}

// ─── 8. Gravitational Lens ─────────────────────────────────────────

export function buildLens() {
  const group = new THREE.Group();

  // Foreground dark mass (the lens)
  const lens = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0x10131c, emissive: 0x202840, emissiveIntensity: 0.3, roughness: 0.5, metalness: 0.2 })
  );
  group.add(lens);
  const lensHalo = makeGlowSprite(0x4060a8, 1.6, 0.45);
  group.add(lensHalo);

  // Background starfield (further back)
  const stars = makeStarfield(380, 16);
  stars.position.z = -2.5;
  group.add(stars);

  // Einstein ring — distorted background light wrapped behind lens
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xc8b6ff, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.013, 16, 128), ringMat);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  // Arcs (multiply-imaged background)
  const arcMat = new THREE.MeshBasicMaterial({
    color: 0xfff0d0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  function makeArc(angle, r, span) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.018, 12, 64, span), arcMat);
    m.rotation.x = Math.PI / 2;
    m.rotation.z = angle;
    return m;
  }
  group.add(makeArc(0.4, 0.95, 1.2));
  group.add(makeArc(2.6, 1.05, 0.9));
  group.add(makeArc(4.7, 0.88, 1.4));
  group.add(makeArc(5.5, 1.1, 0.6));

  // Copies (the 'twin quasar' look) — bright dots on either side
  const dotMat = new THREE.SpriteMaterial({
    map: PARTICLE_TEX, color: 0xfffce0, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const dot1 = new THREE.Sprite(dotMat);
  dot1.position.set(1.2, 0.05, 0.1);
  dot1.scale.setScalar(0.18);
  const dot2 = new THREE.Sprite(dotMat);
  dot2.position.set(-1.18, -0.02, -0.1);
  dot2.scale.setScalar(0.16);
  group.add(dot1, dot2);

  group.userData.tick = (dt, t) => {
    group.rotation.y += dt * 0.08;
    ring.material.opacity = 0.55 + 0.1 * Math.sin(t * 0.8);
  };
  return group;
}

// ─── Builder lookup ────────────────────────────────────────────────

export const BUILDERS = {
  quasar: buildQuasar,
  blackhole: buildBlackHole,
  pulsar: buildPulsar,
  magnetar: buildMagnetar,
  grb: buildGRB,
  supernova: buildSupernova,
  merger: buildMerger,
  lens: buildLens
};
