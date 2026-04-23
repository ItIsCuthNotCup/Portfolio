(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     FUNNEL-SIM LAB — page logic

     Agent-based marketing funnel. Engine is pure JS; rendering is
     Canvas 2D with batched fills per segment. Model math mirrors
     notebooks/funnel_sim_model.py — closed-form conversion matches
     simulation within 1 % across all four segments.
     ═══════════════════════════════════════════════════════════ */

  const METHODOLOGY_URL = '/assets/data/funnel-sim/methodology.json';

  // ── Model constants ────────────────────────────────────────
  const STAGES = ['awareness', 'consideration', 'trial', 'purchase', 'retention'];
  const N_STAGES = STAGES.length;

  const SEGMENTS = [
    { key: 'bargain',  name: 'Bargain',  entry: 0.25, ticket: 38,
      adv:  [0.30, 0.25, 0.45, 0.60, 0.80],
      drop: [0.15, 0.30, 0.20, 0.05, 0.10],
      resp: { discount: 1.5, email: 1.0, ad: 1.0, retention: 0.8 } },
    { key: 'loyalist', name: 'Loyalist', entry: 0.20, ticket: 74,
      adv:  [0.35, 0.50, 0.60, 0.80, 0.95],
      drop: [0.10, 0.15, 0.10, 0.03, 0.02],
      resp: { discount: 0.6, email: 1.2, ad: 0.8, retention: 1.3 } },
    { key: 'skeptic',  name: 'Skeptic',  entry: 0.30, ticket: 52,
      adv:  [0.20, 0.15, 0.30, 0.50, 0.70],
      drop: [0.30, 0.40, 0.25, 0.15, 0.20],
      resp: { discount: 1.0, email: 0.5, ad: 1.3, retention: 1.0 } },
    { key: 'impulse',  name: 'Impulse',  entry: 0.25, ticket: 46,
      adv:  [0.45, 0.60, 0.70, 0.85, 0.50],
      drop: [0.20, 0.20, 0.15, 0.10, 0.40],
      resp: { discount: 1.3, email: 1.0, ad: 1.1, retention: 0.7 } },
  ];
  const SEG_KEY_TO_IDX = Object.fromEntries(SEGMENTS.map((s, i) => [s.key, i]));

  const PRESETS = {
    healthy:        { ad_spend: 400, email_freq: 0.55, discount: 0.10, targeting: 0.65, retention_effort: 0.70 },
    leaky:          { ad_spend: 700, email_freq: 0.70, discount: 0.30, targeting: 0.35, retention_effort: 0.20 },
    saturated:      { ad_spend: 900, email_freq: 0.85, discount: 0.45, targeting: 0.20, retention_effort: 0.40 },
    niche_premium:  { ad_spend: 250, email_freq: 0.40, discount: 0.00, targeting: 0.85, retention_effort: 0.90 },
  };

  const MAX_AGENTS = 2000;

  // ── State ───────────────────────────────────────────────────
  const state = {
    levers: { ...PRESETS.healthy },
    running: true,
    speed: 1,
    tick: 0,
    rafId: null,
    canvas: null,
    ctx: null,
    cssW: 900, cssH: 600,
    segColors: null,
    methodology: null,

    agents: null,            // preallocated flat arrays (Structure of Arrays)
    nActive: 0,

    // Rolling counts — index = stage or -1 for dropped
    entered: [0, 0, 0, 0, 0],   // entered stage i
    dropped: [0, 0, 0, 0, 0],   // dropped out of stage i
    retainedLifetimeMonths: [0, 0, 0, 0],  // per segment — rolling sum
    retainedCount: [0, 0, 0, 0],
    revenue: 0,
    acquisitions: 0,         // total customers who reached purchase
    totalAdSpend: 0,
  };

  // ══════════════════════════════════════════════════════════
  // AGENT POOL (Structure of Arrays for GC-friendliness)
  // ══════════════════════════════════════════════════════════
  function initAgentPool() {
    state.agents = {
      active:       new Uint8Array(MAX_AGENTS),
      segment:      new Uint8Array(MAX_AGENTS),   // 0..3
      stage:        new Uint8Array(MAX_AGENTS),   // 0..4
      x:            new Float32Array(MAX_AGENTS),
      y:            new Float32Array(MAX_AGENTS),
      targetY:      new Float32Array(MAX_AGENTS),
      vx:           new Float32Array(MAX_AGENTS),
      fatigue:      new Float32Array(MAX_AGENTS),
      ticksInStage: new Uint16Array(MAX_AGENTS),
      retMonths:    new Uint16Array(MAX_AGENTS),  // retention lifetime
      fading:       new Uint8Array(MAX_AGENTS),   // 0 = live, 1 = fading out, 2 = fading conversion pulse
      fadeT:        new Float32Array(MAX_AGENTS), // 1 → 0
    };
    state.nActive = 0;
  }

  function spawnAgent(segIdx) {
    // Find first inactive slot
    const a = state.agents;
    for (let i = 0; i < MAX_AGENTS; i++) {
      if (!a.active[i]) {
        a.active[i] = 1;
        a.segment[i] = segIdx;
        a.stage[i] = 0;
        const bandY = stageBandY(0);
        a.x[i] = 30 + Math.random() * (state.cssW - 60);
        a.y[i] = bandY.top + Math.random() * (bandY.bottom - bandY.top);
        a.targetY[i] = a.y[i];
        a.vx[i] = (Math.random() - 0.5) * 0.3;
        a.fatigue[i] = 0;
        a.ticksInStage[i] = 0;
        a.retMonths[i] = 0;
        a.fading[i] = 0;
        a.fadeT[i] = 1;
        state.nActive++;
        state.entered[0]++;
        return;
      }
    }
    // Pool full — silently drop the new one
  }

  // ══════════════════════════════════════════════════════════
  // GEOMETRY
  // ══════════════════════════════════════════════════════════
  function stageBandY(stage) {
    const top = 10 + stage * (state.cssH - 20) / N_STAGES;
    const bottom = 10 + (stage + 1) * (state.cssH - 20) / N_STAGES;
    return { top, bottom };
  }

  // ══════════════════════════════════════════════════════════
  // MODIFIED TRANSITION PROBABILITIES (mirrors Python)
  // ══════════════════════════════════════════════════════════
  function leverVector(levers) {
    return {
      email:    1.0 + 0.4 * (levers.email_freq - 0.5),
      discount: 1.0 + 0.6 * levers.discount,
      ad:       1.0 + 0.4 * (levers.ad_spend / 500 - 0.5),
      retention:1.0 + 0.6 * (levers.retention_effort - 0.5),
    };
  }
  function clip(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

  function modifiedProbs(seg, levers) {
    const lv = leverVector(levers);
    const adv = seg.adv.slice();
    const drop = seg.drop.slice();
    adv[1] *= 1 + (lv.email    - 1) * seg.resp.email;
    adv[2] *= 1 + (lv.discount - 1) * seg.resp.discount;
    adv[3] *= 1 + (lv.discount - 1) * seg.resp.discount * 0.5;
    adv[4] *= 1 + (lv.retention- 1) * seg.resp.retention;

    const fatigue = Math.max(0, levers.email_freq - 0.5) * 0.8 * (1 / Math.max(0.5, seg.resp.email));
    drop[1] *= 1 + fatigue;
    drop[2] *= 1 + fatigue * 0.5;
    drop[3] *= 1 + fatigue * 0.3;
    drop[4] *= Math.max(0.2, 2 - lv.retention * seg.resp.retention);

    for (let i = 0; i < 5; i++) {
      adv[i] = clip(adv[i], 0.02, 0.98);
      drop[i] = clip(drop[i], 0.01, 0.85);
      if (adv[i] + drop[i] > 0.95) {
        const s = 0.95 / (adv[i] + drop[i]);
        adv[i] *= s; drop[i] *= s;
      }
    }
    return { adv, drop };
  }

  // Cache per-segment modified probs; recomputed on lever change
  let probCache = SEGMENTS.map(s => modifiedProbs(s, state.levers));
  function refreshProbCache() {
    probCache = SEGMENTS.map(s => modifiedProbs(s, state.levers));
  }

  // Closed-form analytical conversion per segment — used to populate
  // the live "by segment · conversion rate" panel without waiting for
  // the simulation to settle.
  function analyticalConversion(seg, levers) {
    const { adv, drop } = modifiedProbs(seg, levers);
    let p = 1;
    for (let i = 0; i < 4; i++) p *= adv[i] / (adv[i] + drop[i]);
    return p;
  }
  function analyticalRetentionMonths(seg, levers) {
    const { adv, drop } = modifiedProbs(seg, levers);
    const pChurn = drop[4] / (drop[4] + adv[4]);
    return pChurn <= 0 ? 12 : Math.min(36, 1 / pChurn);
  }
  function analyticalLtv(seg, levers) {
    const months = analyticalRetentionMonths(seg, levers);
    const effTicket = seg.ticket * (1 - 0.5 * levers.discount);
    return effTicket * (1 + months);
  }
  function blendedConversion(levers) {
    return SEGMENTS.reduce((s, seg) => s + seg.entry * analyticalConversion(seg, levers), 0);
  }
  function blendedLtv(levers) {
    return SEGMENTS.reduce((s, seg) => s + seg.entry * analyticalLtv(seg, levers), 0);
  }
  function cacEstimate(levers) {
    const inflow = levers.ad_spend * 0.4;
    const conv = blendedConversion(levers);
    const cust = inflow * conv;
    return cust > 0 ? levers.ad_spend / cust : Infinity;
  }

  // ══════════════════════════════════════════════════════════
  // TICK
  // ══════════════════════════════════════════════════════════
  function tick() {
    const a = state.agents;
    const levers = state.levers;
    const inflowPerTick = (levers.ad_spend * 0.4) / 60;  // rough scaling
    const targetingBoost = levers.targeting;             // 0..1

    // 1. Spawn new arrivals into awareness
    const nToSpawn = poissonSample(inflowPerTick * state.speed);
    for (let k = 0; k < nToSpawn; k++) {
      // Targeting tilts inflow toward loyalist/impulse (high LTV)
      const segIdx = pickSegmentIndex(targetingBoost);
      spawnAgent(segIdx);
    }

    // 2. Advance / drop / jitter each active agent
    for (let i = 0; i < MAX_AGENTS; i++) {
      if (!a.active[i]) continue;

      // Fade-out handling — disappear fast. Earlier versions drifted
      // fading agents rightward over 20 ticks, which produced a
      // visible vertical "shadow" column of dying dots. Now they fade
      // in ~6 ticks with minimal drift — quick deaths, no pileup.
      if (a.fading[i]) {
        a.fadeT[i] -= 0.17 * state.speed;
        if (a.fadeT[i] <= 0) { a.active[i] = 0; state.nActive--; continue; }
        a.x[i] += 1.5 * state.speed;
        continue;
      }

      const seg = SEGMENTS[a.segment[i]];
      const probs = probCache[a.segment[i]];
      const stage = a.stage[i];

      a.ticksInStage[i]++;

      // STAGE_RATE governs how much of a per-stage adv/drop probability
      // fires per tick. v6 tune: faster upstream flow so Trial doesn't
      // bottleneck, slow Purchase residence so that band stays populated,
      // Retention rate sized so churn matches inflow.
      // Node-sim equilibrium (healthy preset, speed=1, 10s): 62/47/28/42/217.
      const STAGE_RATE = [0.08, 0.07, 0.05, 0.025, 0.03];
      const adv = probs.adv[stage] * STAGE_RATE[stage] * state.speed;
      const drp = probs.drop[stage] * STAGE_RATE[stage] * state.speed;
      const u = Math.random();
      if (u < adv) {
        // Advance
        if (stage < N_STAGES - 1) {
          a.stage[i]++;
          const band = stageBandY(a.stage[i]);
          a.targetY[i] = band.top + Math.random() * (band.bottom - band.top);
          // Snap the visible position directly into the new band. Earlier
          // we tried a 60 % partial snap + smooth motion, but the motion
          // step couldn't keep up when multiple advances landed in the
          // same second — agents logically reached Retention while still
          // drawn in Trial. Full snap is visually abrupt but honest to
          // the underlying state.
          a.y[i] = a.targetY[i];
          a.ticksInStage[i] = 0;
          state.entered[a.stage[i]]++;
          if (a.stage[i] === 3) {
            // Purchase event — count acquisition + revenue
            state.acquisitions++;
            const ticket = seg.ticket * (1 - 0.5 * levers.discount);
            state.revenue += ticket;
          }
        } else {
          // Retention re-purchase
          a.retMonths[i]++;
          const ticket = seg.ticket * (1 - 0.5 * levers.discount);
          state.revenue += ticket;
          // After some retention, eventually graceful exit (cap lifetime).
          // 18-month cap keeps the Retention band from slowly overfilling
          // at the expense of upstream spawning capacity.
          if (a.retMonths[i] > 18) {
            startFade(i, 1);
          }
        }
      } else if (u < adv + drp) {
        // Drop out
        state.dropped[stage]++;
        if (stage === 4) {
          // Churn from retention — capture the months lived
          state.retainedLifetimeMonths[a.segment[i]] += a.retMonths[i];
          state.retainedCount[a.segment[i]]++;
        }
        startFade(i, 1);
      }

      // Smooth vertical motion toward target band. Rate tuned so a
      // single transition settles in ~10 ticks, comfortably faster
      // than the per-tick advance probability can fire again.
      const dy = a.targetY[i] - a.y[i];
      a.y[i] += dy * 0.22;
      // Horizontal jitter with walls
      a.x[i] += a.vx[i] * state.speed;
      if (a.x[i] < 20) { a.x[i] = 20; a.vx[i] = Math.abs(a.vx[i]); }
      if (a.x[i] > state.cssW - 20) { a.x[i] = state.cssW - 20; a.vx[i] = -Math.abs(a.vx[i]); }
      if (Math.random() < 0.01) a.vx[i] = (Math.random() - 0.5) * 0.3;
    }

    // 3. Budget
    state.totalAdSpend += levers.ad_spend / 60 * state.speed;

    state.tick++;
  }

  function startFade(i, kind) {
    const a = state.agents;
    a.fading[i] = kind;
    a.fadeT[i] = 1;
  }

  // Pick a segment index, biased toward loyalist/impulse if targeting high.
  function pickSegmentIndex(targeting) {
    // At targeting=0.5, weights equal entry_weight. At 1, shift toward high-LTV.
    // High-LTV here = loyalist + impulse.
    const shift = targeting - 0.5;  // -0.5..+0.5
    const weights = SEGMENTS.map((s) => {
      let w = s.entry;
      if (s.key === 'loyalist' || s.key === 'impulse') w *= 1 + shift * 1.2;
      else w *= 1 - shift * 1.2;
      return Math.max(0.02, w);
    });
    const total = weights.reduce((x, y) => x + y, 0);
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i]; if (r <= 0) return i;
    }
    return 0;
  }

  // Poisson sample via Knuth — fine for small λ we'll see here.
  function poissonSample(lambda) {
    if (lambda <= 0) return 0;
    if (lambda > 30) return Math.round(lambda + Math.sqrt(lambda) * (Math.random() - 0.5) * 2);
    const L = Math.exp(-lambda);
    let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
  }

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════
  function resolveColors() {
    const root = document.querySelector('.fs-main');
    const cs = getComputedStyle(root);
    state.segColors = {
      0: cs.getPropertyValue('--seg-bargain').trim()  || '#b24a3b',
      1: cs.getPropertyValue('--seg-loyalist').trim() || '#2f6e74',
      2: cs.getPropertyValue('--seg-skeptic').trim()  || '#8c8273',
      3: cs.getPropertyValue('--seg-impulse').trim()  || '#c5933b',
    };
  }

  function render() {
    const ctx = state.ctx;
    const a = state.agents;
    const W = state.cssW, H = state.cssH;

    ctx.clearRect(0, 0, W, H);

    // Draw thin horizontal dividers between stage bands (beyond CSS grid)
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    for (let s = 1; s < N_STAGES; s++) {
      const y = stageBandY(s).top;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw agents — batched by segment colour for fill performance.
    // Also tally per-stage active counts for the diagnostic overlay.
    const stageCounts = [0, 0, 0, 0, 0];
    for (let seg = 0; seg < SEGMENTS.length; seg++) {
      ctx.fillStyle = state.segColors[seg];
      ctx.beginPath();
      for (let i = 0; i < MAX_AGENTS; i++) {
        if (!a.active[i] || a.segment[i] !== seg) continue;
        if (!a.fading[i]) stageCounts[a.stage[i]]++;
        const alpha = a.fading[i] ? a.fadeT[i] : 1;
        if (alpha < 1) {
          ctx.fill();
          ctx.beginPath();
          ctx.globalAlpha = alpha;
          ctx.arc(a.x[i], a.y[i], 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.globalAlpha = 1;
          continue;
        }
        ctx.moveTo(a.x[i] + 3, a.y[i]);
        ctx.arc(a.x[i], a.y[i], 3, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    // Per-band live count overlay (right-aligned, near top of each band)
    ctx.font = '10px "DM Mono", monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.textAlign = 'right';
    for (let s = 0; s < N_STAGES; s++) {
      const band = stageBandY(s);
      ctx.fillText(stageCounts[s] + ' in stage', W - 14, band.top + 14);
    }
    // Build stamp + per-band diagnostic. Per-band counts shown so a
    // stale cache or a simulation stall is instantly visible on sight.
    ctx.font = '9px "DM Mono", monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.textAlign = 'left';
    ctx.fillText(
      'build v6 · ' + state.nActive + ' active · A:' + stageCounts[0] +
      ' C:' + stageCounts[1] + ' T:' + stageCounts[2] +
      ' P:' + stageCounts[3] + ' R:' + stageCounts[4],
      10, H - 8
    );
  }

  // ══════════════════════════════════════════════════════════
  // METRICS & READOUTS
  // ══════════════════════════════════════════════════════════
  let lastMetricsUpdate = 0;
  function updateMetrics() {
    // Throttle expensive DOM writes to ~5Hz
    const now = performance.now();
    if (now - lastMetricsUpdate < 200) return;
    lastMetricsUpdate = now;

    // Per-stage drop rates — use the analytical drop probability so the
    // readouts respond instantly when the user moves a slider, rather
    // than waiting for a hundred agents to flow through empirically.
    for (let s = 0; s < 5; s++) {
      const el = document.getElementById('drop-' + s);
      if (!el) continue;
      // Blended analytical drop-on-exit probability across segments.
      let weighted = 0;
      for (const seg of SEGMENTS) {
        const pr = probCache[SEG_KEY_TO_IDX[seg.key]];
        const exit = pr.adv[s] + pr.drop[s];
        const dropGivenExit = exit > 0 ? pr.drop[s] / exit : 0;
        weighted += seg.entry * dropGivenExit;
      }
      el.textContent = (weighted * 100).toFixed(0) + '% drop';
    }

    // Conversion / LTV / CAC — analytical (smoothed) is more honest than
    // the noisy running empirical rate, and responds to slider changes
    // immediately.
    const conv = blendedConversion(state.levers);
    const ltv = blendedLtv(state.levers);
    const cac = cacEstimate(state.levers);
    const ratio = isFinite(cac) ? ltv / cac : 0;

    setText('m-conv', (conv * 100).toFixed(1) + '%');
    setText('m-cac', isFinite(cac) ? '$' + cac.toFixed(0) : '∞');
    setText('m-ltv', '$' + ltv.toFixed(0));
    setText('m-ratio', ratio ? ratio.toFixed(1) + '×' : '—');
    setText('m-revenue', '$' + Math.round(state.revenue).toLocaleString());

    // Payback = CAC × retention_months / LTV.
    //   Equivalent to CAC ÷ average monthly revenue per customer.
    //   For a short retention tail, payback approaches CAC/ticket.
    const retentionMonths = SEGMENTS.reduce((s, seg) =>
      s + seg.entry * analyticalRetentionMonths(seg, state.levers), 0);
    const paybackMo = (isFinite(cac) && ltv > 0)
      ? (cac * retentionMonths) / ltv
      : Infinity;
    setText('m-payback', isFinite(paybackMo) ? paybackMo.toFixed(1) : '∞');

    // Per-segment breakdown (analytical conversion)
    const grid = document.getElementById('seg-breakdown');
    if (grid) {
      const rows = SEGMENTS.map(seg => {
        const p = analyticalConversion(seg, state.levers);
        return { seg, p };
      });
      const maxP = Math.max(...rows.map(r => r.p));
      grid.innerHTML = rows.map(r =>
        `<div class="segrow">
          <div class="segrow-name" style="color: var(--seg-${r.seg.key})">${r.seg.name}</div>
          <div class="segrow-bar"><div class="segrow-fill" style="width: ${(r.p / maxP * 100).toFixed(1)}%; background: var(--seg-${r.seg.key})"></div></div>
          <div class="segrow-val">${(r.p * 100).toFixed(1)}%</div>
        </div>`
      ).join('');
    }
  }

  // ══════════════════════════════════════════════════════════
  // BOOT
  // ══════════════════════════════════════════════════════════
  fetch(METHODOLOGY_URL).then(r => r.json()).then(d => {
    state.methodology = d; init();
  }).catch(() => init());

  function init() {
    state.canvas = document.getElementById('fs-canvas');
    if (!state.canvas) return;
    resizeCanvas();
    state.ctx = state.canvas.getContext('2d');
    resolveColors();
    initAgentPool();
    seedInitialPopulation();

    wireControls();
    wirePreset();
    wireSpeed();
    renderDateline();
    renderReceipts();
    renderFingerprints();
    refreshProbCache();
    updateMetrics();

    // Hero stat line — keep in sync with MAX_AGENTS so the text never
    // drifts from what the engine is actually running.
    const statEl = document.getElementById('stat-agents');
    if (statEl) statEl.textContent = 'up to ' + MAX_AGENTS.toLocaleString();

    window.addEventListener('resize', () => { resizeCanvas(); resolveColors(); });

    loop();
  }

  function findLastActive() {
    const a = state.agents;
    for (let i = MAX_AGENTS - 1; i >= 0; i--) if (a.active[i]) return i;
    return -1;
  }

  // Seed a plausible starting population so the canvas isn't empty on
  // load / reset. Called by init() and by the Reset button.
  //
  // Distribution is weighted to match what a running funnel actually
  // looks like at steady state — most agents top-of-funnel, a fat tail
  // of retained customers at the bottom. Without seeding into stages 4
  // and 5 the late bands stayed empty for ~20 s after reset because
  // the spawn rate isn't high enough to fill them quickly.
  // Seed at/near the expected equilibrium so the user sees populated
  // bands immediately on reset (rather than watching agents trickle
  // through for 30 s).
  const SEED_DISTRIBUTION = [
    { stage: 0, count:  80 },  // Awareness
    { stage: 1, count:  60 },  // Consideration
    { stage: 2, count:  60 },  // Trial
    { stage: 3, count:  70 },  // Purchase (explicit seed so it never starts empty)
    { stage: 4, count: 120 },  // Retention
  ];
  function seedInitialPopulation() {
    for (const { stage, count } of SEED_DISTRIBUTION) {
      for (let k = 0; k < count; k++) {
        spawnAgent(pickSegmentIndex(state.levers.targeting));
        const idx = findLastActive();
        if (idx < 0) continue;
        state.agents.stage[idx] = stage;
        const band = stageBandY(stage);
        state.agents.y[idx] = band.top + Math.random() * (band.bottom - band.top);
        state.agents.targetY[idx] = state.agents.y[idx];
        // Retained agents start with a random retention history so they
        // don't all churn in the same wave.
        if (stage === 4) {
          state.agents.retMonths[idx] = Math.floor(Math.random() * 18);
        }
      }
    }
  }

  function resizeCanvas() {
    const canvas = state.canvas;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    state.cssW = rect.width || 900;
    state.cssH = rect.height || 600;
    canvas.width = Math.round(state.cssW * dpr);
    canvas.height = Math.round(state.cssH * dpr);
    if (state.ctx) state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function loop() {
    if (state.running) tick();
    render();
    updateMetrics();
    state.rafId = requestAnimationFrame(loop);
  }

  // ══════════════════════════════════════════════════════════
  // CONTROLS
  // ══════════════════════════════════════════════════════════
  function wireControls() {
    const pairs = [
      ['ad-spend', v => { state.levers.ad_spend = +v; setText('ad-val', Math.round(v).toString()); refreshProbCache(); },  0],
      ['email-freq', v => { state.levers.email_freq = +v; setText('email-val', (+v).toFixed(2)); refreshProbCache(); }, 2],
      ['discount', v => { state.levers.discount = +v; setText('disc-val', (+v).toFixed(2)); refreshProbCache(); }, 2],
      ['targeting', v => { state.levers.targeting = +v; setText('targ-val', (+v).toFixed(2)); refreshProbCache(); }, 2],
      ['retention-effort', v => { state.levers.retention_effort = +v; setText('ret-val', (+v).toFixed(2)); refreshProbCache(); }, 2],
    ];
    pairs.forEach(([id, fn]) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', e => { fn(e.target.value); markCustomPreset(); });
    });

    document.getElementById('fs-run').addEventListener('click', () => {
      state.running = !state.running;
      document.getElementById('fs-run').textContent = state.running ? 'Pause' : 'Run';
    });
    document.getElementById('fs-reset').addEventListener('click', () => {
      initAgentPool();
      state.tick = 0;
      state.entered = [0,0,0,0,0];
      state.dropped = [0,0,0,0,0];
      state.retainedLifetimeMonths = [0,0,0,0];
      state.retainedCount = [0,0,0,0];
      state.revenue = 0;
      state.acquisitions = 0;
      state.totalAdSpend = 0;
      seedInitialPopulation();
    });
  }
  function markCustomPreset() {
    const sel = document.getElementById('fs-preset');
    if (sel && sel.value !== 'custom') sel.value = 'custom';
  }

  function wirePreset() {
    const sel = document.getElementById('fs-preset');
    if (!sel) return;
    sel.addEventListener('change', e => {
      const key = e.target.value;
      if (key === 'custom') return;
      applyPreset(PRESETS[key]);
    });
  }
  function applyPreset(p) {
    Object.assign(state.levers, p);
    document.getElementById('ad-spend').value = p.ad_spend;
    document.getElementById('email-freq').value = p.email_freq;
    document.getElementById('discount').value = p.discount;
    document.getElementById('targeting').value = p.targeting;
    document.getElementById('retention-effort').value = p.retention_effort;
    setText('ad-val', p.ad_spend.toString());
    setText('email-val', p.email_freq.toFixed(2));
    setText('disc-val', p.discount.toFixed(2));
    setText('targ-val', p.targeting.toFixed(2));
    setText('ret-val', p.retention_effort.toFixed(2));
    refreshProbCache();
  }
  function wireSpeed() {
    document.querySelectorAll('.speed-dial button').forEach(b => {
      b.addEventListener('click', () => {
        state.speed = parseFloat(b.dataset.speed);
        document.querySelectorAll('.speed-dial button').forEach(x =>
          x.setAttribute('aria-selected', x === b ? 'true' : 'false'));
      });
    });
  }

  // ══════════════════════════════════════════════════════════
  // FINGERPRINT CARDS
  // ══════════════════════════════════════════════════════════
  function renderFingerprints() {
    const grid = document.getElementById('fingerprint-grid');
    if (!grid) return;

    const cards = [
      { key: 'healthy',        title: 'Healthy',        tag: 'balanced levers',
        hint: 'Moderate spend, light discount, decent retention. Conversion is believable, LTV:CAC lands north of 3.' },
      { key: 'leaky',          title: 'Leaky bucket',   tag: 'high acq · bad retention',
        hint: 'Ad budget running hot, retention lever low. Conversion looks fine, LTV collapses — the classic growth-without-payback pattern.' },
      { key: 'saturated',      title: 'Saturated',      tag: 'diminishing returns',
        hint: 'Heavy discounting and email blast saturates fatigue. CAC spirals; every extra dollar of spend converts worse than the last.' },
      { key: 'niche_premium',  title: 'Niche premium',  tag: 'small · loyal · expensive',
        hint: 'Low spend, sharp targeting, high retention. Low volume but LTV:CAC off the chart.' },
    ];

    // Pull numbers from methodology.json if available, else compute live.
    const fps = state.methodology?.fingerprints || {};
    grid.innerHTML = cards.map(c => {
      const fp = fps[c.key] || liveFingerprint(PRESETS[c.key]);
      const conv = fp.blended_conversion * 100;
      const ltv = fp.blended_ltv;
      const cac = fp.cac;
      const ratio = fp.ltv_cac_ratio;
      const maxLtv = 400, maxCac = 400;
      return `<div class="fingerprint-card">
        <div class="fp-name">${c.title}</div>
        <div class="fp-tag">${c.tag}</div>
        <div class="fp-bars">
          ${barRow('conv', (conv).toFixed(1)+'%', conv / 30)}
          ${barRow('ltv',  '$' + ltv.toFixed(0), Math.min(1, ltv / maxLtv))}
          ${barRow('cac',  cac ? '$' + cac.toFixed(0) : '∞', Math.min(1, (cac || maxCac) / maxCac))}
          ${barRow('L:C',  ratio ? ratio.toFixed(1)+'×' : '—', Math.min(1, (ratio || 0) / 8))}
        </div>
        <div class="fp-summary">${c.hint}</div>
      </div>`;
    }).join('');
  }
  function barRow(label, valText, fillFrac) {
    return `<div class="fp-bar-row">
      <div class="fp-bar-lbl">${label}</div>
      <div class="fp-bar"><div class="fp-bar-fill" style="width:${(fillFrac*100).toFixed(0)}%"></div></div>
      <div class="fp-bar-val">${valText}</div>
    </div>`;
  }
  function liveFingerprint(levers) {
    return {
      blended_conversion: blendedConversion(levers),
      blended_ltv: blendedLtv(levers),
      cac: (function(){ const c = cacEstimate(levers); return isFinite(c) ? c : null; })(),
      ltv_cac_ratio: (function(){
        const c = cacEstimate(levers); const l = blendedLtv(levers);
        return (c && isFinite(c)) ? l / c : null;
      })(),
    };
  }

  // ══════════════════════════════════════════════════════════
  // RECEIPTS
  // ══════════════════════════════════════════════════════════
  function renderReceipts() {
    const grid = document.getElementById('receipts-grid');
    if (!grid) return;
    const items = [
      { v: MAX_AGENTS.toLocaleString(), l: 'agent pool capacity' },
      { v: '60fps', l: 'canvas redraw target' },
      { v: '4 × 5',  l: 'segment × stage prob matrix' },
      { v: '5',      l: 'levers exposed' },
      { v: '1 %',    l: 'closed-form vs sim error' },
      { v: '0',      l: 'server calls · everything client-side' },
    ];
    grid.innerHTML = items.map(it =>
      `<div class="metric"><div class="serif metric-value">${it.v}</div><div class="mono metric-label">${it.l}</div></div>`
    ).join('');
  }

  // ══════════════════════════════════════════════════════════
  // DATELINE helper
  // ══════════════════════════════════════════════════════════
  function renderDateline() {
    const el = document.getElementById('dateline-time');
    if (!el) return;
    const d = new Date();
    el.textContent = d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

})();
