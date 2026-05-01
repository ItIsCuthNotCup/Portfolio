/* ═══════════════════════════════════════════════════════════════════
   K-MEANS DESTINATION — Lloyd's algorithm, drawn step-by-step.
   Click anywhere to seed centroids manually, or press Run to iterate
   automatically. k slider controls cluster count.
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const W = 720, H = 540, PAD = 24;
  let points = [];
  let centroids = [];
  let assignments = [];
  let k = 4;
  let iter = 0, inertia = 0;
  let running = false, animTimer = null;
  let preset = 'blobs';

  let svg, kVal, kSlider, presetBtns, runBtn, stepBtn, resetBtn;
  let iterVal, inertiaVal, kReadout;
  const COLORS = ['var(--accent)', 'var(--ink-soft)', 'var(--accent-2)', 'var(--ink-dim)', 'var(--ink)', '#7E6F4F', '#9C5A4A', '#586D7B'];

  function rand(seed) { return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

  function genPreset(name) {
    const r = rand(name === 'blobs' ? 5 : name === 'rings' ? 13 : 21);
    const arr = [];
    if (name === 'blobs') {
      const centers = [[0.25, 0.25], [0.75, 0.30], [0.30, 0.78], [0.78, 0.74]];
      centers.forEach(function (c) {
        for (let i = 0; i < 28; i++) {
          arr.push({ x: c[0] + (r() - 0.5) * 0.16, y: c[1] + (r() - 0.5) * 0.16 });
        }
      });
    } else if (name === 'uniform') {
      for (let i = 0; i < 110; i++) {
        arr.push({ x: 0.05 + r() * 0.90, y: 0.05 + r() * 0.90 });
      }
    } else if (name === 'rings') {
      // Two concentric rings — the failure case for k-means
      const rings = [{ rad: 0.16, n: 50 }, { rad: 0.36, n: 80 }];
      rings.forEach(function (ring) {
        for (let i = 0; i < ring.n; i++) {
          const t = (i + r() * 0.4) / ring.n * Math.PI * 2;
          arr.push({ x: 0.5 + Math.cos(t) * ring.rad + (r() - 0.5) * 0.02, y: 0.5 + Math.sin(t) * ring.rad + (r() - 0.5) * 0.02 });
        }
      });
    }
    return arr.filter(function (p) { return p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1; });
  }

  function seedCentroids() {
    centroids = [];
    if (points.length === 0) return;
    // K-means++ seeding: first centroid random, subsequent ones weighted by squared distance
    const r = rand(99);
    centroids.push({ x: points[0].x, y: points[0].y });
    for (let i = 1; i < k; i++) {
      let totalD = 0;
      const dists = points.map(function (p) {
        let m = Infinity;
        centroids.forEach(function (c) {
          const d = (p.x - c.x) * (p.x - c.x) + (p.y - c.y) * (p.y - c.y);
          if (d < m) m = d;
        });
        totalD += m;
        return m;
      });
      let pick = r() * totalD;
      for (let j = 0; j < points.length; j++) {
        pick -= dists[j];
        if (pick <= 0) {
          centroids.push({ x: points[j].x, y: points[j].y });
          break;
        }
      }
    }
    iter = 0;
  }

  function assign() {
    assignments = points.map(function (p) {
      let best = 0, bd = Infinity;
      for (let i = 0; i < centroids.length; i++) {
        const d = (p.x - centroids[i].x) * (p.x - centroids[i].x) + (p.y - centroids[i].y) * (p.y - centroids[i].y);
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    });
  }
  function step() {
    if (centroids.length === 0) seedCentroids();
    assign();
    // Recompute centroids
    const sums = centroids.map(function () { return { x: 0, y: 0, n: 0 }; });
    points.forEach(function (p, i) {
      const c = assignments[i];
      sums[c].x += p.x;
      sums[c].y += p.y;
      sums[c].n += 1;
    });
    let moved = 0;
    centroids = sums.map(function (s, i) {
      if (s.n === 0) return centroids[i]; // keep stale centroid
      const nx = s.x / s.n, ny = s.y / s.n;
      moved += Math.abs(nx - centroids[i].x) + Math.abs(ny - centroids[i].y);
      return { x: nx, y: ny };
    });
    // Inertia
    inertia = 0;
    points.forEach(function (p, i) {
      const c = centroids[assignments[i]];
      inertia += (p.x - c.x) * (p.x - c.x) + (p.y - c.y) * (p.y - c.y);
    });
    iter++;
    render();
    return moved < 0.001;
  }

  function render() {
    if (!svg) return;
    let inner = '';
    inner += '<rect x="' + PAD + '" y="' + PAD + '" width="' + (W - 2 * PAD) + '" height="' + (H - 2 * PAD) + '" fill="var(--paper)" stroke="var(--ink-dim)" stroke-width="0.6"/>';
    // Voronoi-ish shading: light fill per cluster (sample grid)
    if (centroids.length) {
      const grid = 50;
      for (let i = 0; i < grid; i++) {
        for (let j = 0; j < grid; j++) {
          const x = (i + 0.5) / grid;
          const y = (j + 0.5) / grid;
          let best = 0, bd = Infinity;
          for (let q = 0; q < centroids.length; q++) {
            const d = (x - centroids[q].x) * (x - centroids[q].x) + (y - centroids[q].y) * (y - centroids[q].y);
            if (d < bd) { bd = d; best = q; }
          }
          const px = PAD + i / grid * (W - 2 * PAD);
          const py = PAD + j / grid * (H - 2 * PAD);
          const cw = (W - 2 * PAD) / grid;
          const ch = (H - 2 * PAD) / grid;
          inner += '<rect x="' + px.toFixed(1) + '" y="' + py.toFixed(1) + '" width="' + cw.toFixed(1) + '" height="' + ch.toFixed(1) +
                   '" fill="' + COLORS[best % COLORS.length] + '" opacity="0.08"/>';
        }
      }
    }
    // Points
    points.forEach(function (p, i) {
      const px = PAD + p.x * (W - 2 * PAD);
      const py = PAD + p.y * (H - 2 * PAD);
      const c = assignments.length ? COLORS[assignments[i] % COLORS.length] : 'var(--ink)';
      inner += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="3.4" fill="' + c + '" opacity="0.9"/>';
    });
    // Centroids
    centroids.forEach(function (c, i) {
      const px = PAD + c.x * (W - 2 * PAD);
      const py = PAD + c.y * (H - 2 * PAD);
      const color = COLORS[i % COLORS.length];
      inner += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="10" fill="none" stroke="' + color + '" stroke-width="2.2"/>';
      inner += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="3" fill="' + color + '"/>';
    });
    svg.innerHTML = inner;

    iterVal.textContent = String(iter);
    inertiaVal.textContent = inertia.toFixed(3);
    kReadout.textContent = String(k);
  }

  function resetAll() {
    stopAnim();
    centroids = [];
    assignments = [];
    iter = 0;
    inertia = 0;
    seedCentroids();
    render();
  }

  function startAnim() {
    if (running) return;
    running = true;
    runBtn.textContent = 'Pause';
    function tick() {
      if (!running) return;
      const converged = step();
      if (converged || iter > 30) { stopAnim(); return; }
      animTimer = setTimeout(tick, 220);
    }
    tick();
  }
  function stopAnim() {
    running = false;
    if (animTimer) { clearTimeout(animTimer); animTimer = null; }
    if (runBtn) runBtn.textContent = 'Run';
  }

  function loadPreset(name) {
    stopAnim();
    preset = name;
    points = genPreset(name);
    presetBtns.forEach(function (b) { b.classList.toggle('is-active', b.dataset.preset === name); });
    resetAll();
  }

  function init() {
    svg = document.getElementById('km-canvas');
    if (!svg) return;
    kVal = document.getElementById('km-k-val');
    kSlider = document.getElementById('km-k');
    presetBtns = document.querySelectorAll('.km-preset');
    runBtn = document.getElementById('km-run');
    stepBtn = document.getElementById('km-step');
    resetBtn = document.getElementById('km-reset');
    iterVal = document.getElementById('km-iter');
    inertiaVal = document.getElementById('km-inertia');
    kReadout = document.getElementById('km-k-readout');

    presetBtns.forEach(function (b) { b.addEventListener('click', function () { loadPreset(b.dataset.preset); }); });
    kSlider.addEventListener('input', function () {
      stopAnim();
      k = parseInt(kSlider.value, 10);
      kVal.textContent = String(k);
      resetAll();
    });
    runBtn.addEventListener('click', function () { running ? stopAnim() : startAnim(); });
    stepBtn.addEventListener('click', function () { stopAnim(); step(); });
    resetBtn.addEventListener('click', function () { resetAll(); });

    loadPreset('blobs');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
