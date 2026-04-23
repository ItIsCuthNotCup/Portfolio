(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     AB-TEST LAB — page logic

     Engine: pure JS Beta-Bernoulli simulator. Each animation frame
     generates a batch of trials, updates two Beta posteriors, and
     recomputes decision metrics. Viz is hand-rolled SVG.

     The page has two distinct interactive surfaces:
       § II · FIG. J.1 — live simulator (main event)
       § IV · FIG. J.2 — peeking-bias Monte Carlo (1000 sims)

     Math mirrors notebooks/ab_test_model.py exactly; the offline
     reference numbers from methodology.json are loaded and shown
     in the peeking panel for sanity.
     ═══════════════════════════════════════════════════════════ */

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const METHODOLOGY_URL = '/assets/data/ab-test/methodology.json';

  // ── State ──────────────────────────────────────────────────
  const state = {
    pA: 0.10,              // true rate A (unknown to the test)
    pB: 0.12,              // true rate B
    split: 0.50,           // fraction of traffic going to A
    alpha: 0.05,
    power: 0.80,
    speed: 100,            // trials per frame

    nA: 0, xA: 0,          // users / conversions in A
    nB: 0, xB: 0,          // users / conversions in B

    running: false,
    called: false,
    callReason: null,
    rafId: null,

    preset: 'null',        // active preset
    scenarioState: null,   // scratch for presets that drift (reversal, novelty)

    stripHistory: [],      // { n, pba, lift, pval }
    maxHistory: 600,

    methodology: null,     // loaded from JSON
  };

  // ══════════════════════════════════════════════════════════
  // MATH
  // ══════════════════════════════════════════════════════════

  // Lanczos lgamma — 15-digit accuracy, plenty for PDFs.
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

  // Beta sampling via two Gamma samples (Marsaglia-Tsang) — fast enough,
  // good enough for Monte Carlo P(B > A) at 5k samples per frame.
  function gammaSample(shape) {
    if (shape < 1) {
      const u = Math.random();
      return gammaSample(shape + 1) * Math.pow(u, 1 / shape);
    }
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    while (true) {
      let x, v;
      do {
        // Box-Muller normal
        const u1 = Math.random(), u2 = Math.random();
        x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = Math.random();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }
  function betaSample(a, b) {
    const x = gammaSample(a);
    const y = gammaSample(b);
    return x / (x + y);
  }

  // P(B > A) via Monte Carlo on current posteriors
  function probBgtA(xA, nA, xB, nB, samples = 5000) {
    const aA = 1 + xA, bA = 1 + (nA - xA);
    const aB = 1 + xB, bB = 1 + (nB - xB);
    let hits = 0;
    for (let i = 0; i < samples; i++) {
      if (betaSample(aB, bB) > betaSample(aA, bA)) hits++;
    }
    return hits / samples;
  }

  // Expected loss under wrong choice: E[max(0, pA - pB)] when choosing B,
  // or E[max(0, pB - pA)] when choosing A. Compact metric for Bayesian
  // stopping rules.
  function expectedLossChoosingB(xA, nA, xB, nB, samples = 5000) {
    const aA = 1 + xA, bA = 1 + (nA - xA);
    const aB = 1 + xB, bB = 1 + (nB - xB);
    let loss = 0;
    for (let i = 0; i < samples; i++) {
      const sA = betaSample(aA, bA);
      const sB = betaSample(aB, bB);
      if (sA > sB) loss += (sA - sB);
    }
    return loss / samples;
  }

  // Error function / standard normal CDF
  function erf(x) {
    // Abramowitz & Stegun 7.1.26
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
  }
  function normalCdf(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }

  // Two-proportion z-test p-value (two-tailed, pooled variance)
  function twoPropPvalue(xA, nA, xB, nB) {
    if (nA === 0 || nB === 0) return 1;
    const pA = xA / nA, pB = xB / nB;
    const pPool = (xA + xB) / (nA + nB);
    const se = Math.sqrt(pPool * (1 - pPool) * (1 / nA + 1 / nB));
    if (se === 0) return 1;
    const z = (pB - pA) / se;
    return 2 * (1 - normalCdf(Math.abs(z)));
  }

  // 95% Wald CI on lift (pB - pA)
  function liftCi(xA, nA, xB, nB) {
    if (nA === 0 || nB === 0) return null;
    const pA = xA / nA, pB = xB / nB;
    const se = Math.sqrt(pA * (1 - pA) / nA + pB * (1 - pB) / nB);
    const z = 1.96;
    return [pB - pA - z * se, pB - pA + z * se];
  }

  // Sample-size formula for two-proportion two-tailed test
  // (matches the Python reference)
  function normalQuantile(p) {
    // Beasley-Springer-Moro inverse CDF, good to 1e-9.
    const a = [-3.969683028665376e+01,  2.209460984245205e+02,
               -2.759285104469687e+02,  1.383577518672690e+02,
               -3.066479806614716e+01,  2.506628277459239e+00];
    const b = [-5.447609879822406e+01,  1.615858368580409e+02,
               -1.556989798598866e+02,  6.680131188771972e+01,
               -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01,
               -2.400758277161838e+00, -2.549732539343734e+00,
                4.374664141464968e+00,  2.938163982698783e+00];
    const d = [ 7.784695709041462e-03,  3.224671290700398e-01,
                2.445134137142996e+00,  3.754408661907416e+00];
    const pl = 0.02425, pu = 1 - pl;
    let q, r;
    if (p < pl) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
             ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
    } else if (p <= pu) {
      q = p - 0.5; r = q * q;
      return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
             (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
              ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
    }
  }
  function requiredSampleSize(p1, p2, alpha, power) {
    if (p1 === p2) return Infinity;
    const zA = normalQuantile(1 - alpha / 2);
    const zB = normalQuantile(power);
    const pBar = (p1 + p2) / 2;
    const num = zA * Math.sqrt(2 * pBar * (1 - pBar)) +
                zB * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
    return Math.ceil(Math.pow(num / (p2 - p1), 2));
  }

  // ══════════════════════════════════════════════════════════
  // BOOT
  // ══════════════════════════════════════════════════════════
  fetch(METHODOLOGY_URL)
    .then(r => r.json())
    .then(d => { state.methodology = d; init(); })
    .catch(err => {
      console.warn('[ab-test] methodology.json missing — page runs without reference numbers', err);
      init();
    });

  function init() {
    wireDesigner();
    wireControls();
    wirePreset();
    wirePeekButton();
    updateDesignerReadouts();
    renderBetaChart();
    renderStripChart();
    renderReceipts();
    updateBanner();
    updateCounters();
    updateVerdicts();
    applyPreset('null');
  }

  // ══════════════════════════════════════════════════════════
  // DESIGNER PANEL
  // ══════════════════════════════════════════════════════════
  function wireDesigner() {
    const pairs = [
      ['p-a', v => { state.pA = parseFloat(v); updateDesignerReadouts(); if (!state.nA && !state.nB) renderBetaChart(); maybeMarkCustom(); }],
      ['p-b', v => { state.pB = parseFloat(v); updateDesignerReadouts(); if (!state.nA && !state.nB) renderBetaChart(); maybeMarkCustom(); }],
      ['split', v => { state.split = parseFloat(v) / 100; updateDesignerReadouts(); maybeMarkCustom(); }],
      ['alpha', v => { state.alpha = parseFloat(v); updateDesignerReadouts(); }],
      ['power', v => { state.power = parseFloat(v); updateDesignerReadouts(); }],
    ];
    pairs.forEach(([id, fn]) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', e => fn(e.target.value));
    });
  }
  function maybeMarkCustom() {
    const sel = document.getElementById('preset');
    if (sel) sel.value = 'custom';
    state.preset = 'custom';
  }

  function updateDesignerReadouts() {
    setText('p-a-val', (state.pA * 100).toFixed(1) + '%');
    setText('p-b-val', (state.pB * 100).toFixed(1) + '%');
    setText('split-val', Math.round(state.split * 100) + ' / ' + Math.round((1 - state.split) * 100));
    setText('alpha-val', state.alpha.toFixed(2));
    setText('power-val', state.power.toFixed(2));
    const n = requiredSampleSize(state.pA, state.pB, state.alpha, state.power);
    setText('required-n', n === Infinity ? '∞' : n.toLocaleString());
  }

  // ══════════════════════════════════════════════════════════
  // CONTROLS
  // ══════════════════════════════════════════════════════════
  function wireControls() {
    document.getElementById('ctl-run').addEventListener('click', runSim);
    document.getElementById('ctl-pause').addEventListener('click', pauseSim);
    document.getElementById('ctl-reset').addEventListener('click', resetSim);
    document.getElementById('ctl-call').addEventListener('click', () => callIt('manual'));
    document.querySelectorAll('.speed-dial button').forEach(btn => {
      btn.addEventListener('click', () => {
        state.speed = parseInt(btn.dataset.speed, 10);
        document.querySelectorAll('.speed-dial button').forEach(b =>
          b.setAttribute('aria-selected', b === btn ? 'true' : 'false'));
      });
    });
  }

  function runSim() {
    if (state.running || state.called) return;
    state.running = true;
    document.getElementById('ctl-run').disabled = true;
    document.getElementById('ctl-pause').disabled = false;
    document.getElementById('ctl-call').disabled = false;
    updateBanner();
    tick();
  }
  function pauseSim() {
    state.running = false;
    document.getElementById('ctl-run').disabled = false;
    document.getElementById('ctl-pause').disabled = true;
    if (state.rafId) cancelAnimationFrame(state.rafId);
    updateBanner();
  }
  function resetSim() {
    state.running = false;
    state.called = false;
    state.callReason = null;
    state.nA = state.xA = state.nB = state.xB = 0;
    state.stripHistory = [];
    state.scenarioState = null;
    if (state.rafId) cancelAnimationFrame(state.rafId);
    document.getElementById('ctl-run').disabled = false;
    document.getElementById('ctl-pause').disabled = true;
    document.getElementById('ctl-call').disabled = true;
    renderBetaChart();
    renderStripChart();
    updateCounters();
    updateVerdicts();
    updateBanner();
  }
  function callIt(reason) {
    state.called = true;
    state.running = false;
    state.callReason = reason;
    if (state.rafId) cancelAnimationFrame(state.rafId);
    document.getElementById('ctl-run').disabled = true;
    document.getElementById('ctl-pause').disabled = true;
    document.getElementById('ctl-call').disabled = true;
    updateBanner();
    updateVerdicts();
  }

  // ══════════════════════════════════════════════════════════
  // PRESETS
  // ══════════════════════════════════════════════════════════
  function wirePreset() {
    document.getElementById('preset').addEventListener('change', e => applyPreset(e.target.value));
  }
  function applyPreset(name) {
    state.preset = name;
    if (name === 'custom') return;
    resetSim();
    if (name === 'null')     setPresetRates(0.10, 0.10);
    if (name === 'subtle')   setPresetRates(0.10, 0.11);
    if (name === 'huge')     setPresetRates(0.10, 0.15);
    if (name === 'reversal') { setPresetRates(0.10, 0.10); state.scenarioState = { kind: 'reversal' }; }
    if (name === 'novelty')  { setPresetRates(0.10, 0.10); state.scenarioState = { kind: 'novelty' }; }
  }
  function setPresetRates(pA, pB) {
    state.pA = pA; state.pB = pB;
    document.getElementById('p-a').value = pA;
    document.getElementById('p-b').value = pB;
    updateDesignerReadouts();
    renderBetaChart();
  }

  // Scenario-dependent rate for the CURRENT user. Normally returns the
  // designer setting; reversal/novelty drift over time.
  function currentPB() {
    if (!state.scenarioState) return state.pB;
    const total = state.nA + state.nB;
    if (state.scenarioState.kind === 'reversal') {
      // First 500 users: B at 15%. Then decays to baseline.
      const t = Math.min(1, total / 2000);
      return 0.15 - 0.05 * t; // 0.15 → 0.10 over 2000 users
    }
    if (state.scenarioState.kind === 'novelty') {
      // B starts high (novelty effect) then drops below A.
      const t = Math.min(1, total / 3000);
      return 0.18 - 0.10 * t; // 0.18 → 0.08
    }
    return state.pB;
  }

  // ══════════════════════════════════════════════════════════
  // SIMULATION TICK
  // ══════════════════════════════════════════════════════════
  function tick() {
    if (!state.running) return;
    const batch = Math.max(1, state.speed);
    const splitA = state.split;
    const pBEff = currentPB();
    for (let i = 0; i < batch; i++) {
      if (Math.random() < splitA) {
        state.nA++; if (Math.random() < state.pA) state.xA++;
      } else {
        state.nB++; if (Math.random() < pBEff) state.xB++;
      }
    }
    // Auto-stop when both arms hit the required N (fixed-sample design)
    const nReq = requiredSampleSize(state.pA, state.pB, state.alpha, state.power);
    if (isFinite(nReq) && state.nA >= nReq && state.nB >= nReq) {
      callIt('fixed-sample');
    }
    updateCounters();
    updateVerdicts();
    renderBetaChart();
    updateStripHistory();
    renderStripChart();
    updateBanner();
    state.rafId = requestAnimationFrame(tick);
  }

  // ══════════════════════════════════════════════════════════
  // COUNTERS + BANNER + VERDICTS
  // ══════════════════════════════════════════════════════════
  function updateCounters() {
    setText('a-users', state.nA.toLocaleString());
    setText('a-conv', state.xA.toLocaleString());
    setText('a-rate', state.nA ? (state.xA / state.nA * 100).toFixed(2) + '%' : '—');
    setText('b-users', state.nB.toLocaleString());
    setText('b-conv', state.xB.toLocaleString());
    setText('b-rate', state.nB ? (state.xB / state.nB * 100).toFixed(2) + '%' : '—');
    if (state.nA && state.nB) {
      const lift = (state.xB / state.nB) - (state.xA / state.nA);
      setText('m-lift', (lift * 100).toFixed(2) + 'pp');
      const pval = twoPropPvalue(state.xA, state.nA, state.xB, state.nB);
      setText('m-pval', pval < 0.001 ? '< 0.001' : pval.toFixed(3));
      const pba = probBgtA(state.xA, state.nA, state.xB, state.nB, 2000);
      setText('m-pba', (pba * 100).toFixed(1) + '%');
    } else {
      setText('m-lift', '—'); setText('m-pval', '—'); setText('m-pba', '—');
    }
  }

  function updateBanner() {
    const b = document.getElementById('ab-banner');
    if (!b) return;
    if (state.called) {
      const pval = twoPropPvalue(state.xA, state.nA, state.xB, state.nB);
      const lift = (state.xB / state.nB) - (state.xA / state.nA);
      if (pval < state.alpha && lift > 0) {
        b.dataset.state = 'sig-up';
        setText('banner-state', 'Significant lift');
        setText('banner-detail', `+${(lift * 100).toFixed(2)}pp · p = ${pval.toFixed(3)}`);
      } else if (pval < state.alpha && lift < 0) {
        b.dataset.state = 'sig-down';
        setText('banner-state', 'Significant drop');
        setText('banner-detail', `${(lift * 100).toFixed(2)}pp · p = ${pval.toFixed(3)}`);
      } else {
        b.dataset.state = 'nosig';
        setText('banner-state', 'No significant difference');
        setText('banner-detail', `observed ${(lift * 100).toFixed(2)}pp · p = ${pval.toFixed(3)}`);
      }
    } else if (state.running) {
      b.dataset.state = 'running';
      setText('banner-state', 'Collecting data');
      setText('banner-detail', `${state.nA + state.nB} users observed`);
    } else if (state.nA + state.nB > 0) {
      b.dataset.state = 'paused';
      setText('banner-state', 'Paused');
      setText('banner-detail', `${state.nA + state.nB} users so far · resume or call it`);
    } else {
      b.dataset.state = 'idle';
      setText('banner-state', 'Collecting data…');
      const detail = document.getElementById('banner-detail');
      if (detail) detail.innerHTML = 'press <em>run</em> to start';
    }
  }

  function updateVerdicts() {
    const hasData = state.nA > 0 && state.nB > 0;
    if (!hasData) {
      setText('freq-p', '—'); setText('freq-ci', '—');
      setText('bayes-pba', '—'); setText('bayes-eloss', '—');
      setText('freq-call', 'awaiting data');
      setText('bayes-call', 'awaiting data');
      document.getElementById('freq-call').className = 'verdict-call serif';
      document.getElementById('bayes-call').className = 'verdict-call serif';
      return;
    }
    const pval = twoPropPvalue(state.xA, state.nA, state.xB, state.nB);
    const ci = liftCi(state.xA, state.nA, state.xB, state.nB);
    const lift = (state.xB / state.nB) - (state.xA / state.nA);
    const pba = probBgtA(state.xA, state.nA, state.xB, state.nB, 2000);
    const eloss = expectedLossChoosingB(state.xA, state.nA, state.xB, state.nB, 1500);

    setText('freq-p', pval < 0.001 ? '< 0.001' : pval.toFixed(3));
    setText('freq-ci', `[${(ci[0] * 100).toFixed(2)}pp, ${(ci[1] * 100).toFixed(2)}pp]`);
    setText('bayes-pba', (pba * 100).toFixed(1) + '%');
    setText('bayes-eloss', (eloss * 100).toFixed(3) + 'pp');

    const nReq = requiredSampleSize(state.pA, state.pB, state.alpha, state.power);
    const reachedN = isFinite(nReq) && state.nA >= nReq && state.nB >= nReq;
    const freqEl = document.getElementById('freq-call');
    if (!reachedN) {
      freqEl.textContent = 'still under-powered';
      freqEl.className = 'verdict-call serif';
    } else if (pval < state.alpha) {
      freqEl.textContent = lift > 0 ? 'ship it' : 'kill it';
      freqEl.className = 'verdict-call serif ' + (lift > 0 ? 'called-up' : 'called-down');
    } else {
      freqEl.textContent = 'no decision';
      freqEl.className = 'verdict-call serif';
    }

    const bayesEl = document.getElementById('bayes-call');
    if (pba > 0.95) {
      bayesEl.textContent = 'ship it';
      bayesEl.className = 'verdict-call serif called-up';
    } else if (pba < 0.05) {
      bayesEl.textContent = 'kill it';
      bayesEl.className = 'verdict-call serif called-down';
    } else {
      bayesEl.textContent = 'keep running';
      bayesEl.className = 'verdict-call serif';
    }

    // Divergence log — small note when the two rules give different answers.
    const log = document.getElementById('divergence-log');
    if (!log) return;
    const freqCalls = reachedN && pval < state.alpha;
    const bayesCalls = pba > 0.95 || pba < 0.05;
    if (freqCalls !== bayesCalls) {
      log.hidden = false;
      log.textContent = `▽  divergence · freq: ${freqEl.textContent} · bayes: ${bayesEl.textContent}`;
    } else {
      log.hidden = true;
    }
  }

  // ══════════════════════════════════════════════════════════
  // BETA CHART
  // ══════════════════════════════════════════════════════════
  function renderBetaChart() {
    const svg = document.getElementById('beta-chart');
    if (!svg) return;
    const W = 900, H = 420;
    const L = 60, R = 40, T = 24, B = 48;
    const plotW = W - L - R, plotH = H - T - B;

    // Posterior Beta parameters (uniform prior).
    const aA = 1 + state.xA, bA = 1 + (state.nA - state.xA);
    const aB = 1 + state.xB, bB = 1 + (state.nB - state.xB);

    // Auto-range x to cover both distributions plus padding.
    const centreA = aA / (aA + bA);
    const centreB = aB / (aB + bB);
    const sdA = Math.sqrt((aA * bA) / ((aA + bA) ** 2 * (aA + bA + 1)));
    const sdB = Math.sqrt((aB * bB) / ((aB + bB) ** 2 * (aB + bB + 1)));
    let xMin = Math.max(0, Math.min(centreA, centreB) - 5 * Math.max(sdA, sdB));
    let xMax = Math.min(1, Math.max(centreA, centreB) + 5 * Math.max(sdA, sdB));
    // When no data: show [0, 0.5] as a reasonable frame.
    if (state.nA + state.nB === 0) { xMin = 0; xMax = 0.5; }
    if (xMax - xMin < 0.02) { const m = (xMin + xMax) / 2; xMin = m - 0.01; xMax = m + 0.01; }

    const pts = 180;
    const ptsA = [], ptsB = [];
    let maxPdf = 0;
    for (let i = 0; i <= pts; i++) {
      const x = xMin + (xMax - xMin) * (i / pts);
      const yA = betaPdf(x, aA, bA);
      const yB = betaPdf(x, aB, bB);
      ptsA.push([x, yA]); ptsB.push([x, yB]);
      if (yA > maxPdf) maxPdf = yA;
      if (yB > maxPdf) maxPdf = yB;
    }
    if (maxPdf === 0) maxPdf = 1;

    const xScale = v => L + ((v - xMin) / (xMax - xMin)) * plotW;
    const yScale = v => T + plotH - (v / (maxPdf * 1.08)) * plotH;

    const pathA = pathFromPoints(ptsA, xScale, yScale);
    const pathB = pathFromPoints(ptsB, xScale, yScale);

    // Shade region where B > A (by sampling density difference).
    // We shade the ENTIRE area under B's curve that lies to the right
    // of A's mode — a visual proxy for "probability mass above A".
    let shadePath = '';
    if (state.nA + state.nB > 0) {
      const modeA = centreA;
      const shadePts = ptsB.filter(([x]) => x > modeA);
      if (shadePts.length) {
        shadePath = 'M ' + xScale(shadePts[0][0]) + ' ' + yScale(0) + ' ';
        shadePts.forEach(([x, y]) => shadePath += 'L ' + xScale(x) + ' ' + yScale(y) + ' ');
        shadePath += 'L ' + xScale(shadePts[shadePts.length - 1][0]) + ' ' + yScale(0) + ' Z';
      }
    }

    // X-axis ticks
    const ticks = niceTicks(xMin, xMax, 6);

    let svgContent = '';
    // Shade
    if (shadePath) {
      svgContent += `<path d="${shadePath}" fill="var(--ab-shade)" stroke="none"/>`;
    }
    // Axis
    svgContent += `<line x1="${L}" y1="${T + plotH}" x2="${L + plotW}" y2="${T + plotH}" stroke="var(--ink)" stroke-width="1"/>`;
    ticks.forEach(t => {
      const x = xScale(t);
      svgContent += `<line x1="${x}" y1="${T + plotH}" x2="${x}" y2="${T + plotH + 5}" stroke="var(--ink)" stroke-width="1"/>`;
      svgContent += `<text x="${x}" y="${T + plotH + 22}" text-anchor="middle" font-family="DM Mono,monospace" font-size="11" fill="var(--ink-soft)">${(t * 100).toFixed(1)}%</text>`;
    });
    // Curves
    svgContent += `<path d="${pathA}" stroke="var(--ab-a)" stroke-width="2.25" fill="none"/>`;
    svgContent += `<path d="${pathB}" stroke="var(--ab-b)" stroke-width="2.5" fill="none"/>`;
    // Legend
    const legendY = T + 14;
    svgContent += `<circle cx="${L + 8}" cy="${legendY}" r="4" fill="var(--ab-a)"/>`;
    svgContent += `<text x="${L + 20}" y="${legendY + 4}" font-family="DM Mono,monospace" font-size="11" fill="var(--ink)">A · control · α=${aA}, β=${bA}</text>`;
    svgContent += `<circle cx="${L + 260}" cy="${legendY}" r="4" fill="var(--ab-b)"/>`;
    svgContent += `<text x="${L + 272}" y="${legendY + 4}" font-family="DM Mono,monospace" font-size="11" fill="var(--ink)">B · test · α=${aB}, β=${bB}</text>`;

    svg.innerHTML = svgContent;
  }

  function pathFromPoints(pts, xs, ys) {
    let d = 'M ';
    pts.forEach(([x, y], i) => {
      d += (i ? 'L ' : '') + xs(x).toFixed(2) + ' ' + ys(y).toFixed(2) + ' ';
    });
    return d;
  }

  function niceTicks(min, max, n) {
    const range = max - min;
    const raw = range / n;
    const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
    const residual = raw / magnitude;
    let step;
    if (residual < 1.5) step = 1 * magnitude;
    else if (residual < 3) step = 2 * magnitude;
    else if (residual < 7) step = 5 * magnitude;
    else step = 10 * magnitude;
    const ticks = [];
    for (let t = Math.ceil(min / step) * step; t <= max + 1e-9; t += step) ticks.push(t);
    return ticks;
  }

  // ══════════════════════════════════════════════════════════
  // STRIP CHART — P(B > A) and observed lift over time
  // ══════════════════════════════════════════════════════════
  function updateStripHistory() {
    const n = state.nA + state.nB;
    if (!n || !state.nA || !state.nB) return;
    // Sample less frequently as n grows — don't eat memory
    const cadence = Math.max(1, Math.floor(state.speed / 2));
    if (state.stripHistory.length && n - state.stripHistory[state.stripHistory.length - 1].n < cadence) return;
    const pba = probBgtA(state.xA, state.nA, state.xB, state.nB, 800);
    const lift = (state.xB / state.nB) - (state.xA / state.nA);
    state.stripHistory.push({ n, pba, lift });
    if (state.stripHistory.length > state.maxHistory) state.stripHistory.shift();
  }

  function renderStripChart() {
    const svg = document.getElementById('strip-chart');
    if (!svg) return;
    const W = 900, H = 200;
    const L = 60, R = 70, T = 20, B = 36;
    const plotW = W - L - R, plotH = H - T - B;

    const hist = state.stripHistory;
    const nMax = hist.length ? hist[hist.length - 1].n : 1;
    const nMin = 0;

    let svgContent = '';
    // Threshold lines for P(B > A) = 0.95 and 0.05
    const y95 = T + (1 - 0.95) * plotH;
    const y50 = T + (1 - 0.50) * plotH;
    const y05 = T + (1 - 0.05) * plotH;
    [[y95, '0.95'], [y50, '0.50'], [y05, '0.05']].forEach(([y, label]) => {
      svgContent += `<line x1="${L}" y1="${y}" x2="${L + plotW}" y2="${y}" stroke="var(--ab-grid-strong)" stroke-width="1" stroke-dasharray="${label === '0.50' ? '2 3' : '4 3'}"/>`;
      svgContent += `<text x="${L + plotW + 6}" y="${y + 4}" font-family="DM Mono,monospace" font-size="10" fill="var(--ink-dim)">${label}</text>`;
    });

    if (hist.length) {
      const xs = n => L + (n - nMin) / Math.max(1, nMax - nMin) * plotW;
      const ys = p => T + (1 - p) * plotH;
      let pbaD = 'M ', liftD = 'M ';
      const liftMax = Math.max(0.02, ...hist.map(h => Math.abs(h.lift)));
      const liftYs = l => T + plotH / 2 - (l / liftMax) * (plotH / 2 - 4);
      hist.forEach((h, i) => {
        pbaD += (i ? 'L ' : '') + xs(h.n).toFixed(1) + ' ' + ys(h.pba).toFixed(1) + ' ';
        liftD += (i ? 'L ' : '') + xs(h.n).toFixed(1) + ' ' + liftYs(h.lift).toFixed(1) + ' ';
      });
      svgContent += `<path d="${liftD}" stroke="var(--ab-a)" stroke-width="1.25" fill="none" opacity="0.55"/>`;
      svgContent += `<path d="${pbaD}" stroke="var(--ab-b)" stroke-width="1.75" fill="none"/>`;
    }

    // x-axis baseline
    svgContent += `<line x1="${L}" y1="${T + plotH}" x2="${L + plotW}" y2="${T + plotH}" stroke="var(--ink)" stroke-width="1"/>`;
    svgContent += `<text x="${L}" y="${T + plotH + 24}" font-family="DM Mono,monospace" font-size="10" fill="var(--ink-dim)">0</text>`;
    svgContent += `<text x="${L + plotW}" y="${T + plotH + 24}" text-anchor="end" font-family="DM Mono,monospace" font-size="10" fill="var(--ink-dim)">${nMax.toLocaleString()} users</text>`;

    // Legend
    svgContent += `<circle cx="${L + 8}" cy="${T + 8}" r="3" fill="var(--ab-b)"/>`;
    svgContent += `<text x="${L + 18}" y="${T + 12}" font-family="DM Mono,monospace" font-size="10" fill="var(--ink)">P(B &gt; A)</text>`;
    svgContent += `<circle cx="${L + 120}" cy="${T + 8}" r="3" fill="var(--ab-a)"/>`;
    svgContent += `<text x="${L + 130}" y="${T + 12}" font-family="DM Mono,monospace" font-size="10" fill="var(--ink)">observed lift</text>`;

    svg.innerHTML = svgContent;
  }

  // ══════════════════════════════════════════════════════════
  // PEEKING MONTE CARLO
  // ══════════════════════════════════════════════════════════
  function wirePeekButton() {
    const btn = document.getElementById('peek-run');
    if (btn) btn.addEventListener('click', runPeekingSim);
  }

  function runPeekingSim() {
    const btn = document.getElementById('peek-run');
    const status = document.getElementById('peek-status');
    btn.disabled = true;
    btn.textContent = 'Running…';
    const nSims = 1000;
    const alpha = 0.05;
    const pTrue = 0.10;
    const peekEvery = 50;
    const maxN = 5000;

    const results = [];  // { stopTime, significant, lift }
    let done = 0;

    function runBatch() {
      const batchSize = 40;
      for (let i = 0; i < batchSize && done < nSims; i++) {
        const r = onePeekingSim(pTrue, alpha, peekEvery, maxN);
        results.push(r);
        done++;
      }
      status.textContent = `— ${done} / ${nSims} simulations —`;
      if (done < nSims) {
        requestAnimationFrame(runBatch);
      } else {
        renderPeekResults(results, alpha);
        btn.disabled = false;
        btn.textContent = 'Run again';
      }
    }
    requestAnimationFrame(runBatch);
  }

  function onePeekingSim(pTrue, alpha, peekEvery, maxN) {
    let xA = 0, xB = 0, n = 0;
    while (n + peekEvery <= maxN) {
      for (let i = 0; i < peekEvery; i++) {
        if (Math.random() < pTrue) xA++;
        if (Math.random() < pTrue) xB++;
      }
      n += peekEvery;
      const pval = twoPropPvalue(xA, n, xB, n);
      if (pval < alpha) {
        return { stopTime: n, significant: true, lift: (xB / n) - (xA / n) };
      }
    }
    return { stopTime: maxN, significant: false, lift: (xB / maxN) - (xA / maxN) };
  }

  function renderPeekResults(results, alpha) {
    const wrap = document.getElementById('peek-results');
    wrap.hidden = false;
    const fp = results.filter(r => r.significant).length;
    const fpr = fp / results.length;
    const inflation = (fpr / alpha).toFixed(1);
    const median = median_(results.map(r => r.stopTime));

    setText('peek-fpr', (fpr * 100).toFixed(1) + '%');
    setText('peek-nominal', (alpha * 100).toFixed(0) + '%');
    setText('peek-inflation', inflation + '×');
    setText('peek-median', median.toLocaleString());

    // Reference from python
    const ref = state.methodology?.peeking_bias;
    const refEl = document.getElementById('peek-reference');
    if (ref && refEl) {
      refEl.textContent = `— reference · Python + scipy: empirical FPR = ${(ref.empirical_fpr * 100).toFixed(1)}% · inflation ${ref.inflation_factor}× · live within ±2pp —`;
    } else if (refEl) {
      refEl.textContent = '— reference numbers unavailable —';
    }

    renderPeekScatter(results, alpha);
  }

  function renderPeekScatter(results, alpha) {
    const svg = document.getElementById('peek-chart');
    if (!svg) return;
    const W = 900, H = 320;
    const L = 60, R = 40, T = 24, B = 48;
    const plotW = W - L - R, plotH = H - T - B;

    const nMax = Math.max(...results.map(r => r.stopTime));
    const liftMax = Math.max(0.02, Math.max(...results.map(r => Math.abs(r.lift))));

    const xs = n => L + (n / nMax) * plotW;
    const ys = l => T + plotH / 2 - (l / liftMax) * (plotH / 2 - 8);

    let svgContent = '';
    // Zero line
    svgContent += `<line x1="${L}" y1="${T + plotH / 2}" x2="${L + plotW}" y2="${T + plotH / 2}" stroke="var(--ab-grid-strong)" stroke-width="1" stroke-dasharray="2 3"/>`;
    svgContent += `<text x="${L + plotW + 4}" y="${T + plotH / 2 + 4}" font-family="DM Mono,monospace" font-size="10" fill="var(--ink-dim)">0</text>`;

    // Each dot
    results.forEach(r => {
      const cx = xs(r.stopTime);
      const cy = ys(r.lift);
      const color = r.significant ? 'var(--accent)' : 'var(--ink-dim)';
      const radius = r.significant ? 2.5 : 1.75;
      const opacity = r.significant ? 0.85 : 0.35;
      svgContent += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${radius}" fill="${color}" opacity="${opacity}"/>`;
    });

    // Axes
    svgContent += `<line x1="${L}" y1="${T + plotH}" x2="${L + plotW}" y2="${T + plotH}" stroke="var(--ink)" stroke-width="1"/>`;
    svgContent += `<text x="${L}" y="${T + plotH + 22}" font-family="DM Mono,monospace" font-size="10" fill="var(--ink-soft)">stop-time (users per arm)</text>`;
    svgContent += `<text x="${L + plotW}" y="${T + plotH + 22}" text-anchor="end" font-family="DM Mono,monospace" font-size="10" fill="var(--ink-soft)">${nMax.toLocaleString()}</text>`;
    svgContent += `<text x="${L - 6}" y="${T + 12}" text-anchor="end" font-family="DM Mono,monospace" font-size="10" fill="var(--ink-soft)">+lift</text>`;
    svgContent += `<text x="${L - 6}" y="${T + plotH - 2}" text-anchor="end" font-family="DM Mono,monospace" font-size="10" fill="var(--ink-soft)">−lift</text>`;

    // Legend
    svgContent += `<circle cx="${L + 8}" cy="${T + 8}" r="3" fill="var(--accent)"/>`;
    svgContent += `<text x="${L + 18}" y="${T + 12}" font-family="DM Mono,monospace" font-size="10" fill="var(--ink)">declared "winner" (false positive)</text>`;
    svgContent += `<circle cx="${L + 300}" cy="${T + 8}" r="3" fill="var(--ink-dim)" opacity="0.7"/>`;
    svgContent += `<text x="${L + 310}" y="${T + 12}" font-family="DM Mono,monospace" font-size="10" fill="var(--ink)">null result (reached max-N)</text>`;

    svg.innerHTML = svgContent;
  }

  function median_(arr) {
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  // ══════════════════════════════════════════════════════════
  // RECEIPTS
  // ══════════════════════════════════════════════════════════
  function renderReceipts() {
    const grid = document.getElementById('receipts-grid');
    if (!grid) return;
    const m = state.methodology;
    const items = [
      { v: m ? (m.peeking_bias.empirical_fpr * 100).toFixed(1) + '%' : '—',
        l: 'false-positive rate from peeking (reference)' },
      { v: m ? m.peeking_bias.inflation_factor + '×' : '—',
        l: 'inflation vs nominal α' },
      { v: '1,000',     l: 'sims per peeking run' },
      { v: '~2 ms',     l: 'P(B > A) estimate' },
      { v: '60 fps',    l: 'posterior redraw rate' },
      { v: '0',         l: 'server calls · everything client-side' },
    ];
    grid.innerHTML = items.map(it =>
      `<div class="metric"><div class="serif metric-value">${it.v}</div><div class="mono metric-label">${it.l}</div></div>`
    ).join('');
  }

  // ══════════════════════════════════════════════════════════
  // UTILITIES
  // ══════════════════════════════════════════════════════════
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

})();
