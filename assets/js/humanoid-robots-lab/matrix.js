// ─────────────────────────────────────────────────────────────
// Humanoid Robots Lab — comparison matrix
// One row per company, current featured robot's specs.
// ─────────────────────────────────────────────────────────────
import { escapeHtml, specCell } from './ui-helpers.js';
import { getAllFeaturedRobots } from './data.js';
import { setState } from './state.js';

export function renderMatrix(catalog, mountEl) {
  if (!mountEl) return;
  const robots = getAllFeaturedRobots(catalog);

  const rows = robots.map(r => `
    <tr data-robot-id="${escapeHtml(r.id)}" class="hr-matrix-row">
      <td class="hr-matrix-company">${escapeHtml(r.companyName)}</td>
      <td class="hr-matrix-robot">
        <button type="button" class="hr-matrix-link" data-robot-id="${escapeHtml(r.id)}">
          ${escapeHtml(r.displayName)}
        </button>
      </td>
      <td>${specCell(r.targetEnvironment)}</td>
      <td>${specCell(r.height)}</td>
      <td>${specCell(r.weight)}</td>
      <td>${specCell(r.payload)}</td>
      <td>${specCell(r.runtime)}</td>
      <td>${specCell(r.status)}</td>
    </tr>
  `).join('');

  mountEl.innerHTML = `
    <div class="hr-matrix-wrap" role="region" aria-label="Humanoid robot comparison matrix">
      <table class="hr-matrix">
        <thead>
          <tr>
            <th>Company</th>
            <th>Featured robot</th>
            <th>Target env.</th>
            <th>Height</th>
            <th>Weight</th>
            <th>Payload</th>
            <th>Runtime</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  mountEl.querySelectorAll('.hr-matrix-link').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-robot-id');
      const robot = robots.find(r => r.id === id);
      if (robot) setState({ companyId: robot.companyId, robotId: robot.id, mode: 'detail' });
    });
  });
}
