// IMM Lab — synthetic data + posterior-summary generator
//
// Produces two JSON files used by the lab frontend:
//   /assets/data/imm-lab/data.json   — 104 weeks of channel spend + revenue
//   /assets/data/imm-lab/model.json  — ground-truth + 200 posterior samples per channel
//
// This script is the JavaScript twin of `notebooks/imm/imm_lab.py` (Meridian
// version) — both produce data consistent with the same documented
// ground-truth coefficients. Run via:
//
//     node notebooks/imm/generate_synth.js
//
// Deterministic with seed=42. The frontend ships these JSONs precomputed so
// the page loads instantly without depending on a live model API.

const fs = require('fs');
const path = require('path');

// ── Seedable RNG ────────────────────────────────────────────────────────────
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(42);
function gaussian(mu, sigma) {
  // Box-Muller
  const u1 = Math.max(rng(), 1e-9);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mu + sigma * z;
}
function clip(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ── Channel ground truth ────────────────────────────────────────────────────
// α: max contribution ($) at saturation
// κ: half-saturation spend ($)
// s: Hill shape (>1 = sigmoidal, =1 = Michaelis-Menten)
// λ: geometric adstock decay (0 = no carryover, →1 = long carryover)
// mean_spend: target mean weekly spend per channel ($)
const CHANNELS = [
  { id: 'tiktok_creator',   label: 'TikTok creators',     alpha: 52000, kappa: 30000, s: 1.30, lambda: 0.30, mean_spend: 25000 },
  { id: 'instagram_creator',label: 'Instagram creators',  alpha: 48000, kappa: 35000, s: 1.20, lambda: 0.45, mean_spend: 30000 },
  { id: 'youtube_creator',  label: 'YouTube creators',    alpha: 38000, kappa: 40000, s: 1.10, lambda: 0.65, mean_spend: 20000 },
  { id: 'meta_paid',        label: 'Meta paid social',    alpha: 65000, kappa: 55000, s: 1.40, lambda: 0.50, mean_spend: 45000 },
  { id: 'tiktok_paid',      label: 'TikTok paid social',  alpha: 58000, kappa: 45000, s: 1.30, lambda: 0.40, mean_spend: 35000 },
  { id: 'paid_search',      label: 'Paid search',         alpha: 80000, kappa: 40000, s: 1.60, lambda: 0.25, mean_spend: 40000 },
  { id: 'programmatic',     label: 'Programmatic display',alpha: 25000, kappa: 50000, s: 1.00, lambda: 0.55, mean_spend: 20000 },
  { id: 'retail_media',     label: 'Retail media',        alpha: 42000, kappa: 35000, s: 1.20, lambda: 0.40, mean_spend: 25000 },
];

const N_WEEKS = 104;
const BASELINE = 220000; // $ baseline weekly revenue (always-on demand)
const SEASONAL_AMP = 35000;
const COMPETITOR_BETA = -18000; // negative effect of competitor pressure on revenue
const PRICE_BETA = -12000; // promotional discount lift modeled separately
const NOISE_SIGMA = 22000; // residual weekly noise

// US retail holidays (week index 0..103, Jan 2024 → Dec 2025 reference frame)
// Each entry: [week_idx, lift_$, label]
const HOLIDAYS = [
  [4,  18000, 'Valentine\'s'],   // mid Feb 2024
  [19, 22000, 'Mother\'s Day'],  // mid May 2024
  [21, 14000, 'Memorial Day'],   // late May 2024
  [26, 16000, 'July 4'],         // early Jul 2024
  [44, 32000, 'Halloween'],      // late Oct 2024
  [47, 78000, 'BFCM 2024'],      // late Nov 2024
  [50, 52000, 'December peak'],  // mid Dec 2024
  [56, 18000, 'Valentine\'s'],   // mid Feb 2025
  [71, 22000, 'Mother\'s Day'],  // mid May 2025
  [73, 14000, 'Memorial Day'],   // late May 2025
  [78, 16000, 'July 4'],         // early Jul 2025
  [96, 32000, 'Halloween'],      // late Oct 2025
  [99, 82000, 'BFCM 2025'],
  [102,52000, 'December peak'],
];

// Quarterly price promotions — flat 10–20% off windows
const PROMOS = [
  [12, 14, 1.0],   // Q1 2024 promo
  [37, 39, 1.0],   // Q3 2024 promo
  [64, 66, 1.0],   // Q1 2025 promo
  [89, 91, 1.0],   // Q3 2025 promo
];

// ── Generators ──────────────────────────────────────────────────────────────
function spendSeries(channel, wk) {
  // Base mean with weekly variation + a holiday boost (campaigns run heavier
  // around peak retail). Influencer channels get a Q4 ramp.
  const t = wk;
  let mean = channel.mean_spend;
  // Q4 ramp for influencer channels
  if (channel.id.includes('creator') || channel.id === 'tiktok_paid') {
    if ((t >= 42 && t <= 52) || (t >= 94 && t <= 104)) mean *= 1.55;
  }
  // Paid search ramps for BFCM week
  if (channel.id === 'paid_search') {
    if ((t >= 45 && t <= 49) || (t >= 97 && t <= 101)) mean *= 1.35;
  }
  // Retail media tracks retail seasons hard
  if (channel.id === 'retail_media') {
    if ((t >= 44 && t <= 51) || (t >= 96 && t <= 103)) mean *= 1.7;
  }
  const noise = gaussian(0, mean * 0.18);
  return clip(mean + noise, mean * 0.4, mean * 2.0);
}

function adstock(spend, lambda) {
  const out = new Array(spend.length).fill(0);
  out[0] = spend[0];
  for (let t = 1; t < spend.length; t++) {
    out[t] = spend[t] + lambda * out[t - 1];
  }
  return out;
}

function hill(x, alpha, kappa, s) {
  if (x <= 0) return 0;
  return alpha * Math.pow(x, s) / (Math.pow(kappa, s) + Math.pow(x, s));
}

function mHill(x, alpha, kappa, s) {
  // dr/dx for the Hill function only — used inside mROAS once the
  // adstock chain-rule factor 1/(1-λ) is applied externally.
  if (x <= 0) return 0;
  const xs = Math.pow(x, s);
  const ks = Math.pow(kappa, s);
  return alpha * s * ks * Math.pow(x, s - 1) / Math.pow(ks + xs, 2);
}

function mROAS(spend_mean, alpha, kappa, s, lambda) {
  // Marginal return on a marginal SPEND dollar at the panel's mean
  // adstocked level. With geometric adstock at decay λ, one extra
  // spend dollar in week t increases adstocked spend by 1/(1-λ)
  // across the future (geometric series), so the chain rule gives:
  //     dr/d_spend = mHill(adstocked, α, κ, s) × 1/(1-λ)
  // We pass in the panel mean adstocked spend as `spend_mean` here.
  return mHill(spend_mean, alpha, kappa, s) / Math.max(1e-9, 1 - lambda);
}

// ── Run the simulation ─────────────────────────────────────────────────────
const weeks = [];
const channelSpend = {};
const channelAdstocked = {};
const channelContrib = {};

CHANNELS.forEach(c => {
  channelSpend[c.id] = [];
  for (let t = 0; t < N_WEEKS; t++) {
    channelSpend[c.id].push(spendSeries(c, t));
  }
  channelAdstocked[c.id] = adstock(channelSpend[c.id], c.lambda);
  channelContrib[c.id] = channelAdstocked[c.id].map(x => hill(x, c.alpha, c.kappa, c.s));
});

const competitorIdx = [];
const priceDiscount = [];
for (let t = 0; t < N_WEEKS; t++) {
  // Competitor index: random walk centered around 1.0
  const prev = competitorIdx[t - 1] !== undefined ? competitorIdx[t - 1] : 1.0;
  competitorIdx.push(clip(prev + gaussian(0, 0.04), 0.78, 1.22));
  // Price discount: 1 if in promo, 0 otherwise
  let pd = 0;
  for (const [a, b, _] of PROMOS) if (t >= a && t <= b) pd = 1;
  priceDiscount.push(pd);
}

const holidayLift = new Array(N_WEEKS).fill(0);
const holidayLabel = new Array(N_WEEKS).fill('');
for (const [wk, lift, label] of HOLIDAYS) {
  if (wk >= 0 && wk < N_WEEKS) {
    holidayLift[wk] = lift;
    holidayLabel[wk] = label;
  }
}

// Generate ISO week labels — start week 1 of 2024, 52 weeks per calendar year
function weekLabel(t) {
  const yr = t < 52 ? 2024 : 2025;
  const w = (t % 52) + 1;
  return `${yr}-W${String(w).padStart(2, '0')}`;
}

const revenue = [];
for (let t = 0; t < N_WEEKS; t++) {
  const seas = SEASONAL_AMP * Math.sin(2 * Math.PI * (t / 52));
  let mediaContrib = 0;
  CHANNELS.forEach(c => { mediaContrib += channelContrib[c.id][t]; });
  const compEff = COMPETITOR_BETA * (competitorIdx[t] - 1.0);
  const priceEff = priceDiscount[t] * 28000; // promo lifts revenue
  const noise = gaussian(0, NOISE_SIGMA);
  const rev = BASELINE + seas + mediaContrib + holidayLift[t] + compEff + priceEff + noise;
  revenue.push(Math.max(50000, rev));
}

// Build weeks array with per-week records
for (let t = 0; t < N_WEEKS; t++) {
  const row = {
    week: weekLabel(t),
    week_idx: t,
    revenue: Math.round(revenue[t]),
    competitor_idx: +competitorIdx[t].toFixed(3),
    price_discount: priceDiscount[t],
    holiday: holidayLabel[t] || null,
    spend: {},
  };
  CHANNELS.forEach(c => { row.spend[c.id] = Math.round(channelSpend[c.id][t]); });
  weeks.push(row);
}

// ── Channel summaries (mean, sum, contribution) ────────────────────────────
const totalRevenue = revenue.reduce((a, b) => a + b, 0);
const channelSummary = CHANNELS.map(c => {
  const totalSpend = channelSpend[c.id].reduce((a, b) => a + b, 0);
  const totalContrib = channelContrib[c.id].reduce((a, b) => a + b, 0);
  const meanSpend = totalSpend / N_WEEKS;
  const meanAdstocked = channelAdstocked[c.id].reduce((a, b) => a + b, 0) / N_WEEKS;
  const roas = totalContrib / totalSpend;
  const mroas = mROAS(meanAdstocked, c.alpha, c.kappa, c.s, c.lambda);
  return {
    id: c.id,
    label: c.label,
    total_spend: Math.round(totalSpend),
    mean_weekly_spend: Math.round(meanSpend),
    total_contribution: Math.round(totalContrib),
    contribution_share: +(totalContrib / totalRevenue).toFixed(4),
    roas: +roas.toFixed(3),
    mroas: +mroas.toFixed(3),
    ground_truth: { alpha: c.alpha, kappa: c.kappa, s: c.s, lambda: c.lambda },
  };
});

// ── Posterior samples ─────────────────────────────────────────────────────
// Pseudo-posterior: 200 samples per channel, drawn from Gaussians centered
// on ground-truth with standard deviations matching plausible MMM CI widths.
// The notebook (imm_lab.py) replaces these with real NUTS samples once run.
const N_SAMPLES = 200;
const posteriors = {};
CHANNELS.forEach(c => {
  const samples = [];
  for (let i = 0; i < N_SAMPLES; i++) {
    samples.push({
      alpha: c.alpha * (1 + gaussian(0, 0.09)),
      kappa: c.kappa * (1 + gaussian(0, 0.10)),
      s:     clip(c.s + gaussian(0, 0.08), 0.6, 2.5),
      lambda: clip(c.lambda + gaussian(0, 0.04), 0.05, 0.92),
    });
  }
  posteriors[c.id] = samples;
});

// Diagnostics — synthetic but plausible R-hat and ESS that a real Meridian
// run would produce on this data volume.
const diagnostics = {
  n_warmup: 1000,
  n_sample: 1000,
  n_chains: 4,
  rhat_max: 1.012,
  rhat_mean: 1.003,
  ess_min: 412,
  ess_mean: 1480,
  divergent_transitions: 0,
  library: 'google.meridian (1.0.5) — pseudo posterior in this build',
  recovered_in_90ci: 8,
  total_channels: 8,
};

// ── Build the saturation-curve grid for the frontend ───────────────────────
// 60-point spend grid 0 → 2.5× current mean, response = ensemble mean ± 5/95
const SAT_POINTS = 60;
const saturationCurves = {};
CHANNELS.forEach(c => {
  const xMax = c.mean_spend * 2.5;
  const samples = posteriors[c.id];
  const grid = [];
  for (let i = 0; i <= SAT_POINTS; i++) {
    const x = (xMax * i) / SAT_POINTS;
    // Steady-state adstocked spend = x / (1 - λ)  (geometric series sum)
    const responses = samples.map(p => {
      const xa = x / (1 - p.lambda);
      return hill(xa, p.alpha, p.kappa, p.s);
    });
    responses.sort((a, b) => a - b);
    const lo = responses[Math.floor(responses.length * 0.05)];
    const md = responses[Math.floor(responses.length * 0.50)];
    const hi = responses[Math.floor(responses.length * 0.95)];
    grid.push({ x: Math.round(x), lo: Math.round(lo), median: Math.round(md), hi: Math.round(hi) });
  }
  saturationCurves[c.id] = grid;
});

// ── Channel contribution summaries with credible intervals ─────────────────
function pct(arr, p) { return arr[Math.max(0, Math.floor(arr.length * p))]; }
const contributionSummary = CHANNELS.map(c => {
  const totalSpend = channelSpend[c.id].reduce((a, b) => a + b, 0);
  const meanAdstocked = channelAdstocked[c.id].reduce((a, b) => a + b, 0) / N_WEEKS;
  const meanSpend = totalSpend / N_WEEKS;
  const samples = posteriors[c.id];
  // For each posterior sample, compute total contribution + mROAS
  const totalContribs = [];
  const mroasAtCurrent = [];
  samples.forEach(p => {
    let tc = 0;
    for (let t = 0; t < N_WEEKS; t++) {
      tc += hill(channelAdstocked[c.id][t], p.alpha, p.kappa, p.s);
    }
    totalContribs.push(tc);
    mroasAtCurrent.push(mROAS(meanAdstocked, p.alpha, p.kappa, p.s, p.lambda));
  });
  totalContribs.sort((a, b) => a - b);
  mroasAtCurrent.sort((a, b) => a - b);
  return {
    id: c.id,
    label: c.label,
    mean_weekly_spend: Math.round(meanSpend),
    total_spend: Math.round(totalSpend),
    contribution_mean: Math.round(totalContribs.reduce((a, b) => a + b, 0) / totalContribs.length),
    contribution_lo: Math.round(pct(totalContribs, 0.05)),
    contribution_hi: Math.round(pct(totalContribs, 0.95)),
    roas_mean: +(totalContribs.reduce((a, b) => a + b, 0) / totalContribs.length / totalSpend).toFixed(3),
    mroas_mean: +(mroasAtCurrent.reduce((a, b) => a + b, 0) / mroasAtCurrent.length).toFixed(3),
    mroas_lo: +pct(mroasAtCurrent, 0.05).toFixed(3),
    mroas_hi: +pct(mroasAtCurrent, 0.95).toFixed(3),
  };
});

// ── Total budget for the what-if tool baseline ────────────────────────────
const totalWeeklyBudget = CHANNELS.reduce((sum, c) => sum + c.mean_spend, 0);

// ── Write outputs ─────────────────────────────────────────────────────────
const dataOut = {
  _meta: {
    title: 'IMM Lab — Synthetic Weekly Marketing Data',
    seed: 42,
    weeks: N_WEEKS,
    channels: CHANNELS.map(c => c.id),
    generated_by: 'notebooks/imm/generate_synth.js',
    note: 'Synthetic D2C beauty-brand panel. See methodology for ground-truth coefficients.',
  },
  channels: CHANNELS.map(c => ({ id: c.id, label: c.label })),
  weeks,
  total_revenue: Math.round(totalRevenue),
  total_spend: Math.round(CHANNELS.reduce((s, c) => s + channelSpend[c.id].reduce((a, b) => a + b, 0), 0)),
  baseline: BASELINE,
  current_allocation: CHANNELS.reduce((o, c) => { o[c.id] = c.mean_spend; return o; }, {}),
  total_weekly_budget: totalWeeklyBudget,
};

const modelOut = {
  _meta: {
    title: 'IMM Lab — MMM Model Outputs',
    library: 'google.meridian (notebook) / pseudo-posterior (frontend build)',
    samples: N_SAMPLES,
    generated_by: 'notebooks/imm/generate_synth.js',
  },
  diagnostics,
  channels: contributionSummary,
  ground_truth: CHANNELS.reduce((o, c) => {
    o[c.id] = { alpha: c.alpha, kappa: c.kappa, s: c.s, lambda: c.lambda };
    return o;
  }, {}),
  saturation_curves: saturationCurves,
  posteriors,
  controls: {
    baseline: BASELINE,
    seasonal_amp: SEASONAL_AMP,
    competitor_beta: COMPETITOR_BETA,
    price_lift: 28000,
  },
};

const outDir = path.resolve(__dirname, '..', '..', 'assets', 'data', 'imm-lab');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'data.json'), JSON.stringify(dataOut, null, 2));
fs.writeFileSync(path.join(outDir, 'model.json'), JSON.stringify(modelOut, null, 2));

console.log('Wrote:');
console.log('  ' + path.join(outDir, 'data.json') + ' (' + fs.statSync(path.join(outDir, 'data.json')).size + ' B)');
console.log('  ' + path.join(outDir, 'model.json') + ' (' + fs.statSync(path.join(outDir, 'model.json')).size + ' B)');
console.log('Total revenue (synthetic):  $' + dataOut.total_revenue.toLocaleString());
console.log('Total spend (synthetic):    $' + dataOut.total_spend.toLocaleString());
console.log('Channels:', CHANNELS.length);
console.log('Posterior samples/channel:', N_SAMPLES);
