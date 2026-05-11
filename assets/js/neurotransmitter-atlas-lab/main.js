import {
  CHECK_YOURSELF,
  CHAPTER_OBJECTIVES,
  CORE_RULES,
  GLOSSARY,
  MISCONCEPTIONS,
  METHOD_SOURCES,
  RECEPTOR_COMPARISON,
  SIGNAL_STEPS,
  STRUCTURES,
  TRANSMITTERS
} from './data.js?v=20';
import { initAtlasScene } from './scene.js?v=20';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const byId = Object.fromEntries(TRANSMITTERS.map((item) => [item.id, item]));
const byStructureId = Object.fromEntries(STRUCTURES.map((item) => [item.id, item]));
const byStepId = Object.fromEntries(SIGNAL_STEPS.map((item) => [item.id, item]));
const HOTSPOT_DESTINATIONS = {
  dendrites: { mode: 'full', section: 'structures', structureId: 'dendrites', step: 'inputs' },
  soma: { mode: 'isolate', section: 'structures', structureId: 'soma', step: 'inputs' },
  axon: { mode: 'full', section: 'structures', structureId: 'axon', step: 'spike' },
  myelin: { mode: 'full', section: 'structures', structureId: 'myelin', step: 'spike' },
  terminal: { mode: 'synapse', section: 'structures', structureId: 'terminal', step: 'calcium' },
  vesicles: { mode: 'synapse', section: 'structures', structureId: 'vesicles', step: 'release' },
  receptors: { mode: 'synapse', section: 'receptors', step: 'receptors' },
  synapse: { mode: 'synapse', section: 'sequence', step: 'release' }
};
let selected = TRANSMITTERS[0];
let sceneApi = null;
let selectedStep = SIGNAL_STEPS[0];
let pinnedAnchor = null;

function sourceLinks(sources) {
  return sources
    .map((source) => `<a href="${source.url}" target="_blank" rel="noopener noreferrer">${source.label} <span aria-hidden="true">&rarr;</span></a>`)
    .join('');
}

function regionPills(transmitter) {
  return transmitter.brainRegions
    .map((region) => `<span class="ntx-region-pill">${region.label}</span>`)
    .join('');
}

function updateDetail(transmitter) {
  selected = transmitter;
  const title = $('#ntx-detail-title');
  const type = $('#ntx-detail-type');
  const action = $('#ntx-detail-action');
  const effect = $('#ntx-detail-effect');
  const regions = $('#ntx-detail-regions');
  const mechanism = $('#ntx-detail-mechanism');
  const limits = $('#ntx-detail-limits');
  const sources = $('#ntx-detail-sources');
  const swatch = $('#ntx-active-swatch');
  const frame = $('#ntx-detail-frame');
  const trap = $('#ntx-detail-trap');
  const check = $('#ntx-detail-check');

  if (title) title.textContent = transmitter.label;
  if (type) type.textContent = transmitter.type;
  if (action) action.textContent = transmitter.primaryAction;
  if (effect) effect.textContent = transmitter.effectSummary;
  if (regions) regions.innerHTML = regionPills(transmitter);
  if (mechanism) mechanism.textContent = transmitter.synapseMechanism;
  if (limits) limits.textContent = transmitter.limits;
  if (sources) sources.innerHTML = sourceLinks(transmitter.sources);
  if (swatch) swatch.style.background = transmitter.color;
  if (frame) frame.textContent = transmitter.readerFrame;
  if (trap) trap.textContent = transmitter.commonTrap;
  if (check) check.textContent = transmitter.selfCheck;

  $$('.ntx-transmitter-button').forEach((button) => {
    const active = button.dataset.transmitter === transmitter.id;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  if (sceneApi) sceneApi.setTransmitter(transmitter);
}

function scrollToElement(element, block = 'start') {
  if (!element) return;
  element.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block
  });
}

function anchorDestination(anchor) {
  if (!anchor) return {};
  if (anchor.id?.startsWith('region-')) {
    return {
      mode: 'brain',
      section: 'systems',
      primaryLabel: 'Open transmitter note',
      secondaryLabel: 'Show brain map'
    };
  }
  const fallback = anchor.modes?.includes('synapse') ? 'synapse' : 'full';
  return {
    mode: fallback,
    section: 'structures',
    primaryLabel: 'Open chapter note',
    secondaryLabel: 'Show in 3D',
    ...(HOTSPOT_DESTINATIONS[anchor.id] || {})
  };
}

function enrichedAnchor(anchor) {
  if (!anchor?.id?.startsWith('region-')) return anchor;
  const regionId = anchor.id.slice(7);
  const region = selected.brainRegions.find((item) => item.id === regionId);
  if (!region) return anchor;
  return {
    ...anchor,
    summary: region.note,
    source: `${selected.label} system`
  };
}

function highlightStructure(structureId) {
  if (!structureId) return;
  const card = $(`#structure-${structureId}`);
  if (!card) return;
  $$('.ntx-structure-card.is-highlighted').forEach((item) => item.classList.remove('is-highlighted'));
  card.classList.add('is-highlighted');
  window.setTimeout(() => card.classList.remove('is-highlighted'), 2600);
}

function setActiveFlow(flowId) {
  $$('.ntx-reader-flow button').forEach((button) => {
    const active = button.dataset.flow === flowId;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function setMode(mode) {
  const modeButton = $(`.ntx-mode-button[data-mode="${mode}"]`);
  $$('.ntx-mode-button').forEach((other) => {
    const active = other === modeButton;
    other.classList.toggle('is-active', active);
    other.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  const label = $('#ntx-mode-label');
  if (label && modeButton) label.textContent = modeButton.querySelector('span')?.textContent || mode;
  if (sceneApi) sceneApi.setMode(mode);
}

function setSignalStep(step) {
  selectedStep = step;
  const stepTitle = $('#ntx-step-title');
  const stepBody = $('#ntx-step-body');
  const stepVisual = $('#ntx-step-visual');
  const stepSource = $('#ntx-step-source');
  if (stepTitle) stepTitle.textContent = step.title;
  if (stepBody) stepBody.textContent = step.body;
  if (stepVisual) stepVisual.textContent = step.visual;
  if (stepSource) stepSource.textContent = step.source;

  $$('.ntx-step-button').forEach((button) => {
    const active = button.dataset.step === step.id;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  setMode(step.mode);
  if (sceneApi) {
    sceneApi.setSignalStep(step.id);
    if (step.id === 'release' || step.id === 'cleanup') sceneApi.pulseRelease();
  }
}

function renderTransmitterButtons() {
  const wrap = $('#ntx-transmitter-list');
  if (!wrap) return;
  wrap.innerHTML = TRANSMITTERS.map((transmitter) => `
    <button class="ntx-transmitter-button" type="button" data-transmitter="${transmitter.id}" aria-pressed="false">
      <span class="ntx-button-swatch" style="background:${transmitter.color}"></span>
      <span>
        <strong>${transmitter.label}</strong>
        <em>${transmitter.primaryAction}</em>
      </span>
    </button>
  `).join('');

  $$('.ntx-transmitter-button', wrap).forEach((button) => {
    button.addEventListener('click', () => {
      const transmitter = byId[button.dataset.transmitter];
      if (!transmitter) return;
      updateDetail(transmitter);
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', `#transmitter=${transmitter.id}`);
      }
    });
  });
}

function renderChapterObjectives() {
  const wrap = $('#ntx-objectives');
  if (!wrap) return;
  wrap.innerHTML = CHAPTER_OBJECTIVES.map((item, index) => `
    <li style="--i:${index}">
      <span>${String(index + 1).padStart(2, '0')}</span>
      <strong>${item.label}</strong>
      <em>${item.text}</em>
    </li>
  `).join('');
}

function renderCoreRules() {
  const wrap = $('#ntx-core-rules');
  if (!wrap) return;
  wrap.innerHTML = CORE_RULES.map((rule, index) => `
    <article class="ntx-core-rule" style="--i:${index}">
      <span class="ntx-card-kicker">${rule.label}</span>
      <h3>${rule.title}</h3>
      <p>${rule.body}</p>
      <em>${rule.cue}</em>
    </article>
  `).join('');
}

function renderSignalSteps() {
  const wrap = $('#ntx-step-buttons');
  if (!wrap) return;
  wrap.innerHTML = SIGNAL_STEPS.map((step, index) => `
    <button class="ntx-step-button" type="button" data-step="${step.id}" aria-pressed="false" style="--i:${index}">
      <span>${String(index + 1).padStart(2, '0')}</span>
      <strong>${step.label}</strong>
      <em>${step.shortLabel}</em>
    </button>
  `).join('');

  $$('.ntx-step-button', wrap).forEach((button) => {
    button.addEventListener('click', () => {
      const step = SIGNAL_STEPS.find((item) => item.id === button.dataset.step);
      if (!step) return;
      setSignalStep(step);
      document.querySelector('#atlas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function renderStructureCards() {
  const wrap = $('#ntx-structure-grid');
  if (!wrap) return;
  wrap.innerHTML = STRUCTURES.map((structure) => `
    <article class="ntx-structure-card" id="structure-${structure.id}" data-structure="${structure.id}">
      <span class="ntx-card-kicker">${structure.source}</span>
      <h3>${structure.label}</h3>
      <p>${structure.summary}</p>
      <button class="ntx-card-action" type="button" data-focus-structure="${structure.id}">Show on specimen</button>
    </article>
  `).join('');
}

function renderTransmitterMatrix() {
  const body = $('#ntx-matrix-body');
  if (!body) return;
  body.innerHTML = TRANSMITTERS.map((transmitter) => `
    <tr>
      <th scope="row"><span style="--dot:${transmitter.color}"></span>${transmitter.label}</th>
      <td>${transmitter.type}</td>
      <td>${transmitter.primaryAction}</td>
      <td>${transmitter.brainRegions.map((region) => region.label).join(', ')}</td>
      <td>${transmitter.synapseMechanism}</td>
    </tr>
  `).join('');
}

function renderReceptorComparison() {
  const body = $('#ntx-receptor-body');
  if (!body) return;
  body.innerHTML = RECEPTOR_COMPARISON.map((row) => `
    <tr>
      <th scope="row">${row.axis}</th>
      <td>${row.tempo}</td>
      <td>${row.mechanism}</td>
      <td>${row.example}</td>
      <td>${row.takeaway}</td>
    </tr>
  `).join('');
}

function renderGlossary() {
  const wrap = $('#ntx-glossary-list');
  if (!wrap) return;
  wrap.innerHTML = GLOSSARY.map(([term, definition]) => `
    <div class="ntx-glossary-item">
      <dt>${term}</dt>
      <dd>${definition}</dd>
    </div>
  `).join('');
}

function renderMisconceptions() {
  const wrap = $('#ntx-misconceptions');
  if (!wrap) return;
  wrap.innerHTML = MISCONCEPTIONS.map((item) => `
    <article class="ntx-myth-card">
      <span class="ntx-card-kicker">Misconception</span>
      <h3>${item.myth}</h3>
      <p>${item.correction}</p>
    </article>
  `).join('');
}

function renderChecks() {
  const wrap = $('#ntx-checks');
  if (!wrap) return;
  wrap.innerHTML = CHECK_YOURSELF.map((item, index) => `
    <details class="ntx-check-card">
      <summary><span>${String(index + 1).padStart(2, '0')}</span>${item.prompt}</summary>
      <p>${item.answer}</p>
    </details>
  `).join('');
}

function renderMethodSources() {
  const list = $('#ntx-method-sources');
  if (!list) return;
  list.innerHTML = METHOD_SOURCES.map((source) => `
    <li><a href="${source.url}" target="_blank" rel="noopener noreferrer">${source.label} <span aria-hidden="true">&rarr;</span></a></li>
  `).join('');
}

function updateHotspotPanel(anchor, options = {}) {
  const note = enrichedAnchor(anchor);
  const title = $('#ntx-hotspot-title');
  const summary = $('#ntx-hotspot-summary');
  const source = $('#ntx-hotspot-source');
  if (title) title.textContent = note.label;
  if (summary) summary.textContent = note.summary;
  if (source) source.textContent = note.source;
  if (options.open) openInspector(note);
}

function makeStructureAnchor(structureId) {
  const structure = byStructureId[structureId];
  if (!structure) return null;
  return {
    id: structure.id,
    label: structure.label,
    summary: structure.summary,
    source: structure.source,
    modes: [structure.mode || anchorDestination({ id: structure.id }).mode || 'full']
  };
}

function openInspector(anchor) {
  const inspector = $('#ntx-inspector');
  if (!inspector) return;
  const note = enrichedAnchor(anchor);
  const destination = anchorDestination(note);
  pinnedAnchor = note;

  $('#ntx-inspector-title').textContent = note.label;
  $('#ntx-inspector-summary').textContent = note.summary;
  $('#ntx-inspector-source').textContent = note.source;
  $('#ntx-inspector-primary').textContent = destination.structureId ? 'Open structure card' : destination.primaryLabel || 'Open chapter note';
  $('#ntx-inspector-secondary').textContent = destination.secondaryLabel || 'Show in 3D';

  inspector.hidden = false;
  inspector.setAttribute('aria-hidden', 'false');
  document.body.classList.add('ntx-inspector-open');
  requestAnimationFrame(() => inspector.classList.add('is-open'));
}

function closeInspector() {
  const inspector = $('#ntx-inspector');
  if (!inspector) return;
  inspector.classList.remove('is-open');
  inspector.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('ntx-inspector-open');
  window.setTimeout(() => {
    if (!inspector.classList.contains('is-open')) inspector.hidden = true;
  }, 220);
}

function showAnchorIn3D(anchor) {
  const destination = anchorDestination(anchor);
  setMode(destination.mode || 'full');
  scrollToElement($('#atlas'));
}

function openAnchorChapter(anchor) {
  const destination = anchorDestination(anchor);
  const step = destination.step ? byStepId[destination.step] : null;
  if (step) setSignalStep(step);

  if (destination.structureId) {
    const card = $(`#structure-${destination.structureId}`);
    scrollToElement(card, 'center');
    highlightStructure(destination.structureId);
  } else if (destination.section) {
    scrollToElement($(`#${destination.section}`));
  }

  if (step && destination.structureId) {
    selectedStep = step;
    $$('.ntx-step-button').forEach((button) => {
      const active = button.dataset.step === step.id;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  closeInspector();
}

function wireModes() {
  $$('.ntx-mode-button').forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.dataset.mode || 'full';
      setMode(mode);
    });
  });
}

function wireReaderFlow() {
  const actions = {
    specimen() {
      setActiveFlow('specimen');
      setMode('full');
      scrollToElement($('#atlas'));
    },
    model() {
      setActiveFlow('model');
      scrollToElement($('#core-model'));
    },
    structures() {
      setActiveFlow('structures');
      scrollToElement($('#structures'));
    },
    signal() {
      setActiveFlow('signal');
      setSignalStep(byStepId.inputs);
      scrollToElement($('#sequence'));
    },
    brain() {
      setActiveFlow('brain');
      setMode('brain');
      scrollToElement($('#atlas'));
    }
  };

  $$('.ntx-reader-flow button').forEach((button) => {
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      const action = actions[button.dataset.flow];
      if (action) action();
    });
  });
}

function wireStructureActions() {
  $$('[data-focus-structure]').forEach((button) => {
    button.addEventListener('click', () => {
      const anchor = makeStructureAnchor(button.dataset.focusStructure);
      if (!anchor) return;
      updateHotspotPanel(anchor, { open: true });
      showAnchorIn3D(anchor);
    });
  });
}

function wireInspector() {
  $('#ntx-inspector-close')?.addEventListener('click', closeInspector);
  $('#ntx-inspector-primary')?.addEventListener('click', () => {
    if (pinnedAnchor) openAnchorChapter(pinnedAnchor);
  });
  $('#ntx-inspector-secondary')?.addEventListener('click', () => {
    if (pinnedAnchor) showAnchorIn3D(pinnedAnchor);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeInspector();
  });
}

function bootScene() {
  const canvas = $('#ntx-canvas');
  const shell = $('#ntx-canvas-shell');
  const hotspots = $('#ntx-hotspots');
  const fallback = $('#ntx-webgl-fallback');
  if (!canvas || !shell) return;

  try {
    sceneApi = initAtlasScene({
      canvas,
      shell,
      hotspotLayer: hotspots,
      initialTransmitter: selected,
      onHotspot: (anchor) => updateHotspotPanel(anchor, { open: true })
    });
    updateDetail(selected);
    setSignalStep(selectedStep);
  } catch (err) {
    console.warn('neurotransmitter-atlas scene failed:', err);
    if (fallback) fallback.classList.add('is-visible');
  }
}

function wireUtilityButtons() {
  const release = $('#ntx-release-button');
  const reset = $('#ntx-reset-button');
  if (release) {
    release.addEventListener('click', () => {
      if (sceneApi) sceneApi.pulseRelease();
    });
  }
  if (reset) {
    reset.addEventListener('click', () => {
      if (sceneApi) sceneApi.resetView();
    });
  }
}

function setDateline() {
  const filed = $('#ntx-dateline-time');
  if (!filed) return;
  filed.textContent = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC'
  }) + ' UTC';
}

function selectedFromHash() {
  const match = window.location.hash.match(/transmitter=([a-z-]+)/);
  if (!match) return TRANSMITTERS[0];
  return byId[match[1]] || TRANSMITTERS[0];
}

function init() {
  selected = selectedFromHash();
  selectedStep = SIGNAL_STEPS[0];
  renderTransmitterButtons();
  renderChapterObjectives();
  renderCoreRules();
  renderSignalSteps();
  renderStructureCards();
  renderTransmitterMatrix();
  renderReceptorComparison();
  renderGlossary();
  renderMisconceptions();
  renderChecks();
  renderMethodSources();
  wireModes();
  wireReaderFlow();
  wireStructureActions();
  wireInspector();
  wireUtilityButtons();
  setDateline();
  updateDetail(selected);
  updateHotspotPanel({
    label: 'Interactive hotspot',
    summary: 'Click a label or a 3D anchor on the specimen to pin an anatomical note here.',
    source: 'Atlas UI'
  });
  setSignalStep(selectedStep);
  bootScene();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
