// ─────────────────────────────────────────────────────────────
// Humanoid Robots Lab — detail panel
// Renders the selected robot's specs, sources, and a verifiedModel flag.
// ─────────────────────────────────────────────────────────────
import { escapeHtml, specCell, confidenceBadge } from './ui-helpers.js';

const SPEC_FIELDS = [
  ['yearIntroduced',   'Introduced'],
  ['status',           'Status'],
  ['targetEnvironment','Target environment'],
  ['height',           'Height'],
  ['weight',           'Weight'],
  ['payload',          'Payload'],
  ['runtime',          'Runtime'],
  ['speed',            'Speed'],
  ['degreesOfFreedom', 'Degrees of freedom'],
  ['actuation',        'Actuation'],
  ['aiSystem',         'AI / software'],
];

export function renderDetailPanel(robot, mountEl) {
  if (!mountEl) return;
  if (!robot) {
    mountEl.innerHTML = '<p class="hr-na">Select a company to begin.</p>';
    return;
  }

  const sources = (robot.sources || []).map(s => `
    <li class="hr-source-item">
      <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">
        ${escapeHtml(s.label)} ↗
      </a>
      ${confidenceBadge(s.type)}
    </li>
  `).join('');

  const proxyTag = robot.asset?.verifiedModel
    ? `<span class="hr-asset-tag hr-asset-verified">Verified model</span>`
    : `<span class="hr-asset-tag hr-asset-proxy">Visual proxy</span>`;

  const specsHtml = SPEC_FIELDS.map(([key, label]) => `
    <div class="hr-spec-row">
      <dt class="hr-spec-key">${escapeHtml(label)}</dt>
      <dd class="hr-spec-val">${specCell(robot[key])}</dd>
    </div>
  `).join('');

  mountEl.innerHTML = `
    <div class="hr-detail-head">
      <div class="hr-detail-company">${escapeHtml(robot.companyName)}</div>
      <h2 class="hr-detail-name">${escapeHtml(robot.displayName)}</h2>
      <p class="hr-detail-summary">${escapeHtml(robot.summary)}</p>
      <div class="hr-detail-tags">${proxyTag}</div>
    </div>
    <dl class="hr-spec-grid">${specsHtml}</dl>
    ${robot.differentiators?.length ? `
      <div class="hr-detail-block">
        <h3 class="hr-block-title">Why it stands out</h3>
        <ul class="hr-bullet-list">
          ${robot.differentiators.map(d => `<li>${escapeHtml(d)}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
    <div class="hr-detail-block">
      <h3 class="hr-block-title">Sources</h3>
      <ul class="hr-source-list">${sources}</ul>
    </div>
  `;
}
