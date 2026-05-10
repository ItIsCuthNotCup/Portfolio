// ─── Cosmic Engines · procedural builders (v2 — high detail) ───────
// Every builder returns a THREE.Group with a userData.tick(dt, t) for
// scene animation. v2 adds custom shaders for plasma/lensing, ~5x
// higher particle counts, surface detail on neutron stars, and proper
// emissive intensity so UnrealBloomPass treats the right pixels as
// "bright."
// ────────────────────────────────────────────────────────────────────

import * as THREE from 'three';

const TAU = Math.PI * 2;

// ─── Shared textures ───────────────────────────────────────────────

function makeRadialTexture(stops, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  for (const [pos, color] of stops) g.addColorStop(pos, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const PARTICLE_TEX = makeRadialTexture([
  [0.0, 'rgba(255,255,255,1.0)'],
  [0.3, 'rgba(255,255,255,0.55)'],
  [0.7, 'rgba(255,255,255,0.12)'],
  [1.0, 'rgba(255,255,255,0.0)'],
], 128);

const SOFT_TEX = makeRadialTexture([
  [0.0, 'rgba(255,255,255,0.95)'],
  [0.5, 'rgba(255,255,255,0.32)'],
  [1.0, 'rgba(255,255,255,0.0)'],
], 256);

const SPARK_TEX = makeRadialTexture([
  [0.0, 'rgba(255,255,255,1.0)'],
  [0.18, 'rgba(255,255,255,0.85)'],
  [0.5, 'rgba(255,255,255,0.20)'],
  [1.0, 'rgba(255,255,255,0.0)'],
], 64);

// ─── Procedural neutron-star surface texture ───────────────────────
// Multi-octave value noise → white-hot crustal pattern. Used as both
// color map and emissive map.
function makeNeutronStarTexture(size = 512, palette = ['#cfeaff', '#9fd3ff', '#1f4a78']) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  // base
  ctx.fillStyle = palette[0];
  ctx.fillRect(0, 0, size, size);
  // multi-scale noise
  for (let octave = 0; octave < 4; octave++) {
    const cell = 8 << octave;
    const alpha = 0.18 / (octave + 1);
    for (let y = 0; y < size; y += cell) {
      for (let x = 0; x < size; x += cell) {
        const n = Math.random();
        if (n < 0.5) continue;
        const t = (n - 0.5) * 2;
        const c0 = palette[1 + (octave % (palette.length - 1))];
        ctx.fillStyle = `rgba(${parseInt(c0.slice(1, 3), 16)},${parseInt(c0.slice(3, 5), 16)},${parseInt(c0.slice(5, 7), 16)},${alpha * t})`;
        ctx.fillRect(x, y, cell, cell);
      }
    }
  }
  // bright crustal cracks
  ctx.strokeStyle = 'rgba(255,240,210,0.7)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 30; i++) {
    ctx.beginPath();
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.moveTo(x, y);
    for (let s = 0; s < 8; s++) {
      x += (Math.random() - 0.5) * 60;
      y += (Math.random() - 0.5) * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ─── Multi-class starfield ─────────────────────────────────────────
// Three temperature classes (blue-white, white, amber) at varied sizes
// for a much richer night-sky texture than a single white field.
function makeStarfield({ count = 1500, radius = 22, sizeRange = [0.04, 0.14] } = {}) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const tmp = new THREE.Color();
  const palette = [
    [0.78, 0.86, 1.0],   // blue-white (cool, hot)
    [1.0, 1.0, 0.95],    // white
    [1.0, 0.92, 0.74],   // amber (cool surface temp)
    [1.0, 0.66, 0.46],   // red (very cool)
  ];
  for (let i = 0; i < count; i++) {
    const r = radius * (0.6 + Math.random() * 0.4);
    const u = Math.random() * 2 - 1;
    const phi = Math.random() * TAU;
    const sq = Math.sqrt(1 - u * u);
    positions[i * 3 + 0] = r * sq * Math.cos(phi);
    positions[i * 3 + 1] = r * sq * Math.sin(phi);
    positions[i * 3 + 2] = r * u;
    const cls = palette[Math.floor(Math.pow(Math.random(), 1.4) * palette.length)];
    tmp.setRGB(cls[0], cls[1], cls[2]);
    colors[i * 3 + 0] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
    sizes[i] = sizeRange[0] + Math.pow(Math.random(), 2.2) * (sizeRange[1] - sizeRange[0]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const m = new THREE.PointsMaterial({
    map: PARTICLE_TEX,
    size: 0.10,
    vertexColors: true,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(g, m);
}

// ─── Glow sprite ───────────────────────────────────────────────────
function makeGlow(color, scale = 1.0, opacity = 0.7) {
  const mat = new THREE.SpriteMaterial({
    map: SOFT_TEX,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(scale);
  return s;
}

// ─── Volumetric nebula billboard ───────────────────────────────────
// Procedural noise on a flat plane behind the action; fakes a distant
// galactic dust lane / molecular cloud without an HDR env map.
function makeNebula({ color1 = '#3a2278', color2 = '#10182a', scale = 24 } = {}) {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  // base gradient
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, color1);
  g.addColorStop(0.6, color2);
  g.addColorStop(1.0, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // dust splatter
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 6 + Math.random() * 60;
    const dx = x - size / 2, dy = y - size / 2;
    const dCenter = Math.sqrt(dx * dx + dy * dy);
    const fade = Math.max(0, 1 - dCenter / (size / 2));
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    const t = Math.random();
    const cR = Math.floor(60 + 100 * t);
    const cG = Math.floor(40 + 60 * (1 - t));
    const cB = Math.floor(120 + 100 * t);
    grad.addColorStop(0, `rgba(${cR},${cG},${cB},${0.25 * fade})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(scale, scale, scale);
  return s;
}

// ─── Plasma disk shader ────────────────────────────────────────────
// Used for the bright disk band behind the particle system. Animates
// with hot inner / cool outer + Doppler-style brightness asymmetry.
const PLASMA_VERT = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const PLASMA_FRAG = /* glsl */`
  uniform float uTime;
  uniform vec3 uColorHot;
  uniform vec3 uColorCool;
  uniform float uInner;
  uniform float uOuter;
  uniform float uOpacity;
  uniform float uDoppler;
  varying vec2 vUv;
  varying vec3 vWorld;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;          // 0..1 across the disk
    float ang = atan(p.y, p.x);
    if (r < uInner || r > 1.0) discard;

    // radial gradient hot -> cool
    float t = smoothstep(uInner, 1.0, r);
    vec3 col = mix(uColorHot, uColorCool, t);

    // angular noise streaks rotating with time (differential rotation)
    float omega = 0.6 / (0.2 + r);
    float n = noise(vec2(ang * 6.0 + uTime * omega, r * 14.0)) * 0.5
            + noise(vec2(ang * 12.0 - uTime * omega * 0.7, r * 28.0)) * 0.25;
    col *= 0.6 + 0.6 * n;

    // doppler asymmetry — brighter on approaching side
    float doppler = 1.0 + uDoppler * cos(ang);
    col *= doppler;

    // soft inner + outer fade
    float aIn = smoothstep(uInner, uInner + 0.04, r);
    float aOut = 1.0 - smoothstep(0.85, 1.0, r);
    float a = aIn * aOut * uOpacity;
    gl_FragColor = vec4(col, a);
  }
`;

function makePlasmaDisk({ inner = 0.25, outer = 1.0, hot = 0xffd28a, cool = 0x6e80ff, doppler = 0.35, radius = 2.4, opacity = 1.0 }) {
  const geo = new THREE.RingGeometry(0.001, radius, 96, 1);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColorHot: { value: new THREE.Color(hot) },
      uColorCool: { value: new THREE.Color(cool) },
      uInner: { value: inner },
      uOuter: { value: outer },
      uOpacity: { value: opacity },
      uDoppler: { value: doppler },
    },
    vertexShader: PLASMA_VERT,
    fragmentShader: PLASMA_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.userData.material = mat;
  return m;
}

// ─── Particle disk (granular detail layered on top of plasma) ──────
function makeParticleDisk({ count = 4000, inner = 0.7, outer = 2.4, hot = 0xffd28a, cool = 0x7a8aff, thickness = 0.05 }) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const radii = new Float32Array(count);
  const tmp = new THREE.Color();
  const hotC = new THREE.Color(hot);
  const coolC = new THREE.Color(cool);
  for (let i = 0; i < count; i++) {
    const r = inner + Math.pow(Math.random(), 1.6) * (outer - inner);
    const a = Math.random() * TAU;
    const z = (Math.random() - 0.5) * thickness * (1 - (r - inner) / (outer - inner));
    positions[i * 3 + 0] = Math.cos(a) * r;
    positions[i * 3 + 1] = z;
    positions[i * 3 + 2] = Math.sin(a) * r;
    radii[i] = r;
    speeds[i] = 0.85 / Math.sqrt(r);
    const t = (r - inner) / (outer - inner);
    tmp.copy(hotC).lerp(coolC, t);
    colors[i * 3 + 0] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const m = new THREE.PointsMaterial({
    map: PARTICLE_TEX,
    size: 0.06,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(g, m);
  points.userData.radii = radii;
  points.userData.speeds = speeds;
  points.userData.geo = g;
  points.userData.tick = (dt) => {
    const pos = g.attributes.position.array;
    for (let i = 0; i < count; i++) {
      const r = radii[i];
      const a = Math.atan2(pos[i * 3 + 2], pos[i * 3 + 0]) + speeds[i] * dt * 0.7;
      pos[i * 3 + 0] = Math.cos(a) * r;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    g.attributes.position.needsUpdate = true;
  };
  return points;
}

// ─── Volumetric jet shader ─────────────────────────────────────────
// A cone whose interior is shaded with vertical noise streaks. Used as
// a glowing sheath around the particle jets.
const JET_VERT = /* glsl */`
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const JET_FRAG = /* glsl */`
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;
  varying vec3 vPos;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }
  void main() {
    // u = around the cone (0..1), v = along its length
    float radial = abs(vUv.x - 0.5) * 2.0;
    float coreGlow = exp(-radial * 3.0);

    // streaks moving along the jet axis
    float streak = noise(vec2(vUv.x * 6.0, vUv.y * 14.0 + uTime * 1.4)) * 0.7 +
                   noise(vec2(vUv.x * 14.0, vUv.y * 32.0 - uTime * 2.6)) * 0.3;

    // taper at the ends
    float taper = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.92, 1.0, vUv.y));

    float a = (coreGlow * 0.85 + streak * 0.5 * coreGlow) * taper * uIntensity;
    vec3 col = uColor * (1.0 + 0.6 * streak);
    gl_FragColor = vec4(col, a);
  }
`;

function makeJetCone({ height = 5.4, radius = 0.55, color = 0x9fc8ff, intensity = 1.0 }) {
  const geo = new THREE.CylinderGeometry(0.05, radius, height, 32, 1, true);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
    },
    vertexShader: JET_VERT,
    fragmentShader: JET_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const m = new THREE.Mesh(geo, mat);
  m.userData.material = mat;
  return m;
}

// Particle stream inside the jet (the granular texture beneath the
// shader sheath)
function makeJetParticles({ direction = 1, count = 600, height = 5.4, color = 0xa8d4ff }) {
  const p = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const t = Math.pow(Math.random(), 1.6);
    const r = 0.04 + (1 - t) * 0.22;
    const a = Math.random() * TAU;
    p[i * 3 + 0] = Math.cos(a) * r;
    p[i * 3 + 1] = direction * (0.4 + t * height);
    p[i * 3 + 2] = Math.sin(a) * r;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.PointsMaterial({
    map: SPARK_TEX,
    size: 0.16,
    color,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const pts = new THREE.Points(g, m);
  pts.userData.tick = (dt) => {
    const pos = g.attributes.position.array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += direction * dt * (1.4 + 1.6 * Math.random());
      if (direction > 0 && pos[i * 3 + 1] > height + 0.4) pos[i * 3 + 1] = 0.4;
      else if (direction < 0 && pos[i * 3 + 1] < -(height + 0.4)) pos[i * 3 + 1] = -0.4;
    }
    g.attributes.position.needsUpdate = true;
  };
  pts.userData.material = m;
  return pts;
}

// ═══════════════════════════════════════════════════════════════════
//   1. QUASAR
// ═══════════════════════════════════════════════════════════════════
export function buildQuasar({ jetIntensity = 1.0 } = {}) {
  const group = new THREE.Group();

  // Background nebula
  const neb = makeNebula({ color1: '#1f1645', color2: '#070318', scale: 22 });
  neb.position.set(0, 0, -8);
  group.add(neb);

  // Starfield
  group.add(makeStarfield({ count: 1800, radius: 18 }));

  // Photon ring + dark core shadow
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 64, 64),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );
  group.add(core);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.56, 0.014, 32, 192),
    new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 1.0, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  group.add(makeGlow(0xffd28a, 1.4, 0.55));

  // Plasma disk (shader band) tilted slightly for cinematic feel
  const plasma = makePlasmaDisk({ hot: 0xffd28a, cool: 0x6e80ff, doppler: 0.55, radius: 2.4, inner: 0.30, outer: 1.0, opacity: 0.85 });
  plasma.rotation.x = -Math.PI / 2 + 0.18;
  group.add(plasma);

  // Particle disk on top
  const particles = makeParticleDisk({ count: 5000, inner: 0.7, outer: 2.45, hot: 0xffd28a, cool: 0x7a8aff, thickness: 0.04 });
  particles.rotation.x = 0.18;
  group.add(particles);

  // Jets — shader sheath + particles
  const jetUp = makeJetCone({ height: 5.6, radius: 0.55, color: 0xa8d4ff, intensity: jetIntensity });
  jetUp.position.y = 2.8;
  const jetDown = jetUp.clone();
  jetDown.material = jetUp.material.clone();
  jetDown.userData.material = jetDown.material;
  jetDown.rotation.x = Math.PI;
  jetDown.position.y = -2.8;
  group.add(jetUp, jetDown);
  const jetParticlesUp = makeJetParticles({ direction: +1, count: 800, height: 5.4 });
  const jetParticlesDown = makeJetParticles({ direction: -1, count: 800, height: 5.4 });
  group.add(jetParticlesUp, jetParticlesDown);

  // Soft host-galaxy haze
  group.add(makeGlow(0x6f8cff, 7.0, 0.18));

  group.userData.tick = (dt, t) => {
    plasma.userData.material.uniforms.uTime.value = t;
    jetUp.userData.material.uniforms.uTime.value = t;
    jetDown.userData.material.uniforms.uTime.value = t;
    if (particles.userData.tick) particles.userData.tick(dt);
    if (jetParticlesUp.userData.tick) jetParticlesUp.userData.tick(dt);
    if (jetParticlesDown.userData.tick) jetParticlesDown.userData.tick(dt);
    ring.rotation.z += dt * 0.04;
  };

  group.userData.setJetIntensity = (v) => {
    jetUp.userData.material.uniforms.uIntensity.value = v;
    jetDown.userData.material.uniforms.uIntensity.value = v;
    jetParticlesUp.userData.material.opacity = 0.85 * v;
    jetParticlesDown.userData.material.opacity = 0.85 * v;
  };

  return group;
}

// ═══════════════════════════════════════════════════════════════════
//   2. BLACK HOLE  (with proper lensing arc + Doppler-asymmetric disk)
// ═══════════════════════════════════════════════════════════════════
export function buildBlackHole() {
  const group = new THREE.Group();

  group.add(makeStarfield({ count: 1200, radius: 18 }));

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 64, 64),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );
  group.add(core);

  // Photon ring (sharp, very bright — bloom catches it)
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.78, 0.018, 48, 192),
    new THREE.MeshBasicMaterial({ color: 0xffb066, transparent: true, opacity: 1.0, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  // Plasma accretion disk
  const plasma = makePlasmaDisk({ hot: 0xffb066, cool: 0x6f4080, doppler: 0.7, radius: 2.6, inner: 0.36, outer: 1.0, opacity: 0.9 });
  plasma.rotation.x = -Math.PI / 2 + 0.32;
  group.add(plasma);

  // Particle disk
  const particles = makeParticleDisk({ count: 3500, inner: 0.95, outer: 2.6, hot: 0xffb066, cool: 0xa66bff, thickness: 0.06 });
  particles.rotation.x = 0.32;
  group.add(particles);

  // Faux gravitational lens arcs — top arc represents back of disk wrapped over top
  const arcMat = new THREE.MeshBasicMaterial({
    color: 0xfff0d0, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  const arc1 = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.014, 16, 96, Math.PI * 0.7), arcMat);
  arc1.rotation.x = Math.PI / 2.05;
  arc1.rotation.z = Math.PI / 6;
  const arc2 = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.008, 12, 96, Math.PI * 0.5), arcMat);
  arc2.rotation.x = Math.PI / 2.05;
  arc2.rotation.z = -Math.PI / 4;
  group.add(arc1, arc2);

  // Background haze
  group.add(makeGlow(0xff9a4d, 6.5, 0.18));

  group.userData.tick = (dt, t) => {
    plasma.userData.material.uniforms.uTime.value = t;
    if (particles.userData.tick) particles.userData.tick(dt);
    ring.rotation.z += dt * 0.04;
  };
  return group;
}

// ═══════════════════════════════════════════════════════════════════
//   3. PULSAR  (textured neutron star + animated lighthouse beams)
// ═══════════════════════════════════════════════════════════════════
export function buildPulsar() {
  const group = new THREE.Group();

  group.add(makeStarfield({ count: 1100, radius: 20 }));

  // Textured neutron star
  const tex = makeNeutronStarTexture(512, ['#cfeaff', '#9fd3ff', '#1f4a78']);
  const star = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 64, 64),
    new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: 0x9fd3ff,
      emissiveIntensity: 1.6,
      roughness: 0.55,
      metalness: 0.05,
    })
  );
  group.add(star);
  group.add(makeGlow(0xa0eaff, 1.4, 0.55));

  // Beam group (tilted off rotation axis)
  const beamGroup = new THREE.Group();
  beamGroup.rotation.z = Math.PI * 0.18;
  group.add(beamGroup);

  // Outer wide beams (shader cones)
  const beamUp = makeJetCone({ height: 6.5, radius: 0.85, color: 0x9ff0ff, intensity: 0.85 });
  beamUp.position.y = 3.25;
  const beamDown = beamUp.clone();
  beamDown.material = beamUp.material.clone();
  beamDown.userData.material = beamDown.material;
  beamDown.rotation.x = Math.PI;
  beamDown.position.y = -3.25;
  beamGroup.add(beamUp, beamDown);

  // Inner spine — bright
  const spineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const spineUp = new THREE.Mesh(new THREE.ConeGeometry(0.18, 6.4, 24, 1, true), spineMat);
  spineUp.position.y = 3.2;
  const spineDown = spineUp.clone();
  spineDown.rotation.x = Math.PI;
  spineDown.position.y = -3.2;
  beamGroup.add(spineUp, spineDown);

  // Magnetic equator ring
  const eq = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.012, 12, 96),
    new THREE.MeshBasicMaterial({ color: 0x9ff0ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  eq.rotation.x = Math.PI / 2;
  beamGroup.add(eq);

  group.userData.tick = (dt, t) => {
    group.rotation.y += dt * 1.8; // fast spin
    star.material.emissiveIntensity = 1.4 + 0.4 * Math.sin(t * 6);
    spineMat.opacity = 0.5 + 0.4 * Math.abs(Math.sin(t * 3));
    beamUp.userData.material.uniforms.uTime.value = t;
    beamDown.userData.material.uniforms.uTime.value = t;
    beamUp.userData.material.uniforms.uIntensity.value = 0.7 + 0.4 * Math.abs(Math.sin(t * 3));
    beamDown.userData.material.uniforms.uIntensity.value = 0.7 + 0.4 * Math.abs(Math.sin(t * 3));
  };
  return group;
}

// ═══════════════════════════════════════════════════════════════════
//   4. MAGNETAR  (dense field tubes + frequent flares)
// ═══════════════════════════════════════════════════════════════════
export function buildMagnetar() {
  const group = new THREE.Group();
  group.add(makeStarfield({ count: 1100, radius: 20 }));

  const tex = makeNeutronStarTexture(512, ['#3a2078', '#7a52d8', '#1a0a40']);
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 64, 64),
    new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: 0x6a4cff,
      emissiveIntensity: 1.4,
      roughness: 0.55,
      metalness: 0.0,
    })
  );
  group.add(core);
  group.add(makeGlow(0xb088ff, 1.7, 0.6));

  // 18 magnetic field arcs in a corona pattern
  const arcs = [];
  const tubeMat = new THREE.MeshBasicMaterial({
    color: 0xc8a8ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const arcCount = 18;
  for (let i = 0; i < arcCount; i++) {
    const ang = (i / arcCount) * TAU;
    const a = Math.cos(ang), b = Math.sin(ang);
    const pts = [];
    const reach = 1.0 + Math.random() * 0.7;
    for (let j = 0; j <= 36; j++) {
      const t = j / 36;
      const theta = Math.PI * t;
      const r = 0.5 + reach * Math.sin(theta);
      pts.push(new THREE.Vector3(a * r, Math.cos(theta) * 1.7, b * r));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.018, 8, false), tubeMat);
    arcs.push(tube);
    group.add(tube);
  }

  // Bright flare sprites
  const flares = [];
  for (let i = 0; i < 4; i++) {
    const f = makeGlow(0xffffff, 0.6, 0);
    flares.push({ sprite: f, life: 0, next: 0.6 + Math.random() * 1.6 });
    group.add(f);
  }

  group.userData.tick = (dt, t) => {
    group.rotation.y += dt * 0.35;
    core.material.emissiveIntensity = 1.4 + 0.35 * Math.sin(t * 1.6);
    flares.forEach((f) => {
      if (f.life > 0) {
        f.life -= dt;
        f.sprite.material.opacity = Math.max(0, f.life * 1.2);
      } else if (t > f.next) {
        f.next = t + 0.6 + Math.random() * 1.4;
        f.life = 0.5;
        const ang = Math.random() * TAU;
        const phi = (Math.random() - 0.5) * Math.PI;
        f.sprite.position.set(
          Math.cos(ang) * Math.cos(phi) * 0.6,
          Math.sin(phi) * 0.6,
          Math.sin(ang) * Math.cos(phi) * 0.6
        );
      }
    });
  };
  return group;
}

// ═══════════════════════════════════════════════════════════════════
//   5. GAMMA-RAY BURST  (multi-shell + bright beam pulses)
// ═══════════════════════════════════════════════════════════════════
export function buildGRB() {
  const group = new THREE.Group();
  group.add(makeStarfield({ count: 1200, radius: 22 }));

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe0a0 })
  );
  group.add(core);
  const halo = makeGlow(0xffaa55, 1.6, 0.7);
  group.add(halo);

  // Two opposing jet sheaths
  const beamUp = makeJetCone({ height: 6.5, radius: 0.45, color: 0xff8a3f, intensity: 1.0 });
  beamUp.position.y = 3.25;
  const beamDown = beamUp.clone();
  beamDown.material = beamUp.material.clone();
  beamDown.userData.material = beamDown.material;
  beamDown.rotation.x = Math.PI;
  beamDown.position.y = -3.25;
  group.add(beamUp, beamDown);

  // White-hot spines
  const spineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const spineUp = new THREE.Mesh(new THREE.ConeGeometry(0.08, 6.3, 16, 1, true), spineMat);
  spineUp.position.y = 3.2;
  const spineDown = spineUp.clone();
  spineDown.rotation.x = Math.PI;
  spineDown.position.y = -3.2;
  group.add(spineUp, spineDown);

  // Three afterglow shells expanding at staggered times
  const shells = [];
  for (let i = 0; i < 3; i++) {
    const N = 360;
    const pos = new Float32Array(N * 3);
    const seeds = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      const u = Math.random() * 2 - 1;
      const phi = Math.random() * TAU;
      const sq = Math.sqrt(1 - u * u);
      pos[k * 3 + 0] = sq * Math.cos(phi);
      pos[k * 3 + 1] = sq * Math.sin(phi);
      pos[k * 3 + 2] = u;
      seeds[k] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
      map: PARTICLE_TEX,
      size: 0.13,
      color: i === 0 ? 0xffd28a : i === 1 ? 0xff9966 : 0xff7a3f,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(g, m);
    points.scale.setScalar(0.4 + i * 0.05);
    shells.push({ points, mat: m, geo: g, offset: i * 1.2 });
    group.add(points);
  }

  let cycle = 0;
  const period = 4.2;
  group.userData.tick = (dt, t) => {
    cycle += dt;
    if (cycle > period) cycle = 0;
    const phase = cycle / period;
    // burst pulses
    spineMat.opacity = 0.5 + 0.5 * Math.exp(-phase * 6);
    beamUp.userData.material.uniforms.uIntensity.value = 0.4 + 1.2 * Math.exp(-phase * 4);
    beamDown.userData.material.uniforms.uIntensity.value = 0.4 + 1.2 * Math.exp(-phase * 4);
    halo.material.opacity = 0.4 + 0.6 * Math.exp(-phase * 5);
    beamUp.userData.material.uniforms.uTime.value = t;
    beamDown.userData.material.uniforms.uTime.value = t;
    // shells
    shells.forEach((s, i) => {
      const localPhase = (cycle + s.offset) / period;
      const expand = (localPhase % 1);
      const scale = 0.4 + expand * 4.0;
      s.points.scale.setScalar(scale);
      s.mat.opacity = 0.7 * (1 - expand);
    });
  };
  return group;
}

// ═══════════════════════════════════════════════════════════════════
//   6. SUPERNOVA  (5k shell particles + clumpy filament structure)
// ═══════════════════════════════════════════════════════════════════
export function buildSupernova() {
  const group = new THREE.Group();
  group.add(makeStarfield({ count: 1100, radius: 20 }));

  const remnant = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff3a3 })
  );
  group.add(remnant);
  const halo = makeGlow(0xffd066, 1.0, 0.85);
  group.add(halo);
  // Inner hot core
  group.add(makeGlow(0xffffff, 0.5, 0.95));

  // Expanding shell with filament clumps
  const N = 5000;
  const positions = new Float32Array(N * 3);
  const dirs = new Float32Array(N * 3);
  const colors = new Float32Array(N * 3);
  const speedJitter = new Float32Array(N);
  const tmp = new THREE.Color();
  // Filament directions — bias particle density along certain axes
  const filaments = [];
  for (let i = 0; i < 6; i++) {
    const u = Math.random() * 2 - 1;
    const phi = Math.random() * TAU;
    const sq = Math.sqrt(1 - u * u);
    filaments.push([sq * Math.cos(phi), sq * Math.sin(phi), u]);
  }
  for (let i = 0; i < N; i++) {
    let dx, dy, dz;
    if (Math.random() < 0.45) {
      // bias along a filament
      const f = filaments[Math.floor(Math.random() * filaments.length)];
      const j = 0.18;
      dx = f[0] + (Math.random() - 0.5) * j;
      dy = f[1] + (Math.random() - 0.5) * j;
      dz = f[2] + (Math.random() - 0.5) * j;
      const m = Math.hypot(dx, dy, dz);
      dx /= m; dy /= m; dz /= m;
    } else {
      const u = Math.random() * 2 - 1;
      const phi = Math.random() * TAU;
      const sq = Math.sqrt(1 - u * u);
      dx = sq * Math.cos(phi);
      dy = sq * Math.sin(phi);
      dz = u;
    }
    dirs[i * 3 + 0] = dx;
    dirs[i * 3 + 1] = dy;
    dirs[i * 3 + 2] = dz;
    const r0 = 0.18 + Math.random() * 0.25;
    positions[i * 3 + 0] = dx * r0;
    positions[i * 3 + 1] = dy * r0;
    positions[i * 3 + 2] = dz * r0;
    const t = Math.random();
    // stratification: hot (white→amber) inner, cool (red→violet) outer
    if (t < 0.5) {
      tmp.setRGB(1.0, 0.85 - 0.3 * t, 0.45 - 0.3 * t);
    } else {
      tmp.setRGB(1.0 - 0.3 * (t - 0.5), 0.5 - 0.3 * (t - 0.5), 0.4 + 0.3 * (t - 0.5));
    }
    colors[i * 3 + 0] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
    speedJitter[i] = 0.6 + 0.8 * Math.random();
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  sg.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const sm = new THREE.PointsMaterial({
    map: PARTICLE_TEX,
    size: 0.075,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const shell = new THREE.Points(sg, sm);
  group.add(shell);

  let cycle = 0;
  const period = 6.0;
  group.userData.tick = (dt, t) => {
    cycle += dt;
    if (cycle > period) {
      cycle = 0;
      const pos = sg.attributes.position.array;
      for (let i = 0; i < N; i++) {
        const r0 = 0.18 + Math.random() * 0.25;
        pos[i * 3 + 0] = dirs[i * 3 + 0] * r0;
        pos[i * 3 + 1] = dirs[i * 3 + 1] * r0;
        pos[i * 3 + 2] = dirs[i * 3 + 2] * r0;
      }
    }
    const phase = cycle / period;
    const speed = 0.9 + (1 - phase) * 1.4;
    const pos = sg.attributes.position.array;
    for (let i = 0; i < N; i++) {
      const k = speedJitter[i];
      pos[i * 3 + 0] += dirs[i * 3 + 0] * dt * speed * k;
      pos[i * 3 + 1] += dirs[i * 3 + 1] * dt * speed * k;
      pos[i * 3 + 2] += dirs[i * 3 + 2] * dt * speed * k;
    }
    sg.attributes.position.needsUpdate = true;
    sm.opacity = 0.9 * (1 - phase * 0.55);
    halo.material.opacity = 0.9 - 0.55 * phase;
  };
  return group;
}

// ═══════════════════════════════════════════════════════════════════
//   7. NEUTRON STAR MERGER  (inspiral + collision flash + GW rings)
// ═══════════════════════════════════════════════════════════════════
export function buildMerger() {
  const group = new THREE.Group();
  group.add(makeStarfield({ count: 1100, radius: 20 }));

  const texA = makeNeutronStarTexture(512, ['#cfeaff', '#9fd3ff', '#1f4a78']);
  const texB = makeNeutronStarTexture(512, ['#fff3c8', '#ffd06a', '#7a4f1c']);
  const matA = new THREE.MeshStandardMaterial({
    map: texA, emissiveMap: texA, emissive: 0xb0e0ff, emissiveIntensity: 1.4, roughness: 0.5
  });
  const matB = new THREE.MeshStandardMaterial({
    map: texB, emissiveMap: texB, emissive: 0xffd06a, emissiveIntensity: 1.4, roughness: 0.5
  });
  const a = new THREE.Mesh(new THREE.SphereGeometry(0.18, 32, 32), matA);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.18, 32, 32), matB);
  group.add(a, b);

  const haloA = makeGlow(0xb0e0ff, 0.85, 0.85);
  const haloB = makeGlow(0xffd06a, 0.85, 0.85);
  group.add(haloA, haloB);

  // GW rings
  const gwMat = new THREE.MeshBasicMaterial({
    color: 0x88a8ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  const rings = [];
  const ringScales = [];
  for (let i = 0; i < 5; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.005, 8, 96), gwMat.clone());
    r.rotation.x = Math.PI / 2;
    rings.push(r);
    ringScales.push(i * 0.2);
    group.add(r);
  }

  // Inspiral trails (particle trails behind the orbiting bodies)
  const trailN = 600;
  const trailGeo = new THREE.BufferGeometry();
  const trailPos = new Float32Array(trailN * 3);
  const trailCol = new Float32Array(trailN * 3);
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
  const trailMat = new THREE.PointsMaterial({
    map: PARTICLE_TEX,
    size: 0.08,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const trails = new THREE.Points(trailGeo, trailMat);
  group.add(trails);
  let trailIdx = 0;

  // Ejecta cloud (post-merger)
  const eN = 600;
  const epos = new Float32Array(eN * 3);
  const edir = new Float32Array(eN * 3);
  for (let i = 0; i < eN; i++) {
    const ang = Math.random() * TAU;
    const r = 0.3 + Math.random() * 0.1;
    epos[i * 3 + 0] = Math.cos(ang) * r;
    epos[i * 3 + 1] = (Math.random() - 0.5) * 0.06;
    epos[i * 3 + 2] = Math.sin(ang) * r;
    edir[i * 3 + 0] = Math.cos(ang);
    edir[i * 3 + 1] = (Math.random() - 0.5) * 0.4;
    edir[i * 3 + 2] = Math.sin(ang);
  }
  const eg = new THREE.BufferGeometry();
  eg.setAttribute('position', new THREE.BufferAttribute(epos, 3));
  const em = new THREE.PointsMaterial({
    map: PARTICLE_TEX,
    size: 0.10,
    color: 0xffe1a1,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const eject = new THREE.Points(eg, em);
  group.add(eject);

  // Collision flash
  const flash = makeGlow(0xffffff, 0, 0);
  group.add(flash);

  let cycle = 0;
  const period = 5.5;
  let radius = 0.55;
  group.userData.tick = (dt, t) => {
    cycle += dt;
    if (cycle > period) {
      cycle = 0;
      radius = 0.55;
      // reset ejecta to origin
      const pos = eg.attributes.position.array;
      for (let i = 0; i < eN; i++) {
        const ang = Math.random() * TAU;
        const r = 0.3 + Math.random() * 0.1;
        pos[i * 3 + 0] = Math.cos(ang) * r;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 0.06;
        pos[i * 3 + 2] = Math.sin(ang) * r;
      }
      flash.scale.setScalar(0);
      flash.material.opacity = 0;
    }
    const phase = cycle / period;
    radius = 0.55 * (1 - phase * 0.92);
    const w = 0.8 + phase * 8;
    const ang = t * w;
    a.position.set(Math.cos(ang) * radius, 0, Math.sin(ang) * radius);
    b.position.set(-Math.cos(ang) * radius, 0, -Math.sin(ang) * radius);
    haloA.position.copy(a.position);
    haloB.position.copy(b.position);

    // Inspiral trails
    if (phase < 0.85) {
      trailPos[trailIdx * 3 + 0] = a.position.x;
      trailPos[trailIdx * 3 + 1] = a.position.y;
      trailPos[trailIdx * 3 + 2] = a.position.z;
      trailCol[trailIdx * 3 + 0] = 0.69; trailCol[trailIdx * 3 + 1] = 0.88; trailCol[trailIdx * 3 + 2] = 1.0;
      trailIdx = (trailIdx + 1) % trailN;
      trailPos[trailIdx * 3 + 0] = b.position.x;
      trailPos[trailIdx * 3 + 1] = b.position.y;
      trailPos[trailIdx * 3 + 2] = b.position.z;
      trailCol[trailIdx * 3 + 0] = 1.0; trailCol[trailIdx * 3 + 1] = 0.82; trailCol[trailIdx * 3 + 2] = 0.42;
      trailIdx = (trailIdx + 1) % trailN;
      trailGeo.attributes.position.needsUpdate = true;
      trailGeo.attributes.color.needsUpdate = true;
    }

    // GW rings expand
    rings.forEach((r, i) => {
      ringScales[i] += dt * 0.4;
      if (ringScales[i] > 1.0) ringScales[i] = 0.0;
      const s = 0.4 + ringScales[i] * 4.5;
      r.scale.set(s, s, 1);
      r.material.opacity = 0.55 * (1 - ringScales[i]);
    });

    // Collision flash
    if (phase > 0.9) {
      const flashPhase = (phase - 0.9) / 0.1;
      flash.scale.setScalar(0.3 + flashPhase * 4.0);
      flash.material.opacity = (1 - flashPhase) * 0.9;
    }

    // Ejecta after merger
    if (phase > 0.85) {
      const epPhase = (phase - 0.85) / 0.15;
      em.opacity = 0.85 * (1 - epPhase);
      const pos = eg.attributes.position.array;
      for (let i = 0; i < eN; i++) {
        pos[i * 3 + 0] += edir[i * 3 + 0] * dt * 1.8;
        pos[i * 3 + 1] += edir[i * 3 + 1] * dt * 1.8;
        pos[i * 3 + 2] += edir[i * 3 + 2] * dt * 1.8;
      }
      eg.attributes.position.needsUpdate = true;
    }

    matA.emissiveIntensity = 1.4 + phase * 3.0;
    matB.emissiveIntensity = 1.4 + phase * 3.0;
  };
  return group;
}

// ═══════════════════════════════════════════════════════════════════
//   8. GRAVITATIONAL LENS  (massive starfield + arcs + multi-image)
// ═══════════════════════════════════════════════════════════════════
export function buildLens() {
  const group = new THREE.Group();

  // Two starfields at different depths for parallax
  const stars1 = makeStarfield({ count: 3500, radius: 18 });
  stars1.position.z = -3;
  group.add(stars1);
  const stars2 = makeStarfield({ count: 1500, radius: 14, sizeRange: [0.06, 0.18] });
  group.add(stars2);

  // Background nebula
  const neb = makeNebula({ color1: '#1a2348', color2: '#04060f', scale: 22 });
  neb.position.set(0, 0, -6);
  group.add(neb);

  // Foreground dark mass — gives a hint of internal stars (galaxy)
  const lensTex = makeNeutronStarTexture(256, ['#1a2138', '#3a3f6a', '#0a0c1a']);
  const lens = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 64, 64),
    new THREE.MeshStandardMaterial({
      map: lensTex,
      emissiveMap: lensTex,
      emissive: 0x202840,
      emissiveIntensity: 0.25,
      roughness: 0.65,
      metalness: 0.1,
    })
  );
  group.add(lens);
  group.add(makeGlow(0x4060a8, 1.7, 0.5));

  // Einstein ring (sharp + glowing)
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.85, 0.014, 24, 192),
    new THREE.MeshBasicMaterial({ color: 0xc8b6ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  // Arc copies of background light (multiply-imaged)
  const arcMat = new THREE.MeshBasicMaterial({
    color: 0xfff0d0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  function makeArc(angle, r, span, thickness = 0.015) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, thickness, 12, 64, span), arcMat);
    m.rotation.x = Math.PI / 2;
    m.rotation.z = angle;
    return m;
  }
  group.add(makeArc(0.4, 0.95, 1.2));
  group.add(makeArc(2.6, 1.05, 0.9));
  group.add(makeArc(4.7, 0.88, 1.4));
  group.add(makeArc(5.5, 1.1, 0.6, 0.010));

  // Twin-quasar bright dots
  const dotMat = new THREE.SpriteMaterial({
    map: SOFT_TEX, color: 0xfffce0, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const dot1 = new THREE.Sprite(dotMat);
  dot1.position.set(1.35, 0.05, 0.1);
  dot1.scale.setScalar(0.20);
  const dot2 = new THREE.Sprite(dotMat);
  dot2.position.set(-1.30, -0.02, -0.1);
  dot2.scale.setScalar(0.18);
  group.add(dot1, dot2);

  group.userData.tick = (dt, t) => {
    group.rotation.y += dt * 0.05;
    ring.material.opacity = 0.6 + 0.15 * Math.sin(t * 0.7);
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
  lens: buildLens,
};
