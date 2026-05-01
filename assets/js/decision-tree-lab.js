/* ═══════════════════════════════════════════════════════════════════
   DECISION TREE DESTINATION — recursive axis-aligned splits.
   Dual-viz: 2D feature space with the partition + tree diagram of
   the same model. Depth slider controls overfit/underfit.
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const W = 720, H = 540, PAD = 28;
  let points = [];
  let preset = 'blobs';
  let maxDepth = 4;
  let svgB, svgT, depthVal, depthSlider, accVal, leavesVal, presetBtns, depthMaxNote;

  function rand(seed) {
    return function () {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  function genPreset(name) {
    const r = rand(name === 'moons' ? 7 : name === 'spiral' ? 11 : 3);
    const arr = [];
    if (name === 'blobs') {
      const centers = [[0.3, 0.30, 0], [0.70, 0.30, 1], [0.30, 0.70, 1], [0.70, 0.70, 0]];
      centers.forEach(function (c) {
        for (let i = 0; i < 30; i++) {
          arr.push({
            x: Math.max(0, Math.min(1, c[0] + (r() - 0.5) * 0.20)),
            y: Math.max(0, Math.min(1, c[1] + (r() - 0.5) * 0.20)),
            cls: c[2],
          });
        }
      });
    } else if (name === 'moons') {
      for (let i = 0; i < 60; i++) {
        const t = i / 59 * Math.PI;
        const x = 0.5 - 0.30 * Math.cos(t) + (r() - 0.5) * 0.06;
        const y = 0.55 - 0.20 * Math.sin(t) + (r() - 0.5) * 0.06;
        arr.push({ x, y, cls: 0 });
      }
      for (let i = 0; i < 60; i++) {
        const t = i / 59 * Math.PI;
        const x = 0.5 + 0.30 * Math.cos(t) + (r() - 0.5) * 0.06;
        const y = 0.45 + 0.20 * Math.sin(t) + (r() - 0.5) * 0.06;
        arr.push({ x, y, cls: 1 });
      }
    } else if (name === 'spiral') {
      for (let cls = 0; cls < 2; cls++) {
        for (let i = 0; i < 60; i++) {
          const t = i / 59 * 4 + cls * Math.PI;
          const radius = i / 59 * 0.32;
          arr.push({
            x: Math.max(0, Math.min(1, 0.5 + radius * Math.cos(t) + (r() - 0.5) * 0.04)),
            y: Math.max(0, Math.min(1, 0.5 + radius * Math.sin(t) + (r() - 0.5) * 0.04)),
            cls: cls,
          });
        }
      }
    }
    return arr;
  }

  // Recursive tree fit. Returns { feature, threshold, left, right, label, n }.
  // Picks the split with the lowest weighted Gini impurity.
  function gini(p0, p1) {
    const total = p0 + p1;
    if (total === 0) return 0;
    const a = p0 / total, b = p1 / total;
    return 1 - a * a - b * b;
  }
  function buildTree(pts, depth, maxDepth) {
    const n = pts.length;
    let p0 = 0, p1 = 0;
    for (let i = 0; i < n; i++) {
      if (pts[i].cls === 0) p0++; else p1++;
    }
    const label = p0 >= p1 ? 0 : 1;
    if (depth >= maxDepth || n < 4 || p0 === 0 || p1 === 0) {
      return { leaf: true, label, n, p0, p1 };
    }
    let best = null;
    for (let f = 0; f < 2; f++) {
      const sorted = pts.slice().sort(function (a, b) {
        return f === 0 ? a.x - b.x : a.y - b.y;
      });
      for (let i = 1; i < sorted.length; i++) {
        const v = (f === 0 ? sorted[i].x : sorted[i].y);
        const vp = (f === 0 ? sorted[i - 1].x : sorted[i - 1].y);
        if (v === vp) continue;
        const t = (v + vp) / 2;
        let l0 = 0, l1 = 0, r0 = 0, r1 = 0;
        for (let j = 0; j < n; j++) {
          const fv = f === 0 ? pts[j].x : pts[j].y;
          if (fv < t) {
            if (pts[j].cls === 0) l0++; else l1++;
          } else {
            if (pts[j].cls === 0) r0++; else r1++;
          }
        }
        const lN = l0 + l1, rN = r0 + r1;
        if (lN === 0 || rN === 0) continue;
        const g = (lN * gini(l0, l1) + rN * gini(r0, r1)) / n;
        if (best === null || g < best.gini) {
          best = { gini: g, feature: f, threshold: t };
        }
      }
    }
    if (!best) return { leaf: true, label, n, p0, p1 };
    const left = pts.filter(function (p) {
      const fv = best.feature === 0 ? p.x : p.y;
      return fv < best.threshold;
    });
    const right = pts.filter(function (p) {
      const fv = best.feature === 0 ? p.x : p.y;
      return fv >= best.threshold;
    });
    return {
      leaf: false,
      feature: best.feature,
      threshold: best.threshold,
      left: buildTree(left, depth + 1, maxDepth),
      right: buildTree(right, depth + 1, maxDepth),
      n: n,
    };
  }
  function predict(node, x, y) {
    while (!node.leaf) {
      const fv = node.feature === 0 ? x : y;
      node = fv < node.threshold ? node.left : node.right;
    }
    return node.label;
  }
  function countLeaves(node) {
    if (node.leaf) return 1;
    return countLeaves(node.left) + countLeaves(node.right);
  }
  function trainAccuracy(tree, pts) {
    let correct = 0;
    for (let i = 0; i < pts.length; i++) {
      if (predict(tree, pts[i].x, pts[i].y) === pts[i].cls) correct++;
    }
    return pts.length === 0 ? 0 : correct / pts.length;
  }

  // ── Render boundary panel ──────────────────────────────────────────
  function renderBoundary(tree) {
    const grid = 64;
    let inner = '';
    inner += '<rect x="' + PAD + '" y="' + PAD + '" width="' + (W - 2 * PAD) + '" height="' + (H - 2 * PAD) +
             '" fill="var(--paper)" stroke="var(--ink-dim)" stroke-width="0.6"/>';
    // Decision regions (raster of cells)
    for (let i = 0; i < grid; i++) {
      for (let j = 0; j < grid; j++) {
        const x = (i + 0.5) / grid;
        const y = (j + 0.5) / grid;
        const c = predict(tree, x, y);
        const px = PAD + i / grid * (W - 2 * PAD);
        const py = PAD + j / grid * (H - 2 * PAD);
        const cw = (W - 2 * PAD) / grid;
        const ch = (H - 2 * PAD) / grid;
        const fill = c === 0 ? 'color-mix(in oklab, var(--ink) 12%, transparent)' : 'color-mix(in oklab, var(--accent) 22%, transparent)';
        inner += '<rect x="' + px.toFixed(2) + '" y="' + py.toFixed(2) + '" width="' + cw.toFixed(2) +
                 '" height="' + ch.toFixed(2) + '" fill="' + fill + '" stroke="none"/>';
      }
    }
    // Points
    points.forEach(function (p) {
      const px = PAD + p.x * (W - 2 * PAD);
      const py = PAD + p.y * (H - 2 * PAD);
      const fill = p.cls === 0 ? 'var(--ink)' : 'var(--accent)';
      inner += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="3.6" fill="' + fill +
               '" stroke="var(--paper)" stroke-width="1"/>';
    });
    svgB.innerHTML = inner;
  }

  // ── Render tree diagram ───────────────────────────────────────────
  function renderTree(tree) {
    // Recursive layout: each node knows its depth and horizontal slot.
    const TW = 720, TH = 540, MARGIN = 30;
    function layout(node, depth, leftBound, rightBound) {
      node.depth = depth;
      node.cx = (leftBound + rightBound) / 2;
      node.cy = MARGIN + depth * ((TH - 2 * MARGIN) / (maxDepth + 1));
      if (!node.leaf) {
        layout(node.left, depth + 1, leftBound, (leftBound + rightBound) / 2);
        layout(node.right, depth + 1, (leftBound + rightBound) / 2, rightBound);
      }
    }
    layout(tree, 0, MARGIN, TW - MARGIN);
    let inner = '';
    function drawEdges(node) {
      if (node.leaf) return;
      [node.left, node.right].forEach(function (c) {
        inner += '<line x1="' + node.cx.toFixed(1) + '" y1="' + node.cy.toFixed(1) +
                 '" x2="' + c.cx.toFixed(1) + '" y2="' + c.cy.toFixed(1) +
                 '" stroke="var(--ink-dim)" stroke-width="0.8"/>';
        drawEdges(c);
      });
    }
    function drawNodes(node) {
      if (node.leaf) {
        const fill = node.label === 0 ? 'var(--ink)' : 'var(--accent)';
        inner += '<circle cx="' + node.cx.toFixed(1) + '" cy="' + node.cy.toFixed(1) +
                 '" r="6" fill="' + fill + '" stroke="var(--paper)" stroke-width="1.5"/>';
      } else {
        inner += '<circle cx="' + node.cx.toFixed(1) + '" cy="' + node.cy.toFixed(1) +
                 '" r="14" fill="var(--paper)" stroke="var(--ink)" stroke-width="1"/>';
        const featLabel = node.feature === 0 ? 'x' : 'y';
        inner += '<text x="' + node.cx.toFixed(1) + '" y="' + (node.cy + 1).toFixed(1) +
                 '" text-anchor="middle" dominant-baseline="middle" font-family="DM Mono,monospace" font-size="10" fill="var(--ink)">' +
                 featLabel + '&lt;' + node.threshold.toFixed(2).replace(/^0/, '.') + '</text>';
        drawNodes(node.left);
        drawNodes(node.right);
      }
    }
    drawEdges(tree);
    drawNodes(tree);
    svgT.innerHTML = inner;
  }

  function refit() {
    const tree = buildTree(points, 0, maxDepth);
    renderBoundary(tree);
    renderTree(tree);
    const acc = trainAccuracy(tree, points);
    accVal.textContent = (acc * 100).toFixed(1) + '%';
    leavesVal.textContent = String(countLeaves(tree));
  }

  function loadPreset(name) {
    preset = name;
    points = genPreset(name);
    presetBtns.forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.preset === name);
    });
    refit();
  }

  function init() {
    svgB = document.getElementById('dt-boundary');
    svgT = document.getElementById('dt-tree');
    if (!svgB || !svgT) return;
    depthVal = document.getElementById('dt-depth-val');
    depthSlider = document.getElementById('dt-depth');
    accVal = document.getElementById('dt-acc');
    leavesVal = document.getElementById('dt-leaves');
    presetBtns = document.querySelectorAll('.dt-preset');

    presetBtns.forEach(function (b) {
      b.addEventListener('click', function () { loadPreset(b.dataset.preset); });
    });
    depthSlider.addEventListener('input', function () {
      maxDepth = parseInt(depthSlider.value, 10);
      depthVal.textContent = String(maxDepth);
      refit();
    });

    loadPreset('blobs');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
