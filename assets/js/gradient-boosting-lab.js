/* Gradient Boosting — sequentially fit small trees to residuals. */
(function () {
  'use strict';
  const W = 720, H = 540, PAD = 24;
  let points = [];
  let preset = 'moons';
  let nIter = 30, lr = 0.3, maxDepth = 3;
  let svg, presetBtns, iterSlider, iterVal, lrSlider, lrVal, depthSlider, depthVal, accVal;
  let trees = []; // array of fitted tree objects
  let predictions = {}; // cache by point index

  function rand(seed) { return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

  function genPreset(name) {
    const r = rand(name === 'moons' ? 7 : 5);
    const arr = [];
    if (name === 'moons') {
      for (let i = 0; i < 50; i++) {
        const t = i / 49 * Math.PI;
        arr.push({ x: 0.5 - 0.30 * Math.cos(t) + (r() - 0.5) * 0.06, y: 0.55 - 0.20 * Math.sin(t) + (r() - 0.5) * 0.06, cls: -1 });
      }
      for (let i = 0; i < 50; i++) {
        const t = i / 49 * Math.PI;
        arr.push({ x: 0.5 + 0.30 * Math.cos(t) + (r() - 0.5) * 0.06, y: 0.45 + 0.20 * Math.sin(t) + (r() - 0.5) * 0.06, cls: 1 });
      }
    } else if (name === 'spiral') {
      for (let cls = 0; cls < 2; cls++) {
        for (let i = 0; i < 60; i++) {
          const t = i / 59 * 4 + cls * Math.PI;
          const radius = i / 59 * 0.32;
          arr.push({ x: Math.max(0, Math.min(1, 0.5 + radius * Math.cos(t) + (r() - 0.5) * 0.04)),
                     y: Math.max(0, Math.min(1, 0.5 + radius * Math.sin(t) + (r() - 0.5) * 0.04)),
                     cls: cls === 0 ? -1 : 1 });
        }
      }
    } else if (name === 'noisy') {
      for (let i = 0; i < 80; i++) {
        const x = Math.random();
        const y = Math.random();
        const cls = (x + y > 1.0) ? 1 : -1;
        arr.push({ x, y, cls: Math.random() < 0.15 ? -cls : cls });  // 15% label noise
      }
    }
    return arr;
  }

  // Build a regression tree to predict residuals (depth-limited)
  function buildRegTree(pts, depth, maxDepth, targets) {
    const n = pts.length;
    if (n === 0) return { leaf: true, val: 0 };
    let mean = 0;
    for (let i = 0; i < n; i++) mean += targets[i];
    mean = mean / n;
    if (depth >= maxDepth || n < 4) return { leaf: true, val: mean };
    let best = null;
    for (let f = 0; f < 2; f++) {
      const indices = pts.map(function (_, i) { return i; }).sort(function (a, b) {
        return (f === 0 ? pts[a].x - pts[b].x : pts[a].y - pts[b].y);
      });
      // Sample threshold candidates
      const step = Math.max(1, Math.floor(indices.length / 8));
      for (let i = step; i < indices.length; i += step) {
        const v = (f === 0 ? pts[indices[i]].x : pts[indices[i]].y);
        const vp = (f === 0 ? pts[indices[i - 1]].x : pts[indices[i - 1]].y);
        if (v === vp) continue;
        const t = (v + vp) / 2;
        let lSum = 0, rSum = 0, lN = 0, rN = 0;
        for (let j = 0; j < n; j++) {
          const fv = f === 0 ? pts[j].x : pts[j].y;
          if (fv < t) { lSum += targets[j]; lN++; } else { rSum += targets[j]; rN++; }
        }
        if (lN === 0 || rN === 0) continue;
        const lMean = lSum / lN, rMean = rSum / rN;
        let sse = 0;
        for (let j = 0; j < n; j++) {
          const fv = f === 0 ? pts[j].x : pts[j].y;
          const m = fv < t ? lMean : rMean;
          sse += (targets[j] - m) * (targets[j] - m);
        }
        if (best === null || sse < best.sse) best = { sse, feature: f, threshold: t };
      }
    }
    if (!best) return { leaf: true, val: mean };
    const leftIdx = [], rightIdx = [];
    for (let i = 0; i < n; i++) {
      const fv = best.feature === 0 ? pts[i].x : pts[i].y;
      if (fv < best.threshold) leftIdx.push(i); else rightIdx.push(i);
    }
    return {
      leaf: false,
      feature: best.feature, threshold: best.threshold,
      left: buildRegTree(leftIdx.map(function (i) { return pts[i]; }), depth + 1, maxDepth, leftIdx.map(function (i) { return targets[i]; })),
      right: buildRegTree(rightIdx.map(function (i) { return pts[i]; }), depth + 1, maxDepth, rightIdx.map(function (i) { return targets[i]; })),
    };
  }
  function predTree(tree, x, y) {
    while (!tree.leaf) {
      const fv = tree.feature === 0 ? x : y;
      tree = fv < tree.threshold ? tree.left : tree.right;
    }
    return tree.val;
  }

  function trainAll() {
    trees = [];
    if (points.length === 0) { render(); return; }
    // Initialize predictions to 0
    let preds = points.map(function () { return 0; });
    for (let it = 0; it < nIter; it++) {
      // Residuals = y - p (using ±1 labels and squared error gradient)
      const residuals = points.map(function (p, i) { return p.cls - preds[i]; });
      const tree = buildRegTree(points, 0, maxDepth, residuals);
      trees.push(tree);
      // Update predictions
      for (let i = 0; i < points.length; i++) {
        preds[i] += lr * predTree(tree, points[i].x, points[i].y);
      }
    }
    render();
  }

  function predEnsemble(x, y) {
    let s = 0;
    for (let i = 0; i < trees.length; i++) s += lr * predTree(trees[i], x, y);
    return Math.sign(s) || 1;
  }
  function predScore(x, y) {
    let s = 0;
    for (let i = 0; i < trees.length; i++) s += lr * predTree(trees[i], x, y);
    return s;
  }
  function trainAccuracy() {
    if (points.length === 0) return 0;
    let c = 0;
    for (let i = 0; i < points.length; i++) {
      if (predEnsemble(points[i].x, points[i].y) === points[i].cls) c++;
    }
    return c / points.length;
  }

  function render() {
    if (!svg) return;
    let inner = '<rect x="' + PAD + '" y="' + PAD + '" width="' + (W - 2 * PAD) + '" height="' + (H - 2 * PAD) + '" fill="var(--paper)" stroke="var(--ink-dim)" stroke-width="0.6"/>';
    if (trees.length > 0) {
      const grid = 50;
      for (let i = 0; i < grid; i++) {
        for (let j = 0; j < grid; j++) {
          const x = (i + 0.5) / grid;
          const y = (j + 0.5) / grid;
          const score = predScore(x, y);
          const cls = score >= 0 ? 1 : -1;
          const intensity = Math.min(1, Math.abs(score) * 0.6);
          const px = PAD + i / grid * (W - 2 * PAD);
          const py = PAD + j / grid * (H - 2 * PAD);
          const cw = (W - 2 * PAD) / grid + 1;
          const ch = (H - 2 * PAD) / grid + 1;
          const fill = cls === -1
            ? 'color-mix(in oklab, var(--ink) ' + (8 + intensity * 22).toFixed(0) + '%, transparent)'
            : 'color-mix(in oklab, var(--accent) ' + (8 + intensity * 22).toFixed(0) + '%, transparent)';
          inner += '<rect x="' + px.toFixed(1) + '" y="' + py.toFixed(1) + '" width="' + cw.toFixed(1) + '" height="' + ch.toFixed(1) + '" fill="' + fill + '"/>';
        }
      }
    }
    points.forEach(function (p) {
      const px = PAD + p.x * (W - 2 * PAD);
      const py = PAD + p.y * (H - 2 * PAD);
      const fill = p.cls === -1 ? 'var(--ink)' : 'var(--accent)';
      inner += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="3.6" fill="' + fill + '" stroke="var(--paper)" stroke-width="1"/>';
    });
    svg.innerHTML = inner;
    accVal.textContent = (trainAccuracy() * 100).toFixed(1) + '%';
  }

  function loadPreset(name) {
    preset = name;
    points = genPreset(name);
    presetBtns.forEach(function (b) { b.classList.toggle('is-active', b.dataset.preset === name); });
    trainAll();
  }

  function init() {
    svg = document.getElementById('gb-canvas');
    if (!svg) return;
    presetBtns = document.querySelectorAll('.gb-preset');
    iterSlider = document.getElementById('gb-iter'); iterVal = document.getElementById('gb-iter-val');
    lrSlider = document.getElementById('gb-lr'); lrVal = document.getElementById('gb-lr-val');
    depthSlider = document.getElementById('gb-depth'); depthVal = document.getElementById('gb-depth-val');
    accVal = document.getElementById('gb-acc');

    presetBtns.forEach(function (b) { b.addEventListener('click', function () { loadPreset(b.dataset.preset); }); });
    iterSlider.addEventListener('input', function () { nIter = parseInt(iterSlider.value, 10); iterVal.textContent = String(nIter); trainAll(); });
    lrSlider.addEventListener('input', function () { lr = parseFloat(lrSlider.value); lrVal.textContent = lr.toFixed(2); trainAll(); });
    depthSlider.addEventListener('input', function () { maxDepth = parseInt(depthSlider.value, 10); depthVal.textContent = String(maxDepth); trainAll(); });

    loadPreset('moons');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
