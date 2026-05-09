// ─────────────────────────────────────────────────────────────
// Humanoid Robots Lab — entry point
// Wires the catalog, scene/viewer, selectors, panels, hotspots,
// lineup mode, comparison matrix, and sources together.
// Loaded as a <script type="module"> from index.html.
// ─────────────────────────────────────────────────────────────
import { loadCatalog, getRobot, getCompany, getPreviousGeneration, getFeaturedRobotForCompany } from './data.js';
import { initFromHash, getState, setState, subscribe } from './state.js';
import { createViewer } from './viewer.js';
import { renderCompanyPills, syncCompanyPills, renderGenerationTimeline } from './selectors.js';
import { renderDetailPanel } from './detail-panel.js';
import { renderDiffPanel } from './diff-panel.js';
import { renderHotspots } from './hotspots.js';
import { renderLineup } from './lineup.js';
import { renderMatrix } from './matrix.js';
import { renderSources } from './sources.js';

(async function boot() {
  let catalog;
  try {
    catalog = await loadCatalog();
  } catch (err) {
    console.error('Catalog failed to load', err);
    document.getElementById('hr-load-error')?.removeAttribute('hidden');
    return;
  }

  // ── Mounts ──
  const els = {
    pills:        document.getElementById('hr-company-pills'),
    timeline:     document.getElementById('hr-generation-timeline'),
    viewer:       document.getElementById('hr-viewer'),
    viewerStatus: document.getElementById('hr-viewer-status'),
    viewerSource: document.getElementById('hr-viewer-source'),
    detail:       document.getElementById('hr-detail-panel'),
    diff:         document.getElementById('hr-diff-panel'),
    hotspots:     document.getElementById('hr-hotspots-panel'),
    lineupCanvas: document.getElementById('hr-lineup-canvas'),
    lineupCaption:document.getElementById('hr-lineup-caption'),
    matrix:       document.getElementById('hr-matrix-section'),
    sources:      document.getElementById('hr-sources-section'),
    resetCamBtn:  document.getElementById('hr-reset-camera'),
    modeDetailBtn:document.getElementById('hr-mode-detail'),
    modeLineupBtn:document.getElementById('hr-mode-lineup'),
    detailPane:   document.getElementById('hr-detail-pane'),
    lineupPane:   document.getElementById('hr-lineup-pane'),
  };

  // ── Render the static sections (matrix, sources) once. They're catalog-
  // driven, not state-driven. ──
  renderMatrix(catalog,  els.matrix);
  renderSources(catalog, els.sources);

  // ── Pills are catalog-driven; sync the selected one on state change. ──
  renderCompanyPills(catalog, els.pills);

  // ── 3D viewer init ──
  const viewer = createViewer(els.viewer);
  viewer.onLoadingChange(loading => {
    if (els.viewerStatus) els.viewerStatus.textContent = loading ? 'Loading' : 'Ready';
  });
  viewer.onSourceChange(source => {
    if (!els.viewerSource) return;
    els.viewerSource.textContent = source === 'glb'
      ? 'Verified model'
      : 'Visual proxy (procedural)';
    els.viewerSource.dataset.kind = source;
  });

  // ── Lineup mode is created on demand to avoid spinning up a second
  // WebGL context when the user never clicks into it. ──
  let lineupHandle = null;
  function ensureLineup() {
    if (lineupHandle) return;
    lineupHandle = renderLineup(catalog, els.lineupCanvas, els.lineupCaption);
  }
  function teardownLineup() {
    if (!lineupHandle) return;
    lineupHandle.dispose();
    lineupHandle = null;
  }

  // ── Reactive bits: re-render on state change. ──
  subscribe((state) => {
    syncCompanyPills(els.pills);
    renderGenerationTimeline(catalog, els.timeline);

    const robot = getRobot(catalog, state.robotId);
    const prev  = getPreviousGeneration(catalog, robot);
    renderDetailPanel(robot, els.detail);
    renderDiffPanel(robot, prev, els.diff);
    renderHotspots(robot, els.hotspots);

    if (robot) viewer.setRobot(robot);

    // Mode toggle ── show / hide panes
    const isLineup = state.mode === 'lineup';
    els.detailPane?.toggleAttribute('hidden', isLineup);
    els.lineupPane?.toggleAttribute('hidden', !isLineup);
    els.modeDetailBtn?.classList.toggle('is-active', !isLineup);
    els.modeLineupBtn?.classList.toggle('is-active',  isLineup);
    els.modeDetailBtn?.setAttribute('aria-pressed', String(!isLineup));
    els.modeLineupBtn?.setAttribute('aria-pressed', String( isLineup));
    if (isLineup) ensureLineup();
    else teardownLineup();
  });

  // ── Mode buttons ──
  els.modeDetailBtn?.addEventListener('click', () => setState({ mode: 'detail' }));
  els.modeLineupBtn?.addEventListener('click', () => setState({ mode: 'lineup' }));
  els.resetCamBtn?.addEventListener('click',   () => viewer.resetCamera());

  // Keyboard: Esc returns to detail mode from lineup
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && getState().mode === 'lineup') {
      setState({ mode: 'detail' });
    }
  });

  // ── Initial state ──
  // Default to first company's featured robot if hash doesn't specify.
  const firstCompany = catalog.companies[0];
  const firstFeatured = getFeaturedRobotForCompany(catalog, firstCompany.id);
  initFromHash({
    companyId: firstCompany.id,
    robotId:   firstFeatured?.id || null,
    mode:      'detail',
  });

  // Cleanup on unload (mostly for the case where the user hits back to portfolio)
  window.addEventListener('beforeunload', () => {
    viewer.dispose();
    teardownLineup();
  });
})();
