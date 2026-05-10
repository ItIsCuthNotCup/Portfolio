// ─── Cosmic Engines · object viewer ─────────────────────────────────
// Smaller secondary canvas for the "Engine Room" browser. Swaps the
// procedural object out when the user picks a card. Uses a much
// smaller scene than the hero. Pauses when off-screen.
// ────────────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BUILDERS } from './procedural.js';
import { prefersReducedMotion } from './scroll.js';

const MODEL_BASE = '/assets/models/cosmic-engines/';

export function initViewer({ canvas, container, onReady }) {
  const reduced = prefersReducedMotion();

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x05060c, 1.0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 80);
  camera.position.set(0, 1.2, 6.5);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const k = new THREE.DirectionalLight(0xc8d4ff, 0.7);
  k.position.set(2, 3, 4);
  scene.add(k);
  const f = new THREE.DirectionalLight(0xff9a6c, 0.4);
  f.position.set(-3, -1, -2);
  scene.add(f);

  // Subtle ground gradient (a thin glow plane)
  const planeGeo = new THREE.PlaneGeometry(10, 10);
  const planeMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uColor: { value: new THREE.Color(0x4060a8) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; uniform vec3 uColor; void main(){ float d = distance(vUv, vec2(0.5)); float a = smoothstep(0.5, 0.0, d) * 0.3; gl_FragColor = vec4(uColor, a); }'
  });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -1.4;
  scene.add(plane);

  // OrbitControls — restricted
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 3.5;
  controls.maxDistance = 9;
  controls.minPolarAngle = Math.PI * 0.18;
  controls.maxPolarAngle = Math.PI * 0.78;
  controls.rotateSpeed = 0.7;
  if (reduced) controls.autoRotate = false;
  else { controls.autoRotate = true; controls.autoRotateSpeed = 0.6; }

  let currentObject = null;
  let currentId = null;

  function clearCurrent() {
    if (currentObject) {
      scene.remove(currentObject);
      currentObject.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material.dispose();
        }
      });
      currentObject = null;
    }
  }

  function buildProcedural(id) {
    const builder = BUILDERS[id];
    if (!builder) return null;
    return builder();
  }

  function setObject(id) {
    if (id === currentId) return;
    currentId = id;
    clearCurrent();

    // Try GLB first (decorative override). Procedural fallback if missing.
    const url = `${MODEL_BASE}${id}.glb`;
    const tryGlb = fetch(url, { method: 'HEAD' })
      .then((r) => (r.ok ? r : Promise.reject(new Error('no-glb'))))
      .catch(() => null);

    tryGlb.then((res) => {
      if (id !== currentId) return; // raced
      if (res && res.ok) {
        const loader = new GLTFLoader();
        loader.load(
          url,
          (gltf) => {
            if (id !== currentId) return;
            const root = gltf.scene;
            // Auto-fit roughly into a 2.5-unit cube
            const box = new THREE.Box3().setFromObject(root);
            const size = new THREE.Vector3();
            box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            root.scale.setScalar(2.5 / maxDim);
            const center = new THREE.Vector3();
            box.getCenter(center);
            root.position.sub(center.multiplyScalar(2.5 / maxDim));
            currentObject = root;
            scene.add(root);
            if (onReady) onReady(id, 'glb');
          },
          undefined,
          () => {
            // Fallback to procedural on decode error
            currentObject = buildProcedural(id);
            if (currentObject) scene.add(currentObject);
            if (onReady) onReady(id, 'procedural');
          }
        );
      } else {
        currentObject = buildProcedural(id);
        if (currentObject) scene.add(currentObject);
        if (onReady) onReady(id, 'procedural');
      }
    });
  }

  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w <= 0 || h <= 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  onResize();
  window.addEventListener('resize', onResize);

  let running = true;
  let last = performance.now();
  let tStart = last;

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const elapsed = (now - tStart) / 1000;
    controls.update();
    if (currentObject && currentObject.userData && currentObject.userData.tick && !reduced) {
      currentObject.userData.tick(dt, elapsed);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Pause when not visible
  const obs = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.target === container) {
        if (e.isIntersecting && !running) {
          running = true;
          last = performance.now();
          requestAnimationFrame(frame);
        } else if (!e.isIntersecting) {
          running = false;
        }
      }
    }
  }, { threshold: 0 });
  obs.observe(container);

  return {
    setObject,
    dispose() {
      running = false;
      controls.dispose();
      window.removeEventListener('resize', onResize);
      obs.disconnect();
      clearCurrent();
      renderer.dispose();
    }
  };
}
