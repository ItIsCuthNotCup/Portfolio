/* ═══════════════════════════════════════════════════════════
   PRODUCTIVITY PREDICTIONS LAB (TEST. 04) — vanilla SVG, no library.
   Renders predictions from /assets/data/productivity-predictions/.
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const PREDICTIONS_URL = '/assets/data/productivity-predictions/predictions.json?v=1';
  const BLS_URL = '/assets/data/productivity-predictions/bls-productivity.json?v=1';

  /* Category → CSS class (for color) */
  const CAT_CLASS = {
    'general-it-paradox': 'pp-cat-general',
    'ai-aggregate-tfp': 'pp-cat-ai-tfp',
    'ai-labor-productivity': 'pp-cat-ai-lp',
    'ai-sector-specific': 'pp-cat-ai-sector',
    'ai-gdp-level': 'pp-cat-ai-gdp',
    'wage-effects': 'pp-cat-wage',
    'agi-singularity': 'pp-cat-agi',
  };

  /* Outcome → shape type */
  const OUTCOME_SHAPE = {
    'did-not-happen': 'circle-open',
    'did-not-happen-yet': 'circle-open',
    'fulfilled-with-delay': 'circle-closed',
    'fulfilled-on-time': 'star',
    'partially-fulfilled': 'circle-closed',
    'pending': 'square',
    'unclear': 'diamond',
    'anchor-quote': 'diamond',
  };

  /* Stance → border color */
  const STANCE_STROKE = {
    'bullish': 'var(--accent)',
    'bearish': 'oklch(0.45 0.10 240)',
    'neutral': 'var(--ink-dim)',
  };

  /* Era definitions for small multiples */
  const ERAS = [
    { key: 'pre-paradox', label: 'Pre-Paradox (1978-87)', min: 1978, max: 1987 },
    { key: 'origin', label: 'Origin Era (1987-95)', min: 1987, max: 1995 },
    { key: 'boom', label: 'Boom (1995-2004)', min: 1995, max: 2004 },
    { key: 'slowdown', label: 'Slowdown (2004-15)', min: 2004, max: 2015 },
    { key: 'ai-prelude', label: 'AI Prelude (2015-22)', min: 2015, max: 2022 },
    { key: 'chatgpt', label: 'ChatGPT Era (2022-26)', min: 2022, max: 2026 },
  ];

  /* Narrative breadcrumbs */
  const NARRATIVE = {
    1987: 'Solow: "You can see the computer age everywhere but in the productivity statistics."',
    1993: 'Brynjolfsson frames the paradox in the academic literature.',
    1995: 'Greenspan declares the productivity pickup is real. The boom begins.',
    2004: 'The acceleration stops. Gordon asks: is growth over?',
    2011: 'Cowen: "The Great Stagnation." Brynjolfsson: "Race Against the Machine."',
    2017: 'McKinsey: $13 trillion from AI by 2030. Acemoglu: robots and jobs.',
    2023: 'Goldman: generative AI could raise GDP by 7%. Acemoglu: ~0.06%/yr TFP.',
  };

  /* ── Utility ────────────────────────────────────────────── */
  const el = (tag, attrs = {}, text = null) => {
    const e = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }
  function jitter(r) {
    const seed = `${r.predictor}${r.year_said}${r.year_targeted}`;
    return (hashStr(seed) % 7 - 3) * 1.6;
  }

  /* ── State ──────────────────────────────────────────────── */
  let PREDICTIONS = null;
  let BLS = null;
  let PLAYHEAD_YEAR = 2026;
  let IS_PLAYING = false;
  let PLAY_RAF = null;
  let PLAY_START_TIME = 0;
  const PLAY_DURATION_MS = 10000;
  const PLAY_FROM = 1987;
  const PLAY_TO = 2026;

  let ACTIVE_TYPE = 'all';
  let ACTIVE_CAT = 'all';
  let ZOOM_KEY = 'all';
  let OVERLAY_VISIBLE = true;
  let RBL_MODE = false;

  const ZOOM_LEVELS = {
    all:    { xMin: 1985, xMax: 2050, tickStep: 10, label: 'All (1985-2050)' },
    modern: { xMin: 1995, xMax: 2050, tickStep: 5,  label: 'Modern (1995+)' },
    recent: { xMin: 2015, xMax: 2050, tickStep: 2,  label: 'Recent (2015+)' },
  };

  /* ── Data load ──────────────────────────────────────────── */
  async function loadData() {
    try {
      const [pres, blsres] = await Promise.all([
        fetch(PREDICTIONS_URL),
        fetch(BLS_URL)
      ]);
      const pData = await pres.json();
      const bData = await blsres.json();
      PREDICTIONS = pData.rows;
      BLS = bData;
      init();
    } catch (err) {
      console.error('PP lab: failed to load data', err);
      PREDICTIONS = [];
      BLS = { labor_productivity: [], tfp: [] };
    }
  }

  /* ── Filter logic ───────────────────────────────────────── */
  function filteredRows() {
    return PREDICTIONS.filter(r => {
      if (ACTIVE_TYPE !== 'all' && r.predictor_type !== ACTIVE_TYPE) return false;
      if (ACTIVE_CAT !== 'all' && r.category !== ACTIVE_CAT) return false;
      if (r.year_said > PLAYHEAD_YEAR) return false;
      return true;
    });
  }

  function plottableRows() {
    return filteredRows().filter(r => r.year_targeted != null);
  }

  function eraRows(era) {
    return PREDICTIONS.filter(r => {
      if (r.year_said < era.min || r.year_said >= era.max) return false;
      return true;
    });
  }

  /* ── Stats ──────────────────────────────────────────────── */
  function updateCounters(rows) {
    const plottable = rows.filter(r => r.year_targeted != null);
    document.getElementById('pp-counter-preds').textContent = rows.length;
    if (plottable.length === 0) {
      document.getElementById('pp-counter-median').textContent = '—';
      document.getElementById('pp-counter-lift').textContent = '—';
      return;
    }
    const targets = plottable.map(r => r.year_targeted).sort((a, b) => a - b);
    const median = targets[Math.floor(targets.length / 2)];
    const gaps = plottable.map(r => r.year_targeted - r.year_said);
    const avgGap = (gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1);
    document.getElementById('pp-counter-median').textContent = median;
    document.getElementById('pp-counter-lift').textContent = avgGap + ' yr';
  }

  /* ── Chart geometry ─────────────────────────────────────── */
  function chartGeometry(svgW, svgH, margin, zoom) {
    const zm = ZOOM_LEVELS[zoom];
    const xMin = zm.xMin, xMax = zm.xMax;
    const yMin = RBL_MODE ? -2 : 1985;
    const yMax = RBL_MODE ? 14 : 2050;
    const innerW = svgW - margin.left - margin.right;
    const innerH = svgH - margin.top - margin.bottom;
    const xScale = (v) => margin.left + ((v - xMin) / (xMax - xMin)) * innerW;
    const yScale = (v) => margin.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
    return { xMin, xMax, yMin, yMax, innerW, innerH, xScale, yScale, margin };
  }

  /* ── Draw main chart ────────────────────────────────────── */
  function drawMainChart() {
    const svg = document.getElementById('pp-horizon');
    if (!svg || !PREDICTIONS) return;
    svg.innerHTML = '';
    const W = 1280, H = 540;
    const margin = { top: 30, right: 40, bottom: 50, left: 60 };
    const g = chartGeometry(W, H, margin, ZOOM_KEY);

    // Grid lines
    for (let y = g.yMin; y <= g.yMax; y += RBL_MODE ? 2 : 10) {
      if (y === g.yMin || y === g.yMax) continue;
      svg.appendChild(el('line', { x1: g.margin.left, y1: g.yScale(y), x2: W - g.margin.right, y2: g.yScale(y), class: 'pp-grid-line' }));
    }
    for (let x = g.xMin; x <= g.xMax; x += ZOOM_LEVELS[ZOOM_KEY].tickStep) {
      if (x === g.xMin || x === g.xMax) continue;
      svg.appendChild(el('line', { x1: g.xScale(x), y1: g.margin.top, x2: g.xScale(x), y2: H - g.margin.bottom, class: 'pp-grid-line' }));
    }

    // Axes
    svg.appendChild(el('line', { x1: g.margin.left, y1: H - g.margin.bottom, x2: W - g.margin.right, y2: H - g.margin.bottom, class: 'pp-axis-line' }));
    svg.appendChild(el('line', { x1: g.margin.left, y1: g.margin.top, x2: g.margin.left, y2: H - g.margin.bottom, class: 'pp-axis-line' }));

    // X labels
    for (let x = g.xMin; x <= g.xMax; x += ZOOM_LEVELS[ZOOM_KEY].tickStep) {
      svg.appendChild(el('text', { x: g.xScale(x), y: H - g.margin.bottom + 22, 'text-anchor': 'middle', class: 'pp-axis-text' }, String(x)));
    }
    svg.appendChild(el('text', { x: W / 2, y: H - 10, 'text-anchor': 'middle', class: 'pp-axis-text-bold' }, 'Year said'));

    // Y labels
    for (let y = g.yMin; y <= g.yMax; y += RBL_MODE ? 2 : 10) {
      svg.appendChild(el('text', { x: g.margin.left - 10, y: g.yScale(y) + 4, 'text-anchor': 'end', class: 'pp-axis-text' }, String(y)));
    }
    const yLabel = RBL_MODE ? 'Years late' : 'Year targeted';
    svg.appendChild(el('text', { x: 18, y: H / 2, 'text-anchor': 'middle', transform: `rotate(-90, 18, ${H/2})`, class: 'pp-axis-text-bold' }, yLabel));

    // Diagonal (only in normal mode)
    if (!RBL_MODE) {
      const dStart = Math.max(g.xMin, g.yMin);
      const dEnd = Math.min(g.xMax, g.yMax);
      svg.appendChild(el('line', {
        x1: g.xScale(dStart), y1: g.yScale(dStart),
        x2: g.xScale(dEnd), y2: g.yScale(dEnd),
        class: 'pp-ref-diagonal'
      }));
      svg.appendChild(el('text', {
        x: g.xScale(dEnd) + 8, y: g.yScale(dEnd) - 6,
        class: 'pp-ref-diagonal'
      }, 'Present'));
    }

    // Playhead
    const px = g.xScale(PLAYHEAD_YEAR);
    svg.appendChild(el('line', { x1: px, y1: g.margin.top, x2: px, y2: H - g.margin.bottom, class: 'pp-playhead' }));
    svg.appendChild(el('text', { x: px + 6, y: g.margin.top + 14, class: 'pp-playhead-label' }, String(PLAYHEAD_YEAR)));

    // Productivity overlay
    if (OVERLAY_VISIBLE && !RBL_MODE && BLS && BLS.labor_productivity) {
      drawOverlay(svg, g, W, H);
    }

    // Points
    const rows = filteredRows();
    updateCounters(rows);

    rows.forEach(r => {
      const shapeType = OUTCOME_SHAPE[r.outcome] || 'circle-open';
      const catClass = CAT_CLASS[r.category] || 'pp-cat-general';
      const cx = g.xScale(r.year_said) + jitter(r);
      let cy;
      if (RBL_MODE) {
        if (r.outcome !== 'fulfilled-with-delay' && r.outcome !== 'fulfilled-on-time') return;
        const delay = (r.year_targeted - r.year_said) > 0 ? (r.year_targeted - r.year_said) : 0;
        cy = g.yScale(delay);
      } else {
        if (r.year_targeted == null) {
          // Horizontal bar for no-target predictions
          const y = g.yScale(g.yMin + (g.yMax - g.yMin) * 0.05);
          svg.appendChild(el('line', {
            x1: cx - 12, y1: y, x2: cx + 12, y2: y,
            stroke: 'var(--ink-dim)', 'stroke-width': 2, opacity: 0.5
          }));
          return;
        }
        cy = g.yScale(r.year_targeted);
      }

      const size = r.predictor_type === 'government' || r.predictor_type === 'central-bank' ? 5 :
                   r.predictor_type === 'consultancy' ? 4.5 :
                   r.predictor_type === 'sell-side' ? 3.5 : 4;
      const strokeColor = STANCE_STROKE[r.stance] || 'var(--ink-dim)';

      let shape;
      if (shapeType === 'circle-open') {
        shape = el('circle', { cx, cy, r: size, class: catClass, fill: 'none', 'stroke-width': 1.5, stroke: strokeColor });
      } else if (shapeType === 'circle-closed') {
        shape = el('circle', { cx, cy, r: size, class: catClass, fill: 'currentColor', 'stroke-width': 1.5, stroke: strokeColor });
      } else if (shapeType === 'square') {
        shape = el('rect', { x: cx - size, y: cy - size, width: size * 2, height: size * 2, class: catClass, fill: 'none', 'stroke-width': 1.5, stroke: strokeColor });
      } else if (shapeType === 'diamond') {
        const d = `M ${cx} ${cy - size} L ${cx + size} ${cy} L ${cx} ${cy + size} L ${cx - size} ${cy} Z`;
        shape = el('path', { d, class: catClass, fill: 'none', 'stroke-width': 1.5, stroke: strokeColor });
      } else if (shapeType === 'star') {
        shape = el('circle', { cx, cy, r: size + 1, class: catClass, fill: 'currentColor', 'stroke-width': 1.5, stroke: strokeColor });
      }

      if (shape) {
        shape.dataset.id = r.id;
        shape.classList.add('pp-point');
        shape.addEventListener('mouseenter', (e) => showTooltip(e, r, cx, cy));
        shape.addEventListener('mouseleave', hideTooltip);
        shape.addEventListener('click', () => openSidePanel(r));
        svg.appendChild(shape);
      }
    });

    // Update ticker
    updateTicker();
  }

  /* ── Productivity overlay ───────────────────────────────── */
  function drawOverlay(svg, g, W, H) {
    const lp = BLS.labor_productivity;
    if (!lp || lp.length === 0) return;

    // Draw labor productivity as a faint area at the bottom
    const overlayH = g.innerH * 0.18;
    const overlayTop = H - g.margin.bottom - overlayH;
    const minGrowth = -2, maxGrowth = 4.5;

    let d = `M ${g.xScale(lp[0].year)} ${overlayTop + overlayH}`;
    lp.forEach(pt => {
      const x = g.xScale(pt.year);
      const y = overlayTop + overlayH - ((clamp(pt.yoy_growth, minGrowth, maxGrowth) - minGrowth) / (maxGrowth - minGrowth)) * overlayH;
      d += ` L ${x} ${y}`;
    });
    d += ` L ${g.xScale(lp[lp.length - 1].year)} ${overlayTop + overlayH} Z`;

    svg.appendChild(el('path', { d, class: 'pp-overlay-area' }));

    // Line
    let lineD = '';
    lp.forEach((pt, i) => {
      const x = g.xScale(pt.year);
      const y = overlayTop + overlayH - ((clamp(pt.yoy_growth, minGrowth, maxGrowth) - minGrowth) / (maxGrowth - minGrowth)) * overlayH;
      lineD += (i === 0 ? 'M' : 'L') + ` ${x} ${y}`;
    });
    svg.appendChild(el('path', { d: lineD, class: 'pp-overlay-line' }));

    // Label
    svg.appendChild(el('text', {
      x: g.margin.left + 6, y: overlayTop + 12,
      class: 'pp-overlay-label'
    }, 'BLS labor productivity'));

    // TFP line (dashed)
    if (BLS.tfp && BLS.tfp.length > 0) {
      let tfpD = '';
      BLS.tfp.forEach((pt, i) => {
        const x = g.xScale(pt.year);
        const y = overlayTop + overlayH - ((clamp(pt.yoy_growth, minGrowth, maxGrowth) - minGrowth) / (maxGrowth - minGrowth)) * overlayH;
        tfpD += (i === 0 ? 'M' : 'L') + ` ${x} ${y}`;
      });
      svg.appendChild(el('path', { d: tfpD, class: 'pp-overlay-tfp' }));
    }
  }

  /* ── Tooltip ────────────────────────────────────────────── */
  function showTooltip(e, r, cx, cy) {
    const tt = document.getElementById('pp-tooltip');
    const wrap = document.getElementById('pp-horizon-wrap');
    const rect = wrap.getBoundingClientRect();
    let html = `<div class="tt-name">${r.predictor}</div>`;
    html += `<div class="tt-meta">${r.institution} &middot; ${r.year_said}`;
    if (r.year_targeted) html += ` &rarr; ${r.year_targeted}`;
    html += `</div>`;
    html += `<div class="tt-quote">"${r.quote.substring(0, 120)}${r.quote.length > 120 ? '...' : ''}"</div>`;
    tt.innerHTML = html;
    tt.hidden = false;
    const ttRect = tt.getBoundingClientRect();
    let left = rect.left + cx + 12;
    let top = rect.top + cy - ttRect.height / 2;
    if (left + ttRect.width > window.innerWidth - 20) left = rect.left + cx - ttRect.width - 12;
    tt.style.left = left + 'px';
    tt.style.top = top + 'px';
  }

  function hideTooltip() {
    document.getElementById('pp-tooltip').hidden = true;
  }

  /* ── Side panel ─────────────────────────────────────────── */
  function openSidePanel(r) {
    const panel = document.getElementById('pp-side-panel');
    const backdrop = document.getElementById('pp-side-backdrop');
    const content = document.getElementById('pp-side-content');

    let html = `<div class="sp-name">${r.predictor}</div>`;
    html += `<div class="sp-role">${r.institution} &middot; ${r.predictor_type}</div>`;
    html += `<div class="sp-quote">"${r.quote}"</div>`;
    html += `<div class="sp-meta">`;
    html += `<span class="label">Context</span>${r.context}`;
    html += `<span class="label">Year said</span>${r.year_said}`;
    if (r.year_targeted) html += `<span class="label">Year targeted</span>${r.year_targeted}`;
    html += `<span class="label">Metric</span>${r.metric_predicted}`;
    if (r.magnitude_predicted) html += `<span class="label">Magnitude</span>${r.magnitude_predicted} bps`;
    html += `<span class="label">Stance</span>${r.stance}`;
    html += `<span class="label">Outcome</span>${r.outcome}`;
    if (r.outcome_note) html += `<span class="label">Note</span>${r.outcome_note}`;
    if (r.source_url) html += `<span class="label">Source</span><a href="${r.source_url}" target="_blank" rel="noopener">${r.source_url.substring(0, 60)}${r.source_url.length > 60 ? '...' : ''} &#8599;</a>`;
    html += `<span class="label">Confidence</span>${r.verification_confidence}`;
    html += `</div>`;

    content.innerHTML = html;
    panel.dataset.open = 'true';
    backdrop.dataset.open = 'true';
  }

  function closeSidePanel() {
    document.getElementById('pp-side-panel').dataset.open = 'false';
    document.getElementById('pp-side-backdrop').dataset.open = 'false';
  }

  /* ── Narrative ticker ───────────────────────────────────── */
  function updateTicker() {
    const text = document.getElementById('pp-ticker-text');
    const years = Object.keys(NARRATIVE).map(Number).sort((a, b) => a - b);
    let msg = 'Press play and the chart fills decade by decade.';
    for (let i = years.length - 1; i >= 0; i--) {
      if (PLAYHEAD_YEAR >= years[i]) {
        msg = NARRATIVE[years[i]];
        break;
      }
    }
    text.textContent = msg;
  }

  /* ── Play animation ─────────────────────────────────────── */
  function togglePlay() {
    if (IS_PLAYING) {
      stopPlay();
    } else {
      startPlay();
    }
  }

  function startPlay() {
    IS_PLAYING = true;
    PLAY_START_TIME = performance.now();
    document.getElementById('pp-play-btn').classList.add('is-playing');
    document.getElementById('pp-play-btn').textContent = 'Pause';
    PLAY_RAF = requestAnimationFrame(playLoop);
  }

  function stopPlay() {
    IS_PLAYING = false;
    if (PLAY_RAF) cancelAnimationFrame(PLAY_RAF);
    document.getElementById('pp-play-btn').classList.remove('is-playing');
    document.getElementById('pp-play-btn').textContent = 'Play the forty years';
  }

  function playLoop(now) {
    if (!IS_PLAYING) return;
    const elapsed = now - PLAY_START_TIME;
    const t = clamp(elapsed / PLAY_DURATION_MS, 0, 1);
    PLAYHEAD_YEAR = Math.floor(lerp(PLAY_FROM, PLAY_TO, t));
    document.getElementById('pp-counter-year').textContent = PLAYHEAD_YEAR;
    drawMainChart();
    if (t >= 1) {
      stopPlay();
      return;
    }
    PLAY_RAF = requestAnimationFrame(playLoop);
  }

  /* ── Small multiples ────────────────────────────────────── */
  function drawMultiples() {
    const grid = document.getElementById('pp-multiples-grid');
    if (!grid || !PREDICTIONS) return;
    grid.innerHTML = '';

    ERAS.forEach(era => {
      const container = document.createElement('div');
      container.className = 'pp-multiple';
      const title = document.createElement('div');
      title.className = 'pp-multiple-title';
      title.textContent = era.label;
      container.appendChild(title);

      const svg = el('svg', { viewBox: '0 0 560 280', preserveAspectRatio: 'xMidYMid meet', role: 'img' });
      const W = 560, H = 280;
      const margin = { top: 20, right: 20, bottom: 30, left: 40 };
      const g = chartGeometry(W, H, margin, 'all');

      // Axes
      svg.appendChild(el('line', { x1: margin.left, y1: H - margin.bottom, x2: W - margin.right, y2: H - margin.bottom, class: 'pp-axis-line' }));
      svg.appendChild(el('line', { x1: margin.left, y1: margin.top, x2: margin.left, y2: H - margin.bottom, class: 'pp-axis-line' }));

      // Diagonal
      const dStart = Math.max(g.xMin, g.yMin);
      const dEnd = Math.min(g.xMax, g.yMax);
      svg.appendChild(el('line', {
        x1: g.xScale(dStart), y1: g.yScale(dStart),
        x2: g.xScale(dEnd), y2: g.yScale(dEnd),
        class: 'pp-ref-diagonal'
      }));

      // Points
      const rows = eraRows(era).filter(r => r.year_targeted != null);
      rows.forEach(r => {
        const catClass = CAT_CLASS[r.category] || 'pp-cat-general';
        const cx = g.xScale(r.year_said);
        const cy = g.yScale(r.year_targeted);
        const shape = el('circle', { cx, cy, r: 3, class: catClass, fill: 'currentColor', 'stroke-width': 0 });
        svg.appendChild(shape);
      });

      container.appendChild(svg);
      grid.appendChild(container);
    });
  }

  /* ── Right but Late chart ───────────────────────────────── */
  function drawRBLChart() {
    const svg = document.getElementById('pp-rbl-chart');
    if (!svg || !PREDICTIONS) return;
    svg.innerHTML = '';
    const W = 1100, H = 360;
    const margin = { top: 30, right: 40, bottom: 50, left: 60 };
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;

    const fulfilled = PREDICTIONS.filter(r =>
      (r.outcome === 'fulfilled-with-delay' || r.outcome === 'fulfilled-on-time') && r.year_targeted != null
    );

    const delays = fulfilled.map(r => r.year_targeted - r.year_said).filter(d => d >= 0);
    const maxDelay = Math.max(...delays, 10);

    const xScale = (v) => margin.left + ((v - 1985) / (2026 - 1985)) * innerW;
    const yScale = (v) => margin.top + innerH - (v / maxDelay) * innerH;

    // Axes
    svg.appendChild(el('line', { x1: margin.left, y1: H - margin.bottom, x2: W - margin.right, y2: H - margin.bottom, class: 'pp-axis-line' }));
    svg.appendChild(el('line', { x1: margin.left, y1: margin.top, x2: margin.left, y2: H - margin.bottom, class: 'pp-axis-line' }));

    // Labels
    for (let x = 1985; x <= 2025; x += 10) {
      svg.appendChild(el('text', { x: xScale(x), y: H - margin.bottom + 22, 'text-anchor': 'middle', class: 'pp-axis-text' }, String(x)));
    }
    svg.appendChild(el('text', { x: W / 2, y: H - 10, 'text-anchor': 'middle', class: 'pp-axis-text-bold' }, 'Year said'));

    for (let y = 0; y <= maxDelay; y += 2) {
      svg.appendChild(el('text', { x: margin.left - 10, y: yScale(y) + 4, 'text-anchor': 'end', class: 'pp-axis-text' }, String(y)));
    }
    svg.appendChild(el('text', { x: 18, y: H / 2, 'text-anchor': 'middle', transform: `rotate(-90, 18, ${H/2})`, class: 'pp-axis-text-bold' }, 'Years late'));

    // Points
    fulfilled.forEach(r => {
      const delay = r.year_targeted - r.year_said;
      const cx = xScale(r.year_said);
      const cy = yScale(delay);
      const catClass = CAT_CLASS[r.category] || 'pp-cat-general';
      const shape = el('circle', { cx, cy, r: 5, class: catClass, fill: 'currentColor', 'stroke-width': 0 });
      shape.dataset.id = r.id;
      shape.classList.add('pp-point');
      shape.addEventListener('mouseenter', (e) => {
        const tt = document.getElementById('pp-tooltip');
        const wrap = document.getElementById('pp-rbl-wrap');
        const rect = wrap.getBoundingClientRect();
        tt.innerHTML = `<div class="tt-name">${r.predictor}</div><div class="tt-meta">${r.institution} &middot; +${delay} years late</div>`;
        tt.hidden = false;
        tt.style.left = (rect.left + cx + 12) + 'px';
        tt.style.top = (rect.top + cy - 20) + 'px';
      });
      shape.addEventListener('mouseleave', hideTooltip);
      shape.addEventListener('click', () => openSidePanel(r));
      svg.appendChild(shape);
    });
  }

  /* ── Archive table ──────────────────────────────────────── */
  function renderArchive() {
    const tbody = document.getElementById('pp-archive-body');
    if (!tbody || !PREDICTIONS) return;
    tbody.innerHTML = '';

    const eraFilter = document.getElementById('pp-filter-era').value;
    const outcomeFilter = document.getElementById('pp-filter-outcome').value;
    const stanceFilter = document.getElementById('pp-filter-stance').value;

    let rows = [...PREDICTIONS];
    if (eraFilter !== 'all') {
      const era = ERAS.find(e => e.key === eraFilter);
      if (era) rows = rows.filter(r => r.year_said >= era.min && r.year_said < era.max);
    }
    if (outcomeFilter !== 'all') rows = rows.filter(r => r.outcome === outcomeFilter);
    if (stanceFilter !== 'all') rows = rows.filter(r => r.stance === stanceFilter);

    rows.forEach(r => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.innerHTML = `
        <td class="pp-td-predictor">${r.predictor}</td>
        <td class="pp-td-institution">${r.institution}</td>
        <td>${r.year_said}</td>
        <td>${r.year_targeted || '—'}</td>
        <td class="pp-td-magnitude">${r.magnitude_predicted ? r.magnitude_predicted + ' bps' : '—'}</td>
        <td>${r.metric_predicted}</td>
        <td class="pp-td-outcome">${r.outcome.replace(/-/g, ' ')}</td>
        <td class="pp-td-confidence-${r.verification_confidence}">${r.verification_confidence}</td>
      `;
      tr.addEventListener('click', () => {
        const expand = document.getElementById('pp-expand-' + r.id);
        if (expand) {
          expand.classList.toggle('is-open');
        } else {
          const expandTr = document.createElement('tr');
          expandTr.id = 'pp-expand-' + r.id;
          expandTr.className = 'pp-archive-row-expand is-open';
          expandTr.innerHTML = `<td colspan="8">
            <div class="pp-expand-quote">"${r.quote}"</div>
            <div class="pp-expand-meta">${r.context}${r.source_url ? ' &middot; <a href="' + r.source_url + '" target="_blank" rel="noopener">Source &#8599;</a>' : ''}</div>
          </td>`;
          tr.parentNode.insertBefore(expandTr, tr.nextSibling);
        }
      });
      tbody.appendChild(tr);
    });
  }

  /* ── Cross-link mini chart ──────────────────────────────── */
  function drawCrosslinkChart() {
    const container = document.getElementById('pp-crosslink-chart');
    if (!container || !BLS) return;
    container.innerHTML = '';

    const svg = el('svg', { viewBox: '0 0 400 200', preserveAspectRatio: 'xMidYMid meet', role: 'img' });
    const W = 400, H = 200;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;

    const lp = BLS.labor_productivity;
    if (!lp || lp.length === 0) return;

    const minGrowth = -2, maxGrowth = 4.5;
    const xScale = (v) => margin.left + ((v - 1985) / (2025 - 1985)) * innerW;
    const yScale = (v) => margin.top + innerH - ((clamp(v, minGrowth, maxGrowth) - minGrowth) / (maxGrowth - minGrowth)) * innerH;

    // Area
    let d = `M ${xScale(lp[0].year)} ${margin.top + innerH}`;
    lp.forEach(pt => { d += ` L ${xScale(pt.year)} ${yScale(pt.yoy_growth)}`; });
    d += ` L ${xScale(lp[lp.length - 1].year)} ${margin.top + innerH} Z`;
    svg.appendChild(el('path', { d, class: 'pp-overlay-area' }));

    // Line
    let lineD = '';
    lp.forEach((pt, i) => {
      lineD += (i === 0 ? 'M' : 'L') + ` ${xScale(pt.year)} ${yScale(pt.yoy_growth)}`;
    });
    svg.appendChild(el('path', { d: lineD, class: 'pp-overlay-line' }));

    // Axis labels
    svg.appendChild(el('text', { x: margin.left, y: H - 8, class: 'pp-axis-text' }, '1985'));
    svg.appendChild(el('text', { x: W - margin.right, y: H - 8, 'text-anchor': 'end', class: 'pp-axis-text' }, '2025'));
    svg.appendChild(el('text', { x: W / 2, y: 14, 'text-anchor': 'middle', class: 'pp-overlay-label' }, 'BLS labor productivity growth'));

    container.appendChild(svg);
  }

  /* ── Event wiring ───────────────────────────────────────── */
  function init() {
    // Play button
    document.getElementById('pp-play-btn').addEventListener('click', togglePlay);

    // Type filter pills
    document.getElementById('pp-type-filter').addEventListener('click', (e) => {
      if (!e.target.classList.contains('pp-pill')) return;
      document.querySelectorAll('#pp-type-filter .pp-pill').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      ACTIVE_TYPE = e.target.dataset.type;
      drawMainChart();
    });

    // Category filter pills
    document.getElementById('pp-cat-filter').addEventListener('click', (e) => {
      if (!e.target.classList.contains('pp-pill')) return;
      if (e.target.id === 'pp-toggle-overlay') {
        OVERLAY_VISIBLE = !OVERLAY_VISIBLE;
        e.target.dataset.active = OVERLAY_VISIBLE;
        drawMainChart();
        return;
      }
      if (e.target.id === 'pp-toggle-rbl') {
        RBL_MODE = !RBL_MODE;
        e.target.dataset.active = RBL_MODE;
        drawMainChart();
        return;
      }
      document.querySelectorAll('#pp-cat-filter .pp-pill[data-cat]').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      ACTIVE_CAT = e.target.dataset.cat;
      drawMainChart();
    });

    // Zoom pills
    document.getElementById('pp-zoom-filter').addEventListener('click', (e) => {
      if (!e.target.classList.contains('pp-zoom-pill')) return;
      document.querySelectorAll('#pp-zoom-filter .pp-zoom-pill').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      ZOOM_KEY = e.target.dataset.zoom;
      drawMainChart();
    });

    // Side panel close
    document.getElementById('pp-side-close').addEventListener('click', closeSidePanel);
    document.getElementById('pp-side-backdrop').addEventListener('click', closeSidePanel);

    // Archive filters
    document.getElementById('pp-filter-era').addEventListener('change', renderArchive);
    document.getElementById('pp-filter-outcome').addEventListener('change', renderArchive);
    document.getElementById('pp-filter-stance').addEventListener('change', renderArchive);

    // Initial render
    drawMainChart();
    drawMultiples();
    drawRBLChart();
    renderArchive();
    drawCrosslinkChart();

    // Counter year display
    document.getElementById('pp-counter-year').textContent = PLAYHEAD_YEAR;

    // Resize handler
    window.addEventListener('resize', () => {
      drawMainChart();
      drawRBLChart();
    });
  }

  // Start
  loadData();

})();
