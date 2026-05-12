/* ═══════════════════════════════════════════════════════════
   BUBBLE WATCH — S17
   Six SVG charts arguing the AI bubble question.
   Snapshot vintage: May 12, 2026.
   No fetch. All data baked below.
   Sources cited in /work/bubble-watch-lab/index.html methodology.
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────
  // 1. DATA
  // ─────────────────────────────────────────────────────────

  // 1a. Shiller CAPE, annual end-of-year values, 1881 to 2026.
  //     Source: Robert Shiller's online series, smoothed to annual.
  //     Long-run median ~16.05. Notable peaks: 1929 (32.6),
  //     1999 (44.2), 2007 (27.5), 2021 (38.6), 2026 (~42).
  var CAPE = [
    {y:1881,v:18.5},{y:1885,v:14.5},{y:1890,v:18.3},{y:1895,v:16.4},
    {y:1900,v:18.4},{y:1905,v:17.8},{y:1910,v:14.9},{y:1915,v:11.5},
    {y:1920,v: 7.4},{y:1925,v:16.0},{y:1928,v:23.9},{y:1929,v:32.6},
    {y:1930,v:22.0},{y:1932,v: 8.5},{y:1934,v:12.6},{y:1936,v:21.0},
    {y:1937,v:14.4},{y:1940,v:14.3},{y:1942,v: 8.5},{y:1945,v:13.3},
    {y:1948,v:10.8},{y:1950,v:10.7},{y:1955,v:18.6},{y:1960,v:18.3},
    {y:1965,v:23.3},{y:1968,v:21.5},{y:1970,v:16.5},{y:1972,v:18.6},
    {y:1973,v:18.7},{y:1974,v: 8.9},{y:1976,v:11.3},{y:1978,v: 9.3},
    {y:1980,v: 8.9},{y:1982,v: 7.4},{y:1985,v:10.3},{y:1987,v:17.7},
    {y:1989,v:18.3},{y:1990,v:17.0},{y:1992,v:20.3},{y:1994,v:20.2},
    {y:1995,v:24.6},{y:1996,v:27.7},{y:1997,v:32.9},{y:1998,v:40.6},
    {y:1999,v:44.2},{y:2000,v:43.8},{y:2001,v:31.9},{y:2002,v:22.1},
    {y:2003,v:25.7},{y:2004,v:27.3},{y:2005,v:26.6},{y:2006,v:27.0},
    {y:2007,v:27.5},{y:2008,v:15.2},{y:2009,v:20.3},{y:2010,v:22.4},
    {y:2011,v:21.2},{y:2012,v:22.0},{y:2013,v:25.4},{y:2014,v:27.0},
    {y:2015,v:26.0},{y:2016,v:28.0},{y:2017,v:32.5},{y:2018,v:28.4},
    {y:2019,v:30.3},{y:2020,v:33.7},{y:2021,v:38.6},{y:2022,v:28.1},
    {y:2023,v:31.0},{y:2024,v:35.4},{y:2025,v:39.2},{y:2026,v:42.0}
  ];
  var CAPE_MEDIAN = 16.05;
  var CAPE_MARKERS = {
    '1929': { y: 1929, v: 32.6, label: '1929 peak' },
    '1999': { y: 1999, v: 44.2, label: '1999 peak (record)' },
    '2007': { y: 2007, v: 27.5, label: '2007 peak' },
    '2021': { y: 2021, v: 38.6, label: '2021 peak' },
    '2026': { y: 2026, v: 42.0, label: '2026 (May)' }
  };

  // 1b. Top-10 S&P 500 concentration as a share of market cap.
  //     Annual, 1980 to 2026. Sources: Slickcharts, Citi Global
  //     Insights, Schwab research, MSCI USA factsheets.
  var CONC = [
    {y:1980,v:22.0},{y:1982,v:24.0},{y:1985,v:22.0},{y:1988,v:21.0},
    {y:1990,v:20.0},{y:1992,v:21.0},{y:1994,v:20.5},{y:1996,v:21.0},
    {y:1998,v:22.5},{y:2000,v:25.6},{y:2002,v:22.0},{y:2004,v:19.8},
    {y:2006,v:19.5},{y:2008,v:20.0},{y:2010,v:18.5},{y:2012,v:18.0},
    {y:2014,v:17.5},{y:2016,v:18.0},{y:2018,v:19.5},{y:2020,v:27.0},
    {y:2021,v:28.5},{y:2022,v:26.0},{y:2023,v:31.5},{y:2024,v:36.0},
    {y:2025,v:38.5},{y:2026,v:38.5}
  ];
  // Per-company Mag 7 share of S&P 500 (May 2026).
  var MAG7 = [
    { name: 'NVIDIA',    share: 7.0 },
    { name: 'Apple',     share: 6.4 },
    { name: 'Microsoft', share: 6.0 },
    { name: 'Alphabet',  share: 5.6 },
    { name: 'Amazon',    share: 4.1 },
    { name: 'Meta',      share: 3.0 },
    { name: 'Tesla',     share: 2.6 }
  ];

  // 1c. Hyperscaler capex vs frontier-lab ARR (and AI vendor rev).
  //     Source: company filings, CreditSights, Statista, Sacra,
  //     Stanford HAI, Anthropic and OpenAI public disclosures.
  //     2024 actual, 2025 actual, 2026E.
  var GAP = [
    {
      year: 2024,
      capex: 256,
      frontier: 5,    // OpenAI ~3.7B + Anthropic ~1B end-of-year
      vendor: 235     // broader AI vendor revenue
    },
    {
      year: 2025,
      capex: 410,
      frontier: 14,   // OpenAI ~10B + Anthropic ~4B run-rate avg
      vendor: 360
    },
    {
      year: 2026,
      capex: 725,
      frontier: 54,   // OpenAI $24B + Anthropic $30B current ARR
      vendor: 514     // Grand View / Precedence aggregate
    }
  ];

  // 1d. FINRA margin debt as a percent of GDP. Annual,
  //     1997 to 2026. Source: FINRA margin statistics + BEA GDP.
  var MARGIN = [
    {y:1997,v:1.5},{y:1998,v:1.7},{y:1999,v:2.4},{y:2000,v:2.6},
    {y:2001,v:1.5},{y:2002,v:1.4},{y:2003,v:1.6},{y:2004,v:1.7},
    {y:2005,v:1.9},{y:2006,v:2.2},{y:2007,v:2.5},{y:2008,v:1.7},
    {y:2009,v:1.7},{y:2010,v:2.0},{y:2011,v:2.2},{y:2012,v:2.4},
    {y:2013,v:2.7},{y:2014,v:2.9},{y:2015,v:2.6},{y:2016,v:2.6},
    {y:2017,v:3.0},{y:2018,v:2.9},{y:2019,v:2.9},{y:2020,v:3.4},
    {y:2021,v:3.97},{y:2022,v:2.8},{y:2023,v:2.8},{y:2024,v:3.1},
    {y:2025,v:3.7},{y:2026,v:3.83}
  ];
  var MARGIN_MARKERS = {
    '2000': { y: 2000, v: 2.6,  label: '2000 peak' },
    '2007': { y: 2007, v: 2.5,  label: '2007 peak' },
    '2021': { y: 2021, v: 3.97, label: '2021 record' },
    '2026': { y: 2026, v: 3.83, label: '2026 (Mar)' }
  };

  // 1e. METR time-horizon, log scale. Hours of autonomous task
  //     work the frontier model can complete at the 50% success
  //     rate. Source: metr.org.
  var METR = [
    {y:2019,    h:0.0014},  // 5 seconds
    {y:2020,    h:0.0042},  // 15 sec
    {y:2021,    h:0.014},   // 50 sec
    {y:2022,    h:0.05},    // 3 min
    {y:2023,    h:0.25},    // 15 min
    {y:2023.6,  h:0.6},     // 36 min (GPT-4)
    {y:2024.2,  h:1.2},     // o1
    {y:2024.7,  h:2.5},     // Claude 3.5 Sonnet
    {y:2025.0,  h:5.0},     // Claude 3.7 Sonnet "1 hour" -> rescaled
    {y:2025.3,  h:8.0},     // Claude 4 Sonnet
    {y:2025.6,  h:12.0},
    {y:2025.9,  h:14.0},
    {y:2026.4,  h:16.0}     // Claude Mythos
  ];

  // 1f. Bubble lineup. Rows are indicators. Columns are 1929,
  //     2000, 2007, 2021, 2026. Severity: 0 not extreme,
  //     1 elevated, 2 extreme, 3 record-setting.
  // Order: historical importance first (default).
  var LINEUP = [
    { ind: 'Shiller CAPE',
      sub: 'Long-run median 16',
      cells: [
        { v: '32.6',  s: 2, peak: 1929 },
        { v: '44.2',  s: 3, peak: 2000 },
        { v: '27.5',  s: 2, peak: 2007 },
        { v: '38.6',  s: 2, peak: 2021 },
        { v: '42.0',  s: 3, peak: 2026, now: true }
      ]
    },
    { ind: 'Buffett indicator',
      sub: 'Market cap / GDP',
      cells: [
        { v: 'n/a',   s: 0, peak: 1929 },
        { v: '146%',  s: 2, peak: 2000 },
        { v: '109%',  s: 1, peak: 2007 },
        { v: '200%',  s: 3, peak: 2021 },
        { v: '232%',  s: 3, peak: 2026, now: true }
      ]
    },
    { ind: 'Top 10 S&P share',
      sub: 'Index concentration',
      cells: [
        { v: 'n/a',   s: 0, peak: 1929 },
        { v: '25%',   s: 2, peak: 2000 },
        { v: '20%',   s: 1, peak: 2007 },
        { v: '28%',   s: 2, peak: 2021 },
        { v: '38%',   s: 3, peak: 2026, now: true }
      ]
    },
    { ind: 'Forward P/E, market',
      sub: 'S&P 500',
      cells: [
        { v: 'n/a',   s: 0, peak: 1929 },
        { v: '25',    s: 2, peak: 2000 },
        { v: '15',    s: 0, peak: 2007 },
        { v: '21',    s: 2, peak: 2021 },
        { v: '21',    s: 2, peak: 2026, now: true }
      ]
    },
    { ind: 'Forward P/E, tech',
      sub: 'IT sector',
      cells: [
        { v: 'n/a',   s: 0, peak: 1929 },
        { v: '70+',   s: 3, peak: 2000 },
        { v: '17',    s: 0, peak: 2007 },
        { v: '28',    s: 2, peak: 2021 },
        { v: '24',    s: 1, peak: 2026, now: true }
      ]
    },
    { ind: 'Margin debt / GDP',
      sub: 'FINRA leverage',
      cells: [
        { v: 'high',  s: 2, peak: 1929 },
        { v: '2.6%',  s: 2, peak: 2000 },
        { v: '2.5%',  s: 2, peak: 2007 },
        { v: '3.97%', s: 3, peak: 2021 },
        { v: '3.83%', s: 3, peak: 2026, now: true }
      ]
    },
    { ind: 'Top leaders profitable',
      sub: 'Real cash flow',
      cells: [
        { v: 'mixed', s: 1, peak: 1929 },
        { v: 'no',    s: 0, peak: 2000 },
        { v: 'yes',   s: 0, peak: 2007 },
        { v: 'yes',   s: 0, peak: 2021 },
        { v: 'yes',   s: 0, peak: 2026, now: true }
      ]
    },
    { ind: '10Y Treasury yield',
      sub: 'Discount rate',
      cells: [
        { v: '3.7%',  s: 1, peak: 1929 },
        { v: '6.0%',  s: 2, peak: 2000 },
        { v: '4.7%',  s: 1, peak: 2007 },
        { v: '1.5%',  s: 0, peak: 2021 },
        { v: '4.2%',  s: 1, peak: 2026, now: true }
      ]
    }
  ];

  // ─────────────────────────────────────────────────────────
  // 2. UTILITIES
  // ─────────────────────────────────────────────────────────

  var SVG_NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    var node = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    }
    if (parent) parent.appendChild(node);
    return node;
  }
  function html(tag, attrs, parent) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    if (parent) parent.appendChild(node);
    return node;
  }
  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function fmtBN(n) { return '$' + n.toFixed(0) + 'B'; }

  function showTip(which, ev, body) {
    var tip = document.getElementById('bw-tooltip-' + which);
    if (!tip) return;
    tip.innerHTML = body;
    tip.hidden = false;
    var wrap = tip.parentNode.getBoundingClientRect();
    var x = ev.clientX - wrap.left + 12;
    var y = ev.clientY - wrap.top + 12;
    tip.style.left = x + 'px';
    tip.style.top  = y + 'px';
  }
  function hideTip(which) {
    var tip = document.getElementById('bw-tooltip-' + which);
    if (tip) tip.hidden = true;
  }

  // ─────────────────────────────────────────────────────────
  // 3. CAPE CHART (S17.1)
  // ─────────────────────────────────────────────────────────

  var CAPE_STATE = {
    markers: { '1929': true, '1999': true, '2007': true, '2021': true, '2026': true },
    refs:    { 'median': true, '2x': false }
  };

  function renderCAPE() {
    var svg = document.getElementById('bw-cape');
    if (!svg) return;
    clear(svg);

    var W = 1100, H = 480;
    var pad = { l: 56, r: 28, t: 30, b: 50 };
    var iw = W - pad.l - pad.r;
    var ih = H - pad.t - pad.b;

    var xMin = 1881, xMax = 2026;
    var yMin = 0, yMax = 50;
    function xS(y) { return pad.l + ((y - xMin) / (xMax - xMin)) * iw; }
    function yS(v) { return pad.t + (1 - v / yMax) * ih; }

    // Axes + grid
    el('line', { class: 'bw-axis', x1: pad.l, y1: pad.t + ih, x2: pad.l + iw, y2: pad.t + ih }, svg);
    el('line', { class: 'bw-axis', x1: pad.l, y1: pad.t, x2: pad.l, y2: pad.t + ih }, svg);

    for (var v = 10; v <= 50; v += 10) {
      var ys = yS(v);
      el('line', { class: 'bw-grid', x1: pad.l, y1: ys, x2: pad.l + iw, y2: ys }, svg);
      var tl = el('text', { class: 'bw-axis-label', x: pad.l - 8, y: ys + 3, 'text-anchor': 'end' }, svg);
      tl.textContent = String(v);
    }
    for (var year = 1900; year <= 2020; year += 20) {
      var xx = xS(year);
      el('line', { class: 'bw-grid', x1: xx, y1: pad.t, x2: xx, y2: pad.t + ih }, svg);
      var xl = el('text', { class: 'bw-axis-label', x: xx, y: pad.t + ih + 18, 'text-anchor': 'middle' }, svg);
      xl.textContent = String(year);
    }

    // Reference lines
    if (CAPE_STATE.refs.median) {
      var my = yS(CAPE_MEDIAN);
      el('line', { class: 'bw-ref-line', x1: pad.l, y1: my, x2: pad.l + iw, y2: my }, svg);
      var ml = el('text', { class: 'bw-ref-label', x: pad.l + iw - 8, y: my - 4, 'text-anchor': 'end' }, svg);
      ml.textContent = 'long-run median ~16';
    }
    if (CAPE_STATE.refs['2x']) {
      var ty = yS(CAPE_MEDIAN * 2);
      el('line', { class: 'bw-ref-line', x1: pad.l, y1: ty, x2: pad.l + iw, y2: ty }, svg);
      var tlb = el('text', { class: 'bw-ref-label', x: pad.l + iw - 8, y: ty - 4, 'text-anchor': 'end' }, svg);
      tlb.textContent = '2x median ~32';
    }

    // Series path
    var d = '';
    CAPE.forEach(function (p, i) {
      d += (i === 0 ? 'M' : ' L') + xS(p.y) + ' ' + yS(p.v);
    });
    el('path', { class: 'bw-series bw-series-bear', d: d }, svg);

    // Marker points
    Object.keys(CAPE_STATE.markers).forEach(function (k) {
      if (!CAPE_STATE.markers[k]) return;
      var m = CAPE_MARKERS[k];
      if (!m) return;
      var mx = xS(m.y), myy = yS(m.v);
      el('line', { class: 'bw-marker-line', x1: mx, y1: yS(0), x2: mx, y2: myy, stroke: 'var(--ink-dim)' }, svg);
      var c = el('circle', {
        class: 'bw-marker', cx: mx, cy: myy, r: 5,
        stroke: 'var(--accent)'
      }, svg);
      c.addEventListener('mouseenter', function (ev) {
        showTip('cape', ev,
          '<strong>' + m.v.toFixed(1) + '</strong><br>' + m.label);
      });
      c.addEventListener('mouseleave', function () { hideTip('cape'); });
      // label above
      var lblY = myy - 14;
      var labelXOff = (k === '1999' || k === '2026') ? 6 : -6;
      var anchor = (k === '1999' || k === '2026') ? 'start' : 'end';
      var ll = el('text', {
        class: 'bw-marker-label',
        x: mx + labelXOff, y: lblY, 'text-anchor': anchor
      }, svg);
      ll.textContent = m.label;
    });

    // Invisible hover area for series
    var hov = el('rect', {
      x: pad.l, y: pad.t, width: iw, height: ih,
      fill: 'transparent'
    }, svg);
    hov.addEventListener('mousemove', function (ev) {
      var wrap = svg.parentNode.getBoundingClientRect();
      var rect = svg.getBoundingClientRect();
      // map clientX -> data year
      var px = ev.clientX - rect.left;
      var scale = rect.width / W;
      var dataX = (px / scale - pad.l) / iw;
      var year = Math.round(xMin + dataX * (xMax - xMin));
      // find nearest data point
      var nearest = CAPE[0];
      var bestDist = Infinity;
      CAPE.forEach(function (p) {
        var dd = Math.abs(p.y - year);
        if (dd < bestDist) { bestDist = dd; nearest = p; }
      });
      showTip('cape', ev,
        '<strong>' + nearest.v.toFixed(1) + '</strong> <span class="bw-tooltip-dim">CAPE</span><br>' +
        nearest.y);
    });
    hov.addEventListener('mouseleave', function () { hideTip('cape'); });
  }

  function wireCAPE() {
    document.querySelectorAll('.bw-pill[data-cape-marker]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-cape-marker');
        var on = !(CAPE_STATE.markers[k]);
        CAPE_STATE.markers[k] = on;
        b.classList.toggle('active', on);
        b.setAttribute('data-active', String(on));
        renderCAPE();
      });
    });
    document.querySelectorAll('.bw-pill[data-cape-ref]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-cape-ref');
        var on = !(CAPE_STATE.refs[k]);
        CAPE_STATE.refs[k] = on;
        b.classList.toggle('active', on);
        b.setAttribute('data-active', String(on));
        renderCAPE();
      });
    });
  }

  // ─────────────────────────────────────────────────────────
  // 4. CONCENTRATION (S17.2)
  // ─────────────────────────────────────────────────────────

  var CONC_STATE = { view: 'history' };

  function renderConc() {
    var svg = document.getElementById('bw-conc');
    if (!svg) return;
    clear(svg);

    if (CONC_STATE.view === 'history') {
      drawConcHistory(svg);
    } else {
      drawConcMag7(svg);
    }
  }

  function drawConcHistory(svg) {
    var W = 1100, H = 460;
    var pad = { l: 56, r: 28, t: 30, b: 50 };
    var iw = W - pad.l - pad.r;
    var ih = H - pad.t - pad.b;

    var xMin = 1980, xMax = 2026;
    var yMin = 0, yMax = 45;
    function xS(y) { return pad.l + ((y - xMin) / (xMax - xMin)) * iw; }
    function yS(v) { return pad.t + (1 - v / yMax) * ih; }

    el('line', { class: 'bw-axis', x1: pad.l, y1: pad.t + ih, x2: pad.l + iw, y2: pad.t + ih }, svg);
    el('line', { class: 'bw-axis', x1: pad.l, y1: pad.t, x2: pad.l, y2: pad.t + ih }, svg);

    for (var v = 10; v <= 40; v += 10) {
      var ys = yS(v);
      el('line', { class: 'bw-grid', x1: pad.l, y1: ys, x2: pad.l + iw, y2: ys }, svg);
      var tl = el('text', { class: 'bw-axis-label', x: pad.l - 8, y: ys + 3, 'text-anchor': 'end' }, svg);
      tl.textContent = v + '%';
    }
    for (var year = 1985; year <= 2025; year += 5) {
      var xx = xS(year);
      el('line', { class: 'bw-grid', x1: xx, y1: pad.t, x2: xx, y2: pad.t + ih }, svg);
      var xl = el('text', { class: 'bw-axis-label', x: xx, y: pad.t + ih + 18, 'text-anchor': 'middle' }, svg);
      xl.textContent = String(year);
    }

    // Fill area under curve
    var areaD = 'M' + xS(CONC[0].y) + ' ' + yS(0);
    CONC.forEach(function (p) {
      areaD += ' L' + xS(p.y) + ' ' + yS(p.v);
    });
    areaD += ' L' + xS(CONC[CONC.length - 1].y) + ' ' + yS(0) + ' Z';
    el('path', { class: 'bw-series-fill-bear', d: areaD }, svg);

    // Line
    var lineD = '';
    CONC.forEach(function (p, i) {
      lineD += (i === 0 ? 'M' : ' L') + xS(p.y) + ' ' + yS(p.v);
    });
    el('path', { class: 'bw-series bw-series-bear', d: lineD }, svg);

    // Peaks annotation
    var peaks = [
      { y: 2000, v: 25.6, label: '2000 ~26%' },
      { y: 2007, v: 19.5, label: '2007 ~20%' },
      { y: 2021, v: 28.5, label: '2021 ~28%' },
      { y: 2026, v: 38.5, label: '2026 ~38%' }
    ];
    peaks.forEach(function (p) {
      var cx = xS(p.y), cy = yS(p.v);
      el('circle', {
        class: 'bw-marker', cx: cx, cy: cy, r: 4.5,
        stroke: 'var(--accent)'
      }, svg);
      var anchor = p.y < 2020 ? 'start' : 'end';
      var dx = p.y < 2020 ? 8 : -8;
      var lbl = el('text', {
        class: 'bw-marker-label',
        x: cx + dx, y: cy - 8, 'text-anchor': anchor
      }, svg);
      lbl.textContent = p.label;
    });

    // Hover surface
    var hov = el('rect', {
      x: pad.l, y: pad.t, width: iw, height: ih,
      fill: 'transparent'
    }, svg);
    hov.addEventListener('mousemove', function (ev) {
      var rect = svg.getBoundingClientRect();
      var px = ev.clientX - rect.left;
      var scale = rect.width / W;
      var dataX = (px / scale - pad.l) / iw;
      var year = Math.round(xMin + dataX * (xMax - xMin));
      var nearest = CONC[0]; var bestDist = Infinity;
      CONC.forEach(function (p) {
        var dd = Math.abs(p.y - year);
        if (dd < bestDist) { bestDist = dd; nearest = p; }
      });
      showTip('conc', ev,
        '<strong>' + nearest.v.toFixed(1) + '%</strong> top-10 share<br>' + nearest.y);
    });
    hov.addEventListener('mouseleave', function () { hideTip('conc'); });
  }

  function drawConcMag7(svg) {
    var W = 1100, H = 460;
    var pad = { l: 140, r: 80, t: 30, b: 30 };
    var iw = W - pad.l - pad.r;

    var maxShare = Math.max.apply(null, MAG7.map(function (m) { return m.share; }));
    var rowH = (H - pad.t - pad.b) / MAG7.length;

    var total = MAG7.reduce(function (a, m) { return a + m.share; }, 0);

    MAG7.forEach(function (m, i) {
      var y = pad.t + i * rowH + 6;
      var barH = rowH - 12;
      var barW = (m.share / maxShare) * iw;

      // Company label (left)
      var lbl = el('text', {
        class: 'bw-bar-label',
        x: pad.l - 12, y: y + barH / 2 + 4,
        'text-anchor': 'end'
      }, svg);
      lbl.textContent = m.name;

      // Bar
      el('rect', {
        class: 'bw-mag7-bar',
        x: pad.l, y: y,
        width: barW, height: barH
      }, svg);

      // Value label (right of bar)
      var val = el('text', {
        class: 'bw-bar-label',
        x: pad.l + barW + 8, y: y + barH / 2 + 4,
        'text-anchor': 'start',
        fill: 'var(--ink)'
      }, svg);
      val.textContent = m.share.toFixed(1) + '%';
    });

    // Footer: total
    var foot = el('text', {
      class: 'bw-bar-sub',
      x: pad.l, y: pad.t + MAG7.length * rowH + 20
    }, svg);
    foot.textContent = 'Magnificent Seven combined: ~' + total.toFixed(1) +
      '% of S&P 500. NVIDIA alone is roughly equal to the bottom 400 names.';
  }

  function wireConc() {
    document.querySelectorAll('.bw-pill[data-conc]').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.bw-pill[data-conc]').forEach(function (x) {
          x.classList.remove('active');
        });
        b.classList.add('active');
        CONC_STATE.view = b.getAttribute('data-conc');
        renderConc();
      });
    });
  }

  // ─────────────────────────────────────────────────────────
  // 5. CAPEX GAP (S17.3)
  // ─────────────────────────────────────────────────────────

  var GAP_STATE = { compareTo: 'frontier' };

  function renderGap() {
    var svg = document.getElementById('bw-gap');
    if (!svg) return;
    clear(svg);

    var W = 1100, H = 460;
    var pad = { l: 64, r: 32, t: 40, b: 60 };
    var iw = W - pad.l - pad.r;
    var ih = H - pad.t - pad.b;

    var maxVal = 805;
    function yS(v) { return pad.t + (1 - v / maxVal) * ih; }

    // Axes + grid
    el('line', { class: 'bw-axis', x1: pad.l, y1: pad.t + ih, x2: pad.l + iw, y2: pad.t + ih }, svg);
    el('line', { class: 'bw-axis', x1: pad.l, y1: pad.t, x2: pad.l, y2: pad.t + ih }, svg);
    for (var v = 100; v <= 800; v += 100) {
      var ys = yS(v);
      el('line', { class: 'bw-grid', x1: pad.l, y1: ys, x2: pad.l + iw, y2: ys }, svg);
      var tl = el('text', { class: 'bw-axis-label', x: pad.l - 8, y: ys + 3, 'text-anchor': 'end' }, svg);
      tl.textContent = '$' + v + 'B';
    }

    var groupW = iw / GAP.length;
    var barW = Math.min(120, groupW * 0.32);
    var gap = 14;

    GAP.forEach(function (row, idx) {
      var cx = pad.l + groupW * idx + groupW / 2;
      var compareVal = GAP_STATE.compareTo === 'frontier' ? row.frontier : row.vendor;
      var compareLabel = GAP_STATE.compareTo === 'frontier' ?
        'OpenAI + Anthropic ARR' : 'All AI vendor revenue';

      // Capex bar (left of group center)
      var x1 = cx - barW - gap / 2;
      var y1 = yS(row.capex);
      var capRect = el('rect', {
        class: 'bw-bar-capex',
        x: x1, y: y1,
        width: barW, height: pad.t + ih - y1
      }, svg);
      capRect.addEventListener('mouseenter', function (ev) {
        showTip('gap', ev,
          '<strong>' + fmtBN(row.capex) + '</strong> capex<br>Big 5 hyperscalers ' + row.year);
      });
      capRect.addEventListener('mouseleave', function () { hideTip('gap'); });
      var capLab = el('text', {
        class: 'bw-bar-label',
        x: x1 + barW / 2, y: y1 - 6, 'text-anchor': 'middle',
        fill: 'var(--accent)'
      }, svg);
      capLab.textContent = fmtBN(row.capex);

      // Compare bar (right of group center)
      var x2 = cx + gap / 2;
      var y2 = yS(compareVal);
      var revRect = el('rect', {
        class: 'bw-bar-rev',
        x: x2, y: y2,
        width: barW, height: pad.t + ih - y2
      }, svg);
      revRect.addEventListener('mouseenter', function (ev) {
        showTip('gap', ev,
          '<strong>' + fmtBN(compareVal) + '</strong> ' + compareLabel + '<br>' + row.year);
      });
      revRect.addEventListener('mouseleave', function () { hideTip('gap'); });
      var revLab = el('text', {
        class: 'bw-bar-label',
        x: x2 + barW / 2, y: y2 - 6, 'text-anchor': 'middle',
        fill: 'var(--bw-bull)'
      }, svg);
      revLab.textContent = fmtBN(compareVal);

      // Year label
      var yearLab = el('text', {
        class: 'bw-bar-label',
        x: cx, y: pad.t + ih + 22, 'text-anchor': 'middle',
        fill: 'var(--ink)'
      }, svg);
      yearLab.textContent = row.year + (row.year === 2026 ? 'E' : '');

      // Ratio sub-label
      var ratio = (row.capex / compareVal).toFixed(1);
      var subLab = el('text', {
        class: 'bw-bar-sub',
        x: cx, y: pad.t + ih + 38, 'text-anchor': 'middle'
      }, svg);
      subLab.textContent = ratio + 'x ratio';
    });

    // Legend
    var legX = pad.l + 8;
    var legY = pad.t + 12;
    el('rect', { class: 'bw-bar-capex', x: legX, y: legY, width: 12, height: 12 }, svg);
    var legLab1 = el('text', {
      class: 'bw-axis-label',
      x: legX + 18, y: legY + 10, 'text-anchor': 'start',
      fill: 'var(--ink)'
    }, svg);
    legLab1.textContent = 'Hyperscaler capex';

    el('rect', { class: 'bw-bar-rev', x: legX + 180, y: legY, width: 12, height: 12 }, svg);
    var legLab2 = el('text', {
      class: 'bw-axis-label',
      x: legX + 198, y: legY + 10, 'text-anchor': 'start',
      fill: 'var(--ink)'
    }, svg);
    legLab2.textContent = GAP_STATE.compareTo === 'frontier' ?
      'OpenAI + Anthropic ARR' : 'All AI vendor revenue';
  }

  function wireGap() {
    document.querySelectorAll('.bw-pill[data-gap]').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.bw-pill[data-gap]').forEach(function (x) {
          x.classList.remove('active');
        });
        b.classList.add('active');
        GAP_STATE.compareTo = b.getAttribute('data-gap');
        renderGap();
      });
    });
  }

  // ─────────────────────────────────────────────────────────
  // 6. MARGIN DEBT (S17.4)
  // ─────────────────────────────────────────────────────────

  var MARGIN_STATE = {
    markers: { '2000': true, '2007': true, '2021': true, '2026': true }
  };

  function renderMargin() {
    var svg = document.getElementById('bw-margin');
    if (!svg) return;
    clear(svg);

    var W = 1100, H = 460;
    var pad = { l: 56, r: 28, t: 30, b: 50 };
    var iw = W - pad.l - pad.r;
    var ih = H - pad.t - pad.b;

    var xMin = 1997, xMax = 2026;
    var yMin = 0, yMax = 4.5;
    function xS(y) { return pad.l + ((y - xMin) / (xMax - xMin)) * iw; }
    function yS(v) { return pad.t + (1 - v / yMax) * ih; }

    el('line', { class: 'bw-axis', x1: pad.l, y1: pad.t + ih, x2: pad.l + iw, y2: pad.t + ih }, svg);
    el('line', { class: 'bw-axis', x1: pad.l, y1: pad.t, x2: pad.l, y2: pad.t + ih }, svg);
    for (var v = 1; v <= 4; v += 1) {
      var ys = yS(v);
      el('line', { class: 'bw-grid', x1: pad.l, y1: ys, x2: pad.l + iw, y2: ys }, svg);
      var tl = el('text', { class: 'bw-axis-label', x: pad.l - 8, y: ys + 3, 'text-anchor': 'end' }, svg);
      tl.textContent = v + '%';
    }
    for (var year = 2000; year <= 2025; year += 5) {
      var xx = xS(year);
      el('line', { class: 'bw-grid', x1: xx, y1: pad.t, x2: xx, y2: pad.t + ih }, svg);
      var xl = el('text', { class: 'bw-axis-label', x: xx, y: pad.t + ih + 18, 'text-anchor': 'middle' }, svg);
      xl.textContent = String(year);
    }

    // Fill area
    var areaD = 'M' + xS(MARGIN[0].y) + ' ' + yS(0);
    MARGIN.forEach(function (p) { areaD += ' L' + xS(p.y) + ' ' + yS(p.v); });
    areaD += ' L' + xS(MARGIN[MARGIN.length - 1].y) + ' ' + yS(0) + ' Z';
    el('path', { class: 'bw-series-fill-bear', d: areaD }, svg);

    // Line
    var lineD = '';
    MARGIN.forEach(function (p, i) {
      lineD += (i === 0 ? 'M' : ' L') + xS(p.y) + ' ' + yS(p.v);
    });
    el('path', { class: 'bw-series bw-series-bear', d: lineD }, svg);

    // Markers
    Object.keys(MARGIN_STATE.markers).forEach(function (k) {
      if (!MARGIN_STATE.markers[k]) return;
      var m = MARGIN_MARKERS[k];
      if (!m) return;
      var mx = xS(m.y), myy = yS(m.v);
      el('line', { class: 'bw-marker-line', x1: mx, y1: yS(0), x2: mx, y2: myy, stroke: 'var(--ink-dim)' }, svg);
      var c = el('circle', {
        class: 'bw-marker', cx: mx, cy: myy, r: 5,
        stroke: 'var(--accent)'
      }, svg);
      c.addEventListener('mouseenter', function (ev) {
        showTip('margin', ev,
          '<strong>' + m.v.toFixed(2) + '%</strong> of GDP<br>' + m.label);
      });
      c.addEventListener('mouseleave', function () { hideTip('margin'); });
      var anchor = k === '2026' || k === '2021' ? 'end' : 'start';
      var dx = anchor === 'end' ? -8 : 8;
      var ll = el('text', {
        class: 'bw-marker-label',
        x: mx + dx, y: myy - 8, 'text-anchor': anchor
      }, svg);
      ll.textContent = m.label;
    });

    // Hover overlay
    var hov = el('rect', {
      x: pad.l, y: pad.t, width: iw, height: ih,
      fill: 'transparent'
    }, svg);
    hov.addEventListener('mousemove', function (ev) {
      var rect = svg.getBoundingClientRect();
      var px = ev.clientX - rect.left;
      var scale = rect.width / W;
      var dataX = (px / scale - pad.l) / iw;
      var year = Math.round(xMin + dataX * (xMax - xMin));
      var nearest = MARGIN[0]; var bestDist = Infinity;
      MARGIN.forEach(function (p) {
        var dd = Math.abs(p.y - year);
        if (dd < bestDist) { bestDist = dd; nearest = p; }
      });
      showTip('margin', ev,
        '<strong>' + nearest.v.toFixed(2) + '%</strong> of GDP<br>' + nearest.y);
    });
    hov.addEventListener('mouseleave', function () { hideTip('margin'); });
  }

  function wireMargin() {
    document.querySelectorAll('.bw-pill[data-marg-marker]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-marg-marker');
        var on = !(MARGIN_STATE.markers[k]);
        MARGIN_STATE.markers[k] = on;
        b.classList.toggle('active', on);
        b.setAttribute('data-active', String(on));
        renderMargin();
      });
    });
  }

  // ─────────────────────────────────────────────────────────
  // 7. CAPABILITY CURVE (S17.5)
  // ─────────────────────────────────────────────────────────

  var CAP_STATE = { doubling: 'long' };

  function renderCap() {
    var svg = document.getElementById('bw-cap');
    if (!svg) return;
    clear(svg);

    var W = 1100, H = 460;
    var pad = { l: 64, r: 32, t: 30, b: 60 };
    var iw = W - pad.l - pad.r;
    var ih = H - pad.t - pad.b;

    var xMin = 2019, xMax = 2027;
    // log-y from 1 sec (~0.00028 hours) to ~32 hours
    var yLogMin = Math.log10(0.0008);  // ~3 seconds
    var yLogMax = Math.log10(32);
    function xS(y) { return pad.l + ((y - xMin) / (xMax - xMin)) * iw; }
    function yS(h) {
      var lh = Math.log10(h);
      return pad.t + (1 - (lh - yLogMin) / (yLogMax - yLogMin)) * ih;
    }

    el('line', { class: 'bw-axis', x1: pad.l, y1: pad.t + ih, x2: pad.l + iw, y2: pad.t + ih }, svg);
    el('line', { class: 'bw-axis', x1: pad.l, y1: pad.t, x2: pad.l, y2: pad.t + ih }, svg);

    // Y log gridlines + labels (10^k)
    var yTicks = [
      { h: 0.0028, label: '10 sec' },
      { h: 0.0167, label: '1 min' },
      { h: 0.083,  label: '5 min' },
      { h: 0.5,    label: '30 min' },
      { h: 1,      label: '1 hour' },
      { h: 4,      label: '4 hours' },
      { h: 16,     label: '16 hours' }
    ];
    yTicks.forEach(function (t) {
      var ys = yS(t.h);
      el('line', { class: 'bw-grid', x1: pad.l, y1: ys, x2: pad.l + iw, y2: ys }, svg);
      var lbl = el('text', {
        class: 'bw-axis-label',
        x: pad.l - 8, y: ys + 3, 'text-anchor': 'end'
      }, svg);
      lbl.textContent = t.label;
    });
    for (var year = 2019; year <= 2026; year += 1) {
      var xx = xS(year);
      el('line', { class: 'bw-grid', x1: xx, y1: pad.t, x2: xx, y2: pad.t + ih }, svg);
      var xl = el('text', { class: 'bw-axis-label', x: xx, y: pad.t + ih + 18, 'text-anchor': 'middle' }, svg);
      xl.textContent = String(year);
    }

    // Doubling reference curve
    // Long-run: doubles every 7 months. Starting point: 2019.0, 0.0014 hours.
    // Fast: doubles every 4 months.
    var doublingMonths = CAP_STATE.doubling === 'fast' ? 4 : 7;
    var baseYear = 2019.0, baseH = 0.0014;
    var refD = '';
    for (var yr = 2019; yr <= 2027; yr += 0.25) {
      var months = (yr - baseYear) * 12;
      var doublings = months / doublingMonths;
      var h = baseH * Math.pow(2, doublings);
      if (h > Math.pow(10, yLogMax)) break;
      if (h < Math.pow(10, yLogMin)) continue;
      refD += (refD === '' ? 'M' : ' L') + xS(yr) + ' ' + yS(h);
    }
    el('path', { class: 'bw-ref-line', d: refD, stroke: 'var(--ink-dim)' }, svg);
    var refLab = el('text', {
      class: 'bw-ref-label',
      x: pad.l + iw - 8, y: pad.t + 12, 'text-anchor': 'end'
    }, svg);
    refLab.textContent = doublingMonths + '-month doubling reference';

    // Data series
    var d = '';
    METR.forEach(function (p, i) {
      d += (i === 0 ? 'M' : ' L') + xS(p.y) + ' ' + yS(p.h);
    });
    el('path', { class: 'bw-series bw-series-bull', d: d }, svg);

    METR.forEach(function (p) {
      var c = el('circle', {
        class: 'bw-marker',
        cx: xS(p.y), cy: yS(p.h), r: 4,
        stroke: 'var(--bw-bull)'
      }, svg);
      c.addEventListener('mouseenter', function (ev) {
        var ht = p.h >= 1 ? p.h.toFixed(1) + ' hours' :
                 p.h >= 0.0167 ? (p.h * 60).toFixed(0) + ' min' :
                 (p.h * 3600).toFixed(0) + ' sec';
        showTip('cap', ev,
          '<strong>' + ht + '</strong><br>50% task time, ' + p.y.toFixed(1));
      });
      c.addEventListener('mouseleave', function () { hideTip('cap'); });
    });

    // Anchor labels for first and last
    var first = METR[0];
    var fLab = el('text', {
      class: 'bw-marker-label',
      x: xS(first.y) + 8, y: yS(first.h) + 4, 'text-anchor': 'start'
    }, svg);
    fLab.textContent = '~5 sec (2019)';

    var last = METR[METR.length - 1];
    var lLab = el('text', {
      class: 'bw-marker-label',
      x: xS(last.y) - 8, y: yS(last.h) - 8, 'text-anchor': 'end',
      fill: 'var(--accent)'
    }, svg);
    lLab.textContent = 'Mythos 16h+ (May 2026)';
  }

  function wireCap() {
    document.querySelectorAll('.bw-pill[data-cap]').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.bw-pill[data-cap]').forEach(function (x) {
          x.classList.remove('active');
        });
        b.classList.add('active');
        CAP_STATE.doubling = b.getAttribute('data-cap');
        renderCap();
      });
    });
  }

  // ─────────────────────────────────────────────────────────
  // 8. BUBBLE LINEUP (S17.6)
  // ─────────────────────────────────────────────────────────

  var LINE_STATE = { sort: 'historical' };

  function renderLineup() {
    var container = document.getElementById('bw-lineup');
    if (!container) return;
    container.innerHTML = '';

    // Header row
    var head = ['Indicator', '1929', '2000', '2007', '2021', '2026'];
    head.forEach(function (h, i) {
      var cell = html('div', { class: 'bw-line-head', text: h }, container);
      if (i === 5) cell.classList.add('bw-line-row-now');
    });

    var rows = LINEUP.slice();
    if (LINE_STATE.sort === 'extreme') {
      // Sort by 2026 severity descending (rightmost column)
      rows.sort(function (a, b) { return b.cells[4].s - a.cells[4].s; });
    }

    rows.forEach(function (row) {
      var label = html('div', { class: 'bw-line-row-label' }, container);
      html('span', { text: row.ind }, label);
      html('span', { class: 'bw-line-row-sub', text: row.sub }, label);

      row.cells.forEach(function (cell, idx) {
        var cellEl = html('div', { class: 'bw-line-cell' }, container);
        if (idx === 4) cellEl.classList.add('bw-line-cell-now');
        html('div', {
          class: 'bw-line-sev',
          'data-s': String(cell.s)
        }, cellEl);
        html('div', { class: 'bw-line-val', text: cell.v }, cellEl);
      });
    });
  }

  function wireLineup() {
    document.querySelectorAll('.bw-pill[data-line]').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.bw-pill[data-line]').forEach(function (x) {
          x.classList.remove('active');
        });
        b.classList.add('active');
        LINE_STATE.sort = b.getAttribute('data-line');
        renderLineup();
      });
    });
  }

  // ─────────────────────────────────────────────────────────
  // 9. BOOT
  // ─────────────────────────────────────────────────────────

  function init() {
    renderCAPE();    wireCAPE();
    renderConc();    wireConc();
    renderGap();     wireGap();
    renderMargin();  wireMargin();
    renderCap();     wireCap();
    renderLineup();  wireLineup();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
