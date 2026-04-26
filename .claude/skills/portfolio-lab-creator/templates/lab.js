/* TEMPLATE — copy to assets/js/{{slug}}-lab.js. Substitute {{prefix}}.

   This is the skeleton. Add lab-specific logic below the marker.
   The skeleton handles:
     - Module wrapping (IIFE, strict mode)
     - DOMContentLoaded init
     - Optional async loading of model + data files
     - Receipts panel population from methodology.json (if present)

   For ML-backed labs, see the sketch-lab.js for a full reference
   on canvas drawing + ONNX inference + preprocessing parity.
*/

(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────
  const METHODOLOGY_URL = '/assets/data/{{slug}}/methodology.json';
  const MODEL_URL = '/assets/models/{{slug}}/model.onnx';

  // ── State ───────────────────────────────────────────────
  const state = {
    methodology: null,
    session: null,        // ONNX session, only if model-backed
    // ...lab-specific state...
  };

  // ── Init ────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    // Load any data files in parallel
    const tasks = [];
    tasks.push(loadJson(METHODOLOGY_URL).then((m) => { state.methodology = m; }).catch(() => {}));
    // Uncomment for model-backed labs:
    // tasks.push(loadModel(MODEL_URL).then((s) => { state.session = s; }).catch(() => {}));
    await Promise.all(tasks);

    if (state.methodology) renderReceipts();

    // Lab-specific init goes here
    initDemo();
  }

  // ── Receipts panel populated from methodology.json ──────
  function renderReceipts() {
    const wrap = document.getElementById('{{prefix}}-receipts');
    if (!wrap || !state.methodology) return;
    const m = state.methodology;
    // Adapt these cells for your lab's metrics.
    const cells = [
      { label: 'top-1 accuracy', value: pct(m.top1_accuracy), unit: '%' },
      { label: 'classes',        value: m.categories,         unit: '' },
      { label: 'training rows',  value: nfmt(m.training_samples), unit: '' },
      { label: 'model size',     value: m.model_size_kb,      unit: 'KB' },
    ].filter((c) => c.value != null);
    wrap.innerHTML = cells.map((c) =>
      '<div class="{{prefix}}-receipt">' +
      '<div class="{{prefix}}-receipt-label">' + esc(c.label) + '</div>' +
      '<div class="{{prefix}}-receipt-value">' + c.value +
      (c.unit ? '<span class="small">' + esc(c.unit) + '</span>' : '') +
      '</div></div>'
    ).join('');
  }

  // ── Loading helpers ─────────────────────────────────────
  async function loadJson(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('failed: ' + url);
    return r.json();
  }

  async function loadModel(url) {
    if (!window.ort) {
      console.error('ONNX Runtime Web not loaded');
      return null;
    }
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.simd = true;
    return await ort.InferenceSession.create(url, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
  }

  // ── Utilities ───────────────────────────────────────────
  function pct(x) { return x == null ? null : Math.round(x * 100); }
  function nfmt(n) { return n == null ? null : Number(n).toLocaleString(); }
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ──────────────────────────────────────────────────────────
  // LAB-SPECIFIC LOGIC BELOW THIS MARKER
  // ──────────────────────────────────────────────────────────
  function initDemo() {
    // TODO: implement the lab-specific demo here.
    // For canvas/drawing labs, see assets/js/sketch-lab.js.
    // For control-panel + chart labs, see assets/js/funnel-sim-lab.js.
  }
})();
