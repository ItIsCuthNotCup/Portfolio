/* KNN — pure distance-based classification. k slider, click to add. */
(function () {
  'use strict';
  const W = 720, H = 540, PAD = 24;
  let points = [];
  let k = 5, activeClass = 1, preset = 'blobs';
  let svg, kVal, kSlider, presetBtns, classToggle, clearBtn, accVal, kReadout, nVal;

  function rand(seed) { return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

  function genPreset(name) {
    const r = rand(name === 'moons' ? 7 : 5);
    const arr = [];
    if (name === 'blobs') {
      const cs = [[0.3, 0.30, 0], [0.70, 0.30, 1], [0.30, 0.70, 1], [0.70, 0.70, 0]];
      cs.forEach(function (c) {
        for (let i = 0; i < 18; i++) {
          arr.push({ x: c[0] + (r() - 0.5) * 0.18, y: c[1] + (r() - 0.5) * 0.18, cls: c[2] });
        }
      });
    } else if (name === 'moons') {
      for (let i = 0; i < 40; i++) {
        const t = i / 39 * Math.PI;
        arr.push({ x: 0.5 - 0.30 * Math.cos(t) + (r() - 0.5) * 0.06, y: 0.55 - 0.20 * Math.sin(t) + (r() - 0.5) * 0.06, cls: 0 });
      }
      for (let i = 0; i < 40; i++) {
        const t = i / 39 * Math.PI;
        arr.push({ x: 0.5 + 0.30 * Math.cos(t) + (r() - 0.5) * 0.06, y: 0.45 + 0.20 * Math.sin(t) + (r() - 0.5) * 0.06, cls: 1 });
      }
    } else if (name === 'sparse') {
      // Few points to show how KNN behaves at low data
      for (let i = 0; i < 8; i++) {
        const cls = i < 4 ? 0 : 1;
        const cx = cls === 0 ? 0.30 : 0.70;
        const cy = 0.5 + (r() - 0.5) * 0.4;
        arr.push({ x: cx + (r() - 0.5) * 0.12, y: cy, cls });
      }
    }
    return arr.filter(function (p) { return p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1; });
  }

  function predict(x, y) {
    if (points.length === 0) return -1;
    // Sort all points by distance, take top k, vote
    const dists = points.map(function (p) {
      return { d: (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y), cls: p.cls };
    }).sort(function (a, b) { return a.d - b.d; });
    const top = dists.slice(0, Math.min(k, points.length));
    let s0 = 0, s1 = 0;
    top.forEach(function (t) { if (t.cls === 0) s0++; else s1++; });
    return s0 >= s1 ? 0 : 1;
  }

  function leaveOneOutAcc() {
    if (points.length < 2) return 0;
    let correct = 0;
    for (let i = 0; i < points.length; i++) {
      // Remove point i, predict its label from the rest.
      const others = points.slice(0, i).concat(points.slice(i + 1));
      const dists = others.map(function (p) {
        return { d: (p.x - points[i].x) * (p.x - points[i].x) + (p.y - points[i].y) * (p.y - points[i].y), cls: p.cls };
      }).sort(function (a, b) { return a.d - b.d; });
      const top = dists.slice(0, Math.min(k, others.length));
      let s0 = 0, s1 = 0;
      top.forEach(function (t) { if (t.cls === 0) s0++; else s1++; });
      const pred = s0 >= s1 ? 0 : 1;
      if (pred === points[i].cls) correct++;
    }
    return correct / points.length;
  }

  function render() {
    if (!svg) return;
    let inner = '<rect x="' + PAD + '" y="' + PAD + '" width="' + (W - 2 * PAD) + '" height="' + (H - 2 * PAD) + '" fill="var(--paper)" stroke="var(--ink-dim)" stroke-width="0.6"/>';
    if (points.length > 0) {
      const grid = 50;
      for (let i = 0; i < grid; i++) {
        for (let j = 0; j < grid; j++) {
          const x = (i + 0.5) / grid;
          const y = (j + 0.5) / grid;
          const c = predict(x, y);
          if (c < 0) continue;
          const px = PAD + i / grid * (W - 2 * PAD);
          const py = PAD + j / grid * (H - 2 * PAD);
          const cw = (W - 2 * PAD) / grid + 1;
          const ch = (H - 2 * PAD) / grid + 1;
          const fill = c === 0 ? 'color-mix(in oklab, var(--ink) 14%, transparent)' : 'color-mix(in oklab, var(--accent) 22%, transparent)';
          inner += '<rect x="' + px.toFixed(1) + '" y="' + py.toFixed(1) + '" width="' + cw.toFixed(1) + '" height="' + ch.toFixed(1) + '" fill="' + fill + '"/>';
        }
      }
    }
    points.forEach(function (p) {
      const px = PAD + p.x * (W - 2 * PAD);
      const py = PAD + p.y * (H - 2 * PAD);
      const fill = p.cls === 0 ? 'var(--ink)' : 'var(--accent)';
      inner += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="4" fill="' + fill + '" stroke="var(--paper)" stroke-width="1.4"/>';
    });
    svg.innerHTML = inner;
    accVal.textContent = points.length > 1 ? (leaveOneOutAcc() * 100).toFixed(1) + '%' : '—';
    kReadout.textContent = String(k);
    nVal.textContent = String(points.length);
  }

  function ix(px) { return (px - PAD) / (W - 2 * PAD); }
  function iy(py) { return (py - PAD) / (H - 2 * PAD); }
  function svgPoint(evt) {
    const r = svg.getBoundingClientRect();
    return { x: (evt.clientX - r.left) / r.width * W, y: (evt.clientY - r.top) / r.height * H };
  }
  function onClick(evt) {
    const sp = svgPoint(evt);
    const x = ix(sp.x), y = iy(sp.y);
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    points.push({ x, y, cls: activeClass });
    render();
  }
  function loadPreset(name) {
    preset = name;
    points = genPreset(name);
    presetBtns.forEach(function (b) { b.classList.toggle('is-active', b.dataset.preset === name); });
    render();
  }

  function init() {
    svg = document.getElementById('kn-canvas');
    if (!svg) return;
    kVal = document.getElementById('kn-k-val');
    kSlider = document.getElementById('kn-k');
    presetBtns = document.querySelectorAll('.kn-preset');
    classToggle = document.querySelectorAll('.kn-class');
    clearBtn = document.getElementById('kn-clear');
    accVal = document.getElementById('kn-acc');
    kReadout = document.getElementById('kn-k-readout');
    nVal = document.getElementById('kn-n');

    presetBtns.forEach(function (b) { b.addEventListener('click', function () { loadPreset(b.dataset.preset); }); });
    classToggle.forEach(function (b) {
      b.addEventListener('click', function () {
        activeClass = parseInt(b.dataset.class, 10);
        classToggle.forEach(function (x) { x.classList.toggle('is-active', x === b); });
      });
    });
    kSlider.addEventListener('input', function () {
      k = parseInt(kSlider.value, 10);
      kVal.textContent = String(k);
      render();
    });
    clearBtn.addEventListener('click', function () { points = []; render(); });
    svg.addEventListener('click', onClick);

    loadPreset('blobs');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
