// llm-learning-lab.js — How LLMs Learn
//
// Eight chart renderers + four HTML grids (training stack, tokenization,
// architecture history, alignment table, coda). All driven from
// /assets/data/llm-learning-lab/data.json.

(function () {
  'use strict';

  function svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }
  function makeScale(domain, range, type) {
    if (type === 'log') {
      const lo = Math.log10(domain[0]), hi = Math.log10(domain[1]);
      return v => range[0] + (Math.log10(v) - lo) * (range[1] - range[0]) / (hi - lo);
    }
    return v => range[0] + (v - domain[0]) * (range[1] - range[0]) / (domain[1] - domain[0]);
  }
  function chartColor(n) {
    return getComputedStyle(document.documentElement).getPropertyValue('--chart-' + n).trim() || '#888';
  }
  const CHART = {
    get blue()   { return chartColor(1); },
    get purple() { return chartColor(2); },
    get orange() { return chartColor(3); },
    get gold()   { return chartColor(4); },
    get rose()   { return chartColor(5); },
  };

  fetch('/assets/data/llm-learning-lab/data.json')
    .then(r => r.json())
    .then(data => {
      renderScaling(data);
      renderStack(data);
      renderVocab(data);
      renderTokens(data);
      renderArch(data);
      renderHistory(data);
      renderDynamics(data);
      renderPhenomena(data);
      renderEmergence(data);
      renderAlignment(data);
      renderBenchmarks(data);
      renderCoda(data);
      renderReceipts(data);
    })
    .catch(err => console.error('LLM lab data load failed:', err));

  // ── Chart 1 — scaling laws (log-log scatter) ────────────────
  function renderScaling(data) {
    const svg = document.getElementById('llm-scaling');
    if (!svg) return;
    const W = 1100, H = 460, M = { t: 36, r: 110, b: 56, l: 72 };
    const models = data.scaling.models;
    const xDomain = [1e21, 2e26];
    const yDomain = [1.5, 3.5];
    const xScale = makeScale(xDomain, [M.l, W - M.r], 'log');
    const yScale = makeScale(yDomain, [H - M.b, M.t]);

    svg.innerHTML = '';
    // Y grid
    for (let v = 1.5; v <= 3.5; v += 0.5) {
      const y = yScale(v);
      svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: y, y2: y, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.18 }));
      svg.appendChild(svgEl('text', { x: M.l - 8, y: y + 4, 'text-anchor': 'end', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = v.toFixed(1);
    }
    // X log ticks
    [1e21, 1e22, 1e23, 1e24, 1e25, 1e26].forEach(v => {
      const x = xScale(v);
      svg.appendChild(svgEl('line', { x1: x, x2: x, y1: M.t, y2: H - M.b, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.18 }));
      const exp = Math.log10(v);
      svg.appendChild(svgEl('text', { x, y: H - M.b + 18, 'text-anchor': 'middle', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = '10^' + exp.toFixed(0);
    });
    svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));
    svg.appendChild(svgEl('line', { x1: M.l, x2: M.l, y1: M.t, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));

    // Reference scaling curve: L(C) = a · C^(-α), α≈0.05 — anchored at GPT-3
    const anchorX = 3.14e23, anchorY = 2.10, alpha = 0.05;
    const a = anchorY / Math.pow(anchorX, -alpha);
    let curveD = '';
    for (let i = 0; i <= 60; i++) {
      const lf = Math.log10(xDomain[0]) + (Math.log10(xDomain[1]) - Math.log10(xDomain[0])) * (i / 60);
      const f = Math.pow(10, lf);
      const loss = a * Math.pow(f, -alpha);
      if (loss < yDomain[0] || loss > yDomain[1]) continue;
      curveD += (curveD ? 'L' : 'M') + xScale(f).toFixed(1) + ',' + yScale(loss).toFixed(1);
    }
    svg.appendChild(svgEl('path', { d: curveD, stroke: CHART.gold, 'stroke-width': 1.5, 'stroke-dasharray': '6,4', fill: 'none', opacity: 0.85 }));
    svg.appendChild(svgEl('text', { x: W - M.r - 6, y: yScale(a * Math.pow(xDomain[1], -alpha)) - 8, 'text-anchor': 'end', fill: CHART.gold, 'font-size': 10, 'font-family': 'DM Mono, monospace', 'font-style': 'italic' })).textContent = 'L(C) ∝ C^−0.05 (Kaplan)';

    // Model dots + labels
    const placed = [];
    const labW = 100, labH = 13;
    models.forEach(m => {
      const cx = xScale(m.flop);
      const cy = yScale(m.loss_proxy);
      const color = m.highlight ? CHART.orange : CHART.blue;
      svg.appendChild(svgEl('circle', { cx, cy, r: m.highlight ? 6 : 4, fill: color, stroke: 'var(--paper)', 'stroke-width': 1.5, opacity: 0.95 }));
      // Label collision avoidance — try a few candidates
      const cands = [
        { dx: 8, dy: -8, anchor: 'start' },
        { dx: 8, dy: 14, anchor: 'start' },
        { dx: -8, dy: -8, anchor: 'end' },
        { dx: -8, dy: 14, anchor: 'end' },
        { dx: 8, dy: -22, anchor: 'start' },
        { dx: 8, dy: 28, anchor: 'start' },
      ];
      let chosen = cands[0], best = Infinity;
      for (const c of cands) {
        const x0 = cx + c.dx + (c.anchor === 'end' ? -labW : 0);
        const y0 = cy + c.dy - labH;
        if (x0 < M.l - 4 || x0 + labW > W - M.r + 80) continue;
        if (y0 < M.t - 2 || y0 > H - M.b) continue;
        let overlap = 0;
        placed.forEach(p => {
          const dx = Math.max(0, Math.min(x0 + labW, p.x0 + labW) - Math.max(x0, p.x0));
          const dy = Math.max(0, Math.min(y0 + labH, p.y0 + labH) - Math.max(y0, p.y0));
          overlap += dx * dy;
        });
        if (overlap < best) { best = overlap; chosen = c; if (overlap === 0) break; }
      }
      svg.appendChild(svgEl('text', {
        x: cx + chosen.dx, y: cy + chosen.dy, 'text-anchor': chosen.anchor,
        fill: m.highlight ? 'var(--ink)' : 'var(--ink-soft)',
        'font-size': m.highlight ? 11 : 10, 'font-family': 'DM Mono, monospace',
        'font-weight': m.highlight ? 500 : 400
      })).textContent = m.name;
      placed.push({ x0: cx + chosen.dx + (chosen.anchor === 'end' ? -labW : 0), y0: cy + chosen.dy - labH });
    });

    // Y title
    svg.appendChild(svgEl('text', { x: M.l - 60, y: M.t - 14, 'text-anchor': 'start', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace', 'letter-spacing': '0.10em' })).textContent = 'PRETRAINING LOSS (LOG)';
    svg.appendChild(svgEl('text', { x: (M.l + W - M.r) / 2, y: H - 14, 'text-anchor': 'middle', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace', 'letter-spacing': '0.10em' })).textContent = 'TRAINING COMPUTE — FLOPS (LOG)';
  }

  // ── Training stack grid ─────────────────────────────────────
  function renderStack(data) {
    const wrap = document.getElementById('llm-stack');
    if (!wrap) return;
    wrap.innerHTML = data.training_stack.stages.map(s =>
      '<div class="llm-stack-tile">' +
        '<div class="llm-stack-head">' +
          '<span class="llm-stack-name">' + s.label + '</span>' +
          '<span class="llm-stack-share">' + s.compute_pct_label + '</span>' +
        '</div>' +
        '<div class="llm-stack-bar"><div class="llm-stack-bar-fill" style="width:' + Math.max(2, s.compute_share_pct) + '%"></div></div>' +
        '<div class="llm-stack-row"><span class="key">Objective</span><span>' + s.objective + '</span></div>' +
        '<div class="llm-stack-row"><span class="key">Data</span><span>' + s.data + '</span></div>' +
        '<div class="llm-stack-row"><span class="key">Tokens</span><span>' + s.tokens + '</span></div>' +
        '<div class="llm-stack-row"><span class="key">Examples</span><span>' + s.examples + '</span></div>' +
        '<div class="llm-stack-row"><span class="key">Duration</span><span>' + s.duration + '</span></div>' +
        '<p class="narrative">' + s.what_it_teaches + '</p>' +
      '</div>'
    ).join('');
  }

  // ── Vocab size chart ────────────────────────────────────────
  function renderVocab(data) {
    const svg = document.getElementById('llm-vocab');
    if (!svg) return;
    const W = 1100, H = 380, M = { t: 36, r: 60, b: 80, l: 80 };
    const models = data.tokenization.models;
    const xScale = makeScale([0, models.length], [M.l, W - M.r]);
    const yScale = makeScale([0, 280000], [H - M.b, M.t]);

    svg.innerHTML = '';
    [0, 50000, 100000, 150000, 200000, 250000].forEach(v => {
      const y = yScale(v);
      svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: y, y2: y, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.18 }));
      svg.appendChild(svgEl('text', { x: M.l - 8, y: y + 4, 'text-anchor': 'end', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = (v / 1000) + 'k';
    });
    svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));
    svg.appendChild(svgEl('line', { x1: M.l, x2: M.l, y1: M.t, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));

    const barW = (W - M.l - M.r) / models.length * 0.65;
    models.forEach((m, i) => {
      const cx = xScale(i + 0.5);
      const yV = yScale(m.vocab);
      svg.appendChild(svgEl('rect', { x: cx - barW / 2, y: yV, width: barW, height: H - M.b - yV, fill: CHART.blue, opacity: 0.85 }));
      svg.appendChild(svgEl('text', { x: cx, y: yV - 6, 'text-anchor': 'middle', fill: 'var(--ink)', 'font-size': 9.5, 'font-family': 'DM Mono, monospace' })).textContent = (m.vocab / 1000).toFixed(0) + 'k';
      // rotated model label
      svg.appendChild(svgEl('text', {
        x: cx, y: H - M.b + 14, 'text-anchor': 'end',
        fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace',
        transform: 'rotate(-30 ' + cx + ' ' + (H - M.b + 14) + ')'
      })).textContent = m.name + ' (' + m.year + ')';
    });
    svg.appendChild(svgEl('text', { x: M.l - 60, y: M.t - 14, 'text-anchor': 'start', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace', 'letter-spacing': '0.10em' })).textContent = 'VOCAB SIZE';
  }

  // ── Tokenization examples ───────────────────────────────────
  function renderTokens(data) {
    const wrap = document.getElementById('llm-tokens');
    if (!wrap) return;
    let html = '';
    data.tokenization.examples.forEach(ex => {
      html += '<div class="llm-token-row">';
      html += '<div class="src">"' + ex.text + '"</div>';
      html += '<div class="llm-token-side">';
      html += '<div class="head">GPT-2 (vocab 50,257)</div>';
      html += '<div class="llm-token-pieces">';
      ex.gpt2_tokens.forEach((tok, i) => {
        html += '<span class="llm-token-piece">' + tok.replace(/ /g, '·') + '<span class="id">' + ex.gpt2_ids[i] + '</span></span>';
      });
      html += '</div></div>';
      html += '<div class="llm-token-side">';
      html += '<div class="head">GPT-4 (vocab 100,277)</div>';
      html += '<div class="llm-token-pieces">';
      ex.gpt4_tokens.forEach((tok, i) => {
        html += '<span class="llm-token-piece">' + tok.replace(/ /g, '·') + '<span class="id">' + ex.gpt4_ids[i] + '</span></span>';
      });
      html += '</div></div>';
      html += '</div>';
    });
    wrap.innerHTML = html;
  }

  // ── Architecture parameter pie/donut ───────────────────────
  function renderArch(data) {
    const svg = document.getElementById('llm-arch');
    if (!svg) return;
    const W = 1100, H = 280, M = { t: 16, r: 30, b: 30, l: 30 };
    const comps = data.transformer.components;
    const total = comps.reduce((a, b) => a + b.share_pct, 0);

    svg.innerHTML = '';
    // Horizontal stacked bar
    const barY = 80, barH = 36;
    const barX0 = M.l + 30, barX1 = W - M.r;
    let cur = barX0;
    const totalW = barX1 - barX0;
    comps.forEach(c => {
      const w = (c.share_pct / total) * totalW;
      const color = c.color_idx === 1 ? CHART.blue : c.color_idx === 2 ? CHART.purple : c.color_idx === 3 ? CHART.orange : c.color_idx === 4 ? CHART.gold : CHART.rose;
      svg.appendChild(svgEl('rect', { x: cur, y: barY, width: w, height: barH, fill: color, opacity: 0.9 }));
      // Label inside bar if wide enough
      if (w > 110) {
        svg.appendChild(svgEl('text', { x: cur + w / 2, y: barY + barH / 2 + 4, 'text-anchor': 'middle', fill: 'var(--paper)', 'font-size': 11, 'font-family': 'DM Mono, monospace', 'font-weight': 500 })).textContent = c.label + ' · ' + c.share_pct.toFixed(1) + '%';
      }
      cur += w;
    });

    // Below: legend with detail
    let legendY = barY + barH + 38;
    let legendX = barX0;
    comps.forEach(c => {
      const color = c.color_idx === 1 ? CHART.blue : c.color_idx === 2 ? CHART.purple : c.color_idx === 3 ? CHART.orange : c.color_idx === 4 ? CHART.gold : CHART.rose;
      svg.appendChild(svgEl('rect', { x: legendX, y: legendY - 8, width: 10, height: 10, fill: color }));
      svg.appendChild(svgEl('text', { x: legendX + 16, y: legendY, fill: 'var(--ink)', 'font-size': 11, 'font-family': 'DM Mono, monospace' })).textContent = c.label;
      svg.appendChild(svgEl('text', { x: legendX + 16, y: legendY + 14, fill: 'var(--ink-soft)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = c.params_b.toFixed(2) + 'B params · ' + c.share_pct.toFixed(1) + '%';
      legendX += 200;
    });

    // Title above
    svg.appendChild(svgEl('text', { x: barX0, y: 40, 'text-anchor': 'start', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace', 'letter-spacing': '0.12em' })).textContent = 'PARAMETER SHARE — LLAMA 3 70B (~70B TOTAL)';
  }

  // ── Architecture history strip ──────────────────────────────
  function renderHistory(data) {
    const wrap = document.getElementById('llm-history');
    if (!wrap) return;
    wrap.innerHTML = data.transformer.vs_history.map(h =>
      '<div class="llm-history-cell">' +
        '<div class="llm-history-year">' + h.year + '</div>' +
        '<div class="llm-history-label">' + h.label + '</div>' +
        '<div class="llm-history-meta">ctx ' + h.context_window + '</div>' +
        '<div class="llm-history-meta">' + h.state + '</div>' +
      '</div>'
    ).join('');
  }

  // ── Training-loss curve (log step axis) ────────────────────
  function renderDynamics(data) {
    const svg = document.getElementById('llm-dynamics');
    if (!svg) return;
    const W = 1100, H = 360, M = { t: 30, r: 36, b: 50, l: 70 };
    const pts = data.dynamics.loss_curve;
    const xDomain = [pts[0].step, pts[pts.length - 1].step];
    const yDomain = [1.4, 6.0];
    const xScale = makeScale(xDomain, [M.l, W - M.r], 'log');
    const yScale = makeScale(yDomain, [H - M.b, M.t]);

    svg.innerHTML = '';
    // Y grid
    for (let v = 2; v <= 6; v += 1) {
      const y = yScale(v);
      svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: y, y2: y, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.18 }));
      svg.appendChild(svgEl('text', { x: M.l - 8, y: y + 4, 'text-anchor': 'end', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = v.toFixed(1);
    }
    // X log ticks
    [1e3, 1e4, 1e5, 1e6, 3e6].forEach(v => {
      if (v < xDomain[0] || v > xDomain[1]) return;
      const x = xScale(v);
      svg.appendChild(svgEl('line', { x1: x, x2: x, y1: M.t, y2: H - M.b, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.18 }));
      const lbl = v >= 1e6 ? (v / 1e6).toFixed(0) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'k' : v;
      svg.appendChild(svgEl('text', { x, y: H - M.b + 18, 'text-anchor': 'middle', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = lbl;
    });
    svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));
    svg.appendChild(svgEl('line', { x1: M.l, x2: M.l, y1: M.t, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));

    // Loss line
    let d = '';
    pts.forEach((p, i) => { d += (i ? 'L' : 'M') + xScale(p.step).toFixed(1) + ',' + yScale(p.loss).toFixed(1); });
    svg.appendChild(svgEl('path', { d, stroke: CHART.orange, 'stroke-width': 2, fill: 'none' }));
    pts.forEach(p => svg.appendChild(svgEl('circle', { cx: xScale(p.step), cy: yScale(p.loss), r: 3, fill: CHART.orange })));

    svg.appendChild(svgEl('text', { x: M.l - 60, y: M.t - 14, 'text-anchor': 'start', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace', 'letter-spacing': '0.10em' })).textContent = 'PRETRAINING LOSS';
    svg.appendChild(svgEl('text', { x: (M.l + W - M.r) / 2, y: H - 14, 'text-anchor': 'middle', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace', 'letter-spacing': '0.10em' })).textContent = 'TRAINING STEPS (LOG)';
  }

  // ── Phenomena tiles ─────────────────────────────────────────
  function renderPhenomena(data) {
    const wrap = document.getElementById('llm-phenomena');
    if (!wrap) return;
    wrap.innerHTML = data.dynamics.phenomena.map(p =>
      '<div class="llm-phen-tile">' +
        '<h4>' + p.label + '</h4>' +
        '<p class="summary">' + p.summary + '</p>' +
        '<p class="evidence">' + p.evidence + '</p>' +
      '</div>'
    ).join('');
  }

  // ── Emergence — discrete vs continuous ──────────────────────
  function renderEmergence(data) {
    const svg = document.getElementById('llm-emergence');
    if (!svg) return;
    const W = 1100, H = 380, M = { t: 36, r: 90, b: 56, l: 72 };
    const pts = data.emergence.demonstration;
    const xDomain = [1e20, 2e25];
    const yDomain = [0, 1];
    const xScale = makeScale(xDomain, [M.l, W - M.r], 'log');
    const yScale = makeScale(yDomain, [H - M.b, M.t]);

    svg.innerHTML = '';
    [0, 0.25, 0.5, 0.75, 1.0].forEach(v => {
      const y = yScale(v);
      svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: y, y2: y, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.18 }));
      svg.appendChild(svgEl('text', { x: M.l - 8, y: y + 4, 'text-anchor': 'end', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = (v * 100).toFixed(0) + '%';
    });
    [1e20, 1e21, 1e22, 1e23, 1e24, 1e25].forEach(v => {
      const x = xScale(v);
      svg.appendChild(svgEl('line', { x1: x, x2: x, y1: M.t, y2: H - M.b, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.18 }));
      svg.appendChild(svgEl('text', { x, y: H - M.b + 18, 'text-anchor': 'middle', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = '10^' + Math.log10(v).toFixed(0);
    });
    svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));
    svg.appendChild(svgEl('line', { x1: M.l, x2: M.l, y1: M.t, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));

    let dDisc = '', dCont = '';
    pts.forEach((p, i) => {
      dDisc += (i ? 'L' : 'M') + xScale(p.flop).toFixed(1) + ',' + yScale(p.discrete_acc).toFixed(1);
      dCont += (i ? 'L' : 'M') + xScale(p.flop).toFixed(1) + ',' + yScale(p.continuous).toFixed(1);
    });
    svg.appendChild(svgEl('path', { d: dDisc, stroke: CHART.orange, 'stroke-width': 2.5, fill: 'none' }));
    svg.appendChild(svgEl('path', { d: dCont, stroke: CHART.blue, 'stroke-width': 2.5, fill: 'none', 'stroke-dasharray': '5,4' }));
    pts.forEach(p => {
      svg.appendChild(svgEl('circle', { cx: xScale(p.flop), cy: yScale(p.discrete_acc), r: 3, fill: CHART.orange }));
      svg.appendChild(svgEl('circle', { cx: xScale(p.flop), cy: yScale(p.continuous), r: 3, fill: CHART.blue }));
    });

    // Legend
    const lx = W - M.r - 200, ly = M.t + 10;
    svg.appendChild(svgEl('rect', { x: lx, y: ly - 6, width: 16, height: 3, fill: CHART.orange }));
    svg.appendChild(svgEl('text', { x: lx + 22, y: ly, fill: CHART.orange, 'font-size': 10.5, 'font-family': 'DM Mono, monospace' })).textContent = 'Exact-match accuracy';
    svg.appendChild(svgEl('rect', { x: lx, y: ly + 14, width: 16, height: 3, fill: CHART.blue }));
    svg.appendChild(svgEl('text', { x: lx + 22, y: ly + 20, fill: CHART.blue, 'font-size': 10.5, 'font-family': 'DM Mono, monospace' })).textContent = 'Token-level log-prob';

    svg.appendChild(svgEl('text', { x: M.l - 60, y: M.t - 14, 'text-anchor': 'start', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace', 'letter-spacing': '0.10em' })).textContent = 'METRIC VALUE';
    svg.appendChild(svgEl('text', { x: (M.l + W - M.r) / 2, y: H - 14, 'text-anchor': 'middle', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace', 'letter-spacing': '0.10em' })).textContent = 'TRAINING COMPUTE — FLOPS (LOG)';
  }

  // ── Alignment table ─────────────────────────────────────────
  function renderAlignment(data) {
    const wrap = document.getElementById('llm-alignment');
    if (!wrap) return;
    let html = '<div class="llm-align-row head">' +
      '<div>Method</div><div>Year</div><div>Solves</div><div>Tradeoffs</div><div>Citation</div>' +
      '</div>';
    data.alignment.methods.forEach(m => {
      html += '<div class="llm-align-row">' +
        '<div class="name">' + m.label + '</div>' +
        '<div class="year">' + m.year + '</div>' +
        '<div>' + m.solves + '</div>' +
        '<div>' + m.tradeoffs + '</div>' +
        '<div class="citation">' + m.citation + '</div>' +
      '</div>';
    });
    wrap.innerHTML = html;
  }

  // ── Benchmark trajectories ──────────────────────────────────
  function renderBenchmarks(data) {
    const svg = document.getElementById('llm-benchmarks');
    if (!svg) return;
    const W = 1100, H = 460, M = { t: 36, r: 130, b: 56, l: 72 };
    const series = data.benchmarks.scores;
    const xDomain = [new Date('2020-01').getTime(), new Date('2026-09').getTime()];
    const yDomain = [0, 100];
    const xScale = makeScale(xDomain, [M.l, W - M.r]);
    const yScale = makeScale(yDomain, [H - M.b, M.t]);

    svg.innerHTML = '';
    // Y grid
    [0, 25, 50, 75, 100].forEach(v => {
      const y = yScale(v);
      svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: y, y2: y, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.18 }));
      svg.appendChild(svgEl('text', { x: M.l - 8, y: y + 4, 'text-anchor': 'end', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = v + '%';
    });
    // X year ticks
    for (let yr = 2020; yr <= 2026; yr++) {
      const x = xScale(new Date(yr + '-01').getTime());
      svg.appendChild(svgEl('line', { x1: x, x2: x, y1: M.t, y2: H - M.b, stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.16 }));
      svg.appendChild(svgEl('text', { x, y: H - M.b + 18, 'text-anchor': 'middle', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace' })).textContent = yr;
    }
    svg.appendChild(svgEl('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));
    svg.appendChild(svgEl('line', { x1: M.l, x2: M.l, y1: M.t, y2: H - M.b, stroke: 'var(--ink)', 'stroke-width': 1 }));

    const palette = [CHART.blue, CHART.orange, CHART.purple, CHART.gold, CHART.rose, '#5B9BD5'];
    series.forEach((s, idx) => {
      const meta = data.benchmarks.datasets.find(d => d.id === s.id);
      const color = palette[idx % palette.length];
      let d = '';
      s.trajectory.forEach((p, i) => {
        d += (i ? 'L' : 'M') + xScale(new Date(p.date).getTime()).toFixed(1) + ',' + yScale(p.score).toFixed(1);
      });
      svg.appendChild(svgEl('path', { d, stroke: color, 'stroke-width': 2, fill: 'none', opacity: 0.95 }));
      s.trajectory.forEach(p => svg.appendChild(svgEl('circle', { cx: xScale(new Date(p.date).getTime()), cy: yScale(p.score), r: 3, fill: color })));
      // Right-edge label
      const last = s.trajectory[s.trajectory.length - 1];
      svg.appendChild(svgEl('text', {
        x: xScale(new Date(last.date).getTime()) + 6, y: yScale(last.score) + 4,
        'text-anchor': 'start', fill: color,
        'font-size': 10.5, 'font-family': 'DM Mono, monospace', 'font-weight': 500
      })).textContent = meta.label;
    });

    svg.appendChild(svgEl('text', { x: M.l - 60, y: M.t - 14, 'text-anchor': 'start', fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace', 'letter-spacing': '0.10em' })).textContent = 'FRONTIER SCORE';
  }

  // ── Coda tiles ─────────────────────────────────────────────
  function renderCoda(data) {
    const wrap = document.getElementById('llm-coda');
    if (!wrap) return;
    const c = data.coda;
    let html = '';
    [c.interp, c.next_token].forEach(t => {
      html += '<div class="llm-coda-tile">' +
        '<h4>' + t.label + '</h4>' +
        '<p>' + t.body + '</p>' +
        '<ul>' + t.papers.map(p => '<li>' + p + '</li>').join('') + '</ul>' +
      '</div>';
    });
    wrap.innerHTML = html;
  }

  // ── Receipts ───────────────────────────────────────────────
  function renderReceipts(data) {
    const wrap = document.getElementById('llm-receipts');
    if (!wrap) return;
    wrap.innerHTML = data.receipts.map(r =>
      '<div class="llm-receipt">' +
        '<div class="llm-receipt-label">' + r.label + '</div>' +
        '<div class="llm-receipt-value">' + r.value + '</div>' +
        '<div class="llm-receipt-sub">' + r.sub + '</div>' +
      '</div>'
    ).join('');
  }
})();
