/* ═══════════════════════════════════════════════════════════
   ESCAPE VELOCITY — FIG. 13
   Seven charts. Vanilla JS + SVG. No frameworks.
   ═══════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  // ── Data loading ────────────────────────────────────────────
  const DATA_PATHS = {
    compute: '/assets/data/escape-velocity/compute.json',
    algorithms: '/assets/data/escape-velocity/algorithms.json',
    metr: '/assets/data/escape-velocity/metr-horizon.json',
    cost: '/assets/data/escape-velocity/cost.json',
    benchmarks: '/assets/data/escape-velocity/benchmarks.json',
    limits: '/assets/data/escape-velocity/limits.json',
    historical: '/assets/data/escape-velocity/historical.json'
  };

  let evData = {};

  async function loadData() {
    const entries = Object.entries(DATA_PATHS);
    const results = await Promise.all(
      entries.map(([key, path]) =>
        fetch(path).then(r => r.json()).catch(e => {
          console.error('Failed to load', path, e);
          return null;
        })
      )
    );
    entries.forEach(([key], i) => { evData[key] = results[i]; });
    initCharts();
  }

  // ── SVG utilities ───────────────────────────────────────────
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  function makeScale(domain, range, type = 'linear') {
    const d0 = domain[0], d1 = domain[1];
    const r0 = range[0], r1 = range[1];
    if (type === 'log') {
      const ld0 = Math.log10(d0), ld1 = Math.log10(d1);
      return v => r0 + (Math.log10(v) - ld0) / (ld1 - ld0) * (r1 - r0);
    }
    return v => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
  }

  function niceLogTicks(min, max) {
    const ticks = [];
    const startPow = Math.floor(Math.log10(min));
    const endPow = Math.ceil(Math.log10(max));
    const decades = endPow - startPow;
    // Reduce tick density for very wide ranges
    let multipliers;
    if (decades > 10) multipliers = [1];
    else if (decades > 6) multipliers = [1, 5];
    else multipliers = [1, 2, 5];
    for (let p = startPow; p <= endPow; p++) {
      const base = Math.pow(10, p);
      multipliers.forEach(m => {
        const t = base * m;
        if (t >= min && t <= max) ticks.push(t);
      });
    }
    return ticks;
  }

  const SUPERSCRIPT = {
    '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','-':'⁻'
  };
  function toSuperscript(n) {
    return String(n).split('').map(c => SUPERSCRIPT[c] || c).join('');
  }

  function formatNumber(n) {
    // For very large or very small numbers, use compact scientific notation
    if (n === 0) return '0';
    const abs = Math.abs(n);
    const exp = Math.floor(Math.log10(abs));
    if (abs >= 1e12 || abs < 0.01) {
      const mant = (abs / Math.pow(10, exp)).toFixed(1).replace(/\.0$/, '');
      return mant + '×10' + toSuperscript(exp);
    }
    if (abs >= 1e9) return (abs / 1e9).toFixed(0) + 'B';
    if (abs >= 1e6) return (abs / 1e6).toFixed(0) + 'M';
    if (abs >= 1e3) return (abs / 1e3).toFixed(0) + 'K';
    if (abs >= 1) return abs.toFixed(0);
    return abs.toFixed(2);
  }

  // ── Tooltip system ──────────────────────────────────────────
  function setupTooltip(svgWrap, tooltipEl) {
    return function show(html, x, y) {
      tooltipEl.innerHTML = html;
      tooltipEl.hidden = false;
      const rect = svgWrap.getBoundingClientRect();
      let left = x + 12, top = y + 12;
      if (left + tooltipEl.offsetWidth > rect.width) left = x - tooltipEl.offsetWidth - 8;
      if (top + tooltipEl.offsetHeight > rect.height) top = y - tooltipEl.offsetHeight - 8;
      tooltipEl.style.left = left + 'px';
      tooltipEl.style.top = top + 'px';
    };
  }
  function hideTooltip(tooltipEl) { tooltipEl.hidden = true; }

  // ── Chart 1: Compute Curve ──────────────────────────────────
  function renderComputeChart() {
    const data = evData.compute;
    if (!data) return;
    const svg = document.getElementById('ev-compute');
    const wrap = document.getElementById('ev-compute-wrap');
    const tip = document.getElementById('ev-tooltip-compute');
    const showTip = setupTooltip(wrap, tip);
    const W = 1100, H = 520, M = { t: 30, r: 60, b: 50, l: 76 };

    const allModels = data.models;
    const RANGE_STARTS = { all: null, modern: 2010, recent: 2018, last5: 2021 };
    const eraDotColors = { 'pre-dl': '#A89BB8', 'dl': '#5B9BD5', 'scaling': '#FF6B3D' };
    let currentRange = 'all';
    let currentEra = 'all';
    const curveOn = { moore: true, exp: true, super: false, fit: false };

    // Best-fit (least-squares) on log10(flop) vs year, for the recent-era data only.
    // The user's question is "is recent growth tracking exponential or super-exponential?"
    // so we fit on 2018+ frontier models — those that drive the current scaling debate.
    function bestFit(modelsForFit) {
      if (modelsForFit.length < 2) return null;
      let sx = 0, sy = 0, sxx = 0, sxy = 0;
      const n = modelsForFit.length;
      modelsForFit.forEach(m => {
        const x = m.year, y = Math.log10(m.flop);
        sx += x; sy += y; sxx += x * x; sxy += x * y;
      });
      const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
      const intercept = (sy - slope * sx) / n;
      const doublingYears = Math.log10(2) / slope;
      return { slope, intercept, doublingYears, doublingMonths: doublingYears * 12 };
    }

    function draw() {
      svg.innerHTML = '';

      const startYear = RANGE_STARTS[currentRange];
      const visible = startYear === null ? allModels : allModels.filter(m => m.year >= startYear);
      if (visible.length === 0) return;

      const years = visible.map(d => d.year);
      const flops = visible.map(d => d.flop);
      const xPad = currentRange === 'all' ? 2 : 0.5;
      const xDomain = [Math.min(...years) - xPad, Math.max(...years) + xPad];
      const minPow = Math.floor(Math.log10(Math.min(...flops)));
      const maxPow = Math.ceil(Math.log10(Math.max(...flops)));
      const yDomain = [Math.pow(10, minPow - 0.2), Math.pow(10, maxPow + 0.4)];
      const xScale = makeScale(xDomain, [M.l, W - M.r]);
      const yScale = makeScale(yDomain, [H - M.b, M.t], 'log');

      // ── Grid + axes ──────────────────────────────────────────
      niceLogTicks(yDomain[0], yDomain[1]).forEach(t => {
        const y = yScale(t);
        svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: y, y2: y, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.25 }));
        svg.appendChild(svgEl('text', { x: M.l - 8, y: y + 4, 'text-anchor': 'end', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = formatNumber(t);
      });
      const xTickStep = currentRange === 'all' ? 10 : currentRange === 'modern' ? 2 : 1;
      const xTickStart = Math.ceil(xDomain[0] / xTickStep) * xTickStep;
      for (let y = xTickStart; y <= xDomain[1]; y += xTickStep) {
        const x = xScale(y);
        svg.appendChild(svgEl('line', { x1: x, x2: x, y1: M.t, y2: H - M.b, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.18 }));
        svg.appendChild(svgEl('text', { x, y: H - M.b + 18, 'text-anchor': 'middle', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = y;
      }
      svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));
      svg.appendChild(svgEl('line', { x1: M.l, x2: M.l, y1: M.t, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));

      // ── Era backgrounds (subtle) ─────────────────────────────
      const eraBg = { 'pre-dl': 'transparent', 'dl': 'rgba(91,155,213,0.05)', 'scaling': 'rgba(255,107,61,0.05)' };
      data.eras.forEach(e => {
        const x1 = xScale(Math.max(e.start, xDomain[0]));
        const x2 = xScale(Math.min(e.end, xDomain[1]));
        if (x2 > x1) {
          svg.appendChild(svgEl('rect', { x: x1, y: M.t, width: x2 - x1, height: H - M.t - M.b, fill: eraBg[e.id] || 'transparent' }));
        }
      });

      // ── Reference curves ─────────────────────────────────────
      // All anchored to the earliest visible frontier model so they're comparable.
      const anchor = visible[0];
      const ax = anchor.year, ay = anchor.flop;

      function plotCurve(fn, color, dash, label, alignBelow) {
        const path = svgEl('path', { stroke: color, 'stroke-width': 1.6, 'stroke-dasharray': dash, fill: 'none', opacity: 0.85 });
        let d = '';
        const step = (xDomain[1] - xDomain[0]) / 120;
        for (let yr = xDomain[0]; yr <= xDomain[1]; yr += step) {
          const flop = fn(yr);
          if (flop <= 0 || !isFinite(flop)) continue;
          // Don't draw above plot area
          const py = yScale(Math.min(flop, yDomain[1] * 5));
          if (py < M.t - 20) continue;
          const px = xScale(yr);
          d += (d ? 'L' : 'M') + px.toFixed(1) + ',' + py.toFixed(1);
        }
        path.setAttribute('d', d);
        svg.appendChild(path);
        // Label at the right edge
        const lastFlop = fn(xDomain[1]);
        if (lastFlop > 0 && isFinite(lastFlop)) {
          const ly = Math.max(M.t + 12, Math.min(H - M.b - 4, yScale(Math.min(lastFlop, yDomain[1])) + (alignBelow ? 14 : -6)));
          const lx = W - M.r - 4;
          const lbl = svgEl('text', { x: lx, y: ly, 'text-anchor': 'end', fill: color, 'font-size': 10, 'font-family': 'DM Mono, monospace', 'font-style': 'italic', opacity: 0.95 });
          lbl.textContent = label;
          svg.appendChild(lbl);
        }
      }

      // Moore's Law (2-yr doubling, anchored to its own start)
      if (curveOn.moore) {
        const moore = data.moores_law;
        plotCurve(
          yr => moore.start_flop * Math.pow(2, (yr - moore.start_year) / 2),
          'var(--ink-dim)', '5,4', "Moore's Law (2y)", false
        );
      }
      // AI exponential — 6-month doubling, anchored to first visible frontier model
      if (curveOn.exp) {
        plotCurve(
          yr => ay * Math.pow(2, (yr - ax) * 2),
          '#5B9BD5', '4,3', 'AI exp. (6-mo)', true
        );
      }
      // Super-exponential — doubling time itself shrinks (Kurzweil-flavored).
      // Effective doubling shrinks from 12mo → 4mo over the visible range.
      if (curveOn.super) {
        const yrRange = xDomain[1] - xDomain[0];
        plotCurve(yr => {
          const t = yr - ax;
          // doubling time decays linearly from 1.0 yr to 0.33 yr across 8 years
          const dT = Math.max(0.33, 1.0 - (t / 8) * 0.67);
          // integrate: log2(flop/ay) = ∫ dt/dT(t)
          // approximate via small steps
          let logScaled = 0;
          const steps = Math.max(1, Math.round(t * 10));
          const dt = t / steps;
          for (let i = 0; i < steps; i++) {
            const ti = i * dt;
            const dTi = Math.max(0.33, 1.0 - (ti / 8) * 0.67);
            logScaled += dt / dTi;
          }
          return ay * Math.pow(2, logScaled);
        }, '#FF6B3D', '2,3', 'Super-exp.', false);
      }
      // Best-fit through 2018+ frontier — the "what is the data actually doing right now?" line.
      if (curveOn.fit) {
        const recentFrontier = allModels.filter(m => m.year >= 2018 && m.flop >= 1e22);
        const fit = bestFit(recentFrontier);
        if (fit) {
          plotCurve(
            yr => Math.pow(10, fit.slope * yr + fit.intercept),
            '#D4B970', '6,3', 'Fit (' + fit.doublingMonths.toFixed(1) + ' mo)', true
          );
        }
      }

      // ── Model dots ───────────────────────────────────────────
      // When zoomed-in (not "all"), force every visible model to be labeled.
      const labelEvery = currentRange !== 'all';
      const placed = [];
      const labelW = 70, labelH = 14;

      // Sort by flop ascending so earlier (lower) labels get placed first;
      // helps the higher-flop models steer clear of them.
      const drawn = visible.slice().sort((a, b) => a.flop - b.flop);

      drawn.forEach(m => {
        const cx = xScale(m.year), cy = yScale(m.flop);
        const isEraActive = currentEra === 'all' || m.era === currentEra;
        const fill = eraDotColors[m.era] || '#999';
        const dotR = m.label || labelEvery ? 5 : 3.5;
        const circle = svgEl('circle', {
          cx, cy, r: dotR, fill,
          stroke: 'var(--paper)', 'stroke-width': 1.4,
          'data-model': m.name,
          opacity: isEraActive ? 0.95 : 0.18
        });
        circle.style.cursor = 'pointer';
        circle.addEventListener('mouseenter', e => {
          showTip(`<div class="tt-name">${m.name}</div><div class="tt-meta">${m.year} &middot; ${formatNumber(m.flop)} FLOP</div>`, e.offsetX, e.offsetY);
        });
        circle.addEventListener('mouseleave', () => hideTooltip(tip));
        svg.appendChild(circle);

        if ((m.label || labelEvery) && isEraActive) {
          // Try several offset candidates to avoid overlap with already-placed labels.
          const candidates = [
            { dx: 8, dy: -6, anchor: 'start' },   // upper-right
            { dx: 8, dy: 14, anchor: 'start' },   // lower-right
            { dx: -8, dy: -6, anchor: 'end' },    // upper-left
            { dx: -8, dy: 14, anchor: 'end' },    // lower-left
            { dx: 8, dy: -22, anchor: 'start' },  // higher upper-right
            { dx: 8, dy: 30, anchor: 'start' },   // lower lower-right
            { dx: -8, dy: -22, anchor: 'end' },
            { dx: -8, dy: 30, anchor: 'end' },
          ];
          let chosen = candidates[0];
          let bestOverlap = Infinity;
          for (const c of candidates) {
            const x0 = cx + c.dx + (c.anchor === 'end' ? -labelW : 0);
            const y0 = cy + c.dy - labelH;
            // Skip candidates outside the plot
            if (x0 < M.l || x0 + labelW > W - M.r + 50 || y0 < M.t || y0 > H - M.b) continue;
            const overlap = placed.reduce((sum, p) => {
              const dx = Math.max(0, Math.min(x0 + labelW, p.x0 + labelW) - Math.max(x0, p.x0));
              const dy = Math.max(0, Math.min(y0 + labelH, p.y0 + labelH) - Math.max(y0, p.y0));
              return sum + dx * dy;
            }, 0);
            if (overlap < bestOverlap) { bestOverlap = overlap; chosen = c; if (overlap === 0) break; }
          }
          const lblX = cx + chosen.dx;
          const lblY = cy + chosen.dy;
          const lbl = svgEl('text', { x: lblX, y: lblY, 'text-anchor': chosen.anchor, fill: 'var(--ink)', 'font-size': 10.5, 'font-family': 'DM Mono, monospace', 'data-label': '1' });
          lbl.textContent = m.name;
          svg.appendChild(lbl);
          const x0 = cx + chosen.dx + (chosen.anchor === 'end' ? -labelW : 0);
          const y0 = cy + chosen.dy - labelH;
          placed.push({ x0, y0 });
        }
      });
    }

    // ── Wire up controls (idempotent — replace listeners on each init) ──
    function bindOnce(selector, eventType, handler) {
      document.querySelectorAll(selector).forEach(el => {
        const key = '__ev_bound_' + eventType;
        if (el[key]) el.removeEventListener(eventType, el[key]);
        el[key] = handler;
        el.addEventListener(eventType, handler);
      });
    }

    bindOnce('[data-range]', 'click', function (e) {
      const btn = e.currentTarget;
      document.querySelectorAll('[data-range]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRange = btn.dataset.range;
      draw();
    });
    bindOnce('[data-era]', 'click', function (e) {
      const btn = e.currentTarget;
      document.querySelectorAll('[data-era]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentEra = btn.dataset.era;
      draw();
    });
    bindOnce('[data-curve]', 'click', function (e) {
      const btn = e.currentTarget;
      const next = btn.dataset.active !== 'true';
      btn.dataset.active = String(next);
      btn.classList.toggle('active', next);
      curveOn[btn.dataset.curve] = next;
      draw();
    });

    // Counterpoint toggle (existing behavior)
    const cpBtn = document.getElementById('ev-toggle-counter-compute');
    const cpEl = document.getElementById('ev-counterpoint-compute');
    if (cpBtn && cpEl) {
      cpBtn.addEventListener('click', () => {
        const active = cpBtn.dataset.active === 'true';
        cpBtn.dataset.active = String(!active);
        cpBtn.classList.toggle('active');
        cpEl.dataset.open = String(!active);
      });
    }

    draw();
  }

  // ── Chart 2: Algorithmic Efficiency ─────────────────────────
  function renderEfficiencyChart() {
    const data = evData.algorithms;
    if (!data) return;
    const svg = document.getElementById('ev-efficiency');
    const wrap = document.getElementById('ev-efficiency-wrap');
    const tip = document.getElementById('ev-tooltip-efficiency');
    const showTip = setupTooltip(wrap, tip);
    const W = 1100, H = 480, M = { t: 30, r: 40, b: 50, l: 70 };

    const milestones = data.milestones;
    const years = milestones.map(d => new Date(d.year + '-06').getTime());
    const xDomain = [Math.min(...years), Math.max(...years) + 1.5 * 365 * 24 * 3600 * 1000];
    const yDomain = [1e20, 1e25];
    const xScale = makeScale(xDomain, [M.l, W - M.r]);
    const yScale = makeScale(yDomain, [H - M.b, M.t], 'log');

    function draw(view) {
      svg.innerHTML = '';

      // Grid
      niceLogTicks(yDomain[0], yDomain[1]).forEach(t => {
        const y = yScale(t);
        svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: y, y2: y, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.3 }));
        svg.appendChild(svgEl('text', { x: M.l - 8, y: y + 4, 'text-anchor': 'end', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = formatNumber(t);
      });

      // X ticks
      for (let y = 2020; y <= 2026; y++) {
        const x = xScale(new Date(y + '-01').getTime());
        svg.appendChild(svgEl('text', { x, y: H - M.b + 18, 'text-anchor': 'middle', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = y;
      }

      svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));
      svg.appendChild(svgEl('line', { x1: M.l, x2: M.l, y1: M.t, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));

      // Frontier raw compute line (connected, excludes small efficiency models)
      const frontierMs = milestones.filter(m => m.compute_flop >= 1e23);
      if (view === 'separate' || view === 'combined') {
        let d = '';
        frontierMs.forEach((m, i) => {
          const x = xScale(new Date(m.year + '-06').getTime());
          const y = yScale(m.compute_flop);
          d += (i ? 'L' : 'M') + x + ',' + y;
        });
        svg.appendChild(svgEl('path', { d, stroke: '#5B9BD5', 'stroke-width': 2.5, fill: 'none' }));
      }

      // All milestones as scatter points
      milestones.forEach(m => {
        const cx = xScale(new Date(m.year + '-06').getTime());
        const cy = yScale(m.compute_flop);
        const isFrontier = m.compute_flop >= 1e23;
        const c = svgEl('circle', { cx, cy, r: isFrontier ? 4 : 3, fill: isFrontier ? '#5B9BD5' : '#A89BB8', stroke: 'var(--paper)', 'stroke-width': 1.5 });
        c.addEventListener('mouseenter', e => showTip(`<div class="tt-name">${m.model}</div><div class="tt-meta">${isFrontier ? 'Frontier' : 'Efficiency'} &middot; ${formatNumber(m.compute_flop)} FLOP</div>`, e.offsetX, e.offsetY));
        c.addEventListener('mouseleave', () => hideTooltip(tip));
        svg.appendChild(c);
      });

      // Efficiency multiplier line (synthetic, based on frontier trajectory)
      if (view === 'separate' || view === 'combined') {
        const effData = frontierMs.map((m, i) => ({
          year: m.year,
          val: m.compute_flop * Math.pow(2, i * 1.5)
        }));
        let d = '';
        effData.forEach((p, i) => {
          const x = xScale(new Date(p.year + '-06').getTime());
          const y = yScale(Math.min(p.val, yDomain[1]));
          d += (i ? 'L' : 'M') + x + ',' + y;
        });
        const stroke = view === 'combined' ? 'var(--accent)' : '#D4B970';
        svg.appendChild(svgEl('path', { d, stroke, 'stroke-width': 2.5, fill: 'none', 'stroke-dasharray': view === 'separate' ? '6,4' : 'none' }));
      }

      // Labels
      const lbls = svgEl('g', { id: 'ev-eff-labels' });
      if (view === 'separate') {
        const lastFrontier = frontierMs[frontierMs.length - 1];
        const t1 = svgEl('text', { x: W - M.r - 10, y: yScale(lastFrontier.compute_flop) - 10, 'text-anchor': 'end', fill: '#5B9BD5', 'font-size': 10, 'font-family': 'DM Mono, monospace' });
        t1.textContent = 'Raw compute';
        lbls.appendChild(t1);
        const effY = Math.min(lastFrontier.compute_flop * Math.pow(2, (frontierMs.length - 1) * 1.5), yDomain[1] * 0.9);
        const t2 = svgEl('text', { x: W - M.r - 10, y: yScale(effY) - 10, 'text-anchor': 'end', fill: '#D4B970', 'font-size': 10, 'font-family': 'DM Mono, monospace' });
        t2.textContent = 'Effective compute';
        lbls.appendChild(t2);
      } else {
        const t = svgEl('text', { x: W - M.r - 10, y: M.t + 20, 'text-anchor': 'end', fill: 'var(--accent)', 'font-size': 11, 'font-family': 'DM Mono, monospace', 'font-weight': 500 });
        t.textContent = 'Combined: doubling every ~3.5 months';
        lbls.appendChild(t);
      }
      svg.appendChild(lbls);
    }

    draw('separate');

    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        draw(btn.dataset.view);
      });
    });
  }


  // ── Chart 3: METR Time Horizon ──────────────────────────────
  function renderHorizonChart() {
    const data = evData.metr;
    if (!data) return;
    const svg = document.getElementById('ev-horizon');
    const wrap = document.getElementById('ev-horizon-wrap');
    const tip = document.getElementById('ev-tooltip-horizon');
    const showTip = setupTooltip(wrap, tip);
    const W = 1100, H = 540, M = { t: 40, r: 60, b: 60, l: 80 };

    const points = data.data;
    const dates = points.map(d => new Date(d.date).getTime());
    const horizons = points.map(d => d.horizon_minutes);
    const xDomain = [Math.min(...dates), new Date('2031-01').getTime()];
    const yDomain = [0.3, 20000];
    const xScale = makeScale(xDomain, [M.l, W - M.r]);
    const yScale = makeScale(yDomain, [H - M.b, M.t], 'log');

    let currentTrend = 'long';
    let extrapX = xScale(new Date('2028-06').getTime());

    function draw() {
      svg.innerHTML = '';
      const trend = data.trends.find(t => t.id === currentTrend);
      const doublingMonths = trend ? trend.doubling_months : 7;

      // Grid lines for time milestones
      data.milestones.forEach(m => {
        const y = yScale(m.minutes);
        if (y >= M.t && y <= H - M.b) {
          svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: y, y2: y, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.25 }));
          svg.appendChild(svgEl('text', { x: W - M.r - 6, y: y + 4, 'text-anchor': 'end', fill: 'var(--ink-dim)', 'font-size': 9, 'font-family': 'DM Mono, monospace' })).textContent = m.label;
        }
      });

      // Y axis ticks
      niceLogTicks(yDomain[0], yDomain[1]).forEach(t => {
        const y = yScale(t);
        svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: y, y2: y, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.2 }));
        svg.appendChild(svgEl('text', { x: M.l - 8, y: y + 4, 'text-anchor': 'end', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = formatNumber(t) + ' min';
      });

      // X axis ticks
      for (let y = 2019; y <= 2030; y++) {
        const x = xScale(new Date(y + '-01').getTime());
        svg.appendChild(svgEl('text', { x, y: H - M.b + 18, 'text-anchor': 'middle', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = y;
      }

      svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));
      svg.appendChild(svgEl('line', { x1: M.l, x2: M.l, y1: M.t, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));

      // Data line
      let d = '';
      points.forEach((p, i) => {
        const x = xScale(new Date(p.date).getTime());
        const y = yScale(p.horizon_minutes);
        d += (i ? 'L' : 'M') + x + ',' + y;
      });
      svg.appendChild(svgEl('path', { d, stroke: 'var(--accent)', 'stroke-width': 3, fill: 'none' }));

      // Extrapolation line
      const lastPt = points[points.length - 1];
      const lastX = xScale(new Date(lastPt.date).getTime());
      const lastY = yScale(lastPt.horizon_minutes);
      const extrapMonths = (xDomain[1] - new Date(lastPt.date).getTime()) / (1000 * 60 * 60 * 24 * 30);
      const extrapFactor = Math.pow(2, extrapMonths / doublingMonths);
      const endY = yScale(lastPt.horizon_minutes * extrapFactor);
      const endX = xScale(xDomain[1]);

      svg.appendChild(svgEl('line', { x1: lastX, y1: lastY, x2: endX, y2: endY, stroke: 'var(--accent)', 'stroke-width': 2, 'stroke-dasharray': '8,4', opacity: 0.6 }));

      // Data points
      points.forEach(p => {
        const cx = xScale(new Date(p.date).getTime());
        const cy = yScale(p.horizon_minutes);
        const c = svgEl('circle', { cx, cy, r: 5, fill: 'var(--accent)', stroke: 'var(--paper)', 'stroke-width': 2 });
        c.addEventListener('mouseenter', e => showTip(`<div class="tt-name">${p.model}</div><div class="tt-meta">${p.date} &middot; ${p.horizon_minutes} min</div>`, e.offsetX, e.offsetY));
        c.addEventListener('mouseleave', () => hideTooltip(tip));
        svg.appendChild(c);
      });

      // Draggable handle
      const handleRatio = Math.max(0, Math.min(1, (extrapX - lastX) / (endX - lastX)));
      const handleMonths = handleRatio * extrapMonths;
      const handleMin = lastPt.horizon_minutes * Math.pow(2, handleMonths / doublingMonths);
      const handleCy = yScale(Math.max(yDomain[0], Math.min(yDomain[1], handleMin)));
      const handle = svgEl('circle', { cx: extrapX, cy: handleCy, r: 12, fill: 'var(--accent)', stroke: 'var(--paper)', 'stroke-width': 3, cursor: 'grab' });
      handle.setAttribute('role', 'slider');
      handle.setAttribute('aria-valuemin', String(lastX));
      handle.setAttribute('aria-valuemax', String(endX));
      handle.setAttribute('aria-valuenow', String(extrapX));
      handle.id = 'ev-horizon-handle';
      svg.appendChild(handle);

      // Update extrapolation text
      const initRatio = Math.max(0, Math.min(1, (extrapX - lastX) / (endX - lastX)));
      const initMonths = initRatio * extrapMonths;
      const initMin = lastPt.horizon_minutes * Math.pow(2, initMonths / doublingMonths);
      let text = '';
      if (initMin < 60) text = `~${Math.round(initMin)} min tasks`;
      else if (initMin < 480) text = `~${Math.round(initMin / 60)} hour tasks`;
      else if (initMin < 2400) text = `~${Math.round(initMin / 480)} day tasks`;
      else if (initMin < 9600) text = `~${Math.round(initMin / 2400)} week tasks`;
      else text = `~${Math.round(initMin / 9600)} month tasks`;
      document.getElementById('ev-extrap-value').textContent = text;

      // Drag logic
      let dragging = false;
      handle.addEventListener('pointerdown', e => {
        dragging = true;
        handle.style.cursor = 'grabbing';
        handle.setPointerCapture(e.pointerId);
      });
      handle.addEventListener('pointermove', e => {
        if (!dragging) return;
        const rect = svg.getBoundingClientRect();
        const scaleX = 1100 / rect.width;
        let nx = (e.clientX - rect.left) * scaleX;
        nx = Math.max(lastX, Math.min(endX, nx));
        extrapX = nx;
        handle.setAttribute('cx', nx);
        const ratio = Math.max(0, Math.min(1, (nx - lastX) / (endX - lastX)));
        const ny = lastY + (endY - lastY) * ratio;
        handle.setAttribute('cy', ny);
        handle.setAttribute('aria-valuenow', String(nx));
        const em = ratio * extrapMonths;
        const emin = lastPt.horizon_minutes * Math.pow(2, em / doublingMonths);
        let t = '';
        if (emin < 60) t = `~${Math.round(emin)} min tasks`;
        else if (emin < 480) t = `~${Math.round(emin / 60)} hour tasks`;
        else if (emin < 2400) t = `~${Math.round(emin / 480)} day tasks`;
        else if (emin < 9600) t = `~${Math.round(emin / 2400)} week tasks`;
        else t = `~${Math.round(emin / 9600)} month tasks`;
        document.getElementById('ev-extrap-value').textContent = t;
      });
      handle.addEventListener('pointerup', () => { dragging = false; handle.style.cursor = 'grab'; });
      handle.addEventListener('pointerleave', () => { if (!dragging) handle.style.cursor = 'grab'; });
    }

    draw();

    document.querySelectorAll('[data-trend]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-trend]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTrend = btn.dataset.trend;
        draw();
      });
    });

    // Counterpoint toggle
    const cpBtn = document.getElementById('ev-toggle-counter-horizon');
    if (cpBtn) {
      const cpEl = document.getElementById('ev-counterpoint-horizon');
      cpBtn.addEventListener('click', () => {
        const active = cpBtn.dataset.active === 'true';
        cpBtn.dataset.active = String(!active);
        cpBtn.classList.toggle('active');
        cpEl.dataset.open = String(!active);
      });
    }
  }

  // ── Chart 4: Cost Collapse ──────────────────────────────────
  function renderCostChart() {
    const data = evData.cost;
    if (!data) return;
    const svg = document.getElementById('ev-cost');
    const wrap = document.getElementById('ev-cost-wrap');
    const tip = document.getElementById('ev-tooltip-cost');
    const showTip = setupTooltip(wrap, tip);
    const W = 1100, H = 520, M = { t: 40, r: 50, b: 60, l: 80 };

    const frontier = data.pareto_frontier;
    const dates = frontier.map(d => new Date(d.date).getTime());
    const xDomain = [new Date('2022-06').getTime(), new Date('2026-06').getTime()];
    const yDomain = [0.1, 50];
    const xScale = makeScale(xDomain, [M.l, W - M.r]);
    const yScale = makeScale(yDomain, [H - M.b, M.t], 'log');

    let currentFrame = frontier.length - 1;
    let playing = false;
    let playInterval;

    function draw(frame) {
      svg.innerHTML = '';
      const visible = frontier.slice(0, frame + 1);

      // Grid
      niceLogTicks(yDomain[0], yDomain[1]).forEach(t => {
        const y = yScale(t);
        svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: y, y2: y, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.3 }));
        svg.appendChild(svgEl('text', { x: M.l - 8, y: y + 4, 'text-anchor': 'end', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = '$' + t;
      });

      // X ticks
      for (let y = 2022; y <= 2026; y++) {
        const x = xScale(new Date(y + '-01').getTime());
        svg.appendChild(svgEl('text', { x, y: H - M.b + 18, 'text-anchor': 'middle', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = y;
      }

      svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));
      svg.appendChild(svgEl('line', { x1: M.l, x2: M.l, y1: M.t, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));

      // Pareto frontier line
      let d = '';
      visible.forEach((p, i) => {
        const x = xScale(new Date(p.date).getTime());
        const y = yScale(p.price_per_mtok);
        d += (i ? 'L' : 'M') + x + ',' + y;
      });
      svg.appendChild(svgEl('path', { d, stroke: 'var(--accent)', 'stroke-width': 2.5, fill: 'none' }));

      // Points
      visible.forEach(p => {
        const cx = xScale(new Date(p.date).getTime());
        const cy = yScale(p.price_per_mtok);
        const c = svgEl('circle', { cx, cy, r: 5, fill: 'var(--accent)', stroke: 'var(--paper)', 'stroke-width': 1.5 });
        c.addEventListener('mouseenter', e => showTip(`<div class="tt-name">${p.model}</div><div class="tt-meta">${p.date} &middot; $${p.price_per_mtok}/Mtok</div>`, e.offsetX, e.offsetY));
        c.addEventListener('mouseleave', () => hideTooltip(tip));
        svg.appendChild(c);
      });

      // Current year label
      if (visible.length > 0) {
        const last = visible[visible.length - 1];
        const lx = xScale(new Date(last.date).getTime());
        const ly = yScale(last.price_per_mtok);
        const lblAnchor = lx > W - M.r - 40 ? 'end' : 'start';
        const lblOffset = lx > W - M.r - 40 ? -10 : 10;
        const lbl = svgEl('text', { x: lx + lblOffset, y: ly - 10, 'text-anchor': lblAnchor, fill: 'var(--accent)', 'font-size': 12, 'font-family': 'DM Mono, monospace', 'font-weight': 500 });
        lbl.textContent = last.date.slice(0, 4);
        svg.appendChild(lbl);
      }
    }

    draw(currentFrame);

    const slider = document.getElementById('ev-cost-slider');
    slider.addEventListener('input', e => {
      currentFrame = parseInt(e.target.value);
      draw(currentFrame);
    });

    const playBtn = document.getElementById('ev-cost-play');
    playBtn.addEventListener('click', () => {
      if (playing) {
        clearInterval(playInterval);
        playing = false;
        playBtn.classList.remove('is-playing');
        playBtn.textContent = 'Play 2022–2026';
      } else {
        currentFrame = 0;
        playing = true;
        playBtn.classList.add('is-playing');
        playBtn.textContent = 'Playing...';
        playInterval = setInterval(() => {
          currentFrame++;
          slider.value = currentFrame;
          draw(currentFrame);
          if (currentFrame >= frontier.length - 1) {
            clearInterval(playInterval);
            playing = false;
            playBtn.classList.remove('is-playing');
            playBtn.textContent = 'Play 2022–2026';
          }
        }, 600);
      }
    });
  }


  // ── Chart 5: Benchmark Saturation ───────────────────────────
  function renderBenchmarkChart() {
    const data = evData.benchmarks;
    if (!data) return;
    const metaSvg = document.getElementById('ev-meta-chart');
    const grid = document.getElementById('ev-small-multiples');
    if (!metaSvg || !grid) return;

    // Meta chart: time to saturation
    const metaW = 1100, metaH = 240, M = { t: 30, r: 40, b: 50, l: 60 };
    // Build meta-trend from benchmarks: time from first entry to passing threshold
    const metaPoints = data.benchmarks.map(b => {
      const firstYear = parseInt(b.entries[0].date.slice(0, 4), 10);
      const passIdx = b.entries.findIndex(e => e.score >= b.passing_threshold);
      const passYear = passIdx >= 0 ? parseInt(b.entries[passIdx].date.slice(0, 4), 10) : null;
      const timeToSat = passYear ? passYear - firstYear : null;
      return { introduced: firstYear, time_to_saturation_years: timeToSat };
    }).filter(p => p.time_to_saturation_years !== null)
      .sort((a, b) => (a.introduced + a.time_to_saturation_years / 2) - (b.introduced + b.time_to_saturation_years / 2));

    const metaX = makeScale([2019, 2026], [M.l, metaW - M.r]);
    const metaY = makeScale([0, 5], [metaH - M.b, M.t]);

    metaSvg.innerHTML = '';
    // Axes
    for (let y = 2020; y <= 2026; y++) {
      const x = metaX(y);
      metaSvg.appendChild(svgEl('text', { x, y: metaH - M.b + 18, 'text-anchor': 'middle', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = y;
    }
    for (let t = 0; t <= 5; t++) {
      const y = metaY(t);
      metaSvg.appendChild(svgEl('line', { x1: M.l, x2: metaW - M.r, y1: y, y2: y, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.2 }));
      metaSvg.appendChild(svgEl('text', { x: M.l - 8, y: y + 4, 'text-anchor': 'end', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = t + ' yr';
    }
    metaSvg.appendChild(svgEl('line', { x1: M.l, x2: metaW - M.r, y1: metaH - M.b, y2: metaH - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));
    metaSvg.appendChild(svgEl('line', { x1: M.l, x2: M.l, y1: M.t, y2: metaH - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));

    // Scatter points only — too few benchmarks for a meaningful continuous line
    metaPoints.forEach(p => {
      const cx = metaX(p.introduced + p.time_to_saturation_years / 2);
      const cy = metaY(p.time_to_saturation_years);
      metaSvg.appendChild(svgEl('circle', { cx, cy, r: 5, fill: 'var(--accent)', stroke: 'var(--paper)', 'stroke-width': 1.5 }));
    });
    // Annotation
    const ann = svgEl('text', { x: M.l + 8, y: M.t + 14, fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace', 'font-style': 'italic' });
    ann.textContent = 'Each dot = one benchmark; lower = faster saturation';
    metaSvg.appendChild(ann);

    // Small multiples
    function drawTiles(filter) {
      grid.innerHTML = '';
      data.benchmarks.forEach(b => {
        const scores = b.entries.map(e => ({ score: e.score }));
        const saturated = scores.length > 0 && scores[scores.length - 1].score >= b.passing_threshold;
        if (filter === 'unsaturated' && saturated) return;
        const tile = document.createElement('div');
        tile.className = 'ev-bench-tile';
        const statusClass = saturated ? 'saturated' : 'open';
        const statusText = saturated ? 'Saturated' : 'Open';
        tile.innerHTML = `
          <div class="ev-bench-tile-header">
            <span class="ev-bench-tile-name">${b.label}</span>
            <span class="ev-bench-tile-status ${statusClass}">${statusText}</span>
          </div>
        `;
        const svgW = 200, svgH = 80;
        const tileSvg = svgEl('svg', { viewBox: `0 0 ${svgW} ${svgH}`, preserveAspectRatio: 'xMidYMid meet' });
        const maxScore = Math.max(b.human_baseline, ...scores.map(s => s.score)) * 1.1;
        const bx = makeScale([0, scores.length - 1], [10, svgW - 10]);
        const by = makeScale([0, maxScore], [svgH - 10, 10]);

        // Human baseline line
        const hy = by(b.human_baseline);
        tileSvg.appendChild(svgEl('line', { x1: 10, x2: svgW - 10, y1: hy, y2: hy, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, 'stroke-dasharray': '4,3' }));

        // Sparkline
        let bd = '';
        scores.forEach((s, i) => {
          bd += (i ? 'L' : 'M') + bx(i) + ',' + by(s.score);
        });
        tileSvg.appendChild(svgEl('path', { d: bd, stroke: saturated ? 'var(--accent)' : '#5B9BD5', 'stroke-width': 2, fill: 'none' }));
        scores.forEach((s, i) => {
          tileSvg.appendChild(svgEl('circle', { cx: bx(i), cy: by(s.score), r: 2.5, fill: saturated ? 'var(--accent)' : '#5B9BD5' }));
        });

        // Current score label
        const last = scores[scores.length - 1];
        const suffix = b.max_score === 100 || b.max_score === 150 ? '%' : '';
        tileSvg.appendChild(svgEl('text', { x: svgW - 10, y: by(last.score) - 6, 'text-anchor': 'end', fill: 'var(--ink)', 'font-size': 8, 'font-family': 'DM Mono, monospace' })).textContent = last.score + suffix;

        tile.appendChild(tileSvg);
        grid.appendChild(tile);
      });
    }

    drawTiles('all');

    document.querySelectorAll('[data-bench-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-bench-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        drawTiles(btn.dataset.benchFilter);
      });
    });
  }

  // ── Chart 6: The Walls ──────────────────────────────────────
  function renderWallsChart() {
    const data = evData.limits;
    if (!data) return;
    const svg = document.getElementById('ev-walls');
    const wrap = document.getElementById('ev-walls-wrap');
    const tip = document.getElementById('ev-tooltip-walls');
    const showTip = setupTooltip(wrap, tip);
    const W = 1100, H = 520, M = { t: 40, r: 50, b: 60, l: 80 };

    const ceilings = data.ceilings;
    const xDomain = [2024, 2032];
    const yDomain = [1, 1000];
    const xScale = makeScale(xDomain, [M.l, W - M.r]);
    const yScale = makeScale(yDomain, [H - M.b, M.t], 'log');

    const colors = { data: '#5B9BD5', power: '#A89BB8', duration: '#D4B970', cost: '#C66E6E' };
    const currentVals = { data: 15, power: 100, duration: 6, cost: 0.5 };
    const ceilingVals = { data: 300, power: 10000, duration: 9, cost: 100 };

    // Normalized for display (all on same log scale, values are arbitrary normalized)
    const normCurrent = { data: 2, power: 2, duration: 2, cost: 2 };
    const normCeiling = { data: 50, power: 50, duration: 50, cost: 50 };

    svg.innerHTML = '';

    // Grid
    niceLogTicks(yDomain[0], yDomain[1]).forEach(t => {
      const y = yScale(t);
      svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: y, y2: y, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.2 }));
    });

    for (let y = 2024; y <= 2032; y += 2) {
      const x = xScale(y);
      svg.appendChild(svgEl('text', { x, y: H - M.b + 18, 'text-anchor': 'middle', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = y;
    }

    svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));
    svg.appendChild(svgEl('line', { x1: M.l, x2: M.l, y1: M.t, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));

    // Ceiling lines (draggable)
    ceilings.forEach((c, i) => {
      const y = yScale(normCeiling[c.id]);
      const line = svgEl('line', {
        x1: M.l, x2: W - M.r, y1: y, y2: y,
        stroke: colors[c.id], 'stroke-width': 2, 'stroke-dasharray': '8,4', opacity: 0.7,
        id: 'ev-wall-line-' + c.id
      });
      svg.appendChild(line);

      const handle = svgEl('rect', {
        x: W - M.r - 20, y: y - 8, width: 40, height: 16, rx: 3,
        fill: colors[c.id], stroke: 'var(--paper)', 'stroke-width': 2,
        cursor: 'ns-resize', id: 'ev-wall-handle-' + c.id
      });
      handle.setAttribute('role', 'slider');
      handle.setAttribute('aria-label', c.label + ' ceiling');
      svg.appendChild(handle);

      // Label
      const lbl = svgEl('text', {
        x: W - M.r - 30, y: y - 12, 'text-anchor': 'end',
        fill: colors[c.id], 'font-size': 10, 'font-family': 'DM Mono, monospace'
      });
      lbl.textContent = c.label;
      lbl.id = 'ev-wall-label-' + c.id;
      svg.appendChild(lbl);

      // Drag
      let dragging = false;
      handle.addEventListener('pointerdown', e => {
        dragging = true;
        handle.setPointerCapture(e.pointerId);
      });
      handle.addEventListener('pointermove', e => {
        if (!dragging) return;
        const rect = svg.getBoundingClientRect();
        const scaleY = 520 / rect.height;
        let ny = (e.clientY - rect.top) * scaleY;
        ny = Math.max(M.t + 10, Math.min(H - M.b - 10, ny));
        handle.setAttribute('y', ny - 8);
        line.setAttribute('y1', ny);
        line.setAttribute('y2', ny);
        lbl.setAttribute('y', ny - 12);

        // Update crossing year estimate
        const ratio = (ny - M.t) / (H - M.b - M.t);
        const year = 2024 + ratio * 8;
        document.getElementById('ev-wall-' + c.id).textContent = Math.round(year);
      });
      handle.addEventListener('pointerup', () => { dragging = false; });
    });

    // Growth lines (simplified: all start at same point, diverge)
    ceilings.forEach(c => {
      const startY = yScale(normCurrent[c.id]);
      const endY = yScale(normCeiling[c.id] * 0.8);
      const startX = xScale(2024);
      const endX = xScale(2032);
      let d = 'M' + startX + ',' + startY;
      // Exponential curve
      for (let x = startX; x <= endX; x += 5) {
        const ratio = (x - startX) / (endX - startX);
        const y = startY + (endY - startY) * (1 - Math.exp(-ratio * 3));
        d += 'L' + x + ',' + y;
      }
      svg.appendChild(svgEl('path', { d, stroke: colors[c.id], 'stroke-width': 2, fill: 'none', opacity: 0.6 }));
    });
  }

  // ── Chart 7: Historical Analogs ─────────────────────────────
  function renderHistoricalChart() {
    const data = evData.historical;
    if (!data) return;
    const svg = document.getElementById('ev-historical');
    const wrap = document.getElementById('ev-historical-wrap');
    const tip = document.getElementById('ev-tooltip-historical');
    const showTip = setupTooltip(wrap, tip);
    const W = 1100, H = 520, M = { t: 40, r: 50, b: 60, l: 80 };

    let activeLayers = new Set(['ai_compute', 'ai_horizon']);
    let activeProj = 'exponential';

    const xDomain = [0, 60];
    const yDomain = [0.5, 1000000000];
    const xScale = makeScale(xDomain, [M.l, W - M.r]);
    const yScale = makeScale(yDomain, [H - M.b, M.t], 'log');

    function draw() {
      svg.innerHTML = '';

      // Grid
      niceLogTicks(yDomain[0], yDomain[1]).forEach(t => {
        const y = yScale(t);
        svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: y, y2: y, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.2 }));
        svg.appendChild(svgEl('text', { x: M.l - 8, y: y + 4, 'text-anchor': 'end', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = formatNumber(t);
      });

      for (let x = 0; x <= 60; x += 10) {
        const px = xScale(x);
        svg.appendChild(svgEl('text', { x: px, y: H - M.b + 18, 'text-anchor': 'middle', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = x + ' yr';
      }

      svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));
      svg.appendChild(svgEl('line', { x1: M.l, x2: M.l, y1: M.t, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));

      data.curves.forEach(c => {
        if (!activeLayers.has(c.id)) return;
        let d = '';
        c.points.forEach((p, i) => {
          const yearsSince = p.year - c.start_year;
          const px = xScale(yearsSince);
          const py = yScale(Math.max(p.normalized, 0.5));
          d += (i ? 'L' : 'M') + px + ',' + py;
        });
        svg.appendChild(svgEl('path', { d, stroke: c.color, 'stroke-width': c.id.startsWith('ai_') ? 3 : 2, fill: 'none' }));

        // Label at end
        const last = c.points[c.points.length - 1];
        const ly = yScale(Math.max(last.normalized, 0.5));
        svg.appendChild(svgEl('text', {
          x: W - M.r - 6, y: ly - 6, 'text-anchor': 'end',
          fill: c.color, 'font-size': 10, 'font-family': 'DM Mono, monospace'
        })).textContent = c.label;
      });

      // Projection fan for AI curves
      const aiCurves = data.curves.filter(c => c.id.startsWith('ai_') && activeLayers.has(c.id));
      aiCurves.forEach(c => {
        const last = c.points[c.points.length - 1];
        const startX = xScale(last.year - c.start_year);
        const startY = yScale(Math.max(last.normalized, 0.5));
        const endX = xScale(60);

        const proj = data.projections.models.find(p => p.id === activeProj);
        if (!proj) return;

        let projVal;
        if (activeProj === 'exponential') {
          projVal = last.normalized * Math.pow(10, (60 - (last.year - c.start_year)) / 5);
        } else if (activeProj === 's_curve') {
          projVal = last.normalized * 5;
        } else {
          projVal = last.normalized * Math.pow(10, (60 - (last.year - c.start_year)) / 3);
        }
        const endY = yScale(Math.max(yDomain[0], Math.min(yDomain[1], projVal)));

        svg.appendChild(svgEl('path', {
          d: `M${startX},${startY} L${endX},${endY}`,
          stroke: c.color, 'stroke-width': 2, 'stroke-dasharray': '6,4', opacity: 0.4, fill: 'none'
        }));
      });
    }

    draw();

    document.querySelectorAll('[data-layer]').forEach(btn => {
      btn.addEventListener('click', () => {
        const layer = btn.dataset.layer;
        btn.classList.toggle('active');
        if (activeLayers.has(layer)) activeLayers.delete(layer);
        else activeLayers.add(layer);
        draw();
      });
    });

    document.querySelectorAll('[data-proj]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-proj]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeProj = btn.dataset.proj;
        draw();
      });
    });
  }

  // ── Synthesis widget ────────────────────────────────────────
  function initSynthesis() {
    const tabs = document.querySelectorAll('.ev-syn-tab');
    const panels = document.querySelectorAll('.ev-syn-panel');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const read = tab.dataset.read;
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.querySelector(`.ev-syn-panel[data-read="${read}"]`).classList.add('active');
      });
    });
  }

  // ── Initialize all ──────────────────────────────────────────
  function initCharts() {
    renderComputeChart();
    renderEfficiencyChart();
    renderHorizonChart();
    renderCostChart();
    renderBenchmarkChart();
    renderWallsChart();
    renderHistoricalChart();
    initSynthesis();
  }

  // ── Kickoff ─────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadData);
  } else {
    loadData();
  }
})();
