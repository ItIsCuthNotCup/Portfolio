/* ═══════════════════════════════════════════════════════════
   RESERVOIR TEACUP MAP — S14
   Renders three views from a static USBR / USGS snapshot:
     1. Teacup grid (20 reservoirs, current vs historical avg)
     2. Elevation cliff (Mead + Powell time series, 1990-2025)
     3. Snow-to-storage scatter (basin-year pairs)
   No frameworks. No fetch. Data is baked in below.
   Snapshot vintage: April-May 2025 USBR RISE + USGS NWIS.
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────
  // 1. DATA
  // ─────────────────────────────────────────────────────────
  // Capacities and storage are in million acre-feet (maf).
  // 'avg' is the May historical average (1991-2020 climatology
  // where USBR publishes it; otherwise full-pool * 0.7 as a
  // reasonable proxy for snapshot purposes).
  // Elevations are in feet (ft) above sea level for the two
  // reservoirs that use them as the primary policy metric.

  var RESERVOIRS = [
    // ── Colorado River Basin ───────────────────────────────
    {
      name: 'Lake Mead', basin: 'Colorado', state: 'NV/AZ',
      cap: 26.16, cur: 9.16, avg: 13.08,
      elev: 1074, elevMax: 1229, elevDead: 895,
      note: 'Largest reservoir in the US by capacity. Serves Las Vegas, Phoenix, Tucson, and parts of Southern California via Hoover Dam.'
    },
    {
      name: 'Lake Powell', basin: 'Colorado', state: 'UT/AZ',
      cap: 24.32, cur: 9.24, avg: 12.16,
      elev: 3564, elevMax: 3700, elevDead: 3370,
      note: 'Second-largest US reservoir. Glen Canyon Dam. Min power pool is 3,490 ft. Hit a record low 3,522 ft in April 2023.'
    },
    {
      name: 'Flaming Gorge', basin: 'Colorado', state: 'WY/UT',
      cap: 3.789, cur: 2.84, avg: 2.84,
      note: 'Upper basin storage on the Green River. Used as a release buffer for Powell during Tier 2 shortage years.'
    },
    {
      name: 'Navajo', basin: 'Colorado', state: 'NM/CO',
      cap: 1.708, cur: 1.11, avg: 1.20,
      note: 'San Juan River storage. Supplies the Navajo Indian Irrigation Project and water for Albuquerque.'
    },
    {
      name: 'Blue Mesa', basin: 'Colorado', state: 'CO',
      cap: 0.829, cur: 0.50, avg: 0.58,
      note: 'Largest reservoir in Colorado. Aspinall Unit on the Gunnison. Emergency releases to Powell ordered in 2021 and 2022.'
    },

    // ── California network ────────────────────────────────
    {
      name: 'Shasta', basin: 'California', state: 'CA',
      cap: 4.552, cur: 3.87, avg: 2.96,
      note: 'Largest reservoir in California. Central Valley Project keystone. Recovered hard after 2023 wet winter.'
    },
    {
      name: 'Oroville', basin: 'California', state: 'CA',
      cap: 3.538, cur: 3.18, avg: 2.30,
      note: 'State Water Project keystone. Source for 27 million Californians. 2017 spillway failure prompted full repair.'
    },
    {
      name: 'Trinity', basin: 'California', state: 'CA',
      cap: 2.448, cur: 1.71, avg: 1.59,
      note: 'Diverts to the Sacramento via Whiskeytown. Operated jointly with Shasta for cold-water releases.'
    },
    {
      name: 'San Luis', basin: 'California', state: 'CA',
      cap: 2.041, cur: 1.63, avg: 1.43,
      note: 'Off-stream storage between Central Valley and State Water Project deliveries. Largest off-stream reservoir in the US.'
    },
    {
      name: 'New Melones', basin: 'California', state: 'CA',
      cap: 2.420, cur: 1.82, avg: 1.45,
      note: 'Stanislaus River. Used for irrigation and Bay-Delta water-quality flows.'
    },
    {
      name: 'Don Pedro', basin: 'California', state: 'CA',
      cap: 2.030, cur: 1.62, avg: 1.42,
      note: 'Tuolumne River. Major irrigation supply for the Modesto and Turlock districts.'
    },
    {
      name: 'Folsom', basin: 'California', state: 'CA',
      cap: 0.977, cur: 0.86, avg: 0.59,
      note: 'American River. Supplies Sacramento metro. Flood-control releases coordinated with Shasta.'
    },
    {
      name: 'Castaic', basin: 'California', state: 'CA',
      cap: 0.325, cur: 0.20, avg: 0.21,
      note: 'Southern terminus of the State Water Project. Direct supply to Los Angeles County.'
    },

    // ── Pacific Northwest / Columbia ──────────────────────
    {
      name: 'Grand Coulee', basin: 'Columbia', state: 'WA',
      cap: 9.562, cur: 6.69, avg: 6.21,
      note: 'Largest concrete dam in the US. Lake Roosevelt impoundment. Powers parts of eight Northwest states.'
    },
    {
      name: 'Hungry Horse', basin: 'Columbia', state: 'MT',
      cap: 3.560, cur: 3.38, avg: 2.85,
      note: 'Flathead River. Among the deepest reservoirs in the Northwest. Reliably near full in normal years.'
    },
    {
      name: 'Dworshak', basin: 'Columbia', state: 'ID',
      cap: 3.453, cur: 2.40, avg: 2.45,
      note: 'North Fork Clearwater. Operated for downstream temperature control to protect salmon migrations.'
    },

    // ── Rio Grande ────────────────────────────────────────
    {
      name: 'Elephant Butte', basin: 'Rio Grande', state: 'NM',
      cap: 2.213, cur: 0.55, avg: 1.11,
      note: 'Largest reservoir in New Mexico. Hit 3% of capacity in 2022. The quiet emergency west of Albuquerque.'
    },
    {
      name: 'Caballo', basin: 'Rio Grande', state: 'NM',
      cap: 0.343, cur: 0.10, avg: 0.18,
      note: 'Re-regulation dam just below Elephant Butte. Operated jointly for irrigation downstream of El Paso.'
    },

    // ── Snake River ───────────────────────────────────────
    {
      name: 'Jackson Lake', basin: 'Snake', state: 'WY',
      cap: 0.847, cur: 0.68, avg: 0.59,
      note: 'Upper Snake. Held back by Jackson Lake Dam inside Grand Teton National Park. Idaho irrigation source.'
    },
    {
      name: 'Owyhee', basin: 'Snake', state: 'OR/ID',
      cap: 0.715, cur: 0.36, avg: 0.43,
      note: 'Largest reservoir in Oregon. Owyhee Project. Drought-stressed throughout the 2020s.'
    }
  ];

  // Elevation time series for Mead + Powell, annual averages (ft).
  // Anchored on USBR RISE end-of-month records, simplified to a
  // smooth annual reading for chart legibility.
  var ELEV_HISTORY = {
    mead: [
      { y: 1990, ft: 1219 }, { y: 1992, ft: 1207 }, { y: 1995, ft: 1196 },
      { y: 1998, ft: 1209 }, { y: 2000, ft: 1212 }, { y: 2002, ft: 1156 },
      { y: 2004, ft: 1131 }, { y: 2006, ft: 1133 }, { y: 2008, ft: 1110 },
      { y: 2010, ft: 1083 }, { y: 2012, ft: 1124 }, { y: 2014, ft: 1083 },
      { y: 2016, ft: 1075 }, { y: 2018, ft: 1080 }, { y: 2020, ft: 1085 },
      { y: 2021, ft: 1066 }, { y: 2022, ft: 1041 }, { y: 2023, ft: 1056 },
      { y: 2024, ft: 1064 }, { y: 2025, ft: 1074 }
    ],
    powell: [
      { y: 1990, ft: 3687 }, { y: 1992, ft: 3676 }, { y: 1995, ft: 3666 },
      { y: 1998, ft: 3686 }, { y: 2000, ft: 3692 }, { y: 2002, ft: 3622 },
      { y: 2004, ft: 3564 }, { y: 2006, ft: 3611 }, { y: 2008, ft: 3623 },
      { y: 2010, ft: 3636 }, { y: 2012, ft: 3640 }, { y: 2014, ft: 3580 },
      { y: 2016, ft: 3608 }, { y: 2018, ft: 3589 }, { y: 2020, ft: 3603 },
      { y: 2021, ft: 3558 }, { y: 2022, ft: 3534 }, { y: 2023, ft: 3573 },
      { y: 2024, ft: 3577 }, { y: 2025, ft: 3564 }
    ]
  };

  // Mead policy tiers, simplified from the 2007 Interim Guidelines
  // and the 2019 Drought Contingency Plan.
  var MEAD_TIERS = [
    { ft: 1075, label: 'Tier 1 shortage' },
    { ft: 1050, label: 'Tier 2a' },
    { ft: 1025, label: 'Tier 2b' },
    { ft: 1000, label: 'Tier 3' },
    { ft: 950,  label: 'Minimum power pool' }
  ];
  var MEAD_DEAD = 895;
  var POWELL_DEAD = 3370;
  var POWELL_MIN_POWER = 3490;

  // Snow-to-storage pairs. April 1 SWE (inches) vs end-of-water-year
  // storage as % of capacity, by basin-year.
  // Built from NRCS SNOTEL basin averages and USBR storage records,
  // simplified for the chart.
  var SCATTER = [
    // Colorado (Upper basin) ----------------------------------
    { basin: 'Colorado', y: 2000, swe: 16.2, store: 89 },
    { basin: 'Colorado', y: 2002, swe:  8.1, store: 74 },
    { basin: 'Colorado', y: 2005, swe: 17.5, store: 72 },
    { basin: 'Colorado', y: 2008, swe: 19.2, store: 70 },
    { basin: 'Colorado', y: 2011, swe: 21.5, store: 80 },
    { basin: 'Colorado', y: 2013, swe: 10.1, store: 58 },
    { basin: 'Colorado', y: 2015, swe:  9.0, store: 49 },
    { basin: 'Colorado', y: 2017, swe: 16.6, store: 56 },
    { basin: 'Colorado', y: 2018, swe:  8.8, store: 43 },
    { basin: 'Colorado', y: 2020, swe: 11.2, store: 41 },
    { basin: 'Colorado', y: 2021, swe: 12.4, store: 32 },
    { basin: 'Colorado', y: 2022, swe: 14.1, store: 27 },
    { basin: 'Colorado', y: 2023, swe: 21.8, store: 36 },
    { basin: 'Colorado', y: 2024, swe:  9.4, store: 38 },
    { basin: 'Colorado', y: 2025, swe: 13.6, store: 39 },

    // California (Sierra Nevada) ------------------------------
    { basin: 'California', y: 2000, swe: 27.0, store: 78 },
    { basin: 'California', y: 2005, swe: 36.0, store: 85 },
    { basin: 'California', y: 2011, swe: 39.0, store: 92 },
    { basin: 'California', y: 2014, swe:  9.6, store: 36 },
    { basin: 'California', y: 2015, swe:  3.6, store: 27 },
    { basin: 'California', y: 2017, swe: 41.0, store: 87 },
    { basin: 'California', y: 2019, swe: 32.0, store: 80 },
    { basin: 'California', y: 2021, swe: 16.0, store: 46 },
    { basin: 'California', y: 2022, swe: 12.0, store: 38 },
    { basin: 'California', y: 2023, swe: 49.5, store: 92 },
    { basin: 'California', y: 2024, swe: 31.0, store: 84 },
    { basin: 'California', y: 2025, swe: 26.0, store: 80 },

    // Columbia ------------------------------------------------
    { basin: 'Columbia', y: 2000, swe: 18.0, store: 74 },
    { basin: 'Columbia', y: 2005, swe: 12.5, store: 62 },
    { basin: 'Columbia', y: 2011, swe: 26.0, store: 84 },
    { basin: 'Columbia', y: 2015, swe:  9.0, store: 56 },
    { basin: 'Columbia', y: 2018, swe: 22.0, store: 78 },
    { basin: 'Columbia', y: 2020, swe: 19.0, store: 70 },
    { basin: 'Columbia', y: 2022, swe: 24.0, store: 80 },
    { basin: 'Columbia', y: 2023, swe: 21.5, store: 78 },
    { basin: 'Columbia', y: 2024, swe: 16.5, store: 67 },
    { basin: 'Columbia', y: 2025, swe: 17.0, store: 70 },

    // Rio Grande ---------------------------------------------
    { basin: 'Rio Grande', y: 2000, swe: 12.0, store: 71 },
    { basin: 'Rio Grande', y: 2005, swe:  9.5, store: 50 },
    { basin: 'Rio Grande', y: 2011, swe: 14.5, store: 44 },
    { basin: 'Rio Grande', y: 2013, swe:  4.5, store: 18 },
    { basin: 'Rio Grande', y: 2017, swe: 11.0, store: 26 },
    { basin: 'Rio Grande', y: 2019, swe: 16.0, store: 33 },
    { basin: 'Rio Grande', y: 2021, swe:  6.0, store: 14 },
    { basin: 'Rio Grande', y: 2022, swe:  9.0, store:  9 },
    { basin: 'Rio Grande', y: 2023, swe: 19.0, store: 22 },
    { basin: 'Rio Grande', y: 2024, swe: 12.0, store: 25 }
  ];

  // ─────────────────────────────────────────────────────────
  // 2. UTILITIES
  // ─────────────────────────────────────────────────────────

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    var node = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        node.setAttribute(k, attrs[k]);
      });
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

  function fmtAF(maf) {
    // Format million acre-feet with one decimal, with thousands separator
    // in absolute acre-feet for the totals readout.
    return maf.toFixed(2) + 'M';
  }

  function fmtPct(n) {
    return Math.round(n) + '%';
  }

  function classFor(r) {
    var ratio = r.cur / r.avg;
    if (ratio >= 1.05)  return 'is-above';
    if (ratio >= 0.90)  return 'is-near';
    if (ratio >= 0.70)  return 'is-below';
    return 'is-critical';
  }

  // Map a basin name to a CSS-safe slug for filtering.
  function basinSlug(b) {
    return b.toLowerCase().replace(/\s+/g, '-');
  }

  // ─────────────────────────────────────────────────────────
  // 3. TEACUP GRID
  // ─────────────────────────────────────────────────────────

  function buildTeacup(r) {
    // Cup geometry. Drawn within a 100x150 viewBox.
    // Top rim slightly wider than base for a subtle taper.
    var W = 100, H = 150;
    var topX1 = 15, topX2 = 85;
    var baseX1 = 22, baseX2 = 78;
    var topY = 18, baseY = 132;

    var capPct = (r.cur / r.cap) * 100;
    var avgPct = (r.avg / r.cap) * 100;
    var fillStatus = classFor(r);

    // Compute the fill polygon. We fill from the base upward by capPct
    // of the inner cup height. The sides of the fill follow the cup
    // taper so the water meets the wall cleanly.
    function lerp(a, b, t) { return a + (b - a) * t; }
    var fillT = capPct / 100;
    var fillY = lerp(baseY, topY, fillT);
    // X positions of the fill surface at fillY
    function xAt(y) {
      var t = (y - topY) / (baseY - topY); // 0 at top, 1 at base
      var leftTop = topX1, leftBase = baseX1;
      var rightTop = topX2, rightBase = baseX2;
      return {
        left: lerp(leftTop, leftBase, t),
        right: lerp(rightTop, rightBase, t)
      };
    }
    var fillEdges = xAt(fillY);
    var baseEdges = xAt(baseY);

    var avgT = avgPct / 100;
    var avgY = lerp(baseY, topY, avgT);
    var avgEdges = xAt(avgY);

    var svg = el('svg', {
      class: 'rtm-cup-svg',
      viewBox: '0 0 ' + W + ' ' + H,
      preserveAspectRatio: 'xMidYMid meet',
      'aria-label': r.name + ' teacup, ' + fmtPct(capPct) + ' full'
    });

    // Cup outline (the trapezoid + the base). Drawn as a path so
    // the inside fills cleanly with the paper bg.
    var outline = 'M' + topX1 + ' ' + topY +
                  ' L' + topX2 + ' ' + topY +
                  ' L' + baseX2 + ' ' + baseY +
                  ' L' + baseX1 + ' ' + baseY +
                  ' Z';
    el('path', { class: 'rtm-cup-outline', d: outline }, svg);

    // Fill polygon (water).
    if (capPct > 0.5) {
      var fillD = 'M' + fillEdges.left + ' ' + fillY +
                  ' L' + fillEdges.right + ' ' + fillY +
                  ' L' + baseEdges.right + ' ' + baseY +
                  ' L' + baseEdges.left + ' ' + baseY +
                  ' Z';
      el('path', { class: 'rtm-fill ' + fillStatus, d: fillD }, svg);
    }

    // Historical-average line.
    el('line', {
      class: 'rtm-avg-line',
      x1: avgEdges.left - 2,
      y1: avgY,
      x2: avgEdges.right + 2,
      y2: avgY
    }, svg);

    // Tick marks at 25 / 50 / 75 % on the right edge.
    [25, 50, 75].forEach(function (p) {
      var t = p / 100;
      var y = lerp(baseY, topY, t);
      var edges = xAt(y);
      el('line', {
        class: 'rtm-tick',
        x1: edges.right - 4,
        y1: y,
        x2: edges.right + 1,
        y2: y
      }, svg);
    });

    // Optional tick label at 50%.
    var midY = lerp(baseY, topY, 0.5);
    var midEdges = xAt(midY);
    var lab = el('text', {
      class: 'rtm-tick-label',
      x: midEdges.right + 3,
      y: midY + 2.5,
      'text-anchor': 'start'
    }, svg);
    lab.textContent = '50';

    return { svg: svg, capPct: capPct, status: fillStatus };
  }

  function deltaText(r) {
    var pct = ((r.cur - r.avg) / r.avg) * 100;
    var sign = pct >= 0 ? '+' : '';
    return sign + Math.round(pct) + '% vs avg';
  }

  function renderTeacups() {
    var grid = document.getElementById('rtm-teacup-grid');
    if (!grid) return;
    grid.innerHTML = '';

    RESERVOIRS.forEach(function (r, idx) {
      var cup = html('div', {
        class: 'rtm-cup',
        role: 'listitem',
        'data-basin': r.basin,
        'data-status': classFor(r).replace('is-', ''),
        'data-idx': idx,
        tabindex: '0',
        'aria-label': r.name + ' reservoir teacup'
      }, grid);

      var head = html('div', { class: 'rtm-cup-head' }, cup);
      html('span', { class: 'rtm-cup-name', text: r.name }, head);
      html('span', { class: 'rtm-cup-basin', text: r.basin }, head);

      var built = buildTeacup(r);
      cup.appendChild(built.svg);

      var foot = html('div', { class: 'rtm-cup-foot' }, cup);
      var pctNode = html('div', { class: 'rtm-cup-pct' }, foot);
      pctNode.innerHTML = Math.round(built.capPct) +
        '<span class="small">%</span>';
      var statusClass = classFor(r);
      html('div', {
        class: 'rtm-cup-delta ' + statusClass,
        text: deltaText(r)
      }, foot);

      // Click + keyboard pins this teacup.
      cup.addEventListener('click', function () { pin(r, cup); });
      cup.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          pin(r, cup);
        }
      });
    });

    updateTotals();
  }

  function pin(r, cupEl) {
    document.querySelectorAll('.rtm-cup.is-active').forEach(function (n) {
      n.classList.remove('is-active');
    });
    cupEl.classList.add('is-active');

    var pinned = document.getElementById('rtm-pinned');
    if (!pinned) return;
    pinned.innerHTML = '';
    html('span', { class: 'mono rtm-pinned-label', text: 'Selected' }, pinned);

    var body = html('div', { class: 'rtm-pinned-body' }, pinned);
    var dl = html('dl', {}, body);

    function row(label, value) {
      html('dt', { text: label }, dl);
      html('dd', { html: value }, dl);
    }
    row('Reservoir', '<strong>' + r.name + '</strong> &middot; ' + r.state);
    row('Basin', r.basin);
    row('Capacity', fmtAF(r.cap) + ' acre-ft');
    row('Current', fmtAF(r.cur) + ' acre-ft');
    row('May average', fmtAF(r.avg) + ' acre-ft');
    row('% full', fmtPct((r.cur / r.cap) * 100));
    row('vs average', deltaText(r));
    if (r.elev) {
      row('Elevation', r.elev + ' ft (max ' + r.elevMax + ', dead ' +
        r.elevDead + ')');
    }
    var note = html('p', {
      text: r.note,
      style: 'margin: 14px 0 0; font-size: 13px; line-height: 1.5; color: var(--ink-soft);'
    }, body);
  }

  function applyFilters() {
    var basin = document.querySelector('.rtm-pill[data-basin].active');
    var status = document.querySelector('.rtm-pill[data-status].active');
    var basinV = basin ? basin.getAttribute('data-basin') : 'all';
    var statusV = status ? status.getAttribute('data-status') : 'all';

    var cups = document.querySelectorAll('.rtm-cup');
    var visible = 0, totalCur = 0, totalCap = 0;
    cups.forEach(function (cup) {
      var b = cup.getAttribute('data-basin');
      var s = cup.getAttribute('data-status');
      var basinPass = basinV === 'all' || b === basinV;
      var statusPass = statusV === 'all' || s === statusV;
      var show = basinPass && statusPass;
      cup.style.display = show ? '' : 'none';
      if (show) {
        visible++;
        var idx = +cup.getAttribute('data-idx');
        totalCur += RESERVOIRS[idx].cur;
        totalCap += RESERVOIRS[idx].cap;
      }
    });
    updateTotals(visible, totalCur, totalCap);
  }

  function updateTotals(visible, totalCur, totalCap) {
    if (typeof visible !== 'number') {
      visible = RESERVOIRS.length;
      totalCur = RESERVOIRS.reduce(function (a, r) { return a + r.cur; }, 0);
      totalCap = RESERVOIRS.reduce(function (a, r) { return a + r.cap; }, 0);
    }
    var curNode = document.getElementById('rtm-total-cur');
    var capNode = document.getElementById('rtm-total-cap');
    if (curNode) curNode.textContent = totalCur.toFixed(1) + 'M';
    if (capNode) capNode.textContent = totalCap.toFixed(1) + 'M';
    var tickerText = document.querySelector('#rtm-ticker .rtm-ticker-text');
    if (tickerText) {
      tickerText.innerHTML = visible + ' reservoir' + (visible === 1 ? '' : 's') +
        ' visible &middot; total active storage <strong id="rtm-total-cur">' +
        totalCur.toFixed(1) + 'M</strong> acre-feet against capacity <strong id="rtm-total-cap">' +
        totalCap.toFixed(1) + 'M</strong> acre-feet';
    }
  }

  function wireFilters() {
    document.querySelectorAll('.rtm-pill[data-basin]').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.rtm-pill[data-basin]').forEach(function (x) {
          x.classList.remove('active');
        });
        b.classList.add('active');
        applyFilters();
      });
    });
    document.querySelectorAll('.rtm-pill[data-status]').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.rtm-pill[data-status]').forEach(function (x) {
          x.classList.remove('active');
        });
        b.classList.add('active');
        applyFilters();
      });
    });
  }

  // ─────────────────────────────────────────────────────────
  // 4. ELEVATION CLIFF
  // ─────────────────────────────────────────────────────────

  var CLIFF_STATE = { which: 'both', showTiers: true, showDead: true };

  function renderCliff() {
    var svg = document.getElementById('rtm-cliff');
    if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    var W = 1100, H = 520;
    var pad = { l: 64, r: 32, t: 30, b: 50 };
    var iw = W - pad.l - pad.r;
    var ih = H - pad.t - pad.b;

    var showMead = CLIFF_STATE.which !== 'powell';
    var showPowell = CLIFF_STATE.which !== 'mead';

    // X scale: years 1990 - 2025
    var xMin = 1990, xMax = 2025;
    function xS(y) { return pad.l + ((y - xMin) / (xMax - xMin)) * iw; }

    // Y scale: depends on which series shown
    var ranges = {
      mead:   { min: 990,  max: 1250 },
      powell: { min: 3460, max: 3720 },
      both:   { min: 0,    max: 1 }   // normalized, both share 0-1 frame
    };
    var mode = CLIFF_STATE.which;

    // For 'both' we draw two y-axes (one each side).
    var yMead = { min: 990, max: 1250 };
    var yPowell = { min: 3460, max: 3720 };

    function yMeadS(ft) {
      var t = (ft - yMead.min) / (yMead.max - yMead.min);
      return pad.t + (1 - t) * ih;
    }
    function yPowellS(ft) {
      var t = (ft - yPowell.min) / (yPowell.max - yPowell.min);
      return pad.t + (1 - t) * ih;
    }

    // Axes
    el('line', { class: 'rtm-axis', x1: pad.l, y1: pad.t + ih, x2: pad.l + iw, y2: pad.t + ih }, svg);
    el('line', { class: 'rtm-axis', x1: pad.l, y1: pad.t, x2: pad.l, y2: pad.t + ih }, svg);
    if (mode === 'both') {
      el('line', { class: 'rtm-axis', x1: pad.l + iw, y1: pad.t, x2: pad.l + iw, y2: pad.t + ih }, svg);
    }

    // X ticks every 5 years
    for (var y = xMin; y <= xMax; y += 5) {
      var xx = xS(y);
      el('line', { class: 'rtm-grid', x1: xx, y1: pad.t, x2: xx, y2: pad.t + ih }, svg);
      var tx = el('text', {
        class: 'rtm-axis-label',
        x: xx, y: pad.t + ih + 16,
        'text-anchor': 'middle'
      }, svg);
      tx.textContent = String(y);
    }

    // Y ticks: Mead on the left if visible, else Powell on left.
    function drawYAxis(side, range, yS, label, color) {
      var step = 50;
      for (var f = range.min; f <= range.max; f += step) {
        var ys = yS(f);
        el('line', { class: 'rtm-grid', x1: pad.l, y1: ys, x2: pad.l + iw, y2: ys }, svg);
        var lx = side === 'left' ? pad.l - 8 : pad.l + iw + 8;
        var anchor = side === 'left' ? 'end' : 'start';
        var tx = el('text', {
          class: 'rtm-axis-label',
          x: lx, y: ys + 3, 'text-anchor': anchor
        }, svg);
        tx.textContent = String(f);
      }
      // Axis title
      var ttx = el('text', {
        class: 'rtm-axis-label',
        x: side === 'left' ? 16 : pad.l + iw + 50,
        y: pad.t - 12,
        'text-anchor': side === 'left' ? 'start' : 'end',
        fill: color
      }, svg);
      ttx.textContent = label;
    }

    if (showMead) {
      drawYAxis('left', yMead, yMeadS, 'Mead (ft)', 'var(--rtm-critical)');
    }
    if (showPowell) {
      var side = showMead ? 'right' : 'left';
      drawYAxis(side, yPowell, yPowellS, 'Powell (ft)', 'var(--rtm-water)');
    }

    // Dead-pool floor shading
    if (CLIFF_STATE.showDead) {
      if (showMead) {
        var dy = yMeadS(MEAD_DEAD);
        el('rect', {
          class: 'rtm-dead-fill',
          x: pad.l, y: dy, width: iw, height: pad.t + ih - dy
        }, svg);
        el('line', {
          class: 'rtm-dead-line',
          x1: pad.l, y1: dy, x2: pad.l + iw, y2: dy
        }, svg);
        var dl = el('text', {
          class: 'rtm-tier-label',
          x: pad.l + 4, y: dy - 4,
          fill: 'var(--rtm-critical)'
        }, svg);
        dl.textContent = 'Mead dead pool ' + MEAD_DEAD + ' ft';
      }
      if (showPowell && !showMead) {
        var pdy = yPowellS(POWELL_DEAD);
        el('rect', {
          class: 'rtm-dead-fill',
          x: pad.l, y: pdy, width: iw, height: pad.t + ih - pdy
        }, svg);
        el('line', {
          class: 'rtm-dead-line',
          x1: pad.l, y1: pdy, x2: pad.l + iw, y2: pdy
        }, svg);
        var pdl = el('text', {
          class: 'rtm-tier-label',
          x: pad.l + 4, y: pdy - 4
        }, svg);
        pdl.textContent = 'Powell dead pool ' + POWELL_DEAD + ' ft';
      }
    }

    // Mead policy tiers
    if (CLIFF_STATE.showTiers && showMead) {
      MEAD_TIERS.forEach(function (t) {
        var ty = yMeadS(t.ft);
        el('line', {
          class: 'rtm-tier',
          x1: pad.l, y1: ty, x2: pad.l + iw, y2: ty,
          stroke: 'var(--ink-soft)'
        }, svg);
        var lbl = el('text', {
          class: 'rtm-tier-label',
          x: pad.l + iw - 6, y: ty - 4,
          'text-anchor': 'end'
        }, svg);
        lbl.textContent = t.label + ' (' + t.ft + ' ft)';
      });
    }
    // Powell minimum power pool marker
    if (CLIFF_STATE.showTiers && showPowell) {
      var py = yPowellS(POWELL_MIN_POWER);
      el('line', {
        class: 'rtm-tier',
        x1: pad.l, y1: py, x2: pad.l + iw, y2: py,
        stroke: 'var(--rtm-water)'
      }, svg);
      var lblP = el('text', {
        class: 'rtm-tier-label',
        x: pad.l + 8, y: py - 4,
        fill: 'var(--rtm-water)'
      }, svg);
      lblP.textContent = 'Powell min power pool (' + POWELL_MIN_POWER + ' ft)';
    }

    // Series paths
    function pathD(series, yS) {
      var d = '';
      series.forEach(function (p, i) {
        d += (i === 0 ? 'M' : ' L') + xS(p.y) + ' ' + yS(p.ft);
      });
      return d;
    }

    if (showMead) {
      el('path', {
        class: 'rtm-series rtm-series-mead',
        d: pathD(ELEV_HISTORY.mead, yMeadS)
      }, svg);
      ELEV_HISTORY.mead.forEach(function (p) {
        var c = el('circle', {
          class: 'rtm-series-marker',
          cx: xS(p.y), cy: yMeadS(p.ft), r: 3.5,
          stroke: 'var(--rtm-critical)'
        }, svg);
        c.addEventListener('mouseenter', function (ev) {
          showTip('cliff', ev,
            '<strong>Mead</strong> ' + p.y + '<br>' + p.ft + ' ft');
        });
        c.addEventListener('mouseleave', function () { hideTip('cliff'); });
      });
    }

    if (showPowell) {
      el('path', {
        class: 'rtm-series rtm-series-powell',
        d: pathD(ELEV_HISTORY.powell, yPowellS)
      }, svg);
      ELEV_HISTORY.powell.forEach(function (p) {
        var c = el('circle', {
          class: 'rtm-series-marker',
          cx: xS(p.y), cy: yPowellS(p.ft), r: 3.5,
          stroke: 'var(--rtm-water)'
        }, svg);
        c.addEventListener('mouseenter', function (ev) {
          showTip('cliff', ev,
            '<strong>Powell</strong> ' + p.y + '<br>' + p.ft + ' ft');
        });
        c.addEventListener('mouseleave', function () { hideTip('cliff'); });
      });
    }

    // Annotation: 2022 low point
    if (showMead) {
      var aY = yMeadS(1041);
      var aX = xS(2022);
      var ann = el('text', {
        class: 'rtm-tier-label',
        x: aX - 6, y: aY + 14, 'text-anchor': 'end',
        fill: 'var(--rtm-critical)'
      }, svg);
      ann.textContent = '2022 low 1,040 ft';
    }
  }

  function wireCliff() {
    document.querySelectorAll('.rtm-pill[data-cliff]').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.rtm-pill[data-cliff]').forEach(function (x) {
          x.classList.remove('active');
        });
        b.classList.add('active');
        CLIFF_STATE.which = b.getAttribute('data-cliff');
        renderCliff();
      });
    });
    document.querySelectorAll('.rtm-pill[data-toggle]').forEach(function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-toggle');
        var isOn = b.classList.contains('active');
        if (isOn) {
          b.classList.remove('active');
          b.setAttribute('data-active', 'false');
        } else {
          b.classList.add('active');
          b.setAttribute('data-active', 'true');
        }
        if (key === 'tiers') CLIFF_STATE.showTiers = !isOn;
        if (key === 'dead')  CLIFF_STATE.showDead = !isOn;
        renderCliff();
      });
    });
  }

  // ─────────────────────────────────────────────────────────
  // 5. SCATTER
  // ─────────────────────────────────────────────────────────

  var SCATTER_STATE = { highlight: 'all' };

  function renderScatter() {
    var svg = document.getElementById('rtm-scatter');
    if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    var W = 1100, H = 520;
    var pad = { l: 64, r: 32, t: 30, b: 60 };
    var iw = W - pad.l - pad.r;
    var ih = H - pad.t - pad.b;

    var xMin = 0, xMax = 55;   // April 1 SWE in inches
    var yMin = 0, yMax = 100;  // storage % of capacity
    function xS(v) { return pad.l + (v / xMax) * iw; }
    function yS(v) { return pad.t + (1 - v / yMax) * ih; }

    // Axes
    el('line', { class: 'rtm-axis', x1: pad.l, y1: pad.t + ih, x2: pad.l + iw, y2: pad.t + ih }, svg);
    el('line', { class: 'rtm-axis', x1: pad.l, y1: pad.t, x2: pad.l, y2: pad.t + ih }, svg);

    // Gridlines + ticks
    for (var x = 10; x <= 50; x += 10) {
      var xx = xS(x);
      el('line', { class: 'rtm-grid', x1: xx, y1: pad.t, x2: xx, y2: pad.t + ih }, svg);
      var t = el('text', {
        class: 'rtm-axis-label',
        x: xx, y: pad.t + ih + 16, 'text-anchor': 'middle'
      }, svg);
      t.textContent = String(x);
    }
    for (var yv = 25; yv <= 100; yv += 25) {
      var yy = yS(yv);
      el('line', { class: 'rtm-grid', x1: pad.l, y1: yy, x2: pad.l + iw, y2: yy }, svg);
      var ty = el('text', {
        class: 'rtm-axis-label',
        x: pad.l - 8, y: yy + 3, 'text-anchor': 'end'
      }, svg);
      ty.textContent = String(yv);
    }
    // Axis titles
    var xt = el('text', {
      class: 'rtm-axis-label',
      x: pad.l + iw / 2, y: pad.t + ih + 38, 'text-anchor': 'middle'
    }, svg);
    xt.textContent = 'April 1 snow water equivalent (inches)';
    var yt = el('text', {
      class: 'rtm-axis-label',
      x: 18, y: pad.t + ih / 2,
      transform: 'rotate(-90 18 ' + (pad.t + ih / 2) + ')',
      'text-anchor': 'middle'
    }, svg);
    yt.textContent = 'End-of-water-year storage (% of capacity)';

    // Reference fit line: rough trend storage = 1.7 * SWE + 18
    var fitD = 'M' + xS(0) + ' ' + yS(18) + ' L' + xS(50) + ' ' + yS(18 + 50 * 1.7);
    el('path', { class: 'rtm-scatter-line', d: fitD }, svg);

    // Plot points
    var highlight = SCATTER_STATE.highlight;
    SCATTER.forEach(function (p) {
      var dim = highlight !== 'all' && p.basin !== highlight;
      var c = el('circle', {
        class: 'rtm-scatter-dot' + (dim ? ' is-dim' : ''),
        cx: xS(p.swe), cy: yS(p.store), r: 5,
        'data-basin': p.basin
      }, svg);
      c.addEventListener('mouseenter', function (ev) {
        showTip('scatter', ev,
          '<strong>' + p.basin + '</strong> ' + p.y +
          '<br>SWE ' + p.swe.toFixed(1) + ' in &middot; ' +
          'storage ' + p.store + '%');
      });
      c.addEventListener('mouseleave', function () { hideTip('scatter'); });
    });

    // Legend
    var legendY = pad.t + 6;
    var basins = ['Colorado', 'California', 'Columbia', 'Rio Grande', 'Snake'];
    basins.forEach(function (b, i) {
      var cx = pad.l + iw - 140;
      var ly = legendY + i * 16;
      el('circle', {
        class: 'rtm-scatter-dot',
        cx: cx, cy: ly, r: 5,
        'data-basin': b
      }, svg);
      var ll = el('text', {
        class: 'rtm-axis-label',
        x: cx + 10, y: ly + 3
      }, svg);
      ll.textContent = b;
    });
  }

  function wireScatter() {
    document.querySelectorAll('.rtm-pill[data-scatter]').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.rtm-pill[data-scatter]').forEach(function (x) {
          x.classList.remove('active');
        });
        b.classList.add('active');
        SCATTER_STATE.highlight = b.getAttribute('data-scatter');
        renderScatter();
      });
    });
  }

  // ─────────────────────────────────────────────────────────
  // 6. TOOLTIPS
  // ─────────────────────────────────────────────────────────

  function showTip(which, ev, body) {
    var tip = document.getElementById('rtm-tooltip-' + which);
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
    var tip = document.getElementById('rtm-tooltip-' + which);
    if (tip) tip.hidden = true;
  }

  // ─────────────────────────────────────────────────────────
  // 7. BOOT
  // ─────────────────────────────────────────────────────────

  function init() {
    renderTeacups();
    wireFilters();
    renderCliff();
    wireCliff();
    renderScatter();
    wireScatter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
