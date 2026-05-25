/* ═══════════════════════════════════════════════════════════
   PRICE OF INTELLIGENCE LAB
   Five interactive charts comparing the price collapse of
   AI/intelligence against historical commodities.
   No fetch. All data baked below.
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────
  // 1. DATA
  // ─────────────────────────────────────────────────────────

  // 1a. Chart 1: The Long Descent — multi-series commodity price declines
  var COMMODITIES = {
    intelligence: {
      name: 'Intelligence (LLM tokens)',
      color: 'var(--pi-intelligence)',
      takeoffYear: 2021,
      data: [
        {t:0, p:100}, {t:1, p:30}, {t:2, p:5}, {t:3, p:0.1}
      ]
    },
    light: {
      name: 'Light (lumen-hours)',
      color: 'var(--pi-light)',
      takeoffYear: 1800,
      data: [
        {t:0, p:100}, {t:20, p:50}, {t:50, p:20}, {t:79, p:10},
        {t:100, p:3}, {t:130, p:0.5}, {t:160, p:0.1}, {t:200, p:0.033}
      ]
    },
    compute: {
      name: 'Compute (FLOP/$)',
      color: 'var(--pi-compute)',
      takeoffYear: 1940,
      data: [
        {t:0, p:100}, {t:10, p:10}, {t:20, p:1}, {t:30, p:0.1},
        {t:40, p:0.01}, {t:50, p:0.001}, {t:60, p:0.0001},
        {t:70, p:0.00001}, {t:84, p:0.000001}
      ]
    },
    bandwidth: {
      name: 'Bandwidth (per bit)',
      color: 'oklch(0.65 0.10 200)',
      takeoffYear: 1984,
      data: [
        {t:0, p:100}, {t:5, p:30}, {t:10, p:10}, {t:15, p:3},
        {t:20, p:0.5}, {t:25, p:0.1}, {t:30, p:0.01}, {t:39, p:0.001}
      ]
    },
    solar: {
      name: 'Solar PV ($/W)',
      color: 'var(--pi-energy)',
      takeoffYear: 1975,
      data: [
        {t:0, p:100}, {t:10, p:30}, {t:20, p:10}, {t:30, p:3},
        {t:40, p:0.8}, {t:49, p:0.25}
      ]
    },
    sequencing: {
      name: 'DNA sequencing ($/genome)',
      color: 'var(--pi-bio)',
      takeoffYear: 2001,
      data: [
        {t:0, p:100}, {t:3, p:40}, {t:6, p:10}, {t:7, p:0.1},
        {t:10, p:0.02}, {t:15, p:0.005}, {t:23, p:0.0002}
      ]
    },
    storage: {
      name: 'Storage ($/GB)',
      color: 'oklch(0.55 0.06 250)',
      takeoffYear: 1956,
      data: [
        {t:0, p:100}, {t:10, p:10}, {t:20, p:1}, {t:30, p:0.1},
        {t:40, p:0.01}, {t:50, p:0.001}, {t:60, p:0.0001},
        {t:68, p:0.00001}
      ]
    },
    aluminium: {
      name: 'Aluminium ($/tonne)',
      color: 'var(--pi-material)',
      takeoffYear: 1886,
      data: [
        {t:0, p:100}, {t:14, p:10}, {t:30, p:5}, {t:60, p:3},
        {t:100, p:1}, {t:140, p:0.1}
      ]
    }
  };

  // 1b. Chart 2: Elasticity scatter — price drop vs demand growth
  var SCATTER = [
    { name: 'Intelligence',    priceDrop: 1000,     demandGrow: 100,      color: 'var(--pi-intelligence)' },
    { name: 'Light',           priceDrop: 12000,    demandGrow: 25000,    color: 'var(--pi-light)' },
    { name: 'Compute',         priceDrop: 1e12,     demandGrow: 1e10,     color: 'var(--pi-compute)' },
    { name: 'Bandwidth',       priceDrop: 100000,   demandGrow: 56,       color: 'oklch(0.65 0.10 200)' },
    { name: 'Solar PV',        priceDrop: 400,      demandGrow: 800000,   color: 'var(--pi-energy)' },
    { name: 'Sequencing',      priceDrop: 475000,   demandGrow: 1000000,  color: 'var(--pi-bio)' },
    { name: 'Storage',         priceDrop: 3e7,      demandGrow: 1e6,      color: 'oklch(0.55 0.06 250)' },
    { name: 'Aluminium',       priceDrop: 1000,     demandGrow: 350000,   color: 'var(--pi-material)' },
    { name: 'Steel',           priceDrop: 10,       demandGrow: 50,       color: 'var(--pi-material)' },
    { name: 'Oil',             priceDrop: 5,        demandGrow: 100,      color: 'var(--pi-material)' },
    { name: 'Electricity',     priceDrop: 30,       demandGrow: 100,      color: 'var(--pi-energy)' }
  ];

  // 1c. Chart 3: Overlay — three commodities normalized
  var OVERLAY = {
    light: {
      name: 'Light (from 1800)',
      color: 'var(--pi-light)',
      data: [
        {t:0,p:100},{t:10,p:70},{t:20,p:50},{t:40,p:25},{t:60,p:10},
        {t:80,p:3},{t:100,p:1},{t:120,p:0.3},{t:150,p:0.1},{t:200,p:0.033}
      ]
    },
    compute: {
      name: 'Compute (from 1940)',
      color: 'var(--pi-compute)',
      data: [
        {t:0,p:100},{t:5,p:30},{t:10,p:10},{t:15,p:3},{t:20,p:1},
        {t:30,p:0.1},{t:40,p:0.01},{t:50,p:0.001},{t:60,p:0.0001},
        {t:84,p:0.000001}
      ]
    },
    intelligence: {
      name: 'Intelligence (from 2021)',
      color: 'var(--pi-intelligence)',
      data: [
        {t:0,p:100},{t:0.5,p:50},{t:1,p:30},{t:1.5,p:15},{t:2,p:5},
        {t:2.5,p:1},{t:3,p:0.1}
      ]
    }
  };

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

  /** Map a value on a log10 scale to a pixel range */
  function logScale(value, domainMin, domainMax, rangeMin, rangeMax) {
    var logVal = Math.log10(Math.max(value, 1e-20));
    var logMin = Math.log10(Math.max(domainMin, 1e-20));
    var logMax = Math.log10(Math.max(domainMax, 1e-20));
    var t = (logVal - logMin) / (logMax - logMin);
    return rangeMin + t * (rangeMax - rangeMin);
  }

  /** Resolve CSS custom property to a string */
  function resolveColor(colorStr) {
    if (colorStr.indexOf('var(') === 0) {
      var prop = colorStr.replace('var(', '').replace(')', '').trim();
      var val = getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
      return val || colorStr;
    }
    return colorStr;
  }

  // ─────────────────────────────────────────────────────────
  // 2b. SHARED TOOLTIP
  // ─────────────────────────────────────────────────────────

  function showTip(ev, body) {
    var tip = document.getElementById('pi-tooltip');
    if (!tip) return;
    tip.innerHTML = body;
    tip.hidden = false;
    var wrap = tip.parentNode.getBoundingClientRect();
    var x = ev.clientX - wrap.left + 14;
    var y = ev.clientY - wrap.top + 14;
    // Keep tooltip in viewport
    if (x + 200 > wrap.width) x = ev.clientX - wrap.left - 180;
    if (y + 80 > wrap.height) y = ev.clientY - wrap.top - 60;
    tip.style.left = x + 'px';
    tip.style.top  = y + 'px';
  }

  function hideTip() {
    var tip = document.getElementById('pi-tooltip');
    if (tip) tip.hidden = true;
  }

  // ─────────────────────────────────────────────────────────
  // 3. CHART 1: THE LONG DESCENT
  //    Multi-series log-scale line chart
  // ─────────────────────────────────────────────────────────

  // State: which commodities are visible
  var DESCENT_STATE = {
    active: {
      intelligence: true, light: true, compute: true, bandwidth: true,
      solar: true, sequencing: true, storage: true, aluminium: true
    }
  };

  function renderDescent() {
    var svg = document.getElementById('pi-descent');
    if (!svg) return;
    clear(svg);

    var W = 1100, H = 520;
    var pad = { l: 80, r: 30, t: 30, b: 56 };
    var iw = W - pad.l - pad.r;
    var ih = H - pad.t - pad.b;

    // X domain: 0 to 200 years
    var xMin = 0, xMax = 200;
    // Y domain: log scale, 100 down to 1e-6
    var yDomainMax = 100;
    var yDomainMin = 1e-6;

    function xS(t) { return pad.l + (t / xMax) * iw; }
    function yS(p) {
      return logScale(p, yDomainMax, yDomainMin, pad.t, pad.t + ih);
    }

    // Axes
    drawLine(svg, pad.l, pad.t + ih, pad.l + iw, pad.t + ih, 'pi-axis', 'var(--ink)');
    drawLine(svg, pad.l, pad.t, pad.l, pad.t + ih, 'pi-axis', 'var(--ink)');

    // Y-axis gridlines and labels (log scale)
    var yTicks = [100, 10, 1, 0.1, 0.01, 0.001, 0.0001, 0.00001, 0.000001];
    yTicks.forEach(function (v) {
      var ys = yS(v);
      drawLine(svg, pad.l, ys, pad.l + iw, ys, 'pi-grid', 'var(--ink-dim)');
      var label;
      if (v >= 1) label = String(v);
      else if (v >= 0.1) label = '0.1';
      else if (v >= 0.01) label = '0.01';
      else if (v >= 0.001) label = '10⁻³';
      else if (v >= 0.0001) label = '10⁻⁴';
      else if (v >= 0.00001) label = '10⁻⁵';
      else label = '10⁻⁶';
      drawText(svg, pad.l - 10, ys + 4, label, 'pi-axis-label', 'end', 'var(--ink-dim)');
    });

    // X-axis gridlines and labels
    var xTicks = [0, 25, 50, 75, 100, 125, 150, 175, 200];
    xTicks.forEach(function (t) {
      var xx = xS(t);
      drawLine(svg, xx, pad.t, xx, pad.t + ih, 'pi-grid', 'var(--ink-dim)');
      drawText(svg, xx, pad.t + ih + 20, String(t), 'pi-axis-label', 'middle', 'var(--ink-dim)');
    });

    // Axis titles
    drawText(svg, pad.l + iw / 2, pad.t + ih + 46, 'Years since takeoff', 'pi-axis-title', 'middle', 'var(--ink-soft)');
    var yTitle = createSVGEl('text', {
      class: 'pi-axis-title',
      x: 18, y: pad.t + ih / 2,
      'text-anchor': 'middle',
      fill: 'var(--ink-soft)',
      'font-family': '"DM Mono", ui-monospace, monospace',
      'font-size': '11',
      transform: 'rotate(-90, 18, ' + (pad.t + ih / 2) + ')'
    }, svg);
    yTitle.textContent = 'Price index (log, 100 = takeoff)';

    // Draw each active commodity
    var commodityKeys = Object.keys(COMMODITIES);
    // Draw intelligence last so it appears on top
    var drawOrder = commodityKeys.filter(function (k) { return k !== 'intelligence'; });
    drawOrder.push('intelligence');

    drawOrder.forEach(function (key) {
      if (!DESCENT_STATE.active[key]) return;
      var commodity = COMMODITIES[key];
      var color = commodity.color;
      var isIntel = key === 'intelligence';
      var sw = isIntel ? 3 : 1.8;

      // Build polyline points
      var points = '';
      commodity.data.forEach(function (d, i) {
        var x = xS(d.t);
        var y = yS(d.p);
        points += (i === 0 ? '' : ' ') + x + ',' + y;
      });

      createSVGEl('polyline', {
        class: 'pi-line' + (isIntel ? ' pi-line-intel' : ''),
        points: points,
        fill: 'none',
        stroke: color,
        'stroke-width': sw,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      }, svg);

      // Dots at each data point
      commodity.data.forEach(function (d) {
        var cx = xS(d.t);
        var cy = yS(d.p);
        var dot = createSVGEl('circle', {
          class: 'pi-dot',
          cx: cx, cy: cy,
          r: isIntel ? 4.5 : 3,
          fill: color,
          stroke: 'var(--paper)',
          'stroke-width': 1.5
        }, svg);

        dot.addEventListener('mouseenter', function (ev) {
          var pStr = d.p >= 1 ? d.p.toFixed(0) : d.p < 0.001 ? d.p.toExponential(1) : d.p.toFixed(3);
          showTip(ev,
            '<strong>' + commodity.name + '</strong><br>' +
            'Year ' + d.t + ' (since ' + commodity.takeoffYear + ')<br>' +
            'Price index: ' + pStr);
        });
        dot.addEventListener('mouseleave', hideTip);
      });

      // Label at last data point
      var last = commodity.data[commodity.data.length - 1];
      var lx = xS(last.t);
      var ly = yS(last.p);
      var labelAnchor = last.t > 150 ? 'end' : 'start';
      var labelDx = last.t > 150 ? -8 : 8;
      drawText(svg, lx + labelDx, ly + 4, commodity.name.split(' (')[0], 'pi-series-label', labelAnchor, 'var(--ink)')
        .setAttribute('fill', color);
    });
  }

  function wireDescent() {
    document.querySelectorAll('.pi-pill[data-commodity]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-commodity');
        var on = !DESCENT_STATE.active[key];
        DESCENT_STATE.active[key] = on;
        btn.classList.toggle('active', on);
        renderDescent();
      });
    });
  }

  // ─────────────────────────────────────────────────────────
  // 4. CHART 2: THE ELASTICITY SCATTER
  //    Log-log scatter of price drop vs demand growth
  // ─────────────────────────────────────────────────────────

  function renderScatter() {
    var svg = document.getElementById('pi-scatter');
    if (!svg) return;
    clear(svg);

    var W = 900, H = 600;
    var pad = { l: 72, r: 30, t: 30, b: 60 };
    var iw = W - pad.l - pad.r;
    var ih = H - pad.t - pad.b;

    // X domain: price decline multiple, log10(1) to log10(1e12) => 0..12
    var xLogMin = 0, xLogMax = 12;
    // Y domain: demand growth multiple, log10(1) to log10(1e7) => 0..7
    var yLogMin = 0, yLogMax = 7;

    function xS(priceDrop) {
      var lv = Math.log10(Math.max(priceDrop, 1));
      return pad.l + (lv / xLogMax) * iw;
    }
    function yS(demandGrow) {
      var lv = Math.log10(Math.max(demandGrow, 1));
      return pad.t + ih - (lv / yLogMax) * ih;
    }

    // Axes
    drawLine(svg, pad.l, pad.t + ih, pad.l + iw, pad.t + ih, 'pi-axis', 'var(--ink)');
    drawLine(svg, pad.l, pad.t, pad.l, pad.t + ih, 'pi-axis', 'var(--ink)');

    // X-axis gridlines and labels
    for (var xp = 0; xp <= 12; xp += 2) {
      var xx = pad.l + (xp / xLogMax) * iw;
      drawLine(svg, xx, pad.t, xx, pad.t + ih, 'pi-grid', 'var(--ink-dim)');
      var xLabel = xp === 0 ? '1' : '10^' + xp;
      drawText(svg, xx, pad.t + ih + 20, xLabel, 'pi-axis-label', 'middle', 'var(--ink-dim)');
    }

    // Y-axis gridlines and labels
    for (var yp = 0; yp <= 7; yp += 1) {
      var yy = pad.t + ih - (yp / yLogMax) * ih;
      drawLine(svg, pad.l, yy, pad.l + iw, yy, 'pi-grid', 'var(--ink-dim)');
      var yLabel = yp === 0 ? '1' : '10^' + yp;
      drawText(svg, pad.l - 10, yy + 4, yLabel, 'pi-axis-label', 'end', 'var(--ink-dim)');
    }

    // Axis titles
    drawText(svg, pad.l + iw / 2, pad.t + ih + 48, 'Price decline multiple (log)', 'pi-axis-title', 'middle', 'var(--ink-soft)');
    var yTitle = createSVGEl('text', {
      class: 'pi-axis-title',
      x: 18, y: pad.t + ih / 2,
      'text-anchor': 'middle',
      fill: 'var(--ink-soft)',
      'font-family': '"DM Mono", ui-monospace, monospace',
      'font-size': '11',
      transform: 'rotate(-90, 18, ' + (pad.t + ih / 2) + ')'
    }, svg);
    yTitle.textContent = 'Demand growth multiple (log)';

    // 45-degree diagonal line: unit elasticity
    var diagPoints = [];
    for (var dv = 0; dv <= Math.min(xLogMax, yLogMax); dv += 0.5) {
      var dx = pad.l + (dv / xLogMax) * iw;
      var dy = pad.t + ih - (dv / yLogMax) * ih;
      diagPoints.push(dx + ',' + dy);
    }
    createSVGEl('polyline', {
      class: 'pi-diag',
      points: diagPoints.join(' '),
      fill: 'none',
      stroke: 'var(--ink-dim)',
      'stroke-width': 1,
      'stroke-dasharray': '6,4'
    }, svg);

    // Label the diagonal
    var diagLabelX = pad.l + (5 / xLogMax) * iw;
    var diagLabelY = pad.t + ih - (5 / yLogMax) * ih;
    drawText(svg, diagLabelX + 8, diagLabelY - 8, 'Unit elasticity', 'pi-diag-label', 'start', 'var(--ink-dim)');

    // Zone labels
    var jevonsX = pad.l + (2 / xLogMax) * iw;
    var jevonsY = pad.t + ih - (4.5 / yLogMax) * ih;
    drawText(svg, jevonsX, jevonsY, 'Jevons zone', 'pi-zone-label', 'start', 'var(--ink-soft)');
    drawText(svg, jevonsX, jevonsY + 16, '(demand outpaced price drop)', 'pi-zone-sub', 'start', 'var(--ink-dim)');

    var normalX = pad.l + (6 / xLogMax) * iw;
    var normalY = pad.t + ih - (1.5 / yLogMax) * ih;
    drawText(svg, normalX, normalY, 'Normal zone', 'pi-zone-label', 'start', 'var(--ink-soft)');

    // Draw scatter dots
    SCATTER.forEach(function (d) {
      var cx = xS(d.priceDrop);
      var cy = yS(d.demandGrow);
      var isIntel = d.name === 'Intelligence';
      var r = isIntel ? 12 : 8;

      // Highlight ring for intelligence
      if (isIntel) {
        createSVGEl('circle', {
          class: 'pi-scatter-ring',
          cx: cx, cy: cy, r: 18,
          fill: 'none',
          stroke: d.color,
          'stroke-width': 1.5,
          opacity: 0.4
        }, svg);
      }

      var dot = createSVGEl('circle', {
        class: 'pi-scatter-dot' + (isIntel ? ' pi-scatter-intel' : ''),
        cx: cx, cy: cy, r: r,
        fill: d.color,
        stroke: 'var(--paper)',
        'stroke-width': 2
      }, svg);

      // Label next to dot
      var labelDx = isIntel ? 16 : 12;
      var labelDy = isIntel ? -4 : -2;
      if (d.name === 'Steel' || d.name === 'Oil') labelDy = 14;
      if (d.name === 'Electricity') labelDy = -14;
      drawText(svg, cx + labelDx, cy + labelDy, d.name, 'pi-scatter-label', 'start', 'var(--ink)');

      // Hover
      dot.addEventListener('mouseenter', function (ev) {
        var pStr = d.priceDrop >= 1e6 ? d.priceDrop.toExponential(0) : d.priceDrop.toLocaleString();
        var dStr = d.demandGrow >= 1e6 ? d.demandGrow.toExponential(0) : d.demandGrow.toLocaleString();
        showTip(ev,
          '<strong>' + d.name + '</strong><br>' +
          'Price drop: ' + pStr + 'x<br>' +
          'Demand growth: ' + dStr + 'x');
      });
      dot.addEventListener('mouseleave', hideTip);
    });
  }

  // ─────────────────────────────────────────────────────────
  // 5. CHART 3: INTELLIGENCE OVERLAID
  //    Three curves normalized to year 0
  // ─────────────────────────────────────────────────────────

  var OVERLAY_STATE = { view: 'zoom' }; // 'zoom' (first 20yr) or 'full' (200yr)

  function renderOverlay() {
    var svg = document.getElementById('pi-overlay');
    if (!svg) return;
    clear(svg);

    var W = 1100, H = 480;
    var pad = { l: 80, r: 30, t: 30, b: 56 };
    var iw = W - pad.l - pad.r;
    var ih = H - pad.t - pad.b;

    var isZoom = OVERLAY_STATE.view === 'zoom';
    var xMax = isZoom ? 20 : 200;

    // Y domain: 100 down to 1e-6
    var yDomainMax = 100;
    var yDomainMin = 1e-6;

    function xS(t) { return pad.l + (t / xMax) * iw; }
    function yS(p) {
      return logScale(p, yDomainMax, yDomainMin, pad.t, pad.t + ih);
    }

    // Axes
    drawLine(svg, pad.l, pad.t + ih, pad.l + iw, pad.t + ih, 'pi-axis', 'var(--ink)');
    drawLine(svg, pad.l, pad.t, pad.l, pad.t + ih, 'pi-axis', 'var(--ink)');

    // Y gridlines
    var yTicks = [100, 10, 1, 0.1, 0.01, 0.001, 0.0001, 0.00001, 0.000001];
    yTicks.forEach(function (v) {
      var ys = yS(v);
      drawLine(svg, pad.l, ys, pad.l + iw, ys, 'pi-grid', 'var(--ink-dim)');
      var label;
      if (v >= 1) label = String(v);
      else if (v >= 0.1) label = '0.1';
      else if (v >= 0.01) label = '0.01';
      else if (v >= 0.001) label = '10⁻³';
      else if (v >= 0.0001) label = '10⁻⁴';
      else if (v >= 0.00001) label = '10⁻⁵';
      else label = '10⁻⁶';
      drawText(svg, pad.l - 10, ys + 4, label, 'pi-axis-label', 'end', 'var(--ink-dim)');
    });

    // X gridlines
    var xStep = isZoom ? 2 : 25;
    for (var t = 0; t <= xMax; t += xStep) {
      var xx = xS(t);
      drawLine(svg, xx, pad.t, xx, pad.t + ih, 'pi-grid', 'var(--ink-dim)');
      drawText(svg, xx, pad.t + ih + 20, String(t), 'pi-axis-label', 'middle', 'var(--ink-dim)');
    }

    // Axis titles
    drawText(svg, pad.l + iw / 2, pad.t + ih + 46, 'Years since takeoff', 'pi-axis-title', 'middle', 'var(--ink-soft)');
    var yTitle = createSVGEl('text', {
      class: 'pi-axis-title',
      x: 18, y: pad.t + ih / 2,
      'text-anchor': 'middle',
      fill: 'var(--ink-soft)',
      'font-family': '"DM Mono", ui-monospace, monospace',
      'font-size': '11',
      transform: 'rotate(-90, 18, ' + (pad.t + ih / 2) + ')'
    }, svg);
    yTitle.textContent = 'Price index (log)';

    // Draw the three series
    var seriesKeys = ['light', 'compute', 'intelligence'];
    seriesKeys.forEach(function (key) {
      var series = OVERLAY[key];
      var color = series.color;
      var isIntel = key === 'intelligence';
      var sw = isIntel ? 3 : 1.8;

      // Filter data to visible x range
      var visible = series.data.filter(function (d) { return d.t <= xMax; });
      if (visible.length === 0) return;

      var points = '';
      visible.forEach(function (d, i) {
        var x = xS(d.t);
        var y = yS(d.p);
        points += (i === 0 ? '' : ' ') + x + ',' + y;
      });

      createSVGEl('polyline', {
        class: 'pi-line' + (isIntel ? ' pi-line-intel' : ''),
        points: points,
        fill: 'none',
        stroke: color,
        'stroke-width': sw,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      }, svg);

      // Dots
      visible.forEach(function (d) {
        var cx = xS(d.t);
        var cy = yS(d.p);
        var dot = createSVGEl('circle', {
          class: 'pi-dot',
          cx: cx, cy: cy,
          r: isIntel ? 4 : 3,
          fill: color,
          stroke: 'var(--paper)',
          'stroke-width': 1.5
        }, svg);
        dot.addEventListener('mouseenter', function (ev) {
          var pStr = d.p >= 1 ? d.p.toFixed(0) : d.p < 0.001 ? d.p.toExponential(1) : d.p.toFixed(3);
          showTip(ev,
            '<strong>' + series.name + '</strong><br>' +
            'Year ' + d.t + '<br>' +
            'Price index: ' + pStr);
        });
        dot.addEventListener('mouseleave', hideTip);
      });

      // Series label at last visible point
      var last = visible[visible.length - 1];
      var lx = xS(last.t);
      var ly = yS(last.p);
      var anchor = last.t > xMax * 0.75 ? 'end' : 'start';
      var dx = anchor === 'end' ? -8 : 8;
      var label = drawText(svg, lx + dx, ly - 8, series.name, 'pi-series-label', anchor, 'var(--ink)');
      label.setAttribute('fill', color);
    });

    // Annotation: equivalence markers (only in zoom view)
    if (isZoom) {
      // Intelligence at year 3 ~ 0.1
      // Compute at year 15 ~ 3  (close-ish in log space)
      // We draw a horizontal dashed annotation connecting relevant points
      var annoY = yS(0.1);
      var annoX1 = xS(3);
      var annoX2 = xS(15);

      // Annotation line
      createSVGEl('line', {
        class: 'pi-anno-line',
        x1: annoX1, y1: annoY,
        x2: annoX2, y2: annoY,
        stroke: 'var(--ink-dim)',
        'stroke-width': 1,
        'stroke-dasharray': '4,3'
      }, svg);

      // Annotation text
      var annoText = drawText(svg, (annoX1 + annoX2) / 2, annoY - 10,
        'Intelligence yr 3 ≈ compute yr 15 ≈ light yr 80',
        'pi-anno-text', 'middle');
      annoText.setAttribute('fill', 'var(--ink-soft)');
    }
  }

  function wireOverlay() {
    document.querySelectorAll('.pi-pill[data-overlay]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.pi-pill[data-overlay]').forEach(function (x) {
          x.classList.remove('active');
        });
        btn.classList.add('active');
        OVERLAY_STATE.view = btn.getAttribute('data-overlay');
        renderOverlay();
      });
    });
  }

  // ─────────────────────────────────────────────────────────
  // 6. CHART 4: WHAT BINDS NEXT (CASCADE)
  //    Not an SVG chart. JS triggers CSS animation on scroll.
  // ─────────────────────────────────────────────────────────

  function wireCascade() {
    var cascade = document.getElementById('pi-cascade');
    if (!cascade) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          cascade.classList.add('pi-cascade-visible');
          observer.unobserve(cascade);
        }
      });
    }, { threshold: 0.15 });

    observer.observe(cascade);
  }

  // ─────────────────────────────────────────────────────────
  // 7. BOOT
  // ─────────────────────────────────────────────────────────

  function init() {
    renderDescent();   wireDescent();
    renderScatter();
    renderOverlay();   wireOverlay();
    wireCascade();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
