(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     CHURN LAB — page logic
     Loads 9 JSON files, renders hand-rolled SVG charts,
     runs a client-side logistic-regression scorer and a
     threshold-sweep widget.
     ═══════════════════════════════════════════════════════════ */

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const DATA_BASE = '/assets/data/churn/';

  const FILES = [
    'data_profile', 'metrics', 'roc_curves', 'pr_curves',
    'predictions', 'lr_scoring', 'shap_summary',
    'fairness', 'threshold_sweep',
  ];

  // ── Fetch all artifacts in parallel ─────────────────────────
  Promise.all(FILES.map(name =>
    fetch(DATA_BASE + name + '.json').then(r => {
      if (!r.ok) throw new Error('fetch failed: ' + name);
      return r.json();
    })
  )).then(results => {
    const data = {};
    FILES.forEach((name, i) => { data[name] = results[i]; });
    window.__churn = data; // handy for console debugging
    init(data);
  }).catch(err => {
    console.error('[churn-lab] artifact load failed', err);
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div style="position:fixed;bottom:20px;right:20px;padding:12px 16px;background:var(--paper-2);border:1px solid var(--ink);font-family:DM Mono,monospace;font-size:11px;">could not load model artifacts — try a hard refresh</div>'
    );
  });

  // ── Main ─────────────────────────────────────────────────────
  function init(d) {
    renderProfile(d.data_profile);
    renderModelTable(d.metrics);
    renderROC(d.roc_curves);
    renderScoring(d.lr_scoring);
    renderThreshold(d.predictions, d.threshold_sweep);
    renderShapBars(d.shap_summary);
    renderShapDependence(d.shap_summary);
    renderFairness(d.fairness);
    const el = document.getElementById('regenerated-at');
    if (el) el.textContent = d.data_profile.regenerated_at;
  }

  // ── Helpers ──────────────────────────────────────────────────
  function el(tag, attrs, children) {
    const n = document.createElementNS(SVG_NS, tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (children) children.forEach(c => c && n.appendChild(c));
    return n;
  }
  function fmt(v, d) { return Number(v).toFixed(d == null ? 2 : d); }
  function fmtPct(v, d) { return (Number(v) * 100).toFixed(d == null ? 1 : d) + '%'; }
  function fmtNum(v) {
    if (v == null) return '—';
    if (Math.abs(v) >= 1000) return v.toLocaleString();
    return String(v);
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ── § II — Data profile ──────────────────────────────────────
  function renderProfile(p) {
    const grid = document.getElementById('profile-grid');
    const metrics = [
      { v: p.row_count.toLocaleString(), l: 'rows' },
      { v: p.features.length, l: 'features' },
      { v: fmtPct(p.churn_rate, 1), l: 'churn rate' },
      { v: p.splits.train.toLocaleString(), l: 'train rows' },
      { v: p.splits.test.toLocaleString(), l: 'test rows' },
      { v: p.seed, l: 'seed' },
    ];
    grid.innerHTML = metrics.map(m =>
      `<div class="metric"><div class="serif metric-value">${m.v}</div><div class="mono metric-label">${m.l}</div></div>`
    ).join('');
    const sub = document.getElementById('profile-sub');
    const geo = p.geography_counts;
    const gen = p.gender_counts;
    sub.textContent =
      `Geography · France ${geo.France.toLocaleString()} · Germany ${geo.Germany.toLocaleString()} · Spain ${geo.Spain.toLocaleString()}` +
      `  ·  Gender · Female ${gen.Female.toLocaleString()} · Male ${gen.Male.toLocaleString()}`;
  }

  // ── § III — Model comparison table ───────────────────────────
  function renderModelTable(m) {
    const cols = ['accuracy', 'precision', 'recall', 'f1', 'roc_auc', 'pr_auc'];
    const tbody = document.querySelector('#model-table tbody');
    const bestIdx = {};
    cols.forEach(c => {
      let best = -Infinity, idx = -1;
      m.models.forEach((row, i) => {
        if (row[c] > best) { best = row[c]; idx = i; }
      });
      bestIdx[c] = idx;
    });
    tbody.innerHTML = m.models.map((row, i) => {
      const cells = cols.map(c => {
        const cls = bestIdx[c] === i ? 'is-best' : '';
        return `<td class="${cls}">${fmt(row[c], 3)}</td>`;
      }).join('');
      return `<tr><td class="name">${row.label}</td>${cells}</tr>`;
    }).join('');
  }

  // ── § IV — ROC curves ────────────────────────────────────────
  function renderROC(roc) {
    const svg = document.getElementById('roc-chart');
    svg.innerHTML = '';
    const W = 900, H = 560;
    const P = { l: 72, r: 40, t: 30, b: 68 };
    const innerW = W - P.l - P.r;
    const innerH = H - P.t - P.b;

    // Gridlines + ticks
    const g = el('g');
    svg.appendChild(g);
    const ticks = [0, 0.25, 0.5, 0.75, 1];
    ticks.forEach(t => {
      const x = P.l + t * innerW;
      const y = P.t + (1 - t) * innerH;
      g.appendChild(el('line', { class: 'gridline', x1: P.l, x2: P.l + innerW, y1: y, y2: y }));
      g.appendChild(el('line', { class: 'gridline', x1: x, x2: x, y1: P.t, y2: P.t + innerH }));
      const lx = el('text', { class: 'tick-label', x: x, y: P.t + innerH + 18, 'text-anchor': 'middle' });
      lx.textContent = t.toFixed(2);
      g.appendChild(lx);
      const ly = el('text', { class: 'tick-label', x: P.l - 10, y: y + 4, 'text-anchor': 'end' });
      ly.textContent = t.toFixed(2);
      g.appendChild(ly);
    });
    // Axes
    g.appendChild(el('line', { class: 'axis', x1: P.l, x2: P.l, y1: P.t, y2: P.t + innerH }));
    g.appendChild(el('line', { class: 'axis', x1: P.l, x2: P.l + innerW, y1: P.t + innerH, y2: P.t + innerH }));
    // Diagonal reference
    g.appendChild(el('line', {
      x1: P.l, y1: P.t + innerH, x2: P.l + innerW, y2: P.t,
      stroke: 'var(--ink-dim)', 'stroke-opacity': 0.4,
      'stroke-dasharray': '3 4', 'stroke-width': 1,
    }));
    // Axis labels
    const xlab = el('text', { class: 'axis-label', x: P.l + innerW / 2, y: H - 14, 'text-anchor': 'middle' });
    xlab.textContent = 'False Positive Rate';
    g.appendChild(xlab);
    const ylab = el('text', {
      class: 'axis-label', x: 0, y: 0,
      transform: `translate(22 ${P.t + innerH / 2}) rotate(-90)`,
      'text-anchor': 'middle',
    });
    ylab.textContent = 'True Positive Rate';
    g.appendChild(ylab);

    // Series mapping: ink, dim, accent
    // Best model by ROC-AUC → accent
    const rocOrdered = roc.models.slice().sort((a, b) => {
      // compute AUC via trapezoidal rule
      const aucA = trapz(a.fpr, a.tpr);
      const aucB = trapz(b.fpr, b.tpr);
      return aucB - aucA;
    });
    const colorMap = {};
    colorMap[rocOrdered[0].key] = 'series-accent';
    colorMap[rocOrdered[1].key] = 'series-ink';
    colorMap[rocOrdered[2].key] = 'series-dim';

    function px(p) {
      return {
        x: P.l + p.fpr * innerW,
        y: P.t + (1 - p.tpr) * innerH,
      };
    }

    const series = [];
    roc.models.forEach(m => {
      const pts = m.fpr.map((f, i) => ({ fpr: f, tpr: m.tpr[i], thr: m.thr[i] }));
      const path = pts.map((p, i) => {
        const { x, y } = px(p);
        return (i === 0 ? 'M' : 'L') + x.toFixed(2) + ',' + y.toFixed(2);
      }).join(' ');
      const node = el('path', { class: 'series ' + colorMap[m.key], d: path });
      g.appendChild(node);
      series.push({ key: m.key, label: m.label, pts, colorClass: colorMap[m.key] });
    });

    // Hover overlay + readout
    const hover = el('g', { style: 'pointer-events: none;' });
    const hLine = el('line', { class: 'hover-line', y1: P.t, y2: P.t + innerH, x1: -10, x2: -10 });
    hover.appendChild(hLine);
    const hDots = series.map(s => el('circle', { class: 'hover-dot', r: 4, cx: -10, cy: -10 }));
    hDots.forEach(d => hover.appendChild(d));
    g.appendChild(hover);

    const overlay = el('rect', {
      x: P.l, y: P.t, width: innerW, height: innerH,
      fill: 'transparent',
    });
    svg.appendChild(overlay);

    const readout = document.getElementById('roc-readout');

    function onMove(ev) {
      const rect = svg.getBoundingClientRect();
      const x = (ev.clientX - rect.left) * (W / rect.width);
      const y = (ev.clientY - rect.top) * (H / rect.height);
      if (x < P.l || x > P.l + innerW || y < P.t || y > P.t + innerH) return;
      const fpr = clamp((x - P.l) / innerW, 0, 1);
      hLine.setAttribute('x1', x); hLine.setAttribute('x2', x);
      const rows = [];
      series.forEach((s, i) => {
        // find closest point by fpr
        let best = s.pts[0];
        let bd = Math.abs(best.fpr - fpr);
        for (let k = 1; k < s.pts.length; k++) {
          const d = Math.abs(s.pts[k].fpr - fpr);
          if (d < bd) { bd = d; best = s.pts[k]; }
        }
        const pp = { fpr: best.fpr, tpr: best.tpr };
        const xx = P.l + pp.fpr * innerW;
        const yy = P.t + (1 - pp.tpr) * innerH;
        hDots[i].setAttribute('cx', xx);
        hDots[i].setAttribute('cy', yy);
        rows.push(`${s.label.split(' ')[0]} t=${fmt(best.thr, 2)} tpr=${fmt(best.tpr, 2)} fpr=${fmt(best.fpr, 2)}`);
      });
      readout.innerHTML = '<span class="label">' + rows[0].split(' ')[0].toUpperCase() + '</span> <span class="value">' + rows[0].substring(rows[0].indexOf(' ') + 1) + '</span>';
      // Show closest-series (top of legend by AUC) by default
    }
    function onLeave() {
      hLine.setAttribute('x1', -10); hLine.setAttribute('x2', -10);
      hDots.forEach(d => { d.setAttribute('cx', -10); d.setAttribute('cy', -10); });
      readout.innerHTML = '<span class="label">HOVER</span> <span class="value">— for threshold / TPR / FPR</span>';
    }
    overlay.addEventListener('mousemove', onMove);
    overlay.addEventListener('mouseleave', onLeave);
    // touch
    overlay.addEventListener('touchmove', function (ev) {
      if (ev.touches && ev.touches[0]) onMove(ev.touches[0]);
    }, { passive: true });

    // Legend
    const legend = document.getElementById('roc-legend');
    legend.innerHTML = series.map(s => {
      const col = s.colorClass === 'series-accent' ? 'var(--accent)'
                : s.colorClass === 'series-ink' ? 'var(--ink)'
                : 'var(--ink-dim)';
      const auc = trapz(s.pts.map(p => p.fpr), s.pts.map(p => p.tpr));
      return `<span><span class="sw" style="background:${col}"></span>${s.label} · AUC ${fmt(auc, 3)}</span>`;
    }).join('');
  }

  function trapz(xs, ys) {
    let a = 0;
    for (let i = 1; i < xs.length; i++) {
      a += (xs[i] - xs[i - 1]) * (ys[i] + ys[i - 1]) / 2;
    }
    return Math.abs(a);
  }

  // ── § V — Live LR scoring widget ─────────────────────────────
  function renderScoring(lrs) {
    const host = document.getElementById('scoring-inputs');
    const featureLabels = {
      CreditScore: 'Credit score',
      Age: 'Age',
      Tenure: 'Tenure (yrs)',
      Balance: 'Balance ($)',
      NumOfProducts: 'Products',
      EstimatedSalary: 'Est. salary ($)',
    };
    // Numeric sliders
    const sliderRows = lrs.numeric_features.map(f => {
      const h = lrs.feature_hints[f];
      return `
        <div class="score-input-row">
          <label for="in-${f}">${featureLabels[f]}</label>
          <input type="range" id="in-${f}" data-feat="${f}" min="${h.min}" max="${h.max}" step="${h.step}" value="${h.default}">
          <div class="val" id="val-${f}">${fmtNum(h.default)}</div>
        </div>`;
    }).join('');

    // Dropdowns
    const dropdowns = `
      <div class="score-select-row">
        <div class="score-select">
          <label for="in-Geography">Geography</label>
          <select id="in-Geography">
            ${lrs.geography_values.map(g => `<option value="${g}">${g}</option>`).join('')}
          </select>
        </div>
        <div class="score-select">
          <label for="in-Gender">Gender</label>
          <select id="in-Gender">
            ${lrs.gender_values.map(g => `<option value="${g}">${g}</option>`).join('')}
          </select>
        </div>
      </div>`;

    // Toggles
    const toggles = `
      <div class="score-toggle-row">
        <label class="score-toggle">
          <input type="checkbox" id="in-HasCrCard" checked>
          <span class="box"></span>
          <span>Has credit card</span>
        </label>
        <label class="score-toggle">
          <input type="checkbox" id="in-IsActiveMember" checked>
          <span class="box"></span>
          <span>Active member</span>
        </label>
      </div>`;

    host.innerHTML = sliderRows + dropdowns + toggles;

    const state = {};
    lrs.numeric_features.forEach(f => { state[f] = lrs.feature_hints[f].default; });
    state.Geography = 'France';
    state.Gender = 'Female';
    state.HasCrCard = 1;
    state.IsActiveMember = 1;

    function setNumeric(f, v) {
      state[f] = Number(v);
      document.getElementById('val-' + f).textContent = fmtNum(Math.round(state[f]));
    }
    lrs.numeric_features.forEach(f => {
      const inp = document.getElementById('in-' + f);
      inp.addEventListener('input', () => { setNumeric(f, inp.value); update(); });
    });
    document.getElementById('in-Geography').addEventListener('change', e => {
      state.Geography = e.target.value; update();
    });
    document.getElementById('in-Gender').addEventListener('change', e => {
      state.Gender = e.target.value; update();
    });
    document.getElementById('in-HasCrCard').addEventListener('change', e => {
      state.HasCrCard = e.target.checked ? 1 : 0; update();
    });
    document.getElementById('in-IsActiveMember').addEventListener('change', e => {
      state.IsActiveMember = e.target.checked ? 1 : 0; update();
    });

    function buildVector() {
      // Build in FEATURE_ORDER
      return lrs.feature_order.map(f => {
        if (lrs.numeric_features.includes(f)) {
          const m = lrs.means[f], s = lrs.stds[f];
          return (state[f] - m) / s;
        }
        if (f === 'HasCrCard')  return state.HasCrCard;
        if (f === 'IsActiveMember') return state.IsActiveMember;
        if (f === 'Gender') return state.Gender === 'Male' ? 1 : 0;
        if (f === 'Geography_Germany') return state.Geography === 'Germany' ? 1 : 0;
        if (f === 'Geography_Spain')   return state.Geography === 'Spain'   ? 1 : 0;
        return 0;
      });
    }

    function update() {
      const x = buildVector();
      const coefs = lrs.feature_order.map(f => lrs.coefficients[f]);
      let logit = lrs.intercept;
      const contribs = [];
      for (let i = 0; i < x.length; i++) {
        const c = coefs[i] * x[i];
        logit += c;
        contribs.push({ feature: lrs.feature_order[i], contrib: c, raw: x[i] });
      }
      const proba = 1 / (1 + Math.exp(-logit));
      document.getElementById('score-number').textContent = fmtPct(proba, 1);
      document.getElementById('score-bar-fill').style.width = (proba * 100).toFixed(2) + '%';
      const verdict = proba >= 0.5 ? 'Likely to churn' : 'Likely to stay';
      document.getElementById('score-verdict').textContent = verdict;

      const up = contribs.filter(c => c.contrib > 0.001).sort((a, b) => b.contrib - a.contrib).slice(0, 3);
      const dn = contribs.filter(c => c.contrib < -0.001).sort((a, b) => a.contrib - b.contrib).slice(0, 3);

      const pretty = f =>
        f === 'Geography_Germany' ? 'Germany' :
        f === 'Geography_Spain' ? 'Spain' :
        f === 'IsActiveMember' ? 'Active member' :
        f === 'HasCrCard' ? 'Has credit card' :
        f === 'NumOfProducts' ? 'Products' :
        f === 'EstimatedSalary' ? 'Est. salary' :
        f === 'CreditScore' ? 'Credit score' :
        f;
      const row = c => `<li><span class="f">${pretty(c.feature)}</span><span class="v">${c.contrib >= 0 ? '+' : ''}${fmt(c.contrib, 2)}</span></li>`;
      document.getElementById('score-up').innerHTML   = up.length ? up.map(row).join('') : '<li style="color:var(--ink-dim)">—</li>';
      document.getElementById('score-down').innerHTML = dn.length ? dn.map(row).join('') : '<li style="color:var(--ink-dim)">—</li>';
    }
    update();
  }

  // ── § VI — Threshold tuning ──────────────────────────────────
  function renderThreshold(pred, sweep) {
    const yTrue = pred.y_true;
    const yProb = pred.y_proba;
    const N = yTrue.length;
    const cFn = sweep.cost_model.cost_fn;
    const cFp = sweep.cost_model.cost_fp;

    function cmAt(t) {
      let tp = 0, fp = 0, tn = 0, fn = 0;
      for (let i = 0; i < N; i++) {
        const p = yProb[i] >= t ? 1 : 0;
        const y = yTrue[i];
        if (p === 1 && y === 1) tp++;
        else if (p === 1 && y === 0) fp++;
        else if (p === 0 && y === 0) tn++;
        else fn++;
      }
      return { tp, fp, tn, fn };
    }
    function costPerK(cm) {
      return (cm.fn * cFn + cm.fp * cFp) / N * 1000;
    }
    function prec(cm) { return cm.tp + cm.fp === 0 ? 0 : cm.tp / (cm.tp + cm.fp); }
    function rec(cm)  { return cm.tp + cm.fn === 0 ? 0 : cm.tp / (cm.tp + cm.fn); }

    // Find cost-minimizing threshold (0.01 resolution)
    let bestT = 0.5, bestCost = Infinity;
    for (let t = 0.05; t <= 0.951; t += 0.01) {
      const c = costPerK(cmAt(t));
      if (c < bestCost) { bestCost = c; bestT = t; }
    }
    bestT = Math.round(bestT * 100) / 100;

    // Business headline — populate the § I spans from the same cost model.
    // "Do nothing" baseline = every real churner is a missed churner.
    const nChurners = yTrue.reduce((a, v) => a + v, 0);
    const baselinePerK = (nChurners * cFn) / N * 1000;
    const bestPerK = costPerK(cmAt(bestT));
    const savingsPerK = baselinePerK - bestPerK;
    const reductionPct = savingsPerK / baselinePerK;
    const round1k = x => '$' + (Math.round(x / 1000) * 1000).toLocaleString();
    const setTxt = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    setTxt('biz-baseline',       round1k(baselinePerK));
    setTxt('biz-baseline-2',     round1k(baselinePerK));
    setTxt('biz-best',           round1k(bestPerK));
    setTxt('biz-reduction',      Math.round(reductionPct * 100) + '%');
    setTxt('biz-total-savings',  round1k(savingsPerK * 10));  // per 10,000 customers

    // Dot position on the track — same scale as the slider min/max
    const SL_MIN = 0.05, SL_MAX = 0.95;
    const frac = (bestT - SL_MIN) / (SL_MAX - SL_MIN);
    document.querySelector('.threshold-track-overlay')
      .style.setProperty('--opt-x', (frac * 100).toFixed(2) + '%');

    const slider = document.getElementById('thr-slider');
    const elThrVal  = document.getElementById('thr-value');
    const elPrec    = document.getElementById('thr-prec');
    const elRec     = document.getElementById('thr-rec');
    const elCost    = document.getElementById('thr-cost');
    const elFlag    = document.getElementById('thr-flag');
    const elCap     = document.getElementById('thr-caption');

    function update() {
      const t = Number(slider.value);
      const cm = cmAt(t);
      document.getElementById('cm-tp').textContent = cm.tp;
      document.getElementById('cm-fp').textContent = cm.fp;
      document.getElementById('cm-tn').textContent = cm.tn;
      document.getElementById('cm-fn').textContent = cm.fn;
      elThrVal.textContent = fmt(t, 2);
      elPrec.textContent = fmt(prec(cm), 2);
      elRec.textContent  = fmt(rec(cm),  2);
      elCost.textContent = '$' + Math.round(costPerK(cm)).toLocaleString();
      elFlag.textContent = fmtPct((cm.tp + cm.fp) / N, 1);
      const optCm = cmAt(bestT);
      elCap.textContent =
        'Cost model: $' + cFn + ' per missed churner, $' + cFp + ' per false flag. ' +
        'Cost-minimizing threshold = ' + fmt(bestT, 2) +
        '  (≈ $' + Math.round(costPerK(optCm)).toLocaleString() + ' / 1k)';
    }
    slider.addEventListener('input', update);
    update();
  }

  // ── § VII — SHAP bar chart ───────────────────────────────────
  function renderShapBars(shap) {
    const svg = document.getElementById('shap-bars');
    svg.innerHTML = '';
    const W = 900, H = 520;
    const P = { l: 190, r: 60, t: 20, b: 44 };
    const innerW = W - P.l - P.r;
    const innerH = H - P.t - P.b;

    const rows = shap.mean_abs_shap.slice().sort((a, b) => b.value - a.value);
    const max = rows[0].value * 1.08;

    const barH = Math.max(16, innerH / rows.length - 6);
    const gap = 6;

    const pretty = f =>
      f === 'Geography_Germany' ? 'Germany (vs FR)' :
      f === 'Geography_Spain' ? 'Spain (vs FR)' :
      f === 'IsActiveMember' ? 'Active member' :
      f === 'HasCrCard' ? 'Has credit card' :
      f === 'NumOfProducts' ? '# of products' :
      f === 'EstimatedSalary' ? 'Est. salary' :
      f === 'CreditScore' ? 'Credit score' :
      f;

    // x-axis ticks
    const axisG = el('g');
    svg.appendChild(axisG);
    const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];
    ticks.forEach(t => {
      const x = P.l + (t / max) * innerW;
      axisG.appendChild(el('line', { class: 'gridline', x1: x, x2: x, y1: P.t, y2: P.t + innerH }));
      const tl = el('text', { class: 'tick-label', x: x, y: P.t + innerH + 16, 'text-anchor': 'middle' });
      tl.textContent = fmt(t, 2);
      axisG.appendChild(tl);
    });
    axisG.appendChild(el('line', { class: 'axis', x1: P.l, x2: P.l, y1: P.t, y2: P.t + innerH }));
    axisG.appendChild(el('line', { class: 'axis', x1: P.l, x2: P.l + innerW, y1: P.t + innerH, y2: P.t + innerH }));

    const axLab = el('text', { class: 'axis-label', x: P.l + innerW / 2, y: H - 12, 'text-anchor': 'middle' });
    axLab.textContent = 'Mean |SHAP value|';
    axisG.appendChild(axLab);

    rows.forEach((r, i) => {
      const y = P.t + i * ((innerH) / rows.length) + 2;
      const w = (r.value / max) * innerW;
      const rect = el('rect', {
        class: i < 2 ? 'bar-alt' : 'bar',
        x: P.l, y: y, width: w, height: barH - gap,
      });
      rect.setAttribute('fill-opacity', i < 2 ? 0.9 : 0.72);
      svg.appendChild(rect);
      const lbl = el('text', {
        class: 'tick-label', x: P.l - 10, y: y + barH / 2 + 1,
        'text-anchor': 'end', style: 'font-size:11px; fill:var(--ink);',
      });
      lbl.textContent = pretty(r.feature);
      svg.appendChild(lbl);
      const val = el('text', {
        class: 'tick-label', x: P.l + w + 8, y: y + barH / 2 + 1,
        'text-anchor': 'start', style: 'font-size:10.5px;',
      });
      val.textContent = fmt(r.value, 3);
      svg.appendChild(val);
    });
  }

  // ── § VIII — SHAP dependence ─────────────────────────────────
  function renderShapDependence(shap) {
    const featLabel = {
      CreditScore: 'Credit score', Age: 'Age', Tenure: 'Tenure (yrs)',
      Balance: 'Balance ($)', NumOfProducts: '# of products',
      EstimatedSalary: 'Estimated salary ($)',
      HasCrCard: 'Has credit card (0/1)', IsActiveMember: 'Active member (0/1)',
      Gender: 'Gender (F=0, M=1)',
      Geography_Germany: 'Germany flag', Geography_Spain: 'Spain flag',
    };
    shap.top2_features.forEach((fname, idx) => {
      const svg = document.getElementById('dep-chart-' + (idx + 1));
      document.getElementById('dep-label-' + (idx + 1)).textContent =
        'FIG. G.5.' + (idx + 1) + ' · ' + featLabel[fname];
      drawDependence(svg, shap.dependence[fname], featLabel[fname], idx === 0);
    });
  }

  function drawDependence(svg, pairs, xLabel, isPrimary) {
    svg.innerHTML = '';
    const W = 600, H = 400;
    const P = { l: 60, r: 28, t: 34, b: 52 };
    const innerW = W - P.l - P.r;
    const innerH = H - P.t - P.b;

    const xs = pairs.map(p => p[0]);
    const ys = pairs.map(p => p[1]);
    const xMin = Math.min.apply(null, xs);
    const xMax = Math.max.apply(null, xs);
    const yAbs = Math.max.apply(null, ys.map(Math.abs)) * 1.08 || 1;

    const sx = v => P.l + ((v - xMin) / (xMax - xMin || 1)) * innerW;
    const sy = v => P.t + (1 - (v + yAbs) / (2 * yAbs)) * innerH;

    // Zero line
    svg.appendChild(el('line', {
      x1: P.l, x2: P.l + innerW, y1: sy(0), y2: sy(0),
      class: 'axis',
    }));
    // Axes
    svg.appendChild(el('line', { class: 'axis', x1: P.l, x2: P.l, y1: P.t, y2: P.t + innerH }));
    svg.appendChild(el('line', { class: 'axis', x1: P.l, x2: P.l + innerW, y1: P.t + innerH, y2: P.t + innerH }));

    // X ticks
    const xTicks = [xMin, xMin + (xMax - xMin) * 0.5, xMax];
    xTicks.forEach(t => {
      const x = sx(t);
      svg.appendChild(el('line', { class: 'gridline', x1: x, x2: x, y1: P.t, y2: P.t + innerH }));
      const lb = el('text', { class: 'tick-label', x: x, y: P.t + innerH + 16, 'text-anchor': 'middle' });
      lb.textContent = (xMax > 1000) ? Math.round(t).toLocaleString() : fmt(t, 1);
      svg.appendChild(lb);
    });
    // Y ticks
    [-yAbs, 0, yAbs].forEach(t => {
      const y = sy(t);
      const lb = el('text', { class: 'tick-label', x: P.l - 8, y: y + 4, 'text-anchor': 'end' });
      lb.textContent = fmt(t, 2);
      svg.appendChild(lb);
    });
    // Axis labels
    const xl = el('text', { class: 'axis-label', x: P.l + innerW / 2, y: H - 12, 'text-anchor': 'middle' });
    xl.textContent = xLabel;
    svg.appendChild(xl);
    const yl = el('text', {
      class: 'axis-label', x: 0, y: 0,
      transform: `translate(18 ${P.t + innerH / 2}) rotate(-90)`,
      'text-anchor': 'middle',
    });
    yl.textContent = 'SHAP value';
    svg.appendChild(yl);

    // Dots
    pairs.forEach(p => {
      const c = el('circle', {
        class: isPrimary ? 'dot-accent' : 'dot',
        cx: sx(p[0]), cy: sy(p[1]), r: 2.75,
      });
      svg.appendChild(c);
    });
  }

  // ── § IX — Fairness ──────────────────────────────────────────
  function renderFairness(f) {
    const groups = { Geography: [], Gender: [] };
    f.rows.forEach(r => {
      if (groups[r.group]) groups[r.group].push(r);
    });
    const wrap = document.getElementById('fairness-wrap');
    wrap.innerHTML = '';

    ['Geography', 'Gender'].forEach(name => {
      const rows = groups[name];
      if (!rows || !rows.length) return;
      const maxRate = Math.max.apply(null, rows.flatMap(r => [r.churn_rate, r.prediction_rate])) * 1.15 || 1;

      const html = `
        <div class="fairness-panel">
          <div class="fairness-panel-head">
            <span class="title">By ${name}</span>
            <span>n = ${rows.reduce((a, r) => a + r.n, 0).toLocaleString()}</span>
          </div>
          ${rows.map(r => {
            const actualW = (r.churn_rate / maxRate) * 100;
            const flagW   = (r.prediction_rate / maxRate) * 100;
            return `
              <div class="fairness-row">
                <div class="name">${r.value}<div class="mono" style="font-size:10px;color:var(--ink-dim);letter-spacing:.08em;">n=${r.n.toLocaleString()}</div></div>
                <div class="bars">
                  <div class="fairness-bar">
                    <div class="fairness-bar-fill actual" style="width:${actualW.toFixed(1)}%"></div>
                    <div class="fairness-bar-label">actual · ${fmtPct(r.churn_rate, 1)}</div>
                  </div>
                  <div class="fairness-bar">
                    <div class="fairness-bar-fill flagged" style="width:${flagW.toFixed(1)}%"></div>
                    <div class="fairness-bar-label">flagged · ${fmtPct(r.prediction_rate, 1)}</div>
                  </div>
                </div>
                <div class="stats">
                  <span class="acc">${fmtPct(r.accuracy, 1)}</span>
                  acc<br>
                  p ${fmt(r.precision, 2)} · r ${fmt(r.recall, 2)}
                </div>
              </div>`;
          }).join('')}
          <div class="fairness-legend">
            <span><span class="sw actual"></span>actual churn rate</span>
            <span><span class="sw flagged"></span>flagged by model</span>
          </div>
        </div>`;
      wrap.insertAdjacentHTML('beforeend', html);
    });
  }

})();
