import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildAtlasScene } from './geometry.js?v=20';

const CAMERA_BY_MODE = {
  full: {
    position: new THREE.Vector3(0.08, 0.72, 19.0),
    target: new THREE.Vector3(0.08, 0.02, 0.02)
  },
  isolate: {
    position: new THREE.Vector3(-2.18, 0.72, 4.15),
    target: new THREE.Vector3(-2.12, 0.04, 0.03)
  },
  synapse: {
    position: new THREE.Vector3(5.12, 0.44, 4.15),
    target: new THREE.Vector3(5.14, 0.02, 0.02)
  },
  brain: {
    position: new THREE.Vector3(0.12, 0.16, 9.7),
    target: new THREE.Vector3(0.08, -0.01, 0.08)
  }
};

function canRenderWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (err) {
    return false;
  }
}

export function initAtlasScene({ canvas, shell, hotspotLayer, onHotspot, initialTransmitter }) {
  if (!canRenderWebGL()) {
    throw new Error('WebGL unavailable');
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setClearColor(0xfbf5e8, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xfbf5e8, 16, 30);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 80);
  camera.position.copy(CAMERA_BY_MODE.full.position);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xe7d3bd, 1.32));
  const key = new THREE.DirectionalLight(0xffffff, 2.05);
  key.position.set(-3.8, 4.8, 5.4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 18;
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -5;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xcfe8ff, 1.06);
  rim.position.set(4.2, 2.2, -4.6);
  scene.add(rim);
  const warm = new THREE.PointLight(0xffc777, 1.45, 9);
  warm.position.set(-2.2, 1.7, 2.2);
  scene.add(warm);
  const fill = new THREE.PointLight(0xf0b6d5, 0.62, 7);
  fill.position.set(2.9, -1.0, 2.2);
  scene.add(fill);

  const atlas = buildAtlasScene();
  scene.add(atlas.root);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.rotateSpeed = 0.68;
  controls.minDistance = 2.4;
  controls.maxDistance = 22;
  controls.target.copy(CAMERA_BY_MODE.full.target);
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.28;

  let mode = 'full';
  let targetPosition = CAMERA_BY_MODE.full.position.clone();
  let targetLook = CAMERA_BY_MODE.full.target.clone();
  let releaseStart = performance.now();
  let running = true;
  let cameraAnimating = true;
  let cameraTransitionStart = performance.now();
  let activeRegionIds = new Set(initialTransmitter ? initialTransmitter.brainRegions.map((region) => region.id) : []);
  const hotspotButtons = new Map();
  const scratch = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pickTargets = [];
  const pickMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false
  });
  let pointerDown = null;

  function cameraForMode(nextMode) {
    const config = CAMERA_BY_MODE[nextMode];
    const position = config.position.clone();
    const target = config.target.clone();
    const aspect = (shell.clientWidth || 1) / (shell.clientHeight || 1);
    if (nextMode === 'brain' && aspect < 0.95) {
      const narrowness = Math.min(1, (0.95 - aspect) / 0.32);
      position.x -= 0.05 * narrowness;
      position.z += 0.8 + 5.6 * narrowness;
      position.y += 0.08 * narrowness;
      target.x -= 0.14 * narrowness;
    }
    return { position, target };
  }

  function isAnchorActive(anchor) {
    const isMode = anchor.modes.includes(mode);
    const regionId = anchor.id.startsWith('region-') ? anchor.id.slice(7) : null;
    const isActiveRegion = !regionId || activeRegionIds.has(regionId);
    return isMode && isActiveRegion;
  }

  function pickRadius(anchor) {
    if (anchor.id === 'dendrites') return 0.55;
    if (anchor.id === 'soma') return 0.38;
    if (anchor.id === 'axon' || anchor.id === 'myelin') return 0.34;
    if (anchor.id === 'terminal' || anchor.id === 'synapse') return 0.34;
    if (anchor.id === 'vesicles' || anchor.id === 'receptors') return 0.28;
    if (anchor.id.startsWith('region-')) return 0.16;
    return 0.26;
  }

  function makePickTargets() {
    atlas.anchors.forEach((anchor) => {
      const target = new THREE.Mesh(new THREE.SphereGeometry(pickRadius(anchor), 12, 12), pickMaterial);
      target.name = `pick-${anchor.id}`;
      target.userData.anchor = anchor;
      target.visible = false;
      anchor.object.add(target);
      pickTargets.push(target);
    });
  }

  function updatePickTargets() {
    pickTargets.forEach((target) => {
      target.visible = isAnchorActive(target.userData.anchor);
    });
  }

  function setPointerFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  }

  function pickAnchor(event) {
    setPointerFromEvent(event);
    updatePickTargets();
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickTargets, false);
    return hits.find((hit) => hit.object.visible)?.object.userData.anchor || null;
  }

  function onPointerDown(event) {
    pointerDown = { x: event.clientX, y: event.clientY };
  }

  function onPointerMove(event) {
    if (event.pointerType === 'touch') return;
    canvas.style.cursor = pickAnchor(event) ? 'pointer' : 'grab';
  }

  function onCanvasClick(event) {
    if (pointerDown) {
      const distance = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
      if (distance > 8) return;
    }
    const anchor = pickAnchor(event);
    if (anchor && onHotspot) onHotspot(anchor);
  }

  function makeHotspots() {
    if (!hotspotLayer) return;
    hotspotLayer.innerHTML = '';
    atlas.anchors.forEach((anchor) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ntx-hotspot';
      button.setAttribute('data-hotspot', anchor.id);
      button.setAttribute('aria-label', anchor.label);
      button.setAttribute('aria-hidden', 'true');
      button.tabIndex = -1;
      button.innerHTML = `<span></span><strong>${anchor.label}</strong>`;
      button.addEventListener('click', () => {
        if (onHotspot) onHotspot(anchor);
      });
      hotspotLayer.appendChild(button);
      hotspotButtons.set(anchor.id, button);
    });
  }

  function updateHotspots() {
    if (!hotspotLayer) return;
    const rect = shell.getBoundingClientRect();
    atlas.anchors.forEach((anchor) => {
      const button = hotspotButtons.get(anchor.id);
      if (!button) return;
      if (!isAnchorActive(anchor)) {
        button.classList.remove('is-visible');
        button.setAttribute('aria-hidden', 'true');
        button.tabIndex = -1;
        return;
      }
      anchor.object.getWorldPosition(scratch);
      scratch.project(camera);
      const visible = scratch.z > -1 && scratch.z < 1 && Math.abs(scratch.x) < 0.98 && Math.abs(scratch.y) < 0.98;
      if (!visible) {
        button.classList.remove('is-visible');
        button.setAttribute('aria-hidden', 'true');
        button.tabIndex = -1;
        return;
      }
      const x = Math.round((scratch.x * 0.5 + 0.5) * rect.width * 10) / 10;
      const y = Math.round((-scratch.y * 0.5 + 0.5) * rect.height * 10) / 10;
      const dx = x > rect.width - 160 ? '-100%' : '0';
      const dy = y > rect.height - 60 ? '-100%' : '0';
      const transform = `translate(${x}px, ${y}px) translate(${dx}, ${dy})`;
      if (button.style.transform !== transform) button.style.transform = transform;
      button.classList.add('is-visible');
      button.setAttribute('aria-hidden', 'false');
      button.tabIndex = 0;
    });
  }

  function setMode(nextMode) {
    mode = nextMode;
    atlas.setMode(mode);
    const cameraConfig = cameraForMode(mode);
    targetPosition = cameraConfig.position;
    targetLook = cameraConfig.target;
    cameraAnimating = true;
    cameraTransitionStart = performance.now();
    controls.minDistance = mode === 'synapse' ? 1.4 : 2.4;
    controls.maxDistance = mode === 'synapse' ? 4.6 : 22;
    controls.autoRotate = false;
    updatePickTargets();
    updateHotspots();
  }

  function setTransmitter(transmitter) {
    activeRegionIds = new Set(transmitter.brainRegions.map((region) => region.id));
    atlas.setTransmitter(transmitter);
    releaseStart = performance.now();
    updatePickTargets();
  }

  function pulseRelease() {
    releaseStart = performance.now();
  }

  function setSignalStep(step) {
    atlas.setSignalStep(step);
    releaseStart = performance.now();
  }

  function resetView() {
    const config = cameraForMode(mode);
    targetPosition = config.position;
    targetLook = config.target;
    cameraAnimating = true;
    cameraTransitionStart = performance.now();
    releaseStart = performance.now();
  }

  function onResize() {
    const w = shell.clientWidth || 1;
    const h = shell.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (mode === 'brain') {
      const cameraConfig = cameraForMode(mode);
      targetPosition = cameraConfig.position;
      targetLook = cameraConfig.target;
      cameraAnimating = true;
      cameraTransitionStart = performance.now();
    }
    updateHotspots();
  }

  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
  if (resizeObserver) resizeObserver.observe(shell);
  window.addEventListener('resize', onResize);
  onResize();
  makePickTargets();
  makeHotspots();
  atlas.setMode(mode);
  if (initialTransmitter) atlas.setTransmitter(initialTransmitter);
  updatePickTargets();
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('click', onCanvasClick);

  function frame(now) {
    if (!running) return;
    if (cameraAnimating) {
      camera.position.lerp(targetPosition, 0.1);
      controls.target.lerp(targetLook, 0.12);
      if (
        now - cameraTransitionStart > 1900 ||
        (camera.position.distanceToSquared(targetPosition) < 0.0016 && controls.target.distanceToSquared(targetLook) < 0.0016)
      ) {
        camera.position.copy(targetPosition);
        controls.target.copy(targetLook);
        cameraAnimating = false;
      }
    }
    controls.update();
    atlas.tick(now, releaseStart);
    renderer.render(scene, camera);
    updateHotspots();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  const visibilityObserver = new IntersectionObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;
    if (entry.isIntersecting && !running) {
      running = true;
      requestAnimationFrame(frame);
    } else if (!entry.isIntersecting) {
      running = false;
    }
  }, { threshold: 0 });
  visibilityObserver.observe(shell);

  return {
    setMode,
    setTransmitter,
    setSignalStep,
    pulseRelease,
    resetView,
    dispose() {
      running = false;
      controls.dispose();
      visibilityObserver.disconnect();
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('click', onCanvasClick);
      renderer.dispose();
    }
  };
}
