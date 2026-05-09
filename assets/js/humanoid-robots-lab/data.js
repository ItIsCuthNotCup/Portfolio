// ─────────────────────────────────────────────────────────────
// Humanoid Robots Lab — catalog loader + helpers
// Pure ES module. No framework. Fetches /assets/data/humanoid-robots/catalog.json
// once on first import and exposes typed helpers for the rest of the app.
// ─────────────────────────────────────────────────────────────

const CATALOG_URL = '/assets/data/humanoid-robots/catalog.json';

let _catalog = null;
let _inflight = null;

export async function loadCatalog() {
  if (_catalog) return _catalog;
  if (_inflight) return _inflight;
  _inflight = fetch(CATALOG_URL, { cache: 'no-cache' })
    .then(r => {
      if (!r.ok) throw new Error('catalog ' + r.status);
      return r.json();
    })
    .then(json => {
      _catalog = json;
      _inflight = null;
      return json;
    })
    .catch(err => {
      _inflight = null;
      throw err;
    });
  return _inflight;
}

export function getCompanies(catalog) {
  return catalog.companies;
}

export function getCompany(catalog, companyId) {
  return catalog.companies.find(c => c.id === companyId) || null;
}

export function getRobotsByCompany(catalog, companyId) {
  return catalog.robots.filter(r => r.companyId === companyId);
}

export function getRobot(catalog, robotId) {
  return catalog.robots.find(r => r.id === robotId) || null;
}

export function getPreviousGeneration(catalog, robot) {
  if (!robot || !robot.previousGenerationId) return null;
  return getRobot(catalog, robot.previousGenerationId);
}

export function getFeaturedRobotForCompany(catalog, companyId) {
  const id = catalog.featuredPerCompany?.[companyId];
  return id ? getRobot(catalog, id) : null;
}

export function getAllFeaturedRobots(catalog) {
  return catalog.companies
    .map(c => getFeaturedRobotForCompany(catalog, c.id))
    .filter(Boolean);
}

// Flatten every source on every robot into a unique list keyed by url.
export function getAllSources(catalog) {
  const seen = new Map();
  catalog.robots.forEach(r => {
    (r.sources || []).forEach(s => {
      if (!seen.has(s.url)) seen.set(s.url, s);
    });
  });
  return Array.from(seen.values());
}

// Parse a height spec value like "1.7 m" or "~1.65 m" into meters as a number.
// Returns null if the value can't be parsed (use the catalog default 1.7m for
// unknowns when scaling the lineup).
export function parseHeightMeters(spec) {
  if (!spec || !spec.value) return null;
  const m = String(spec.value).match(/(\d+(?:\.\d+)?)\s*m/i);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return Number.isFinite(v) && v > 0.5 && v < 3 ? v : null;
}
