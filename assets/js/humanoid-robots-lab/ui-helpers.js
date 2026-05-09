// ─────────────────────────────────────────────────────────────
// Humanoid Robots Lab — small DOM + escape helpers shared across UI modules.
// ─────────────────────────────────────────────────────────────

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Confidence labels render as small chips with consistent colors.
const CONF_LABELS = {
  official:  'official',
  reported:  'reported',
  estimated: 'estimated',
  unknown:   'not confirmed',
};
export function confidenceBadge(conf) {
  const label = CONF_LABELS[conf] || 'unknown';
  return `<span class="hr-conf hr-conf-${escapeHtml(conf || 'unknown')}">${escapeHtml(label)}</span>`;
}

// Render a RobotSpec as "value · badge" or as a "Not publicly confirmed" note
// when the value is null. Pure HTML string.
export function specCell(spec) {
  if (!spec) return `<span class="hr-na">—</span>`;
  if (spec.value == null || spec.value === '') {
    return `<span class="hr-na">Not publicly confirmed</span> ${confidenceBadge('unknown')}`;
  }
  return `${escapeHtml(spec.value)} ${confidenceBadge(spec.confidence)}`;
}

export function el(tag, attrs = {}, html = '') {
  const node = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'class') node.className = attrs[k];
    else if (k.startsWith('on') && typeof attrs[k] === 'function') node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
    else if (attrs[k] !== false && attrs[k] != null) node.setAttribute(k, attrs[k]);
  }
  if (html) node.innerHTML = html;
  return node;
}
