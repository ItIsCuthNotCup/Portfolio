// ─────────────────────────────────────────────────────────────
// Humanoid Robots Lab — company pills + generation timeline
// ─────────────────────────────────────────────────────────────
import { escapeHtml } from './ui-helpers.js';
import { getRobotsByCompany, getCompany, getFeaturedRobotForCompany } from './data.js';
import { getState, setState } from './state.js';

export function renderCompanyPills(catalog, mountEl) {
  if (!mountEl) return;
  const html = catalog.companies.map(c => {
    return `
      <button type="button" class="hr-company-pill" data-company-id="${escapeHtml(c.id)}" aria-pressed="false">
        <span class="hr-company-pill-name">${escapeHtml(c.name)}</span>
      </button>
    `;
  }).join('');
  mountEl.innerHTML = html;

  mountEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.hr-company-pill');
    if (!btn) return;
    const id = btn.getAttribute('data-company-id');
    const featured = getFeaturedRobotForCompany(catalog, id);
    setState({ companyId: id, robotId: featured?.id || null, mode: 'detail' });
  });
}

export function renderGenerationTimeline(catalog, mountEl) {
  if (!mountEl) return;
  const state = getState();
  if (!state.companyId) {
    mountEl.innerHTML = '';
    return;
  }
  const company = getCompany(catalog, state.companyId);
  const robots = getRobotsByCompany(catalog, state.companyId);
  const html = `
    <div class="hr-timeline-label">${escapeHtml(company?.name || 'Company')} · generations</div>
    <ol class="hr-timeline-list">
      ${robots.map((r, i) => `
        <li class="hr-timeline-item ${r.id === state.robotId ? 'is-active' : ''}">
          <button type="button" class="hr-timeline-btn" data-robot-id="${escapeHtml(r.id)}">
            <span class="hr-timeline-step">${String(i + 1).padStart(2, '0')}</span>
            <span class="hr-timeline-name">${escapeHtml(r.displayName)}</span>
            ${r.yearIntroduced?.value ? `<span class="hr-timeline-year">${escapeHtml(r.yearIntroduced.value)}</span>` : ''}
          </button>
        </li>
      `).join('')}
    </ol>
  `;
  mountEl.innerHTML = html;

  mountEl.querySelectorAll('.hr-timeline-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const robotId = btn.getAttribute('data-robot-id');
      setState({ robotId, mode: 'detail' });
    });
  });
}

// Visually mark the active company pill — separated so we can sync it on
// every state change without re-rendering the whole list.
export function syncCompanyPills(mountEl) {
  if (!mountEl) return;
  const { companyId } = getState();
  mountEl.querySelectorAll('.hr-company-pill').forEach(btn => {
    const isActive = btn.getAttribute('data-company-id') === companyId;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}
