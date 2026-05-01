/* Ridge / Lasso — linear regression with L2 / L1 penalty. */
(function () {
  'use strict';
  const W = 720, H = 540, PAD = 28;
  let points = [];
  let preset = 'wiggly';
  let lambda = 0.1, mode = 'ridge';
  let svg, presetBtns, lambdaSlider, lambdaVal, modeBtns, coefsEl, r2Val;
  // Polynomial regression on synthetic 1D y = f(x) data with degree-7 polynomial.
  // Ridge = L2; Lasso = L1 (coordinate descent).

  function rand(seed) { return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }
  function genPreset(name) {
    const r = rand(name === 'noisy' ? 17 : name === 'linear' ? 3 : 7);
    const arr = [];
    if (name === 'wiggly') {
      for (let i = 0; i < 20; i++) {
        const x = i / 19;
        const y = 0.5 + 0.4 * Math.sin(x * Math.PI * 2.4) + (r() - 0.5) * 0.06;
        arr.push({ x, y: Math.max(0, Math.min(1, y)) });
      }
    } else if (name === 'noisy') {
      for (let i = 0; i < 30; i++) {
        const x = r();
        const y = 0.5 + 0.3 * Math.sin(x * Math.PI * 1.6) + (r() - 0.5) * 0.30;
        arr.push({ x, y: Math.max(0, Math.min(1, y)) });
      }
    } else if (name === 'linear') {
      for (let i = 0; i < 22; i++) {
        const x = i / 21;
        const y = 0.2 + 0.5 * x + (r() - 0.5) * 0.05;
        arr.push({ x, y });
      }
    }
    return arr;
  }

  // Polynomial features [1, x, x^2, ..., x^d] centered at 0.5 to reduce ill-conditioning.
  const DEG = 7;
  function feats(x) {
    const f = []; const cx = x - 0.5;
    let cur = 1;
    for (let d = 0; d <= DEG; d++) { f.push(cur); cur *= cx; }
    return f;
  }

  // Solve ridge regression: w = (X^T X + λI)⁻¹ X^T y
  // Solving by gradient descent for simplicity (robust for small n).
  function fit() {
    const n = points.length;
    if (n === 0) return new Array(DEG + 1).fill(0);
    const X = points.map(function (p) { return feats(p.x); });
    const y = points.map(function (p) { return p.y; });
    let w = new Array(DEG + 1).fill(0);
    const lr = 0.05;
    const iters = 600;
    for (let it = 0; it < iters; it++) {
      const grad = new Array(DEG + 1).fill(0);
      for (let i = 0; i < n; i++) {
        let yhat = 0;
        for (let d = 0; d <= DEG; d++) yhat += X[i][d] * w[d];
        const err = yhat - y[i];
        for (let d = 0; d <= DEG; d++) grad[d] += err * X[i][d];
      }
      // Regularization gradient
      for (let d = 0; d <= DEG; d++) {
        if (mode === 'ridge') grad[d] += 2 * lambda * w[d];
        // Don't regularize the bias term (d=0)
      }
      // Apply gradient step
      for (let d = 0; d <= DEG; d++) w[d] -= lr * grad[d] / n;
      // For lasso: soft-threshold operator after each step (proximal gradient)
      if (mode === 'lasso') {
        for (let d = 1; d <= DEG; d++) {
          const t = lambda * lr;
          if (w[d] > t) w[d] -= t;
          else if (w[d] < -t) w[d] += t;
          else w[d] = 0;
        }
      }
    }
    return w;
  }
  function evalPoly(w, x) {
    const f = feats(x);
    let s = 0;
    for (let d = 0; d <= DEG; d++) s += w[d] * f[d];
    return s;
  }
  function r2(w) {
    if (points.length === 0) return 0;
    let yMean = 0;
    points.forEach(function (p) { yMean += p.y; });
    yMean /= points.length;
    let ssRes = 0, ssTot = 0;
    points.forEach(function (p) {
      const yhat = evalPoly(w, p.x);
      ssRes += (p.y - yhat) * (p.y - yhat);
      ssTot += (p.y - yMean) * (p.y - yMean);
    });
    return ssTot < 1e-9 ? 0 : 1 - ssRes / ssTot;
  }

  function px(x) { return PAD + x * (W - 2 * PAD); }
  function py(y) { return H - PAD - y * (H - 2 * PAD); }

  function render() {
    if (!svg) return;
    const w = fit();
    let inner = '<rect x="' + PAD + '" y="' + PAD + '" width="' + (W - 2 * PAD) + '" height="' + (H - 2 * PAD) + '" fill="var(--paper)" stroke="var(--ink-dim)" stroke-width="0.6"/>';

    // Curve
    if (points.length > 0) {
      let pathD = '';
      for (let i = 0; i <= 100; i++) {
        const x = i / 100;
        const yv = evalPoly(w, x);
        if (i === 0) pathD += 'M ';
        else pathD += 'L ';
        pathD += px(x).toFixed(1) + ' ' + py(yv).toFixed(1) + ' ';
      }
      inner += '<path d="' + pathD + '" stroke="var(--accent)" stroke-width="2.2" fill="none"/>';
    }
    // Points
    points.forEach(function (p) {
      inner += '<circle cx="' + px(p.x).toFixed(1) + '" cy="' + py(p.y).toFixed(1) + '" r="4" fill="var(--ink)" stroke="var(--paper)" stroke-width="1.4"/>';
    });
    svg.innerHTML = inner;

    r2Val.textContent = r2(w).toFixed(3);

    // Coefficients viz
    let coefsHTML = '';
    for (let d = 0; d <= DEG; d++) {
      const val = w[d];
      const mag = Math.min(1, Math.abs(val) / 4);
      const isZero = Math.abs(val) < 0.005;
      coefsHTML += '<div class="rl-coef-row">' +
        '<span class="rl-coef-name">w' + d + '</span>' +
        '<span class="rl-coef-bar"><span style="width:' + (mag * 100).toFixed(0) + '%; background: ' + (val >= 0 ? 'var(--accent)' : 'var(--ink)') + '"></span></span>' +
        '<span class="rl-coef-val' + (isZero ? ' is-zero' : '') + '">' + (val >= 0 ? '+' : '') + val.toFixed(3) + '</span>' +
        '</div>';
    }
    coefsEl.innerHTML = coefsHTML;
  }

  function loadPreset(name) {
    preset = name;
    points = genPreset(name);
    presetBtns.forEach(function (b) { b.classList.toggle('is-active', b.dataset.preset === name); });
    render();
  }

  function init() {
    svg = document.getElementById('rl-canvas');
    if (!svg) return;
    presetBtns = document.querySelectorAll('.rl-preset');
    lambdaSlider = document.getElementById('rl-lambda');
    lambdaVal = document.getElementById('rl-lambda-val');
    modeBtns = document.querySelectorAll('.rl-mode');
    coefsEl = document.getElementById('rl-coefs');
    r2Val = document.getElementById('rl-r2');

    presetBtns.forEach(function (b) { b.addEventListener('click', function () { loadPreset(b.dataset.preset); }); });
    lambdaSlider.addEventListener('input', function () {
      lambda = parseFloat(lambdaSlider.value);
      lambdaVal.textContent = lambda.toFixed(3);
      render();
    });
    modeBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        mode = b.dataset.mode;
        modeBtns.forEach(function (x) { x.classList.toggle('is-active', x === b); });
        render();
      });
    });

    loadPreset('wiggly');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
