// ─────────────────────────────────────────────────────────────
// Humanoid Robots Lab — body-region hotspot buttons
// Conceptual rather than mesh-pinned (more robust + accessible).
// Click swaps the readout text to a per-region snippet.
// ─────────────────────────────────────────────────────────────
import { escapeHtml } from './ui-helpers.js';

const REGIONS = [
  { id: 'head',         label: 'Head / perception',      key: 'aiSystem',         fallback: 'Cameras, microphones, sensors. The robot\'s face on the world.' },
  { id: 'hands',        label: 'Hands / manipulation',   key: 'degreesOfFreedom', fallback: 'Where dexterity lives. More DoF means finer manipulation.' },
  { id: 'torso',        label: 'Torso / compute + battery', key: 'runtime',       fallback: 'Compute and battery sit in the chest. Runtime is a system constraint, not a chip spec.' },
  { id: 'legs',         label: 'Legs / mobility',        key: 'speed',            fallback: 'Walking speed and stability set what the robot can actually go fetch.' },
  { id: 'safety',       label: 'Safety / interaction',   key: 'status',           fallback: 'Soft surfaces, force-limited actuation, deployment posture.' },
  { id: 'deployment',   label: 'Deployment / use case',  key: 'targetEnvironment',fallback: 'Where this generation is actually being put to work.' },
];

export function renderHotspots(robot, mountEl) {
  if (!mountEl) return;
  if (!robot) { mountEl.innerHTML = ''; return; }

  mountEl.innerHTML = `
    <div class="hr-hotspots-head">
      <h3 class="hr-block-title">Tour the body</h3>
      <p class="hr-block-sub">Hotspots are conceptual; click any region to read what the catalog actually discloses for it.</p>
    </div>
    <div class="hr-hotspots-grid">
      ${REGIONS.map(r => `
        <button type="button" class="hr-hotspot" data-region="${escapeHtml(r.id)}" aria-pressed="false">
          <span class="hr-hotspot-dot"></span>
          <span class="hr-hotspot-label">${escapeHtml(r.label)}</span>
        </button>
      `).join('')}
    </div>
    <div class="hr-hotspot-readout" id="hr-hotspot-readout" role="region" aria-live="polite">
      <p class="hr-na">Pick a region to read what the catalog discloses.</p>
    </div>
  `;

  const readout = mountEl.querySelector('#hr-hotspot-readout');
  mountEl.querySelectorAll('.hr-hotspot').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-region');
      mountEl.querySelectorAll('.hr-hotspot').forEach(b => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      const region = REGIONS.find(r => r.id === id);
      if (!region) return;
      const spec = robot[region.key];
      const value = spec?.value || region.fallback;
      const conf = spec?.confidence || 'unknown';
      readout.innerHTML = `
        <div class="hr-hotspot-readout-title">${escapeHtml(region.label)}</div>
        <p class="hr-hotspot-readout-text">${escapeHtml(value)}</p>
        ${spec?.value
          ? `<div class="hr-hotspot-readout-meta">From the spec field. Confidence: ${escapeHtml(conf)}.</div>`
          : `<div class="hr-hotspot-readout-meta">No specific spec disclosed. Showing a generic description.</div>`
        }
      `;
    });
  });
}
