// tech-predictions-lab.js — TEST. 03
//
// Scrubbable scatter (year_said vs year_targeted), small multiples
// by category, archive table, click-into-side-panel detail. Single
// JSON source at /assets/data/tech-predictions/predictions-v1.json.

(function () {
  'use strict';

  const DATA_URL = '/assets/data/tech-predictions/predictions-v1.json?v=1';

  const fmt = new Intl.NumberFormat('en-US');
  function svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }
  function makeScale(domain, range) {
    return v => range[0] + (v - domain[0]) * (range[1] - range[0]) / (domain[1] - domain[0]);
  }
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  let DATA = null;
  let activeCategory = 'all';
  let activeView = 'targeted'; // or 'years-late'
  let sortKey = 'year_said';
  let sortAsc = false;

  // Bootstrap
  fetch(DATA_URL)
    .then(r => r.json())
    .then(d => {
      DATA = d;
      buildCategoryColorMap();
      renderLede();
      renderMultiples();
      renderTable();
      renderReceipts();
      wireControls();
    })
    .catch(err => console.error('Tech predictions data load failed:', err));

  let CAT_COLOR = {};
  function buildCategoryColorMap() {
    DATA.categories.forEach(c => { CAT_COLOR[c.id] = c.color; });
  }

  function predictorSize(type) {
    const def = DATA.predictor_types.find(t => t.id === type);
    return def ? def.size : 4;
  }

  function outcomeMark(outcome) {
    return {
      'did-not-happen': '○',
      'did-not-happen-yet': '◌',
      'fulfilled-with-delay': '●',
      'fulfilled-on-time': '★',
      'partially-fulfilled': '◐',
      'unclear': '?'
    }[outcome] || '○';
  }
  function outcomeFilled(outcome) {
    // For SVG dots: should the circle be filled?
    return outcome === 'fulfilled-with-delay' || outcome === 'fulfilled-on-time';
  }

  // ── 1. Lede chart ──────────────────────────────────────────
  function renderLede() {
    const svg = document.getElementById('tp-lede');
    if (!svg) return;
    const W = 1100, H = 560;
    const M = { t: 36, r: 28, b: 56, l: 72 };
    svg.innerHTML = '';

    const rows = DATA.rows.filter(r =>
      activeCategory === 'all' || r.category === activeCategory);

    let xDomain = [1985, 2027];
    let yDomain;
    if (activeView === 'targeted') {
      yDomain = [1985, 2050];
    } else {
      // years-late: only fulfilled-with-delay rows are used
      yDomain = [-5, 25];
    }

    const xScale = makeScale(xDomain, [M.l, W - M.r]);
    const yScale = makeScale(yDomain, [H - M.b, M.t]);

    // Grid + ticks
    function isYearTick(y) { return y % 5 === 0; }
    for (let y = xDomain[0]; y <= xDomain[1]; y++) {
      if (!isYearTick(y)) continue;
      const x = xScale(y);
      svg.appendChild(svgEl('line', {
        x1: x, x2: x, y1: M.t, y2: H - M.b,
        stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.16
      }));
      svg.appendChild(svgEl('text', {
        x, y: H - M.b + 18, 'text-anchor': 'middle',
        fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace'
      })).textContent = y;
    }

    if (activeView === 'targeted') {
      for (let y = yDomain[0]; y <= yDomain[1]; y += 5) {
        const py = yScale(y);
        svg.appendChild(svgEl('line', {
          x1: M.l, x2: W - M.r, y1: py, y2: py,
          stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.16
        }));
        svg.appendChild(svgEl('text', {
          x: M.l - 8, y: py + 4, 'text-anchor': 'end',
          fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace'
        })).textContent = y;
      }

      // Diagonal reference (year_said = year_targeted)
      const dx0 = Math.max(xDomain[0], yDomain[0]);
      const dx1 = Math.min(xDomain[1], yDomain[1]);
      svg.appendChild(svgEl('line', {
        x1: xScale(dx0), y1: yScale(dx0),
        x2: xScale(dx1), y2: yScale(dx1),
        stroke: 'var(--ink)', 'stroke-width': 1,
        'stroke-dasharray': '4,4', opacity: 0.4
      }));
      // Diagonal label
      svg.appendChild(svgEl('text', {
        x: xScale(2024) + 8, y: yScale(2024) - 6,
        'text-anchor': 'start', fill: 'var(--ink-soft)',
        'font-size': 10, 'font-family': 'DM Mono, monospace',
        'font-style': 'italic'
      })).textContent = 'year said = year targeted';
    } else {
      for (let y = -5; y <= 25; y += 5) {
        const py = yScale(y);
        svg.appendChild(svgEl('line', {
          x1: M.l, x2: W - M.r, y1: py, y2: py,
          stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: y === 0 ? 0.4 : 0.16
        }));
        svg.appendChild(svgEl('text', {
          x: M.l - 8, y: py + 4, 'text-anchor': 'end',
          fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace'
        })).textContent = y;
      }
    }

    // Axes
    svg.appendChild(svgEl('line', {
      x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b,
      stroke: 'var(--ink)', 'stroke-width': 1
    }));
    svg.appendChild(svgEl('line', {
      x1: M.l, x2: M.l, y1: M.t, y2: H - M.b,
      stroke: 'var(--ink)', 'stroke-width': 1
    }));

    // Y-axis title
    svg.appendChild(svgEl('text', {
      x: M.l - 60, y: M.t - 14, 'text-anchor': 'start',
      fill: 'var(--ink-dim)', 'font-size': 10,
      'font-family': 'DM Mono, monospace', 'letter-spacing': '0.10em'
    })).textContent = activeView === 'targeted' ? 'YEAR TARGETED →' : 'YEARS LATE →';
    svg.appendChild(svgEl('text', {
      x: (M.l + W - M.r) / 2, y: H - 14,
      'text-anchor': 'middle', fill: 'var(--ink-dim)',
      'font-size': 10, 'font-family': 'DM Mono, monospace',
      'letter-spacing': '0.10em'
    })).textContent = 'YEAR PREDICTION WAS SAID';

    // Plot rows
    const tip = document.getElementById('tp-tooltip');
    const wrap = document.getElementById('tp-lede-wrap');
    rows.forEach((r, idx) => {
      let yVal;
      if (activeView === 'targeted') {
        yVal = r.year_targeted;
      } else {
        // Show only fulfilled-with-delay rows in this view
        if (r.outcome !== 'fulfilled-with-delay') return;
        // Use outcome_note's mention or compute years-late ≈ actual - targeted
        // Without a precise actual, approximate from outcome_note. Fall
        // back to a heuristic 5 years if we don't have a number.
        yVal = approxYearsLate(r);
      }
      // Jitter x slightly for duplicate (year_said, year_targeted) pairs
      const jitter = ((hash(r.id) % 9) - 4) * 0.18;
      const cx = xScale(r.year_said + jitter);
      const cy = yScale(yVal);
      if (!isFinite(cx) || !isFinite(cy)) return;
      if (cx < M.l || cx > W - M.r || cy < M.t || cy > H - M.b) return;

      const filled = outcomeFilled(r.outcome);
      const partial = r.outcome === 'partially-fulfilled';
      const star = r.outcome === 'fulfilled-on-time';
      const color = CAT_COLOR[r.category] || '#888';
      const radius = predictorSize(r.predictor_type);

      let dot;
      if (star) {
        dot = svgEl('path', { d: starPath(cx, cy, radius * 1.4), fill: color, stroke: 'var(--paper)', 'stroke-width': 1, opacity: 0.95 });
      } else if (partial) {
        // half-filled circle: full circle with a partial fill via clip
        dot = svgEl('circle', {
          cx, cy, r: radius,
          fill: 'url(#partial-' + r.id + ')',
          stroke: color, 'stroke-width': 1.5, opacity: 0.95
        });
        const grad = svgEl('linearGradient', { id: 'partial-' + r.id });
        grad.appendChild(svgEl('stop', { offset: '50%', 'stop-color': color }));
        grad.appendChild(svgEl('stop', { offset: '50%', 'stop-color': 'transparent' }));
        const defs = svg.querySelector('defs') || svg.insertBefore(svgEl('defs'), svg.firstChild);
        defs.appendChild(grad);
      } else {
        dot = svgEl('circle', {
          cx, cy, r: radius,
          fill: filled ? color : 'transparent',
          stroke: color,
          'stroke-width': filled ? 1 : 1.5,
          opacity: 0.95
        });
      }
      dot.style.cursor = 'pointer';
      dot.addEventListener('mouseenter', e => {
        showTip(r, e);
      });
      dot.addEventListener('mousemove', e => moveTip(e));
      dot.addEventListener('mouseleave', () => { tip.hidden = true; });
      dot.addEventListener('click', () => openSidePanel(r));
      svg.appendChild(dot);
    });

    function showTip(r, e) {
      tip.innerHTML =
        '<div class="tt-name">' + escapeHtml(r.predictor) + '</div>' +
        '<div class="tt-meta">' + escapeHtml(r.year_said) + ' → ' + escapeHtml(r.year_targeted) + ' &middot; ' + escapeHtml(catLabel(r.category)) + '</div>' +
        '<div class="tt-quote">"' + escapeHtml(r.quote.length > 160 ? r.quote.slice(0, 160) + '…' : r.quote) + '"</div>';
      tip.hidden = false;
      moveTip(e);
    }
    function moveTip(e) {
      const rect = wrap.getBoundingClientRect();
      tip.style.left = (e.clientX - rect.left + 14) + 'px';
      tip.style.top = (e.clientY - rect.top - 14) + 'px';
    }
  }

  function approxYearsLate(r) {
    // Best-effort estimate: parse the outcome_note for a "X years late"
    // hint, otherwise take the difference between (a numeric date in
    // outcome_note text) and r.year_targeted. Fallback: 4 years.
    const m = (r.outcome_note || '').match(/(\d+)\s*years?\s*late/i);
    if (m) return parseInt(m[1], 10);
    const m2 = (r.outcome_note || '').match(/(\d{4})/g);
    if (m2 && m2.length) {
      const actual = parseInt(m2[m2.length - 1], 10);
      return Math.max(0, actual - r.year_targeted);
    }
    return 4;
  }

  function starPath(cx, cy, r) {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI / 5);
      const rad = i % 2 === 0 ? r : r * 0.45;
      const x = cx + rad * Math.cos(ang);
      const y = cy + rad * Math.sin(ang);
      d += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
    }
    return d + 'Z';
  }

  function hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function catLabel(id) {
    const c = DATA.categories.find(c => c.id === id);
    return c ? c.label : id;
  }

  // ── 2. Small multiples ─────────────────────────────────────
  function renderMultiples() {
    const wrap = document.getElementById('tp-multiples');
    if (!wrap) return;
    const sixCats = ['av', 'vr', 'tv3d', 'ar', 'crypto', 'flying'];
    wrap.innerHTML = '';
    sixCats.forEach(catId => {
      const rows = DATA.rows.filter(r => r.category === catId);
      const meta = DATA.categories.find(c => c.id === catId);
      const tile = document.createElement('div');
      tile.className = 'tp-multi-tile';
      tile.innerHTML =
        '<div class="tp-multi-name">' +
          '<span class="swatch" style="background:' + meta.color + '"></span>' +
          escapeHtml(meta.label) +
        '</div>' +
        '<div class="tp-multi-meta">n = ' + rows.length + '</div>';

      const W = 320, H = 200, M = { t: 6, r: 12, b: 24, l: 36 };
      const xDomain = [1985, 2027];
      const yDomain = [1990, 2035];
      const xScale = makeScale(xDomain, [M.l, W - M.r]);
      const yScale = makeScale(yDomain, [H - M.b, M.t]);
      const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMid meet' });

      // Grid (sparse)
      [1990, 2000, 2010, 2020].forEach(y => {
        const x = xScale(y);
        if (x < M.l || x > W - M.r) return;
        svg.appendChild(svgEl('line', { x1: x, x2: x, y1: M.t, y2: H - M.b, stroke: 'var(--ink-dim)', 'stroke-width': 0.4, opacity: 0.18 }));
        svg.appendChild(svgEl('text', { x, y: H - 8, 'text-anchor': 'middle', fill: 'var(--ink-dim)', 'font-size': 9, 'font-family': 'DM Mono, monospace' })).textContent = y;
      });
      [2000, 2020].forEach(y => {
        const py = yScale(y);
        svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: py, y2: py, stroke: 'var(--ink-dim)', 'stroke-width': 0.4, opacity: 0.18 }));
        svg.appendChild(svgEl('text', { x: M.l - 4, y: py + 3, 'text-anchor': 'end', fill: 'var(--ink-dim)', 'font-size': 9, 'font-family': 'DM Mono, monospace' })).textContent = y;
      });

      // Diagonal
      svg.appendChild(svgEl('line', {
        x1: xScale(1990), y1: yScale(1990),
        x2: xScale(2027), y2: yScale(2027),
        stroke: 'var(--ink)', 'stroke-width': 0.5,
        'stroke-dasharray': '2,3', opacity: 0.4
      }));

      rows.forEach(r => {
        const cx = xScale(r.year_said);
        const cy = yScale(r.year_targeted);
        if (cx < M.l || cx > W - M.r || cy < M.t || cy > H - M.b) return;
        const color = meta.color;
        const filled = outcomeFilled(r.outcome);
        svg.appendChild(svgEl('circle', {
          cx, cy, r: 3.2,
          fill: filled ? color : 'transparent',
          stroke: color, 'stroke-width': filled ? 0.5 : 1.4,
          opacity: 0.9
        }));
      });

      tile.appendChild(svg);
      wrap.appendChild(tile);
    });
  }

  // ── 3. Archive table ───────────────────────────────────────
  function renderTable() {
    const tbody = document.getElementById('tp-table-body');
    if (!tbody) return;
    let rows = DATA.rows.slice();
    rows.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
    tbody.innerHTML = rows.map(r => {
      const cat = DATA.categories.find(c => c.id === r.category);
      const swatch = '<span style="display:inline-block;width:8px;height:8px;background:' + (cat ? cat.color : '#888') + ';margin-right:6px;vertical-align:baseline"></span>';
      const verLow = r.verified_level === 'low' ? '<span class="verlow">LOW</span>' : '';
      return '<tr data-id="' + escapeHtml(r.id) + '">' +
        '<td>' + escapeHtml(r.predictor) + (r.company ? '<br><span style="color:var(--ink-dim)">' + escapeHtml(r.company) + '</span>' : '') + '</td>' +
        '<td>' + escapeHtml(r.year_said) + '</td>' +
        '<td>' + escapeHtml(r.year_targeted) + '</td>' +
        '<td>' + swatch + escapeHtml(catLabel(r.category)) + '</td>' +
        '<td class="pred">"' + escapeHtml(r.quote.length > 200 ? r.quote.slice(0, 200) + '…' : r.quote) + '"' + verLow + '</td>' +
        '<td class="outcome outcome-' + r.outcome + '"><span class="outcome-glyph">' + outcomeMark(r.outcome) + '</span>' + escapeHtml(humanOutcome(r.outcome)) + '</td>' +
        '<td class="src">' + escapeHtml(r.source_title || '—') + '</td>' +
      '</tr>';
    }).join('');

    tbody.querySelectorAll('tr').forEach(tr => {
      tr.addEventListener('click', () => {
        const r = DATA.rows.find(x => x.id === tr.dataset.id);
        if (r) openSidePanel(r);
      });
    });
  }

  function humanOutcome(o) {
    return {
      'did-not-happen': 'Did not happen',
      'did-not-happen-yet': 'Did not happen (yet)',
      'fulfilled-with-delay': 'Fulfilled (with delay)',
      'fulfilled-on-time': 'Fulfilled on time',
      'partially-fulfilled': 'Partially fulfilled',
      'unclear': 'Unclear'
    }[o] || o;
  }

  // ── 4. Side panel ──────────────────────────────────────────
  function openSidePanel(r) {
    const panel = document.getElementById('tp-side-panel');
    if (!panel) return;
    document.getElementById('tp-sp-cat').textContent = catLabel(r.category) + ' · ' + (r.predictor_type || '');
    document.getElementById('tp-sp-name').textContent = r.predictor;
    const meta = (r.company ? r.company + ' · ' : '') + 'said ' + r.year_said + ' · targeted ' + r.year_targeted;
    document.getElementById('tp-sp-meta').textContent = meta;
    document.getElementById('tp-sp-quote').textContent = r.quote;
    document.getElementById('tp-sp-outcome').innerHTML =
      '<strong>' + outcomeMark(r.outcome) + ' ' + humanOutcome(r.outcome) + '.</strong> ' + escapeHtml(r.outcome_note || '');
    document.getElementById('tp-sp-source').innerHTML =
      escapeHtml(r.source_title || '—') +
      (r.source_url ? ' · <a href="' + r.source_url + '" target="_blank" rel="noopener" style="border-bottom:1px solid">visit ↗</a>' : '');
    document.getElementById('tp-sp-ver').innerHTML =
      escapeHtml(r.verified_level) + (r.verbatim ? ' · verbatim quote' : ' · paraphrased');
    panel.setAttribute('aria-hidden', 'false');
  }

  function closeSidePanel() {
    const panel = document.getElementById('tp-side-panel');
    if (panel) panel.setAttribute('aria-hidden', 'true');
  }

  // ── 5. Receipts ────────────────────────────────────────────
  function renderReceipts() {
    const wrap = document.getElementById('tp-receipts');
    if (!wrap) return;
    const total = DATA.rows.length;
    const dnh = DATA.rows.filter(r => r.outcome === 'did-not-happen').length;
    const fulfilled = DATA.rows.filter(r => r.outcome === 'fulfilled-with-delay' || r.outcome === 'fulfilled-on-time').length;
    const onTime = DATA.rows.filter(r => r.outcome === 'fulfilled-on-time').length;
    const high = DATA.rows.filter(r => r.verified_level === 'high').length;
    const muskRows = DATA.rows.filter(r => r.predictor === 'Elon Musk');
    const muskAvgGap = muskRows.length ? Math.round(muskRows.reduce((s, r) => s + (r.year_targeted - r.year_said), 0) / muskRows.length * 10) / 10 : 0;
    const items = [
      { label: 'Predictions', value: String(total), sub: '1940 → 2026' },
      { label: 'Did not happen', value: String(dnh) + ' / ' + total, sub: Math.round(dnh / total * 100) + '% of dataset' },
      { label: 'Fulfilled (any)', value: String(fulfilled), sub: 'Mostly with delay' },
      { label: 'Fulfilled on time', value: String(onTime), sub: 'Of the entire dataset' },
      { label: 'Verified high', value: String(high) + ' / ' + total, sub: 'URL pass pending for v2' },
      { label: 'Categories', value: '9', sub: '6 with small multiples' },
      { label: 'Median gap', value: '4.0 years', sub: 'year_targeted − year_said' },
      { label: 'Musk FSD entries', value: String(muskRows.length), sub: 'Avg gap ~' + muskAvgGap + ' yrs (annual repeat)' },
      { label: 'Heaviest category', value: 'AV', sub: '23 predictions' },
      { label: 'Year of Linux', value: '25+ yrs', sub: 'declared annually since 1998' }
    ];
    wrap.innerHTML = items.map(i =>
      '<div class="tp-receipt"><div class="tp-receipt-label">' + i.label + '</div>' +
      '<div class="tp-receipt-value">' + i.value + '</div>' +
      '<div class="tp-receipt-sub">' + i.sub + '</div></div>'
    ).join('');
  }

  // ── 6. Wire controls ───────────────────────────────────────
  function wireControls() {
    document.querySelectorAll('[data-cat-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-cat-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeCategory = btn.dataset.catFilter;
        renderLede();
      });
    });
    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeView = btn.dataset.view;
        renderLede();
      });
    });
    document.querySelectorAll('.tp-table th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const k = th.dataset.sort;
        if (sortKey === k) sortAsc = !sortAsc; else { sortKey = k; sortAsc = true; }
        renderTable();
      });
    });
    document.querySelector('.tp-sp-close')?.addEventListener('click', closeSidePanel);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeSidePanel();
    });
  }
})();
