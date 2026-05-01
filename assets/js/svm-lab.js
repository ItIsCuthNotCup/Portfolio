/* SVM — linear soft-margin via gradient descent on hinge loss. */
(function () {
  'use strict';
  const W = 720, H = 540, PAD = 24;
  let points = [];
  let preset = 'separable';
  let C = 1.0; // regularization strength
  let w = [0, 0], b = 0;
  let trainTimer = null, training = false;
  let svg, presetBtns, runBtn, resetBtn, cSlider, cVal, accVal, svCount, marginVal;

  function rand(seed) { return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

  function genPreset(name) {
    const r = rand(name === 'overlap' ? 11 : name === 'circles' ? 17 : 5);
    const arr = [];
    if (name === 'separable') {
      for (let i = 0; i < 25; i++) arr.push({ x: 0.20 + r() * 0.20, y: 0.20 + r() * 0.55, cls: -1 });
      for (let i = 0; i < 25; i++) arr.push({ x: 0.60 + r() * 0.20, y: 0.25 + r() * 0.55, cls: 1 });
    } else if (name === 'overlap') {
      for (let i = 0; i < 30; i++) arr.push({ x: 0.30 + r() * 0.25, y: 0.30 + r() * 0.40, cls: -1 });
      for (let i = 0; i < 30; i++) arr.push({ x: 0.45 + r() * 0.25, y: 0.30 + r() * 0.40, cls: 1 });
    } else if (name === 'circles') {
      for (let i = 0; i < 40; i++) {
        const t = i / 40 * Math.PI * 2;
        arr.push({ x: 0.5 + Math.cos(t) * 0.10 + (r() - 0.5) * 0.04, y: 0.5 + Math.sin(t) * 0.10 + (r() - 0.5) * 0.04, cls: -1 });
      }
      for (let i = 0; i < 50; i++) {
        const t = i / 50 * Math.PI * 2;
        arr.push({ x: 0.5 + Math.cos(t) * 0.30 + (r() - 0.5) * 0.04, y: 0.5 + Math.sin(t) * 0.30 + (r() - 0.5) * 0.04, cls: 1 });
      }
    }
    return arr;
  }

  // Hinge-loss gradient descent for linear SVM (one mini-step per call)
  function trainStep() {
    if (points.length === 0) return;
    const lr = 0.02;
    const gw = [0, 0]; let gb = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const margin = p.cls * (w[0] * (p.x - 0.5) + w[1] * (p.y - 0.5) + b);
      if (margin < 1) {
        gw[0] += -p.cls * (p.x - 0.5);
        gw[1] += -p.cls * (p.y - 0.5);
        gb += -p.cls;
      }
    }
    // Regularization gradient: w / C (smaller C = more regularization)
    gw[0] = gw[0] * C / points.length + w[0];
    gw[1] = gw[1] * C / points.length + w[1];
    gb = gb * C / points.length;
    w[0] -= lr * gw[0];
    w[1] -= lr * gw[1];
    b -= lr * gb;
  }

  function pred(p) { return Math.sign(w[0] * (p.x - 0.5) + w[1] * (p.y - 0.5) + b); }

  function trainAccuracy() {
    if (points.length === 0) return 0;
    let correct = 0;
    points.forEach(function (p) { if (pred(p) === p.cls) correct++; });
    return correct / points.length;
  }
  function isSV(p) {
    const margin = p.cls * (w[0] * (p.x - 0.5) + w[1] * (p.y - 0.5) + b);
    return margin <= 1.05;
  }

  function render() {
    if (!svg) return;
    let inner = '<rect x="' + PAD + '" y="' + PAD + '" width="' + (W - 2 * PAD) + '" height="' + (H - 2 * PAD) + '" fill="var(--paper)" stroke="var(--ink-dim)" stroke-width="0.6"/>';

    // Margin shading + decision regions
    if (Math.abs(w[0]) + Math.abs(w[1]) > 1e-3) {
      const grid = 50;
      for (let i = 0; i < grid; i++) {
        for (let j = 0; j < grid; j++) {
          const x = (i + 0.5) / grid;
          const y = (j + 0.5) / grid;
          const score = w[0] * (x - 0.5) + w[1] * (y - 0.5) + b;
          const cls = score >= 0 ? 1 : -1;
          const intensity = Math.min(1, Math.abs(score) * 0.5);
          const px = PAD + i / grid * (W - 2 * PAD);
          const py = PAD + j / grid * (H - 2 * PAD);
          const cw = (W - 2 * PAD) / grid + 1;
          const ch = (H - 2 * PAD) / grid + 1;
          const fill = cls === -1
            ? 'color-mix(in oklab, var(--ink) ' + (8 + intensity * 18).toFixed(0) + '%, transparent)'
            : 'color-mix(in oklab, var(--accent) ' + (8 + intensity * 18).toFixed(0) + '%, transparent)';
          inner += '<rect x="' + px.toFixed(1) + '" y="' + py.toFixed(1) + '" width="' + cw.toFixed(1) + '" height="' + ch.toFixed(1) + '" fill="' + fill + '"/>';
        }
      }

      // Margin lines: w·x + b = ±1
      // y = (±1 - b - w0*(x-0.5)) / w1 + 0.5
      function yAt(x, off) {
        if (Math.abs(w[1]) < 1e-6) return null;
        return (off - b - w[0] * (x - 0.5)) / w[1] + 0.5;
      }
      function px(x) { return PAD + x * (W - 2 * PAD); }
      function py(y) { return PAD + y * (H - 2 * PAD); }

      [{off: 0, color: 'var(--accent)', sw: 2.2, dash: ''},
       {off: 1, color: 'var(--ink-dim)', sw: 1.0, dash: '4 4'},
       {off: -1, color: 'var(--ink-dim)', sw: 1.0, dash: '4 4'},
      ].forEach(function (line) {
        let x0 = 0, x1 = 1, y0 = yAt(x0, line.off), y1 = yAt(x1, line.off);
        if (y0 === null) {
          // Vertical line case
          if (Math.abs(w[0]) < 1e-6) return;
          const xc = (line.off - b) / w[0] + 0.5;
          inner += '<line x1="' + px(xc).toFixed(1) + '" y1="' + py(0).toFixed(1) + '" x2="' + px(xc).toFixed(1) + '" y2="' + py(1).toFixed(1) +
                   '" stroke="' + line.color + '" stroke-width="' + line.sw + '" ' + (line.dash ? 'stroke-dasharray="' + line.dash + '"' : '') + '/>';
        } else {
          inner += '<line x1="' + px(x0).toFixed(1) + '" y1="' + py(y0).toFixed(1) + '" x2="' + px(x1).toFixed(1) + '" y2="' + py(y1).toFixed(1) +
                   '" stroke="' + line.color + '" stroke-width="' + line.sw + '" ' + (line.dash ? 'stroke-dasharray="' + line.dash + '"' : '') + '/>';
        }
      });
    }

    // Points (highlight support vectors)
    points.forEach(function (p) {
      const px = PAD + p.x * (W - 2 * PAD);
      const py = PAD + p.y * (H - 2 * PAD);
      const isSv = isSV(p);
      const fill = p.cls === -1 ? 'var(--ink)' : 'var(--accent)';
      const r = isSv ? 5.5 : 3.6;
      inner += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="' + r + '" fill="' + fill +
               '" stroke="' + (isSv ? 'var(--paper)' : 'var(--paper)') + '" stroke-width="' + (isSv ? 2.0 : 1) + '"/>';
      if (isSv) {
        inner += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="9" fill="none" stroke="' + fill + '" stroke-width="1" opacity="0.5"/>';
      }
    });
    svg.innerHTML = inner;

    // Readouts
    accVal.textContent = (trainAccuracy() * 100).toFixed(1) + '%';
    let svc = 0;
    points.forEach(function (p) { if (isSV(p)) svc++; });
    svCount.textContent = String(svc);
    const margin = 2 / Math.max(1e-6, Math.sqrt(w[0] * w[0] + w[1] * w[1]));
    marginVal.textContent = isFinite(margin) ? margin.toFixed(3) : '—';
  }

  function startTrain() {
    if (training) { stopTrain(); return; }
    training = true; runBtn.textContent = 'Pause';
    function tick() {
      if (!training) return;
      for (let i = 0; i < 8; i++) trainStep();
      render();
      trainTimer = setTimeout(tick, 30);
    }
    tick();
  }
  function stopTrain() {
    training = false;
    if (trainTimer) { clearTimeout(trainTimer); trainTimer = null; }
    runBtn.textContent = 'Run';
  }
  function reset() {
    stopTrain();
    w = [0, 0]; b = 0;
    render();
  }
  function loadPreset(name) {
    stopTrain();
    preset = name;
    points = genPreset(name);
    presetBtns.forEach(function (b) { b.classList.toggle('is-active', b.dataset.preset === name); });
    reset();
  }

  function init() {
    svg = document.getElementById('sv-canvas');
    if (!svg) return;
    presetBtns = document.querySelectorAll('.sv-preset');
    runBtn = document.getElementById('sv-run');
    resetBtn = document.getElementById('sv-reset');
    cSlider = document.getElementById('sv-c');
    cVal = document.getElementById('sv-c-val');
    accVal = document.getElementById('sv-acc');
    svCount = document.getElementById('sv-svcount');
    marginVal = document.getElementById('sv-margin');

    presetBtns.forEach(function (b) { b.addEventListener('click', function () { loadPreset(b.dataset.preset); }); });
    runBtn.addEventListener('click', startTrain);
    resetBtn.addEventListener('click', reset);
    cSlider.addEventListener('input', function () { C = parseFloat(cSlider.value); cVal.textContent = C.toFixed(2); });

    loadPreset('separable');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
