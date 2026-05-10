// ─── Cosmic Engines · hero scene ────────────────────────────────────
// Full-bleed sticky canvas with a procedural quasar engine. As the
// user scrolls through the hero spacer, camera arcs from far → into
// the disk → up the jet → back out. Reduced motion gets a still scene.
// ────────────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { buildQuasar } from './procedural.js';
import { makeScrollProgress, smoothstep, lerp, prefersReducedMotion } from './scroll.js';
import { makeComposer } from './postfx.js';

export function initHero({ canvas, container, labelEls = {} }) {
  const reduced = prefersReducedMotion();

  // Renderer
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
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05060c, 0.03);

  // Background gradient via a large inverted sphere
  const bgGeo = new THREE.SphereGeometry(40, 24, 16);
  const bgMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      cTop: { value: new THREE.Color(0x06081a) },
      cBot: { value: new THREE.Color(0x09040c) }
    },
    vertexShader: 'varying vec3 vWorld; void main(){ vWorld = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vWorld; uniform vec3 cTop; uniform vec3 cBot; void main(){ float t = clamp(0.5 + vWorld.y/40.0, 0.0, 1.0); gl_FragColor = vec4(mix(cBot, cTop, t), 1.0); }'
  });
  scene.add(new THREE.Mesh(bgGeo, bgMat));

  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.05, 200);
  camera.position.set(0, 0.6, 9);

  // Lights — minimal because most things are emissive
  const amb = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(amb);
  const key = new THREE.DirectionalLight(0xa6c0ff, 0.7);
  key.position.set(2, 3, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff9966, 0.45);
  rim.position.set(-3, -1, -2);
  scene.add(rim);

  // Quasar
  const quasar = buildQuasar();
  scene.add(quasar);

  // Post-processing pipeline (cinematic bloom). Wrapped in try so
  // older browsers / blocked CDNs fall back to plain renderer.render.
  let composer = null;
  try {
    composer = makeComposer({
      renderer, scene, camera,
      strength: 1.05, radius: 0.6, threshold: 0.16,
    });
  } catch (e) {
    console.warn('cosmic-engines hero: bloom unavailable, plain render fallback', e);
  }

  // Resize handling
  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (composer) composer.setSize(w, h);
  }
  onResize();
  window.addEventListener('resize', onResize);

  // Pointer interaction (very small drag offset to feel alive)
  let pointerX = 0, pointerY = 0;
  let pointerXTarget = 0, pointerYTarget = 0;
  let dragging = false, lastX = 0, lastY = 0;
  function onMove(e) {
    if (!dragging) return;
    const dx = (e.clientX - lastX) / window.innerWidth;
    const dy = (e.clientY - lastY) / window.innerHeight;
    pointerXTarget += dx * 1.4;
    pointerYTarget += dy * 0.8;
    pointerYTarget = Math.max(-0.6, Math.min(0.6, pointerYTarget));
    lastX = e.clientX;
    lastY = e.clientY;
  }
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointercancel', () => { dragging = false; });

  // Scroll progress (the hero container is taller than the viewport;
  // the canvas wrap is sticky inside it)
  const progress = makeScrollProgress(container);

  // Camera path keyed off scroll progress 0..1
  function cameraForProgress(p, lookOffset) {
    // Phase A (0..0.30): far view, arcs slowly to ~7
    // Phase B (0.30..0.55): swing around toward disk plane and dive in
    // Phase C (0.55..0.80): travel up the polar jet
    // Phase D (0.80..1.00): pull back and reveal whole system
    const a = smoothstep(0.0, 0.3, p);
    const b = smoothstep(0.3, 0.55, p);
    const c = smoothstep(0.55, 0.8, p);
    const d = smoothstep(0.8, 1.0, p);

    // Distance from origin
    const dist = lerp(9, 6, a) + lerp(0, -3.0, b) + lerp(0, 5.0, c) + lerp(0, 1.5, d);
    // Yaw rotation around the system
    const yaw = lerp(-0.0, 0.4, a) + lerp(0, 0.7, b) + lerp(0, 0.2, c) + lerp(0, 1.0, d);
    // Pitch (latitude). 0 = equator. +1 = pole.
    const pitch = lerp(0.18, 0.08, a) + lerp(0, -0.08, b) + lerp(0, 0.95, c) + lerp(0, -0.7, d);

    const r = Math.max(1.6, dist);
    const yawAdj = yaw + pointerX * 0.6;
    const pitchAdj = pitch + pointerY * 0.4;
    const camY = r * Math.sin(pitchAdj * (Math.PI / 2));
    const horiz = r * Math.cos(pitchAdj * (Math.PI / 2));
    camera.position.set(
      horiz * Math.cos(yawAdj),
      camY,
      horiz * Math.sin(yawAdj) + 0.001
    );

    // Look target — gently bias toward jet during phase C
    const targY = lerp(0, 1.6, c) + lookOffset;
    camera.lookAt(0, targY, 0);
  }

  // Labels (HTML overlays)
  const labelKeys = ['shadow', 'disk', 'jet', 'host', 'spectrum'];
  function labelOpacityForProgress(p) {
    // labels begin appearing at p ~ 0.45, peak ~ 0.7, fade by 0.95
    const target = smoothstep(0.45, 0.65, p) - smoothstep(0.92, 1.0, p);
    return Math.max(0, Math.min(1, target));
  }

  function setJet(p) {
    const intensity = 0.4 + 1.6 * smoothstep(0.4, 0.8, p);
    if (quasar.userData.setJetIntensity) {
      quasar.userData.setJetIntensity(intensity);
    }
  }

  // Render loop
  let last = performance.now();
  let tStart = last;
  let running = true;

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const elapsed = (now - tStart) / 1000;

    // Smooth pointer
    pointerX = lerp(pointerX, pointerXTarget, 0.07);
    pointerY = lerp(pointerY, pointerYTarget, 0.07);

    // Idle gentle decay so we always drift back toward neutral
    pointerXTarget *= 0.995;
    pointerYTarget *= 0.995;

    let p = progress();
    if (reduced) p = 0.18; // a calm framing

    cameraForProgress(p, 0);
    setJet(p);
    if (!reduced && quasar.userData.tick) quasar.userData.tick(dt, elapsed);

    // Update label opacities
    const op = labelOpacityForProgress(p);
    if (labelEls.shadow) labelEls.shadow.style.opacity = String(op * 0.95);
    if (labelEls.disk) labelEls.disk.style.opacity = String(op * 0.95);
    if (labelEls.jet) labelEls.jet.style.opacity = String(op * 0.95);
    if (labelEls.host) labelEls.host.style.opacity = String(op * 0.7);
    if (labelEls.spectrum) labelEls.spectrum.style.opacity = String(op * 0.7);

    // Title fade out as we descend into the disk
    const title = document.querySelector('.cosmic-hero-title');
    if (title) {
      const titleAlpha = 1 - smoothstep(0.05, 0.22, p);
      title.style.opacity = String(titleAlpha);
    }
    const hint = document.querySelector('.cosmic-hero-hint');
    if (hint) {
      hint.style.opacity = String(1 - smoothstep(0.0, 0.1, p));
    }

    if (composer) composer.render();
    else renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Pause when the hero leaves the viewport (saves battery on the
  // chapter sections below)
  let visible = true;
  const obs = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.target === container) {
        visible = e.isIntersecting;
        if (visible && !running) {
          running = true;
          last = performance.now();
          requestAnimationFrame(frame);
        } else if (!visible) {
          running = false;
        }
      }
    }
  }, { threshold: 0 });
  obs.observe(container);

  return {
    dispose() {
      running = false;
      window.removeEventListener('resize', onResize);
      obs.disconnect();
      renderer.dispose();
    }
  };
}
