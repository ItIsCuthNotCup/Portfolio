(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     SEGMENTATION LAB — page logic
     Loads 7 JSON artifacts, renders hand-rolled SVG charts,
     runs a client-side K-Means classifier and a campaign
     ROI simulator with formulas computed live.
     ═══════════════════════════════════════════════════════════ */

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const DATA_BASE = '/assets/data/segmentation/';

  const FILES = [
    'data_profile', 'metrics', 'k_selection',
    'segments', 'embedding', 'classify', 'methodology',
  ];

  // Color classes assigned by revenue rank (highest = accent, then ink → soft → dim).
  const COLOR_CLASSES = ['accent', 'ink', 'soft', 'dim'];
  const COLOR_VARS = {
    accent: 'var(--accent)',
    ink:    'var(--ink)',
    soft:   'var(--ink-soft)',
    dim:    'var(--ink-dim)',
  };

  // runtime state that several renderers share
  const state = {
    clusterOf: null,       // cluster_id → { name, color, rank, size, ... } from segments + ranking
    activeCluster: null,   // null = all clusters visible, else integer
  };

  // ── Fetch all artifacts ─────────────────────────────────────
  Promise.all(FILES.map(name =>
    fetch(DATA_BASE + name + '.json').then(r => {
      if (!r.ok) throw new Error('fetch failed: ' + name);
      return r.json();
    })
  )).then(results => {
    const d = {};
    FILES.forEach((n, i) => { d[n] = results[i]; });
    window.__seg = d;
    init(d);
  }).catch(err => {
    console.error('[seg-lab] load failed', err);
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div style="position:fixed;bottom:20px;right:20px;padding:12px 16px;background:var(--paper-2);border:1px solid var(--ink);font-family:DM Mono,monospace;font-size:11px;">could not load segmentation artifacts — try a hard refresh</div>'
    );
  });

  // ── Main ────────────────────────────────────────────────────
  function init(d) {
    // Build cluster color map from segments sorted by revenue desc.
    const byRev = d.segments.segments.slice().sort((a, b) => b.pct_revenue - a.pct_revenue);
    state.clusterOf = {};
    byRev.forEach((s, rank) => {
      state.clusterOf[s.cluster] = {
        ...s,
        rank,
        color: COLOR_CLASSES[Math.min(rank, COLOR_CLASSES.length - 1)],
      };
    });

    renderMeta(d);
    renderProfile(d.data_profile);
    renderMethodTable(d.metrics);
    renderKSelection(d.k_selection, d.metrics);
    renderMap(d.embedding);
    renderClassifier(d.classify, d.segments, d.embedding);
    renderSegmentCards(d.segments);
    renderSimulator(d.segments);

    const el = document.getElementById('regenerated-at');
    if (el) el.textContent = d.methodology.regenerated_at;
  }

  // ── SVG helpers ─────────────────────────────────────────────
  function ns(tag, attrs, children) {
    const n = document.createElementNS(SVG_NS, tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (children) children.forEach(c => c && n.appendChild(c));
    return n;
  }

  // ── Formatting ──────────────────────────────────────────────
  const fmt = (v, d = 2) => Number(v).toFixed(d);
  const pct = (v, d = 1) => (Number(v) * 100).toFixed(d) + '%';
  const usd = (v, digits = 0) =>
    '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
  const usdShort = v => {
    const n = Number(v);
    if (Math.abs(n) >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(n) >= 10_000)    return '$' + Math.round(n / 1_000) + 'K';
    return '$' + Math.round(n).toLocaleString();
  };
  const integer = v => Math.round(v).toLocaleString();
  const integerShort = v => {
    const n = Math.round(Number(v));
    if (Math.abs(n) >= 1_000_000) {
      const m = n / 1_000_000;
      return (m >= 10 ? m.toFixed(1) : m.toFixed(2)) + 'M';
    }
    if (Math.abs(n) >= 100_000) return Math.round(n / 1_000) + 'K';
    return n.toLocaleString();
  };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // ── § I meta headline numbers ───────────────────────────────
  function renderMeta(d) {
    const top = Object.values(state.clusterOf).find(c => c.rank === 0);
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('meta-k', d.metrics.operational_k);
    if (top) {
      set('meta-top-rev', pct(top.pct_revenue / 100, 0));
      set('meta-top-pct', pct(top.pct_customers / 100, 0));
    }
  }

  // ── § II data profile ───────────────────────────────────────
  function renderProfile(p) {
    const fmtDate = s => {
      // "YYYY-MM-DD" → "Mon D, YYYY"
      const [y, m, day] = s.split('-').map(Number);
      const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1];
      return `${month} ${day}, ${y}`;
    };
    const r = p.raw_distributions;
    const metrics = [
      { v: integerShort(p.raw_rows),     l: 'raw transactions' },
      { v: integerShort(p.cleaned_rows), l: 'after cleaning' },
      { v: integer(p.unique_customers),  l: 'unique customers' },
      { v: r.recency.median + 'd',       l: 'median recency' },
      { v: r.frequency.median,           l: 'median frequency' },
      { v: usdShort(r.monetary.median),  l: 'median monetary' },
    ];
    const grid = document.getElementById('profile-grid');
    grid.innerHTML = metrics.map(m =>
      `<div class="metric"><div class="serif metric-value">${m.v}</div><div class="mono metric-label">${m.l}</div></div>`
    ).join('');

    const sub = document.getElementById('profile-sub');
    sub.textContent =
      `Date range · ${fmtDate(p.date_start)} → ${fmtDate(p.date_end)}` +
      `  ·  Snapshot · ${fmtDate(p.snapshot_date)}` +
      `  ·  Total revenue · ${usdShort(p.total_revenue)}`;
  }

  // ── § III method comparison ─────────────────────────────────
  function renderMethodTable(m) {
    const tbody = document.querySelector('#method-table tbody');
    const cols = ['silhouette', 'calinski_harabasz', 'davies_bouldin', 'inertia'];
    // best per column: silhouette + CH = max, DB = min, inertia = max (but usually only K-Means has it)
    const best = {};
    cols.forEach(c => {
      const vals = m.methods.map(row => row[c]).filter(v => v != null);
      if (!vals.length) return;
      const isMinBest = (c === 'davies_bouldin');
      const pick = isMinBest ? Math.min(...vals) : Math.max(...vals);
      m.methods.forEach((row, i) => {
        if (row[c] === pick) best[c + ':' + i] = true;
      });
    });

    tbody.innerHTML = m.methods.map((row, i) => {
      const isWinner = row.key === m.winner;
      const td = (c, val) => {
        const cls = best[c + ':' + i] ? 'is-best' : '';
        return `<td class="${cls}">${val}</td>`;
      };
      const inertiaDisp = row.inertia == null ? '—' : integer(row.inertia);
      return `
        <tr${isWinner ? ' class="winner"' : ''}>
          <td class="name">${row.label}</td>
          <td>${row.best_k}</td>
          ${td('silhouette',        fmt(row.silhouette, 4))}
          ${td('calinski_harabasz', fmt(row.calinski_harabasz, 1))}
          ${td('davies_bouldin',    fmt(row.davies_bouldin, 4))}
          ${td('inertia',           inertiaDisp)}
        </tr>`;
    }).join('');

    const cap = document.getElementById('method-caveat');
    const winnerLabel = m.methods.find(x => x.key === m.winner).label;
    cap.textContent =
      `Silhouette winner: ${winnerLabel} at k=${m.winner_k}.` +
      (m.operational_method !== m.winner
        ? `  Operational model: K-Means at k=${m.operational_k} — used for the classifier, map and segment profiles because the live classifier requires parametric centroids.`
        : `  Used throughout the rest of the page for segment profiles, the map, the classifier, and the simulator.`);
  }

  // ── § IV k-selection — two line charts ──────────────────────
  function renderKSelection(kSel, metrics) {
    drawKSilhouette(kSel, metrics);
    drawKInertia(kSel, metrics);
  }

  function drawKSilhouette(kSel, metrics) {
    const svg = document.getElementById('k-silhouette');
    svg.innerHTML = '';
    const W = 600, H = 420;
    const P = { l: 58, r: 22, t: 22, b: 48 };
    const innerW = W - P.l - P.r, innerH = H - P.t - P.b;

    const series = [
      { key: 'kmeans',        label: 'K-Means',            rows: kSel.kmeans,        cls: 'series-accent' },
      { key: 'gmm',           label: 'Gaussian Mixture',   rows: kSel.gmm,           cls: 'series-ink'    },
      { key: 'agglomerative', label: 'Agglomerative',      rows: kSel.agglomerative, cls: 'series-dim'    },
    ];
    const kMin = Math.min(...series.flatMap(s => s.rows.map(r => r.k)));
    const kMax = Math.max(...series.flatMap(s => s.rows.map(r => r.k)));
    const allVals = series.flatMap(s => s.rows.map(r => r.silhouette));
    const yMin = Math.min(0, ...allVals) - 0.02;
    const yMax = Math.max(...allVals) + 0.04;

    const sx = k => P.l + ((k - kMin) / (kMax - kMin)) * innerW;
    const sy = v => P.t + (1 - (v - yMin) / (yMax - yMin)) * innerH;

    // Gridlines + ticks
    for (let k = kMin; k <= kMax; k++) {
      svg.appendChild(ns('line', { class: 'gridline', x1: sx(k), x2: sx(k), y1: P.t, y2: P.t + innerH }));
      const t = ns('text', { class: 'tick-label', x: sx(k), y: P.t + innerH + 18, 'text-anchor': 'middle' });
      t.textContent = String(k);
      svg.appendChild(t);
    }
    for (let i = 0; i <= 4; i++) {
      const v = yMin + (i / 4) * (yMax - yMin);
      const y = sy(v);
      svg.appendChild(ns('line', { class: 'gridline', x1: P.l, x2: P.l + innerW, y1: y, y2: y }));
      const t = ns('text', { class: 'tick-label', x: P.l - 8, y: y + 4, 'text-anchor': 'end' });
      t.textContent = v.toFixed(2);
      svg.appendChild(t);
    }
    svg.appendChild(ns('line', { class: 'axis', x1: P.l, x2: P.l, y1: P.t, y2: P.t + innerH }));
    svg.appendChild(ns('line', { class: 'axis', x1: P.l, x2: P.l + innerW, y1: P.t + innerH, y2: P.t + innerH }));

    const xLab = ns('text', { class: 'axis-label', x: P.l + innerW / 2, y: H - 14, 'text-anchor': 'middle' });
    xLab.textContent = 'k (number of clusters)';
    svg.appendChild(xLab);
    const yLab = ns('text', {
      class: 'axis-label', x: 0, y: 0,
      transform: `translate(18 ${P.t + innerH / 2}) rotate(-90)`,
      'text-anchor': 'middle',
    });
    yLab.textContent = 'Silhouette';
    svg.appendChild(yLab);

    // Lines
    series.forEach(s => {
      const path = s.rows.map((r, i) =>
        (i === 0 ? 'M' : 'L') + sx(r.k).toFixed(1) + ',' + sy(r.silhouette).toFixed(1)
      ).join(' ');
      svg.appendChild(ns('path', { class: 'series ' + s.cls, d: path }));
      // Dots
      s.rows.forEach(r => {
        svg.appendChild(ns('circle', {
          cx: sx(r.k), cy: sy(r.silhouette), r: 2.5,
          fill: COLOR_VARS[s.cls.replace('series-', '')] || 'var(--ink)',
        }));
      });
    });

    // Mark operational k on K-Means line
    const opK = metrics.operational_k;
    const kmRow = series[0].rows.find(r => r.k === opK);
    if (kmRow) {
      svg.appendChild(ns('circle', {
        cx: sx(opK), cy: sy(kmRow.silhouette), r: 7,
        fill: 'none', stroke: 'var(--accent)', 'stroke-width': 1.5,
      }));
      const lbl = ns('text', {
        class: 'tick-label', x: sx(opK) + 12, y: sy(kmRow.silhouette) - 6,
        fill: 'var(--accent)', style: 'font-size:10px;letter-spacing:0.08em;',
      });
      lbl.textContent = `k = ${opK}`;
      svg.appendChild(lbl);
    }

    // Legend
    const legend = document.getElementById('k-silhouette-legend');
    legend.innerHTML = series.map(s =>
      `<span><span class="sw" style="background:${COLOR_VARS[s.cls.replace('series-', '')]}"></span>${s.label}</span>`
    ).join('');
  }

  function drawKInertia(kSel, metrics) {
    const svg = document.getElementById('k-inertia');
    svg.innerHTML = '';
    const W = 600, H = 420;
    const P = { l: 74, r: 22, t: 22, b: 48 };
    const innerW = W - P.l - P.r, innerH = H - P.t - P.b;

    const rows = kSel.kmeans.filter(r => r.inertia != null);
    const kMin = Math.min(...rows.map(r => r.k));
    const kMax = Math.max(...rows.map(r => r.k));
    const iMax = Math.max(...rows.map(r => r.inertia)) * 1.04;
    const iMin = Math.min(...rows.map(r => r.inertia)) * 0.9;

    const sx = k => P.l + ((k - kMin) / (kMax - kMin)) * innerW;
    const sy = v => P.t + (1 - (v - iMin) / (iMax - iMin)) * innerH;

    for (let k = kMin; k <= kMax; k++) {
      svg.appendChild(ns('line', { class: 'gridline', x1: sx(k), x2: sx(k), y1: P.t, y2: P.t + innerH }));
      const t = ns('text', { class: 'tick-label', x: sx(k), y: P.t + innerH + 18, 'text-anchor': 'middle' });
      t.textContent = String(k);
      svg.appendChild(t);
    }
    for (let i = 0; i <= 4; i++) {
      const v = iMin + (i / 4) * (iMax - iMin);
      const y = sy(v);
      svg.appendChild(ns('line', { class: 'gridline', x1: P.l, x2: P.l + innerW, y1: y, y2: y }));
      const t = ns('text', { class: 'tick-label', x: P.l - 8, y: y + 4, 'text-anchor': 'end' });
      t.textContent = Math.round(v).toLocaleString();
      svg.appendChild(t);
    }
    svg.appendChild(ns('line', { class: 'axis', x1: P.l, x2: P.l, y1: P.t, y2: P.t + innerH }));
    svg.appendChild(ns('line', { class: 'axis', x1: P.l, x2: P.l + innerW, y1: P.t + innerH, y2: P.t + innerH }));

    const xLab = ns('text', { class: 'axis-label', x: P.l + innerW / 2, y: H - 14, 'text-anchor': 'middle' });
    xLab.textContent = 'k (number of clusters)';
    svg.appendChild(xLab);
    const yLab = ns('text', {
      class: 'axis-label', x: 0, y: 0,
      transform: `translate(18 ${P.t + innerH / 2}) rotate(-90)`,
      'text-anchor': 'middle',
    });
    yLab.textContent = 'Inertia (K-Means)';
    svg.appendChild(yLab);

    const path = rows.map((r, i) =>
      (i === 0 ? 'M' : 'L') + sx(r.k).toFixed(1) + ',' + sy(r.inertia).toFixed(1)
    ).join(' ');
    svg.appendChild(ns('path', { class: 'series series-ink', d: path }));
    rows.forEach(r => {
      svg.appendChild(ns('circle', {
        cx: sx(r.k), cy: sy(r.inertia), r: 2.5, fill: 'var(--ink)',
      }));
    });

    const opK = metrics.operational_k;
    const row = rows.find(r => r.k === opK);
    if (row) {
      svg.appendChild(ns('circle', {
        cx: sx(opK), cy: sy(row.inertia), r: 7,
        fill: 'none', stroke: 'var(--accent)', 'stroke-width': 1.5,
      }));
      const lbl = ns('text', {
        class: 'tick-label', x: sx(opK) + 12, y: sy(row.inertia) - 6,
        fill: 'var(--accent)', style: 'font-size:10px;letter-spacing:0.08em;',
      });
      lbl.textContent = `k = ${opK}`;
      svg.appendChild(lbl);
    }
  }

  // ── § V segment map — SVG scatter ───────────────────────────
  function renderMap(emb) {
    const svg = document.getElementById('seg-map');
    svg.innerHTML = '';
    const W = 900, H = 560;
    const P = { l: 60, r: 30, t: 30, b: 60 };
    const innerW = W - P.l - P.r, innerH = H - P.t - P.b;

    const [xMin, xMax] = emb.axis_range.x;
    const [yMin, yMax] = emb.axis_range.y;
    const pad = Math.max(xMax - xMin, yMax - yMin) * 0.03;
    const sx = v => P.l + ((v - (xMin - pad)) / ((xMax + pad) - (xMin - pad))) * innerW;
    const sy = v => P.t + (1 - (v - (yMin - pad)) / ((yMax + pad) - (yMin - pad))) * innerH;

    // Axes (minimal — this is a projection, not quantitative)
    svg.appendChild(ns('line', { class: 'axis', x1: P.l, x2: P.l, y1: P.t, y2: P.t + innerH }));
    svg.appendChild(ns('line', { class: 'axis', x1: P.l, x2: P.l + innerW, y1: P.t + innerH, y2: P.t + innerH }));
    const xLab = ns('text', { class: 'axis-label', x: P.l + innerW / 2, y: H - 16, 'text-anchor': 'middle' });
    xLab.textContent = `PC 1 · ${(emb.explained_variance[0] * 100).toFixed(0)}% of variance`;
    svg.appendChild(xLab);
    const yLab = ns('text', {
      class: 'axis-label', x: 0, y: 0,
      transform: `translate(22 ${P.t + innerH / 2}) rotate(-90)`,
      'text-anchor': 'middle',
    });
    yLab.textContent = `PC 2 · ${(emb.explained_variance[1] * 100).toFixed(0)}% of variance`;
    svg.appendChild(yLab);

    // Draw all points — one group per cluster so we can toggle opacity in bulk
    const groups = {};
    for (const cid of Object.keys(state.clusterOf)) {
      const g = ns('g', { 'data-cluster': cid, class: 'map-cluster-group' });
      svg.appendChild(g);
      groups[cid] = g;
    }
    // Sort points by rank so higher-value (accent) layers on top
    const pts = emb.points.slice().sort((a, b) =>
      state.clusterOf[b.cluster].rank - state.clusterOf[a.cluster].rank
    );
    pts.forEach(p => {
      const info = state.clusterOf[p.cluster];
      const dot = ns('circle', {
        cx: sx(p.x).toFixed(1),
        cy: sy(p.y).toFixed(1),
        r: 3,
        fill: COLOR_VARS[info.color],
        'fill-opacity': info.color === 'accent' ? 0.75 : 0.45,
        'data-cluster': p.cluster,
      });
      groups[p.cluster].appendChild(dot);
    });

    // Hover overlay — find nearest point by pixel distance
    const overlay = ns('rect', {
      x: P.l, y: P.t, width: innerW, height: innerH,
      fill: 'transparent',
    });
    svg.appendChild(overlay);
    const hover = ns('circle', { class: 'hover-dot', r: 5.5, cx: -10, cy: -10 });
    svg.appendChild(hover);
    const readout = document.getElementById('seg-map-readout');

    // Precompute pixel positions once
    const pixelPts = emb.points.map(p => ({
      ...p,
      px: sx(p.x),
      py: sy(p.y),
    }));

    function onMove(ev) {
      const rect = svg.getBoundingClientRect();
      const mx = (ev.clientX - rect.left) * (W / rect.width);
      const my = (ev.clientY - rect.top)  * (H / rect.height);
      if (mx < P.l || mx > P.l + innerW || my < P.t || my > P.t + innerH) return;

      let best = null, bestD = Infinity;
      for (const p of pixelPts) {
        if (state.activeCluster != null && p.cluster !== state.activeCluster) continue;
        const d = (p.px - mx) * (p.px - mx) + (p.py - my) * (p.py - my);
        if (d < bestD) { bestD = d; best = p; }
      }
      if (!best || bestD > 900) {
        hover.setAttribute('cx', -10); hover.setAttribute('cy', -10);
        readout.innerHTML = '<span class="label">HOVER</span> <span class="value">— for R / F / M on this customer</span>';
        return;
      }
      hover.setAttribute('cx', best.px);
      hover.setAttribute('cy', best.py);
      readout.innerHTML =
        `<span class="label">${state.clusterOf[best.cluster].name.toUpperCase()}</span> ` +
        `<span class="value">R=${best.recency}d · F=${best.frequency} · M=${usdShort(best.monetary)}</span>`;
    }
    function onLeave() {
      hover.setAttribute('cx', -10); hover.setAttribute('cy', -10);
      readout.innerHTML = '<span class="label">HOVER</span> <span class="value">— for R / F / M on this customer</span>';
    }
    overlay.addEventListener('mousemove', onMove);
    overlay.addEventListener('mouseleave', onLeave);
    overlay.addEventListener('touchmove', ev => {
      if (ev.touches && ev.touches[0]) onMove(ev.touches[0]);
    }, { passive: true });

    // Legend with click-to-isolate
    const legendHost = document.getElementById('seg-map-legend');
    const sortedClusters = Object.values(state.clusterOf).slice().sort((a, b) => a.rank - b.rank);
    legendHost.innerHTML = sortedClusters.map(c =>
      `<div class="legend-chip" data-cluster="${c.cluster}">
         <span class="legend-swatch" style="background:${COLOR_VARS[c.color]}"></span>
         <span class="legend-name">${c.name}</span>
         <span class="legend-meta">n=${integer(c.size)} · ${fmt(c.pct_revenue, 1)}% rev</span>
       </div>`
    ).join('');
    legendHost.querySelectorAll('.legend-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const cid = Number(chip.dataset.cluster);
        state.activeCluster = (state.activeCluster === cid) ? null : cid;
        // Update group opacities
        for (const id of Object.keys(groups)) {
          const active = (state.activeCluster == null || Number(id) === state.activeCluster);
          groups[id].style.opacity = active ? 1 : 0.08;
        }
        // Update chip states
        legendHost.querySelectorAll('.legend-chip').forEach(c => {
          const id = Number(c.dataset.cluster);
          c.classList.toggle('dimmed',
            state.activeCluster != null && id !== state.activeCluster);
        });
      });
    });
  }

  // ── § VI live classifier ────────────────────────────────────
  function renderClassifier(classify, segmentsPayload, emb) {
    const host = document.getElementById('classify-inputs');
    const features = classify.feature_order;
    const featLabel = {
      recency:   'Recency (days)',
      frequency: 'Frequency (orders)',
      monetary:  'Monetary ($)',
    };
    const featHint = {
      recency:   'days since last purchase',
      frequency: 'unique orders in 2 yrs',
      monetary:  'total spend in the window',
    };

    host.innerHTML = features.map(f => {
      const h = classify.feature_hints[f];
      return `
        <div class="classify-input-row">
          <label for="cls-${f}">${featLabel[f]}
            <span class="hint">${featHint[f]}</span>
          </label>
          <input type="range" id="cls-${f}" data-feat="${f}"
                 min="${h.min}" max="${h.max}" step="${h.step}" value="${h.default}">
          <div class="val" id="cls-${f}-val">${f === 'monetary' ? '$' + integer(h.default) : h.default}</div>
        </div>`;
    }).join('');

    const bySegment = {};
    segmentsPayload.segments.forEach(s => { bySegment[s.cluster] = s; });

    const state_ = {};
    features.forEach(f => { state_[f] = classify.feature_hints[f].default; });

    function log1p(v) { return Math.log(1 + v); }
    function project(scaled) {
      // (x - pca_mean) @ pca_components.T  → [pc1, pc2]
      const m = classify.pca_mean;
      const c0 = classify.pca_components[0];
      const c1 = classify.pca_components[1];
      const pc1 = (scaled[0] - m[0]) * c0[0] + (scaled[1] - m[1]) * c0[1] + (scaled[2] - m[2]) * c0[2];
      const pc2 = (scaled[0] - m[0]) * c1[0] + (scaled[1] - m[1]) * c1[1] + (scaled[2] - m[2]) * c1[2];
      return [pc1, pc2];
    }

    function buildScaled() {
      return features.map((f, i) => {
        const raw = Number(state_[f]);
        const t = classify.log_transform ? log1p(raw) : raw;
        return (t - classify.means[i]) / classify.stds[i];
      });
    }

    function distance2(a, b) {
      let s = 0;
      for (let i = 0; i < a.length; i++) {
        const d = a[i] - b[i];
        s += d * d;
      }
      return s;
    }

    function classifyNow() {
      const scaled = buildScaled();
      let best = 0, bestD = Infinity;
      classify.centroids_scaled.forEach((c, i) => {
        const d = distance2(scaled, c);
        if (d < bestD) { bestD = d; best = i; }
      });
      const seg = bySegment[best];
      const you = project(scaled);
      return { cluster: best, seg, you };
    }

    // UI wiring
    features.forEach(f => {
      const inp = document.getElementById('cls-' + f);
      const val = document.getElementById('cls-' + f + '-val');
      inp.addEventListener('input', () => {
        state_[f] = Number(inp.value);
        val.textContent = f === 'monetary' ? '$' + integer(state_[f]) : String(state_[f]);
        update();
      });
    });

    // Inset — small scatter reusing a downsampled slice of the embedding
    const insetSvg = document.getElementById('classify-inset');
    function drawInset(you) {
      insetSvg.innerHTML = '';
      const W = 420, H = 260;
      const P = { l: 12, r: 12, t: 12, b: 12 };
      const iw = W - P.l - P.r, ih = H - P.t - P.b;
      const [xMin, xMax] = emb.axis_range.x;
      const [yMin, yMax] = emb.axis_range.y;
      const pad = Math.max(xMax - xMin, yMax - yMin) * 0.04;
      const sx = v => P.l + ((v - (xMin - pad)) / ((xMax + pad) - (xMin - pad))) * iw;
      const sy = v => P.t + (1 - (v - (yMin - pad)) / ((yMax + pad) - (yMin - pad))) * ih;

      // Thin background dots — every 4th point keeps it light
      emb.points.forEach((p, i) => {
        if (i % 4 !== 0) return;
        const info = state.clusterOf[p.cluster];
        insetSvg.appendChild(ns('circle', {
          cx: sx(p.x).toFixed(1), cy: sy(p.y).toFixed(1), r: 1.4,
          fill: COLOR_VARS[info.color], 'fill-opacity': 0.22,
        }));
      });
      // Centroids — small ring
      classify.centroids_pca.forEach(([x, y], cid) => {
        insetSvg.appendChild(ns('circle', {
          cx: sx(x), cy: sy(y), r: 5,
          fill: 'none', stroke: 'var(--ink)',
          'stroke-width': 1, 'stroke-opacity': 0.5,
        }));
      });
      // You
      insetSvg.appendChild(ns('circle', { class: 'you-dot', cx: sx(you[0]), cy: sy(you[1]), r: 6 }));
      const label = ns('text', {
        x: sx(you[0]) + 10, y: sy(you[1]) + 4,
        fill: 'var(--accent)',
        style: 'font-family:DM Mono,monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;',
      });
      label.textContent = 'you';
      insetSvg.appendChild(label);
    }

    function update() {
      const { seg, you } = classifyNow();
      document.getElementById('classify-name').textContent = seg.name;
      document.getElementById('classify-size').textContent = integer(seg.size);
      document.getElementById('classify-pctcust').textContent = fmt(seg.pct_customers, 1) + '%';
      document.getElementById('classify-pctrev').textContent = fmt(seg.pct_revenue, 1) + '%';
      document.getElementById('classify-median').innerHTML =
        `This segment's <em>median</em> customer: ` +
        `R=<em>${seg.r_median}d</em> · F=<em>${seg.f_median}</em> orders · M=<em>${usdShort(seg.m_median)}</em>`;
      drawInset(you);
    }
    update();
  }

  // ── § VII segment cards ─────────────────────────────────────
  function renderSegmentCards(segmentsPayload) {
    const host = document.getElementById('segment-cards');
    const cards = Object.values(state.clusterOf).slice().sort((a, b) => a.rank - b.rank);

    host.innerHTML = cards.map(c => {
      // RFM micro bar: percentile of median on each axis.
      // For Recency, we invert so that "better" is to the RIGHT (short recency = good).
      const rScore = 100 - c.r_pct_overall; // higher → more recent → better
      const fScore = c.f_pct_overall;
      const mScore = c.m_pct_overall;
      const microRow = (lbl, score, displayVal) => `
        <div class="rfm-micro-row">
          <div class="rfm-micro-label">${lbl}</div>
          <div class="rfm-micro-track">
            <div class="rfm-micro-tick" style="left:${clamp(score, 0, 100).toFixed(1)}%"></div>
          </div>
          <div class="rfm-micro-val">${displayVal}</div>
        </div>`;

      const narrative = cardNarrative(c);

      const isTop = c.rank === 0;
      return `
        <div class="segment-card${isTop ? ' is-top' : ''}">
          <div class="segment-card-head">
            <div class="segment-card-name">${c.name}</div>
            <div class="segment-card-size">${integer(c.size)} customers · ${fmt(c.pct_customers, 1)}% of base</div>
          </div>
          <div class="rfm-micro">
            ${microRow('R', rScore, c.r_median + 'd')}
            ${microRow('F', fScore, fmt(c.f_median, 1))}
            ${microRow('M', mScore, usdShort(c.m_median))}
          </div>
          <div class="rev-contrib">
            <div class="rev-contrib-row">
              <div>% customers</div>
              <div class="rev-contrib-track">
                <div class="rev-contrib-fill customers" style="width:${clamp(c.pct_customers, 0, 100).toFixed(1)}%"></div>
              </div>
              <div class="rev-contrib-val">${fmt(c.pct_customers, 1)}%</div>
            </div>
            <div class="rev-contrib-row">
              <div>% revenue</div>
              <div class="rev-contrib-track">
                <div class="rev-contrib-fill revenue" style="width:${clamp(c.pct_revenue, 0, 100).toFixed(1)}%"></div>
              </div>
              <div class="rev-contrib-val">${fmt(c.pct_revenue, 1)}%</div>
            </div>
          </div>
          <div class="segment-narrative">${narrative}</div>
        </div>`;
    }).join('');
  }

  function cardNarrative(c) {
    const custVsRev = c.pct_revenue - c.pct_customers;
    const repurch = (c.repurchase_rate_60d * 100).toFixed(0);
    const aov = usdShort(c.avg_order_value);
    let leading;
    if (custVsRev >= 15) {
      leading = `<em>${fmt(c.pct_customers, 0)}%</em> of customers drive <em>${fmt(c.pct_revenue, 0)}%</em> of revenue — disproportionately valuable.`;
    } else if (custVsRev <= -15) {
      leading = `<em>${fmt(c.pct_customers, 0)}%</em> of customers, only <em>${fmt(c.pct_revenue, 0)}%</em> of revenue — low-leverage for retention spend.`;
    } else {
      leading = `Roughly proportional — <em>${fmt(c.pct_customers, 0)}%</em> of customers, <em>${fmt(c.pct_revenue, 0)}%</em> of revenue.`;
    }
    let guidance;
    if (c.name === 'Loyal Champions') {
      guidance = `Protect with loyalty perks; measure churn, not reach.`;
    } else if (c.name === 'Lapsing Whales' || c.name === 'At-Risk Big Spenders') {
      guidance = `Win-back the priority target — high AOV (${aov}) but slipping (${repurch}% 60-day repurchase).`;
    } else if (c.name === 'Dormant Low-Value') {
      guidance = `Low-leverage — exclude from paid retention campaigns.`;
    } else if (c.name === 'New Triers') {
      guidance = `Nurture with onboarding, not discounts — judge by second purchase.`;
    } else if (c.rank === 1) {
      guidance = `${repurch}% 60-day repurchase at ${aov} AOV — natural upsell target.`;
    } else {
      guidance = `${repurch}% 60-day repurchase · ${aov} AOV.`;
    }
    return leading + ' ' + guidance;
  }

  // ── § VIII campaign ROI simulator ───────────────────────────
  function renderSimulator(segmentsPayload) {
    const sel = document.getElementById('sim-segment');
    const segs = Object.values(state.clusterOf).slice().sort((a, b) => a.rank - b.rank);
    sel.innerHTML = segs.map(s =>
      `<option value="${s.cluster}">${s.name} — ${integer(s.size)} customers</option>`
    ).join('');

    const costInp = document.getElementById('sim-cost');
    const costVal = document.getElementById('sim-cost-val');
    const liftInp = document.getElementById('sim-lift');
    const liftVal = document.getElementById('sim-lift-val');

    const bySegment = {};
    segmentsPayload.segments.forEach(s => { bySegment[s.cluster] = s; });

    function update() {
      const cid = Number(sel.value);
      const cost = Number(costInp.value);
      const lift = Number(liftInp.value);
      const s = bySegment[cid];

      costVal.textContent = '$' + cost.toFixed(2);
      liftVal.textContent = lift.toFixed(2) + '×';

      const contacted = s.size;
      const baseline = s.size * s.repurchase_rate_60d;
      // Cap at physical reality — you can't buy more times than there are
      // customers. Matters for already-engaged segments where baseline is
      // high (e.g. Loyal Champions at 89% — a 1.5× lift would theoretically
      // push response above 100%, which doesn't happen in the real world).
      const withCamp = Math.min(baseline * lift, s.size);
      const incremental = Math.max(0, withCamp - baseline);
      const incRev = incremental * s.avg_order_value;
      const campCost = s.size * cost;
      const roi = campCost > 0 ? (incRev - campCost) / campCost : 0;

      const set = (id, v) => { document.getElementById(id).textContent = v; };
      set('sim-contacted',      integer(contacted));
      set('sim-baseline',       integer(baseline));
      set('sim-with-campaign',  integer(withCamp));
      set('sim-incremental',    integer(incremental));
      set('sim-inc-rev',        usdShort(incRev));
      set('sim-campaign-cost',  usdShort(campCost));
      set('sim-roi',            (roi * 100).toFixed(0) + '%');

      const sub = document.getElementById('sim-roi-sub');
      if (roi >= 0) {
        sub.textContent = `net ${usdShort(incRev - campCost)} on ${usdShort(campCost)} spend`;
      } else {
        sub.textContent = `net –${usdShort(campCost - incRev)} on ${usdShort(campCost)} spend`;
      }
    }
    sel.addEventListener('change', update);
    costInp.addEventListener('input', update);
    liftInp.addEventListener('input', update);
    update();
  }

})();
