/* ═══════════════════════════════════════════════════════════
   AI REWORK LAB
   Eight interactive SVG charts forensically deconstructing
   the viral "82% of AI tokens go to rework" claim.
   No fetch. All data baked below.
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────
  // 1. DATA
  // ─────────────────────────────────────────────────────────

  // 1a. Chart A: Baseline Comparison
  var BASELINE = [
    { label: 'Pre-AI baseline (Lientz et al. 1978)', value: 77.5, color: 'var(--rw-human)' },
    { label: 'Entelligence claim (2026)', value: 82, color: 'var(--rw-negative)' }
  ];

  // 1b. Chart B: METR Forest Plot
  var METR = [
    { label: 'Predicted speedup', value: 24, ciLo: null, ciHi: null, color: 'var(--rw-neutral)' },
    { label: 'Self-reported speedup', value: 20, ciLo: null, ciHi: null, color: 'var(--rw-neutral)' },
    { label: 'METR 2025 actual (n=16)', value: -19, ciLo: -39, ciHi: 1, color: 'var(--rw-negative)' },
    { label: 'METR 2026 replication (n=57)', value: -4, ciLo: -15, ciHi: 9, color: 'var(--rw-ai)' }
  ];

  // 1c. Chart C: SWE-Bench Trajectory
  var SWEBENCH = [
    { date: '2023-12', score: 4.8, label: 'Claude 2' },
    { date: '2024-10', score: 49.0, label: 'Claude 3.5 Sonnet' },
    { date: '2024-12', score: 62.2, label: 'OpenAI o1' },
    { date: '2025-01', score: 72.0, label: 'OpenAI o3' },
    { date: '2025-11', score: 80.9, label: 'Claude Opus 4.5' },
    { date: '2026-05', score: 82.6, label: 'GPT-5.5' }
  ];

  // 1d. Chart D: Faros Whiplash
  var FAROS = [
    { label: 'Epics per dev', value: 66, positive: true },
    { label: 'Task throughput', value: 33.7, positive: true },
    { label: 'PR merge rate', value: 16.2, positive: true },
    { label: 'Bugs per dev', value: -54, positive: false },
    { label: 'Time to first review', value: -156.6, positive: false },
    { label: 'Incidents per PR', value: -242.7, positive: false },
    { label: 'PR review time', value: -441.5, positive: false },
    { label: 'Code churn', value: -861, positive: false }
  ];

  // 1e. Chart E: CodeRabbit Ratios
  var CODERABBIT = [
    { category: 'Overall issues/PR', ai: 10.83, human: 6.45 },
    { category: 'Logic/correctness', ratio: 1.75 },
    { category: 'Security', ratio: 1.57 },
    { category: 'Quality/maintainability', ratio: 1.64 },
    { category: 'Performance', ratio: 1.42 },
    { category: 'Readability', ratio: 3.0 }
  ];

  // 1f. Chart F: Trust vs Usage
  var TRUST = {
    years: [2023, 2024, 2025],
    usage: [70, 76, 84],
    trust: [null, 40, 29]
  };

  // 1g. Chart G: GitClear Churn
  var GITCLEAR = {
    years: [2020, 2021, 2022, 2023, 2024],
    copied: [8.3, 8.8, 9.5, 10.8, 12.3],
    refactored: [24.1, 22.0, 18.5, 14.0, 9.5]
  };

  // 1h. Chart H: Rebuilt Dollar
  var DOLLAR = [
    {
      label: 'Sankar / Entelligence',
      segments: [
        { name: 'Rework', value: 0.44, color: 'var(--rw-negative)' },
        { name: 'Review', value: 0.27, color: 'oklch(0.70 0.10 50)' },
        { name: 'Other', value: 0.25, color: 'var(--rw-neutral)' },
        { name: 'Feature', value: 0.04, color: 'var(--rw-positive)' }
      ]
    },
    {
      label: 'Jellyfish (Apr 2026)',
      segments: [
        { name: 'Overhead', value: 0.50, color: 'var(--rw-negative)' },
        { name: 'Marginal rework', value: 0.30, color: 'oklch(0.70 0.10 50)' },
        { name: 'Delivered value', value: 0.20, color: 'var(--rw-positive)' }
      ]
    },
    {
      label: 'McKinsey (2025)',
      segments: [
        { name: 'Overhead', value: 0.40, color: 'var(--rw-negative)' },
        { name: 'Productivity', value: 0.40, color: 'var(--rw-neutral)' },
        { name: 'Net savings', value: 0.20, color: 'var(--rw-positive)' }
      ]
    }
  ];

  // ─────────────────────────────────────────────────────────
  // 2. UTILITIES
  // ─────────────────────────────────────────────────────────

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function createSVGEl(tag, attrs, parent) {
    var node = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    }
    if (parent) parent.appendChild(node);
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function drawLine(svg, x1, y1, x2, y2, className, stroke) {
    return createSVGEl('line', {
      class: className || '',
      x1: x1, y1: y1, x2: x2, y2: y2,
      stroke: stroke || 'var(--ink-dim)',
      'stroke-width': 1
    }, svg);
  }

  function drawText(svg, x, y, text, className, anchor, fill) {
    var t = createSVGEl('text', {
      class: className || '',
      x: x, y: y,
      'text-anchor': anchor || 'start',
      fill: fill || 'var(--ink)',
      'font-family': '"DM Mono", ui-monospace, monospace',
      'font-size': '10'
    }, svg);
    t.textContent = text;
    return t;
  }

  // ─────────────────────────────────────────────────────────
  // 2b. SHARED TOOLTIP
  // ─────────────────────────────────────────────────────────

  function showTip(ev, body) {
    var tip = document.getElementById('rw-tooltip');
    if (!tip) return;
    tip.innerHTML = body;
    tip.hidden = false;
    var wrap = tip.parentNode.getBoundingClientRect();
    var x = ev.clientX - wrap.left + 14;
    var y = ev.clientY - wrap.top + 14;
    if (x + 200 > wrap.width) x = ev.clientX - wrap.left - 180;
    if (y + 80 > wrap.height) y = ev.clientY - wrap.top - 60;
    tip.style.left = x + 'px';
    tip.style.top  = y + 'px';
  }

  function hideTip() {
    var tip = document.getElementById('rw-tooltip');
    if (tip) tip.hidden = true;
  }

  // ─────────────────────────────────────────────────────────
  // 3. CHART A: BASELINE COMPARISON
  //    Two horizontal bars: 1978 vs 2026
  // ─────────────────────────────────────────────────────────

  function renderBaseline() {
    var svg = document.getElementById('rw-baseline');
    if (!svg) return;
    clear(svg);

    var W = 900, H = 400;
    var pad = { l: 260, r: 80, t: 60, b: 60 };
    var iw = W - pad.l - pad.r;
    var ih = H - pad.t - pad.b;
    var barH = 60;
    var gap = 40;

    // X-axis: 0% to 100%
    function xS(v) { return pad.l + (v / 100) * iw; }

    // X-axis line and ticks
    drawLine(svg, pad.l, pad.t + ih, pad.l + iw, pad.t + ih, 'rw-axis', 'var(--ink)');
    var xTicks = [0, 20, 40, 60, 80, 100];
    xTicks.forEach(function (v) {
      var xx = xS(v);
      drawLine(svg, xx, pad.t, xx, pad.t + ih, 'rw-grid', 'var(--ink-dim)');
      drawText(svg, xx, pad.t + ih + 22, v + '%', 'rw-axis-label', 'middle', 'var(--ink-dim)');
    });

    // Vertical reference line at 77.5%
    var refX = xS(77.5);
    createSVGEl('line', {
      class: 'rw-ref-line',
      x1: refX, y1: pad.t - 10, x2: refX, y2: pad.t + ih,
      stroke: 'var(--ink-soft)',
      'stroke-width': 1.5,
      'stroke-dasharray': '6,4'
    }, svg);
    drawText(svg, refX, pad.t - 18, '1978 baseline: 77.5%', 'rw-ref-label', 'middle', 'var(--ink-soft)');

    // Draw bars
    BASELINE.forEach(function (d, i) {
      var barY = pad.t + 20 + i * (barH + gap);
      var barW = (d.value / 100) * iw;

      // Label
      drawText(svg, pad.l - 14, barY + barH / 2 + 4, d.label, 'rw-bar-label', 'end', 'var(--ink)');

      // Bar
      var bar = createSVGEl('rect', {
        class: 'rw-bar',
        x: pad.l, y: barY,
        width: barW, height: barH,
        fill: d.color,
        rx: 3
      }, svg);

      // Value at end
      var valT = drawText(svg, pad.l + barW + 10, barY + barH / 2 + 5,
        d.value + '%', 'rw-bar-value', 'start', 'var(--ink)');
      valT.setAttribute('font-size', '14');
      valT.setAttribute('font-weight', '600');

      // Tooltip
      bar.addEventListener('mouseenter', function (ev) {
        showTip(ev,
          '<strong>' + d.label + '</strong><br>' +
          'Maintenance/rework share: ' + d.value + '%');
      });
      bar.addEventListener('mouseleave', hideTip);
    });

    // Annotation: delta
    var deltaX = xS(82) + 50;
    var deltaY = pad.t + 20 + barH + gap / 2;
    drawText(svg, deltaX + 40, deltaY + 4, 'Delta: 4.5 pp', 'rw-anno', 'start', 'var(--ink-soft)');
  }

  // ─────────────────────────────────────────────────────────
  // 4. CHART B: METR FOREST PLOT
  //    Horizontal plot with CIs
  // ─────────────────────────────────────────────────────────

  function renderMETR() {
    var svg = document.getElementById('rw-metr');
    if (!svg) return;
    clear(svg);

    var W = 1000, H = 360;
    var pad = { l: 280, r: 60, t: 40, b: 50 };
    var iw = W - pad.l - pad.r;
    var ih = H - pad.t - pad.b;
    var rowH = ih / METR.length;

    // X-axis: -50% to +30%
    var xMin = -50, xMax = 30;
    function xS(v) { return pad.l + ((v - xMin) / (xMax - xMin)) * iw; }

    // X-axis line and ticks
    drawLine(svg, pad.l, pad.t + ih, pad.l + iw, pad.t + ih, 'rw-axis', 'var(--ink)');
    var xTicks = [-50, -40, -30, -20, -10, 0, 10, 20, 30];
    xTicks.forEach(function (v) {
      var xx = xS(v);
      drawLine(svg, xx, pad.t, xx, pad.t + ih, 'rw-grid', 'var(--ink-dim)');
      drawText(svg, xx, pad.t + ih + 22, v + '%', 'rw-axis-label', 'middle', 'var(--ink-dim)');
    });

    // 0% reference line
    var zeroX = xS(0);
    createSVGEl('line', {
      class: 'rw-ref-line',
      x1: zeroX, y1: pad.t - 5, x2: zeroX, y2: pad.t + ih,
      stroke: 'var(--ink)',
      'stroke-width': 2
    }, svg);
    drawText(svg, zeroX, pad.t - 12, 'No effect', 'rw-ref-label', 'middle', 'var(--ink-soft)');

    // Rows
    METR.forEach(function (d, i) {
      var cy = pad.t + rowH * i + rowH / 2;

      // Row label
      drawText(svg, pad.l - 14, cy + 4, d.label, 'rw-forest-label', 'end', 'var(--ink)');

      // CI line (if present)
      if (d.ciLo !== null && d.ciHi !== null) {
        createSVGEl('line', {
          class: 'rw-ci-line',
          x1: xS(d.ciLo), y1: cy,
          x2: xS(d.ciHi), y2: cy,
          stroke: d.color,
          'stroke-width': 2.5
        }, svg);

        // CI endpoints (small vertical bars)
        createSVGEl('line', {
          x1: xS(d.ciLo), y1: cy - 6,
          x2: xS(d.ciLo), y2: cy + 6,
          stroke: d.color,
          'stroke-width': 2
        }, svg);
        createSVGEl('line', {
          x1: xS(d.ciHi), y1: cy - 6,
          x2: xS(d.ciHi), y2: cy + 6,
          stroke: d.color,
          'stroke-width': 2
        }, svg);
      }

      // Point estimate dot
      var dot = createSVGEl('circle', {
        class: 'rw-dot',
        cx: xS(d.value), cy: cy,
        r: 6,
        fill: d.color,
        stroke: 'var(--paper)',
        'stroke-width': 2
      }, svg);

      // Value label to the right of dot
      var valX = d.ciHi !== null ? xS(d.ciHi) + 12 : xS(d.value) + 12;
      drawText(svg, valX, cy + 4, d.value + '%', 'rw-forest-value', 'start', 'var(--ink)');

      // Tooltip
      dot.addEventListener('mouseenter', function (ev) {
        var ciStr = d.ciLo !== null ? '<br>95% CI: [' + d.ciLo + '%, ' + d.ciHi + '%]' : '';
        showTip(ev,
          '<strong>' + d.label + '</strong><br>' +
          'Estimate: ' + d.value + '%' + ciStr);
      });
      dot.addEventListener('mouseleave', hideTip);
    });
  }

  // ─────────────────────────────────────────────────────────
  // 5. CHART C: SWE-BENCH TRAJECTORY
  //    Line chart with model annotations
  // ─────────────────────────────────────────────────────────

  function renderSWEBench() {
    var svg = document.getElementById('rw-swebench');
    if (!svg) return;
    clear(svg);

    var W = 1100, H = 440;
    var pad = { l: 70, r: 120, t: 40, b: 56 };
    var iw = W - pad.l - pad.r;
    var ih = H - pad.t - pad.b;

    // Parse dates to fractional months from a reference
    var refDate = new Date(2023, 11, 1); // Dec 2023
    function monthsSinceRef(dateStr) {
      var parts = dateStr.split('-');
      var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
      return (d.getFullYear() - refDate.getFullYear()) * 12 + (d.getMonth() - refDate.getMonth());
    }

    var months = SWEBENCH.map(function (d) { return monthsSinceRef(d.date); });
    var xMin = 0;
    var xMax = monthsSinceRef('2026-05');

    function xS(m) { return pad.l + ((m - xMin) / (xMax - xMin)) * iw; }
    function yS(v) { return pad.t + ih - (v / 100) * ih; }

    // Axes
    drawLine(svg, pad.l, pad.t + ih, pad.l + iw, pad.t + ih, 'rw-axis', 'var(--ink)');
    drawLine(svg, pad.l, pad.t, pad.l, pad.t + ih, 'rw-axis', 'var(--ink)');

    // Y ticks
    var yTicks = [0, 20, 40, 60, 80, 100];
    yTicks.forEach(function (v) {
      var yy = yS(v);
      drawLine(svg, pad.l, yy, pad.l + iw, yy, 'rw-grid', 'var(--ink-dim)');
      drawText(svg, pad.l - 10, yy + 4, v + '%', 'rw-axis-label', 'end', 'var(--ink-dim)');
    });

    // X ticks (every 6 months)
    var xLabels = [
      { m: 0, label: 'Dec 2023' },
      { m: 6, label: 'Jun 2024' },
      { m: 12, label: 'Dec 2024' },
      { m: 18, label: 'Jun 2025' },
      { m: 24, label: 'Dec 2025' },
      { m: 29, label: 'May 2026' }
    ];
    xLabels.forEach(function (tick) {
      var xx = xS(tick.m);
      drawLine(svg, xx, pad.t, xx, pad.t + ih, 'rw-grid', 'var(--ink-dim)');
      drawText(svg, xx, pad.t + ih + 22, tick.label, 'rw-axis-label', 'middle', 'var(--ink-dim)');
    });

    // Axis titles
    drawText(svg, pad.l + iw / 2, pad.t + ih + 46, 'SWE-bench Verified resolve rate', 'rw-axis-title', 'middle', 'var(--ink-soft)');

    // 82% reference line
    var refY = yS(82);
    createSVGEl('line', {
      class: 'rw-ref-line',
      x1: pad.l, y1: refY, x2: pad.l + iw, y2: refY,
      stroke: 'var(--rw-negative)',
      'stroke-width': 1.5,
      'stroke-dasharray': '8,5'
    }, svg);
    drawText(svg, pad.l + iw - 4, refY - 8, 'Entelligence 82% claim', 'rw-ref-label', 'end', 'var(--rw-negative)');

    // Line connecting points
    var pts = '';
    SWEBENCH.forEach(function (d, i) {
      var m = months[i];
      var xx = xS(m);
      var yy = yS(d.score);
      pts += (i === 0 ? '' : ' ') + xx + ',' + yy;
    });

    createSVGEl('polyline', {
      class: 'rw-line',
      points: pts,
      fill: 'none',
      stroke: 'var(--rw-ai)',
      'stroke-width': 2.5,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    }, svg);

    // Dots and annotations
    SWEBENCH.forEach(function (d, i) {
      var m = months[i];
      var cx = xS(m);
      var cy = yS(d.score);

      var dot = createSVGEl('circle', {
        class: 'rw-dot',
        cx: cx, cy: cy,
        r: 5,
        fill: 'var(--rw-ai)',
        stroke: 'var(--paper)',
        'stroke-width': 2
      }, svg);

      // Per-point label offsets to prevent overlaps
      // 0: Claude 2 (4.8%) — below-right
      // 1: Claude 3.5 Sonnet (49%) — below
      // 2: OpenAI o1 (62.2%) — below-left, nudged left
      // 3: OpenAI o3 (72%) — above-right, nudged right
      // 4: Claude Opus 4.5 (80.9%) — well above (clear the 82% ref line)
      // 5: GPT-5.5 (82.6%) — below
      var offsets = [
        { dy: 22, anchor: 'start' },
        { dy: 26, anchor: 'middle' },
        { dy: 26, anchor: 'end' },
        { dy: -18, anchor: 'start' },
        { dy: -28, anchor: 'middle' },
        { dy: 22, anchor: 'end' }
      ];
      var off = offsets[i] || { dy: -14, anchor: 'middle' };
      var labelY = cy + off.dy;

      var lbl = drawText(svg, cx, labelY, d.label, 'rw-model-label', off.anchor, 'var(--ink)');
      lbl.setAttribute('font-size', '9');

      var scoreT = drawText(svg, cx, labelY + 12, d.score + '%', 'rw-model-score', off.anchor, 'var(--ink-soft)');
      scoreT.setAttribute('font-size', '9');

      dot.addEventListener('mouseenter', function (ev) {
        showTip(ev,
          '<strong>' + d.label + '</strong><br>' +
          'Date: ' + d.date + '<br>' +
          'SWE-bench: ' + d.score + '%');
      });
      dot.addEventListener('mouseleave', hideTip);
    });
  }

  // ─────────────────────────────────────────────────────────
  // 6. CHART D: FAROS WHIPLASH
  //    Diverging horizontal bar chart
  // ─────────────────────────────────────────────────────────

  function renderFaros() {
    var svg = document.getElementById('rw-faros');
    if (!svg) return;
    clear(svg);

    var W = 1100, H = 520;
    var pad = { l: 220, r: 80, t: 40, b: 50 };
    var iw = W - pad.l - pad.r;
    var ih = H - pad.t - pad.b;
    var rowH = ih / FAROS.length;
    var barH = rowH * 0.6;

    // X range: -900 to +100 (covers all values)
    var xAbsMax = 900;
    var xPosMax = 100;
    // Center line is at 0
    // Map: -900..0..100 across the full width
    var totalRange = xAbsMax + xPosMax;
    var centerX = pad.l + (xAbsMax / totalRange) * iw;

    function xS(v) {
      return pad.l + ((v + xAbsMax) / totalRange) * iw;
    }

    // Axes
    drawLine(svg, pad.l, pad.t + ih, pad.l + iw, pad.t + ih, 'rw-axis', 'var(--ink)');

    // Center line (0)
    createSVGEl('line', {
      class: 'rw-ref-line',
      x1: centerX, y1: pad.t - 5, x2: centerX, y2: pad.t + ih,
      stroke: 'var(--ink)',
      'stroke-width': 1.5
    }, svg);
    drawText(svg, centerX, pad.t - 12, '0%', 'rw-ref-label', 'middle', 'var(--ink-soft)');

    // X ticks
    var xTicks = [-800, -600, -400, -200, 0, 50];
    xTicks.forEach(function (v) {
      var xx = xS(v);
      drawLine(svg, xx, pad.t + ih, xx, pad.t + ih + 6, 'rw-tick', 'var(--ink-dim)');
      drawText(svg, xx, pad.t + ih + 22, v + '%', 'rw-axis-label', 'middle', 'var(--ink-dim)');
    });

    // Draw bars (sorted: positive on top, negative on bottom)
    FAROS.forEach(function (d, i) {
      var cy = pad.t + rowH * i + rowH / 2;
      var barY = cy - barH / 2;

      // Label
      drawText(svg, pad.l - 14, cy + 4, d.label, 'rw-bar-label', 'end', 'var(--ink)');

      // Bar
      var barColor = d.positive ? 'var(--rw-positive)' : 'var(--rw-negative)';
      var barX, barW;
      if (d.positive) {
        barX = centerX;
        barW = xS(d.value) - centerX;
      } else {
        barX = xS(d.value);
        barW = centerX - xS(d.value);
      }

      var bar = createSVGEl('rect', {
        class: 'rw-bar',
        x: barX, y: barY,
        width: Math.max(barW, 1), height: barH,
        fill: barColor,
        rx: 2
      }, svg);

      // Value at bar end
      var valX, valAnchor;
      if (d.positive) {
        valX = xS(d.value) + 8;
        valAnchor = 'start';
      } else {
        valX = xS(d.value) - 8;
        valAnchor = 'end';
      }
      var sign = d.value > 0 ? '+' : '';
      var valT = drawText(svg, valX, cy + 4, sign + d.value + '%', 'rw-bar-value', valAnchor, 'var(--ink)');
      valT.setAttribute('font-size', '11');

      bar.addEventListener('mouseenter', function (ev) {
        showTip(ev,
          '<strong>' + d.label + '</strong><br>' +
          'Change: ' + sign + d.value + '%');
      });
      bar.addEventListener('mouseleave', hideTip);
    });
  }

  // ─────────────────────────────────────────────────────────
  // 7. CHART E: CODERABBIT RATIOS
  //    Paired bars + ratio bars
  // ─────────────────────────────────────────────────────────

  function renderCodeRabbit() {
    var svg = document.getElementById('rw-coderabbit');
    if (!svg) return;
    clear(svg);

    var W = 1000, H = 420;
    var pad = { l: 260, r: 80, t: 40, b: 50 };
    var iw = W - pad.l - pad.r;
    var ih = H - pad.t - pad.b;
    var rowH = ih / CODERABBIT.length;
    var barH = 18;

    // First row: absolute bars (max ~12)
    // Remaining rows: ratio bars (max 3.0)
    var absMax = 12;
    var ratioMax = 3.5;

    function xSAbs(v) { return pad.l + (v / absMax) * iw; }
    function xSRatio(v) { return pad.l + (v / ratioMax) * iw; }

    // Axis
    drawLine(svg, pad.l, pad.t + ih, pad.l + iw, pad.t + ih, 'rw-axis', 'var(--ink)');

    // First row: paired bars
    var d0 = CODERABBIT[0];
    var cy0 = pad.t + rowH * 0 + rowH / 2;

    drawText(svg, pad.l - 14, cy0, d0.category, 'rw-bar-label', 'end', 'var(--ink)');

    // AI bar
    var aiY = cy0 - barH - 2;
    var aiW = xSAbs(d0.ai) - pad.l;
    var aiBar = createSVGEl('rect', {
      class: 'rw-bar',
      x: pad.l, y: aiY,
      width: aiW, height: barH,
      fill: 'var(--rw-negative)',
      rx: 2
    }, svg);
    drawText(svg, pad.l + aiW + 8, aiY + barH / 2 + 4, d0.ai.toFixed(2) + ' (AI)', 'rw-bar-value', 'start', 'var(--ink)');

    aiBar.addEventListener('mouseenter', function (ev) {
      showTip(ev, '<strong>AI-authored PRs</strong><br>Issues per PR: ' + d0.ai.toFixed(2));
    });
    aiBar.addEventListener('mouseleave', hideTip);

    // Human bar
    var humY = cy0 + 2;
    var humW = xSAbs(d0.human) - pad.l;
    var humBar = createSVGEl('rect', {
      class: 'rw-bar',
      x: pad.l, y: humY,
      width: humW, height: barH,
      fill: 'var(--rw-human)',
      rx: 2
    }, svg);
    drawText(svg, pad.l + humW + 8, humY + barH / 2 + 4, d0.human.toFixed(2) + ' (Human)', 'rw-bar-value', 'start', 'var(--ink)');

    humBar.addEventListener('mouseenter', function (ev) {
      showTip(ev, '<strong>Human-authored PRs</strong><br>Issues per PR: ' + d0.human.toFixed(2));
    });
    humBar.addEventListener('mouseleave', hideTip);

    // 1.0x reference line for ratio rows
    var refX = xSRatio(1.0);
    createSVGEl('line', {
      class: 'rw-ref-line',
      x1: refX, y1: pad.t + rowH, x2: refX, y2: pad.t + ih,
      stroke: 'var(--ink-soft)',
      'stroke-width': 1.5,
      'stroke-dasharray': '6,4'
    }, svg);
    drawText(svg, refX, pad.t + rowH - 6, '1.0x (human baseline)', 'rw-ref-label', 'middle', 'var(--ink-soft)');

    // Ratio rows
    for (var i = 1; i < CODERABBIT.length; i++) {
      var d = CODERABBIT[i];
      var cy = pad.t + rowH * i + rowH / 2;

      drawText(svg, pad.l - 14, cy + 4, d.category, 'rw-bar-label', 'end', 'var(--ink)');

      // Bar from 1.0x to ratio
      var barX = xSRatio(1.0);
      var barW = xSRatio(d.ratio) - barX;
      var ratioBar = createSVGEl('rect', {
        class: 'rw-bar',
        x: barX, y: cy - barH / 2,
        width: Math.max(barW, 1), height: barH,
        fill: 'var(--rw-negative)',
        rx: 2,
        opacity: 0.8
      }, svg);

      // Baseline fill (from pad.l to 1.0x)
      createSVGEl('rect', {
        class: 'rw-bar-bg',
        x: pad.l, y: cy - barH / 2,
        width: refX - pad.l, height: barH,
        fill: 'var(--rw-human)',
        rx: 2,
        opacity: 0.25
      }, svg);

      // Value
      drawText(svg, xSRatio(d.ratio) + 8, cy + 4, d.ratio.toFixed(2) + 'x', 'rw-bar-value', 'start', 'var(--ink)');

      (function (item) {
        ratioBar.addEventListener('mouseenter', function (ev) {
          showTip(ev,
            '<strong>' + item.category + '</strong><br>' +
            'AI/Human issue ratio: ' + item.ratio.toFixed(2) + 'x');
        });
        ratioBar.addEventListener('mouseleave', hideTip);
      })(d);
    }
  }

  // ─────────────────────────────────────────────────────────
  // 8. CHART F: TRUST VS USAGE
  //    Two-line chart, diverging trend
  // ─────────────────────────────────────────────────────────

  function renderTrust() {
    var svg = document.getElementById('rw-trust');
    if (!svg) return;
    clear(svg);

    var W = 900, H = 400;
    var pad = { l: 70, r: 120, t: 40, b: 56 };
    var iw = W - pad.l - pad.r;
    var ih = H - pad.t - pad.b;

    // X: 2023 to 2025
    var xMin = 2023, xMax = 2025;
    function xS(v) { return pad.l + ((v - xMin) / (xMax - xMin)) * iw; }
    function yS(v) { return pad.t + ih - (v / 100) * ih; }

    // Axes
    drawLine(svg, pad.l, pad.t + ih, pad.l + iw, pad.t + ih, 'rw-axis', 'var(--ink)');
    drawLine(svg, pad.l, pad.t, pad.l, pad.t + ih, 'rw-axis', 'var(--ink)');

    // Y ticks
    var yTicks = [0, 20, 40, 60, 80, 100];
    yTicks.forEach(function (v) {
      var yy = yS(v);
      drawLine(svg, pad.l, yy, pad.l + iw, yy, 'rw-grid', 'var(--ink-dim)');
      drawText(svg, pad.l - 10, yy + 4, v + '%', 'rw-axis-label', 'end', 'var(--ink-dim)');
    });

    // X ticks
    TRUST.years.forEach(function (yr) {
      var xx = xS(yr);
      drawLine(svg, xx, pad.t, xx, pad.t + ih, 'rw-grid', 'var(--ink-dim)');
      drawText(svg, xx, pad.t + ih + 22, String(yr), 'rw-axis-label', 'middle', 'var(--ink-dim)');
    });

    // Usage line
    var usagePts = '';
    TRUST.years.forEach(function (yr, i) {
      var xx = xS(yr);
      var yy = yS(TRUST.usage[i]);
      usagePts += (i === 0 ? '' : ' ') + xx + ',' + yy;
    });
    createSVGEl('polyline', {
      class: 'rw-line',
      points: usagePts,
      fill: 'none',
      stroke: 'var(--rw-ai)',
      'stroke-width': 2.5,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    }, svg);

    // Usage dots
    TRUST.years.forEach(function (yr, i) {
      var cx = xS(yr);
      var cy = yS(TRUST.usage[i]);
      var dot = createSVGEl('circle', {
        class: 'rw-dot',
        cx: cx, cy: cy, r: 5,
        fill: 'var(--rw-ai)',
        stroke: 'var(--paper)',
        'stroke-width': 2
      }, svg);
      dot.addEventListener('mouseenter', function (ev) {
        showTip(ev, '<strong>Dev AI usage</strong><br>' + yr + ': ' + TRUST.usage[i] + '%');
      });
      dot.addEventListener('mouseleave', hideTip);
    });

    // Usage end label
    var lastUsageX = xS(2025);
    var lastUsageY = yS(TRUST.usage[2]);
    drawText(svg, lastUsageX + 12, lastUsageY + 4, 'Usage: ' + TRUST.usage[2] + '%', 'rw-line-label', 'start', 'var(--rw-ai)');

    // Trust line (starts at 2024)
    var trustPts = '';
    var trustStartIdx = 1;
    var first = true;
    for (var i = trustStartIdx; i < TRUST.years.length; i++) {
      if (TRUST.trust[i] === null) continue;
      var xx = xS(TRUST.years[i]);
      var yy = yS(TRUST.trust[i]);
      trustPts += (first ? '' : ' ') + xx + ',' + yy;
      first = false;
    }
    createSVGEl('polyline', {
      class: 'rw-line',
      points: trustPts,
      fill: 'none',
      stroke: 'var(--rw-negative)',
      'stroke-width': 2.5,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    }, svg);

    // Trust dots
    for (var j = trustStartIdx; j < TRUST.years.length; j++) {
      if (TRUST.trust[j] === null) continue;
      var tcx = xS(TRUST.years[j]);
      var tcy = yS(TRUST.trust[j]);
      var tdot = createSVGEl('circle', {
        class: 'rw-dot',
        cx: tcx, cy: tcy, r: 5,
        fill: 'var(--rw-negative)',
        stroke: 'var(--paper)',
        'stroke-width': 2
      }, svg);
      (function (year, val) {
        tdot.addEventListener('mouseenter', function (ev) {
          showTip(ev, '<strong>Trust in AI code</strong><br>' + year + ': ' + val + '%');
        });
        tdot.addEventListener('mouseleave', hideTip);
      })(TRUST.years[j], TRUST.trust[j]);
    }

    // Trust end label
    var lastTrustX = xS(2025);
    var lastTrustY = yS(TRUST.trust[2]);
    drawText(svg, lastTrustX + 12, lastTrustY + 4, 'Trust: ' + TRUST.trust[2] + '%', 'rw-line-label', 'start', 'var(--rw-negative)');
  }

  // ─────────────────────────────────────────────────────────
  // 9. CHART G: GITCLEAR CHURN
  //    Two-line chart with crossover annotation
  // ─────────────────────────────────────────────────────────

  function renderGitClear() {
    var svg = document.getElementById('rw-gitclear');
    if (!svg) return;
    clear(svg);

    var W = 900, H = 400;
    var pad = { l: 70, r: 140, t: 40, b: 56 };
    var iw = W - pad.l - pad.r;
    var ih = H - pad.t - pad.b;

    var xMin = 2020, xMax = 2024;
    function xS(v) { return pad.l + ((v - xMin) / (xMax - xMin)) * iw; }

    // Y: 0 to 30%
    var yMax = 30;
    function yS(v) { return pad.t + ih - (v / yMax) * ih; }

    // Axes
    drawLine(svg, pad.l, pad.t + ih, pad.l + iw, pad.t + ih, 'rw-axis', 'var(--ink)');
    drawLine(svg, pad.l, pad.t, pad.l, pad.t + ih, 'rw-axis', 'var(--ink)');

    // Y ticks
    var yTicks = [0, 5, 10, 15, 20, 25, 30];
    yTicks.forEach(function (v) {
      var yy = yS(v);
      drawLine(svg, pad.l, yy, pad.l + iw, yy, 'rw-grid', 'var(--ink-dim)');
      drawText(svg, pad.l - 10, yy + 4, v + '%', 'rw-axis-label', 'end', 'var(--ink-dim)');
    });

    // X ticks
    GITCLEAR.years.forEach(function (yr) {
      var xx = xS(yr);
      drawLine(svg, xx, pad.t, xx, pad.t + ih, 'rw-grid', 'var(--ink-dim)');
      drawText(svg, xx, pad.t + ih + 22, String(yr), 'rw-axis-label', 'middle', 'var(--ink-dim)');
    });

    // Axis title
    drawText(svg, pad.l + iw / 2, pad.t + ih + 46, 'Share of total code changes', 'rw-axis-title', 'middle', 'var(--ink-soft)');

    // Copied line (rising, negative signal)
    var copiedPts = '';
    GITCLEAR.years.forEach(function (yr, i) {
      var xx = xS(yr);
      var yy = yS(GITCLEAR.copied[i]);
      copiedPts += (i === 0 ? '' : ' ') + xx + ',' + yy;
    });
    createSVGEl('polyline', {
      class: 'rw-line',
      points: copiedPts,
      fill: 'none',
      stroke: 'var(--rw-negative)',
      'stroke-width': 2.5,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    }, svg);

    // Copied dots
    GITCLEAR.years.forEach(function (yr, i) {
      var cx = xS(yr);
      var cy = yS(GITCLEAR.copied[i]);
      var dot = createSVGEl('circle', {
        class: 'rw-dot',
        cx: cx, cy: cy, r: 4,
        fill: 'var(--rw-negative)',
        stroke: 'var(--paper)',
        'stroke-width': 2
      }, svg);
      dot.addEventListener('mouseenter', function (ev) {
        showTip(ev, '<strong>Copied/pasted code</strong><br>' + yr + ': ' + GITCLEAR.copied[i] + '%');
      });
      dot.addEventListener('mouseleave', hideTip);
    });

    // Copied end label
    drawText(svg, xS(2024) + 12, yS(GITCLEAR.copied[4]) + 4, 'Copied/pasted: ' + GITCLEAR.copied[4] + '%', 'rw-line-label', 'start', 'var(--rw-negative)');

    // Refactored line (falling, positive signal)
    var refPts = '';
    GITCLEAR.years.forEach(function (yr, i) {
      var xx = xS(yr);
      var yy = yS(GITCLEAR.refactored[i]);
      refPts += (i === 0 ? '' : ' ') + xx + ',' + yy;
    });
    createSVGEl('polyline', {
      class: 'rw-line',
      points: refPts,
      fill: 'none',
      stroke: 'var(--rw-positive)',
      'stroke-width': 2.5,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    }, svg);

    // Refactored dots
    GITCLEAR.years.forEach(function (yr, i) {
      var cx = xS(yr);
      var cy = yS(GITCLEAR.refactored[i]);
      var dot = createSVGEl('circle', {
        class: 'rw-dot',
        cx: cx, cy: cy, r: 4,
        fill: 'var(--rw-positive)',
        stroke: 'var(--paper)',
        'stroke-width': 2
      }, svg);
      dot.addEventListener('mouseenter', function (ev) {
        showTip(ev, '<strong>Refactored code</strong><br>' + yr + ': ' + GITCLEAR.refactored[i] + '%');
      });
      dot.addEventListener('mouseleave', hideTip);
    });

    // Refactored end label
    drawText(svg, xS(2024) + 12, yS(GITCLEAR.refactored[4]) + 4, 'Refactored: ' + GITCLEAR.refactored[4] + '%', 'rw-line-label', 'start', 'var(--rw-positive)');

    // Crossover annotation
    // Lines cross between 2023 and 2024. Interpolate.
    // Copied 2023: 10.8, 2024: 12.3
    // Refactored 2023: 14.0, 2024: 9.5
    // Solve: 10.8 + t*(12.3-10.8) = 14.0 + t*(9.5-14.0)
    // 10.8 + 1.5t = 14.0 - 4.5t  =>  6t = 3.2  =>  t = 0.533
    var crossT = 0.533;
    var crossYear = 2023 + crossT;
    var crossVal = 10.8 + crossT * (12.3 - 10.8);
    var crossX = xS(crossYear);
    var crossY = yS(crossVal);

    // Crossover ring
    createSVGEl('circle', {
      class: 'rw-cross-ring',
      cx: crossX, cy: crossY, r: 14,
      fill: 'none',
      stroke: 'var(--ink-soft)',
      'stroke-width': 1.5,
      'stroke-dasharray': '4,3'
    }, svg);

    // Crossover label
    var crossLbl = drawText(svg, crossX, crossY - 22, '2024: first crossover', 'rw-anno', 'middle', 'var(--ink-soft)');
    crossLbl.setAttribute('font-size', '11');
  }

  // ─────────────────────────────────────────────────────────
  // 10. CHART H: REBUILT DOLLAR
  //     Stacked horizontal bars totaling $1.00
  // ─────────────────────────────────────────────────────────

  function renderDollar() {
    var svg = document.getElementById('rw-dollar');
    if (!svg) return;
    clear(svg);

    var W = 1000, H = 480;
    var pad = { l: 220, r: 40, t: 60, b: 50 };
    var iw = W - pad.l - pad.r;
    var ih = H - pad.t - pad.b;
    var rowH = ih / DOLLAR.length;
    var barH = 50;

    // X: 0 to 1.0
    function xS(v) { return pad.l + v * iw; }

    // Column header
    drawText(svg, pad.l, pad.t - 30, '$0.00', 'rw-axis-label', 'start', 'var(--ink-dim)');
    drawText(svg, pad.l + iw, pad.t - 30, '$1.00', 'rw-axis-label', 'end', 'var(--ink-dim)');
    drawText(svg, pad.l + iw / 2, pad.t - 30, 'Where each dollar goes', 'rw-axis-title', 'middle', 'var(--ink-soft)');

    // Tick marks along top
    var dollarTicks = [0, 0.25, 0.50, 0.75, 1.0];
    dollarTicks.forEach(function (v) {
      var xx = xS(v);
      createSVGEl('line', {
        x1: xx, y1: pad.t - 8,
        x2: xx, y2: pad.t + ih,
        stroke: 'var(--ink-dim)',
        'stroke-width': 0.5,
        'stroke-dasharray': '3,4'
      }, svg);
    });

    // Draw each row
    DOLLAR.forEach(function (row, ri) {
      var cy = pad.t + rowH * ri + rowH / 2;
      var barY = cy - barH / 2;

      // Row label
      var rl = drawText(svg, pad.l - 14, cy + 4, row.label, 'rw-bar-label', 'end', 'var(--ink)');
      rl.setAttribute('font-size', '11');

      // Stacked segments
      var cumulative = 0;
      row.segments.forEach(function (seg) {
        var segX = xS(cumulative);
        var segW = seg.value * iw;

        var rect = createSVGEl('rect', {
          class: 'rw-bar',
          x: segX, y: barY,
          width: segW, height: barH,
          fill: seg.color,
          rx: 0
        }, svg);

        // Label inside segment if wide enough, else above
        var segCenterX = segX + segW / 2;
        var dollarStr = '$' + seg.value.toFixed(2);
        var minWidth = 55;

        if (segW > minWidth) {
          // Name inside
          var nameT = drawText(svg, segCenterX, cy - 2, seg.name, 'rw-seg-name', 'middle', 'var(--paper)');
          nameT.setAttribute('font-size', '9');
          // Value inside below name
          var valT = drawText(svg, segCenterX, cy + 12, dollarStr, 'rw-seg-value', 'middle', 'var(--paper)');
          valT.setAttribute('font-size', '10');
          valT.setAttribute('font-weight', '600');
        } else {
          // Value above the segment
          var aboveT = drawText(svg, segCenterX, barY - 6, dollarStr, 'rw-seg-value', 'middle', 'var(--ink-soft)');
          aboveT.setAttribute('font-size', '9');
        }

        // Tooltip
        (function (segment, rowLabel) {
          rect.addEventListener('mouseenter', function (ev) {
            showTip(ev,
              '<strong>' + rowLabel + '</strong><br>' +
              segment.name + ': $' + segment.value.toFixed(2) +
              ' (' + Math.round(segment.value * 100) + '%)');
          });
          rect.addEventListener('mouseleave', hideTip);
        })(seg, row.label);

        cumulative += seg.value;
      });
    });
  }

  // ─────────────────────────────────────────────────────────
  // 11. CASCADE ANIMATION (IntersectionObserver)
  // ─────────────────────────────────────────────────────────

  function wireAnimations() {
    var wraps = document.querySelectorAll('.rw-chart-wrap');
    if (!wraps.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('rw-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    wraps.forEach(function (wrap) {
      observer.observe(wrap);
    });
  }

  // ─────────────────────────────────────────────────────────
  // 12. BOOT
  // ─────────────────────────────────────────────────────────

  function init() {
    renderBaseline();
    renderMETR();
    renderSWEBench();
    renderFaros();
    renderCodeRabbit();
    renderTrust();
    renderGitClear();
    renderDollar();
    wireAnimations();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
