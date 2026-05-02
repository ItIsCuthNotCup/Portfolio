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

  /* ── Continent outlines (simplified silhouettes in lat/lon) ─────
     Each polygon traces a recognisable continent shape with 30–80
     vertices — enough resolution to read as a world map at the lab's
     1100×520 viewport without blowing up the file. Hand-tuned from
     Natural Earth 110m data, then simplified for clarity. */
  const CONTINENTS = [
    {
      name: 'North America',
      points: [
        [-168,66],[-164,68],[-156,71],[-150,70],[-140,69],[-130,70],
        [-120,71],[-110,72],[-100,73],[-90,73],[-82,74],[-75,73],
        [-68,71],[-66,67],[-65,63],[-78,62],[-78,55],[-65,55],
        [-62,48],[-66,44],[-70,42],[-75,38],[-77,35],[-80,32],
        [-82,28],[-80,26],[-80,25],[-83,25],[-86,30],[-89,29],
        [-92,30],[-94,29],[-95,26],[-97,22],[-97,18],[-94,16],
        [-90,14],[-88,16],[-86,15],[-83,13],[-80,9],[-78,9],
        [-79,12],[-83,16],[-87,17],[-90,18],[-94,19],[-97,21],
        [-100,22],[-104,22],[-107,25],[-110,28],[-114,30],
        [-117,32],[-120,34],[-122,37],[-124,40],[-124,46],
        [-124,48],[-130,54],[-135,57],[-141,60],[-148,60],
        [-152,58],[-158,56],[-162,54],[-164,57],[-167,60],
        [-168,66]
      ]
    },
    {
      name: 'Greenland',
      points: [
        [-50,83],[-30,83],[-20,80],[-22,76],[-20,70],[-25,64],
        [-35,60],[-43,60],[-50,63],[-55,68],[-55,75],[-50,83]
      ]
    },
    {
      name: 'South America',
      points: [
        [-78,11],[-72,12],[-66,11],[-60,8],[-54,5],[-50,3],
        [-48,0],[-46,-2],[-43,-3],[-39,-4],[-36,-7],[-35,-10],
        [-37,-15],[-39,-19],[-41,-22],[-44,-23],[-47,-25],
        [-50,-27],[-54,-30],[-58,-34],[-61,-38],[-64,-41],
        [-66,-44],[-69,-48],[-71,-52],[-72,-54],[-71,-54],
        [-70,-50],[-72,-47],[-74,-44],[-74,-40],[-74,-36],
        [-72,-32],[-72,-28],[-71,-24],[-71,-20],[-71,-16],
        [-72,-12],[-75,-8],[-78,-6],[-79,-3],[-79,0],
        [-78,3],[-77,6],[-78,11]
      ]
    },
    {
      name: 'Europe',
      points: [
        [-10,55],[-7,58],[-3,58],[0,60],[5,62],[8,64],[14,68],
        [18,69],[22,70],[26,71],[30,69],[28,65],[32,64],[35,63],
        [40,65],[40,68],[45,67],[50,68],[55,68],[55,64],[58,60],
        [55,56],[50,55],[45,52],[40,48],[36,45],[32,42],[28,40],
        [24,38],[22,35],[18,37],[14,38],[10,38],[6,37],[3,36],
        [-2,36],[-6,37],[-9,38],[-9,42],[-7,44],[-2,44],[2,46],
        [4,48],[2,50],[-2,49],[-5,50],[-3,52],[-5,55],[-10,55]
      ]
    },
    {
      name: 'Britain & Ireland',
      points: [
        [-10,52],[-8,55],[-6,58],[-3,59],[0,58],[2,55],[1,52],
        [-2,51],[-5,50],[-8,51],[-10,52]
      ]
    },
    {
      name: 'Scandinavia',
      points: [
        [4,58],[8,58],[12,57],[16,59],[20,63],[22,66],[25,69],
        [28,71],[28,68],[25,64],[24,60],[20,59],[16,59],[12,58],[4,58]
      ]
    },
    {
      name: 'Africa',
      points: [
        [-17,21],[-12,18],[-9,15],[-6,13],[-3,11],[2,12],[6,11],
        [10,9],[14,8],[18,9],[22,11],[26,11],[30,15],[33,20],
        [33,24],[33,28],[33,31],[30,31],[26,31],[22,32],[18,33],
        [14,34],[10,35],[5,35],[1,36],[-3,35],[-6,33],[-9,32],
        [-12,28],[-13,25],[-15,22],[-17,21],[-17,16],[-16,14],
        [-15,12],[-13,9],[-11,7],[-9,5],[-7,4],[-3,5],[0,4],
        [3,4],[7,4],[9,1],[12,-2],[14,-5],[14,-9],[12,-12],
        [13,-15],[14,-19],[18,-22],[20,-25],[22,-29],[24,-31],
        [27,-32],[30,-31],[31,-29],[33,-27],[35,-23],[37,-20],
        [40,-18],[42,-15],[42,-11],[41,-7],[42,-3],[43,1],
        [46,4],[48,7],[51,10],[51,12],[48,12],[45,11],[42,11],
        [38,8],[35,5],[32,2],[30,-1],[28,-4],[27,-9],[25,-13],
        [22,-15],[19,-13],[16,-9],[14,-5],[14,-1],[12,2],
        [10,5],[8,7],[6,8],[3,8],[0,5],[-3,4],[-7,5],[-9,7],
        [-12,11],[-15,16],[-17,21]
      ]
    },
    {
      name: 'Madagascar',
      points: [
        [44,-12],[47,-13],[50,-16],[50,-22],[48,-25],[45,-25],
        [44,-22],[44,-17],[44,-12]
      ]
    },
    {
      name: 'Asia',
      points: [
        [30,42],[35,45],[40,48],[45,52],[50,55],[55,58],[60,60],
        [65,65],[70,68],[78,71],[85,72],[95,73],[105,73],[115,73],
        [125,71],[135,68],[140,65],[143,60],[145,57],[143,53],
        [140,50],[133,48],[131,46],[133,42],[130,40],[127,38],
        [125,35],[122,32],[121,28],[118,24],[115,22],[112,21],
        [110,19],[108,15],[107,12],[108,9],[107,6],[105,5],
        [103,4],[100,5],[97,7],[100,10],[100,14],[97,16],
        [94,18],[91,21],[89,21],[86,22],[82,21],[78,21],
        [76,18],[78,14],[80,11],[82,8],[80,7],[78,9],[75,12],
        [73,18],[70,21],[68,24],[66,25],[64,25],[62,24],[59,22],
        [56,17],[54,13],[52,15],[50,18],[48,21],[46,25],[45,29],
        [43,32],[40,34],[37,36],[34,35],[32,38],[30,42]
      ]
    },
    {
      name: 'Indonesia (composite)',
      points: [
        [95,5],[100,4],[105,2],[110,0],[115,-2],[120,-4],
        [125,-7],[130,-9],[133,-7],[136,-3],[136,0],[131,2],
        [125,3],[120,3],[115,4],[110,5],[105,5],[100,6],[95,5]
      ]
    },
    {
      name: 'Japan',
      points: [
        [130,32],[133,34],[136,36],[140,38],[142,42],[143,44],
        [141,42],[138,40],[135,37],[132,34],[130,32]
      ]
    },
    {
      name: 'Australia',
      points: [
        [114,-22],[118,-20],[122,-17],[127,-14],[131,-12],
        [134,-12],[137,-13],[141,-12],[144,-13],[146,-19],
        [148,-22],[151,-25],[153,-28],[153,-32],[150,-37],
        [146,-39],[140,-38],[136,-35],[132,-33],[127,-32],
        [122,-32],[118,-32],[115,-30],[114,-26],[114,-22]
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
