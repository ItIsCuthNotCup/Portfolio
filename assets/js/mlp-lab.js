/* MLP — small 2-H-1 neural network trained live with backprop. */
(function () {
  'use strict';
  const W = 720, H = 540, PAD = 24;
  let points = [];
  let preset = 'spiral';
  let hiddenSize = 8, lr = 0.15;
  let weights = null;
  let lossHistory = [];
  let training = false, trainTimer = null;
  let svg, lossSvg, presetBtns, runBtn, resetBtn, lrSlider, lrVal, hiddenSlider, hiddenVal, accVal, lossVal, epochVal;

  function rand(seed) { return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }
  let rng = rand(42);

  function genPreset(name) {
    const r = rand(name === 'circles' ? 7 : name === 'xor' ? 11 : 5);
    const arr = [];
    if (name === 'spiral') {
      for (let cls = 0; cls < 2; cls++) {
        for (let i = 0; i < 50; i++) {
          const t = i / 49 * 4 + cls * Math.PI;
          const radius = i / 49 * 0.32;
          arr.push({ x: 0.5 + radius * Math.cos(t) + (r() - 0.5) * 0.04, y: 0.5 + radius * Math.sin(t) + (r() - 0.5) * 0.04, cls });
        }
      }
    } else if (name === 'circles') {
      for (let i = 0; i < 50; i++) {
        const t = i / 50 * Math.PI * 2;
        arr.push({ x: 0.5 + Math.cos(t) * 0.12 + (r() - 0.5) * 0.04, y: 0.5 + Math.sin(t) * 0.12 + (r() - 0.5) * 0.04, cls: 0 });
      }
      for (let i = 0; i < 70; i++) {
        const t = i / 70 * Math.PI * 2;
        arr.push({ x: 0.5 + Math.cos(t) * 0.32 + (r() - 0.5) * 0.04, y: 0.5 + Math.sin(t) * 0.32 + (r() - 0.5) * 0.04, cls: 1 });
      }
    } else if (name === 'xor') {
      for (let i = 0; i < 30; i++) arr.push({ x: 0.30 + (r() - 0.5) * 0.16, y: 0.30 + (r() - 0.5) * 0.16, cls: 0 });
      for (let i = 0; i < 30; i++) arr.push({ x: 0.70 + (r() - 0.5) * 0.16, y: 0.30 + (r() - 0.5) * 0.16, cls: 1 });
      for (let i = 0; i < 30; i++) arr.push({ x: 0.30 + (r() - 0.5) * 0.16, y: 0.70 + (r() - 0.5) * 0.16, cls: 1 });
      for (let i = 0; i < 30; i++) arr.push({ x: 0.70 + (r() - 0.5) * 0.16, y: 0.70 + (r() - 0.5) * 0.16, cls: 0 });
    }
    return arr.map(function (p) { return { x: Math.max(0, Math.min(1, p.x)), y: Math.max(0, Math.min(1, p.y)), cls: p.cls }; });
  }

  function initWeights() {
    rng = rand(42);
    weights = {
      W1: [], b1: [],
      W2: [], b2: 0,
    };
    for (let h = 0; h < hiddenSize; h++) {
      weights.W1.push([(rng() - 0.5) * 1.2, (rng() - 0.5) * 1.2]);
      weights.b1.push((rng() - 0.5) * 0.4);
      weights.W2.push((rng() - 0.5) * 1.2);
    }
    weights.b2 = (rng() - 0.5) * 0.2;
    lossHistory = [];
  }
  function tanh(x) { return Math.tanh(x); }
  function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

  function forward(p) {
    const x0 = p.x - 0.5, x1 = p.y - 0.5;
    const h = []; const a = [];
    for (let i = 0; i < hiddenSize; i++) {
      const z = weights.W1[i][0] * x0 + weights.W1[i][1] * x1 + weights.b1[i];
      h.push(z); a.push(tanh(z));
    }
    let z2 = weights.b2;
    for (let i = 0; i < hiddenSize; i++) z2 += weights.W2[i] * a[i];
    return { x0, x1, h, a, z2, p: sigmoid(z2) };
  }

  function predictScore(x, y) {
    const out = forward({ x, y });
    return out.p;
  }

  function trainBatch() {
    if (points.length === 0) return;
    // Compute average gradients across batch
    const dW1 = []; const db1 = []; const dW2 = []; let db2 = 0;
    for (let i = 0; i < hiddenSize; i++) { dW1.push([0, 0]); db1.push(0); dW2.push(0); }
    let totalLoss = 0;
    for (let i = 0; i < points.length; i++) {
      const out = forward(points[i]);
      const y = points[i].cls;
      // Binary cross-entropy
      totalLoss += -(y * Math.log(out.p + 1e-9) + (1 - y) * Math.log(1 - out.p + 1e-9));
      const dz2 = out.p - y;
      db2 += dz2;
      for (let j = 0; j < hiddenSize; j++) {
        dW2[j] += dz2 * out.a[j];
        const dh = dz2 * weights.W2[j] * (1 - out.a[j] * out.a[j]);
        dW1[j][0] += dh * out.x0;
        dW1[j][1] += dh * out.x1;
        db1[j] += dh;
      }
    }
    const n = points.length;
    for (let j = 0; j < hiddenSize; j++) {
      weights.W1[j][0] -= lr * dW1[j][0] / n;
      weights.W1[j][1] -= lr * dW1[j][1] / n;
      weights.b1[j] -= lr * db1[j] / n;
      weights.W2[j] -= lr * dW2[j] / n;
    }
    weights.b2 -= lr * db2 / n;
    lossHistory.push(totalLoss / n);
    if (lossHistory.length > 600) lossHistory.shift();
  }

  function trainAccuracy() {
    if (points.length === 0) return 0;
    let c = 0;
    points.forEach(function (p) {
      const pred = predictScore(p.x, p.y) > 0.5 ? 1 : 0;
      if (pred === p.cls) c++;
    });
    return c / points.length;
  }

  function render() {
    if (!svg) return;
    let inner = '<rect x="' + PAD + '" y="' + PAD + '" width="' + (W - 2 * PAD) + '" height="' + (H - 2 * PAD) + '" fill="var(--paper)" stroke="var(--ink-dim)" stroke-width="0.6"/>';
    if (weights) {
      const grid = 50;
      for (let i = 0; i < grid; i++) {
        for (let j = 0; j < grid; j++) {
          const x = (i + 0.5) / grid;
          const y = (j + 0.5) / grid;
          const score = predictScore(x, y);
          const cls = score >= 0.5 ? 1 : 0;
          const intensity = Math.abs(score - 0.5) * 2;
          const px = PAD + i / grid * (W - 2 * PAD);
          const py = PAD + j / grid * (H - 2 * PAD);
          const cw = (W - 2 * PAD) / grid + 1;
          const ch = (H - 2 * PAD) / grid + 1;
          const fill = cls === 0
            ? 'color-mix(in oklab, var(--ink) ' + (8 + intensity * 22).toFixed(0) + '%, transparent)'
            : 'color-mix(in oklab, var(--accent) ' + (8 + intensity * 22).toFixed(0) + '%, transparent)';
          inner += '<rect x="' + px.toFixed(1) + '" y="' + py.toFixed(1) + '" width="' + cw.toFixed(1) + '" height="' + ch.toFixed(1) + '" fill="' + fill + '"/>';
        }
      }
    }
    points.forEach(function (p) {
      const px = PAD + p.x * (W - 2 * PAD);
      const py = PAD + p.y * (H - 2 * PAD);
      const fill = p.cls === 0 ? 'var(--ink)' : 'var(--accent)';
      inner += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="3.4" fill="' + fill + '" stroke="var(--paper)" stroke-width="1"/>';
    });
    svg.innerHTML = inner;

    // Loss chart
    if (lossSvg) {
      const lW = 320, lH = 80;
      let lossInner = '<rect x="0" y="0" width="' + lW + '" height="' + lH + '" fill="var(--paper)" stroke="var(--ink-dim)" stroke-width="0.4"/>';
      if (lossHistory.length > 1) {
        const maxL = Math.max.apply(null, lossHistory);
        const minL = 0;
        let path = '';
        const stride = Math.max(1, Math.floor(lossHistory.length / 200));
        for (let i = 0; i < lossHistory.length; i += stride) {
          const x = (i / lossHistory.length) * lW;
          const y = lH - ((lossHistory[i] - minL) / (maxL - minL || 1)) * lH;
          path += (i === 0 ? 'M ' : 'L ') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
        }
        lossInner += '<path d="' + path + '" fill="none" stroke="var(--accent)" stroke-width="1.2"/>';
      }
      lossSvg.innerHTML = lossInner;
    }

    accVal.textContent = (trainAccuracy() * 100).toFixed(1) + '%';
    lossVal.textContent = lossHistory.length > 0 ? lossHistory[lossHistory.length - 1].toFixed(4) : '—';
    epochVal.textContent = String(lossHistory.length);
  }

  function startTrain() {
    if (training) { stopTrain(); return; }
    training = true; runBtn.textContent = 'Pause';
    function tick() {
      if (!training) return;
      for (let i = 0; i < 5; i++) trainBatch();
      render();
      trainTimer = setTimeout(tick, 16);
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
    initWeights();
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
    svg = document.getElementById('mlp-canvas');
    if (!svg) return;
    lossSvg = document.getElementById('mlp-loss');
    presetBtns = document.querySelectorAll('.mlp-preset');
    runBtn = document.getElementById('mlp-run');
    resetBtn = document.getElementById('mlp-reset');
    lrSlider = document.getElementById('mlp-lr'); lrVal = document.getElementById('mlp-lr-val');
    hiddenSlider = document.getElementById('mlp-hidden'); hiddenVal = document.getElementById('mlp-hidden-val');
    accVal = document.getElementById('mlp-acc');
    lossVal = document.getElementById('mlp-loss-val');
    epochVal = document.getElementById('mlp-epoch');

    presetBtns.forEach(function (b) { b.addEventListener('click', function () { loadPreset(b.dataset.preset); }); });
    runBtn.addEventListener('click', startTrain);
    resetBtn.addEventListener('click', reset);
    lrSlider.addEventListener('input', function () { lr = parseFloat(lrSlider.value); lrVal.textContent = lr.toFixed(2); });
    hiddenSlider.addEventListener('input', function () {
      hiddenSize = parseInt(hiddenSlider.value, 10);
      hiddenVal.textContent = String(hiddenSize);
      reset();
    });

    loadPreset('spiral');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
