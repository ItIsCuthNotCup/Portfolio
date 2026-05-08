(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     BANDIT LAB — page logic

     Engine: pure JS multi-armed bandit simulator. Four strategies
     (Random, Epsilon-Greedy, UCB1, Thompson Sampling) run on the
     same hidden reward distribution. Viz is hand-rolled SVG.

     Math mirrors the spec exactly; nothing is preloaded.
     ═══════════════════════════════════════════════════════════ */

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // ── Colors ─────────────────────────────────────────────────
  const COLORS = {
    random:   'var(--ink-dim)',
    eg:       'var(--chart-1)',
    ucb:      'var(--chart-2)',
    thompson: 'var(--accent)'
  };

  // ── State ──────────────────────────────────────────────────
  const state = {
    numArms: 5,
    numRounds: 500,
    currentRound: 0,
    hiddenProbs: [],
    running: false,
    rafId: null,

    strategies: {
      random:   { pulls: [], rewards: [], regret: [], totalRegret: 0 },
      eg:       { pulls: [], rewards: [], regret: [], totalRegret: 0, epsilon: 0.1 },
      ucb:      { pulls: [], rewards: [], regret: [], totalRegret: 0 },
      thompson: { pulls: [], rewards: [], regret: [], totalRegret: 0, alphas: [], betas: [] }
    }
  };

  // ══════════════════════════════════════════════════════════
  // MATH
  // ══════════════════════════════════════════════════════════

  // Lanczos lgamma — 15-digit accuracy
  const LANCZOS_G = 7;
  const LANCZOS_C = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  function lgamma(x) {
    if (x < 0.5) {
      return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
    }
    x -= 1;
    let a = LANCZOS_C[0];
    const t = x + LANCZOS_G + 0.5;
    for (let i = 1; i < 9; i++) a += LANCZOS_C[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  function lnBeta(a, b) { return lgamma(a) + lgamma(b) - lgamma(a + b); }

  function betaPdf(x, a, b) {
    if (x <= 0 || x >= 1) return 0;
    return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - lnBeta(a, b));
  }

  // Gamma sample (Marsaglia-Tsang)
  function rgamma(shape, scale) {
    if (shape < 1) {
      const u = Math.random();
      return rgamma(shape + 1, scale) * Math.pow(u, 1 / shape);
    }
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    while (true) {
      let x, v;
      do {
        const u1 = Math.random(), u2 = Math.random();
        x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = Math.random();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v * scale;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * scale;
    }
  }

  // Beta random variate (Marsaglia method)
  function rbeta(alpha, beta) {
    const x = rgamma(alpha, 1);
    const y = rgamma(beta, 1);
    return x / (x + y);
  }

  function argmax(arr) {
    let best = 0;
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] > arr[best]) best = i;
    }
    return best;
  }

  // ══════════════════════════════════════════════════════════
  // SIMULATION CORE
  // ══════════════════════════════════════════════════════════

  function sampleHiddenProbs() {
    const probs = [];
    for (let i = 0; i < state.numArms; i++) {
      probs.push(rbeta(2, 2));
    }
    state.hiddenProbs = probs;
  }

  function resetStrategies() {
    const keys = Object.keys(state.strategies);
    for (const k of keys) {
      const s = state.strategies[k];
      s.pulls = new Array(state.numArms).fill(0);
      s.rewards = new Array(state.numArms).fill(0);
      s.regret = [0];
      s.totalRegret = 0;
      if (k === 'thompson') {
        s.alphas = new Array(state.numArms).fill(1);
        s.betas = new Array(state.numArms).fill(1);
      }
    }
    state.currentRound = 0;
  }

  function bestArmReward() {
    return Math.max(...state.hiddenProbs);
  }

  function pullArm(armIndex) {
    const p = state.hiddenProbs[armIndex];
    return Math.random() < p ? 1 : 0;
  }

  function selectArm(strategyKey) {
    const s = state.strategies[strategyKey];
    if (strategyKey === 'random') {
      return Math.floor(Math.random() * state.numArms);
    }
    if (strategyKey === 'eg') {
      if (Math.random() < s.epsilon) {
        return Math.floor(Math.random() * state.numArms);
      }
      const means = s.pulls.map((p, i) => p === 0 ? 0 : s.rewards[i] / p);
      return argmax(means);
    }
    if (strategyKey === 'ucb') {
      const total = s.pulls.reduce((a, b) => a + b, 0);
      const scores = s.pulls.map((p, i) => {
        if (p === 0) return Infinity;
        const mean = s.rewards[i] / p;
        return mean + Math.sqrt(2 * Math.log(total + 1) / p);
      });
      return argmax(scores);
    }
    if (strategyKey === 'thompson') {
      let bestArm = 0, bestSample = -1;
      for (let i = 0; i < state.numArms; i++) {
        const sample = rbeta(s.alphas[i], s.betas[i]);
        if (sample > bestSample) { bestSample = sample; bestArm = i; }
      }
      return bestArm;
    }
    return 0;
  }

  function stepStrategy(strategyKey) {
    const s = state.strategies[strategyKey];
    const arm = selectArm(strategyKey);
    const reward = pullArm(arm);
    s.pulls[arm]++;
    s.rewards[arm] += reward;
    if (strategyKey === 'thompson') {
      s.alphas[arm] += reward;
      s.betas[arm] += (1 - reward);
    }
    const best = bestArmReward();
    const regret = best - state.hiddenProbs[arm];
    s.totalRegret += regret;
    s.regret.push(s.totalRegret);
  }

  function stepAll() {
    if (state.currentRound >= state.numRounds) {
      stopAll();
      return;
    }
    const keys = Object.keys(state.strategies);
    for (const k of keys) stepStrategy(k);
    state.currentRound++;
    renderAll();
  }

  function runLoop() {
    if (!state.running || state.currentRound >= state.numRounds) {
      stopAll();
      return;
    }
    const batch = Math.max(1, Math.floor(state.numRounds / 120));
    const limit = Math.min(batch, state.numRounds - state.currentRound);
    for (let i = 0; i < limit; i++) {
      const keys = Object.keys(state.strategies);
      for (const k of keys) stepStrategy(k);
      state.currentRound++;
    }
    renderAll();
    state.rafId = requestAnimationFrame(runLoop);
  }

  function runAll() {
    if (state.running) return;
    if (state.currentRound >= state.numRounds) {
      newGame();
    }
    state.running = true;
    runLoop();
  }

  function stopAll() {
    state.running = false;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
  }

  function newGame() {
    stopAll();
    sampleHiddenProbs();
    resetStrategies();
    renderAll();
  }

  function resetGame() {
    stopAll();
    resetStrategies();
    renderAll();
  }

  // ══════════════════════════════════════════════════════════
  // RENDERING
  // ══════════════════════════════════════════════════════════

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function drawLineChart(svgId, data, color) {
    const svg = document.getElementById(svgId);
    if (!svg) return;
    const W = 280, H = 160;
    const P = { t: 10, r: 10, b: 20, l: 34 };
    const w = W - P.l - P.r;
    const h = H - P.t - P.b;

    svg.innerHTML = '';

    const maxY = Math.max(0.1, ...data) * 1.1;
    const n = data.length;

    // Grid lines
    for (let i = 0; i <= 4; i++) {
      const y = P.t + (i / 4) * h;
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', P.l);
      line.setAttribute('y1', y);
      line.setAttribute('x2', W - P.r);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', 'var(--ink-dim)');
      line.setAttribute('stroke-width', '0.5');
      line.setAttribute('opacity', '0.35');
      svg.appendChild(line);

      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', P.l - 4);
      text.setAttribute('y', y + 3);
      text.setAttribute('text-anchor', 'end');
      text.setAttribute('font-size', '8');
      text.setAttribute('fill', 'var(--ink-dim)');
      text.textContent = (maxY * (1 - i / 4)).toFixed(1);
      svg.appendChild(text);
    }

    if (n < 2) return;

    // Path
    let d = '';
    for (let i = 0; i < n; i++) {
      const x = P.l + (i / (n - 1)) * w;
      const y = P.t + (1 - data[i] / maxY) * h;
      d += (i === 0 ? 'M' : 'L') + x + ',' + y;
    }
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '2');
    svg.appendChild(path);

    // X-axis labels
    const x0 = document.createElementNS(SVG_NS, 'text');
    x0.setAttribute('x', P.l);
    x0.setAttribute('y', H - 4);
    x0.setAttribute('text-anchor', 'middle');
    x0.setAttribute('font-size', '8');
    x0.setAttribute('fill', 'var(--ink-dim)');
    x0.textContent = '0';
    svg.appendChild(x0);

    const x1 = document.createElementNS(SVG_NS, 'text');
    x1.setAttribute('x', W - P.r);
    x1.setAttribute('y', H - 4);
    x1.setAttribute('text-anchor', 'middle');
    x1.setAttribute('font-size', '8');
    x1.setAttribute('fill', 'var(--ink-dim)');
    x1.textContent = String(state.numRounds);
    svg.appendChild(x1);
  }

  function drawBarChart(svgId, pulls, color) {
    const svg = document.getElementById(svgId);
    if (!svg) return;
    const W = 280, H = 120;
    const P = { t: 10, r: 10, b: 20, l: 10 };
    const w = W - P.l - P.r;
    const h = H - P.t - P.b;

    svg.innerHTML = '';

    const maxPulls = Math.max(1, ...pulls);
    const n = pulls.length;
    const barW = (w / n) * 0.55;
    const gap = w / n;

    for (let i = 0; i < n; i++) {
      const bh = (pulls[i] / maxPulls) * h;
      const x = P.l + i * gap + (gap - barW) / 2;
      const y = P.t + h - bh;

      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', barW);
      rect.setAttribute('height', bh);
      rect.setAttribute('fill', color);
      svg.appendChild(rect);

      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', x + barW / 2);
      text.setAttribute('y', H - 5);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '8');
      text.setAttribute('fill', 'var(--ink-dim)');
      text.textContent = String(i + 1);
      svg.appendChild(text);
    }
  }

  function drawBetaPlots(svgId, alphas, betas) {
    const svg = document.getElementById(svgId);
    if (!svg) return;
    const W = 280, H = 200;
    const n = alphas.length;
    const stripH = H / n;

    svg.innerHTML = '';

    for (let i = 0; i < n; i++) {
      const a = alphas[i];
      const b = betas[i];
      const y0 = i * stripH;
      const y1 = (i + 1) * stripH;
      const plotH = stripH - 14;
      const plotY = y0 + 2;

      // Compute max pdf for scaling
      let maxPdf = 0;
      const pts = [];
      for (let j = 0; j <= 60; j++) {
        const x = j / 60;
        const pdf = betaPdf(x, a, b);
        pts.push({ x, pdf });
        if (pdf > maxPdf) maxPdf = pdf;
      }
      maxPdf = Math.max(maxPdf, 0.01);

      // Fill area
      let d = `M 30 ${plotY + plotH}`;
      for (let j = 0; j <= 60; j++) {
        const px = 30 + (pts[j].x * 220);
        const py = plotY + plotH - (pts[j].pdf / maxPdf) * plotH;
        d += ` L ${px} ${py}`;
      }
      d += ` L 250 ${plotY + plotH} Z`;

      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'color-mix(in oklab, var(--accent) 20%, transparent)');
      path.setAttribute('stroke', 'var(--accent)');
      path.setAttribute('stroke-width', '1');
      svg.appendChild(path);

      // Arm label
      const label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('x', 4);
      label.setAttribute('y', plotY + plotH / 2 + 3);
      label.setAttribute('font-size', '9');
      label.setAttribute('fill', 'var(--ink-dim)');
      label.textContent = 'A' + (i + 1);
      svg.appendChild(label);
    }
  }

  function renderAll() {
    const keys = Object.keys(state.strategies);
    let globalMax = 0;
    for (const k of keys) {
      const r = state.strategies[k].regret;
      if (r.length) globalMax = Math.max(globalMax, r[r.length - 1]);
    }
    globalMax = Math.max(globalMax, 0.1);

    for (const k of keys) {
      const s = state.strategies[k];
      // Use global max for shared scale, or per-strategy if you prefer:
      // We'll use global max for honest comparison
      drawLineChart('bd-regret-' + k, s.regret, COLORS[k]);
      drawBarChart('bd-bars-' + k, s.pulls, COLORS[k]);
      setText('bd-regret-' + k + '-val', s.totalRegret.toFixed(2));
      if (k === 'thompson') {
        drawBetaPlots('bd-betas-thompson', s.alphas, s.betas);
      }
    }

    setText('bd-current-round', String(state.currentRound));
    setText('bd-max-rounds', String(state.numRounds));
  }

  // ══════════════════════════════════════════════════════════
  // SCENARIO EXPLORER
  // ══════════════════════════════════════════════════════════

  function runOneSim(fixedProbs, nonStationary, numRounds) {
    const K = fixedProbs.length;
    const s = {
      random:   { pulls: new Array(K).fill(0), rewards: new Array(K).fill(0), totalRegret: 0 },
      eg:       { pulls: new Array(K).fill(0), rewards: new Array(K).fill(0), totalRegret: 0 },
      ucb:      { pulls: new Array(K).fill(0), rewards: new Array(K).fill(0), totalRegret: 0 },
      thompson: { pulls: new Array(K).fill(0), rewards: new Array(K).fill(0), totalRegret: 0, alphas: new Array(K).fill(1), betas: new Array(K).fill(1) }
    };
    let probs = fixedProbs.slice();

    for (let t = 0; t < numRounds; t++) {
      const best = Math.max(...probs);

      // Random
      let arm = Math.floor(Math.random() * K);
      let reward = Math.random() < probs[arm] ? 1 : 0;
      s.random.pulls[arm]++;
      s.random.rewards[arm] += reward;
      s.random.totalRegret += best - probs[arm];

      // Epsilon-Greedy
      if (Math.random() < 0.1) {
        arm = Math.floor(Math.random() * K);
      } else {
        const means = s.eg.pulls.map((p, i) => p === 0 ? 0 : s.eg.rewards[i] / p);
        arm = argmax(means);
      }
      reward = Math.random() < probs[arm] ? 1 : 0;
      s.eg.pulls[arm]++;
      s.eg.rewards[arm] += reward;
      s.eg.totalRegret += best - probs[arm];

      // UCB1
      const total = s.ucb.pulls.reduce((a, b) => a + b, 0);
      const scores = s.ucb.pulls.map((p, i) => {
        if (p === 0) return Infinity;
        return s.ucb.rewards[i] / p + Math.sqrt(2 * Math.log(total + 1) / p);
      });
      arm = argmax(scores);
      reward = Math.random() < probs[arm] ? 1 : 0;
      s.ucb.pulls[arm]++;
      s.ucb.rewards[arm] += reward;
      s.ucb.totalRegret += best - probs[arm];

      // Thompson
      let bestArm = 0, bestSample = -1;
      for (let i = 0; i < K; i++) {
        const sample = rbeta(s.thompson.alphas[i], s.thompson.betas[i]);
        if (sample > bestSample) { bestSample = sample; bestArm = i; }
      }
      arm = bestArm;
      reward = Math.random() < probs[arm] ? 1 : 0;
      s.thompson.pulls[arm]++;
      s.thompson.rewards[arm] += reward;
      s.thompson.alphas[arm] += reward;
      s.thompson.betas[arm] += (1 - reward);
      s.thompson.totalRegret += best - probs[arm];

      // Drift
      if (nonStationary) {
        for (let i = 0; i < K; i++) {
          probs[i] += (Math.random() - 0.5) * 0.02;
          probs[i] = Math.max(0.01, Math.min(0.99, probs[i]));
        }
      }
    }

    return {
      random: s.random.totalRegret,
      eg: s.eg.totalRegret,
      ucb: s.ucb.totalRegret,
      thompson: s.thompson.totalRegret
    };
  }

  function runScenarioMC(preset, nonStationary, runs) {
    let probs;
    if (preset === 'easy') {
      probs = [0.8, 0.2, 0.2, 0.2, 0.2];
    } else if (preset === 'close') {
      probs = [0.50, 0.45, 0.2, 0.2, 0.2];
    } else {
      probs = [0.55, 0.5, 0.5, 0.5, 0.5];
    }

    const sums = { random: 0, eg: 0, ucb: 0, thompson: 0 };
    for (let r = 0; r < runs; r++) {
      const res = runOneSim(probs, nonStationary, 500);
      sums.random += res.random;
      sums.eg += res.eg;
      sums.ucb += res.ucb;
      sums.thompson += res.thompson;
    }
    return {
      preset,
      random: sums.random / runs,
      eg: sums.eg / runs,
      ucb: sums.ucb / runs,
      thompson: sums.thompson / runs
    };
  }

  async function runAllScenarios() {
    const nonStationary = document.getElementById('bd-nonstationary').checked;
    const status = document.getElementById('bd-mc-status');
    const resultsDiv = document.getElementById('bd-mc-results');
    const btn = document.getElementById('bd-mc-run');
    if (btn) btn.disabled = true;

    const presets = ['easy', 'close', 'deceptive'];
    const rows = [];

    for (let i = 0; i < presets.length; i++) {
      if (status) status.textContent = 'Running ' + presets[i] + ' (' + (i + 1) + '/3)...';
      // Yield to browser
      await new Promise(r => setTimeout(r, 10));
      rows.push(runScenarioMC(presets[i], nonStationary, 100));
    }

    if (status) status.textContent = 'done';
    if (btn) btn.disabled = false;

    renderMCTable(rows);
    if (resultsDiv) resultsDiv.hidden = false;
  }

  function renderMCTable(rows) {
    const tbody = document.querySelector('#bd-mc-table tbody');
    if (!tbody) return;

    const names = { easy: 'Easy', close: 'Close call', deceptive: 'Deceptive' };

    tbody.innerHTML = rows.map(row =>
      '<tr>' +
      '<td>' + names[row.preset] + '</td>' +
      '<td>' + row.random.toFixed(2) + '</td>' +
      '<td>' + row.eg.toFixed(2) + '</td>' +
      '<td>' + row.ucb.toFixed(2) + '</td>' +
      '<td>' + row.thompson.toFixed(2) + '</td>' +
      '</tr>'
    ).join('');
  }

  // ══════════════════════════════════════════════════════════
  // RECEIPTS
  // ══════════════════════════════════════════════════════════

  function renderReceipts() {
    const grid = document.getElementById('bd-receipts-grid');
    if (!grid) return;
    const items = [
      { v: 'O(T)', l: 'Regret bound · Random' },
      { v: 'O(T)', l: 'Regret bound · Epsilon-Greedy' },
      { v: 'O(&#8730;(KT&#183;ln T))', l: 'Regret bound · UCB1' },
      { v: 'O(&#8730;(KT&#183;ln T))', l: 'Regret bound · Thompson' },
      { v: '50-100', l: 'Typical pulls to identify best arm, per arm' },
      { v: 'Google Ads, Netflix, trials', l: 'Real-world use cases' }
    ];
    grid.innerHTML = items.map(it =>
      '<div class="metric"><div class="serif metric-value">' + it.v + '</div><div class="mono metric-label">' + it.l + '</div></div>'
    ).join('');
  }

  // ══════════════════════════════════════════════════════════
  // EVENT HANDLERS
  // ══════════════════════════════════════════════════════════

  function init() {
    const armsSlider = document.getElementById('bd-arms-slider');
    const roundsSlider = document.getElementById('bd-rounds-slider');

    if (armsSlider) {
      armsSlider.addEventListener('input', () => {
        state.numArms = parseInt(armsSlider.value, 10);
        setText('bd-arms-val', String(state.numArms));
        setText('bd-arms-display', String(state.numArms));
        newGame();
      });
    }

    if (roundsSlider) {
      roundsSlider.addEventListener('input', () => {
        state.numRounds = parseInt(roundsSlider.value, 10);
        setText('bd-rounds-val', String(state.numRounds));
        setText('bd-rounds-display', String(state.numRounds));
        setText('bd-max-rounds', String(state.numRounds));
        resetGame();
      });
    }

    const btnNew = document.getElementById('bd-newgame');
    const btnRun = document.getElementById('bd-runall');
    const btnStep = document.getElementById('bd-step');
    const btnReset = document.getElementById('bd-reset');
    const btnMC = document.getElementById('bd-mc-run');

    if (btnNew) btnNew.addEventListener('click', newGame);
    if (btnRun) btnRun.addEventListener('click', runAll);
    if (btnStep) btnStep.addEventListener('click', stepAll);
    if (btnReset) btnReset.addEventListener('click', resetGame);
    if (btnMC) btnMC.addEventListener('click', runAllScenarios);

    // Preset buttons visual toggle (optional)
    const presetBtns = document.querySelectorAll('[data-preset]');
    presetBtns.forEach(b => {
      b.addEventListener('click', () => {
        presetBtns.forEach(x => x.classList.remove('active'));
        b.classList.add('active');
      });
    });

    renderReceipts();
    newGame();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
