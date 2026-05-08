/* ═══════════════════════════════════════════════════════════
   DIFFUSION LAB — pure JS toy diffusion model
   32×32 grid, DDPM forward/reverse, oracle denoiser.
   ═══════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  const GRID_SIZE = 32;
  const DISPLAY_SIZE = 512;
  const T = 20;
  const BETA_START = 1e-4;
  const BETA_END = 0.02;
  const CELL_SIZE = DISPLAY_SIZE / GRID_SIZE; // 16

  // State
  let x0 = new Float32Array(GRID_SIZE * GRID_SIZE);
  let noise = new Float32Array(GRID_SIZE * GRID_SIZE);
  let scheduleType = 'linear';
  let currentT = 0;
  let animating = false;
  let animDir = 0; // +1 diffuse, -1 denoise
  let animTimer = null;

  // Precomputed schedules: { alpha, alphaBar, beta } each Float32Array[T+1]
  let linearSched = null;
  let cosineSched = null;

  // DOM refs
  const canvas = document.getElementById('df-canvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('df-canvas-overlay');
  const tSlider = document.getElementById('df-t-slider');
  const stepSlider = document.getElementById('df-step-slider');
  const totalStepsEl = document.getElementById('df-total-steps');
  const currentStepEl = document.getElementById('df-current-step');
  const stepDisplayEl = document.getElementById('df-step-display');
  const processLabelEl = document.getElementById('df-process-label');
  const diffuseBtn = document.getElementById('df-diffuse-btn');
  const denoiseBtn = document.getElementById('df-denoise-btn');
  const resetBtn = document.getElementById('df-reset-btn');

  // Schedule explorer canvases
  const schedLinearCanvas = document.getElementById('df-schedule-linear');
  const schedCosineCanvas = document.getElementById('df-schedule-cosine');
  const betaLinearCanvas = document.getElementById('df-beta-linear');
  const betaCosineCanvas = document.getElementById('df-beta-cosine');
  const mseLinearEl = document.getElementById('df-mse-linear');
  const mseCosineEl = document.getElementById('df-mse-cosine');

  /* ── Math helpers ─────────────────────────────────────────── */

  function randn() {
    // Box-Muller
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function computeLinearSchedule() {
    const alpha = new Float32Array(T + 1);
    const alphaBar = new Float32Array(T + 1);
    const beta = new Float32Array(T + 1);
    alphaBar[0] = 1.0;
    beta[0] = 0;
    alpha[0] = 1;
    for (let t = 1; t <= T; t++) {
      beta[t] = BETA_START + (BETA_END - BETA_START) * (t - 1) / (T - 1);
      alpha[t] = 1 - beta[t];
      alphaBar[t] = alphaBar[t - 1] * alpha[t];
    }
    return { alpha, alphaBar, beta };
  }

  function computeCosineSchedule() {
    const alpha = new Float32Array(T + 1);
    const alphaBar = new Float32Array(T + 1);
    const beta = new Float32Array(T + 1);
    const s = 0.008;
    const f0 = Math.cos((s / (1 + s)) * Math.PI / 2);
    const f0sq = f0 * f0;
    alphaBar[0] = 1.0;
    beta[0] = 0;
    alpha[0] = 1;
    for (let t = 1; t <= T; t++) {
      const ft = Math.cos((((t / T) + s) / (1 + s)) * Math.PI / 2);
      let ab = (ft * ft) / f0sq;
      ab = Math.max(ab, 1e-6); // avoid division by zero in reverse
      alphaBar[t] = ab;
      let b = 1 - alphaBar[t] / alphaBar[t - 1];
      b = clamp(b, 0, 0.999);
      beta[t] = b;
      alpha[t] = 1 - b;
    }
    return { alpha, alphaBar, beta };
  }

  function getSchedule() {
    return scheduleType === 'linear' ? linearSched : cosineSched;
  }

  /* ── Grid helpers ─────────────────────────────────────────── */

  function idx(r, c) {
    return r * GRID_SIZE + c;
  }

  function generateNoise() {
    for (let i = 0; i < noise.length; i++) {
      noise[i] = randn();
    }
  }

  function forward(x0Arr, t, sched) {
    // Returns x_t for the whole grid as a new Float32Array
    const out = new Float32Array(GRID_SIZE * GRID_SIZE);
    const aBar = sched.alphaBar[t];
    const sqrtABar = Math.sqrt(aBar);
    const sqrt1m = Math.sqrt(1 - aBar);
    for (let i = 0; i < out.length; i++) {
      out[i] = sqrtABar * x0Arr[i] + sqrt1m * noise[i];
    }
    return out;
  }

  function reverseOracle(xt, t, sched) {
    // Predict x0 from xt using the true noise, then compute x_{t-1}
    const aBar = sched.alphaBar[t];
    const aBarPrev = sched.alphaBar[t - 1];
    const sqrtABar = Math.sqrt(aBar);
    const sqrt1m = Math.sqrt(1 - aBar);
    const sqrtABarPrev = Math.sqrt(aBarPrev);
    const sqrt1mPrev = Math.sqrt(1 - aBarPrev);

    const out = new Float32Array(GRID_SIZE * GRID_SIZE);
    for (let i = 0; i < out.length; i++) {
      const x0Pred = (xt[i] - sqrt1m * noise[i]) / sqrtABar;
      out[i] = sqrtABarPrev * x0Pred + sqrt1mPrev * noise[i];
    }
    return out;
  }

  function mse(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) {
      const d = a[i] - b[i];
      s += d * d;
    }
    return s / a.length;
  }

  /* ── Presets ──────────────────────────────────────────────── */

  function clearGrid() {
    for (let i = 0; i < x0.length; i++) x0[i] = -1;
  }

  function setCell(r, c, v) {
    if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
      x0[idx(r, c)] = v;
    }
  }

  function loadPreset(name) {
    clearGrid();
    const cx = Math.floor(GRID_SIZE / 2);
    const cy = Math.floor(GRID_SIZE / 2);

    if (name === 'smiley') {
      // Circle outline
      const R = 12;
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          const dr = r - cy;
          const dc = c - cx;
          const d = Math.sqrt(dr * dr + dc * dc);
          if (d >= R - 0.8 && d <= R + 0.8) x0[idx(r, c)] = 1;
        }
      }
      // Eyes
      setCell(cy - 4, cx - 4, 1);
      setCell(cy - 4, cx - 3, 1);
      setCell(cy - 4, cx + 4, 1);
      setCell(cy - 4, cx + 3, 1);
      setCell(cy - 3, cx - 4, 1);
      setCell(cy - 3, cx - 3, 1);
      setCell(cy - 3, cx + 4, 1);
      setCell(cy - 3, cx + 3, 1);
      // Smile (arc)
      for (let dc = -6; dc <= 6; dc++) {
        const dy = Math.round(Math.sqrt(Math.max(0, 36 - dc * dc)) * 0.35);
        setCell(cy + 4 + dy, cx + dc, 1);
      }
    } else if (name === 'checkerboard') {
      const block = 4;
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          const br = Math.floor(r / block);
          const bc = Math.floor(c / block);
          x0[idx(r, c)] = ((br + bc) % 2 === 0) ? 1 : -1;
        }
      }
    } else if (name === 'spiral') {
      const turns = 3;
      const maxR = 14;
      for (let i = 0; i < 2000; i++) {
        const t = (i / 2000) * turns * 2 * Math.PI;
        const r = (t / (turns * 2 * Math.PI)) * maxR;
        const rr = Math.round(cy + r * Math.sin(t));
        const cc = Math.round(cx + r * Math.cos(t));
        setCell(rr, cc, 1);
        // Thicken
        setCell(rr + 1, cc, 1);
        setCell(rr, cc + 1, 1);
        setCell(rr - 1, cc, 1);
        setCell(rr, cc - 1, 1);
      }
    } else if (name === 'heart') {
      for (let i = 0; i < 4000; i++) {
        const t = (i / 4000) * 2 * Math.PI;
        const xx = 16 * Math.pow(Math.sin(t), 3);
        const yy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        const rr = Math.round(cy - yy * 0.45);
        const cc = Math.round(cx + xx * 0.45);
        setCell(rr, cc, 1);
        setCell(rr + 1, cc, 1);
        setCell(rr, cc + 1, 1);
        setCell(rr - 1, cc, 1);
        setCell(rr, cc - 1, 1);
      }
    } else if (name === 'clear') {
      // already cleared
    }

    currentT = 0;
    updateSliders();
    render();
    updateScheduleExplorer();
  }

  /* ── Rendering ────────────────────────────────────────────── */

  function valueToGray(v) {
    // Map [-2, 2] to [0, 255]
    const n = (v + 2) / 4;
    const g = Math.round(clamp(n, 0, 1) * 255);
    return g;
  }

  function renderGrid(grid) {
    ctx.clearRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE);
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const v = grid[idx(r, c)];
        const g = valueToGray(v);
        ctx.fillStyle = 'rgb(' + g + ',' + g + ',' + g + ')';
        ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }

  function render() {
    const sched = getSchedule();
    let grid;
    if (currentT === 0) {
      grid = x0;
    } else {
      grid = forward(x0, currentT, sched);
    }
    renderGrid(grid);

    stepDisplayEl.textContent = currentT;
    if (currentT === 0) {
      processLabelEl.textContent = 'Clean image';
    } else if (currentT === T) {
      processLabelEl.textContent = 'Fully noised';
    } else {
      processLabelEl.textContent = 'Noise level ' + Math.round((currentT / T) * 100) + '%';
    }
  }

  function renderGridToCanvas(targetCtx, gridArr, size) {
    const cs = size / GRID_SIZE;
    targetCtx.clearRect(0, 0, size, size);
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const v = gridArr[idx(r, c)];
        const g = valueToGray(v);
        targetCtx.fillStyle = 'rgb(' + g + ',' + g + ',' + g + ')';
        targetCtx.fillRect(c * cs, r * cs, cs, cs);
      }
    }
  }

  function drawBetaCurve(canvasEl, sched) {
    const c = canvasEl.getContext('2d');
    const w = canvasEl.width;
    const h = canvasEl.height;
    c.clearRect(0, 0, w, h);

    // Background
    c.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--paper-2').trim() || '#1C1A17';
    c.fillRect(0, 0, w, h);

    // Find max beta for scaling
    let maxB = 0;
    for (let t = 1; t <= T; t++) maxB = Math.max(maxB, sched.beta[t]);
    if (maxB < 0.001) maxB = 0.001;

    const padL = 24, padR = 8, padT = 8, padB = 20;
    const graphW = w - padL - padR;
    const graphH = h - padT - padB;

    // Axis lines
    c.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink-dim').trim() || '#6B6359';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(padL, padT);
    c.lineTo(padL, h - padB);
    c.lineTo(w - padR, h - padB);
    c.stroke();

    // Beta curve
    c.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#D45D3F';
    c.lineWidth = 2;
    c.beginPath();
    for (let t = 0; t <= T; t++) {
      const x = padL + (t / T) * graphW;
      const y = (h - padB) - (sched.beta[t] / maxB) * graphH;
      if (t === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();

    // Labels
    c.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink-dim').trim() || '#6B6359';
    c.font = '9px "DM Mono", monospace';
    c.textAlign = 'center';
    c.fillText('0', padL, h - 4);
    c.fillText(String(T), w - padR, h - 4);
    c.fillText('β', padL - 12, padT + 8);
  }

  function updateScheduleExplorer() {
    // Show the reconstructed image (after full reverse) for each schedule
    // and compute MSE

    // Linear
    const schedL = linearSched;
    let gridL = forward(x0, T, schedL);
    for (let t = T; t >= 1; t--) {
      gridL = reverseOracle(gridL, t, schedL);
    }
    // gridL is now x_0 reconstructed
    const mseL = mse(x0, gridL);
    const ctxL = schedLinearCanvas.getContext('2d');
    renderGridToCanvas(ctxL, gridL, 256);
    drawBetaCurve(betaLinearCanvas, schedL);
    mseLinearEl.textContent = mseL < 1e-10 ? '~0' : mseL.toExponential(2);

    // Cosine
    const schedC = cosineSched;
    let gridC = forward(x0, T, schedC);
    for (let t = T; t >= 1; t--) {
      gridC = reverseOracle(gridC, t, schedC);
    }
    const mseC = mse(x0, gridC);
    const ctxC = schedCosineCanvas.getContext('2d');
    renderGridToCanvas(ctxC, gridC, 256);
    drawBetaCurve(betaCosineCanvas, schedC);
    mseCosineEl.textContent = mseC < 1e-10 ? '~0' : mseC.toExponential(2);
  }

  /* ── Animation ────────────────────────────────────────────── */

  function stopAnimation() {
    if (animTimer) {
      clearTimeout(animTimer);
      animTimer = null;
    }
    animating = false;
    animDir = 0;
    diffuseBtn.disabled = false;
    denoiseBtn.disabled = false;
    diffuseBtn.textContent = 'Diffuse';
    denoiseBtn.textContent = 'Denoise';
  }

  function tickAnimation() {
    if (!animating) return;
    currentT += animDir;
    if (currentT < 0) currentT = 0;
    if (currentT > T) currentT = T;
    updateSliders();
    render();

    if ((animDir > 0 && currentT >= T) || (animDir < 0 && currentT <= 0)) {
      stopAnimation();
      return;
    }
    animTimer = setTimeout(tickAnimation, 200);
  }

  function startDiffuse() {
    if (animating) { stopAnimation(); return; }
    animating = true;
    animDir = 1;
    currentT = 0;
    diffuseBtn.disabled = false;
    denoiseBtn.disabled = true;
    diffuseBtn.textContent = 'Stop';
    updateSliders();
    render();
    animTimer = setTimeout(tickAnimation, 200);
  }

  function startDenoise() {
    if (animating) { stopAnimation(); return; }
    animating = true;
    animDir = -1;
    currentT = T;
    diffuseBtn.disabled = true;
    denoiseBtn.disabled = false;
    denoiseBtn.textContent = 'Stop';
    updateSliders();
    render();
    animTimer = setTimeout(tickAnimation, 200);
  }

  /* ── Controls ─────────────────────────────────────────────── */

  function updateSliders() {
    tSlider.value = currentT;
    stepSlider.value = currentT;
    currentStepEl.textContent = currentT;
  }

  function bindEvents() {
    // Preset buttons
    document.querySelectorAll('.df-tool-btn[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        loadPreset(btn.dataset.preset);
        // Update active state
        document.querySelectorAll('.df-tool-btn[data-preset]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Schedule toggle
    document.querySelectorAll('.df-pill[data-schedule]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.df-pill[data-schedule]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        scheduleType = btn.dataset.schedule;
        render();
        updateScheduleExplorer();
      });
    });

    // Sliders
    tSlider.addEventListener('input', () => {
      stopAnimation();
      currentT = parseInt(tSlider.value, 10);
      updateSliders();
      render();
    });

    stepSlider.addEventListener('input', () => {
      stopAnimation();
      currentT = parseInt(stepSlider.value, 10);
      updateSliders();
      render();
    });

    // Action buttons
    diffuseBtn.addEventListener('click', startDiffuse);
    denoiseBtn.addEventListener('click', startDenoise);
    resetBtn.addEventListener('click', () => {
      stopAnimation();
      currentT = 0;
      updateSliders();
      render();
    });

    // Canvas interaction
    let drawing = false;
    let paintValue = 1;

    function getCellFromEvent(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = DISPLAY_SIZE / rect.width;
      const scaleY = DISPLAY_SIZE / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      const c = Math.floor(x / CELL_SIZE);
      const r = Math.floor(y / CELL_SIZE);
      return { r, c };
    }

    function paintCell(r, c) {
      if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
        x0[idx(r, c)] = paintValue;
        stopAnimation();
        currentT = 0;
        updateSliders();
        render();
        updateScheduleExplorer();
        if (overlay) overlay.classList.add('hidden');
      }
    }

    canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const { r, c } = getCellFromEvent(e);
      if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
        paintValue = x0[idx(r, c)] > 0 ? -1 : 1;
        paintCell(r, c);
        drawing = true;
      }
    });
    canvas.addEventListener('mousemove', (e) => {
      if (!drawing) return;
      e.preventDefault();
      const { r, c } = getCellFromEvent(e);
      paintCell(r, c);
    });
    window.addEventListener('mouseup', () => { drawing = false; });

    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        e.preventDefault();
        const t = e.touches[0];
        const { r, c } = getCellFromEvent(t);
        if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
          paintValue = x0[idx(r, c)] > 0 ? -1 : 1;
          paintCell(r, c);
          drawing = true;
        }
      }
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      if (!drawing) return;
      if (e.touches.length > 0) {
        e.preventDefault();
        const t = e.touches[0];
        const { r, c } = getCellFromEvent(t);
        paintCell(r, c);
      }
    }, { passive: false });
    window.addEventListener('touchend', () => { drawing = false; });
  }

  /* ── Init ─────────────────────────────────────────────────── */

  function init() {
    linearSched = computeLinearSchedule();
    cosineSched = computeCosineSchedule();
    generateNoise();
    loadPreset('smiley');
    document.querySelector('.df-tool-btn[data-preset="smiley"]').classList.add('active');
    bindEvents();
    totalStepsEl.textContent = T;
    updateSliders();
    render();
    updateScheduleExplorer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
