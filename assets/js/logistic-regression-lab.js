/* logistic-regression-lab.js
   Live two-feature logistic regression. Pure JS, no deps.
   Click-to-add-points, batch gradient descent on every animation
   frame, decision surface drawn by sampling the sigmoid grid.
*/

(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────
  const GRID_W = 60;       // probability sample resolution (cols)
  const GRID_H = 45;       // probability sample resolution (rows)
  const LOSS_HISTORY = 240;
  const STEPS_PER_FRAME = 1;
  const POINT_R = 5.5;

  // Map canvas pixels → feature space [-1, 1] x [-1, 1]
  function px2fx(x, w) { return (x / w) * 2 - 1; }
  function py2fy(y, h) { return 1 - (y / h) * 2; }
  function fx2px(fx, w) { return ((fx + 1) / 2) * w; }
  function fy2py(fy, h) { return ((1 - fy) / 2) * h; }

  // ── State ───────────────────────────────────────────────
  const state = {
    points: [],         // { x, y, label }
    weights: [0, 0, 0], // [bias, w1, w2]
    iter: 0,
    loss: Math.log(2),
    acc: 0.5,
    lr: 0.30,
    l2: 0.005,
    activeClass: 1,
    running: true,
    lossHistory: [],
  };

  // ── DOM refs (resolved on init) ─────────────────────────
  let canvas, ctx, lossCanvas, lossCtx;
  let elIter, elLoss, elAcc, elN, elW0, elW1;
  let elDateline;

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    canvas = document.getElementById('lr-canvas');
    lossCanvas = document.getElementById('lr-loss-chart');
    if (!canvas || !lossCanvas) return;
    ctx = canvas.getContext('2d');
    lossCtx = lossCanvas.getContext('2d');
    if (!ctx || !lossCtx) return;  // canvas not supported here; bail silently

    elIter = document.getElementById('lr-m-iter');
    elLoss = document.getElementById('lr-m-loss');
    elAcc = document.getElementById('lr-m-acc');
    elN = document.getElementById('lr-m-n');
    elW0 = document.getElementById('lr-m-w0');
    elW1 = document.getElementById('lr-m-w1');
    elDateline = document.getElementById('dateline-time');

    setDateline();
    wireControls();
    loadPreset('blobs');
    requestAnimationFrame(loop);
  }

  function setDateline() {
    if (!elDateline) return;
    const d = new Date();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    elDateline.textContent = months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function wireControls() {
    const lrSlider = document.getElementById('lr-lr');
    const lrVal = document.getElementById('lr-lr-val');
    if (lrSlider && lrVal) {
      lrSlider.addEventListener('input', () => {
        state.lr = parseFloat(lrSlider.value);
        lrVal.textContent = state.lr.toFixed(2);
      });
    }
    const l2Slider = document.getElementById('lr-l2');
    const l2Val = document.getElementById('lr-l2-val');
    if (l2Slider && l2Val) {
      l2Slider.addEventListener('input', () => {
        state.l2 = parseFloat(l2Slider.value);
        l2Val.textContent = state.l2.toFixed(3);
      });
    }

    const posBtn = document.getElementById('lr-class-pos');
    const negBtn = document.getElementById('lr-class-neg');
    const activeName = document.getElementById('lr-active-class-name');
    function setActive(cls) {
      state.activeClass = cls;
      if (posBtn) posBtn.classList.toggle('active', cls === 1);
      if (negBtn) negBtn.classList.toggle('active', cls === 0);
      if (activeName) activeName.textContent = cls === 1 ? 'positive' : 'negative';
    }
    if (posBtn) posBtn.addEventListener('click', () => setActive(1));
    if (negBtn) negBtn.addEventListener('click', () => setActive(0));

    const trainBtn = document.getElementById('lr-train');
    if (trainBtn) {
      trainBtn.addEventListener('click', () => {
        state.running = !state.running;
        trainBtn.textContent = state.running ? 'Pause' : 'Resume';
      });
    }
    const stepBtn = document.getElementById('lr-step');
    if (stepBtn) {
      stepBtn.addEventListener('click', () => {
        for (let i = 0; i < 100; i++) trainStep();
      });
    }
    const resetBtn = document.getElementById('lr-reset-weights');
    if (resetBtn) resetBtn.addEventListener('click', resetWeights);
    const clearBtn = document.getElementById('lr-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        state.points = [];
        resetWeights();
      });
    }

    const presetSel = document.getElementById('lr-preset');
    if (presetSel) {
      presetSel.addEventListener('change', () => loadPreset(presetSel.value));
    }

    canvas.addEventListener('click', onCanvasClick);
  }

  function onCanvasClick(ev) {
    const rect = canvas.getBoundingClientRect();
    const cx = (ev.clientX - rect.left) * (canvas.width / rect.width);
    const cy = (ev.clientY - rect.top) * (canvas.height / rect.height);
    const fx = px2fx(cx, canvas.width);
    const fy = py2fy(cy, canvas.height);
    state.points.push({ x: fx, y: fy, label: state.activeClass });
  }

  function resetWeights() {
    state.weights = [
      (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 0.2,
    ];
    state.iter = 0;
    state.lossHistory = [];
  }

  function loadPreset(name) {
    const pts = [];
    function addCloud(cx, cy, sd, label, n) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.abs(randn()) * sd;
        pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, label });
      }
    }
    if (name === 'blobs') {
      addCloud(-0.45,  0.30, 0.18, 1, 28);
      addCloud( 0.45, -0.30, 0.18, 0, 28);
    } else if (name === 'overlap') {
      addCloud(-0.20,  0.10, 0.30, 1, 32);
      addCloud( 0.20, -0.10, 0.30, 0, 32);
    } else if (name === 'moons') {
      const N = 30;
      for (let i = 0; i < N; i++) {
        const t = Math.PI * (i / (N - 1));
        const x = Math.cos(t) * 0.55 - 0.05;
        const y = Math.sin(t) * 0.45 + 0.05;
        pts.push({ x: x + (Math.random() - 0.5) * 0.06, y: y + (Math.random() - 0.5) * 0.06, label: 1 });
      }
      for (let i = 0; i < N; i++) {
        const t = Math.PI * (i / (N - 1));
        const x = -Math.cos(t) * 0.55 + 0.05;
        const y = -Math.sin(t) * 0.45 - 0.05;
        pts.push({ x: x + (Math.random() - 0.5) * 0.06, y: y + (Math.random() - 0.5) * 0.06, label: 0 });
      }
    } else if (name === 'empty') {
      // intentionally empty
    }
    state.points = pts;
    resetWeights();
  }

  function randn() {
    // Box-Muller
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function sigmoid(z) {
    if (z >= 0) {
      const ez = Math.exp(-z);
      return 1 / (1 + ez);
    }
    const ez = Math.exp(z);
    return ez / (1 + ez);
  }

  function trainStep() {
    const pts = state.points;
    const n = pts.length;
    if (n === 0) return;

    let g0 = 0, g1 = 0, g2 = 0;
    let lossSum = 0;
    let correct = 0;

    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const z = state.weights[0] + state.weights[1] * p.x + state.weights[2] * p.y;
      const yhat = sigmoid(z);
      const err = yhat - p.label;
      g0 += err;
      g1 += err * p.x;
      g2 += err * p.y;
      // log loss with clamp to avoid log(0)
      const yh = Math.min(Math.max(yhat, 1e-7), 1 - 1e-7);
      lossSum += -(p.label * Math.log(yh) + (1 - p.label) * Math.log(1 - yh));
      if ((yhat >= 0.5 ? 1 : 0) === p.label) correct++;
    }

    const inv = 1 / n;
    g0 *= inv; g1 *= inv; g2 *= inv;
    // L2 only on weights, not on bias (standard practice)
    g1 += state.l2 * state.weights[1];
    g2 += state.l2 * state.weights[2];

    state.weights[0] -= state.lr * g0;
    state.weights[1] -= state.lr * g1;
    state.weights[2] -= state.lr * g2;

    state.iter++;
    state.loss = lossSum / n;
    state.acc = correct / n;
    state.lossHistory.push(state.loss);
    if (state.lossHistory.length > LOSS_HISTORY) state.lossHistory.shift();
  }

  // ── Rendering ───────────────────────────────────────────
  function drawSurface() {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Probability shading: cells of (w / GRID_W) × (h / GRID_H)
    const cellW = w / GRID_W;
    const cellH = h / GRID_H;
    for (let i = 0; i < GRID_W; i++) {
      for (let j = 0; j < GRID_H; j++) {
        const fx = px2fx(i * cellW + cellW / 2, w);
        const fy = py2fy(j * cellH + cellH / 2, h);
        const z = state.weights[0] + state.weights[1] * fx + state.weights[2] * fy;
        const p = sigmoid(z);
        ctx.fillStyle = probColor(p);
        ctx.fillRect(i * cellW, j * cellH, cellW + 1, cellH + 1);
      }
    }

    // Decision boundary (where w0 + w1 x + w2 y = 0)
    drawBoundary();

    // Points
    for (let i = 0; i < state.points.length; i++) {
      const p = state.points[i];
      const cx = fx2px(p.x, w);
      const cy = fy2py(p.y, h);
      ctx.beginPath();
      ctx.arc(cx, cy, POINT_R, 0, Math.PI * 2);
      if (p.label === 1) {
        ctx.fillStyle = getCss('--accent') || '#c93b3b';
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = getCss('--paper') || '#f5efe6';
        ctx.stroke();
      } else {
        ctx.fillStyle = getCss('--ink') || '#1a1816';
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = getCss('--paper') || '#f5efe6';
        ctx.stroke();
      }
    }
  }

  function drawBoundary() {
    const w = canvas.width, h = canvas.height;
    const w0 = state.weights[0], w1 = state.weights[1], w2 = state.weights[2];
    // Line: w0 + w1 x + w2 y = 0
    // Solve for two endpoints across the plotted feature box [-1, 1].
    if (Math.abs(w2) < 1e-6 && Math.abs(w1) < 1e-6) return;
    let p1, p2;
    if (Math.abs(w2) >= Math.abs(w1)) {
      const x1 = -1, x2 = 1;
      const y1 = -(w0 + w1 * x1) / w2;
      const y2 = -(w0 + w1 * x2) / w2;
      p1 = [fx2px(x1, w), fy2py(y1, h)];
      p2 = [fx2px(x2, w), fy2py(y2, h)];
    } else {
      const y1 = -1, y2 = 1;
      const x1 = -(w0 + w2 * y1) / w1;
      const x2 = -(w0 + w2 * y2) / w1;
      p1 = [fx2px(x1, w), fy2py(y1, h)];
      p2 = [fx2px(x2, w), fy2py(y2, h)];
    }
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = getCss('--ink') || '#1a1816';
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function probColor(p) {
    // Blend toward accent (red, positive) or ink (dark, negative).
    // Use a low-alpha overlay so the paper background stays editorial.
    if (p >= 0.5) {
      const a = (p - 0.5) * 0.45;        // up to 0.225 alpha
      return `rgba(201, 59, 59, ${a.toFixed(3)})`;
    }
    const a = (0.5 - p) * 0.30;          // up to 0.15 alpha
    return `rgba(26, 24, 22, ${a.toFixed(3)})`;
  }

  function drawLossChart() {
    const w = lossCanvas.width, h = lossCanvas.height;
    lossCtx.clearRect(0, 0, w, h);
    const hist = state.lossHistory;
    if (hist.length < 2) return;
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < hist.length; i++) {
      if (hist[i] < min) min = hist[i];
      if (hist[i] > max) max = hist[i];
    }
    if (max - min < 1e-4) max = min + 1e-4;
    // axes
    lossCtx.strokeStyle = getCss('--ink-dim') || '#888';
    lossCtx.lineWidth = 0.5;
    lossCtx.beginPath();
    lossCtx.moveTo(40, 10);
    lossCtx.lineTo(40, h - 24);
    lossCtx.lineTo(w - 10, h - 24);
    lossCtx.stroke();

    // line
    lossCtx.strokeStyle = getCss('--accent') || '#c93b3b';
    lossCtx.lineWidth = 1.5;
    lossCtx.beginPath();
    for (let i = 0; i < hist.length; i++) {
      const x = 40 + (i / (LOSS_HISTORY - 1)) * (w - 50);
      const y = (h - 24) - ((hist[i] - min) / (max - min)) * (h - 34);
      if (i === 0) lossCtx.moveTo(x, y); else lossCtx.lineTo(x, y);
    }
    lossCtx.stroke();

    // labels
    lossCtx.fillStyle = getCss('--ink-dim') || '#888';
    lossCtx.font = '10px DM Mono, monospace';
    lossCtx.fillText(max.toFixed(3), 4, 14);
    lossCtx.fillText(min.toFixed(3), 4, h - 26);
    lossCtx.fillText('iter', w - 28, h - 8);
  }

  function getCss(name) {
    try {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    } catch (e) {
      return '';
    }
  }

  function updateMetrics() {
    if (elIter) elIter.textContent = state.iter;
    if (elLoss) elLoss.textContent = state.loss.toFixed(3);
    if (elAcc) elAcc.innerHTML = (state.acc * 100).toFixed(1) + '<span class="lr-pct">%</span>';
    if (elN) elN.textContent = state.points.length;
    if (elW0) elW0.textContent = state.weights[0].toFixed(2);
    if (elW1) elW1.textContent = state.weights[1].toFixed(2);
  }

  function loop() {
    if (state.running) {
      for (let s = 0; s < STEPS_PER_FRAME; s++) trainStep();
    }
    drawSurface();
    drawLossChart();
    updateMetrics();
    requestAnimationFrame(loop);
  }
})();
