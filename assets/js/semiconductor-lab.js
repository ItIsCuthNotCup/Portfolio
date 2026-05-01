/* ═══════════════════════════════════════════════════════════
   SEMICONDUCTOR CARTOGRAPHY — TEST. 02
   Map, flows, and chokepoints. Vanilla JS + SVG.
   ═══════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  const DATA_PATH = '/assets/data/semiconductor/supply-chain.json';
  let scData = null;

  async function loadData() {
    try {
      const res = await fetch(DATA_PATH);
      scData = await res.json();
      initCharts();
    } catch (e) {
      console.error('Failed to load semiconductor data', e);
    }
  }

  /* ── SVG utilities ─────────────────────────────────────────── */
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    attrs = attrs || {};
    for (const k of Object.keys(attrs)) el.setAttribute(k, attrs[k]);
    return el;
  }

  function makeScale(domain, range) {
    const d0 = domain[0], d1 = domain[1];
    const r0 = range[0], r1 = range[1];
    return function(v) {
      return r0 + (v - d0) / (d1 - d0) * (r1 - r0);
    };
  }

  /* ── Tooltip system ────────────────────────────────────────── */
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

  /* ── Continent outlines (very simplified) ──────────────────── */
  // These are hand-traced rough continent shapes in lat/lon,
  // rendered onto the equirectangular projection.
  const CONTINENTS = [
    {
      name: 'North America',
      points: [
        [-165,72],[-140,70],[-120,75],[-100,80],[-80,85],[-60,80],[-50,60],
        [-55,50],[-60,45],[-70,45],[-80,40],[-85,30],[-90,25],[-95,20],
        [-100,20],[-105,25],[-110,30],[-115,30],[-120,35],[-125,40],
        [-130,45],[-135,55],[-140,60],[-150,65],[-160,70],[-165,72]
      ]
    },
    {
      name: 'South America',
      points: [
        [-80,10],[-70,10],[-60,5],[-55,0],[-50,-5],[-45,-10],[-40,-15],
        [-38,-20],[-38,-25],[-40,-30],[-45,-35],[-50,-40],[-55,-45],
        [-60,-50],[-65,-50],[-70,-45],[-75,-40],[-75,-30],[-73,-20],
        [-70,-10],[-72,0],[-75,5],[-78,8],[-80,10]
      ]
    },
    {
      name: 'Europe',
      points: [
        [-10,72],[-5,70],[5,72],[15,70],[25,70],[35,72],[40,70],[45,65],
        [50,60],[45,55],[40,50],[35,45],[30,40],[25,35],[20,35],[15,38],
        [10,42],[5,45],[0,50],[-5,55],[-10,60],[-10,65],[-10,72]
      ]
    },
    {
      name: 'Africa',
      points: [
        [-18,32],[-10,30],[0,30],[10,32],[20,32],[30,32],[35,30],[40,28],
        [42,25],[45,20],[50,15],[52,10],[50,5],[48,0],[45,-5],[40,-10],
        [35,-15],[30,-20],[25,-25],[20,-30],[15,-25],[10,-20],[5,-15],
        [0,-10],[-5,-5],[-10,0],[-12,5],[-15,10],[-17,15],[-17,20],
        [-16,25],[-17,30],[-18,32]
      ]
    },
    {
      name: 'Asia',
      points: [
        [40,75],[50,75],[60,72],[70,72],[80,75],[90,75],[100,72],[110,70],
        [120,65],[130,60],[140,55],[145,50],[140,45],[135,40],[130,35],
        [125,30],[120,25],[115,20],[110,18],[105,15],[100,10],[95,8],
        [90,10],[85,15],[80,10],[75,8],[70,10],[65,15],[60,20],[55,22],
        [50,20],[45,15],[40,12],[35,15],[30,20],[25,25],[20,30],[25,35],
        [30,40],[35,45],[38,50],[40,55],[42,60],[43,65],[42,70],[40,75]
      ]
    },
    {
      name: 'Australia',
      points: [
        [115,-12],[120,-12],[125,-15],[130,-18],[135,-20],[140,-22],
        [145,-25],[148,-30],[150,-35],[150,-38],[145,-40],[140,-38],
        [135,-35],[130,-32],[125,-30],[120,-28],[115,-25],[113,-20],
        [113,-15],[115,-12]
      ]
    }
  ];

  /* ── Chart 1: The Map ──────────────────────────────────────── */
  function renderMap() {
    if (!scData) return;
    const svg = document.getElementById('sc-map');
    const wrap = document.getElementById('sc-map-wrap');
    const tip = document.getElementById('sc-tooltip-map');
    const showTip = setupTooltip(wrap, tip);
    const W = 1100, H = 520;
    const M = { t: 24, r: 24, b: 36, l: 24 };
    const mapW = W - M.l - M.r;
    const mapH = H - M.t - M.b;

    const lonScale = makeScale([-180, 180], [M.l, M.l + mapW]);
    const latScale = makeScale([90, -90], [M.t, M.t + mapH]);

    const layerColor = {};
    scData.layers.forEach(l => { layerColor[l.id] = l.color; });

    let activeLayer = 'all';
    let showFlows = false;

    function project(pt) {
      return { x: lonScale(pt[0]), y: latScale(pt[1]) };
    }

    function pathFromPoints(pts) {
      return pts.map((p, i) => {
        const q = project(p);
        return (i ? 'L' : 'M') + q.x.toFixed(1) + ',' + q.y.toFixed(1);
      }).join('');
    }

    function draw() {
      svg.innerHTML = '';

      // Grid lines (lat/lon)
      for (let lon = -180; lon <= 180; lon += 30) {
        const x = lonScale(lon);
        svg.appendChild(svgEl('line', {
          x1: x, x2: x, y1: M.t, y2: M.t + mapH,
          stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.12
        }));
      }
      for (let lat = -60; lat <= 60; lat += 30) {
        const y = latScale(lat);
        svg.appendChild(svgEl('line', {
          x1: M.l, x2: M.l + mapW, y1: y, y2: y,
          stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.12
        }));
      }

      // Continent outlines
      CONTINENTS.forEach(c => {
        const d = pathFromPoints(c.points) + 'Z';
        svg.appendChild(svgEl('path', {
          d: d, class: 'sc-map-continent'
        }));
      });

      // Edges (flows) — drawn behind nodes
      if (showFlows) {
        scData.edges.forEach(e => {
          const fromNode = scData.nodes.find(n => n.id === e.from);
          const toNode = scData.nodes.find(n => n.id === e.to);
          if (!fromNode || !toNode) return;
          const fromVisible = activeLayer === 'all' || fromNode.layer === activeLayer;
          const toVisible = activeLayer === 'all' || toNode.layer === activeLayer;
          if (!fromVisible || !toVisible) return;

          const x1 = lonScale(fromNode.lon);
          const y1 = latScale(fromNode.lat);
          const x2 = lonScale(toNode.lon);
          const y2 = latScale(toNode.lat);
          const mx = (x1 + x2) / 2;
          const my = Math.min(y1, y2) - 40;
          const d = 'M' + x1.toFixed(1) + ',' + y1.toFixed(1) +
                    ' Q' + mx.toFixed(1) + ',' + my.toFixed(1) +
                    ' ' + x2.toFixed(1) + ',' + y2.toFixed(1);
          const color = layerColor[fromNode.layer] || '#999';
          svg.appendChild(svgEl('path', {
            d: d, class: 'sc-map-flow',
            stroke: color, 'stroke-width': 1.2
          }));
        });
      }

      // Nodes
      const visibleNodes = scData.nodes.filter(n =>
        activeLayer === 'all' || n.layer === activeLayer
      );

      visibleNodes.forEach(n => {
        const cx = lonScale(n.lon);
        const cy = latScale(n.lat);
        const color = layerColor[n.layer] || '#999';
        const r = activeLayer === 'all' ? 5 : 7;

        const circle = svgEl('circle', {
          cx: cx, cy: cy, r: r,
          fill: color,
          stroke: 'var(--paper)', 'stroke-width': 1.5,
          class: 'sc-map-node'
        });
        circle.addEventListener('mouseenter', function(e) {
          showTip(
            '<div style="font-weight:500;margin-bottom:4px;">' + n.name + '</div>' +
            '<div style="opacity:0.8;">' + n.country + ' &middot; ' + n.note + '</div>',
            e.offsetX, e.offsetY
          );
        });
        circle.addEventListener('mouseleave', function() {
          hideTooltip(tip);
        });
        svg.appendChild(circle);

        // Label (only when filtering to a single layer, or for key nodes)
        const isKey = ['tsmc','asml','nvidia','samsung-fab','intel'].indexOf(n.id) >= 0;
        if (activeLayer !== 'all' || isKey) {
          const lbl = svgEl('text', {
            x: cx + 10, y: cy - 8,
            class: 'sc-map-label'
          });
          lbl.textContent = n.name;
          svg.appendChild(lbl);
        }
      });

      // Legend (bottom-left)
      const legendY = H - 16;
      let legX = M.l;
      scData.layers.forEach((l, i) => {
        if (activeLayer !== 'all' && l.id !== activeLayer) return;
        svg.appendChild(svgEl('circle', {
          cx: legX + 4, cy: legendY, r: 3.5, fill: l.color
        }));
        const t = svgEl('text', {
          x: legX + 12, y: legendY + 3,
          class: 'sc-map-legend'
        });
        t.textContent = l.label;
        svg.appendChild(t);
        legX += 16 + l.label.length * 5.5 + 18;
      });
    }

    draw();

    // Layer toggle
    document.querySelectorAll('[data-layer]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('[data-layer]').forEach(function(b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        activeLayer = btn.dataset.layer;
        draw();
      });
    });

    // Flows toggle
    const flowBtn = document.getElementById('sc-toggle-flows');
    if (flowBtn) {
      flowBtn.addEventListener('click', function() {
        showFlows = !showFlows;
        flowBtn.dataset.active = String(showFlows);
        flowBtn.classList.toggle('active', showFlows);
        draw();
      });
    }
  }

  /* ── Chart 2: The Flows ────────────────────────────────────── */
  function renderFlows() {
    if (!scData) return;
    const svg = document.getElementById('sc-flow');
    const wrap = document.getElementById('sc-flow-wrap');
    const tip = document.getElementById('sc-tooltip-flow');
    const showTip = setupTooltip(wrap, tip);
    const W = 1100, H = 420;
    const M = { t: 50, r: 40, b: 40, l: 40 };

    const layerColor = {};
    scData.layers.forEach(l => { layerColor[l.id] = l.color; });

    const layerOrder = scData.layers.map(l => l.id);
    const colCount = layerOrder.length;
    const colWidth = (W - M.l - M.r) / (colCount - 1);

    let flowView = 'all';

    // Critical edges: those touching TSMC, ASML, or NVIDIA as primary bottlenecks
    const criticalNodeIds = new Set(['tsmc','asml','nvidia','samsung-mem','skhynix']);
    function isCriticalEdge(e) {
      return criticalNodeIds.has(e.from) || criticalNodeIds.has(e.to);
    }

    function draw() {
      svg.innerHTML = '';

      // Build column positions for each node
      const nodesByLayer = {};
      layerOrder.forEach(lid => {
        nodesByLayer[lid] = scData.nodes.filter(n => n.layer === lid);
      });

      const nodePositions = {};
      layerOrder.forEach((lid, colIdx) => {
        const nodes = nodesByLayer[lid];
        const cx = M.l + colIdx * colWidth;
        const count = nodes.length;
        const spacing = Math.min(56, (H - M.t - M.b - 40) / Math.max(count, 1));
        const totalH = (count - 1) * spacing;
        const startY = (H - totalH) / 2;
        nodes.forEach((n, i) => {
          nodePositions[n.id] = { x: cx, y: startY + i * spacing, node: n };
        });

        // Layer label at top
        const label = svgEl('text', {
          x: cx, y: M.t - 18,
          'text-anchor': 'middle',
          class: 'sc-flow-layer-label'
        });
        const layerDef = scData.layers.find(l => l.id === lid);
        label.textContent = layerDef ? layerDef.label : lid;
        svg.appendChild(label);
      });

      // Draw connections
      const edgesToDraw = flowView === 'critical'
        ? scData.edges.filter(isCriticalEdge)
        : scData.edges;

      edgesToDraw.forEach(function(e) {
        const p1 = nodePositions[e.from];
        const p2 = nodePositions[e.to];
        if (!p1 || !p2) return;
        const mx = (p1.x + p2.x) / 2;
        const d = 'M' + p1.x.toFixed(1) + ',' + p1.y.toFixed(1) +
                  ' C' + mx.toFixed(1) + ',' + p1.y.toFixed(1) +
                  ' ' + mx.toFixed(1) + ',' + p2.y.toFixed(1) +
                  ' ' + p2.x.toFixed(1) + ',' + p2.y.toFixed(1);
        const color = layerColor[p1.node.layer] || '#999';
        svg.appendChild(svgEl('path', {
          d: d, class: 'sc-flow-connector',
          stroke: color, 'stroke-width': 1.5
        }));
      });

      // Draw nodes
      Object.values(nodePositions).forEach(function(pos) {
        const n = pos.node;
        const color = layerColor[n.layer] || '#999';
        const rect = svgEl('rect', {
          x: pos.x - 8, y: pos.y - 8, width: 16, height: 16, rx: 3,
          fill: color, stroke: 'var(--paper)', 'stroke-width': 1.5,
          class: 'sc-flow-node'
        });
        rect.addEventListener('mouseenter', function(e) {
          showTip(
            '<div style="font-weight:500;margin-bottom:4px;">' + n.name + '</div>' +
            '<div style="opacity:0.8;">' + n.note + '</div>',
            e.offsetX, e.offsetY
          );
        });
        rect.addEventListener('mouseleave', function() {
          hideTooltip(tip);
        });
        svg.appendChild(rect);

        // Label below node
        const lbl = svgEl('text', {
          x: pos.x, y: pos.y + 22,
          'text-anchor': 'middle',
          class: 'sc-flow-node-label'
        });
        lbl.textContent = n.name;
        svg.appendChild(lbl);
      });
    }

    draw();

    document.querySelectorAll('[data-flow-view]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('[data-flow-view]').forEach(function(b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        flowView = btn.dataset.flowView;
        draw();
      });
    });
  }

  /* ── Chart 3: The Chokepoints ──────────────────────────────── */
  function renderChokepoints() {
    if (!scData) return;
    const grid = document.getElementById('sc-stat-grid');
    const svg = document.getElementById('sc-hhi-chart');

    // Stat cards
    const chokepoints = scData.chokepoints || [];
    grid.innerHTML = '';
    chokepoints.forEach(function(c) {
      const card = document.createElement('div');
      card.className = 'sc-stat-card';
      card.innerHTML =
        '<div class="sc-stat-metric">' + c.metric + '</div>' +
        '<div class="sc-stat-value">' + c.share + '<span style="font-size:18px;margin-left:2px;">%</span></div>' +
        '<div class="sc-stat-leader">' + c.leader + '</div>' +
        '<div class="sc-stat-risk">' + c.risk + '</div>';
      grid.appendChild(card);
    });

    // HHI bar chart
    const concentration = scData.concentration || [];
    const W = 1100, H = 260;
    const M = { t: 40, r: 40, b: 60, l: 160 };
    const barW = (W - M.l - M.r) / concentration.length - 24;
    const maxHHI = 10000;
    const hhiScale = makeScale([0, maxHHI], [0, H - M.t - M.b]);

    svg.innerHTML = '';

    // Y-axis title + source
    svg.appendChild(svgEl('text', {
      x: M.l - 60, y: M.t - 14, 'text-anchor': 'start',
      fill: 'var(--ink-dim)', 'font-size': 10, 'font-family': 'DM Mono, monospace',
      'letter-spacing': '0.10em'
    })).textContent = 'HERFINDAHL–HIRSCHMAN INDEX (0–10,000)';
    svg.appendChild(svgEl('text', {
      x: W - M.r, y: M.t - 14, 'text-anchor': 'end',
      fill: 'var(--ink-dim)', 'font-size': 9, 'font-family': 'DM Mono, monospace',
      'font-style': 'italic'
    })).textContent = 'Source: industry market-share reports (Knometa, TrendForce, IDC)';

    // Threshold line at 2500 (high concentration)
    const thresholdY = H - M.b - hhiScale(2500);
    svg.appendChild(svgEl('line', {
      x1: M.l, x2: W - M.r, y1: thresholdY, y2: thresholdY,
      stroke: 'var(--accent)', 'stroke-width': 1, 'stroke-dasharray': '6,4', opacity: 0.7
    }));
    const threshLbl = svgEl('text', {
      x: W - M.r - 4, y: thresholdY - 6,
      'text-anchor': 'end', fill: 'var(--accent)',
      'font-size': 10, 'font-family': 'DM Mono, monospace'
    });
    threshLbl.textContent = 'HHI 2,500 (high concentration)';
    svg.appendChild(threshLbl);

    // Y-axis grid lines
    [0, 2500, 5000, 7500, 10000].forEach(function(tick) {
      const y = H - M.b - hhiScale(tick);
      svg.appendChild(svgEl('line', {
        x1: M.l, x2: W - M.r, y1: y, y2: y,
        stroke: 'var(--ink-dim)', 'stroke-width': 0.5, opacity: 0.2
      }));
      svg.appendChild(svgEl('text', {
        x: M.l - 8, y: y + 4,
        'text-anchor': 'end', fill: 'var(--ink-dim)',
        'font-size': 10, 'font-family': 'DM Mono, monospace'
      })).textContent = tick;
    });

    // Base line
    svg.appendChild(svgEl('line', {
      x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b,
      stroke: 'var(--ink)', 'stroke-width': 1
    }));

    // Bars
    concentration.forEach(function(c, i) {
      const x = M.l + i * (barW + 32) + 16;
      const barH = hhiScale(c.hhi);
      const y = H - M.b - barH;
      const layerDef = scData.layers.find(l => l.id === c.layer);
      const color = layerDef ? layerDef.color : '#888';

      svg.appendChild(svgEl('rect', {
        x: x, y: y, width: barW, height: barH,
        fill: color, opacity: 0.85
      }));

      // Value label on top of bar
      svg.appendChild(svgEl('text', {
        x: x + barW / 2, y: y - 8,
        'text-anchor': 'middle', fill: 'var(--ink)',
        'font-size': 12, 'font-family': 'DM Mono, monospace', 'font-weight': 500
      })).textContent = c.hhi.toLocaleString();

      // Layer label below bar
      const labelText = layerDef ? layerDef.label : c.layer;
      svg.appendChild(svgEl('text', {
        x: x + barW / 2, y: H - M.b + 20,
        'text-anchor': 'middle', fill: 'var(--ink-soft)',
        'font-size': 10, 'font-family': 'DM Mono, monospace'
      })).textContent = labelText;

      // Note below layer label
      svg.appendChild(svgEl('text', {
        x: x + barW / 2, y: H - M.b + 38,
        'text-anchor': 'middle', fill: 'var(--ink-dim)',
        'font-size': 9, 'font-family': 'DM Mono, monospace'
      })).textContent = c.note;
    });
  }

  /* ── Synthesis widget ──────────────────────────────────────── */
  function initSynthesis() {
    const tabs = document.querySelectorAll('.sc-syn-tab');
    const panels = document.querySelectorAll('.sc-syn-panel');
    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        var read = tab.dataset.read;
        tabs.forEach(function(t) { t.classList.remove('active'); });
        panels.forEach(function(p) { p.classList.remove('active'); });
        tab.classList.add('active');
        var target = document.querySelector('.sc-syn-panel[data-read="' + read + '"]');
        if (target) target.classList.add('active');
      });
    });
  }

  /* ── Dateline time ─────────────────────────────────────────── */
  function setDateline() {
    var el = document.getElementById('dateline-time');
    if (!el) return;
    var now = new Date();
    var opts = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    el.textContent = now.toLocaleDateString('en-US', opts);
  }

  /* ── Initialize all ────────────────────────────────────────── */
  function initCharts() {
    renderMap();
    renderFlows();
    renderChokepoints();
    initSynthesis();
    setDateline();
  }

  /* ── Kickoff ───────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadData);
  } else {
    loadData();
  }
})();
