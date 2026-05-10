// ─── Cosmic Engines · post-processing ─────────────────────────────
// Composer pipeline shared by hero + viewer. Three passes:
//   1. RenderPass     — base scene render
//   2. UnrealBloomPass — selective blur on bright pixels (the cinematic
//      halo that turns flat emissive disks into glowing plasma)
//   3. OutputPass     — gamma-correct + tone-map back to display
// Falls back to plain renderer.render() if anything in the chain
// fails to import (older browsers, blocked CDN).
// ────────────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function makeComposer({ renderer, scene, camera, strength = 0.9, radius = 0.55, threshold = 0.18 }) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const size = new THREE.Vector2();
  renderer.getSize(size);
  const bloom = new UnrealBloomPass(size, strength, radius, threshold);
  composer.addPass(bloom);

  composer.addPass(new OutputPass());

  function setSize(w, h) {
    composer.setSize(w, h);
    bloom.setSize(w, h);
  }

  return {
    composer,
    bloom,
    setSize,
    render: () => composer.render(),
    dispose: () => composer.dispose(),
  };
}
