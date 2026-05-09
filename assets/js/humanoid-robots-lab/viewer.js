// ─────────────────────────────────────────────────────────────
// Humanoid Robots Lab — viewer orchestrator
// Wraps a scene + a robot. Loads on robot change, disposes the previous
// robot, idle-rotates unless prefers-reduced-motion is set.
// ─────────────────────────────────────────────────────────────
import { createScene } from './scene.js';
import { loadOrFallback, disposeRobot } from './gltf-loader.js';
import { prefersReducedMotion } from './reduced-motion.js';

export function createViewer(container) {
  const scn = createScene(container, { lookHeight: 0.95, distance: 3.6 });

  let currentRobot = null;
  let currentRoot  = null;
  let loadingToken = 0;

  // Loading flag exposed for UI to show a skeleton.
  let onLoadingChangeFn = () => {};
  let onSourceChangeFn  = () => {};
  function onLoadingChange(fn) { onLoadingChangeFn = fn || (() => {}); }
  function onSourceChange(fn)  { onSourceChangeFn  = fn || (() => {}); }

  async function setRobot(robot) {
    if (!robot || robot === currentRobot) return;
    currentRobot = robot;

    const myToken = ++loadingToken;
    onLoadingChangeFn(true);

    // Tear down old robot first so memory stays flat across switches.
    if (currentRoot) {
      scn.scene.remove(currentRoot);
      disposeRobot(currentRoot);
      currentRoot = null;
    }

    const { root, source } = await loadOrFallback(robot, { lod: 'detail' });
    if (myToken !== loadingToken) {
      // A newer robot was selected mid-load. Dispose this orphan and bail.
      disposeRobot(root);
      return;
    }

    scn.scene.add(root);
    currentRoot = root;
    onSourceChangeFn(source);
    onLoadingChangeFn(false);

    // Auto-rotate unless the user prefers reduced motion.
    scn.setAutoRotate(!prefersReducedMotion());
  }

  function resetCamera() { scn.resetCamera(); }
  function dispose() {
    if (currentRoot) {
      scn.scene.remove(currentRoot);
      disposeRobot(currentRoot);
      currentRoot = null;
    }
    scn.dispose();
  }

  return {
    setRobot,
    resetCamera,
    dispose,
    onLoadingChange,
    onSourceChange,
  };
}
