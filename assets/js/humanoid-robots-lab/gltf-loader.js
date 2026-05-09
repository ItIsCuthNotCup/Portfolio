// ─────────────────────────────────────────────────────────────
// Humanoid Robots Lab — GLB loader with procedural fallback
// Probes the glbPath with a HEAD request before attempting to load the
// model. If verifiedModel is false OR the file 404s OR the load throws,
// returns the procedural proxy instead. Never surfaces a runtime error
// to the user.
// ─────────────────────────────────────────────────────────────
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { buildProceduralRobot, disposeRobot } from './procedural.js';

let _gltfLoader = null;
function getLoader() {
  if (_gltfLoader) return _gltfLoader;
  const loader = new GLTFLoader();
  // Decoders are pulled from the same jsdelivr CDN as Three.js itself.
  // Bandwidth-frugal — only fires when an actual GLB needs them.
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/');
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);
  _gltfLoader = loader;
  return loader;
}

// Returns: { root: THREE.Group, source: 'glb' | 'procedural' }
export async function loadOrFallback(robot, opts = {}) {
  const lod = opts.lod || 'detail';
  const profile = robot?.visualProfile || {};

  const buildFallback = (reason) => ({
    root: buildProceduralRobot({ profile, lod }),
    source: 'procedural',
    reason: reason || null,
  });

  if (!robot?.asset?.verifiedModel || !robot?.asset?.glbPath) {
    return buildFallback('not-verified');
  }

  // HEAD-check the URL so we don't trigger a noisy 404 in DevTools when the
  // GLB hasn't been dropped in yet.
  try {
    const head = await fetch(robot.asset.glbPath, { method: 'HEAD' });
    if (!head.ok) return buildFallback('missing');
  } catch {
    return buildFallback('head-failed');
  }

  return new Promise(resolve => {
    getLoader().load(
      robot.asset.glbPath,
      (gltf) => {
        const root = gltf.scene || (gltf.scenes && gltf.scenes[0]);
        if (!root) return resolve(buildFallback('empty-scene'));
        // Cast shadows on every mesh for the studio-light look.
        root.traverse(node => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = false;
          }
        });
        resolve({ root, source: 'glb' });
      },
      undefined,
      (err) => {
        console.warn('GLB load failed for', robot.id, err?.message || err);
        resolve(buildFallback('load-error'));
      },
    );
  });
}

export { disposeRobot };
