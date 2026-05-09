// ─────────────────────────────────────────────────────────────
// Humanoid Robots Lab — generation diff panel
// "What changed from <previousGen> to <currentGen>?"
// ─────────────────────────────────────────────────────────────
import { escapeHtml, confidenceBadge } from './ui-helpers.js';

const CATEGORY_LABELS = {
  form:         'Form factor',
  mobility:     'Mobility',
  manipulation: 'Manipulation / hands',
  ai:           'AI / autonomy',
  deployment:   'Deployment',
  safety:       'Safety / interaction',
};

export function renderDiffPanel(robot, prevRobot, mountEl) {
  if (!mountEl) return;
  if (!robot || !prevRobot) {
    mountEl.innerHTML = '';
    mountEl.hidden = true;
    return;
  }
  const diffs = robot.changesFromPrevious || [];
  if (diffs.length === 0) {
    mountEl.innerHTML = '';
    mountEl.hidden = true;
    return;
  }
  mountEl.hidden = false;

  const items = diffs.map(d => {
    const cat = CATEGORY_LABELS[d.category] || d.category;
    return `
      <li class="hr-diff-item">
        <div class="hr-diff-cat">${escapeHtml(cat)}</div>
        <div class="hr-diff-text">${escapeHtml(d.text)}</div>
        <div class="hr-diff-conf">${confidenceBadge(d.confidence)}</div>
      </li>
    `;
  }).join('');

  mountEl.innerHTML = `
    <div class="hr-diff-head">
      <h3 class="hr-block-title">
        What changed
        <span class="hr-diff-arrow">${escapeHtml(prevRobot.displayName)} → ${escapeHtml(robot.displayName)}</span>
      </h3>
    </div>
    <ul class="hr-diff-list">${items}</ul>
  `;
}
