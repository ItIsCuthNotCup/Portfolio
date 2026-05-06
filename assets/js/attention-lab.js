/* ═══════════════════════════════════════════════════════════
   ATTENTION LAB — TEST. 07
   Three jobs:
   - Set the dateline.
   - Power the interactive 6×6 attention heatmap (§ II).
   - Power the complexity slider with reactive bars (§ V).
   Multi-head strip in § III is rendered server-side as static
   CSS-driven cells; nothing to wire here.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Dateline ──────────────────────────────────────────── */
  (function setDateline() {
    var el = document.getElementById('dateline-time');
    if (!el) return;
    var now = new Date();
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    el.textContent = months[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear();
  })();

  /* ── § II · Attention heatmap ──────────────────────────── */
  // Sentence: "the cat sat on the mat" (6 tokens)
  // Plausible self-attention pattern. Each row sums to ~1 (softmax).
  // Index:       0:the  1:cat  2:sat  3:on   4:the  5:mat
  var TOKENS = ['the', 'cat', 'sat', 'on', 'the', 'mat'];
  var WEIGHTS = [
    // row = query token; columns = which keys it attends to
    [0.18, 0.55, 0.10, 0.05, 0.04, 0.08],   // "the"  → mostly "cat" (article + noun)
    [0.08, 0.22, 0.48, 0.06, 0.04, 0.12],   // "cat"  → "sat" (subject + verb)
    [0.04, 0.40, 0.16, 0.08, 0.02, 0.30],   // "sat"  → "cat" + "mat" (verb binds subj/obj)
    [0.03, 0.05, 0.12, 0.18, 0.10, 0.52],   // "on"   → "mat" (preposition + object)
    [0.04, 0.04, 0.06, 0.08, 0.16, 0.62],   // "the"  → "mat" (article + noun)
    [0.02, 0.10, 0.30, 0.18, 0.08, 0.32]    // "mat"  → "sat" + "on" + self
  ];
  var ROW_NOTES = [
    'Article binds to its noun. <strong>"the"</strong> attends to <span class="att-hm-readout-accent">"cat"</span> (0.55), the head it modifies.',
    'Subject binds to verb. <strong>"cat"</strong> attends to <span class="att-hm-readout-accent">"sat"</span> (0.48), the predicate it drives.',
    'Verb binds subject and object. <strong>"sat"</strong> attends to <span class="att-hm-readout-accent">"cat"</span> (0.40) and <span class="att-hm-readout-accent">"mat"</span> (0.30).',
    'Preposition binds to its object. <strong>"on"</strong> attends to <span class="att-hm-readout-accent">"mat"</span> (0.52) far across the sentence.',
    'Article binds to its noun. <strong>"the"</strong> (second) attends to <span class="att-hm-readout-accent">"mat"</span> (0.62).',
    'Object loops back to verb. <strong>"mat"</strong> attends to <span class="att-hm-readout-accent">"sat"</span> (0.30) and <span class="att-hm-readout-accent">"on"</span> (0.18).'
  ];

  function buildHeatmap() {
    var grid = document.getElementById('att-heatmap');
    if (!grid) return;
    var readout = document.getElementById('att-hm-readout');

    // Top-row column labels
    var cols = document.createElement('div'); cols.className = 'att-hm-cols';
    cols.style.gridColumn = '2 / 3';
    grid.appendChild(document.createElement('div')).className = 'att-hm-corner';
    TOKENS.forEach(function (tok, i) {
      var c = document.createElement('div');
      c.className = 'att-hm-col-label';
      c.innerHTML = '<span class="att-hm-col-idx">K' + i + '</span>' + tok;
      cols.appendChild(c);
    });
    grid.appendChild(cols);

    // Row labels + cells
    WEIGHTS.forEach(function (row, ri) {
      var rowEl = document.createElement('div');
      rowEl.className = 'att-hm-row';
      rowEl.dataset.row = String(ri);

      var label = document.createElement('div');
      label.className = 'att-hm-row-label';
      label.innerHTML = '<span class="att-hm-row-idx">Q' + ri + '</span><span>' + TOKENS[ri] + '</span>';
      rowEl.appendChild(label);

      var cells = document.createElement('div');
      cells.className = 'att-hm-cells';
      var maxW = Math.max.apply(null, row);
      row.forEach(function (w, ci) {
        var cell = document.createElement('div');
        cell.className = 'att-hm-cell';
        if (w === maxW) cell.classList.add('att-hm-strong');
        var fill = document.createElement('div');
        fill.className = 'att-hm-fill';
        fill.style.opacity = String(w);
        cell.style.setProperty('--w', String(w));
        cell.appendChild(fill);
        var num = document.createElement('div');
        num.className = 'att-hm-num';
        num.textContent = w.toFixed(2);
        cell.appendChild(num);
        cells.appendChild(cell);
      });
      rowEl.appendChild(cells);
      grid.appendChild(rowEl);

      function activate() {
        clearActive();
        rowEl.classList.add('is-active');
        Array.prototype.forEach.call(grid.querySelectorAll('.att-hm-row'), function (r) {
          if (r !== rowEl) r.classList.add('is-dim');
        });
        if (readout) readout.innerHTML = ROW_NOTES[ri];
      }
      rowEl.addEventListener('mouseenter', activate);
      rowEl.addEventListener('focus', activate, true);
      rowEl.addEventListener('click', activate);
      rowEl.tabIndex = 0;
    });

    function clearActive() {
      Array.prototype.forEach.call(grid.querySelectorAll('.att-hm-row'), function (r) {
        r.classList.remove('is-active');
        r.classList.remove('is-dim');
      });
    }

    grid.addEventListener('mouseleave', function () {
      clearActive();
      if (readout) readout.innerHTML = 'Hover any row. <strong>Each row is one query token</strong> looking at the whole sentence and choosing which keys to attend to. Weights sum to 1.';
    });

    if (readout) readout.innerHTML = 'Hover any row. <strong>Each row is one query token</strong> looking at the whole sentence and choosing which keys to attend to. Weights sum to 1.';
  }

  /* ── § V · Complexity slider ───────────────────────────── */
  // Compares per-layer complexity for four sequence-modeling layers.
  // d = representation dim (held at 512, the paper's d_model).
  // k = conv kernel (the paper compares k = 3).
  // r = restricted self-attention neighborhood (paper: r = 256 example).
  var D = 512;
  var K_CONV = 3;
  var R_RESTRICT = 256;

  function complexity(n) {
    // Returns object of FLOPs estimates (per-layer, big-O constants ignored).
    return {
      selfAttn:    n * n * D,                 // O(n²·d)
      recurrent:   n * D * D,                 // O(n·d²)
      conv:        K_CONV * n * D * D,        // O(k·n·d²)
      restricted:  R_RESTRICT * n * D         // O(r·n·d)
    };
  }

  function fmtFlops(v) {
    if (v >= 1e12) return (v / 1e12).toFixed(2) + ' T';
    if (v >= 1e9)  return (v / 1e9).toFixed(2) + ' G';
    if (v >= 1e6)  return (v / 1e6).toFixed(2) + ' M';
    if (v >= 1e3)  return (v / 1e3).toFixed(2) + ' K';
    return Math.round(v).toString();
  }

  function powTwoTag(n) {
    // 8 → tweet-size, 64 → sentence, 512 → paragraph, 4096 → document, 8192 → book chapter
    if (n <= 16)   return 'Tweet-size';
    if (n <= 128)  return 'A sentence';
    if (n <= 1024) return 'A paragraph';
    if (n <= 4096) return 'A document';
    return 'A chapter';
  }

  function buildSlider() {
    var slider = document.getElementById('att-slider');
    var nReadout = document.getElementById('att-slider-n');
    var nTag = document.getElementById('att-slider-tag');
    if (!slider) return;

    var bars = {
      selfAttn:   document.querySelector('.att-bar-row.is-self'),
      recurrent:  document.querySelector('.att-bar-row.is-recurrent'),
      conv:       document.querySelector('.att-bar-row.is-conv'),
      restricted: document.querySelector('.att-bar-row.is-restricted')
    };

    function update() {
      // Slider 0..100 maps logarithmically to n in [8, 8192].
      var t = parseInt(slider.value, 10) / 100;
      var n = Math.round(Math.pow(2, 3 + t * 10)); // 2^3=8 to 2^13=8192
      var c = complexity(n);

      nReadout.textContent = n.toLocaleString();
      nTag.textContent = powTwoTag(n);

      // Bar widths normalized to the max value at THIS n, so the chart is
      // about which layer is cheapest at this n, not absolute scale.
      var values = [c.selfAttn, c.recurrent, c.conv, c.restricted];
      var maxV = Math.max.apply(null, values);

      Object.keys(bars).forEach(function (k) {
        var row = bars[k];
        if (!row) return;
        var v = c[k];
        var pct = Math.max(0.5, (v / maxV) * 100);  // floor at 0.5% so tiny bars are visible
        var fill = row.querySelector('.att-bar-fill');
        var val = row.querySelector('.att-bar-value-num');
        if (fill) fill.style.width = pct.toFixed(2) + '%';
        if (val) val.textContent = fmtFlops(v);
      });
    }

    slider.addEventListener('input', update);
    update();
  }

  /* ── Boot ──────────────────────────────────────────────── */
  function boot() {
    buildHeatmap();
    buildSlider();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
