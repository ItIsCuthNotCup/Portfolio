/* ═══════════════════════════════════════════════════════════════════
   RANDOM FOREST DESTINATION — bootstrapped tree ensemble.
   Train n trees on bootstrap samples + random feature subsets, then
   the boundary becomes the majority-vote across them. Small-multiples
   row of 5 sample trees underneath shows the ensemble.
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const W = 720, H = 540, PAD = 28;
  let points = [];
  let preset = 'moons';
  let nTrees = 30, maxDepth = 6;
  let svgB, smallMultsEl, accVal, treesVal, depthVal, presetBtns, treeSlider, depthSlider;
  let forest = [];

  function rand(seed) { return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

  function genPreset(name) {
    const r = rand(name === 'moons' ? 7 : name === 'spiral' ? 11 : 3);
    const arr = [];
    if (name === 'blobs') {
      const centers = [[0.3, 0.30, 0], [0.70, 0.30, 1], [0.30, 0.70, 1], [0.70, 0.70, 0]];
      centers.forEach(function (c) {
        for (let i = 0; i < 30; i++) {
          arr.push({ x: Math.max(0, Math.min(1, c[0] + (r() - 0.5) * 0.20)),
                     y: Math.max(0, Math.min(1, c[1] + (r() - 0.5) * 0.20)),
                     cls: c[2] });
        }
      });
    } else if (name === 'moons') {
      for (let i = 0; i < 60; i++) {
        const t = i / 59 * Math.PI;
        arr.push({ x: 0.5 - 0.30 * Math.cos(t) + (r() - 0.5) * 0.06, y: 0.55 - 0.20 * Math.sin(t) + (r() - 0.5) * 0.06, cls: 0 });
      }
      for (let i = 0; i < 60; i++) {
        const t = i / 59 * Math.PI;
        arr.push({ x: 0.5 + 0.30 * Math.cos(t) + (r() - 0.5) * 0.06, y: 0.45 + 0.20 * Math.sin(t) + (r() - 0.5) * 0.06, cls: 1 });
      }
    } else if (name === 'spiral') {
      for (let cls = 0; cls < 2; cls++) {
        for (let i = 0; i < 60; i++) {
          const t = i / 59 * 4 + cls * Math.PI;
          const radius = i / 59 * 0.32;
          arr.push({ x: Math.max(0, Math.min(1, 0.5 + radius * Math.cos(t) + (r() - 0.5) * 0.04)),
                     y: Math.max(0, Math.min(1, 0.5 + radius * Math.sin(t) + (r() - 0.5) * 0.04)), cls });
        }
      }
    }
    return arr;
  }

  function gini(p0, p1) { const t = p0 + p1; if (t === 0) return 0; const a = p0 / t, b = p1 / t; return 1 - a * a - b * b; }

  // Decision tree (with optional feature bagging — pass feature list)
  function buildTree(pts, depth, maxDepth, featureSubset, randFn) {
    const n = pts.length;
    let p0 = 0, p1 = 0;
    for (let i = 0; i < n; i++) { if (pts[i].cls === 0) p0++; else p1++; }
    const label = p0 >= p1 ? 0 : 1;
    if (depth >= maxDepth || n < 4 || p0 === 0 || p1 === 0) return { leaf: true, label };
    let best = null;
    featureSubset.forEach(function (f) {
      const sorted = pts.slice().sort(function (a, b) { return f === 0 ? a.x - b.x : a.y - b.y; });
      // Sample at most ~12 candidate thresholds to keep training fast.
      const step = Math.max(1, Math.floor(sorted.length / 12));
      for (let i = step; i < sorted.length; i += step) {
        const v = (f === 0 ? sorted[i].x : sorted[i].y);
        const vp = (f === 0 ? sorted[i - 1].x : sorted[i - 1].y);
        if (v === vp) continue;
        const t = (v + vp) / 2;
        let l0 = 0, l1 = 0, r0 = 0, r1 = 0;
        for (let j = 0; j < n; j++) {
          const fv = f === 0 ? pts[j].x : pts[j].y;
          if (fv < t) { if (pts[j].cls === 0) l0++; else l1++; } else { if (pts[j].cls === 0) r0++; else r1++; }
        }
        const lN = l0 + l1, rN = r0 + r1;
        if (lN === 0 || rN === 0) continue;
        const g = (lN * gini(l0, l1) + rN * gini(r0, r1)) / n;
        if (best === null || g < best.gini) best = { gini: g, feature: f, threshold: t };
      }
    });
    if (!best) return { leaf: true, label };
    const left = pts.filter(function (p) { const fv = best.feature === 0 ? p.x : p.y; return fv < best.threshold; });
    const right = pts.filter(function (p) { const fv = best.feature === 0 ? p.x : p.y; return fv >= best.threshold; });
    // For 2D feature space, randomly pick 1 feature per split (mtry=1) for variety.
    const nextSubset = [Math.floor(randFn() * 2)];
    return {
      leaf: false,
      feature: best.feature,
      threshold: best.threshold,
      left: buildTree(left, depth + 1, maxDepth, nextSubset, randFn),
      right: buildTree(right, depth + 1, maxDepth, nextSubset, randFn),
    };
  }
  function predictTree(node, x, y) {
    while (!node.leaf) { const fv = node.feature === 0 ? x : y; node = fv < node.threshold ? node.left : node.right; }
    return node.label;
  }

  function buildForest() {
    forest = [];
    for (let i = 0; i < nTrees; i++) {
      const r = rand(i * 137 + 7);
      // Bootstrap sample
      const sample = [];
      for (let j = 0; j < points.length; j++) {
        const idx = Math.floor(r() * points.length);
        sample.push(points[idx]);
      }
      // Initial feature subset = random 1 of 2
      const initialSubset = [Math.floor(r() * 2)];
      forest.push(buildTree(sample, 0, maxDepth, initialSubset, r));
    }
  }
  function predictForest(x, y) {
    let s0 = 0, s1 = 0;
    for (let i = 0; i < forest.length; i++) {
      if (predictTree(forest[i], x, y) === 0) s0++; else s1++;
    }
    return s0 >= s1 ? 0 : 1;
  }
  function predictForestProb(x, y) {
    let s1 = 0;
    for (let i = 0; i < forest.length; i++) {
      if (predictTree(forest[i], x, y) === 1) s1++;
    }
    return s1 / forest.length;
  }

  function trainAccuracy() {
    if (points.length === 0) return 0;
    let c = 0;
    for (let i = 0; i < points.length; i++) {
      if (predictForest(points[i].x, points[i].y) === points[i].cls) c++;
    }
    return c / points.length;
  }

  function renderBoundary() {
    const grid = 60;
    let inner = '';
    inner += '<rect x="' + PAD + '" y="' + PAD + '" width="' + (W - 2 * PAD) + '" height="' + (H - 2 * PAD) + '" fill="var(--paper)" stroke="var(--ink-dim)" stroke-width="0.6"/>';
    for (let i = 0; i < grid; i++) {
      for (let j = 0; j < grid; j++) {
        const x = (i + 0.5) / grid;
        const y = (j + 0.5) / grid;
        const prob = predictForestProb(x, y); // 0..1 probability of class 1
        const px = PAD + i / grid * (W - 2 * PAD);
        const py = PAD + j / grid * (H - 2 * PAD);
        const cw = (W - 2 * PAD) / grid;
        const ch = (H - 2 * PAD) / grid;
        // smooth shading by probability
        const opacity = Math.abs(prob - 0.5) * 1.6;
        const fill = prob > 0.5
          ? 'color-mix(in oklab, var(--accent) ' + (12 + opacity * 30).toFixed(0) + '%, transparent)'
          : 'color-mix(in oklab, var(--ink) ' + (12 + opacity * 30).toFixed(0) + '%, transparent)';
        inner += '<rect x="' + px.toFixed(2) + '" y="' + py.toFixed(2) + '" width="' + cw.toFixed(2) + '" height="' + ch.toFixed(2) + '" fill="' + fill + '"/>';
      }
    }
    points.forEach(function (p) {
      const px = PAD + p.x * (W - 2 * PAD);
      const py = PAD + p.y * (H - 2 * PAD);
      const fill = p.cls === 0 ? 'var(--ink)' : 'var(--accent)';
      inner += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="3.6" fill="' + fill + '" stroke="var(--paper)" stroke-width="1"/>';
    });
    svgB.innerHTML = inner;
  }

  function renderSmallMultiples() {
    if (!smallMultsEl) return;
    // Render the first 5 trees' individual boundaries on a small canvas each
    let html = '';
    for (let t = 0; t < Math.min(5, forest.length); t++) {
      const tree = forest[t];
      const grid = 18;
      const cw = 100, ch = 75;
      let inner = '<svg viewBox="0 0 100 75" xmlns="http://www.w3.org/2000/svg" class="rf-mini">';
      inner += '<rect x="0" y="0" width="100" height="75" fill="var(--paper)" stroke="var(--ink-dim)" stroke-width="0.4"/>';
      for (let i = 0; i < grid; i++) {
        for (let j = 0; j < grid; j++) {
          const x = (i + 0.5) / grid;
          const y = (j + 0.5) / grid;
          const c = predictTree(tree, x, y);
          const px = (i / grid) * 100;
          const py = (j / grid) * 75;
          const w = 100 / grid;
          const h = 75 / grid;
          const fill = c === 0 ? 'color-mix(in oklab, var(--ink) 18%, transparent)' : 'color-mix(in oklab, var(--accent) 28%, transparent)';
          inner += '<rect x="' + px.toFixed(1) + '" y="' + py.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" fill="' + fill + '"/>';
        }
      }
      inner += '</svg>';
      html += '<div class="rf-mini-wrap">' +
              '<div class="rf-mini-label">tree ' + (t + 1) + '</div>' + inner + '</div>';
    }
    smallMultsEl.innerHTML = html;
  }

  function refit() {
    buildForest();
    renderBoundary();
    renderSmallMultiples();
    accVal.textContent = (trainAccuracy() * 100).toFixed(1) + '%';
  }

  function loadPreset(name) {
    preset = name;
    points = genPreset(name);
    presetBtns.forEach(function (b) { b.classList.toggle('is-active', b.dataset.preset === name); });
    refit();
  }

  function init() {
    svgB = document.getElementById('rf-boundary');
    if (!svgB) return;
    smallMultsEl = document.getElementById('rf-mults');
    accVal = document.getElementById('rf-acc');
    treesVal = document.getElementById('rf-trees-val');
    depthVal = document.getElementById('rf-depth-val');
    presetBtns = document.querySelectorAll('.rf-preset');
    treeSlider = document.getElementById('rf-trees');
    depthSlider = document.getElementById('rf-depth');

    presetBtns.forEach(function (b) {
      b.addEventListener('click', function () { loadPreset(b.dataset.preset); });
    });
    treeSlider.addEventListener('input', function () {
      nTrees = parseInt(treeSlider.value, 10);
      treesVal.textContent = String(nTrees);
      refit();
    });
    depthSlider.addEventListener('input', function () {
      maxDepth = parseInt(depthSlider.value, 10);
      depthVal.textContent = String(maxDepth);
      refit();
    });

    loadPreset('moons');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
