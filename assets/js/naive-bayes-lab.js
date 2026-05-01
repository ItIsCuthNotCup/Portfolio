/* Naive Bayes — Gaussian, 2D, with diagonal covariance per class. */
(function () {
  'use strict';
  const W = 720, H = 540, PAD = 24;
  let points = [];
  let preset = 'gaussian';
  let activeClass = 1;
  let svg, presetBtns, classBtns, clearBtn, accVal, p0Stats, p1Stats;

  function rand(seed) { return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

  function genPreset(name) {
    const r = rand(name === 'imbalanced' ? 13 : name === 'overlap' ? 7 : 5);
    const arr = [];
    if (name === 'gaussian') {
      for (let i = 0; i < 30; i++) arr.push({ x: 0.30 + (r() - 0.5) * 0.18, y: 0.35 + (r() - 0.5) * 0.18, cls: 0 });
      for (let i = 0; i < 30; i++) arr.push({ x: 0.70 + (r() - 0.5) * 0.18, y: 0.65 + (r() - 0.5) * 0.18, cls: 1 });
    } else if (name === 'overlap') {
      for (let i = 0; i < 40; i++) arr.push({ x: 0.40 + (r() - 0.5) * 0.30, y: 0.50 + (r() - 0.5) * 0.30, cls: 0 });
      for (let i = 0; i < 40; i++) arr.push({ x: 0.55 + (r() - 0.5) * 0.30, y: 0.50 + (r() - 0.5) * 0.30, cls: 1 });
    } else if (name === 'imbalanced') {
      for (let i = 0; i < 60; i++) arr.push({ x: 0.45 + (r() - 0.5) * 0.40, y: 0.50 + (r() - 0.5) * 0.40, cls: 0 });
      for (let i = 0; i < 6; i++) arr.push({ x: 0.75 + (r() - 0.5) * 0.10, y: 0.25 + (r() - 0.5) * 0.10, cls: 1 });
    }
    return arr;
  }

  function fit() {
    const stats = { 0: { n: 0, mx: 0, my: 0, vx: 0, vy: 0 }, 1: { n: 0, mx: 0, my: 0, vx: 0, vy: 0 } };
    points.forEach(function (p) {
      const s = stats[p.cls];
      s.n++; s.mx += p.x; s.my += p.y;
    });
    [0, 1].forEach(function (c) {
      if (stats[c].n > 0) { stats[c].mx /= stats[c].n; stats[c].my /= stats[c].n; }
    });
    points.forEach(function (p) {
      const s = stats[p.cls];
      s.vx += (p.x - s.mx) * (p.x - s.mx);
      s.vy += (p.y - s.my) * (p.y - s.my);
    });
    [0, 1].forEach(function (c) {
      if (stats[c].n > 0) {
        stats[c].vx = Math.max(0.001, stats[c].vx / stats[c].n);
        stats[c].vy = Math.max(0.001, stats[c].vy / stats[c].n);
      } else {
        stats[c].vx = 0.001; stats[c].vy = 0.001;
      }
    });
    return stats;
  }
  function logLik(p, s, prior) {
    if (s.n === 0) return -Infinity;
    const lp =
      -0.5 * Math.log(2 * Math.PI * s.vx) - (p.x - s.mx) * (p.x - s.mx) / (2 * s.vx)
      -0.5 * Math.log(2 * Math.PI * s.vy) - (p.y - s.my) * (p.y - s.my) / (2 * s.vy)
      + Math.log(Math.max(1e-9, prior));
    return lp;
  }
  function predict(stats, x, y) {
    const total = stats[0].n + stats[1].n;
    if (total === 0) return -1;
    const p0 = stats[0].n / total, p1 = stats[1].n / total;
    const l0 = logLik({ x, y }, stats[0], p0);
    const l1 = logLik({ x, y }, stats[1], p1);
    return l1 > l0 ? 1 : 0;
  }
  function trainAccuracy(stats) {
    if (points.length === 0) return 0;
    let c = 0;
    points.forEach(function (p) { if (predict(stats, p.x, p.y) === p.cls) c++; });
    return c / points.length;
  }

  function render() {
    if (!svg) return;
    const stats = fit();
    let inner = '<rect x="' + PAD + '" y="' + PAD + '" width="' + (W - 2 * PAD) + '" height="' + (H - 2 * PAD) + '" fill="var(--paper)" stroke="var(--ink-dim)" stroke-width="0.6"/>';

    if (stats[0].n + stats[1].n > 0) {
      const grid = 50;
      for (let i = 0; i < grid; i++) {
        for (let j = 0; j < grid; j++) {
          const x = (i + 0.5) / grid;
          const y = (j + 0.5) / grid;
          const c = predict(stats, x, y);
          if (c < 0) continue;
          const px = PAD + i / grid * (W - 2 * PAD);
          const py = PAD + j / grid * (H - 2 * PAD);
          const cw = (W - 2 * PAD) / grid + 1;
          const ch = (H - 2 * PAD) / grid + 1;
          const fill = c === 0 ? 'color-mix(in oklab, var(--ink) 14%, transparent)' : 'color-mix(in oklab, var(--accent) 22%, transparent)';
          inner += '<rect x="' + px.toFixed(1) + '" y="' + py.toFixed(1) + '" width="' + cw.toFixed(1) + '" height="' + ch.toFixed(1) + '" fill="' + fill + '"/>';
        }
      }
      // Draw 1-sigma ellipses for each class
      [0, 1].forEach(function (c) {
        const s = stats[c];
        if (s.n < 2) return;
        const cx = PAD + s.mx * (W - 2 * PAD);
        const cy = PAD + s.my * (H - 2 * PAD);
        const rx = Math.sqrt(s.vx) * (W - 2 * PAD);
        const ry = Math.sqrt(s.vy) * (H - 2 * PAD);
        const color = c === 0 ? 'var(--ink)' : 'var(--accent)';
        inner += '<ellipse cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" rx="' + rx.toFixed(1) + '" ry="' + ry.toFixed(1) +
                 '" fill="none" stroke="' + color + '" stroke-width="1.6" opacity="0.7" stroke-dasharray="3 3"/>';
        inner += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="3" fill="' + color + '"/>';
      });
    }
    points.forEach(function (p) {
      const px = PAD + p.x * (W - 2 * PAD);
      const py = PAD + p.y * (H - 2 * PAD);
      const fill = p.cls === 0 ? 'var(--ink)' : 'var(--accent)';
      inner += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="3.6" fill="' + fill + '" stroke="var(--paper)" stroke-width="1"/>';
    });
    svg.innerHTML = inner;

    accVal.textContent = (trainAccuracy(stats) * 100).toFixed(1) + '%';
    p0Stats.textContent = stats[0].n > 0 ? '(' + stats[0].mx.toFixed(2) + ', ' + stats[0].my.toFixed(2) + ')' : '—';
    p1Stats.textContent = stats[1].n > 0 ? '(' + stats[1].mx.toFixed(2) + ', ' + stats[1].my.toFixed(2) + ')' : '—';
  }

  function ix(px) { return (px - PAD) / (W - 2 * PAD); }
  function iy(py) { return (py - PAD) / (H - 2 * PAD); }
  function svgPoint(evt) {
    const r = svg.getBoundingClientRect();
    return { x: (evt.clientX - r.left) / r.width * W, y: (evt.clientY - r.top) / r.height * H };
  }

  function loadPreset(name) {
    preset = name;
    points = genPreset(name);
    presetBtns.forEach(function (b) { b.classList.toggle('is-active', b.dataset.preset === name); });
    render();
  }

  function init() {
    svg = document.getElementById('nb-canvas');
    if (!svg) return;
    presetBtns = document.querySelectorAll('.nb-preset');
    classBtns = document.querySelectorAll('.nb-class');
    clearBtn = document.getElementById('nb-clear');
    accVal = document.getElementById('nb-acc');
    p0Stats = document.getElementById('nb-p0');
    p1Stats = document.getElementById('nb-p1');

    presetBtns.forEach(function (b) { b.addEventListener('click', function () { loadPreset(b.dataset.preset); }); });
    classBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        activeClass = parseInt(b.dataset.class, 10);
        classBtns.forEach(function (x) { x.classList.toggle('is-active', x === b); });
      });
    });
    clearBtn.addEventListener('click', function () { points = []; render(); });

    svg.addEventListener('click', function (evt) {
      const sp = svgPoint(evt);
      const x = ix(sp.x), y = iy(sp.y);
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      points.push({ x, y, cls: activeClass });
      render();
    });

    loadPreset('gaussian');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
