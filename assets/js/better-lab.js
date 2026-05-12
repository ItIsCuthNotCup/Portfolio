/* ═══════════════════════════════════════════════════════════════
   "BETTER?" LAB — 100-indicator progress ledger.
   Pure JS, no dependencies. Loads indicators.json, renders inline
   SVG sparklines for every row, plus the four cost-curve hero
   charts and the four worsening small-multiples. Filter chips,
   year scrubber, and COVID overlay update the ledger in place.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const DATA_URL = '/assets/data/better/indicators.json';
  const SPARK_W = 160;
  const SPARK_H = 32;
  const SPARK_PAD = 4;

  const state = {
    indicators: [],
    yearMax: 2025,
    yearMin: 1990,
    activeYear: 2025,
    theme: 'all',
    direction: 'all',
    covidOn: false,
  };

  // ── Helpers ──────────────────────────────────────────────────
  function fmtValue(v, unit) {
    if (v === null || v === undefined) return '—';
    const abs = Math.abs(v);
    if (abs >= 1e12) return (v / 1e12).toFixed(1).replace(/\.0$/, '') + 'T';
    if (abs >= 1e9) return (v / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (abs >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (abs >= 1e4) return (v / 1000).toFixed(0) + 'k';
    if (abs >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (abs >= 100) return v.toFixed(0);
    if (abs >= 10) return v.toFixed(1).replace(/\.0$/, '');
    if (abs >= 1) return v.toFixed(2).replace(/\.?0+$/, '');
    if (abs >= 0.01) return v.toFixed(3).replace(/\.?0+$/, '');
    if (abs > 0) return v.toExponential(1);
    return '0';
  }

  function fmtUnit(unit) {
    if (!unit) return '';
    // Compact common units for ledger column
    return unit;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // ── Sparkline rendering ──────────────────────────────────────
  function buildSparkPath(series, yearCutoff, w, h, pad) {
    if (!series.length) return { line: '', dot: null, baselineDot: null };
    const xs = series.map(s => s[0]);
    const ys = series.map(s => s[1]);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;
    // Decide whether to log-scale the y-axis. If the range spans
    // more than 2 orders of magnitude, log makes the trajectory
    // legible; otherwise linear keeps small movements visible.
    const useLog = yMax > 0 && yMin > 0 && (yMax / yMin) > 100;
    const yScale = (v) => {
      if (useLog) {
        const lo = Math.log10(yMin);
        const hi = Math.log10(yMax);
        return pad + innerH - ((Math.log10(v) - lo) / (hi - lo)) * innerH;
      }
      return pad + innerH - ((v - yMin) / yRange) * innerH;
    };
    const xScale = (yr) => pad + ((yr - xMin) / xRange) * innerW;

    // Active (in-window) series — points with year <= cutoff
    const inWin = series.filter(s => s[0] <= yearCutoff);
    if (!inWin.length) return { line: '', bg: '', dot: null, baselineDot: null };

    const lineD = inWin.map((s, i) =>
      (i === 0 ? 'M' : 'L') + xScale(s[0]).toFixed(1) + ' ' + yScale(s[1]).toFixed(1)
    ).join(' ');

    // Background / full-series ghost line (dashed)
    const bgD = series.map((s, i) =>
      (i === 0 ? 'M' : 'L') + xScale(s[0]).toFixed(1) + ' ' + yScale(s[1]).toFixed(1)
    ).join(' ');

    // Current dot at last in-window point
    const last = inWin[inWin.length - 1];
    const dot = { x: xScale(last[0]).toFixed(1), y: yScale(last[1]).toFixed(1) };

    // Baseline dot
    const first = series[0];
    const baselineDot = { x: xScale(first[0]).toFixed(1), y: yScale(first[1]).toFixed(1) };

    // COVID band coords (2020-21)
    const covidStart = xScale(2020);
    const covidEnd = xScale(2021);
    const covid = { x: covidStart, w: Math.max(2, covidEnd - covidStart) };

    return { line: lineD, bg: bgD, dot, baselineDot, covid };
  }

  function renderSpark(svg, indicator, yearCutoff) {
    const w = SPARK_W;
    const h = SPARK_H;
    const pad = SPARK_PAD;
    const paths = buildSparkPath(indicator.series, yearCutoff, w, h, pad);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.innerHTML = '';
    if (!paths.line) return;
    // COVID band (if flagged)
    if (indicator.covid_dip && paths.covid) {
      const band = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      band.setAttribute('class', 'bl-spark-covid-band');
      band.setAttribute('x', paths.covid.x.toFixed(1));
      band.setAttribute('y', 0);
      band.setAttribute('width', paths.covid.w.toFixed(1));
      band.setAttribute('height', h);
      svg.appendChild(band);
    }
    // Background full-series ghost
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    bg.setAttribute('class', 'bl-spark-line-bg');
    bg.setAttribute('d', paths.bg);
    svg.appendChild(bg);
    // Main line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('class', 'bl-spark-line');
    line.setAttribute('d', paths.line);
    svg.appendChild(line);
    // Baseline dot
    if (paths.baselineDot) {
      const bdot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      bdot.setAttribute('class', 'bl-spark-baseline-dot');
      bdot.setAttribute('cx', paths.baselineDot.x);
      bdot.setAttribute('cy', paths.baselineDot.y);
      bdot.setAttribute('r', 1.8);
      svg.appendChild(bdot);
    }
    // Current dot
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('class', 'bl-spark-dot');
    dot.setAttribute('cx', paths.dot.x);
    dot.setAttribute('cy', paths.dot.y);
    dot.setAttribute('r', 2.6);
    svg.appendChild(dot);
  }

  // ── Cost-curve charts (§ III) ───────────────────────────────
  function renderCostCurve(svgId, series, opts) {
    const svg = document.getElementById(svgId);
    if (!svg || !series.length) return;
    const w = 360, h = 140, pad = { l: 32, r: 12, t: 14, b: 18 };
    const innerW = w - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;
    const xs = series.map(s => s[0]);
    const ys = series.map(s => s[1]);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const useLog = opts && opts.log !== false && yMax / yMin > 50;
    const yScale = (v) => {
      if (useLog) {
        const lo = Math.log10(yMin), hi = Math.log10(yMax);
        return pad.t + innerH - ((Math.log10(v) - lo) / (hi - lo)) * innerH;
      }
      return pad.t + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;
    };
    const xScale = (yr) => pad.l + ((yr - xMin) / (xMax - xMin || 1)) * innerW;

    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.innerHTML = '';

    // Grid lines + labels
    const ticks = useLog
      ? [yMin, yMin * 10, yMin * 100, yMin * 1000, yMin * 10000, yMin * 100000, yMin * 1000000].filter(t => t <= yMax)
      : [yMin, (yMin + yMax) / 2, yMax];
    ticks.forEach((t) => {
      const y = yScale(t);
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('class', 'bl-cost-grid-line');
      l.setAttribute('x1', pad.l);
      l.setAttribute('x2', w - pad.r);
      l.setAttribute('y1', y);
      l.setAttribute('y2', y);
      svg.appendChild(l);
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', 4);
      txt.setAttribute('y', y + 3);
      txt.textContent = (opts && opts.fmtY) ? opts.fmtY(t) : fmtValue(t, '');
      svg.appendChild(txt);
    });

    // X-axis years
    [xMin, xMax].forEach((yr, i) => {
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', i === 0 ? pad.l : w - pad.r);
      txt.setAttribute('text-anchor', i === 0 ? 'start' : 'end');
      txt.setAttribute('y', h - 4);
      txt.textContent = yr;
      svg.appendChild(txt);
    });

    // Area fill
    let areaD = `M ${xScale(xs[0]).toFixed(1)} ${yScale(ys[0]).toFixed(1)}`;
    for (let i = 1; i < series.length; i++) {
      areaD += ` L ${xScale(xs[i]).toFixed(1)} ${yScale(ys[i]).toFixed(1)}`;
    }
    const baseY = pad.t + innerH;
    areaD += ` L ${xScale(xMax).toFixed(1)} ${baseY} L ${xScale(xMin).toFixed(1)} ${baseY} Z`;
    const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    area.setAttribute('class', 'bl-cost-area');
    area.setAttribute('d', areaD);
    svg.appendChild(area);

    // Line
    const lineD = series.map((s, i) =>
      (i === 0 ? 'M' : 'L') + xScale(s[0]).toFixed(1) + ' ' + yScale(s[1]).toFixed(1)
    ).join(' ');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('class', 'bl-cost-line');
    line.setAttribute('d', lineD);
    svg.appendChild(line);
  }

  // ── Worsening small-multiples (§ IV) ────────────────────────
  function renderWorseChart(svgId, series, opts) {
    const svg = document.getElementById(svgId);
    if (!svg || !series.length) return;
    const w = 360, h = 160, pad = { l: 24, r: 12, t: 12, b: 20 };
    const innerW = w - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;
    const xs = series.map(s => s[0]);
    const ys = series.map(s => s[1]);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const yScale = (v) => pad.t + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;
    const xScale = (yr) => pad.l + ((yr - xMin) / (xMax - xMin || 1)) * innerW;

    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.innerHTML = '';

    // Soft fill below the line
    let areaD = `M ${xScale(xs[0]).toFixed(1)} ${yScale(ys[0]).toFixed(1)}`;
    for (let i = 1; i < series.length; i++) {
      areaD += ` L ${xScale(xs[i]).toFixed(1)} ${yScale(ys[i]).toFixed(1)}`;
    }
    const baseY = pad.t + innerH;
    areaD += ` L ${xScale(xMax).toFixed(1)} ${baseY} L ${xScale(xMin).toFixed(1)} ${baseY} Z`;
    const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    area.setAttribute('class', 'bl-worse-fill');
    area.setAttribute('d', areaD);
    svg.appendChild(area);

    // Line
    const lineD = series.map((s, i) =>
      (i === 0 ? 'M' : 'L') + xScale(s[0]).toFixed(1) + ' ' + yScale(s[1]).toFixed(1)
    ).join(' ');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('class', 'bl-worse-line');
    line.setAttribute('d', lineD);
    svg.appendChild(line);

    // Endpoint dot
    const last = series[series.length - 1];
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('class', 'bl-worse-dot');
    dot.setAttribute('cx', xScale(last[0]));
    dot.setAttribute('cy', yScale(last[1]));
    dot.setAttribute('r', 3);
    svg.appendChild(dot);

    // Endpoints text
    [{ x: xMin, anchor: 'start' }, { x: xMax, anchor: 'end' }].forEach((p) => {
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', p.anchor === 'start' ? pad.l : w - pad.r);
      txt.setAttribute('text-anchor', p.anchor);
      txt.setAttribute('y', h - 5);
      txt.setAttribute('class', 'mono');
      txt.style.fontSize = '9px';
      txt.style.letterSpacing = '0.12em';
      txt.style.fill = 'var(--ink-dim)';
      txt.textContent = p.x;
      svg.appendChild(txt);
    });
  }

  // ── Ledger row factory ───────────────────────────────────────
  function makeRow(ind) {
    const row = document.createElement('article');
    row.className = 'bl-row';
    row.setAttribute('role', 'listitem');
    row.setAttribute('data-id', ind.id);
    row.setAttribute('data-theme', ind.theme);
    row.setAttribute('data-direction', ind.direction);
    if (ind.covid_dip) row.setAttribute('data-covid-dip', 'true');
    row.tabIndex = 0;

    // Column 1: name + source
    const name = document.createElement('div');
    name.className = 'bl-row-name';
    const title = document.createElement('div');
    title.className = 'bl-row-title';
    title.textContent = ind.name;
    const source = document.createElement('div');
    source.className = 'bl-row-source';
    source.textContent = ind.source + ' · ' + ind.unit;
    name.appendChild(title);
    name.appendChild(source);

    // Column 2: baseline
    const baseline = document.createElement('div');
    baseline.className = 'bl-row-baseline';
    const bNum = document.createElement('div');
    bNum.className = 'bl-row-value-num';
    bNum.textContent = fmtValue(ind.baseline.value);
    const bYr = document.createElement('div');
    bYr.className = 'bl-row-value-year';
    bYr.textContent = ind.baseline.year;
    baseline.appendChild(bNum);
    baseline.appendChild(bYr);

    // Column 3: current (this updates with scrubber)
    const current = document.createElement('div');
    current.className = 'bl-row-current';
    const cNum = document.createElement('div');
    cNum.className = 'bl-row-value-num';
    cNum.dataset.role = 'current-value';
    const cYr = document.createElement('div');
    cYr.className = 'bl-row-value-year';
    cYr.dataset.role = 'current-year';
    current.appendChild(cNum);
    current.appendChild(cYr);

    // Column 4: sparkline
    const spark = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    spark.setAttribute('class', 'bl-row-spark');
    spark.dataset.role = 'spark';

    // Column 5: direction badge
    const dir = document.createElement('div');
    dir.className = 'bl-row-dir';
    dir.textContent = ind.direction;

    row.appendChild(name);
    row.appendChild(baseline);
    row.appendChild(current);
    row.appendChild(spark);
    row.appendChild(dir);

    row.addEventListener('click', () => openDetail(ind));
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDetail(ind);
      }
    });

    return row;
  }

  // ── Update a row to reflect the active year ──────────────────
  function updateRow(row, ind, year) {
    const inWin = ind.series.filter(s => s[0] <= year);
    const last = inWin.length ? inWin[inWin.length - 1] : ind.series[0];
    const cNum = row.querySelector('[data-role="current-value"]');
    const cYr = row.querySelector('[data-role="current-year"]');
    if (cNum) cNum.textContent = fmtValue(last[1]);
    if (cYr) cYr.textContent = last[0];
    const spark = row.querySelector('[data-role="spark"]');
    if (spark) renderSpark(spark, ind, year);
  }

  // ── Filter visibility ────────────────────────────────────────
  function applyFilters() {
    const rows = document.querySelectorAll('.bl-row');
    let shown = 0;
    const dirCount = { Optimistic: 0, Mixed: 0, Negative: 0 };
    rows.forEach((row) => {
      const theme = row.getAttribute('data-theme');
      const direction = row.getAttribute('data-direction');
      const themeMatch = state.theme === 'all' || theme === state.theme;
      const dirMatch = state.direction === 'all' || direction === state.direction;
      const visible = themeMatch && dirMatch;
      if (visible) {
        row.hidden = false;
        shown += 1;
        dirCount[direction] += 1;
      } else {
        row.hidden = true;
      }
    });
    setText('bl-tally-shown', shown);
    setText('bl-tally-opt', dirCount.Optimistic);
    setText('bl-tally-mix', dirCount.Mixed);
    setText('bl-tally-neg', dirCount.Negative);
  }

  // ── Apply year scrubber ──────────────────────────────────────
  function applyYear(year) {
    state.activeYear = year;
    setText('bl-year-value', year);
    const ledger = document.getElementById('bl-ledger');
    if (!ledger) return;
    const rows = ledger.querySelectorAll('.bl-row');
    rows.forEach((row, idx) => {
      const ind = state.indicators[idx];
      if (ind) updateRow(row, ind, year);
    });
  }

  // ── COVID overlay toggle ─────────────────────────────────────
  function applyCovid() {
    const ledger = document.getElementById('bl-ledger');
    if (!ledger) return;
    const rows = ledger.querySelectorAll('.bl-row');
    rows.forEach((row) => {
      if (state.covidOn) {
        row.setAttribute('data-covid-on', 'true');
      } else {
        row.removeAttribute('data-covid-on');
      }
    });
  }

  // ── Detail dialog ────────────────────────────────────────────
  function openDetail(ind) {
    const dialog = document.getElementById('bl-detail');
    if (!dialog) return;
    setText('bl-detail-tag', (ind.theme || '').toUpperCase() + ' · ' + ind.direction);
    setText('bl-detail-name', ind.name);
    setText('bl-detail-def', ind.definition || '—');
    setText('bl-detail-baseline', `${fmtValue(ind.baseline.value)} ${ind.unit} (${ind.baseline.year})`);
    setText('bl-detail-latest', `${fmtValue(ind.latest.value)} ${ind.unit} (${ind.latest.year})`);
    setText('bl-detail-unit', ind.unit);
    setText('bl-detail-direction', ind.direction);
    setText('bl-detail-caveat', ind.caveat || '—');
    const a = document.getElementById('bl-detail-source');
    if (a) {
      a.href = ind.source_url || '#';
      a.textContent = ind.source || '—';
    }
    dialog.hidden = false;
    dialog.setAttribute('aria-hidden', 'false');
  }

  function closeDetail() {
    const dialog = document.getElementById('bl-detail');
    if (!dialog) return;
    dialog.hidden = true;
    dialog.setAttribute('aria-hidden', 'true');
  }

  // ── Build the ledger ─────────────────────────────────────────
  function buildLedger() {
    const ledger = document.getElementById('bl-ledger');
    if (!ledger) return;
    ledger.innerHTML = '';
    const frag = document.createDocumentFragment();
    state.indicators.forEach((ind) => {
      const row = makeRow(ind);
      frag.appendChild(row);
    });
    ledger.appendChild(frag);
    // First-pass paint for all sparklines at current year
    state.indicators.forEach((ind, i) => {
      const rows = ledger.querySelectorAll('.bl-row');
      updateRow(rows[i], ind, state.activeYear);
    });
    applyFilters();
  }

  // ── Wire controls ────────────────────────────────────────────
  function wireControls() {
    const themeChips = document.getElementById('bl-theme-chips');
    if (themeChips) {
      themeChips.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-theme]');
        if (!btn) return;
        themeChips.querySelectorAll('.bl-chip').forEach(c => c.classList.remove('is-active'));
        btn.classList.add('is-active');
        state.theme = btn.getAttribute('data-theme');
        applyFilters();
      });
    }

    const dirChips = document.getElementById('bl-dir-chips');
    if (dirChips) {
      dirChips.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-dir]');
        if (!btn) return;
        dirChips.querySelectorAll('.bl-chip').forEach(c => c.classList.remove('is-active'));
        btn.classList.add('is-active');
        state.direction = btn.getAttribute('data-dir');
        applyFilters();
      });
    }

    const range = document.getElementById('bl-year-range');
    if (range) {
      range.addEventListener('input', (e) => {
        applyYear(parseInt(e.target.value, 10));
      });
    }

    const covid = document.getElementById('bl-covid-toggle');
    if (covid) {
      covid.addEventListener('change', () => {
        state.covidOn = covid.checked;
        applyCovid();
      });
    }

    const closeBtn = document.getElementById('bl-detail-close');
    if (closeBtn) closeBtn.addEventListener('click', closeDetail);
    const dialog = document.getElementById('bl-detail');
    if (dialog) {
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) closeDetail();
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDetail();
    });
  }

  // ── Cost-curve and worsening rendering hooks ─────────────────
  function renderHeroCharts() {
    const byId = {};
    state.indicators.forEach(i => { byId[i.id] = i; });

    // Hard-coded cost-of-light series (Nordhaus 1996, not in JSON)
    const lightSeries = [
      [1800, 785], [1850, 200], [1880, 25], [1900, 5], [1920, 1.5],
      [1950, 0.5], [1970, 0.35], [1992, 0.23]
    ];
    renderCostCurve('bl-cost-light', lightSeries, {
      log: true,
      fmtY: (v) => '$' + (v >= 1 ? v.toFixed(0) : v.toFixed(2))
    });

    if (byId.genome_cost) {
      renderCostCurve('bl-cost-genome', byId.genome_cost.series, {
        log: true,
        fmtY: (v) => v >= 1e6 ? '$' + (v / 1e6).toFixed(0) + 'M' :
                     v >= 1e3 ? '$' + (v / 1e3).toFixed(0) + 'k' :
                                '$' + v.toFixed(0)
      });
    }
    if (byId.solar_lcoe) {
      renderCostCurve('bl-cost-solar', byId.solar_lcoe.series, {
        log: false,
        fmtY: (v) => '$' + v.toFixed(0)
      });
    }
    if (byId.battery_price) {
      renderCostCurve('bl-cost-battery', byId.battery_price.series, {
        log: true,
        fmtY: (v) => '$' + v.toFixed(0)
      });
    }

    // Worsening
    if (byId.co2_ppm) renderWorseChart('bl-worse-co2', byId.co2_ppm.series);
    if (byId.conflicts_active) renderWorseChart('bl-worse-conflicts', byId.conflicts_active.series);
    if (byId.displaced_total) renderWorseChart('bl-worse-displaced', byId.displaced_total.series);
    if (byId.vdem) renderWorseChart('bl-worse-vdem', byId.vdem.series);
  }

  // ── Filed date ──────────────────────────────────────────────
  function setFiledDate() {
    const el = document.getElementById('dateline-time');
    if (!el) return;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const now = new Date();
    el.textContent = months[now.getMonth()] + ' ' + now.getFullYear();
  }

  // ── Boot ────────────────────────────────────────────────────
  function boot() {
    setFiledDate();
    fetch(DATA_URL, { cache: 'no-cache' })
      .then(r => r.json())
      .then((data) => {
        state.indicators = data.indicators || [];
        // Determine year max from data
        let yMax = 2025;
        state.indicators.forEach((ind) => {
          ind.series.forEach(([y]) => { if (y > yMax) yMax = y; });
        });
        state.yearMax = yMax;
        state.activeYear = yMax;
        const range = document.getElementById('bl-year-range');
        if (range) {
          range.max = yMax;
          range.value = yMax;
        }
        setText('bl-year-value', yMax);
        buildLedger();
        renderHeroCharts();
        wireControls();
      })
      .catch((err) => {
        console.error('[better-lab] failed to load indicators:', err);
        const ledger = document.getElementById('bl-ledger');
        if (ledger) {
          ledger.innerHTML = '<div class="bl-ledger-empty mono">Could not load indicators. Try refreshing.</div>';
        }
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
