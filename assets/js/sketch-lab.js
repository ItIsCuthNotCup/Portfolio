/* ═══════════════════════════════════════════════════════════
   SKETCH LAB — page logic

   Drawing canvas + browser-side inference against an ONNX model
   trained on Google's Quick Draw bitmap dataset (30 classes).

   Inference path:
     pointer events  →  smoothed strokes on canvas
     stroke end      →  rasterize 480x480 canvas to 28x28 grayscale
                        invert (Quick Draw is white-on-black)
                        flatten to Float32Array(784), normalize 0-1
     Float32Array    →  ONNX Runtime Web session.run()
     output (30,)    →  sort, take top-3
     UI update       →  bars, names, scores, history, target match

   Data dependencies (loaded once on page init):
     /assets/models/sketch/model.onnx        ~930 KB
     /assets/models/sketch/categories.json   30 strings
     /assets/data/sketch/methodology.json    receipts + adversarial pairs
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const MODEL_URL = '/assets/models/sketch/model.onnx';
  const CATEGORIES_URL = '/assets/models/sketch/categories.json';
  const METHODOLOGY_URL = '/assets/data/sketch/methodology.json';

  // Categories chosen for the "Try drawing:" suggestion row. Verified
  // against the trained model's per-class accuracy on the held-out
  // test set; every entry is >=80% top-1 to keep the demo snappy.
  const SUGGESTIONS = [
    'bicycle', 'house', 'clock', 'mushroom', 'guitar',
    'fish', 'mountain', 'ladder', 'ice cream', 'apple',
  ];

  // Drawing config
  const STROKE_WIDTH = 12;            // px on the rendered 480x480 canvas
  const PREDICT_INPUT = 28;           // model input dimension
  const PREDICT_DEBOUNCE_MS = 30;     // collapse rapid stroke-ends

  // ── State ──────────────────────────────────────────────────
  const state = {
    session: null,                    // ONNX inference session
    categories: null,                 // ['airplane', ..., 'sun']
    methodology: null,                // accuracy + worst-confusions
    canvas: null,
    ctx: null,
    // Each stroke is an array of {x, y} points (CSS pixels)
    strokes: [],
    activeStroke: null,
    isDrawing: false,
    sessionCount: 0,
    target: null,                     // currently selected suggestion
    history: [],                      // [{stroke, name, score}, ...]
    lastPredictAt: 0,
    predictTimer: null,
    canvasReady: false,
  };

  // ══════════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════════
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    state.canvas = document.getElementById('sk-canvas');
    if (!state.canvas) return;
    state.ctx = state.canvas.getContext('2d');

    setupCanvas();
    setupCanvasEvents();
    setupTools();

    // Kick off async loads in parallel
    const [_, sess, cats, meth] = await Promise.all([
      Promise.resolve(),
      loadModel(),
      loadJson(CATEGORIES_URL),
      loadJson(METHODOLOGY_URL),
    ]);

    state.session = sess;
    state.categories = cats;
    state.methodology = meth;

    renderSuggestions();
    renderAdversarial();
    renderReceipts();

    hideLoading();
    state.canvasReady = true;
  }

  // ══════════════════════════════════════════════════════════
  // CANVAS — high-DPI setup, pointer events, smooth strokes
  // ══════════════════════════════════════════════════════════
  function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const cssSize = state.canvas.clientWidth || 480;
    state.canvas.width = Math.round(cssSize * dpr);
    state.canvas.height = Math.round(cssSize * dpr);
    state.ctx.scale(dpr, dpr);
    state.ctx.lineCap = 'round';
    state.ctx.lineJoin = 'round';
    state.ctx.strokeStyle = '#000';
    state.ctx.lineWidth = STROKE_WIDTH;
    paintBackground();

    // Re-set on resize so the bitmap matches the rendered size
    window.addEventListener('resize', () => {
      const cs = state.canvas.clientWidth;
      if (Math.abs(cs - cssSize) > 1) {
        // Re-create at new size; redraw existing strokes
        state.canvas.width = Math.round(cs * dpr);
        state.canvas.height = Math.round(cs * dpr);
        state.ctx.scale(dpr, dpr);
        state.ctx.lineCap = 'round';
        state.ctx.lineJoin = 'round';
        state.ctx.strokeStyle = '#000';
        state.ctx.lineWidth = STROKE_WIDTH;
        repaintAllStrokes();
      }
    });
  }

  function paintBackground() {
    state.ctx.save();
    state.ctx.setTransform(1, 0, 0, 1, 0, 0);
    state.ctx.fillStyle = '#ffffff';
    state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
    state.ctx.restore();
  }

  function repaintAllStrokes() {
    paintBackground();
    state.ctx.strokeStyle = '#000';
    state.ctx.lineWidth = STROKE_WIDTH;
    state.ctx.lineCap = 'round';
    state.ctx.lineJoin = 'round';
    for (const stroke of state.strokes) {
      drawStroke(stroke);
    }
  }

  function drawStroke(points) {
    if (!points || points.length === 0) return;
    state.ctx.beginPath();
    state.ctx.moveTo(points[0].x, points[0].y);
    if (points.length === 1) {
      // Single tap: render a small dot
      state.ctx.arc(points[0].x, points[0].y, STROKE_WIDTH / 2, 0, Math.PI * 2);
      state.ctx.fillStyle = '#000';
      state.ctx.fill();
      return;
    }
    // Smoothing: quadratic curve through midpoints of each pair
    for (let i = 1; i < points.length - 1; i++) {
      const midX = (points[i].x + points[i + 1].x) / 2;
      const midY = (points[i].y + points[i + 1].y) / 2;
      state.ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
    }
    const last = points[points.length - 1];
    state.ctx.lineTo(last.x, last.y);
    state.ctx.stroke();
  }

  function setupCanvasEvents() {
    const c = state.canvas;
    const getPoint = (e) => {
      const rect = c.getBoundingClientRect();
      const t = e.touches && e.touches[0] ? e.touches[0] : e;
      return {
        x: t.clientX - rect.left,
        y: t.clientY - rect.top,
      };
    };

    function start(e) {
      e.preventDefault();
      state.isDrawing = true;
      state.activeStroke = [getPoint(e)];
      state.strokes.push(state.activeStroke);
      hideEmpty();
      drawStroke(state.activeStroke);
    }

    function move(e) {
      if (!state.isDrawing) return;
      e.preventDefault();
      const p = getPoint(e);
      const last = state.activeStroke[state.activeStroke.length - 1];
      // Skip if pointer hasn't actually moved
      if (Math.abs(p.x - last.x) < 1 && Math.abs(p.y - last.y) < 1) return;
      state.activeStroke.push(p);
      // Redraw just the active stroke incrementally — re-stroking the
      // whole stroke each tick keeps the smoothed curve correct.
      // Performance is fine for realistic stroke lengths.
      state.ctx.strokeStyle = '#000';
      state.ctx.lineWidth = STROKE_WIDTH;
      drawStroke(state.activeStroke);
    }

    function end(e) {
      if (!state.isDrawing) return;
      e.preventDefault();
      state.isDrawing = false;
      state.activeStroke = null;
      updateStrokeUI();
      schedulePredict();
    }

    c.addEventListener('mousedown', start);
    c.addEventListener('mousemove', move);
    c.addEventListener('mouseup', end);
    c.addEventListener('mouseleave', end);
    c.addEventListener('touchstart', start, { passive: false });
    c.addEventListener('touchmove', move, { passive: false });
    c.addEventListener('touchend', end, { passive: false });
    c.addEventListener('touchcancel', end, { passive: false });
  }

  function setupTools() {
    document.getElementById('sk-clear').addEventListener('click', clearCanvas);
    document.getElementById('sk-undo').addEventListener('click', undoStroke);
  }

  function clearCanvas() {
    state.strokes = [];
    state.history = [];
    state.target = null;
    paintBackground();
    showEmpty();
    updateStrokeUI();
    renderHistory();
    clearPredictions();
    updateTargetUI();
    document.querySelectorAll('.sk-suggest-btn.active').forEach((b) =>
      b.classList.remove('active'),
    );
  }

  function undoStroke() {
    if (state.strokes.length === 0) return;
    state.strokes.pop();
    if (state.history.length > 0) state.history.pop();
    repaintAllStrokes();
    if (state.strokes.length === 0) showEmpty();
    updateStrokeUI();
    renderHistory();
    schedulePredict();
  }

  function updateStrokeUI() {
    const n = state.strokes.length;
    document.getElementById('sk-stroke-num').textContent = String(n);
    document.getElementById('sk-undo').disabled = n === 0;
  }

  function showEmpty() {
    const e = document.getElementById('sk-empty');
    if (e) e.classList.remove('hidden');
  }
  function hideEmpty() {
    const e = document.getElementById('sk-empty');
    if (e) e.classList.add('hidden');
  }

  // ══════════════════════════════════════════════════════════
  // INFERENCE
  // ══════════════════════════════════════════════════════════
  async function loadModel() {
    if (!window.ort) {
      console.error('ONNX Runtime Web not loaded');
      return null;
    }
    try {
      // WASM backend, single-threaded. Keeps things simple and
      // works without crossOriginIsolation headers.
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.simd = true;
      const session = await ort.InferenceSession.create(MODEL_URL, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      return session;
    } catch (err) {
      console.error('Model load failed:', err);
      return null;
    }
  }

  async function loadJson(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('Failed to load ' + url);
    return r.json();
  }

  function schedulePredict() {
    // Debounce: collapse rapid stroke-end events into one prediction.
    clearTimeout(state.predictTimer);
    state.predictTimer = setTimeout(predictNow, PREDICT_DEBOUNCE_MS);
  }

  async function predictNow() {
    if (!state.session || state.strokes.length === 0) return;

    const tensor = canvasToInputTensor();
    const t0 = performance.now();
    let result;
    try {
      result = await state.session.run({ input: tensor });
    } catch (err) {
      console.error('Inference failed:', err);
      return;
    }
    const elapsed = performance.now() - t0;
    state.lastPredictAt = elapsed;

    // The sklearn-exported model returns two outputs: 'label' (argmax)
    // and 'probabilities' (full vector). We want probabilities.
    const probsTensor = result.probabilities || result.output_probability ||
      Object.values(result).find((t) => t.dims && t.dims.length >= 1 &&
        t.dims[t.dims.length - 1] === state.categories.length);
    if (!probsTensor) {
      console.error('No probability tensor in model output:', Object.keys(result));
      return;
    }

    const probs = Array.from(probsTensor.data);
    const top3 = topK(probs, 3);

    state.sessionCount += 1;
    document.getElementById('sk-session-num').textContent = String(state.sessionCount);

    renderPredictions(top3);
    updateTargetUI(top3[0]);
    appendHistory(top3[0]);
  }

  function canvasToInputTensor() {
    // Downsample 480x480 (or whatever) to 28x28 grayscale.
    // Quick Draw training data is white-on-black bitmaps, so we invert
    // (canvas is black-on-white -> grayscale -> invert -> normalize).
    const tmp = document.createElement('canvas');
    tmp.width = PREDICT_INPUT;
    tmp.height = PREDICT_INPUT;
    const tctx = tmp.getContext('2d');
    tctx.fillStyle = '#fff';
    tctx.fillRect(0, 0, PREDICT_INPUT, PREDICT_INPUT);
    // drawImage will smoothly downsample
    tctx.imageSmoothingEnabled = true;
    tctx.drawImage(state.canvas, 0, 0, PREDICT_INPUT, PREDICT_INPUT);
    const img = tctx.getImageData(0, 0, PREDICT_INPUT, PREDICT_INPUT).data;

    const arr = new Float32Array(PREDICT_INPUT * PREDICT_INPUT);
    for (let i = 0; i < arr.length; i++) {
      // Average RGB → grayscale → invert → normalize 0..1
      const j = i * 4;
      const gray = (img[j] + img[j + 1] + img[j + 2]) / 3;
      arr[i] = (255 - gray) / 255;
    }
    return new ort.Tensor('float32', arr, [1, PREDICT_INPUT * PREDICT_INPUT]);
  }

  function topK(arr, k) {
    return arr
      .map((value, index) => ({ value, index }))
      .sort((a, b) => b.value - a.value)
      .slice(0, k)
      .map((x) => ({ name: state.categories[x.index], score: x.value }));
  }

  // ══════════════════════════════════════════════════════════
  // RENDERING
  // ══════════════════════════════════════════════════════════
  function renderPredictions(top3) {
    const rows = document.querySelectorAll('.sk-pred-row');
    for (let i = 0; i < 3; i++) {
      const row = rows[i];
      if (!row) continue;
      const r = top3[i];
      const name = r ? r.name : '—';
      const pct = r ? Math.round(r.score * 100) : 0;
      row.querySelector('.sk-pred-name').textContent = name;
      row.querySelector('.sk-pred-score').textContent = pct + '%';
      row.querySelector('.sk-pred-fill').style.width = pct + '%';
      // Match highlight if this name == target
      const isMatch = state.target && r && r.name === state.target;
      row.classList.toggle('match', isMatch);
    }
  }

  function clearPredictions() {
    document.querySelectorAll('.sk-pred-row').forEach((row) => {
      row.querySelector('.sk-pred-name').textContent = '—';
      row.querySelector('.sk-pred-score').textContent = '—';
      row.querySelector('.sk-pred-fill').style.width = '0%';
      row.classList.remove('match');
    });
  }

  function appendHistory(top1) {
    if (!top1) return;
    state.history.push({
      stroke: state.strokes.length,
      name: top1.name,
      score: top1.score,
    });
    renderHistory();
  }

  function renderHistory() {
    const list = document.getElementById('sk-history-list');
    if (!list) return;
    if (state.history.length === 0) {
      list.innerHTML = '<li class="sk-history-empty">No strokes yet.</li>';
      return;
    }
    // Newest first
    const items = state.history
      .slice()
      .reverse()
      .map((h) => {
        const pct = Math.round(h.score * 100);
        return (
          '<li><span class="h-stroke">stroke ' +
          h.stroke +
          '</span><span class="h-name">' +
          escapeHtml(h.name) +
          '</span><span class="h-score">' +
          pct +
          '%</span></li>'
        );
      })
      .join('');
    list.innerHTML = items;
  }

  function renderSuggestions() {
    const wrap = document.getElementById('sk-suggest-list');
    if (!wrap || !state.categories) return;
    wrap.innerHTML = '';
    SUGGESTIONS.forEach((cat) => {
      // Skip if not in trained categories (defensive)
      if (!state.categories.includes(cat)) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sk-suggest-btn';
      btn.textContent = cat;
      btn.addEventListener('click', () => setTarget(cat, btn));
      wrap.appendChild(btn);
    });
  }

  function setTarget(category, button) {
    document.querySelectorAll('.sk-suggest-btn').forEach((b) =>
      b.classList.remove('active'),
    );
    if (state.target === category) {
      // Toggle off
      state.target = null;
    } else {
      state.target = category;
      button.classList.add('active');
    }
    updateTargetUI();
  }

  function updateTargetUI(top1) {
    const row = document.getElementById('sk-target-row');
    if (!row) return;
    if (!state.target) {
      row.hidden = true;
      return;
    }
    row.hidden = false;
    document.getElementById('sk-target-name').textContent = state.target;
    const status = document.getElementById('sk-target-status');
    if (top1 && top1.name === state.target) {
      status.textContent = 'match · ' + Math.round(top1.score * 100) + '%';
      status.classList.add('match');
    } else if (top1) {
      status.textContent = 'currently: ' + top1.name;
      status.classList.remove('match');
    } else {
      status.textContent = 'searching…';
      status.classList.remove('match');
    }
  }

  function renderAdversarial() {
    const wrap = document.getElementById('sk-adversarial');
    if (!wrap || !state.methodology) return;
    const pairs = (state.methodology.worst_confusions || []).slice(0, 6);
    if (pairs.length === 0) {
      wrap.innerHTML = '<div class="sk-adv-empty">No confusion data.</div>';
      return;
    }
    wrap.innerHTML = pairs
      .map((p, i) => {
        const rank = String(i + 1).padStart(2, '0');
        const pct = Math.round(p.rate * 100);
        return (
          '<div class="sk-adv-card">' +
          '<div class="sk-adv-rank">No. ' + rank + '</div>' +
          '<div class="sk-adv-pair">' +
          '<span class="true">' + escapeHtml(p.true) + '</span>' +
          '<span class="arrow">read as</span>' +
          '<span class="pred">' + escapeHtml(p.predicted) + '</span>' +
          '</div>' +
          '<div class="sk-adv-rate">' + pct + '% of test sketches · ' +
          p.count + ' of ' + state.methodology.test_samples / state.methodology.categories +
          '</div>' +
          '</div>'
        );
      })
      .join('');
  }

  function renderReceipts() {
    const wrap = document.getElementById('sk-receipts');
    if (!wrap || !state.methodology) return;
    const m = state.methodology;
    const cells = [
      { label: 'top-1 accuracy', value: Math.round(m.top1_accuracy * 100), unit: '%' },
      { label: 'top-3 accuracy', value: Math.round(m.top3_accuracy * 100), unit: '%' },
      { label: 'classes', value: m.categories, unit: '' },
      { label: 'training sketches', value: m.training_samples.toLocaleString(), unit: '' },
      { label: 'parameters', value: Math.round(m.params / 1000), unit: 'K' },
      { label: 'model size', value: Math.round(m.model_size_kb), unit: 'KB' },
      { label: 'inference', value: '<50', unit: 'ms' },
      { label: 'cost per call', value: '$0.000', unit: '' },
    ];
    wrap.innerHTML = cells
      .map((c) =>
        '<div class="sk-receipt">' +
        '<div class="sk-receipt-label">' + escapeHtml(c.label) + '</div>' +
        '<div class="sk-receipt-value">' + c.value +
        (c.unit ? '<span class="small">' + escapeHtml(c.unit) + '</span>' : '') +
        '</div>' +
        '</div>',
      )
      .join('');
  }

  function hideLoading() {
    const el = document.getElementById('sk-loading');
    if (el) el.classList.add('hidden');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
