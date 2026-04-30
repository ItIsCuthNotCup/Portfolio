(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     AI & JOBS LAB — frontend
     - Loads /assets/data/jobs/occupations.json
     - Search → occupation card with 4 exposure bars + 1 robotics bar
     - Two-axis scatter (AI x, Robotics y)
     - Rank-shift bump chart over 3 measures
     - Compare-two-jobs view with featured pair starters
     - Four mini-charts in §V: BLS revisions, Stanford ADP youth,
       BTOS adoption, productivity table (HTML only)
     ═══════════════════════════════════════════════════════════ */

  // Major-group labels (from BLS SOC structure)
  const MAJOR_GROUPS = {
    "11": "Management",
    "13": "Business · Financial",
    "15": "Computer · Math",
    "17": "Architecture · Engineering",
    "19": "Life · Physical · Social Science",
    "21": "Community · Social Service",
    "23": "Legal",
    "25": "Education",
    "27": "Arts · Design · Media",
    "29": "Healthcare Practitioners",
    "31": "Healthcare Support",
    "33": "Protective Services",
    "35": "Food Prep · Serving",
    "37": "Building · Grounds",
    "39": "Personal Care · Services",
    "41": "Sales",
    "43": "Office · Admin",
    "45": "Farming · Fishing · Forestry",
    "47": "Construction · Extraction",
    "49": "Installation · Repair",
    "51": "Production",
    "53": "Transportation · Material Moving",
  };

  let DATA = null;
  let BY_SOC = {};

  // ── DOM refs ───────────────────────────────────────────────
  const $search    = document.getElementById('aj-search');
  const $results   = document.getElementById('aj-search-results');
  const $cardWrap  = document.getElementById('aj-card-wrap');
  const $card      = document.getElementById('aj-card');
  const $coverage  = document.getElementById('aj-coverage-stat');
  const $filterGroup = document.getElementById('aj-filter-group');
  const $filterEdu   = document.getElementById('aj-filter-edu');
  const $filterCov   = document.getElementById('aj-filter-coverage');
  const $scatter   = document.getElementById('aj-scatter');
  const $bump      = document.getElementById('aj-bump');
  const $cmpA      = document.getElementById('aj-cmp-a');
  const $cmpB      = document.getElementById('aj-cmp-b');
  const $cmpCardA  = document.getElementById('aj-cmp-card-a');
  const $cmpCardB  = document.getElementById('aj-cmp-card-b');
  const $cmpBlurb  = document.getElementById('aj-cmp-blurb');
  const $pairChips = document.getElementById('aj-pair-chips');

  // Education tier labels (parallel array indexed by tier int)
  const EDU = [
    "", "No formal credential", "High school diploma", "Postsecondary non-degree",
    "Associate's degree", "Bachelor's degree", "Master's degree", "Doctoral or professional",
  ];

  // ── Utilities ──────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, ch =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])
    );
  }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function fmtEmp(thousands) {
    if (thousands == null) return '—';
    if (thousands >= 1000) return (thousands / 1000).toFixed(2) + 'M';
    return thousands.toLocaleString(undefined, { maximumFractionDigits: 0 }) + 'k';
  }
  function fmtWage(usd) {
    if (usd == null) return '—';
    return '$' + usd.toLocaleString();
  }
  function fmtPct(p) {
    if (p == null) return '—';
    const sign = p > 0 ? '+' : '';
    return sign + p.toFixed(0) + '%';
  }
  function deltaClass(p) {
    if (p == null) return '';
    if (p <= -3) return 'delta-neg';
    if (p >= 3) return 'delta-pos';
    return '';
  }

  // Map a z-score-ish value into a 0..1 visual bar. Z scores are
  // typically -2..+3; we map -2 → 0 and +3 → 1.
  function zToBar(z) {
    if (z == null || isNaN(z)) return null;
    return clamp((z + 2) / 5, 0, 1);
  }
  // Eloundou β is on 0..1 range natively
  function rawToBar(v, lo, hi) {
    if (v == null || isNaN(v)) return null;
    return clamp((v - lo) / (hi - lo), 0, 1);
  }

  // ── Load and init ──────────────────────────────────────────
  async function load() {
    const r = await fetch('/assets/data/jobs/occupations.json', { cache: 'force-cache' });
    if (!r.ok) throw new Error('occupations.json failed to load');
    DATA = await r.json();
    BY_SOC = Object.fromEntries(DATA.occupations.map(o => [o.soc, o]));
    if ($coverage) $coverage.textContent = `${DATA.occupations.length} occupations indexed`;
    return DATA;
  }

  // ── Search (Section II) ────────────────────────────────────
  function initSearch() {
    if (!$search) return;
    $search.addEventListener('input', () => renderSearchResults($search.value));
    $search.addEventListener('focus', () => renderSearchResults($search.value));
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.aj-search-wrap')) {
        $results.hidden = true;
      }
    });
    // Suggested chips
    document.querySelectorAll('.aj-chip[data-soc]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.aj-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        showCard(btn.dataset.soc);
      });
    });
  }

  function renderSearchResults(q) {
    if (!$results) return;
    q = (q || '').trim().toLowerCase();
    if (q.length < 2) { $results.hidden = true; return; }
    const matches = DATA.occupations.filter(o =>
      o.title.toLowerCase().includes(q) || o.soc.includes(q)
    ).slice(0, 12);
    if (!matches.length) {
      $results.innerHTML = '<div class="aj-search-result"><span>No matches.</span></div>';
      $results.hidden = false;
      return;
    }
    $results.innerHTML = matches.map(o => `
      <div class="aj-search-result" data-soc="${escapeHtml(o.soc)}">
        <span>${escapeHtml(o.title)}</span>
        <span class="soc">${escapeHtml(o.soc)}</span>
      </div>
    `).join('');
    $results.hidden = false;
    $results.querySelectorAll('.aj-search-result').forEach(el => {
      el.addEventListener('click', () => {
        showCard(el.dataset.soc);
        $results.hidden = true;
        $search.value = BY_SOC[el.dataset.soc].title;
      });
    });
  }

  // ── Occupation card ────────────────────────────────────────
  function showCard(soc) {
    const o = BY_SOC[soc];
    if (!o) return;
    $cardWrap.hidden = false;
    $card.innerHTML = renderCard(o);
    // Smooth scroll into view
    $cardWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderCard(o) {
    const bls = o.bls;
    const major = MAJOR_GROUPS[o.major_group] || '';
    const stats = bls ? `
      <div class="aj-stat-grid">
        <div>
          <div class="aj-stat-label">2024 employment</div>
          <div class="aj-stat-val">${fmtEmp(bls.employment_thousands)}<span class="small">jobs</span></div>
        </div>
        <div>
          <div class="aj-stat-label">May 2024 median wage</div>
          <div class="aj-stat-val">${fmtWage(bls.median_wage_usd)}</div>
        </div>
        <div>
          <div class="aj-stat-label">BLS 2024–34 projected</div>
          <div class="aj-stat-val ${deltaClass(bls.projected_pct_change)}">${fmtPct(bls.projected_pct_change)}</div>
        </div>
        <div>
          <div class="aj-stat-label">Typical entry-level</div>
          <div class="aj-stat-val" style="font-size:18px; line-height:1.3;">${escapeHtml(EDU[bls.education_tier] || '—')}</div>
        </div>
      </div>
    ` : `
      <div class="aj-stat-grid">
        <div style="grid-column:1/-1;">
          <div class="aj-stat-label">BLS data</div>
          <div class="aj-stat-val" style="font-size:16px; color:var(--ink-soft); line-height:1.4;">
            Curated v1 ships BLS employment, wage, and projection data
            for ~85 high-coverage occupations. This SOC has exposure
            scores only. Run notebooks/jobs_lab.py to extend coverage.
          </div>
        </div>
      </div>
    `;

    // Exposure bars
    const ai = o.ai || {};
    const bars = [
      { src: 'Eloundou β',     v: rawToBar(ai.eloundou_beta, 0, 1),   raw: ai.eloundou_beta?.toFixed(2) },
      { src: 'Eloundou (h) β', v: rawToBar(ai.eloundou_human_beta, 0, 1), raw: ai.eloundou_human_beta?.toFixed(2) },
      { src: 'Felten AIOE',    v: rawToBar(ai.felten_aioe, -2, 3),    raw: ai.felten_aioe?.toFixed(2) },
      { src: 'YBL PCA score',  v: rawToBar(ai.ybl_pca, -3, 4),        raw: ai.ybl_pca?.toFixed(2) },
    ];

    const aiBars = bars.map(b => `
      <div class="aj-bar-row">
        <span class="src">${escapeHtml(b.src)}</span>
        <span class="aj-bar-track">
          <span class="aj-bar-fill" style="left:50%; width: ${b.v == null ? 0 : Math.abs(b.v - 0.5) * 100}%; ${b.v != null && b.v < 0.5 ? 'transform:translateX(-100%);' : ''}"></span>
        </span>
        <span class="aj-bar-score ${b.raw == null ? 'dim' : ''}">${b.raw ?? '—'}</span>
      </div>
    `).join('');

    const robBar = `
      <div class="aj-bar-row">
        <span class="src">Major-group</span>
        <span class="aj-bar-track">
          <span class="aj-bar-fill robotics" style="left:50%; width: ${Math.abs(o.robotics_score - 0.4) * 100}%; ${o.robotics_score < 0.4 ? 'transform:translateX(-100%);' : ''}"></span>
        </span>
        <span class="aj-bar-score">${o.robotics_score.toFixed(2)}</span>
      </div>
    `;

    return `
      <div class="aj-card-head">
        <div class="aj-card-soc">SOC ${escapeHtml(o.soc)} · ${escapeHtml(major)}</div>
        <h2 class="aj-card-title">${escapeHtml(o.title)}</h2>
      </div>

      ${stats}

      <div class="aj-exposure-block">
        <div class="aj-exposure-head">AI exposure (centered at zero)</div>
        ${aiBars}
        <div class="aj-exposure-head" style="margin-top: 14px;">Robotics exposure (heuristic)</div>
        ${robBar}
      </div>

      ${o.narrative ? `<div class="aj-narrative">${escapeHtml(o.narrative)}</div>` : ''}
    `;
  }

  // ── Scatter (Section III) ──────────────────────────────────
  function initScatter() {
    if (!$scatter) return;
    // Build group filter options
    const groups = Object.entries(MAJOR_GROUPS);
    $filterGroup.innerHTML = '<option value="">all major groups</option>' +
      groups.map(([k, v]) => `<option value="${k}">${k} · ${escapeHtml(v)}</option>`).join('');
    // Education filter
    $filterEdu.innerHTML = '<option value="">all education</option>' +
      EDU.slice(1).map((label, idx) => `<option value="${idx + 1}">${escapeHtml(label)}</option>`).join('');

    [$filterGroup, $filterEdu, $filterCov].forEach(el =>
      el && el.addEventListener('change', drawScatter));

    drawScatter();
  }

  function filteredOccupations() {
    const g  = $filterGroup.value;
    const ed = $filterEdu.value ? parseInt($filterEdu.value, 10) : null;
    const cov = $filterCov.value;
    return DATA.occupations.filter(o => {
      if (cov === 'bls' && !o.bls) return false;
      if (g && o.major_group !== g) return false;
      if (ed && (!o.bls || o.bls.education_tier !== ed)) return false;
      if (o.ai_composite_z == null && cov !== 'all') return false;
      return true;
    });
  }

  function drawScatter() {
    const w = 900, h = 560;
    const m = { l: 70, r: 40, t: 30, b: 60 };
    const iw = w - m.l - m.r;
    const ih = h - m.t - m.b;

    const occs = filteredOccupations();
    // X = ai_composite_z, mapped from -2..+3 → 0..iw
    const xMin = -2.2, xMax = 3.2;
    const yMin = 0.0,  yMax = 0.95;

    const x = (z) => m.l + ((z - xMin) / (xMax - xMin)) * iw;
    const y = (r) => m.t + ih - ((r - yMin) / (yMax - yMin)) * ih;

    // bubble size from employment (sqrt scale)
    const r = (emp) => {
      if (emp == null) return 4;
      return clamp(Math.sqrt(emp / 50) + 2, 4, 26);
    };
    // color from projected change: red < 0, ink-dim ≈ 0, accent-2 > 0
    const colorFor = (delta) => {
      if (delta == null) return 'var(--ink-dim)';
      if (delta <= -8) return 'var(--accent)';
      if (delta <= -3) return 'color-mix(in oklab, var(--accent) 55%, var(--ink-dim))';
      if (delta < 3)   return 'var(--ink-dim)';
      if (delta < 12)  return 'color-mix(in oklab, var(--accent-2) 55%, var(--ink-dim))';
      return 'var(--accent-2)';
    };

    const ticksX = [-2, -1, 0, 1, 2, 3];
    const ticksY = [0.0, 0.2, 0.4, 0.6, 0.8];

    const grid = ticksY.map(t => `<line class="gridline" x1="${m.l}" x2="${m.l+iw}" y1="${y(t)}" y2="${y(t)}"/>`).join('') +
                 ticksX.map(t => `<line class="gridline" x1="${x(t)}" x2="${x(t)}" y1="${m.t}" y2="${m.t+ih}"/>`).join('');

    const xAxis = `
      <g class="axis">
        <line x1="${m.l}" x2="${m.l+iw}" y1="${m.t+ih}" y2="${m.t+ih}"/>
        ${ticksX.map(t => `
          <line x1="${x(t)}" x2="${x(t)}" y1="${m.t+ih}" y2="${m.t+ih+5}"/>
          <text x="${x(t)}" y="${m.t+ih+18}" text-anchor="middle">${t}</text>
        `).join('')}
        <text class="axis-title" x="${m.l + iw/2}" y="${m.t+ih+44}" text-anchor="middle">AI exposure (z-score, composite of 3 measures) →</text>
      </g>`;

    const yAxis = `
      <g class="axis">
        <line x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${m.t+ih}"/>
        ${ticksY.map(t => `
          <line x1="${m.l-5}" x2="${m.l}" y1="${y(t)}" y2="${y(t)}"/>
          <text x="${m.l-10}" y="${y(t)+3}" text-anchor="end">${t.toFixed(1)}</text>
        `).join('')}
        <text class="axis-title" x="${-m.t-ih/2}" y="20" text-anchor="middle" transform="rotate(-90)">↑ Robotics exposure (heuristic)</text>
      </g>`;

    const quadLabels = `
      <text class="quad-label" x="${m.l + iw - 8}" y="${m.t + 16}" text-anchor="end">DOUBLE-EXPOSED</text>
      <text class="quad-label" x="${m.l + 8}"      y="${m.t + 16}">PHYSICAL-WORK AUTOMATION</text>
      <text class="quad-label" x="${m.l + iw - 8}" y="${m.t + ih - 8}" text-anchor="end">KNOWLEDGE-WORK DISRUPTION</text>
      <text class="quad-label" x="${m.l + 8}"      y="${m.t + ih - 8}">RESILIENT</text>
    `;

    const dots = occs.map(o => {
      if (o.ai_composite_z == null) return '';
      const cx = x(clamp(o.ai_composite_z, xMin, xMax));
      const cy = y(o.robotics_score);
      const rr = r(o.bls?.employment_thousands);
      return `<circle class="dot" data-soc="${escapeHtml(o.soc)}"
                 cx="${cx}" cy="${cy}" r="${rr}"
                 fill="${colorFor(o.bls?.projected_pct_change)}"
                 fill-opacity="0.62"
                 stroke="rgba(0,0,0,0.18)" stroke-width="0.6">
                <title>${escapeHtml(o.title)} · ${o.bls ? fmtPct(o.bls.projected_pct_change) + ' projected' : 'no BLS data'}</title>
              </circle>`;
    }).join('');

    $scatter.innerHTML = grid + xAxis + yAxis + quadLabels + dots;

    // Click → drill into card
    $scatter.querySelectorAll('circle.dot').forEach(c => {
      c.addEventListener('click', () => {
        const soc = c.getAttribute('data-soc');
        showCard(soc);
        document.querySelector('.aj-card-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
  }

  // ── Bump chart (Section IV) ────────────────────────────────
  function initBump() {
    if (!$bump) return;
    drawBump();
  }

  function drawBump() {
    // 30 representative occupations: top employment + every featured occupation
    const featuredSocs = new Set();
    DATA.featured_pairs.forEach(p => { featuredSocs.add(p.a); featuredSocs.add(p.b); });

    let pool = DATA.occupations
      .filter(o => o.ai && o.ai.eloundou_beta != null && o.ai.felten_aioe != null && o.ai.ybl_pca != null);
    // take featured + top BLS-employment to fill to 30
    let chosen = pool.filter(o => featuredSocs.has(o.soc));
    const rest = pool
      .filter(o => !featuredSocs.has(o.soc) && o.bls)
      .sort((a, b) => (b.bls.employment_thousands - a.bls.employment_thousands))
      .slice(0, 30 - chosen.length);
    chosen = chosen.concat(rest).slice(0, 30);

    // Rank chosen on each measure
    const measures = ['eloundou_beta', 'felten_aioe', 'ybl_pca'];
    const labels = ['Eloundou β', 'Felten AIOE', 'Yale Budget Lab'];
    const ranks = {};
    measures.forEach(m => {
      const order = [...chosen].sort((a, b) => (b.ai[m] || 0) - (a.ai[m] || 0));
      order.forEach((o, idx) => {
        if (!ranks[o.soc]) ranks[o.soc] = {};
        ranks[o.soc][m] = idx + 1;
      });
    });

    // Layout
    const w = 900, h = 700;
    const m = { l: 230, r: 230, t: 50, b: 30 };
    const iw = w - m.l - m.r;
    const ih = h - m.t - m.b;
    const xCol = measures.map((_, i) => m.l + (i / (measures.length - 1)) * iw);
    const N = chosen.length;
    const yRank = (r) => m.t + ((r - 1) / (N - 1)) * ih;

    // Highlight occupations with the largest rank shift
    const rankShift = chosen.map(o => {
      const rs = measures.map(mm => ranks[o.soc][mm]);
      return { soc: o.soc, shift: Math.max(...rs) - Math.min(...rs) };
    });
    const topShifts = new Set(
      rankShift.sort((a, b) => b.shift - a.shift).slice(0, 6).map(r => r.soc)
    );

    const colHeads = labels.map((lbl, i) =>
      `<text class="col-label" x="${xCol[i]}" y="${m.t - 22}" text-anchor="middle">${escapeHtml(lbl)}</text>`
    ).join('');

    const lines = chosen.map(o => {
      const pts = measures.map((mm, i) => `${xCol[i]},${yRank(ranks[o.soc][mm])}`).join(' ');
      const hi = topShifts.has(o.soc) ? 'hi' : '';
      return `<polyline class="bump-line ${hi}" points="${pts}"/>`;
    }).join('');

    const dots = chosen.map(o =>
      measures.map((mm, i) => {
        const hi = topShifts.has(o.soc) ? 'hi' : '';
        return `<circle class="bump-dot ${hi}" cx="${xCol[i]}" cy="${yRank(ranks[o.soc][mm])}" r="3"/>`;
      }).join('')
    ).join('');

    // Names on left side: use first measure's rank position; right side: last
    const leftNames = chosen.map(o => {
      const r1 = ranks[o.soc][measures[0]];
      const hi = topShifts.has(o.soc) ? 'hi' : '';
      return `<text class="bump-name ${hi}" x="${m.l - 12}" y="${yRank(r1) + 3}" text-anchor="end">${escapeHtml(o.title)}</text>`;
    }).join('');
    const rightNames = chosen.map(o => {
      const r3 = ranks[o.soc][measures[2]];
      const hi = topShifts.has(o.soc) ? 'hi' : '';
      return `<text class="bump-name ${hi}" x="${xCol[2] + 12}" y="${yRank(r3) + 3}">${escapeHtml(o.title)}</text>`;
    }).join('');

    $bump.innerHTML = colHeads + lines + dots + leftNames + rightNames;
  }

  // ── Empirical-reality mini-charts (Section V) ─────────────
  function drawMiniBLS() {
    const $svg = document.getElementById('aj-emp-bls');
    if (!$svg) return;
    // Same occupations, two projection vintages (2021-31 vs 2024-34)
    const data = [
      { name: 'Paralegals',          old: 14, neu: 0 },
      { name: 'Customer service',    old: -4, neu: -5 },
      { name: 'Programmers',         old: 0,  neu: -10 },
      { name: 'Translators',         old: 19, neu: 1 },
      { name: 'Bookkeepers',         old: -3, neu: -6 },
    ];
    const w = 320, h = 180;
    const m = { l: 96, r: 36, t: 8, b: 22 };
    const iw = w - m.l - m.r;
    const ih = h - m.t - m.b;
    const xMin = -12, xMax = 22;
    const x = (v) => m.l + ((v - xMin) / (xMax - xMin)) * iw;
    const yBand = ih / data.length;

    let svg = '';
    // zero line
    svg += `<line class="gridline" x1="${x(0)}" x2="${x(0)}" y1="${m.t}" y2="${m.t+ih}" />`;
    // x-axis
    svg += `<line class="axis" stroke="var(--ink-dim)" x1="${m.l}" x2="${m.l+iw}" y1="${m.t+ih}" y2="${m.t+ih}"/>`;
    [-10, 0, 10, 20].forEach(t => {
      svg += `<text class="axis" x="${x(t)}" y="${m.t+ih+12}" text-anchor="middle" font-family="DM Mono" font-size="9" fill="var(--ink-dim)">${t > 0 ? '+'+t : t}%</text>`;
    });
    data.forEach((d, i) => {
      const yc = m.t + i * yBand + yBand / 2;
      svg += `<text class="lbl" x="${m.l - 6}" y="${yc + 4}" text-anchor="end">${escapeHtml(d.name)}</text>`;
      // old vintage line/dot
      svg += `<circle cx="${x(d.old)}" cy="${yc}" r="3" fill="var(--ink-dim)"/>`;
      // new vintage line/dot
      svg += `<circle cx="${x(d.neu)}" cy="${yc}" r="4" fill="var(--accent)"/>`;
      // arrow line
      svg += `<line x1="${x(d.old)}" x2="${x(d.neu)}" y1="${yc}" y2="${yc}" stroke="var(--ink-dim)" stroke-width="1" stroke-dasharray="2 2"/>`;
    });
    // legend
    svg += `<text x="${m.l}" y="${m.t-2}" font-family="DM Mono" font-size="8" fill="var(--ink-dim)" letter-spacing="0.1em">2021–31 PROJECTION → 2024–34 (●=new)</text>`;
    $svg.innerHTML = svg;
  }

  function drawMiniADP() {
    const $svg = document.getElementById('aj-emp-adp');
    if (!$svg) return;
    // Stylized: relative employment indexed to Oct 2022 = 100
    // Oct 22 → Jul 25, two series: ages 22-25 high-exposure (declining), older same occupations (rising)
    const months = 33;
    function mkSeries(start, drift, noise) {
      const arr = [];
      let v = 100;
      for (let i = 0; i < months; i++) {
        v += drift + (Math.sin(i * 0.7) * noise);
        arr.push(v);
      }
      return arr;
    }
    const young = mkSeries(100, -0.4, 0.6);  // ~13% decline by month 33
    const older = mkSeries(100, +0.18, 0.5); // gentle rise

    const w = 320, h = 180;
    const m = { l: 36, r: 60, t: 8, b: 22 };
    const iw = w - m.l - m.r;
    const ih = h - m.t - m.b;
    const yMin = 80, yMax = 110;
    const x = (i) => m.l + (i / (months - 1)) * iw;
    const y = (v) => m.t + ih - ((v - yMin) / (yMax - yMin)) * ih;

    let svg = '';
    [85, 90, 95, 100, 105].forEach(t => {
      svg += `<line class="gridline" x1="${m.l}" x2="${m.l+iw}" y1="${y(t)}" y2="${y(t)}"/>`;
      svg += `<text class="axis" x="${m.l-4}" y="${y(t)+3}" text-anchor="end" font-family="DM Mono" font-size="9" fill="var(--ink-dim)">${t}</text>`;
    });
    svg += `<line stroke="var(--ink-dim)" x1="${m.l}" x2="${m.l+iw}" y1="${m.t+ih}" y2="${m.t+ih}"/>`;
    svg += `<text x="${x(0)}" y="${m.t+ih+12}" font-family="DM Mono" font-size="9" fill="var(--ink-dim)">Oct '22</text>`;
    svg += `<text x="${x(months-1)}" y="${m.t+ih+12}" text-anchor="end" font-family="DM Mono" font-size="9" fill="var(--ink-dim)">Jul '25</text>`;
    // Older line
    svg += `<polyline class="data-line" stroke="var(--ink-dim)" points="${older.map((v, i) => x(i) + ',' + y(v)).join(' ')}"/>`;
    // Young line (highlight in red)
    svg += `<polyline class="data-line" stroke="var(--accent)" stroke-width="2" points="${young.map((v, i) => x(i) + ',' + y(v)).join(' ')}"/>`;
    // labels at right
    svg += `<text class="lbl" x="${m.l+iw+4}" y="${y(older[months-1])+3}" font-family="Newsreader" font-size="10" fill="var(--ink-soft)">Older</text>`;
    svg += `<text class="lbl" x="${m.l+iw+4}" y="${y(young[months-1])+3}" font-family="Newsreader" font-size="10" fill="var(--accent)">22–25</text>`;
    $svg.innerHTML = svg;
  }

  function drawMiniBTOS() {
    const $svg = document.getElementById('aj-emp-btos');
    if (!$svg) return;
    // Series of biweekly waves Sept '23 → Nov '25
    // Production wording (~3.7 → 10), broadened wording (~17.3 in Nov '25)
    const data = [
      { date: 'Sep23', a: 3.7,  b: null },
      { date: 'Mar24', a: 5.4,  b: null },
      { date: 'Sep24', a: 7.1,  b: null },
      { date: 'Mar25', a: 8.6,  b: null },
      { date: 'Sep25', a: 10.0, b: null },
      { date: 'Nov25', a: 10.5, b: 17.3 },
    ];
    const w = 320, h = 180;
    const m = { l: 28, r: 24, t: 12, b: 28 };
    const iw = w - m.l - m.r;
    const ih = h - m.t - m.b;
    const yMax = 20;
    const x = (i) => m.l + (i / (data.length - 1)) * iw;
    const y = (v) => m.t + ih - (v / yMax) * ih;

    let svg = '';
    [0, 5, 10, 15, 20].forEach(t => {
      svg += `<line class="gridline" x1="${m.l}" x2="${m.l+iw}" y1="${y(t)}" y2="${y(t)}"/>`;
      svg += `<text class="axis" x="${m.l-4}" y="${y(t)+3}" text-anchor="end" font-family="DM Mono" font-size="9" fill="var(--ink-dim)">${t}%</text>`;
    });
    data.forEach((d, i) => {
      svg += `<text x="${x(i)}" y="${m.t+ih+13}" text-anchor="middle" font-family="DM Mono" font-size="8" fill="var(--ink-dim)">${d.date}</text>`;
      // bar A
      svg += `<rect x="${x(i) - 6}" y="${y(d.a)}" width="6" height="${y(0) - y(d.a)}" fill="var(--accent)" opacity="0.85"/>`;
      // bar B (broadened wording, only on last)
      if (d.b != null) {
        svg += `<rect x="${x(i)}" y="${y(d.b)}" width="6" height="${y(0) - y(d.b)}" fill="var(--accent-2)" opacity="0.85"/>`;
      }
    });
    $svg.innerHTML = svg;
  }

  // ── Compare two jobs (Section VI) ──────────────────────────
  function initCompare() {
    if (!$cmpA || !$cmpB || !$pairChips) return;
    // Populate selects
    const opts = DATA.occupations
      .filter(o => o.bls)
      .sort((a, b) => a.title.localeCompare(b.title))
      .map(o => `<option value="${escapeHtml(o.soc)}">${escapeHtml(o.title)} · ${escapeHtml(o.soc)}</option>`)
      .join('');
    $cmpA.innerHTML = opts;
    $cmpB.innerHTML = opts;

    // Pair chips
    $pairChips.innerHTML = DATA.featured_pairs.map((p, i) =>
      `<button type="button" class="aj-pair-chip" data-pair="${i}">${escapeHtml(p.label)}</button>`
    ).join('');
    $pairChips.querySelectorAll('.aj-pair-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        $pairChips.querySelectorAll('.aj-pair-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const p = DATA.featured_pairs[parseInt(btn.dataset.pair, 10)];
        $cmpA.value = p.a; $cmpB.value = p.b;
        renderCompare(p);
      });
    });

    [$cmpA, $cmpB].forEach(el =>
      el.addEventListener('change', () => {
        $pairChips.querySelectorAll('.aj-pair-chip').forEach(b => b.classList.remove('active'));
        renderCompare(null);
      })
    );

    // Default to first featured pair
    const first = DATA.featured_pairs[0];
    $cmpA.value = first.a; $cmpB.value = first.b;
    $pairChips.querySelector('.aj-pair-chip')?.classList.add('active');
    renderCompare(first);
  }

  function renderCompare(pair) {
    const a = BY_SOC[$cmpA.value];
    const b = BY_SOC[$cmpB.value];
    if (!a || !b) return;
    $cmpCardA.innerHTML = renderCompareSide(a);
    $cmpCardB.innerHTML = renderCompareSide(b);
    $cmpBlurb.textContent = pair ? pair.blurb : '';
  }

  function renderCompareSide(o) {
    const bls = o.bls;
    const stat = (lbl, val, dCls = '') => `
      <div class="aj-cmp-stat">
        <span class="lbl">${escapeHtml(lbl)}</span>
        <span class="val ${dCls}">${val}</span>
      </div>`;
    return `
      <div class="aj-cmp-title">${escapeHtml(o.title)}</div>
      ${stat('SOC', `<span style="font-family:'DM Mono',monospace; font-size:13px;">${escapeHtml(o.soc)}</span>`)}
      ${bls ? stat('Employment', fmtEmp(bls.employment_thousands)) : ''}
      ${bls ? stat('Median wage', fmtWage(bls.median_wage_usd)) : ''}
      ${bls ? stat('2024–34', fmtPct(bls.projected_pct_change), deltaClass(bls.projected_pct_change)) : ''}
      ${bls ? stat('Education', `<span style="font-size:13px;">${escapeHtml(EDU[bls.education_tier] || '—')}</span>`) : ''}
      ${stat('AI exposure (z)', o.ai_composite_z != null ? o.ai_composite_z.toFixed(2) : '—',
        o.ai_composite_z > 0.5 ? 'delta-neg' : o.ai_composite_z < -0.5 ? 'delta-pos' : '')}
      ${stat('Robotics exposure', o.robotics_score.toFixed(2),
        o.robotics_score > 0.5 ? 'delta-neg' : '')}
    `;
  }

  // ── Bootstrap ──────────────────────────────────────────────
  load().then(() => {
    initSearch();
    initScatter();
    initBump();
    initCompare();
    drawMiniBLS();
    drawMiniADP();
    drawMiniBTOS();
    // Open the first featured occupation card by default to give immediate visual content
    showCard('23-2011');
    document.querySelector('.aj-chip[data-soc="23-2011"]')?.classList.add('active');
  }).catch(err => {
    console.error('jobs-lab: data load failed', err);
    if ($card) {
      $cardWrap.hidden = false;
      $card.innerHTML = `<div class="aj-narrative">Couldn't load occupations.json. ${escapeHtml(err.message || '')}</div>`;
    }
  });
})();
