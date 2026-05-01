// productivity-lab.js — The Productivity Mystery
//
// Eight charts plus matrix + AI grid + receipts, all driven from
// /assets/data/productivity-lab/data.json. Vanilla SVG.

(function () {
  'use strict';

  function svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }
  function makeScale(domain, range) {
    return v => range[0] + (v - domain[0]) * (range[1] - range[0]) / (domain[1] - domain[0]);
  }
  function chartColor(n) {
    return getComputedStyle(document.documentElement).getPropertyValue('--chart-' + n).trim() || '#888';
  }
  const CHART = {
    get blue() { return chartColor(1); },
    get purple() { return chartColor(2); },
    get orange() { return chartColor(3); },
    get gold() { return chartColor(4); },
    get rose() { return chartColor(5); },
  };

  fetch('/assets/data/productivity-lab/data.json')
    .then(r => r.json())
    .then(data => {
      renderHeadline(data);
      renderTfp(data);
      renderIntl(data);
      renderEnergy(data);
      renderRegulation(data);
      renderMeasurement(data);
      renderCapital(data);
      renderMatrix(data);
      renderAi(data);
      renderReceipts(data);
    })
    .catch(err => {
      console.error('Productivity Lab data load failed:', err);
    });

  // ── Chart 1 — headline annual + period overlays ─────────────
  function renderHeadline(data) {
    const svg = document.getElementById('prod-headline');
    const tip = document.getElementById('prod-tooltip-headline');
    const wrap = document.getElementById('prod-headline-wrap');
    if (!svg) return;
    const W = 1100, H = 480, M = { t: 36, r: 36, b: 50, l: 70 };
    const pts = data.labor_productivity.annual_pct;
    const periods = data.labor_productivity.period_averages;
    const events = data.labor_productivity.key_events;

    const xDomain = [pts[0].year - 0.5, pts[pts.length - 1].year + 0.5];
    const yMin = Math.min(...pts.map(p => p.growth));
    const yMax = Math.max(...pts.map(p => p.growth));
    const yDomain = [yMin - 0.8, yMax + 0.8];
    const xScale = makeScale(xDomain, [M.l, W - M.r]);
    const yScale = makeScale(yDomain, [H - M.b, M.t]);

    svg.innerHTML = '';

    // Y grid + ticks
    for (let v = -2; v <= 8; v += 2) {
      const y = yScale(v);
      svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: y, y2: y, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: v === 0 ? 0.45 : 0.18 }));
      svg.appendChild(svgEl('text', { x: M.l - 8, y: y + 4, 'text-anchor': 'end', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = v + '%';
    }
    // X ticks every 10 years
    for (let yr = 1950; yr <= 2025; yr += 10) {
      const x = xScale(yr);
      svg.appendChild(svgEl('line', { x1: x, x2: x, y1: M.t, y2: H - M.b, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.16 }));
      svg.appendChild(svgEl('text', { x, y: H - M.b + 18, 'text-anchor': 'middle', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = yr;
    }

    // Axes
    svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: yScale(0), y2: yScale(0), stroke: 'var(--ink)', 'stroke-width': 0.8 }));
    svg.appendChild(svgEl('line', { x1: M.l, x2: M.l, y1: M.t, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));

    // Bars
    const barW = (W - M.l - M.r) / pts.length * 0.78;
    pts.forEach(p => {
      const cx = xScale(p.year);
      const yTop = p.growth >= 0 ? yScale(p.growth) : yScale(0);
      const yHt = Math.abs(yScale(p.growth) - yScale(0));
      const fill = p.growth >= 0 ? CHART.blue : CHART.rose;
      const r = svgEl('rect', { x: cx - barW / 2, y: yTop, width: barW, height: yHt, fill, opacity: 0.78 });
      r.addEventListener('mouseenter', e => {
        tip.textContent = p.year + ' · ' + (p.growth >= 0 ? '+' : '') + p.growth.toFixed(1) + '%';
        tip.hidden = false;
        const rect = wrap.getBoundingClientRect();
        tip.style.left = (e.clientX - rect.left + 12) + 'px';
        tip.style.top = (e.clientY - rect.top - 28) + 'px';
      });
      r.addEventListener('mouseleave', () => { tip.hidden = true; });
      svg.appendChild(r);
    });

    // Period averages — horizontal segments at the trend value
    periods.forEach(p => {
      const x1 = xScale(p.from);
      const x2 = xScale(p.to);
      const y = yScale(p.pct);
      svg.appendChild(svgEl('line', { x1, x2, y1: y, y2: y, stroke: CHART.orange, 'stroke-width': 2.5, opacity: 0.85 }));
      // label centered above the segment
      const cx = (x1 + x2) / 2;
      svg.appendChild(svgEl('text', {
        x: cx, y: y - 6, 'text-anchor': 'middle',
        fill: CHART.orange, 'font-size': 10, 'font-family': 'DM Mono, monospace',
        'font-weight': 500
      })).textContent = p.pct.toFixed(1) + '%';
    });

    // Event markers (vertical lines + tiny labels)
    events.forEach(e => {
      const x = xScale(e.year);
      svg.appendChild(svgEl('line', { x1: x, x2: x, y1: M.t, y2: H - M.b, stroke: 'var(--accent)', 'stroke-width': 0.6, 'stroke-dasharray': '3,3', opacity: 0.55 }));
      svg.appendChild(svgEl('text', {
        x, y: M.t + 12, 'text-anchor': 'middle',
        fill: 'var(--accent)', 'font-size': 9, 'font-family': 'DM Mono, monospace'
      })).textContent = e.year;
    });

    // Y title
    svg.appendChild(svgEl('text', {
      x: M.l - 60, y: M.t - 14, 'text-anchor': 'start',
      fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace',
      'letter-spacing': '0.10em'
    })).textContent = 'OUTPUT PER HOUR — % CHG';
    // Legend
    legendInline(svg, W - M.r - 240, M.t - 14, [
      { color: CHART.blue, label: 'Annual growth' },
      { color: CHART.orange, label: 'Period trend' },
    ]);
  }

  function legendInline(svg, x, y, items) {
    let cx = x;
    items.forEach(it => {
      svg.appendChild(svgEl('rect', { x: cx, y: y - 6, width: 10, height: 6, fill: it.color }));
      const t = svgEl('text', { x: cx + 14, y: y, fill: 'var(--ink-soft)', 'font-size': 10, 'font-family': 'DM Mono, monospace' });
      t.textContent = it.label;
      svg.appendChild(t);
      cx += 14 + it.label.length * 6.4 + 14;
    });
  }

  // ── Chart 2 — TFP / capital / labor composition stacked bars ─
  function renderTfp(data) {
    const svg = document.getElementById('prod-tfp');
    if (!svg) return;
    const W = 1100, H = 440, M = { t: 36, r: 60, b: 60, l: 70 };
    const periods = data.tfp_decomposition.periods;
    const xScale = makeScale([0, periods.length], [M.l, W - M.r]);
    const yMax = Math.max(...periods.map(p => p.tfp + p.capital + p.labor_comp)) * 1.15;
    const yScale = makeScale([0, yMax], [H - M.b, M.t]);

    svg.innerHTML = '';

    // Y grid
    for (let v = 0; v <= yMax; v += 0.5) {
      const y = yScale(v);
      svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: y, y2: y, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.18 }));
      svg.appendChild(svgEl('text', { x: M.l - 8, y: y + 4, 'text-anchor': 'end', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = v.toFixed(1);
    }

    // Axes
    svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));
    svg.appendChild(svgEl('line', { x1: M.l, x2: M.l, y1: M.t, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));

    const barWidth = (W - M.l - M.r) / periods.length * 0.62;
    periods.forEach((p, i) => {
      const cx = xScale(i + 0.5);
      let cur = 0;
      // Order bottom-up: capital → labor_comp → TFP
      const segs = [
        { value: p.capital,    color: CHART.blue,   label: 'Capital deepening' },
        { value: p.labor_comp, color: CHART.purple, label: 'Labor composition' },
        { value: p.tfp,        color: CHART.orange, label: 'TFP' },
      ];
      segs.forEach(s => {
        const yLo = yScale(cur);
        const yHi = yScale(cur + s.value);
        svg.appendChild(svgEl('rect', {
          x: cx - barWidth / 2, y: yHi, width: barWidth, height: yLo - yHi,
          fill: s.color, opacity: 0.85, stroke: 'var(--paper)', 'stroke-width': 0.5
        }));
        cur += s.value;
      });
      // Period label
      svg.appendChild(svgEl('text', {
        x: cx, y: H - M.b + 18, 'text-anchor': 'middle',
        fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace'
      })).textContent = p.label;
      // Total label on top
      svg.appendChild(svgEl('text', {
        x: cx, y: yScale(cur) - 6, 'text-anchor': 'middle',
        fill: 'var(--ink)', 'font-size': 10.5, 'font-family': 'DM Mono, monospace',
        'font-weight': 500
      })).textContent = p.labor_prod.toFixed(1);
    });

    // Y title
    svg.appendChild(svgEl('text', {
      x: M.l - 60, y: M.t - 14, 'text-anchor': 'start',
      fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace',
      'letter-spacing': '0.10em'
    })).textContent = 'PERCENTAGE-POINT CONTRIBUTION';
    // Legend
    legendInline(svg, M.l + 220, M.t - 14, [
      { color: CHART.orange, label: 'TFP' },
      { color: CHART.purple, label: 'Labor comp.' },
      { color: CHART.blue,   label: 'Capital' },
    ]);
  }

  // ── Chart 3 — international clustered bars by country × period
  function renderIntl(data) {
    const svg = document.getElementById('prod-intl');
    if (!svg) return;
    const W = 1100, H = 460, M = { t: 36, r: 24, b: 80, l: 70 };
    const countries = data.international.countries;
    const periodLabels = data.international.period_labels;
    const nP = periodLabels.length;
    const nC = countries.length;
    const xScale = makeScale([0, nP], [M.l, W - M.r]);
    const yMin = -1, yMax = 3.5;
    const yScale = makeScale([yMin, yMax], [H - M.b, M.t]);

    svg.innerHTML = '';

    // Y grid
    for (let v = -1; v <= 3; v += 1) {
      const y = yScale(v);
      svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: y, y2: y, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: v === 0 ? 0.45 : 0.18 }));
      svg.appendChild(svgEl('text', { x: M.l - 8, y: y + 4, 'text-anchor': 'end', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = v + '%';
    }

    // Axes
    svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: yScale(0), y2: yScale(0), stroke: 'var(--ink)', 'stroke-width': 0.8 }));
    svg.appendChild(svgEl('line', { x1: M.l, x2: M.l, y1: M.t, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));

    const periodWidth = (W - M.l - M.r) / nP;
    const groupGap = periodWidth * 0.18;
    const barW = (periodWidth - groupGap) / nC;

    countries.forEach((c, i) => {
      const color = c.highlight ? CHART.orange : c.color_idx === 1 ? CHART.blue : c.color_idx === 2 ? CHART.purple : c.color_idx === 3 ? CHART.gold : c.color_idx === 4 ? CHART.rose : CHART.blue;
      c.periods.forEach((v, p) => {
        const cx = xScale(p) + groupGap / 2 + i * barW + barW / 2;
        const y0 = yScale(0);
        const y1 = yScale(v);
        const top = Math.min(y0, y1);
        const ht = Math.abs(y1 - y0);
        svg.appendChild(svgEl('rect', {
          x: cx - barW * 0.42, y: top, width: barW * 0.84, height: ht,
          fill: color, opacity: c.highlight ? 0.95 : 0.55
        }));
      });
    });

    // Period labels
    periodLabels.forEach((lbl, p) => {
      const cx = xScale(p) + periodWidth / 2;
      svg.appendChild(svgEl('text', {
        x: cx, y: H - M.b + 18, 'text-anchor': 'middle',
        fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace'
      })).textContent = lbl;
    });

    // Country legend
    let lx = M.l;
    const ly = H - 22;
    countries.forEach(c => {
      const color = c.highlight ? CHART.orange : c.color_idx === 1 ? CHART.blue : c.color_idx === 2 ? CHART.purple : c.color_idx === 3 ? CHART.gold : c.color_idx === 4 ? CHART.rose : CHART.blue;
      svg.appendChild(svgEl('rect', { x: lx, y: ly - 7, width: 10, height: 8, fill: color, opacity: c.highlight ? 0.95 : 0.55 }));
      const t = svgEl('text', { x: lx + 14, y: ly, fill: c.highlight ? CHART.orange : 'var(--ink-soft)', 'font-size': 10, 'font-family': 'DM Mono, monospace', 'font-weight': c.highlight ? 500 : 400 });
      t.textContent = c.label;
      svg.appendChild(t);
      lx += 14 + c.label.length * 6.6 + 18;
    });

    // Y title
    svg.appendChild(svgEl('text', {
      x: M.l - 60, y: M.t - 14, 'text-anchor': 'start',
      fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace',
      'letter-spacing': '0.10em'
    })).textContent = 'GDP / HOUR — ANNUAL %, AVG. PER PERIOD';
  }

  // ── Chart 4 — energy: dual-axis oil price + productivity ────
  function renderEnergy(data) {
    const svg = document.getElementById('prod-energy');
    if (!svg) return;
    const W = 1100, H = 420, M = { t: 36, r: 70, b: 50, l: 70 };
    const annual = data.energy.annual;
    const xDomain = [1947, 2026];
    const yLeft = [0, 130];   // oil $
    const yRight = [-1, 4];   // productivity %
    const xScale = makeScale(xDomain, [M.l, W - M.r]);
    const yLScale = makeScale(yLeft, [H - M.b, M.t]);
    const yRScale = makeScale(yRight, [H - M.b, M.t]);

    svg.innerHTML = '';

    // Y left grid
    for (let v = 0; v <= 120; v += 30) {
      const y = yLScale(v);
      svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: y, y2: y, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.18 }));
      svg.appendChild(svgEl('text', { x: M.l - 8, y: y + 4, 'text-anchor': 'end', fill: CHART.gold, 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = '$' + v;
    }
    // Y right ticks
    for (let v = -1; v <= 4; v++) {
      const y = yRScale(v);
      svg.appendChild(svgEl('text', { x: W - M.r + 8, y: y + 4, 'text-anchor': 'start', fill: CHART.blue, 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = v + '%';
    }
    // X ticks
    for (let yr = 1950; yr <= 2025; yr += 10) {
      const x = xScale(yr);
      svg.appendChild(svgEl('line', { x1: x, x2: x, y1: M.t, y2: H - M.b, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.16 }));
      svg.appendChild(svgEl('text', { x, y: H - M.b + 18, 'text-anchor': 'middle', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = yr;
    }

    // Axes
    svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));
    svg.appendChild(svgEl('line', { x1: M.l, x2: M.l, y1: M.t, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));
    svg.appendChild(svgEl('line', { x1: W - M.r, x2: W - M.r, y1: M.t, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));

    // Oil price line
    let oilD = '';
    annual.forEach((p, i) => {
      const x = xScale(p.year), y = yLScale(p.oil_real);
      oilD += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
    });
    svg.appendChild(svgEl('path', { d: oilD, stroke: CHART.gold, 'stroke-width': 2, fill: 'none', opacity: 0.9 }));

    // Productivity line
    let prodD = '';
    annual.forEach((p, i) => {
      const x = xScale(p.year), y = yRScale(p.prod_5y);
      prodD += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
    });
    svg.appendChild(svgEl('path', { d: prodD, stroke: CHART.blue, 'stroke-width': 2, fill: 'none', opacity: 0.95 }));

    // Y titles
    svg.appendChild(svgEl('text', { x: M.l - 60, y: M.t - 14, 'text-anchor': 'start', fill: CHART.gold, 'font-size': 10, 'font-family': 'DM Mono, monospace', 'letter-spacing': '0.10em' })).textContent = 'REAL OIL $ (LEFT)';
    svg.appendChild(svgEl('text', { x: W - M.r - 130, y: M.t - 14, 'text-anchor': 'start', fill: CHART.blue, 'font-size': 10, 'font-family': 'DM Mono, monospace', 'letter-spacing': '0.10em' })).textContent = 'PROD. 5YR (RIGHT)';
  }

  // ── Chart 5 — regulation (dual line) ─────────────────────────
  function renderRegulation(data) {
    const svg = document.getElementById('prod-reg');
    if (!svg) return;
    const W = 1100, H = 420, M = { t: 36, r: 70, b: 50, l: 80 };
    const ann = data.regulation.annual;
    const xDomain = [1968, 2026];
    const yLeft = [0, 1200000]; // restrictions
    const yRight = [0, 120000]; // FR pages
    const xScale = makeScale(xDomain, [M.l, W - M.r]);
    const yLScale = makeScale(yLeft, [H - M.b, M.t]);
    const yRScale = makeScale(yRight, [H - M.b, M.t]);

    svg.innerHTML = '';
    // Y left grid (restrictions)
    for (let v = 0; v <= 1200000; v += 300000) {
      const y = yLScale(v);
      svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: y, y2: y, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.18 }));
      svg.appendChild(svgEl('text', { x: M.l - 8, y: y + 4, 'text-anchor': 'end', fill: CHART.purple, 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = (v / 1e6).toFixed(1) + 'M';
    }
    // Y right ticks (FR pages)
    for (let v = 0; v <= 120000; v += 30000) {
      const y = yRScale(v);
      svg.appendChild(svgEl('text', { x: W - M.r + 8, y: y + 4, 'text-anchor': 'start', fill: CHART.gold, 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = (v / 1000) + 'k';
    }
    // X ticks
    for (let yr = 1970; yr <= 2025; yr += 10) {
      const x = xScale(yr);
      svg.appendChild(svgEl('line', { x1: x, x2: x, y1: M.t, y2: H - M.b, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.16 }));
      svg.appendChild(svgEl('text', { x, y: H - M.b + 18, 'text-anchor': 'middle', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = yr;
    }
    svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));
    svg.appendChild(svgEl('line', { x1: M.l, x2: M.l, y1: M.t, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));
    svg.appendChild(svgEl('line', { x1: W - M.r, x2: W - M.r, y1: M.t, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));

    // Restrictions line
    let rD = '';
    ann.forEach((p, i) => { rD += (i ? 'L' : 'M') + xScale(p.year).toFixed(1) + ',' + yLScale(p.restrictions).toFixed(1); });
    svg.appendChild(svgEl('path', { d: rD, stroke: CHART.purple, 'stroke-width': 2.5, fill: 'none' }));
    ann.forEach(p => svg.appendChild(svgEl('circle', { cx: xScale(p.year), cy: yLScale(p.restrictions), r: 3, fill: CHART.purple })));

    // FR pages bars
    const barW = (W - M.l - M.r) / ann.length * 0.55;
    ann.forEach(p => {
      svg.appendChild(svgEl('rect', {
        x: xScale(p.year) - barW / 2,
        y: yRScale(p.fr_pages),
        width: barW, height: H - M.b - yRScale(p.fr_pages),
        fill: CHART.gold, opacity: 0.55
      }));
    });

    svg.appendChild(svgEl('text', { x: M.l - 60, y: M.t - 14, 'text-anchor': 'start', fill: CHART.purple, 'font-size': 10, 'font-family': 'DM Mono, monospace', 'letter-spacing': '0.10em' })).textContent = 'CFR RESTRICTIONS (LEFT)';
    svg.appendChild(svgEl('text', { x: W - M.r - 180, y: M.t - 14, 'text-anchor': 'start', fill: CHART.gold, 'font-size': 10, 'font-family': 'DM Mono, monospace', 'letter-spacing': '0.10em' })).textContent = 'FED. REGISTER PAGES (RIGHT)';
  }

  // ── Chart 6 — measurement bar comparison ────────────────────
  function renderMeasurement(data) {
    const svg = document.getElementById('prod-measure');
    if (!svg) return;
    const W = 1100, H = 360, M = { t: 36, r: 60, b: 36, l: 360 };
    const items = data.measurement.estimates;
    const needed = data.measurement.needed_ppt;
    const yScale = makeScale([0, items.length], [M.t, H - M.b]);
    const xMax = Math.max(needed * 1.15, ...items.map(i => i.ppt));
    const xScale = makeScale([0, xMax], [M.l, W - M.r]);

    svg.innerHTML = '';
    // Needed-line
    svg.appendChild(svgEl('line', {
      x1: xScale(needed), x2: xScale(needed),
      y1: M.t - 8, y2: H - M.b + 4,
      stroke: 'var(--accent)', 'stroke-width': 1.5, 'stroke-dasharray': '6,4', opacity: 0.85
    }));
    svg.appendChild(svgEl('text', {
      x: xScale(needed), y: M.t - 14, 'text-anchor': 'middle',
      fill: 'var(--accent)', 'font-size': 11, 'font-family': 'DM Mono, monospace',
      'font-weight': 500
    })).textContent = 'Gap to explain: ' + needed + ' ppt';

    items.forEach((it, i) => {
      const cy = yScale(i + 0.5);
      const barH = 24;
      svg.appendChild(svgEl('text', {
        x: M.l - 12, y: cy + 4, 'text-anchor': 'end',
        fill: 'var(--ink)', 'font-size': 11, 'font-family': 'DM Mono, monospace'
      })).textContent = it.label;
      const xEnd = xScale(it.ppt);
      svg.appendChild(svgEl('rect', {
        x: M.l, y: cy - barH / 2, width: xEnd - M.l, height: barH,
        fill: it.label.startsWith('Sum') ? 'var(--accent)' : CHART.blue, opacity: 0.78
      }));
      svg.appendChild(svgEl('text', {
        x: xEnd + 8, y: cy + 4, 'text-anchor': 'start',
        fill: 'var(--ink)', 'font-size': 10.5, 'font-family': 'DM Mono, monospace'
      })).textContent = it.ppt + ' ppt';
    });

    // X axis
    svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));
    [0, 0.5, 1.0, 1.3].forEach(v => {
      const x = xScale(v);
      svg.appendChild(svgEl('text', {
        x, y: H - M.b + 18, 'text-anchor': 'middle',
        fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace'
      })).textContent = v.toFixed(1) + ' ppt';
    });
  }

  // ── Chart 7 — capital deepening stacked by asset class ──────
  function renderCapital(data) {
    const svg = document.getElementById('prod-capital');
    if (!svg) return;
    const W = 1100, H = 380, M = { t: 36, r: 60, b: 60, l: 70 };
    const periods = data.capital.periods;
    const xScale = makeScale([0, periods.length], [M.l, W - M.r]);
    const yMax = Math.max(...periods.map(p => p.capital_total)) * 1.2;
    const yScale = makeScale([0, yMax], [H - M.b, M.t]);

    svg.innerHTML = '';
    for (let v = 0; v <= yMax; v += 0.2) {
      const y = yScale(v);
      svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: y, y2: y, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.18 }));
      svg.appendChild(svgEl('text', { x: M.l - 8, y: y + 4, 'text-anchor': 'end', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = v.toFixed(1);
    }
    svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));
    svg.appendChild(svgEl('line', { x1: M.l, x2: M.l, y1: M.t, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));

    const barWidth = (W - M.l - M.r) / periods.length * 0.62;
    const segOrder = [
      { key: 'ipe',   color: CHART.orange, label: 'Info-processing equipment' },
      { key: 'rd',    color: CHART.gold,   label: 'R&D' },
      { key: 'ipp',   color: CHART.purple, label: 'Other IPP' },
      { key: 'other', color: CHART.blue,   label: 'Other capital' },
    ];
    periods.forEach((p, i) => {
      const cx = xScale(i + 0.5);
      let cur = 0;
      segOrder.forEach(s => {
        const v = p[s.key];
        const yLo = yScale(cur);
        const yHi = yScale(cur + v);
        svg.appendChild(svgEl('rect', {
          x: cx - barWidth / 2, y: yHi, width: barWidth, height: yLo - yHi,
          fill: s.color, opacity: 0.85, stroke: 'var(--paper)', 'stroke-width': 0.5
        }));
        cur += v;
      });
      svg.appendChild(svgEl('text', {
        x: cx, y: H - M.b + 18, 'text-anchor': 'middle',
        fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace'
      })).textContent = p.label;
      svg.appendChild(svgEl('text', {
        x: cx, y: yScale(cur) - 6, 'text-anchor': 'middle',
        fill: 'var(--ink)', 'font-size': 10.5, 'font-family': 'DM Mono, monospace',
        'font-weight': 500
      })).textContent = cur.toFixed(1);
    });

    legendInline(svg, M.l + 200, M.t - 14, segOrder.map(s => ({ color: s.color, label: s.label })));
  }

  // ── Hypothesis matrix (HTML grid, not SVG) ──────────────────
  function renderMatrix(data) {
    const wrap = document.getElementById('prod-matrix');
    if (!wrap) return;
    const rows = data.hypotheses.rows;
    const criteria = data.hypotheses.criteria;
    let html = '<div class="prod-matrix-row head">';
    html += '<div>Hypothesis</div>';
    criteria.forEach(c => { html += '<div>' + c + '</div>'; });
    html += '<div>Magnitude</div></div>';
    rows.forEach(r => {
      html += '<div class="prod-matrix-row">';
      html += '<div><strong>' + r.label + '</strong></div>';
      r.scores.forEach(s => {
        const cls = s === 'fits' ? 'fits' : s === 'partial' ? 'partial' : s === 'global' ? 'global' : 'fails';
        const glyph = s === 'fits' ? '✓' : s === 'partial' ? '~' : s === 'global' ? '✓' : '×';
        html += '<div class="prod-matrix-cell ' + cls + '">' + glyph + '</div>';
      });
      html += '<div>' + r.magnitude + '</div>';
      html += '<div class="prod-matrix-verdict">' + r.verdict + '</div>';
      html += '</div>';
    });
    wrap.innerHTML = html;
  }

  // ── AI grid ─────────────────────────────────────────────────
  function renderAi(data) {
    const wrap = document.getElementById('prod-ai');
    if (!wrap) return;
    const ai = data.ai_outlook;
    let html = '';
    html += '<div class="prod-ai-tile fact"><h4>The 2024–2025 facts</h4><ul>';
    ai.facts.forEach(f => { html += '<li>' + f + '</li>'; });
    html += '</ul></div>';
    html += '<div class="prod-ai-tile"><h4>Three reads on the same data</h4><ul>';
    ai.interpretations.forEach(it => {
      html += '<li>' +
        '<div class="interp-side">' + it.side + '</div>' +
        '<div class="interp-forecast">Trend forecast: ' + it.trend_forecast + '</div>' +
        '<div class="interp-logic">' + it.logic + '</div>' +
      '</li>';
    });
    html += '</ul></div>';
    wrap.innerHTML = html;
  }

  // ── Receipts ────────────────────────────────────────────────
  function renderReceipts(data) {
    const wrap = document.getElementById('prod-receipts');
    if (!wrap) return;
    wrap.innerHTML = data.receipts.map(r =>
      '<div class="prod-receipt">' +
        '<div class="prod-receipt-label">' + r.label + '</div>' +
        '<div class="prod-receipt-value">' + r.value + '</div>' +
        '<div class="prod-receipt-sub">' + r.sub + '</div>' +
      '</div>'
    ).join('');
  }
})();
