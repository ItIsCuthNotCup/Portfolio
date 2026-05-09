// ─────────────────────────────────────────────────────────────
// Humanoid Robots Lab — lineup mode
// Single Three.js Canvas, all 10 featured robots in a row.
// Low-poly procedural proxies. Click a robot to switch to detail mode.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { createScene } from './scene.js';
import { buildProceduralRobot, disposeRobot } from './procedural.js';
import { getAllFeaturedRobots, parseHeightMeters } from './data.js';
import { setState } from './state.js';
import { escapeHtml } from './ui-helpers.js';

const SPACING_M = 1.6;
const DEFAULT_HEIGHT_M = 1.7;

export function renderLineup(catalog, container, captionMountEl) {
  if (!container) return null;

  // Wipe any prior canvas if re-rendering.
  while (container.firstChild) container.removeChild(container.firstChild);
  if (captionMountEl) captionMountEl.innerHTML = '';

  const featured = getAllFeaturedRobots(catalog);
  if (featured.length === 0) return null;

  const scn = createScene(container, { lookHeight: 0.85, distance: 6.5 });
  // Pull camera back / shift up to fit the full row of robots.
  scn.camera.position.set(0, 1.4, 11);
  scn.camera.fov = 26;
  scn.camera.updateProjectionMatrix();
  scn.controls.target.set(0, 0.85, 0);
  scn.controls.enableRotate = true;
  scn.controls.minPolarAngle = Math.PI * 0.32;
  scn.controls.maxPolarAngle = Math.PI * 0.55;
  scn.controls.minDistance = 7;
  scn.controls.maxDistance = 14;
  scn.controls.update();

  const groups = [];
  const startX = -((featured.length - 1) * SPACING_M) / 2;

  featured.forEach((robot, i) => {
    const group = buildProceduralRobot({
      profile: robot.visualProfile,
      lod: 'lineup',
      castShadow: true,
    });
    // Scale to relative real height (or default)
    const h = parseHeightMeters(robot.height) || DEFAULT_HEIGHT_M;
    const scale = h / 1.7;
    group.scale.setScalar(scale);
    group.position.set(startX + i * SPACING_M, 0, 0);
    group.userData.robotId = robot.id;
    scn.scene.add(group);
    groups.push(group);
  });

  // Click handling: raycast against the lineup groups.
  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const dom = scn.renderer.domElement;
  dom.style.cursor = 'pointer';
  dom.addEventListener('click', (e) => {
    const rect = dom.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width)  *  2 - 1;
    mouse.y = ((e.clientY - rect.top)  / rect.height) * -2 + 1;
    ray.setFromCamera(mouse, scn.camera);
    // Build flat list of children for raycast; map back to top-level group via userData
    const meshes = [];
    groups.forEach(g => g.traverse(n => { if (n.isMesh) meshes.push(n); }));
    const hits = ray.intersectObjects(meshes, false);
    if (hits.length === 0) return;
    let parent = hits[0].object;
    while (parent && !parent.userData?.robotId) parent = parent.parent;
    if (parent?.userData?.robotId) {
      setState({
        companyId: featured.find(r => r.id === parent.userData.robotId)?.companyId,
        robotId:   parent.userData.robotId,
        mode:      'detail',
      });
    }
  });

  // Caption strip below the canvas listing the robots in order.
  if (captionMountEl) {
    captionMountEl.innerHTML = `
      <div class="hr-lineup-caption-row">
        ${featured.map(r => `
          <button type="button" class="hr-lineup-chip" data-robot-id="${escapeHtml(r.id)}">
            <span class="hr-lineup-chip-name">${escapeHtml(r.companyName)}</span>
            <span class="hr-lineup-chip-gen">${escapeHtml(r.displayName)}</span>
          </button>
        `).join('')}
      </div>
      <p class="hr-lineup-scale-note">
        Relative scale is approximate; dimensions are based on public specs where available.
      </p>
    `;
    captionMountEl.querySelectorAll('.hr-lineup-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const id = chip.getAttribute('data-robot-id');
        const robot = featured.find(r => r.id === id);
        if (robot) {
          setState({ companyId: robot.companyId, robotId: robot.id, mode: 'detail' });
        }
      });
    });
  }

  // Returned handle so the page can dispose when leaving the section.
  return {
    dispose() {
      groups.forEach(g => { scn.scene.remove(g); disposeRobot(g); });
      scn.dispose();
    },
  };
}
