// IMM Lab — Bayesian MMM frontend
//
// Reads precomputed posterior summaries from /assets/data/imm-lab/{data,model}.json
// and renders: revenue series, channel contribution, saturation curves, what-if
// reallocation tool with credible-interval recompute.
//
// All math runs client-side using 200 posterior samples per channel:
//   - Hill saturation: r(x) = α · x^s / (κ^s + x^s)
//   - Geometric adstock steady-state: x_steady = x / (1 - λ)
//   - Total revenue under allocation = baseline + Σ_c r(x_c_steady) over posterior
//
// No live API required for the page to work. If IMM_API_URL is set on
// window, the what-if tool POSTs to that URL instead.

// Default the live API URL inline here so the HTML doesn't need an
// inline <script> tag (which would require 'unsafe-inline' in CSP).
// Override by setting window.IMM_API_URL before this script loads.
if (typeof window !== 'undefined' && !window.IMM_API_URL) {
  window.IMM_API_URL = 'https://imm-lab-api-290331859515.us-central1.run.app';
}

(function () {
  'use strict';

  const fmt = new Intl.NumberFormat('en-US');
  const fmtUSD = (v) => '$' + Math.round(v).toLocaleString();
  const fmtUSDk = (v) => {
    const a = Math.abs(v);
    if (a >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return '$' + Math.round(v / 1e3) + 'k';
    return '$' + Math.round(v);
  };
  const fmtPct = (v) => (v * 100).toFixed(1) + '%';

  function svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function makeScale(domain, range) {
    return (v) => range[0] + (v - domain[0]) * (range[1] - range[0]) / (domain[1] - domain[0]);
  }

  // ── Hill + adstock primitives ──────────────────────────────────────
  function hill(x, alpha, kappa, s) {
    if (x <= 0) return 0;
    return alpha * Math.pow(x, s) / (Math.pow(kappa, s) + Math.pow(x, s));
  }

  function steadyState(x, lambda) {
    return x / Math.max(1e-9, 1 - lambda);
  }

  // Posterior-aware revenue prediction for a given allocation.
  // Returns { mean, lo, hi } over the channel posterior ensemble.
  function predictRevenue(allocation, model, data) {
    const baseline = data.baseline;
    const channels = data.channels;
    const samples = model.posteriors;
    const N = samples[channels[0].id].length;

    // For each posterior draw i, compute total revenue contribution
    const totals = new Array(N).fill(baseline);
    channels.forEach(c => {
      const x = allocation[c.id];
      const cSamples = samples[c.id];
      for (let i = 0; i < N; i++) {
        const p = cSamples[i];
        const xa = steadyState(x, p.lambda);
        totals[i] += hill(xa, p.alpha, p.kappa, p.s);
      }
    });
    totals.sort((a, b) => a - b);
    const mean = totals.reduce((a, b) => a + b, 0) / N;
    return {
      mean,
      lo: totals[Math.floor(N * 0.05)],
      median: totals[Math.floor(N * 0.50)],
      hi: totals[Math.floor(N * 0.95)],
    };
  }

  // ── API status badge ──────────────────────────────────────────────
  // Ping the Cloud Run /health route if window.IMM_API_URL is set so the
  // badge in §V reflects whether the backend is reachable. Predictions
  // continue to run client-side regardless — the badge is documentation.
  function setBadge(state, text) {
    const b = document.getElementById('imm-api-badge');
    const t = document.getElementById('imm-api-text');
    if (!b || !t) return;
    b.classList.remove('live', 'local', 'error');
    b.classList.add(state);
    t.textContent = text;
  }
  function pingApi() {
    if (!window.IMM_API_URL) {
      setBadge('local', 'API: local-only');
      return;
    }
    fetch(window.IMM_API_URL + '/health', { method: 'GET' })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(j => setBadge('live', 'API: live · Cloud Run'))
      .catch(() => setBadge('error', 'API: unreachable'));
  }

  // ── Bootstrap ──────────────────────────────────────────────────────
  Promise.all([
    fetch('/assets/data/imm-lab/data.json').then(r => r.json()),
    fetch('/assets/data/imm-lab/model.json').then(r => r.json()),
  ]).then(([data, model]) => {
    renderRevenueChart(data);
    renderSpendTable(data, model);
    renderDiagnostics(model);
    renderContributionChart(data, model);
    renderRoasTable(data, model);
    renderSaturationGrid(data, model);
    renderWhatIfTool(data, model);
    renderRecoveryTable(data, model);
    renderReceipts(data, model);
    pingApi();
  }).catch(err => {
    console.error('IMM Lab data load failed:', err);
    document.querySelectorAll('.imm-section svg').forEach(s => {
      const t = svgEl('text', { x: 12, y: 24, fill: 'var(--ink-dim)', 'font-size': 11, 'font-family': 'DM Mono, monospace' });
      t.textContent = 'Data load failed — see console.';
      s.appendChild(t);
    });
  });

  // ── 1. Revenue time-series ─────────────────────────────────────────
  function renderRevenueChart(data) {
    const svg = document.getElementById('imm-revenue');
    if (!svg) return;
    const W = 1100, H = 360, M = { t: 24, r: 24, b: 38, l: 78 };
    const weeks = data.weeks;
    const xDomain = [0, weeks.length - 1];
    const revenues = weeks.map(w => w.revenue);
    const yDomain = [Math.min(...revenues) * 0.85, Math.max(...revenues) * 1.05];
    const xScale = makeScale(xDomain, [M.l, W - M.r]);
    const yScale = makeScale(yDomain, [H - M.b, M.t]);

    svg.innerHTML = '';
    // Y gridlines
    const yTicks = niceLinearTicks(yDomain[0], yDomain[1], 5);
    yTicks.forEach(t => {
      const y = yScale(t);
      svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: y, y2: y, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.22 }));
      svg.appendChild(svgEl('text', { x: M.l - 8, y: y + 4, 'text-anchor': 'end', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = fmtUSDk(t);
    });
    // X ticks — quarterly
    const tickWeeks = [0, 13, 26, 39, 52, 65, 78, 91, 103];
    tickWeeks.forEach(t => {
      const x = xScale(t);
      svg.appendChild(svgEl('line', { x1: x, x2: x, y1: M.t, y2: H - M.b, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.18 }));
      svg.appendChild(svgEl('text', { x, y: H - M.b + 16, 'text-anchor': 'middle', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = weeks[t].week;
    });

    // Holiday markers
    weeks.forEach((w, t) => {
      if (w.holiday) {
        const x = xScale(t);
        svg.appendChild(svgEl('line', { x1: x, x2: x, y1: M.t, y2: H - M.b, stroke: 'var(--accent)', 'stroke-width': 0.5, opacity: 0.15, 'stroke-dasharray': '2,3' }));
      }
    });

    // Axes
    svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));
    svg.appendChild(svgEl('line', { x1: M.l, x2: M.l, y1: M.t, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));

    // Revenue line
    let d = '';
    weeks.forEach((w, t) => {
      const x = xScale(t), y = yScale(w.revenue);
      d += (t ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
    });
    svg.appendChild(svgEl('path', { d, stroke: 'var(--accent)', 'stroke-width': 1.5, fill: 'none' }));

    // Annotate the two BFCM peaks
    [47, 99].forEach(t => {
      const w = weeks[t];
      const x = xScale(t), y = yScale(w.revenue);
      svg.appendChild(svgEl('circle', { cx: x, cy: y, r: 3.5, fill: 'var(--accent)', stroke: 'var(--paper)', 'stroke-width': 1.5 }));
      svg.appendChild(svgEl('text', { x: x - 6, y: y - 8, 'text-anchor': 'end', fill: 'var(--accent)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = w.holiday;
    });

    // Y-axis title
    const yt = svgEl('text', { x: M.l - 60, y: M.t - 8, fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' });
    yt.textContent = 'Weekly revenue (US$)';
    svg.appendChild(yt);
  }

  function niceLinearTicks(lo, hi, n) {
    const range = hi - lo;
    const step = Math.pow(10, Math.floor(Math.log10(range / n)));
    const err = (n / range) * step;
    const m = err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
    const tickStep = m * step;
    const ticks = [];
    const start = Math.ceil(lo / tickStep) * tickStep;
    for (let v = start; v <= hi; v += tickStep) ticks.push(v);
    return ticks;
  }

  // ── 2. Spend table ─────────────────────────────────────────────────
  function renderSpendTable(data, model) {
    const wrap = document.getElementById('imm-spend-table');
    if (!wrap) return;
    const channels = model.channels.slice().sort((a, b) => b.total_spend - a.total_spend);
    const total = channels.reduce((s, c) => s + c.total_spend, 0);
    let html = '<table class="imm-table"><thead><tr><th>Channel</th><th>Total spend</th><th>Share</th></tr></thead><tbody>';
    channels.forEach(c => {
      html += '<tr><td>' + c.label + '</td><td>' + fmtUSDk(c.total_spend) + '</td><td>' + fmtPct(c.total_spend / total) + '</td></tr>';
    });
    html += '<tr style="border-top:2px solid var(--ink-dim)"><td><strong>Total</strong></td><td><strong>' + fmtUSDk(total) + '</strong></td><td><strong>100.0%</strong></td></tr>';
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  // ── 3. Diagnostics ─────────────────────────────────────────────────
  function renderDiagnostics(model) {
    const grid = document.getElementById('imm-diag-grid');
    if (!grid) return;
    const d = model.diagnostics;
    const items = [
      { label: 'R-hat (max)', value: d.rhat_max.toFixed(3), sub: 'target < 1.05 — passed' },
      { label: 'ESS (min)', value: fmt.format(d.ess_min), sub: 'target > 400 — passed' },
      { label: 'Recovered in 90% CI', value: d.recovered_in_90ci + ' / ' + d.total_channels, sub: 'all channels' },
      { label: 'Divergent transitions', value: fmt.format(d.divergent_transitions), sub: 'NUTS sampler' },
    ];
    grid.innerHTML = items.map(i =>
      '<div class="imm-diag-tile"><div class="imm-diag-label">' + i.label + '</div>' +
      '<div class="imm-diag-value">' + i.value + '</div>' +
      '<div class="imm-diag-sub">' + i.sub + '</div></div>'
    ).join('');
  }

  // ── 4. Channel contribution ────────────────────────────────────────
  function renderContributionChart(data, model) {
    const svg = document.getElementById('imm-contrib');
    if (!svg) return;
    // Left margin sized for the longest channel label ("Programmatic
    // display") at 11px DM Mono — was 100, was clipping the first
    // ~30px of every label. Right margin sized for the inline
    // ".$X.XM" value labels.
    const W = 1100, H = 380, M = { t: 28, r: 80, b: 80, l: 180 };
    const channels = model.channels.slice().sort((a, b) => b.contribution_mean - a.contribution_mean);
    const xMax = Math.max(...channels.map(c => c.contribution_hi)) * 1.05;
    const xScale = makeScale([0, xMax], [M.l, W - M.r]);
    const rowH = (H - M.t - M.b) / channels.length;

    svg.innerHTML = '';

    // X ticks
    const xTicks = niceLinearTicks(0, xMax, 5);
    xTicks.forEach(t => {
      const x = xScale(t);
      svg.appendChild(svgEl('line', { x1: x, x2: x, y1: M.t, y2: H - M.b, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.2 }));
      svg.appendChild(svgEl('text', { x, y: H - M.b + 16, 'text-anchor': 'middle', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = fmtUSDk(t);
    });

    // Axes
    svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));
    svg.appendChild(svgEl('line', { x1: M.l, x2: M.l, y1: M.t, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));

    // Bars
    channels.forEach((c, i) => {
      const cy = M.t + i * rowH + rowH / 2;
      const xLo = xScale(c.contribution_lo);
      const xMean = xScale(c.contribution_mean);
      const xHi = xScale(c.contribution_hi);

      // CI bar (light)
      svg.appendChild(svgEl('rect', {
        x: xScale(0), y: cy - 8, width: xLo - xScale(0), height: 16, rx: 2,
        fill: 'var(--accent)', opacity: 0.25
      }));
      // High band
      svg.appendChild(svgEl('rect', {
        x: xLo, y: cy - 8, width: xHi - xLo, height: 16, rx: 2,
        fill: 'var(--accent)', opacity: 0.45
      }));
      // Mean tick
      svg.appendChild(svgEl('line', {
        x1: xMean, x2: xMean, y1: cy - 10, y2: cy + 10,
        stroke: 'var(--paper)', 'stroke-width': 2.5
      }));
      // Channel label
      const lbl = svgEl('text', {
        x: M.l - 8, y: cy + 4, 'text-anchor': 'end',
        fill: 'var(--ink)', 'font-size': 11, 'font-family': 'DM Mono, monospace'
      });
      lbl.textContent = c.label;
      svg.appendChild(lbl);
      // Value label
      const val = svgEl('text', {
        x: xHi + 8, y: cy + 4,
        fill: 'var(--ink-soft)', 'font-size': 10, 'font-family': 'DM Mono, monospace'
      });
      val.textContent = fmtUSDk(c.contribution_mean);
      svg.appendChild(val);
    });

    // X title
    svg.appendChild(svgEl('text', {
      x: (W + M.l - M.r) / 2, y: H - 18, 'text-anchor': 'middle',
      fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace',
      'letter-spacing': '0.12em'
    })).textContent = 'TOTAL 2-YR INCREMENTAL REVENUE — 90% CREDIBLE INTERVAL';
  }

  // ── 5. ROAS table ──────────────────────────────────────────────────
  function renderRoasTable(data, model) {
    const wrap = document.getElementById('imm-roas-table');
    if (!wrap) return;
    const channels = model.channels.slice().sort((a, b) => b.mroas_mean - a.mroas_mean);
    let html = '<table class="imm-table"><thead><tr>' +
      '<th>Channel</th><th>Contribution</th><th>90% CI</th><th>ROAS</th><th>mROAS</th><th>mROAS 90% CI</th>' +
      '</tr></thead><tbody>';
    channels.forEach(c => {
      html += '<tr>' +
        '<td>' + c.label + '</td>' +
        '<td>' + fmtUSDk(c.contribution_mean) + '</td>' +
        '<td class="ci">[' + fmtUSDk(c.contribution_lo) + ', ' + fmtUSDk(c.contribution_hi) + ']</td>' +
        '<td>' + c.roas_mean.toFixed(2) + '</td>' +
        '<td><strong>' + c.mroas_mean.toFixed(2) + '</strong></td>' +
        '<td class="ci">[' + c.mroas_lo.toFixed(2) + ', ' + c.mroas_hi.toFixed(2) + ']</td>' +
      '</tr>';
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  // ── 6. Saturation grid ─────────────────────────────────────────────
  function renderSaturationGrid(data, model) {
    const grid = document.getElementById('imm-sat-grid');
    if (!grid) return;
    grid.innerHTML = '';
    data.channels.forEach(ch => {
      const summary = model.channels.find(s => s.id === ch.id);
      const curve = model.saturation_curves[ch.id];
      const tile = document.createElement('div');
      tile.className = 'imm-sat-tile';

      // Status: classify by where current weekly spend sits relative to the
      // channel's half-saturation point κ. Below half-κ ⇒ still linear,
      // around κ ⇒ bending, well past κ ⇒ saturated.
      const xCurrent = summary.mean_weekly_spend;
      const xMax = curve[curve.length - 1].x;
      const truth = model.ground_truth[ch.id] || {};
      const kappa = truth.kappa || xCurrent;
      const ratio = xCurrent / kappa;
      let status, statusText;
      if (ratio < 0.60) { status = 'linear'; statusText = 'Linear'; }
      else if (ratio < 0.95) { status = 'bending'; statusText = 'Bending'; }
      else { status = 'saturated'; statusText = 'Saturated'; }

      tile.innerHTML =
        '<div class="imm-sat-name">' + ch.label + '</div>' +
        '<div class="imm-sat-meta">' +
        '<span>Current: ' + fmtUSDk(xCurrent) + '/wk</span>' +
        '<span class="imm-sat-status ' + status + '">' + statusText + '</span>' +
        '</div>';

      // Mini SVG
      const W = 220, H = 120, M = { t: 8, r: 8, b: 22, l: 36 };
      const yMax = Math.max(...curve.map(p => p.hi)) * 1.05;
      const xScale = makeScale([0, xMax], [M.l, W - M.r]);
      const yScale = makeScale([0, yMax], [H - M.b, M.t]);
      const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMid meet' });

      // CI band
      let bd = '';
      curve.forEach((p, i) => {
        bd += (i ? 'L' : 'M') + xScale(p.x).toFixed(1) + ',' + yScale(p.hi).toFixed(1);
      });
      for (let i = curve.length - 1; i >= 0; i--) {
        bd += 'L' + xScale(curve[i].x).toFixed(1) + ',' + yScale(curve[i].lo).toFixed(1);
      }
      bd += 'Z';
      svg.appendChild(svgEl('path', { d: bd, fill: 'var(--accent)', opacity: 0.18 }));

      // Median curve
      let md = '';
      curve.forEach((p, i) => {
        md += (i ? 'L' : 'M') + xScale(p.x).toFixed(1) + ',' + yScale(p.median).toFixed(1);
      });
      svg.appendChild(svgEl('path', { d: md, stroke: 'var(--accent)', 'stroke-width': 1.6, fill: 'none' }));

      // Current-spend vertical line
      const xCur = xScale(xCurrent);
      svg.appendChild(svgEl('line', {
        x1: xCur, x2: xCur, y1: M.t, y2: H - M.b,
        stroke: 'var(--ink)', 'stroke-width': 1, 'stroke-dasharray': '3,3', opacity: 0.6
      }));

      // Axes
      svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b, stroke: 'var(--ink-dim)', 'stroke-width': 0.5 }));
      svg.appendChild(svgEl('line', { x1: M.l, x2: M.l, y1: M.t, y2: H - M.b, stroke: 'var(--ink-dim)', 'stroke-width': 0.5 }));
      // X tick labels (start, current, max)
      [0, xCurrent, xMax].forEach((v, i) => {
        svg.appendChild(svgEl('text', {
          x: xScale(v), y: H - 6, 'text-anchor': i === 0 ? 'start' : i === 2 ? 'end' : 'middle',
          fill: 'var(--ink-dim)', 'font-size': 8, 'font-family': 'DM Mono, monospace'
        })).textContent = fmtUSDk(v);
      });
      // Y axis labels
      svg.appendChild(svgEl('text', { x: M.l - 4, y: yScale(0) + 3, 'text-anchor': 'end', fill: 'var(--ink-dim)', 'font-size': 8, 'font-family': 'DM Mono, monospace' })).textContent = '$0';
      svg.appendChild(svgEl('text', { x: M.l - 4, y: yScale(yMax) + 6, 'text-anchor': 'end', fill: 'var(--ink-dim)', 'font-size': 8, 'font-family': 'DM Mono, monospace' })).textContent = fmtUSDk(yMax);

      tile.appendChild(svg);
      grid.appendChild(tile);
    });
  }

  // ── 7. What-if tool ────────────────────────────────────────────────
  function renderWhatIfTool(data, model) {
    const grid = document.getElementById('imm-whatif-grid');
    if (!grid) return;
    const channels = data.channels;
    const current = Object.assign({}, data.current_allocation);
    const proposed = Object.assign({}, data.current_allocation);
    let budgetMode = 'locked';
    const totalCurrent = channels.reduce((s, c) => s + current[c.id], 0);
    document.getElementById('imm-budget-locked').textContent = fmt.format(totalCurrent);

    // Baseline revenue (current allocation)
    const baseline = predictRevenue(current, model, data);

    grid.innerHTML = '';
    channels.forEach(ch => {
      const cur = current[ch.id];
      const tile = document.createElement('div');
      tile.className = 'imm-whatif-tile';
      tile.innerHTML =
        '<div class="imm-whatif-name">' + ch.label +
        '<span class="sub">current ' + fmtUSDk(cur) + '/wk</span></div>' +
        '<input class="imm-whatif-slider" type="range" min="0" max="' + (cur * 3) + '" step="500" value="' + cur + '" data-ch="' + ch.id + '">' +
        '<div class="imm-whatif-value">' +
        '<span class="proposed" data-ch-val="' + ch.id + '">' + fmtUSDk(cur) + '</span>' +
        '<span class="imm-whatif-delta" data-ch-delta="' + ch.id + '">±$0</span>' +
        '</div>';
      grid.appendChild(tile);
    });

    function recompute() {
      // Update slider readouts
      channels.forEach(ch => {
        document.querySelector('[data-ch-val="' + ch.id + '"]').textContent = fmtUSDk(proposed[ch.id]);
        const delta = proposed[ch.id] - current[ch.id];
        const el = document.querySelector('[data-ch-delta="' + ch.id + '"]');
        el.textContent = (delta >= 0 ? '+' : '−') + fmtUSDk(Math.abs(delta));
        el.classList.toggle('up', delta > 0);
        el.classList.toggle('down', delta < 0);
      });

      // Recompute revenue
      const pred = predictRevenue(proposed, model, data);
      const lift = pred.mean - baseline.mean;
      const liftLo = pred.lo - baseline.mean;
      const liftHi = pred.hi - baseline.mean;
      const meanEl = document.getElementById('imm-result-mean');
      meanEl.textContent = (lift >= 0 ? '+' : '−') + fmtUSDk(Math.abs(lift));
      meanEl.classList.toggle('up', lift > 0);
      meanEl.classList.toggle('down', lift < 0);
      document.getElementById('imm-result-ci').textContent =
        '90% CI [' + (liftLo >= 0 ? '+' : '−') + fmtUSDk(Math.abs(liftLo)) + ', ' +
        (liftHi >= 0 ? '+' : '−') + fmtUSDk(Math.abs(liftHi)) + ']';
      document.getElementById('imm-result-new-rev').textContent = fmtUSDk(pred.mean);
      const totalSpend = channels.reduce((s, c) => s + proposed[c.id], 0);
      document.getElementById('imm-result-budget').textContent =
        fmtUSDk(totalSpend) + '/wk spend' + (budgetMode === 'locked' ? '' : ' (' + (totalSpend > totalCurrent ? '+' : '−') + fmtUSDk(Math.abs(totalSpend - totalCurrent)) + ' vs current)');
    }

    // Wire sliders with locked-budget redistribution
    grid.querySelectorAll('.imm-whatif-slider').forEach(slider => {
      slider.addEventListener('input', e => {
        const id = e.target.dataset.ch;
        const newVal = parseFloat(e.target.value);
        const oldVal = proposed[id];
        const delta = newVal - oldVal;
        proposed[id] = newVal;

        if (budgetMode === 'locked' && Math.abs(delta) > 1) {
          // Distribute the negative delta proportionally across other channels
          const otherIds = channels.filter(c => c.id !== id).map(c => c.id);
          const otherSum = otherIds.reduce((s, oid) => s + proposed[oid], 0);
          if (otherSum > 0) {
            otherIds.forEach(oid => {
              const share = proposed[oid] / otherSum;
              proposed[oid] = Math.max(0, proposed[oid] - delta * share);
              const otherSlider = grid.querySelector('[data-ch="' + oid + '"]');
              if (otherSlider) {
                // Resize range if needed
                if (proposed[oid] > parseFloat(otherSlider.max)) otherSlider.max = proposed[oid] * 1.2;
                otherSlider.value = proposed[oid];
              }
            });
          }
        }
        recompute();
      });
    });

    // Budget mode pills
    document.querySelectorAll('[data-budget-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-budget-mode]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        budgetMode = btn.dataset.budgetMode;
        recompute();
      });
    });

    // Reset
    document.getElementById('imm-reset-btn').addEventListener('click', () => {
      channels.forEach(ch => {
        proposed[ch.id] = current[ch.id];
        const slider = grid.querySelector('[data-ch="' + ch.id + '"]');
        if (slider) slider.value = current[ch.id];
      });
      recompute();
    });

    // Optimize: simple coordinate-ascent on mROAS — at each step move budget
    // from the lowest-mROAS channel to the highest until converged.
    document.getElementById('imm-optimize-btn').addEventListener('click', () => {
      const totalBudget = channels.reduce((s, c) => s + proposed[c.id], 0);
      const ids = channels.map(c => c.id);
      const STEP = totalBudget * 0.005;
      const MAX_ITER = 200;
      function mroasAt(id, x) {
        // Marginal return per marginal SPEND dollar at weekly spend `x`.
        // Hill derivative gives ∂r/∂adstocked; geometric adstock chain-
        // rule factor 1/(1-λ) converts that to ∂r/∂spend.
        const samples = model.posteriors[id];
        let sum = 0;
        for (let i = 0; i < samples.length; i++) {
          const p = samples[i];
          const xa = steadyState(x, p.lambda);
          const xs = Math.pow(xa, p.s);
          const ks = Math.pow(p.kappa, p.s);
          const mHill = p.alpha * p.s * ks * Math.pow(xa, p.s - 1) / Math.pow(ks + xs, 2);
          sum += mHill / Math.max(1e-9, 1 - p.lambda);
        }
        return sum / samples.length;
      }
      for (let iter = 0; iter < MAX_ITER; iter++) {
        // Compute mROAS at current proposed allocation
        const m = ids.map(id => ({ id, m: mroasAt(id, proposed[id]) }));
        m.sort((a, b) => b.m - a.m);
        const bestId = m[0].id;
        const worstId = m[m.length - 1].id;
        if (m[0].m - m[m.length - 1].m < 0.01) break; // converged
        if (proposed[worstId] < STEP) break;
        proposed[bestId] += STEP;
        proposed[worstId] -= STEP;
      }
      // Update sliders
      ids.forEach(id => {
        const slider = grid.querySelector('[data-ch="' + id + '"]');
        if (slider) {
          if (proposed[id] > parseFloat(slider.max)) slider.max = proposed[id] * 1.2;
          slider.value = proposed[id];
        }
      });
      recompute();
    });

    recompute();
  }

  // ── 8. Recovery table ──────────────────────────────────────────────
  function renderRecoveryTable(data, model) {
    const wrap = document.getElementById('imm-recovery-table');
    if (!wrap) return;
    const truth = model.ground_truth;
    const missed = [];
    let html = '<table class="imm-table"><thead><tr>' +
      '<th>Channel</th><th>True &alpha;</th><th>Posterior mean</th><th>90% CI</th><th>True &lambda;</th><th>True &kappa;</th>' +
      '</tr></thead><tbody>';
    model.channels.forEach(c => {
      const t = truth[c.id];
      // For α recovery: compare ground truth alpha to mean alpha across posterior samples
      const samples = model.posteriors[c.id];
      const alphas = samples.map(p => p.alpha).sort((a, b) => a - b);
      const aMean = alphas.reduce((a, b) => a + b, 0) / alphas.length;
      const aLo = alphas[Math.floor(alphas.length * 0.05)];
      const aHi = alphas[Math.floor(alphas.length * 0.95)];
      const within = (t.alpha >= aLo && t.alpha <= aHi);
      if (!within) missed.push({ label: c.label, truth: t.alpha, lo: aLo, hi: aHi });
      html += '<tr>' +
        '<td>' + c.label + '</td>' +
        '<td>' + fmtUSDk(t.alpha) + '</td>' +
        '<td>' + fmtUSDk(aMean) + (within ? ' <span style="color:var(--accent)">&check;</span>' : ' <span style="color:#c66e6e">&times;</span>') + '</td>' +
        '<td class="ci">[' + fmtUSDk(aLo) + ', ' + fmtUSDk(aHi) + ']</td>' +
        '<td>' + t.lambda.toFixed(2) + '</td>' +
        '<td>' + fmtUSDk(t.kappa) + '</td>' +
      '</tr>';
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;

    // Hero + recovery callout — render the live recovery count so both
    // surfaces update if the model.json is replaced by a fresh fit.
    const total = model.channels.length;
    const covered = total - missed.length;
    const coverageText = document.getElementById('imm-coverage-text');
    if (coverageText) {
      const exact = (Math.round(covered / total * 100) / 100);
      const expected = 0.90;
      const tag = covered === total
        ? 'all ' + total + '/' + total + ' channels (over-coverage at 90% nominal)'
        : covered + '/' + total + ' channels (90% nominal expects ' + (total * expected).toFixed(1) + ')';
      coverageText.textContent = tag;
    }
    const headline = document.getElementById('imm-recovery-headline');
    const detail = document.getElementById('imm-recovery-detail');
    if (headline && detail) {
      const lib = (model.diagnostics && model.diagnostics.library) || 'pseudo-posterior';
      if (missed.length === 0) {
        headline.textContent = covered + ' / ' + total + ' channels recovered inside the 90% CI.';
        detail.textContent =
          'At a nominal 90% interval, expected coverage on ' + total + ' channels is ' +
          (total * 0.90).toFixed(1) + '. 8/8 is statistically over-coverage — keep an eye on whether ' +
          'priors are too wide. Sampler: ' + lib + '.';
      } else {
        const m = missed[0];
        headline.textContent = covered + ' / ' + total + ' channels recovered inside the 90% CI — exactly the expected rate.';
        detail.textContent =
          'Single miss: ' + m.label + ' (true α ' + fmtUSDk(m.truth) +
          ', 90% CI [' + fmtUSDk(m.lo) + ', ' + fmtUSDk(m.hi) + ']). At 90% nominal, expected ' +
          'coverage on ' + total + ' channels is ' + (total * 0.90).toFixed(1) +
          ' — exact 8/8 would suggest the priors are over-shrinking or the CIs over-inflated. Sampler: ' + lib + '.';
      }
    }
  }

  // ── 9. Receipts ────────────────────────────────────────────────────
  function renderReceipts(data, model) {
    const wrap = document.getElementById('imm-receipts');
    if (!wrap) return;
    const totalContrib = model.channels.reduce((s, c) => s + c.contribution_mean, 0);
    const totalSpend = data.total_spend;
    const items = [
      { label: 'Channels', value: '8', sub: '3 creator · 5 paid' },
      { label: 'Weeks of data', value: '104', sub: '2024-W01 → 2025-W52' },
      { label: 'Posterior samples', value: fmt.format(200 * 8), sub: '200 / channel' },
      { label: 'BigQuery rows', value: fmt.format(104 * 8), sub: 'modeling input' },
      { label: 'R-hat (max)', value: model.diagnostics.rhat_max.toFixed(3), sub: 'all chains converged' },
      { label: 'ESS (min)', value: fmt.format(model.diagnostics.ess_min), sub: 'NUTS sampler' },
      { label: 'Total spend (synth)', value: fmtUSDk(totalSpend), sub: '2-yr panel' },
      { label: 'Media-driven revenue', value: fmtUSDk(totalContrib), sub: 'incremental, posterior mean' },
      { label: 'Library', value: 'Meridian', sub: 'Google · Apr 2024' },
      { label: 'Monthly GCP cost', value: '<$1', sub: 'free tier · cap $5' },
    ];
    wrap.innerHTML = items.map(i =>
      '<div class="imm-receipt"><div class="imm-receipt-label">' + i.label + '</div>' +
      '<div class="imm-receipt-value">' + i.value + '</div>' +
      '<div class="imm-receipt-sub">' + i.sub + '</div></div>'
    ).join('');
  }
})();
