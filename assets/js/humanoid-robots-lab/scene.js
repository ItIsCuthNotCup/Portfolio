// ─────────────────────────────────────────────────────────────
// Humanoid Robots Lab — Three.js scene factory
// One Canvas, one renderer, one OrbitControls. Studio lighting + a soft
// contact-shadow plane. No env map, no post-processing — keeps the page
// snappy on a MacBook Air.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const MAX_DPR = 1.5;

export function createScene(container, opts = {}) {
  const { lookHeight = 1.0, distance = 3.4 } = opts;

  // Renderer ──
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', '3D humanoid robot viewer');

  // Scene ──
  const scene = new THREE.Scene();
  scene.background = null; // page CSS provides white

  // Camera ──
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
  camera.position.set(0, lookHeight + 0.3, distance);
  camera.lookAt(0, lookHeight, 0);

  // Lights ──
  // Editorial product lighting: bright key from upper-front, softer fill from
  // the opposite side, low ambient to lift shadows.
  const ambient = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(2.5, 4.0, 3.0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 12;
  key.shadow.camera.left = -2;
  key.shadow.camera.right = 2;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -0.5;
  key.shadow.bias = -0.0005;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, 0.45);
  fill.position.set(-3.0, 2.5, -1.5);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.3);
  rim.position.set(0, 2.0, -3.5);
  scene.add(rim);

  // Soft contact shadow plane ──
  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.18 });
  const shadowGeo = new THREE.PlaneGeometry(8, 8);
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.001;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  // Subtle ground gradient (a flat circle) — gives the robot something to sit
  // on visually without an env map.
  const groundGeo = new THREE.CircleGeometry(2.6, 64);
  const groundMat = new THREE.MeshBasicMaterial({
    color: 0xeeeeee, transparent: true, opacity: 0.55,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.0005;
  scene.add(ground);

  // Controls ──
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, lookHeight, 0);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 1.8;
  controls.maxDistance = 5.5;
  controls.minPolarAngle = Math.PI * 0.2;
  controls.maxPolarAngle = Math.PI * 0.62;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.6;
  controls.update();

  // Resize ──
  let raf = 0;
  function fitToContainer() {
    const r = container.getBoundingClientRect();
    const w = Math.max(1, Math.floor(r.width));
    const h = Math.max(1, Math.floor(r.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  fitToContainer();
  const ro = new ResizeObserver(() => fitToContainer());
  ro.observe(container);

  // Render loop ──
  let running = true;
  function render() {
    if (!running) return;
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(render);
  }
  raf = requestAnimationFrame(render);

  // Stop when the canvas leaves the viewport (back button etc.) and resume on
  // re-entry. Saves battery and keeps the page snappy.
  const io = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting && !running) {
        running = true;
        raf = requestAnimationFrame(render);
      } else if (!entry.isIntersecting && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    }
  }, { threshold: 0 });
  io.observe(container);

  function dispose() {
    running = false;
    cancelAnimationFrame(raf);
    io.disconnect();
    ro.disconnect();
    controls.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  }

  function resetCamera() {
    camera.position.set(0, lookHeight + 0.3, distance);
    controls.target.set(0, lookHeight, 0);
    controls.update();
  }

  function setAutoRotate(on) {
    controls.autoRotate = !!on;
  }

  return {
    renderer, scene, camera, controls,
    fitToContainer, dispose, resetCamera, setAutoRotate,
  };
}
