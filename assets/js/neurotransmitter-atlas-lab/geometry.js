import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { REGION_POSITIONS, STRUCTURES } from './data.js?v=20';

const TAU = Math.PI * 2;
const NIH_BRAIN_MODEL_URL = '/assets/models/neurotransmitter-atlas/nih-3d-brain-nevit-dilmen-web.glb?v=1';

function mulberry32(seed) {
  let state = seed;
  return function next() {
    state |= 0;
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(15515);

function physical(color, options = {}) {
  const material = new THREE.MeshPhysicalMaterial({
    color,
    roughness: options.roughness ?? 0.42,
    metalness: options.metalness ?? 0,
    transmission: options.transmission ?? 0,
    thickness: options.thickness ?? 0.28,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    clearcoat: options.clearcoat ?? 0.35,
    clearcoatRoughness: options.clearcoatRoughness ?? 0.42,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0
  });
  if (options.map) material.map = options.map;
  if (options.bumpMap) {
    material.bumpMap = options.bumpMap;
    material.bumpScale = options.bumpScale ?? 0.025;
  }
  if (options.normalMap) {
    material.normalMap = options.normalMap;
    material.normalScale = options.normalScale ?? new THREE.Vector2(0.2, 0.2);
  }
  return material;
}

function makeTexture({ base = '#d99ac5', speck = '#fff2df', vein = '#884b8f', size = 256, alpha = 0.35 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 2600; i += 1) {
    const v = Math.floor(185 + rand() * 58);
    ctx.fillStyle = `rgba(${v}, ${Math.floor(v * 0.86)}, ${Math.floor(v * 0.96)}, ${alpha * rand()})`;
    ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 1.5, 1 + rand() * 1.5);
  }

  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = vein;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 22; i += 1) {
    const y = rand() * size;
    ctx.beginPath();
    ctx.moveTo(-10, y);
    for (let x = 0; x <= size + 20; x += 24) {
      ctx.lineTo(x, y + Math.sin(x * 0.035 + i) * (6 + rand() * 8));
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function grayscaleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#7f7f7f';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4200; i += 1) {
    const v = Math.floor(92 + rand() * 126);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(rand() * 256, rand() * 256, 1, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function brainTissueTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const base = ctx.createLinearGradient(0, 0, 512, 512);
  base.addColorStop(0, '#efb9a8');
  base.addColorStop(0.48, '#d9918a');
  base.addColorStop(1, '#f5cbb6');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 8200; i += 1) {
    const warm = Math.floor(188 + rand() * 48);
    ctx.fillStyle = `rgba(${warm}, ${Math.floor(warm * 0.7)}, ${Math.floor(warm * 0.64)}, ${0.03 + rand() * 0.08})`;
    ctx.fillRect(rand() * 512, rand() * 512, 1 + rand() * 2.2, 1 + rand() * 2.2);
  }

  ctx.lineCap = 'round';
  for (let i = 0; i < 34; i += 1) {
    const startX = rand() * 512;
    const startY = rand() * 512;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    for (let s = 0; s < 7; s += 1) {
      const x = startX + (s - 3) * (20 + rand() * 24);
      const y = startY + Math.sin(s * 1.6 + i) * (9 + rand() * 18) + s * (rand() - 0.5) * 13;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(150, 58, 62, ${0.09 + rand() * 0.08})`;
    ctx.lineWidth = 0.45 + rand() * 1.05;
    ctx.stroke();
  }

  ctx.globalAlpha = 0.2;
  for (let y = -40; y < 552; y += 24) {
    ctx.beginPath();
    ctx.moveTo(-20, y);
    for (let x = 0; x <= 540; x += 32) {
      ctx.lineTo(x, y + Math.sin(x * 0.033 + y * 0.021) * 8);
    }
    ctx.strokeStyle = '#fff3df';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.2, 1.6);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function brainBumpTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8f8f8f';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 12000; i += 1) {
    const v = Math.floor(100 + rand() * 80);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(rand() * 512, rand() * 512, 1, 1);
  }
  ctx.globalAlpha = 0.28;
  for (let y = 0; y < 512; y += 18) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 512; x += 20) {
      ctx.lineTo(x, y + Math.sin(x * 0.045 + y * 0.018) * 7);
    }
    ctx.strokeStyle = '#cfcfcf';
    ctx.lineWidth = 2.4;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.2, 1.6);
  return texture;
}

function organicGeometry(radius, detail = 4, distortion = 0.08) {
  const widthSegments = Math.max(48, 40 + detail * 16);
  const heightSegments = Math.max(32, 28 + detail * 10);
  const geo = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i);
    const n =
      Math.sin(v.x * 7.7 + v.y * 2.3) * 0.36 +
      Math.sin(v.y * 9.1 + v.z * 3.4) * 0.32 +
      Math.sin(v.z * 8.3 + v.x * 4.8) * 0.28;
    v.multiplyScalar(1 + n * distortion);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function organicSphere(position, radius, material, scale = [1, 1, 1], detail = 4, distortion = 0.08) {
  const mesh = new THREE.Mesh(organicGeometry(radius, detail, distortion), material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function sphere(position, radius, material, scale = [1, 1, 1], segments = 32) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, segments), material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cylinderBetween(a, b, radius, material, segments = 32, openEnded = false) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const mid = start.clone().lerp(end, 0.5);
  const dir = end.clone().sub(start);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(radius, radius, len, segments, 1, openEnded);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(mid);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function taperedTube(points, radiusStart, radiusEnd, material, options = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const segments = options.segments ?? 72;
  const radial = options.radial ?? 14;
  const noise = options.noise ?? 0.045;
  const vertices = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3(1, 0, 0);
  const p = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    curve.getPoint(t, p);
    curve.getTangent(t, tangent).normalize();
    normal.crossVectors(Math.abs(tangent.dot(up)) > 0.92 ? side : up, tangent).normalize();
    binormal.crossVectors(tangent, normal).normalize();
    const taper = Math.pow(1 - t, options.taperPower ?? 0.78);
    const baseRadius = radiusEnd + (radiusStart - radiusEnd) * taper;
    for (let j = 0; j < radial; j += 1) {
      const a = (j / radial) * TAU;
      const rib = 1 + Math.sin(t * TAU * 5 + j * 1.9) * noise;
      const r = baseRadius * rib;
      const dir = normal.clone().multiplyScalar(Math.cos(a)).add(binormal.clone().multiplyScalar(Math.sin(a))).normalize();
      vertices.push(p.x + dir.x * r, p.y + dir.y * r, p.z + dir.z * r);
      normals.push(dir.x, dir.y, dir.z);
      uvs.push(t * (options.uvScaleX ?? 3), j / radial);
    }
  }

  for (let i = 0; i < segments; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      const c = (i + 1) * radial + j;
      const d = (i + 1) * radial + ((j + 1) % radial);
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.curve = curve;
  return mesh;
}

function brainSurfacePoint(u, v, side = 1, lift = 0) {
  const x = -1.28 + u * 2.48;
  const crown = Math.max(0.001, Math.sin(Math.PI * u));
  const frontTaper = u < 0.15 ? 0.72 + u * 1.85 : 1;
  const rearTaper = u > 0.86 ? 1 - (u - 0.86) * 1.75 : 1;
  const taper = Math.max(0.52, Math.min(frontTaper, rearTaper));
  const halfHeight = (0.38 + 0.34 * Math.pow(crown, 0.54)) * taper;
  const center = 0.06 + 0.08 * Math.sin(Math.PI * (u - 0.12)) - 0.09 * u;
  const temporalDrop = Math.max(0, -v) * 0.2 * Math.exp(-Math.pow((u - 0.34) / 0.23, 2));
  const occipitalLift = 0.07 * Math.exp(-Math.pow((u - 0.87) / 0.14, 2));
  const fold =
    Math.sin(u * 56 + v * 6.5) * 0.018 +
    Math.sin(u * 27 - v * 18) * 0.014 +
    Math.sin((u + v) * 39) * 0.008;
  const y = center + v * halfHeight - temporalDrop + occipitalLift + fold * 0.34;
  const sideDepth = Math.sqrt(Math.max(0, 1 - Math.pow(v * 0.92, 2)));
  const depth = (0.26 + 0.2 * Math.pow(crown, 0.7)) * sideDepth * taper;
  const z = side * (depth + lift + fold * 0.32);
  return [x, y, z];
}

function corticalShellGeometry(uSegments = 90, vSegments = 38) {
  const vertices = [];
  const uvs = [];
  const indices = [];
  const sideCount = (uSegments + 1) * (vSegments + 1);

  [-1, 1].forEach((side) => {
    for (let i = 0; i <= uSegments; i += 1) {
      const u = i / uSegments;
      for (let j = 0; j <= vSegments; j += 1) {
        const v = -0.98 + (j / vSegments) * 1.96;
        vertices.push(...brainSurfacePoint(u, v, side, 0));
        uvs.push(u * 2.4, j / vSegments);
      }
    }
  });

  for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
    const base = sideIndex * sideCount;
    const outward = sideIndex === 1;
    for (let i = 0; i < uSegments; i += 1) {
      for (let j = 0; j < vSegments; j += 1) {
        const a = base + i * (vSegments + 1) + j;
        const b = base + (i + 1) * (vSegments + 1) + j;
        const c = base + i * (vSegments + 1) + j + 1;
        const d = base + (i + 1) * (vSegments + 1) + j + 1;
        if (outward) {
          indices.push(a, b, c, c, b, d);
        } else {
          indices.push(a, c, b, c, d, b);
        }
      }
    }
  }

  function addRim(edge, fixedIndex) {
    for (let i = 0; i < edge; i += 1) {
      const positiveA = sideCount + fixedIndex(i);
      const positiveB = sideCount + fixedIndex(i + 1);
      const negativeA = fixedIndex(i);
      const negativeB = fixedIndex(i + 1);
      indices.push(positiveA, negativeA, positiveB, positiveB, negativeA, negativeB);
    }
  }

  addRim(uSegments, (i) => i * (vSegments + 1));
  addRim(uSegments, (i) => i * (vSegments + 1) + vSegments);
  addRim(vSegments, (j) => j);
  addRim(vSegments, (j) => uSegments * (vSegments + 1) + j);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

function surfaceTube(points, material, options = {}) {
  const lifted = points.map(([u, v]) => brainSurfacePoint(u, v, options.side ?? 1, options.lift ?? 0.034));
  const tube = taperedTube(lifted, options.radiusStart ?? 0.012, options.radiusEnd ?? 0.008, material, {
    segments: options.segments ?? 34,
    radial: options.radial ?? 7,
    noise: options.noise ?? 0.012
  });
  if (options.endCaps) {
    const start = lifted[0];
    const end = lifted[lifted.length - 1];
    tube.add(sphere(start, options.radiusStart ?? 0.012, material, [1, 1, 1], 16));
    tube.add(sphere(end, options.radiusEnd ?? options.radiusStart ?? 0.012, material, [1, 1, 1], 16));
  }
  return tube;
}

function surfaceSulcus(points, material, options = {}) {
  return surfaceTube(points, material, options);
}

function surfaceGyrus(points, material, options = {}) {
  const radius = options.radius ?? 0.052;
  const tube = surfaceTube(points, material, {
    lift: options.lift ?? 0.062,
    side: options.side ?? 1,
    radiusStart: options.radiusStart ?? radius,
    radiusEnd: options.radiusEnd ?? radius * 0.92,
    segments: options.segments ?? 48,
    radial: options.radial ?? 18,
    noise: options.noise ?? 0.03,
    endCaps: true
  });
  tube.traverse((child) => {
    child.castShadow = false;
    child.receiveShadow = false;
  });
  return tube;
}

function surfaceGroove(points, material, options = {}) {
  return surfaceTube(points, material, {
    lift: options.lift ?? 0.071,
    side: options.side ?? 1,
    radiusStart: options.radiusStart ?? 0.018,
    radiusEnd: options.radiusEnd ?? 0.014,
    segments: options.segments ?? 46,
    radial: options.radial ?? 8,
    noise: options.noise ?? 0.01
  });
}

function oldSurfaceSulcus(points, material, options = {}) {
  const lifted = points.map(([u, v]) => brainSurfacePoint(u, v, 1, options.lift ?? 0.034));
  return taperedTube(lifted, options.radiusStart ?? 0.012, options.radiusEnd ?? 0.008, material, {
    segments: options.segments ?? 34,
    radial: options.radial ?? 7,
    noise: options.noise ?? 0.012
  });
}

function corticalArc(u0, u1, vBase, amplitude, phase, steps = 7) {
  const points = [];
  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);
    const u = u0 + (u1 - u0) * t;
    const wave = Math.sin(t * Math.PI * 2 + phase) * amplitude + Math.sin(t * Math.PI * 4 + phase * 0.7) * amplitude * 0.34;
    const v = Math.max(-0.9, Math.min(0.9, vBase + wave));
    points.push([u, v]);
  }
  return points;
}

function addAnchor(anchors, group, id, label, position, modes, summary, source) {
  const object = new THREE.Object3D();
  object.position.set(...position);
  group.add(object);
  anchors.push({ id, label, object, modes, summary, source });
  return object;
}

function colorizeBrainGeometry(geometry) {
  const position = geometry.attributes.position;
  if (!position) return;
  const color = new THREE.Color();
  const base = new THREE.Color(0xeaa996);
  const warm = new THREE.Color(0xf7c2a8);
  const crease = new THREE.Color(0xa84e55);
  const colors = [];

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const grain =
      Math.sin(x * 0.137 + y * 0.211) * 0.5 +
      Math.sin(z * 0.173 - x * 0.089) * 0.36 +
      Math.sin((x + y + z) * 0.047) * 0.26;
    const highlight = Math.max(0, Math.min(1, 0.46 + grain * 0.18 + y * 0.002));
    color.copy(base).lerp(warm, highlight);
    if (grain < -0.42) color.lerp(crease, Math.min(0.36, Math.abs(grain) * 0.18));
    colors.push(color.r, color.g, color.b);
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}

function makeBrainModelMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xf0ac9b,
    vertexColors: true,
    roughness: 0.48,
    metalness: 0,
    clearcoat: 0.42,
    clearcoatRoughness: 0.6,
    sheen: 0.55,
    sheenColor: new THREE.Color(0xffd4bd),
    sheenRoughness: 0.72,
    transmission: 0,
    thickness: 0.12,
    side: THREE.DoubleSide
  });
}

function fitBrainModelToAtlas(root) {
  const box = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);

  // The NIH file is STL-derived. Rotate the superior-inferior axis into
  // Three.js' vertical axis so the brainstem reads downward, not sideways.
  root.rotation.x = -Math.PI / 2;
  root.rotation.y = 0.04;
  root.rotation.z = -0.045;

  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = 2.78 / maxDim;
  root.scale.setScalar(scale);
  root.position.copy(center.clone().multiplyScalar(scale).applyEuler(root.rotation)).multiplyScalar(-1);
  root.position.x -= 0.08;
  root.position.y -= 0.2;
  root.position.z -= 0.04;
}

function loadNihBrainModel(modelGroup, fallbackGroup) {
  const loader = new GLTFLoader();
  loader.load(
    NIH_BRAIN_MODEL_URL,
    (gltf) => {
      const root = gltf.scene;
      const material = makeBrainModelMaterial();
      root.traverse((child) => {
        if (!child.isMesh) return;
        if (child.geometry) {
          child.geometry.computeVertexNormals();
          colorizeBrainGeometry(child.geometry);
        }
        child.material = material;
        child.castShadow = true;
        child.receiveShadow = true;
      });
      fitBrainModelToAtlas(root);
      modelGroup.add(root);
      fallbackGroup.visible = false;
      modelGroup.userData.loaded = true;
    },
    undefined,
    () => {
      fallbackGroup.visible = true;
      modelGroup.userData.loaded = false;
    }
  );
}

function buildMaterials() {
  const cellMap = makeTexture({ base: '#c983b7', speck: '#fff0dc', vein: '#7f4d91', alpha: 0.34 });
  const branchMap = makeTexture({ base: '#b679a8', speck: '#ffe3cb', vein: '#714a83', alpha: 0.28 });
  const myelinMap = makeTexture({ base: '#d8e5ec', speck: '#ffffff', vein: '#7795b0', alpha: 0.18 });
  const bump = grayscaleTexture();
  cellMap.repeat.set(1.6, 1.6);
  branchMap.repeat.set(2.6, 1.2);
  myelinMap.repeat.set(1.4, 1.0);

  return {
    soma: physical(0xc479bd, {
      map: cellMap,
      bumpMap: bump,
      bumpScale: 0.035,
      transparent: true,
      opacity: 0.9,
      transmission: 0.04,
      thickness: 0.85,
      roughness: 0.34,
      clearcoat: 0.55
    }),
    membrane: physical(0xf0b6d5, {
      transparent: true,
      opacity: 0.28,
      transmission: 0.42,
      thickness: 0.9,
      roughness: 0.22,
      clearcoat: 0.75
    }),
    nucleus: physical(0x6d2f86, {
      map: cellMap,
      bumpMap: bump,
      bumpScale: 0.02,
      transparent: true,
      opacity: 0.92,
      transmission: 0.08,
      roughness: 0.29,
      clearcoat: 0.64
    }),
    organelle: physical(0xf28b55, {
      transparent: true,
      opacity: 0.82,
      roughness: 0.36,
      emissive: 0x3f1206,
      emissiveIntensity: 0.08
    }),
    dendrite: physical(0xae74aa, {
      map: branchMap,
      bumpMap: bump,
      bumpScale: 0.03,
      roughness: 0.48,
      clearcoat: 0.34
    }),
    axon: physical(0xdf6f37, {
      bumpMap: bump,
      bumpScale: 0.018,
      roughness: 0.4,
      clearcoat: 0.42,
      emissive: 0x2f0d04,
      emissiveIntensity: 0.05
    }),
    myelin: physical(0xc9dcea, {
      map: myelinMap,
      bumpMap: bump,
      bumpScale: 0.025,
      transparent: true,
      opacity: 0.96,
      transmission: 0.08,
      roughness: 0.22,
      clearcoat: 0.82
    }),
    node: physical(0xe49a61, {
      roughness: 0.33,
      clearcoat: 0.5,
      emissive: 0x3a1405,
      emissiveIntensity: 0.08
    }),
    bouton: physical(0xa865b5, {
      map: branchMap,
      bumpMap: bump,
      bumpScale: 0.024,
      roughness: 0.36,
      clearcoat: 0.56
    }),
    vesicle: physical(0xf0b65d, {
      transparent: true,
      opacity: 0.84,
      transmission: 0.12,
      roughness: 0.22,
      clearcoat: 0.8,
      emissive: 0x351400,
      emissiveIntensity: 0.06
    }),
    receptor: physical(0x477fa3, {
      roughness: 0.32,
      clearcoat: 0.64,
      emissive: 0x061826,
      emissiveIntensity: 0.04
    }),
    post: physical(0xd6a9bf, {
      transparent: true,
      opacity: 0.54,
      transmission: 0.12,
      roughness: 0.36,
      clearcoat: 0.55
    }),
    lipidA: physical(0xf3c1d2, {
      transparent: true,
      opacity: 0.78,
      roughness: 0.25,
      clearcoat: 0.6
    }),
    lipidB: physical(0xbd8ab3, {
      transparent: true,
      opacity: 0.7,
      roughness: 0.3,
      clearcoat: 0.5
    })
  };
}

function addSpines(group, curve, material, count, radiusScale = 1) {
  for (let i = 0; i < count; i += 1) {
    const t = 0.14 + rand() * 0.78;
    const p = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const outward = new THREE.Vector3(Math.sin(i * 1.7), Math.cos(i * 2.1), Math.sin(i * 0.83)).normalize();
    if (Math.abs(outward.dot(tangent)) > 0.84) outward.cross(new THREE.Vector3(0, 1, 0)).normalize();
    const base = p.clone().add(outward.clone().multiplyScalar(0.035));
    const tip = p.clone().add(outward.multiplyScalar(0.14 + rand() * 0.11));
    const neck = taperedTube([base.toArray(), tip.toArray()], 0.008 * radiusScale, 0.004 * radiusScale, material, {
      segments: 8,
      radial: 7,
      noise: 0.02
    });
    group.add(neck);
    group.add(sphere(tip.toArray(), (0.018 + rand() * 0.012) * radiusScale, material, [1, 1, 1], 10));
  }
}

function buildDendrites(materials, anchors, somaCenter) {
  const dendrites = new THREE.Group();
  dendrites.name = 'dendrites';

  const roots = [
    [-1.0, 0.55, 0.12],
    [-1.04, 0.18, -0.28],
    [-0.78, 0.86, 0.24],
    [-1.05, -0.38, 0.22],
    [-0.68, -0.78, -0.16],
    [-0.28, 0.94, -0.28],
    [-1.18, -0.04, 0.42],
    [-0.12, -0.92, 0.18]
  ];

  roots.forEach((dir, i) => {
    const direction = new THREE.Vector3(...dir).normalize();
    const start = new THREE.Vector3(...somaCenter).add(direction.clone().multiplyScalar(0.72));
    const mid = new THREE.Vector3(...somaCenter).add(direction.clone().multiplyScalar(1.32 + rand() * 0.18));
    mid.y += Math.sin(i * 1.7) * 0.18;
    mid.z += Math.cos(i * 1.3) * 0.18;
    const end = new THREE.Vector3(...somaCenter).add(direction.clone().multiplyScalar(2.12 + rand() * 0.44));
    end.y += Math.sin(i * 2.2) * 0.36;
    end.z += Math.cos(i * 1.6) * 0.28;

    const trunk = taperedTube([start.toArray(), mid.toArray(), end.toArray()], 0.09, 0.028, materials.dendrite, {
      segments: 68,
      radial: 14,
      noise: 0.055
    });
    dendrites.add(trunk);
    addSpines(dendrites, trunk.userData.curve, materials.dendrite, 14, 1.2);

    for (let j = 0; j < 3; j += 1) {
      const fork = trunk.userData.curve.getPoint(0.46 + j * 0.16);
      const forkDir = direction
        .clone()
        .add(new THREE.Vector3(-0.28 - rand() * 0.44, (rand() - 0.5) * 0.98, (rand() - 0.5) * 0.82))
        .normalize();
      const forkEnd = fork.clone().add(forkDir.multiplyScalar(0.82 + rand() * 0.58));
      const branch = taperedTube([fork.toArray(), fork.clone().lerp(forkEnd, 0.48).toArray(), forkEnd.toArray()], 0.042, 0.014, materials.dendrite, {
        segments: 38,
        radial: 12,
        noise: 0.06
      });
      dendrites.add(branch);
      addSpines(dendrites, branch.userData.curve, materials.dendrite, 7, 0.82);
      dendrites.add(organicSphere(forkEnd.toArray(), 0.038 + rand() * 0.012, materials.dendrite, [1.1, 0.95, 1], 1, 0.1));
    }
  });

  const dendriteMeta = STRUCTURES.find((s) => s.id === 'dendrites');
  addAnchor(
    anchors,
    dendrites,
    'dendrites',
    'Dendrites',
    [somaCenter[0] - 1.95, somaCenter[1] + 1.28, somaCenter[2] + 0.32],
    ['full', 'isolate'],
    dendriteMeta.summary,
    dendriteMeta.source
  );

  return dendrites;
}

function addMyelinWraps(axonGroup, materials, axonCurve) {
  const segments = [
    [0.18, 0.27],
    [0.33, 0.42],
    [0.48, 0.58],
    [0.64, 0.74],
    [0.8, 0.89]
  ];

  segments.forEach(([a, b], i) => {
    const start = axonCurve.getPoint(a);
    const end = axonCurve.getPoint(b);
    const sheath = cylinderBetween(start.toArray(), end.toArray(), 0.205, materials.myelin, 36);
    sheath.scale.x = 0.92;
    axonGroup.add(sheath);
    axonGroup.add(sphere(start.toArray(), 0.205, materials.myelin, [0.62, 1.0, 1.0], 24));
    axonGroup.add(sphere(end.toArray(), 0.205, materials.myelin, [0.62, 1.0, 1.0], 24));

    const rings = 3 + (i % 2);
    for (let r = 0; r < rings; r += 1) {
      const t = a + ((b - a) * (r + 0.5)) / rings;
      const center = axonCurve.getPoint(t);
      const tangent = axonCurve.getTangent(t).normalize();
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.208, 0.006, 8, 64),
        new THREE.MeshBasicMaterial({ color: 0x7694aa, transparent: true, opacity: 0.3 })
      );
      ring.position.copy(center);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
      axonGroup.add(ring);
    }
  });
}

function buildSynapse(materials, anchors) {
  const synapse = new THREE.Group();
  synapse.name = 'synapse-group';
  synapse.position.set(4.86, 0.02, 0.04);
  synapse.scale.setScalar(1.18);

  const bouton = organicSphere([-0.35, 0.0, 0.02], 0.46, materials.bouton, [1.08, 0.92, 0.92], 4, 0.1);
  synapse.add(bouton);

  for (let i = 0; i < 28; i += 1) {
    const a = rand() * TAU;
    const r = 0.12 + rand() * 0.22;
    const p = [
      -0.38 + Math.cos(a) * r * 0.68,
      Math.sin(a) * r,
      (rand() - 0.5) * 0.36
    ];
    const vesicle = sphere(p, 0.045 + rand() * 0.022, materials.vesicle, [1, 1, 1], 18);
    synapse.add(vesicle);
  }

  const cleftMembrane = taperedTube(
    [
      [0.33, -0.72, -0.08],
      [0.42, -0.24, 0.05],
      [0.38, 0.28, 0.02],
      [0.5, 0.74, -0.05]
    ],
    0.078,
    0.078,
    materials.post,
    { segments: 76, radial: 18, noise: 0.035, uvScaleX: 1 }
  );
  synapse.add(cleftMembrane);

  for (let i = -4; i <= 4; i += 1) {
    const y = i * 0.16;
    const lipidA = sphere([0.34, y, 0.08], 0.035, materials.lipidA, [1, 1, 0.72], 12);
    const lipidB = sphere([0.52, y + 0.045 * Math.sin(i), -0.08], 0.032, materials.lipidB, [1, 1, 0.72], 12);
    synapse.add(lipidA, lipidB);
  }

  for (let i = -3; i <= 3; i += 1) {
    const y = i * 0.19;
    const receptor = new THREE.Group();
    receptor.add(cylinderBetween([0.24, y, -0.08], [0.6, y, -0.08], 0.03, materials.receptor, 18));
    receptor.add(cylinderBetween([0.31, y - 0.045, -0.08], [0.31, y + 0.045, -0.08], 0.018, materials.receptor, 14));
    receptor.add(cylinderBetween([0.48, y - 0.045, -0.08], [0.48, y + 0.045, -0.08], 0.018, materials.receptor, 14));
    receptor.add(sphere([0.17, y, -0.08], 0.044, materials.receptor, [1, 1, 1], 14));
    receptor.name = 'receptor';
    synapse.add(receptor);
  }

  const particleMat = new THREE.MeshPhysicalMaterial({
    color: 0xe45b47,
    roughness: 0.18,
    metalness: 0,
    clearcoat: 0.75,
    emissive: 0x2a0702,
    emissiveIntensity: 0.16
  });
  const particles = [];
  for (let i = 0; i < 56; i += 1) {
    const mesh = sphere(
      [-0.08 + rand() * 0.24, (rand() - 0.5) * 0.56, (rand() - 0.5) * 0.26],
      0.018 + rand() * 0.012,
      particleMat,
      [1, 1, 1],
      10
    );
    mesh.userData.seed = i / 56;
    mesh.userData.offset = rand() * TAU;
    particles.push(mesh);
    synapse.add(mesh);
  }

  const calciumMat = new THREE.MeshPhysicalMaterial({
    color: 0x5aa7dc,
    roughness: 0.2,
    clearcoat: 0.75,
    emissive: 0x061a2b,
    emissiveIntensity: 0.18
  });
  const calciumParticles = [];
  for (let i = 0; i < 20; i += 1) {
    const mesh = sphere(
      [-0.72 + rand() * 0.22, (rand() - 0.5) * 0.5, 0.22 + (rand() - 0.5) * 0.18],
      0.018 + rand() * 0.01,
      calciumMat,
      [1, 1, 1],
      10
    );
    mesh.userData.seed = rand();
    mesh.visible = false;
    calciumParticles.push(mesh);
    synapse.add(mesh);
  }

  const receptorHalo = new THREE.Mesh(
    new THREE.TorusGeometry(0.45, 0.01, 8, 96),
    new THREE.MeshBasicMaterial({
      color: 0x4a8fb9,
      transparent: true,
      opacity: 0,
      depthWrite: false
    })
  );
  receptorHalo.position.set(0.42, 0, -0.08);
  receptorHalo.rotation.y = Math.PI / 2;
  synapse.add(receptorHalo);

  const vesicleMeta = STRUCTURES.find((s) => s.id === 'vesicles');
  const receptorMeta = STRUCTURES.find((s) => s.id === 'receptors');
  const terminalMeta = STRUCTURES.find((s) => s.id === 'terminal');
  addAnchor(anchors, synapse, 'terminal', 'Axon terminal', [-0.54, 0.48, 0.2], ['full', 'synapse'], terminalMeta.summary, terminalMeta.source);
  addAnchor(anchors, synapse, 'vesicles', 'Vesicles', [-0.62, 0.22, 0.28], ['synapse'], vesicleMeta.summary, vesicleMeta.source);
  addAnchor(anchors, synapse, 'receptors', 'Receptors', [0.58, 0.42, 0.16], ['synapse'], receptorMeta.summary, receptorMeta.source);
  addAnchor(anchors, synapse, 'synapse', 'Synaptic cleft', [0.05, -0.55, 0.16], ['synapse'], 'The small gap where an electrical signal is translated into a chemical one.', 'BrainFacts');

  return { group: synapse, particleMat, particles, calciumParticles, receptorHalo };
}

function buildNeuron(anchors) {
  const neuron = new THREE.Group();
  neuron.name = 'neuron-root';
  const materials = buildMaterials();
  const somaCenter = [-2.18, 0, 0];

  const somaGroup = new THREE.Group();
  somaGroup.name = 'soma-group';
  const somaMesh = organicSphere(somaCenter, 0.82, materials.soma, [1.22, 0.96, 0.9], 5, 0.075);
  const membrane = organicSphere(somaCenter, 0.88, materials.membrane, [1.28, 1.0, 0.94], 5, 0.055);
  const nucleus = organicSphere([somaCenter[0] - 0.08, 0.02, 0.06], 0.36, materials.nucleus, [1.08, 0.94, 0.96], 4, 0.07);
  somaGroup.add(somaMesh, membrane, nucleus);
  somaGroup.add(sphere([somaCenter[0] - 0.14, 0.02, 0.1], 0.12, materials.nucleus, [1.2, 0.86, 0.92], 24));

  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * TAU;
    const r = 0.42 + rand() * 0.13;
    const p0 = [somaCenter[0] + Math.cos(a) * r, Math.sin(a) * 0.38, Math.sin(a * 1.1) * 0.22];
    const p1 = [somaCenter[0] + Math.cos(a + 0.7) * (r + 0.16), Math.sin(a + 0.9) * 0.34, Math.sin(a * 1.4) * 0.28];
    const p2 = [somaCenter[0] + Math.cos(a + 1.2) * r, Math.sin(a + 1.4) * 0.38, Math.sin(a * 1.8) * 0.24];
    somaGroup.add(taperedTube([p0, p1, p2], 0.018, 0.012, materials.organelle, {
      segments: 24,
      radial: 8,
      noise: 0.02
    }));
  }

  for (let i = 0; i < 34; i += 1) {
    const a = rand() * TAU;
    const r = 0.25 + rand() * 0.52;
    somaGroup.add(sphere(
      [somaCenter[0] + Math.cos(a) * r * 0.88, Math.sin(a * 1.7) * 0.42, Math.sin(a) * r * 0.42],
      0.018 + rand() * 0.016,
      materials.organelle,
      [1.25, 0.82, 0.9],
      10
    ));
  }

  const somaMeta = STRUCTURES.find((s) => s.id === 'soma');
  addAnchor(anchors, somaGroup, 'soma', 'Soma', [somaCenter[0] + 0.05, 0.9, 0.42], ['full', 'isolate'], somaMeta.summary, somaMeta.source);
  neuron.add(somaGroup);

  const dendrites = buildDendrites(materials, anchors, somaCenter);
  neuron.add(dendrites);

  const axonGroup = new THREE.Group();
  axonGroup.name = 'axon-group';
  const axonPoints = [
    [somaCenter[0] + 0.92, -0.04, 0.03],
    [-0.86, 0.02, 0.02],
    [-0.12, 0.08, -0.04],
    [0.76, 0.02, 0.05],
    [1.62, -0.05, -0.02],
    [2.48, 0.02, 0.05],
    [3.42, 0.0, -0.02],
    [4.28, 0.02, 0.03]
  ];
  const axon = taperedTube(axonPoints, 0.078, 0.052, materials.axon, {
    segments: 136,
    radial: 16,
    noise: 0.035,
    uvScaleX: 4
  });
  axonGroup.add(axon);
  addMyelinWraps(axonGroup, materials, axon.userData.curve);

  const pulseMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffd36f,
    roughness: 0.18,
    clearcoat: 0.8,
    emissive: 0xff8a2a,
    emissiveIntensity: 0.65
  });
  const actionPulse = sphere(axonPoints[0], 0.085, pulseMaterial, [1.2, 1.2, 1.2], 18);
  actionPulse.visible = false;
  axonGroup.add(actionPulse);

  const axonMeta = STRUCTURES.find((s) => s.id === 'axon');
  const myelinMeta = STRUCTURES.find((s) => s.id === 'myelin');
  addAnchor(anchors, axonGroup, 'axon', 'Axon', [1.0, 0.36, 0.24], ['full'], axonMeta.summary, axonMeta.source);
  addAnchor(anchors, axonGroup, 'myelin', 'Myelin', [2.25, 0.42, 0.32], ['full', 'isolate'], myelinMeta.summary, myelinMeta.source);

  const terminalBase = axon.userData.curve.getPoint(1);
  const terminalEnds = [
    [4.82, 0.42, 0.26],
    [4.96, 0.1, -0.34],
    [4.82, -0.32, 0.2]
  ];
  terminalEnds.forEach((end) => {
    axonGroup.add(taperedTube([terminalBase.toArray(), [4.55, end[1] * 0.45, end[2] * 0.22], end], 0.052, 0.025, materials.bouton, {
      segments: 36,
      radial: 12,
      noise: 0.04
    }));
    axonGroup.add(organicSphere(end, 0.16, materials.bouton, [1.04, 0.94, 0.96], 3, 0.08));
  });
  neuron.add(axonGroup);

  const synapse = buildSynapse(materials, anchors);
  neuron.add(synapse.group);

  return {
    group: neuron,
    somaMesh,
    membrane,
    somaGroup,
    dendrites,
    axonGroup,
    axonCurve: axon.userData.curve,
    actionPulse,
    synapseGroup: synapse.group,
    particleMat: synapse.particleMat,
    particles: synapse.particles,
    calciumParticles: synapse.calciumParticles,
    receptorHalo: synapse.receptorHalo
  };
}

function buildBrain(anchors) {
  const brain = new THREE.Group();
  brain.name = 'brain-root';
  brain.visible = false;

  const brainMap = brainTissueTexture();
  const brainBump = brainBumpTexture();
  const brainMat = physical(0xe0a198, {
    map: brainMap,
    bumpMap: brainBump,
    bumpScale: 0.028,
    transparent: true,
    opacity: 0.05,
    transmission: 0.08,
    thickness: 0.7,
    roughness: 0.24,
    clearcoat: 0.78,
    clearcoatRoughness: 0.18
  });
  const shellMat = physical(0xe2a296, {
    map: brainMap,
    bumpMap: brainBump,
    bumpScale: 0.02,
    transparent: true,
    opacity: 0.18,
    transmission: 0.03,
    thickness: 0.9,
    roughness: 0.21,
    clearcoat: 0.9,
    clearcoatRoughness: 0.16
  });
  shellMat.depthWrite = false;
  shellMat.side = THREE.DoubleSide;
  const gyrusMat = new THREE.MeshBasicMaterial({
    color: 0xf0ab9d,
    map: brainMap,
    transparent: true,
    opacity: 0.18,
    depthWrite: false
  });
  const gyrusFarMat = gyrusMat.clone();
  gyrusFarMat.opacity = 0.08;
  gyrusFarMat.transparent = true;
  gyrusFarMat.depthWrite = false;
  const deepMat = physical(0xa96372, {
    map: brainMap,
    transparent: true,
    opacity: 0.3,
    transmission: 0.08,
    thickness: 0.55,
    roughness: 0.28,
    clearcoat: 0.62
  });
  const ridgeMat = new THREE.MeshBasicMaterial({
    color: 0xb56f73,
    transparent: true,
    opacity: 0.1,
    depthWrite: false
  });
  const fissureMat = new THREE.MeshBasicMaterial({
    color: 0x9d565f,
    transparent: true,
    opacity: 0.13,
    depthWrite: false
  });
  const callosumMat = new THREE.MeshPhysicalMaterial({
    color: 0xe4bea6,
    transparent: true,
    opacity: 0.42,
    roughness: 0.28,
    clearcoat: 0.5,
    depthWrite: false
  });
  const glowMat = new THREE.MeshPhysicalMaterial({
    color: 0xe45b47,
    transparent: true,
    opacity: 0.9,
    roughness: 0.18,
    clearcoat: 0.7,
    emissive: 0x260802,
    emissiveIntensity: 0.14
  });
  glowMat.depthTest = false;

  const modelGroup = new THREE.Group();
  modelGroup.name = 'nih-3d-brain-model';
  brain.add(modelGroup);

  const fallbackGroup = new THREE.Group();
  fallbackGroup.name = 'procedural-brain-fallback';
  brain.add(fallbackGroup);
  loadNihBrainModel(modelGroup, fallbackGroup);

  const shell = new THREE.Mesh(corticalShellGeometry(), shellMat);
  shell.renderOrder = 1;
  shell.castShadow = true;
  shell.receiveShadow = true;
  fallbackGroup.add(shell);

  const lobes = [
    ['frontal', [-0.74, 0.18, 0], 0.72, [1.12, 0.92, 0.72], 0.075],
    ['parietal', [0.02, 0.34, 0.03], 0.72, [1.18, 0.84, 0.68], 0.065],
    ['occipital', [0.78, 0.13, 0.02], 0.6, [0.92, 0.78, 0.62], 0.07],
    ['temporal', [-0.1, -0.38, 0.04], 0.6, [1.32, 0.48, 0.58], 0.06]
  ];
  lobes.forEach(([, position, radius, scale, distortion]) => {
    fallbackGroup.add(organicSphere(position, radius, brainMat, scale, 5, distortion));
  });
  fallbackGroup.add(organicSphere([0.08, -0.04, 0.18], 0.34, deepMat, [1.2, 0.82, 0.72], 4, 0.05));
  fallbackGroup.add(taperedTube([
    [-0.64, -0.1, 0.36],
    [-0.18, 0.06, 0.46],
    [0.42, 0.0, 0.42],
    [0.68, -0.1, 0.32]
  ], 0.038, 0.025, callosumMat, {
    segments: 52,
    radial: 12,
    noise: 0.015
  }));

  const primaryGyri = [
    { points: [[0.06, 0.56], [0.18, 0.68], [0.34, 0.62], [0.43, 0.5]], radius: 0.046 },
    { points: [[0.08, 0.34], [0.2, 0.42], [0.34, 0.34], [0.45, 0.22]], radius: 0.044 },
    { points: [[0.08, 0.12], [0.22, 0.16], [0.36, 0.09], [0.47, -0.02]], radius: 0.041 },
    { points: [[0.36, 0.82], [0.39, 0.56], [0.38, 0.22], [0.42, -0.12]], radius: 0.039, segments: 58 },
    { points: [[0.49, 0.8], [0.5, 0.54], [0.48, 0.22], [0.52, -0.08]], radius: 0.038, segments: 58 },
    { points: [[0.5, 0.58], [0.62, 0.66], [0.78, 0.58], [0.9, 0.44]], radius: 0.046 },
    { points: [[0.52, 0.34], [0.65, 0.38], [0.81, 0.29], [0.94, 0.15]], radius: 0.044 },
    { points: [[0.58, 0.1], [0.72, 0.12], [0.87, 0.03], [0.97, -0.1]], radius: 0.038 },
    { points: [[0.18, -0.22], [0.36, -0.2], [0.58, -0.26], [0.8, -0.36], [0.96, -0.42]], radius: 0.047, segments: 66 },
    { points: [[0.2, -0.46], [0.4, -0.44], [0.62, -0.5], [0.82, -0.58], [0.96, -0.62]], radius: 0.045, segments: 66 },
    { points: [[0.32, -0.68], [0.5, -0.66], [0.72, -0.7], [0.9, -0.77]], radius: 0.037 },
    { points: [[0.77, 0.68], [0.88, 0.58], [0.95, 0.38], [0.95, 0.16]], radius: 0.037 }
  ];
  primaryGyri.forEach((gyrus) => {
    fallbackGroup.add(surfaceGyrus(gyrus.points, gyrusMat, {
      radius: gyrus.radius,
      lift: 0.074,
      segments: gyrus.segments ?? 50,
      noise: 0.028
    }));
  });

  const secondaryGyri = [
    corticalArc(0.1, 0.32, 0.72, 0.035, 0.3, 6),
    corticalArc(0.12, 0.34, 0.47, 0.04, 1.6, 6),
    corticalArc(0.12, 0.38, -0.08, 0.034, 2.2, 6),
    corticalArc(0.44, 0.7, 0.72, 0.034, 1.1, 6),
    corticalArc(0.55, 0.86, 0.48, 0.038, 0.1, 7),
    corticalArc(0.58, 0.9, 0.22, 0.036, 2.5, 7),
    corticalArc(0.5, 0.86, -0.12, 0.032, 1.7, 7),
    corticalArc(0.28, 0.76, -0.33, 0.028, 0.8, 8),
    corticalArc(0.36, 0.86, -0.56, 0.026, 2.1, 8)
  ];
  secondaryGyri.forEach((points, index) => {
    fallbackGroup.add(surfaceGyrus(points, gyrusMat, {
      radius: 0.022 + (index % 3) * 0.004,
      lift: 0.09,
      segments: 36,
      radial: 14,
      noise: 0.024
    }));
  });

  [
    { points: [[0.12, 0.52], [0.26, 0.62], [0.4, 0.56]], side: -1 },
    { points: [[0.22, 0.16], [0.4, 0.12], [0.58, 0.16]], side: -1 },
    { points: [[0.5, 0.5], [0.68, 0.52], [0.88, 0.36]], side: -1 },
    { points: [[0.36, -0.36], [0.58, -0.42], [0.82, -0.5]], side: -1 }
  ].forEach((gyrus) => {
    fallbackGroup.add(surfaceGyrus(gyrus.points, gyrusFarMat, {
      side: gyrus.side,
      radius: 0.028,
      lift: 0.06,
      segments: 34,
      radial: 12,
      noise: 0.02
    }));
  });

  const cerebellum = organicSphere([0.95, -0.62, -0.03], 0.38, gyrusMat, [1.18, 0.76, 0.66], 4, 0.08);
  fallbackGroup.add(cerebellum);
  fallbackGroup.add(cylinderBetween([0.76, -0.78, -0.04], [1.02, -1.22, -0.08], 0.12, brainMat, 28));
  fallbackGroup.add(cylinderBetween([0.64, -0.66, -0.03], [0.82, -0.86, -0.05], 0.095, deepMat, 24));

  for (let i = 0; i < 17; i += 1) {
    const t = i / 16;
    const y = -0.88 + t * 0.48;
    const width = 0.26 + Math.sin(t * Math.PI) * 0.28;
    const z = 0.18 + Math.sin(t * Math.PI) * 0.13;
    fallbackGroup.add(taperedTube([
      [0.58 + width * 0.12, y, z],
      [0.82, y + Math.sin(i * 0.7) * 0.035, z + 0.1],
      [1.1 + width, y + Math.cos(i * 0.6) * 0.026, z + 0.02]
    ], 0.018, 0.013, i % 2 ? fissureMat : ridgeMat, {
      segments: 28,
      radial: 8,
      noise: 0.012
    }));
  }

  const majorFissures = [
    [[-0.18, 0.82, 0.5], [-0.02, 0.38, 0.58], [-0.07, -0.04, 0.54]],
    [[-0.98, -0.06, 0.55], [-0.42, -0.18, 0.64], [0.28, -0.13, 0.58], [0.68, -0.26, 0.48]],
    [[0.44, 0.66, 0.5], [0.56, 0.28, 0.56], [0.48, -0.04, 0.52]]
  ];
  majorFissures.forEach((points) => {
    fallbackGroup.add(taperedTube(points, 0.018, 0.014, fissureMat, {
      segments: 44,
      radial: 8,
      noise: 0.01
    }));
  });

  const anatomicalGrooves = [
    { points: [[0.02, 0.86], [0.18, 0.92], [0.38, 0.91], [0.6, 0.88], [0.84, 0.78], [0.98, 0.58]], radiusStart: 0.028, radiusEnd: 0.018, lift: 0.094, segments: 70 },
    { points: [[0.34, 0.82], [0.39, 0.54], [0.38, 0.18], [0.43, -0.18]], radiusStart: 0.03, radiusEnd: 0.02, lift: 0.1, segments: 62 },
    { points: [[0.08, -0.05], [0.25, -0.17], [0.5, -0.2], [0.76, -0.31], [0.98, -0.42]], radiusStart: 0.034, radiusEnd: 0.022, lift: 0.1, segments: 70 },
    { points: [[0.5, 0.74], [0.58, 0.48], [0.58, 0.18], [0.64, -0.06]], radiusStart: 0.022, radiusEnd: 0.016, lift: 0.096, segments: 50 },
    { points: [[0.72, 0.7], [0.78, 0.42], [0.82, 0.12], [0.9, -0.12]], radiusStart: 0.02, radiusEnd: 0.014, lift: 0.094, segments: 48 }
  ];
  anatomicalGrooves.forEach((groove) => {
    fallbackGroup.add(surfaceGroove(groove.points, fissureMat, groove));
  });

  const namedSulci = [
    { points: [[0.36, 0.82], [0.42, 0.48], [0.39, 0.12], [0.46, -0.16]], radiusStart: 0.019, radiusEnd: 0.012, lift: 0.046, segments: 42 },
    { points: [[0.14, -0.08], [0.28, -0.18], [0.48, -0.2], [0.7, -0.31]], radiusStart: 0.021, radiusEnd: 0.014, lift: 0.048, segments: 48 },
    { points: [[0.76, 0.68], [0.79, 0.38], [0.75, 0.12], [0.83, -0.08]], radiusStart: 0.015, radiusEnd: 0.01, lift: 0.044, segments: 34 },
    { points: [[0.24, 0.08], [0.38, 0.0], [0.56, 0.03], [0.7, 0.12]], radiusStart: 0.012, radiusEnd: 0.008, lift: 0.04, segments: 34 }
  ];
  namedSulci.forEach((sulcus) => fallbackGroup.add(surfaceSulcus(sulcus.points, fissureMat, sulcus)));

  [
    corticalArc(0.07, 0.36, 0.48, 0.05, 0.2),
    corticalArc(0.09, 0.38, 0.3, 0.052, 1.4),
    corticalArc(0.12, 0.42, 0.1, 0.044, 2.1),
    corticalArc(0.43, 0.76, 0.55, 0.05, 0.6),
    corticalArc(0.44, 0.82, 0.34, 0.06, 1.9),
    corticalArc(0.48, 0.86, 0.11, 0.044, 2.6),
    corticalArc(0.23, 0.72, -0.42, 0.042, 1.2),
    corticalArc(0.27, 0.8, -0.62, 0.034, 2.4),
    corticalArc(0.72, 0.95, 0.42, 0.045, 0.8),
    corticalArc(0.72, 0.95, 0.18, 0.04, 2.2),
    corticalArc(0.76, 0.94, -0.1, 0.032, 3.1)
  ].forEach((points) => {
    fallbackGroup.add(surfaceSulcus(points, ridgeMat, {
      radiusStart: 0.0105,
      radiusEnd: 0.007,
      lift: 0.043,
      segments: 26,
      noise: 0.014
    }));
  });

  for (let i = 0; i < 22; i += 1) {
    const u0 = 0.08 + rand() * 0.72;
    const u1 = Math.min(0.96, u0 + 0.16 + rand() * 0.22);
    const v = -0.68 + rand() * 1.32;
    fallbackGroup.add(surfaceSulcus(corticalArc(u0, u1, v, 0.018 + rand() * 0.026, rand() * TAU, 5), ridgeMat, {
      radiusStart: 0.0075,
      radiusEnd: 0.0055,
      lift: 0.039,
      segments: 16,
      radial: 6,
      noise: 0.012
    }));
  }

  for (let i = 0; i < 13; i += 1) {
    const y = -0.82 + i * 0.032;
    fallbackGroup.add(taperedTube([
      [0.58, y, 0.2],
      [0.88, y + Math.sin(i * 0.8) * 0.04, 0.32],
      [1.24, y + Math.cos(i * 0.5) * 0.035, 0.2]
    ], 0.008, 0.006, ridgeMat, {
      segments: 16,
      radial: 6,
      noise: 0.01
    }));
  }

  const regionGlows = {};
  Object.entries(REGION_POSITIONS).forEach(([id, meta]) => {
    const pos = meta.position;
    const glow = organicSphere(pos, 0.072, glowMat.clone(), [1.12, 1.12, 0.82], 3, 0.035);
    glow.visible = false;
    glow.userData.baseScale = 1;
    glow.renderOrder = 8;
    glow.material.depthTest = false;
    brain.add(glow);
    regionGlows[id] = glow;
    addAnchor(anchors, brain, `region-${id}`, meta.label, pos, ['brain'], 'Representative region highlighted for the selected transmitter.', 'Source-backed atlas note');
  });

  brain.scale.setScalar(1.98);
  brain.position.set(0, 0.0, 0);
  return { group: brain, regionGlows };
}

export function buildAtlasScene() {
  const root = new THREE.Group();
  const anchors = [];
  const neuron = buildNeuron(anchors);
  const brain = buildBrain(anchors);
  root.add(neuron.group);
  root.add(brain.group);

  const grid = new THREE.GridHelper(10, 20, 0xdccdb4, 0xeee5d5);
  grid.position.y = -1.46;
  grid.material.transparent = true;
  grid.material.opacity = 0.2;
  root.add(grid);

  const dust = new THREE.Group();
  const dustMat = new THREE.PointsMaterial({
    color: 0xc8a980,
    size: 0.018,
    transparent: true,
    opacity: 0.35,
    depthWrite: false
  });
  const dustGeo = new THREE.BufferGeometry();
  const positions = [];
  for (let i = 0; i < 180; i += 1) {
    positions.push((rand() - 0.5) * 9, (rand() - 0.5) * 4.4, -0.8 + rand() * 1.6);
  }
  dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  dust.add(new THREE.Points(dustGeo, dustMat));
  root.add(dust);

  let signalStep = 'inputs';

  function setTransmitter(transmitter) {
    const color = new THREE.Color(transmitter.color);
    neuron.particleMat.color.copy(color);
    neuron.particleMat.emissive.copy(color).multiplyScalar(0.16);
    Object.values(brain.regionGlows).forEach((glow) => {
      glow.visible = false;
      glow.material.color.copy(color);
      glow.material.emissive.copy(color).multiplyScalar(0.12);
      glow.material.opacity = 0.2;
    });
    transmitter.brainRegions.forEach((region) => {
      const glow = brain.regionGlows[region.id];
      if (glow) {
        glow.visible = true;
        glow.material.opacity = 0.96;
      }
    });
  }

  function setMode(mode) {
    brain.group.visible = mode === 'brain';
    neuron.group.visible = mode !== 'brain';
    neuron.dendrites.visible = mode !== 'synapse';
    neuron.somaGroup.visible = mode !== 'synapse';
    neuron.axonGroup.visible = mode !== 'brain';
    neuron.synapseGroup.visible = true;
    neuron.somaMesh.material.opacity = mode === 'isolate' ? 0.54 : 0.9;
    neuron.membrane.material.opacity = mode === 'isolate' ? 0.16 : 0.28;
    grid.visible = mode !== 'brain';
    dust.visible = true;
  }

  function setSignalStep(step) {
    signalStep = step;
  }

  function tick(time, releaseStart) {
    const phase = releaseStart ? Math.min(1, (time - releaseStart) / 1650) : 0;

    const spikeSteps = signalStep === 'spike' || signalStep === 'calcium';
    neuron.actionPulse.visible = spikeSteps;
    if (spikeSteps) {
      const t = ((time - releaseStart) / 2100) % 1;
      const p = neuron.axonCurve.getPoint(Math.max(0, Math.min(1, t)));
      neuron.actionPulse.position.copy(p);
      neuron.actionPulse.scale.setScalar(0.8 + Math.sin(time * 0.01) * 0.18);
    }

    const calciumActive = signalStep === 'calcium' || signalStep === 'release';
    neuron.calciumParticles.forEach((particle, index) => {
      particle.visible = calciumActive;
      if (!calciumActive) return;
      const orbit = time * 0.002 + particle.userData.seed * TAU;
      particle.position.x = -0.74 + Math.sin(orbit + index) * 0.08;
      particle.position.y = Math.cos(orbit * 1.2) * 0.24;
      particle.position.z = 0.16 + Math.sin(orbit * 0.8) * 0.12;
    });

    const transmitterVisible = signalStep === 'release' || signalStep === 'receptors' || signalStep === 'cleanup';
    neuron.particles.forEach((particle) => {
      particle.visible = transmitterVisible;
      if (!transmitterVisible) return;
      const local = (phase + particle.userData.seed) % 1;
      const x = -0.19 + local * 0.62;
      const envelope = Math.sin(local * Math.PI);
      particle.position.x = x;
      particle.position.y = Math.sin(local * TAU + particle.userData.offset) * 0.22 * envelope;
      particle.position.z = Math.cos(time * 0.0014 + particle.userData.offset) * 0.075 * envelope;
      const cleanupFade = signalStep === 'cleanup' ? 0.42 : 1;
      particle.scale.setScalar((0.72 + envelope * 0.9) * cleanupFade);
    });

    neuron.receptorHalo.material.opacity =
      signalStep === 'receptors' ? 0.55 + Math.sin(time * 0.006) * 0.18 :
      signalStep === 'cleanup' ? 0.18 :
      0;
    neuron.receptorHalo.scale.setScalar(signalStep === 'receptors' ? 1 + Math.sin(time * 0.004) * 0.08 : 1);

    Object.values(brain.regionGlows).forEach((glow) => {
      if (glow.visible) {
        const pulse = 1.05 + Math.sin(time * 0.003) * 0.18;
        glow.scale.setScalar(pulse);
      }
    });
    dust.rotation.y = time * 0.000035;
  }

  return { root, anchors, setTransmitter, setMode, setSignalStep, tick };
}
