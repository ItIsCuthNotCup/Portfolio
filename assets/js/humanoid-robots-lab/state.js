// ─────────────────────────────────────────────────────────────
// Humanoid Robots Lab — tiny pub/sub state with URL hash sync
// State shape: { companyId: string, robotId: string, mode: 'detail'|'lineup' }
// Hash format: #company=figure&gen=figure-03&mode=detail
// ─────────────────────────────────────────────────────────────

const _subs = new Set();
const _state = {
  companyId: null,
  robotId:   null,
  mode:      'detail',
};

export function getState() {
  return { ..._state };
}

export function subscribe(fn) {
  _subs.add(fn);
  return () => _subs.delete(fn);
}

export function setState(patch, opts = {}) {
  let changed = false;
  for (const k of Object.keys(patch)) {
    if (_state[k] !== patch[k]) {
      _state[k] = patch[k];
      changed = true;
    }
  }
  if (!changed) return;
  if (!opts.silentHash) writeHash();
  _subs.forEach(fn => {
    try { fn(getState()); } catch (e) { console.error('state subscriber threw', e); }
  });
}

function readHash() {
  const h = (location.hash || '').replace(/^#/, '');
  if (!h) return {};
  const out = {};
  h.split('&').forEach(pair => {
    const [k, v] = pair.split('=');
    if (!k || !v) return;
    const dec = decodeURIComponent(v);
    if (k === 'company') out.companyId = dec;
    else if (k === 'gen') out.robotId = dec;
    else if (k === 'mode' && (dec === 'detail' || dec === 'lineup')) out.mode = dec;
  });
  return out;
}

function writeHash() {
  const parts = [];
  if (_state.companyId) parts.push('company=' + encodeURIComponent(_state.companyId));
  if (_state.robotId)   parts.push('gen='     + encodeURIComponent(_state.robotId));
  if (_state.mode && _state.mode !== 'detail') parts.push('mode=' + _state.mode);
  const newHash = parts.length ? '#' + parts.join('&') : '';
  if (newHash !== location.hash) {
    history.replaceState(null, '', location.pathname + location.search + newHash);
  }
}

// Initialize state from hash on first load. Caller passes in defaults to use
// when the hash doesn't specify them (e.g. first featured company + robot).
export function initFromHash(defaults) {
  const fromHash = readHash();
  setState({ ...defaults, ...fromHash }, { silentHash: true });
  // Re-write so the URL reflects the final resolved state (defaults included).
  writeHash();

  // Also sync on browser back/forward navigation.
  window.addEventListener('hashchange', () => {
    const next = readHash();
    if (next.companyId || next.robotId || next.mode) {
      setState(next, { silentHash: true });
    }
  });
}
