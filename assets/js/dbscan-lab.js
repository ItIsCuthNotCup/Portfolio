/* DBSCAN — density-based clustering. eps + minPts sliders. */
(function () {
  'use strict';
  const W = 720, H = 540, PAD = 24;
  let points = [];
  let preset = 'rings';
  let eps = 0.05, minPts = 4;
  let labels = [];
  let svg, presetBtns, epsSlider, epsVal, minPtsSlider, minPtsVal, kVal, noiseVal;
  const COLORS = ['var(--accent)', 'var(--accent-2)', 'var(--ink-soft)', '#7E6F4F', '#9C5A4A', '#586D7B', '#9C8B53'];

  function rand(seed) { return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

  function genPreset(name) {
    const r = rand(name === 'rings' ? 5 : name === 'noise' ? 13 : 7);
    const arr = [];
    if (name === 'rings') {
      const rings = [{ cx: 0.50, cy: 0.50, rad: 0.10, n: 32 },
                     { cx: 0.50, cy: 0.50, rad: 0.34, n: 80 }];
      rings.forEach(function (ring) {
        for (let i = 0; i < ring.n; i++) {
          const t = (i + r() * 0.4) / ring.n * Math.PI * 2;
          arr.push({ x: ring.cx + Math.cos(t) * ring.rad + (r() - 0.5) * 0.02, y: ring.cy + Math.sin(t) * ring.rad + (r() - 0.5) * 0.02 });
        }
      });
    } else if (name === 'blobs') {
      const cs = [[0.25, 0.30], [0.70, 0.30], [0.50, 0.75]];
      cs.forEach(function (c) {
        for (let i = 0; i < 28; i++) arr.push({ x: c[0] + (r() - 0.5) * 0.16, y: c[1] + (r() - 0.5) * 0.16 });
      });
      // Sprinkle some noise
      for (let i = 0; i < 8; i++) arr.push({ x: r(), y: r() });
    } else if (name === 'noise') {
      for (let i = 0; i < 80; i++) arr.push({ x: r(), y: r() });
    }
    return arr.filter(function (p) { return p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1; });
  }

  function dist2(a, b) { return (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y); }

  function cluster() {
    labels = points.map(function () { return -2; }); // -2 = unvisited, -1 = noise, >=0 = cluster id
    const eps2 = eps * eps;
    let cid = 0;

    function neighbors(i) {
      const out = [];
      for (let j = 0; j < points.length; j++) {
        if (i !== j && dist2(points[i], points[j]) <= eps2) out.push(j);
      }
      return out;
    }

    for (let i = 0; i < points.length; i++) {
      if (labels[i] !== -2) continue;
      const nb = neighbors(i);
      if (nb.length + 1 < minPts) {
        labels[i] = -1; // noise (might get reclassified as border)
        continue;
      }
      labels[i] = cid;
      const seeds = nb.slice();
      while (seeds.length > 0) {
        const j = seeds.shift();
        if (labels[j] === -1) labels[j] = cid; // border
        if (labels[j] !== -2) continue;
        labels[j] = cid;
        const nb2 = neighbors(j);
        if (nb2.length + 1 >= minPts) {
          for (let k = 0; k < nb2.length; k++) seeds.push(nb2[k]);
        }
      }
      cid++;
    }
    return cid; // number of clusters
  }

  function render() {
    if (!svg) return;
    const k = cluster();
    let inner = '<rect x="' + PAD + '" y="' + PAD + '" width="' + (W - 2 * PAD) + '" height="' + (H - 2 * PAD) + '" fill="var(--paper)" stroke="var(--ink-dim)" stroke-width="0.6"/>';

    points.forEach(function (p, i) {
      const px = PAD + p.x * (W - 2 * PAD);
      const py = PAD + p.y * (H - 2 * PAD);
      const lab = labels[i];
      const fill = lab === -1 ? 'var(--ink-dim)' : COLORS[lab % COLORS.length];
      const op = lab === -1 ? 0.3 : 0.95;
      inner += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="' + (lab === -1 ? 2.2 : 4) + '" fill="' + fill + '" opacity="' + op + '" stroke="var(--paper)" stroke-width="1"/>';
    });
    svg.innerHTML = inner;

    let noise = 0;
    labels.forEach(function (l) { if (l === -1) noise++; });
    kVal.textContent = String(k);
    noiseVal.textContent = String(noise) + ' (' + (points.length === 0 ? 0 : (100 * noise / points.length).toFixed(1)) + '%)';
  }

  function loadPreset(name) {
    preset = name;
    points = genPreset(name);
    presetBtns.forEach(function (b) { b.classList.toggle('is-active', b.dataset.preset === name); });
    render();
  }

  function init() {
    svg = document.getElementById('db-canvas');
    if (!svg) return;
    presetBtns = document.querySelectorAll('.db-preset');
    epsSlider = document.getElementById('db-eps'); epsVal = document.getElementById('db-eps-val');
    minPtsSlider = document.getElementById('db-minpts'); minPtsVal = document.getElementById('db-minpts-val');
    kVal = document.getElementById('db-k');
    noiseVal = document.getElementById('db-noise');

    presetBtns.forEach(function (b) { b.addEventListener('click', function () { loadPreset(b.dataset.preset); }); });
    epsSlider.addEventListener('input', function () { eps = parseFloat(epsSlider.value); epsVal.textContent = eps.toFixed(3); render(); });
    minPtsSlider.addEventListener('input', function () { minPts = parseInt(minPtsSlider.value, 10); minPtsVal.textContent = String(minPts); render(); });

    loadPreset('rings');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
