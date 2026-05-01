/* Isolation Forest — random splits, anomalies isolate fast. */
(function () {
  'use strict';
  const W = 720, H = 540, PAD = 24;
  let points = [];
  let preset = 'normal-with-outliers';
  let nTrees = 50, threshold = 0.55;
  let svg, presetBtns, treeSlider, treeVal, threshSlider, threshVal, anomCount;
  let forest = [];

  function rand(seed) { return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

  function genPreset(name) {
    const r = rand(name === 'cluster' ? 7 : name === 'two-clusters' ? 13 : 5);
    const arr = [];
    if (name === 'normal-with-outliers') {
      for (let i = 0; i < 80; i++) arr.push({ x: 0.5 + (r() - 0.5) * 0.30, y: 0.5 + (r() - 0.5) * 0.30 });
      // Sprinkle clear outliers
      arr.push({ x: 0.10, y: 0.10 });
      arr.push({ x: 0.90, y: 0.10 });
      arr.push({ x: 0.10, y: 0.90 });
      arr.push({ x: 0.92, y: 0.88 });
      arr.push({ x: 0.05, y: 0.50 });
      arr.push({ x: 0.95, y: 0.50 });
    } else if (name === 'two-clusters') {
      for (let i = 0; i < 50; i++) arr.push({ x: 0.30 + (r() - 0.5) * 0.16, y: 0.35 + (r() - 0.5) * 0.16 });
      for (let i = 0; i < 50; i++) arr.push({ x: 0.70 + (r() - 0.5) * 0.16, y: 0.65 + (r() - 0.5) * 0.16 });
      // outliers between
      arr.push({ x: 0.50, y: 0.50 });
      arr.push({ x: 0.50, y: 0.20 });
      arr.push({ x: 0.50, y: 0.80 });
    } else if (name === 'sparse') {
      for (let i = 0; i < 30; i++) arr.push({ x: 0.20 + r() * 0.60, y: 0.20 + r() * 0.60 });
    }
    return arr;
  }

  // Build one isolation tree on a sub-sample of points
  function buildITree(samplePoints, rng, depth, maxDepth) {
    if (samplePoints.length <= 1 || depth >= maxDepth) {
      return { leaf: true, size: samplePoints.length };
    }
    // Pick random feature
    const feature = rng() < 0.5 ? 'x' : 'y';
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < samplePoints.length; i++) {
      const v = samplePoints[i][feature];
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    if (mn === mx) return { leaf: true, size: samplePoints.length };
    const threshold = mn + rng() * (mx - mn);
    const left = []; const right = [];
    samplePoints.forEach(function (p) {
      if (p[feature] < threshold) left.push(p); else right.push(p);
    });
    return {
      leaf: false,
      feature, threshold,
      left: buildITree(left, rng, depth + 1, maxDepth),
      right: buildITree(right, rng, depth + 1, maxDepth),
    };
  }
  function pathLength(tree, p, depth) {
    if (tree.leaf) {
      // Average path length adjustment for unfinished trees
      const n = tree.size;
      if (n <= 1) return depth;
      return depth + (2 * (Math.log(n - 1) + 0.5772) - (2 * (n - 1) / n));
    }
    const v = p[tree.feature];
    return v < tree.threshold ? pathLength(tree.left, p, depth + 1) : pathLength(tree.right, p, depth + 1);
  }
  function buildForest() {
    forest = [];
    if (points.length === 0) return;
    const subSize = Math.min(64, points.length);
    const maxDepth = Math.ceil(Math.log2(subSize));
    for (let i = 0; i < nTrees; i++) {
      const r = rand(i * 31 + 7);
      const sample = [];
      for (let j = 0; j < subSize; j++) {
        sample.push(points[Math.floor(r() * points.length)]);
      }
      forest.push(buildITree(sample, r, 0, maxDepth));
    }
  }
  function anomalyScore(p) {
    const subSize = Math.min(64, points.length || 1);
    const c = 2 * (Math.log(subSize - 1 || 1) + 0.5772) - (2 * (subSize - 1) / (subSize || 1));
    let sumPath = 0;
    forest.forEach(function (tree) { sumPath += pathLength(tree, p, 0); });
    const avgPath = sumPath / forest.length;
    return Math.pow(2, -avgPath / (c || 1));
  }

  function render() {
    if (!svg) return;
    let inner = '<rect x="' + PAD + '" y="' + PAD + '" width="' + (W - 2 * PAD) + '" height="' + (H - 2 * PAD) + '" fill="var(--paper)" stroke="var(--ink-dim)" stroke-width="0.6"/>';

    // Anomaly contour shading
    if (forest.length > 0) {
      const grid = 50;
      for (let i = 0; i < grid; i++) {
        for (let j = 0; j < grid; j++) {
          const x = (i + 0.5) / grid;
          const y = (j + 0.5) / grid;
          const score = anomalyScore({ x, y });
          const px = PAD + i / grid * (W - 2 * PAD);
          const py = PAD + j / grid * (H - 2 * PAD);
          const cw = (W - 2 * PAD) / grid + 1;
          const ch = (H - 2 * PAD) / grid + 1;
          // High score = anomalous
          const intensity = Math.max(0, Math.min(1, (score - 0.4) * 2.5));
          inner += '<rect x="' + px.toFixed(1) + '" y="' + py.toFixed(1) + '" width="' + cw.toFixed(1) + '" height="' + ch.toFixed(1) +
                   '" fill="color-mix(in oklab, var(--accent) ' + (intensity * 30).toFixed(0) + '%, transparent)"/>';
        }
      }
    }

    // Points: color by anomaly score
    let anomalies = 0;
    points.forEach(function (p) {
      const score = forest.length > 0 ? anomalyScore(p) : 0;
      const isAnom = score > threshold;
      if (isAnom) anomalies++;
      const px = PAD + p.x * (W - 2 * PAD);
      const py = PAD + p.y * (H - 2 * PAD);
      const fill = isAnom ? 'var(--accent)' : 'var(--ink)';
      const r = isAnom ? 5.5 : 3.4;
      const ring = isAnom ? '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="10" fill="none" stroke="var(--accent)" stroke-width="1" opacity="0.5"/>' : '';
      inner += ring + '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="' + r + '" fill="' + fill + '" stroke="var(--paper)" stroke-width="1.4"/>';
    });
    svg.innerHTML = inner;

    anomCount.textContent = String(anomalies) + ' / ' + String(points.length);
  }

  function loadPreset(name) {
    preset = name;
    points = genPreset(name);
    presetBtns.forEach(function (b) { b.classList.toggle('is-active', b.dataset.preset === name); });
    buildForest();
    render();
  }

  function init() {
    svg = document.getElementById('if-canvas');
    if (!svg) return;
    presetBtns = document.querySelectorAll('.if-preset');
    treeSlider = document.getElementById('if-trees'); treeVal = document.getElementById('if-trees-val');
    threshSlider = document.getElementById('if-thresh'); threshVal = document.getElementById('if-thresh-val');
    anomCount = document.getElementById('if-anom');

    presetBtns.forEach(function (b) { b.addEventListener('click', function () { loadPreset(b.dataset.preset); }); });
    treeSlider.addEventListener('input', function () {
      nTrees = parseInt(treeSlider.value, 10);
      treeVal.textContent = String(nTrees);
      buildForest();
      render();
    });
    threshSlider.addEventListener('input', function () {
      threshold = parseFloat(threshSlider.value);
      threshVal.textContent = threshold.toFixed(2);
      render();
    });

    loadPreset('normal-with-outliers');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
