/* ═══════════════════════════════════════════════════════════
   LEWORLDMODEL LAB — TEST. 08
   Three jobs:
   - Set the dateline.
   - Power the SIGReg slider (§ II): drag lambda, watch a 2D
     embedding cloud morph from collapsed to isotropic Gaussian.
   - Power the token-economy isotype (§ III): pick a model, see
     how many tokens it spends per frame, side-by-side with cost.
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

  /* ── § II · SIGReg slider ──────────────────────────────── */
  // Two canvases, side by side:
  //   left  = 2D scatter of the embedding cloud
  //   right = histogram of one random 1-D projection (the Cramér-Wold lens)
  // Slider t in [0, 1] interpolates between three regimes:
  //   t = 0   : collapsed (all points near origin)
  //   t = 0.5 : noisy / partially regularized
  //   t = 1   : isotropic Gaussian N(0, I_2)
  var SIG_N = 280;  // sample size

  function gaussian() {
    // Box-Muller pair, return one sample
    var u1 = 1 - Math.random();
    var u2 = 1 - Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  function sampleEmbeddings(n, t) {
    // t = 0 → collapsed (Gaussian with tiny variance)
    // t = 1 → isotropic Gaussian N(0, 1)
    // Between: anisotropic stretch that smoothly opens.
    // Standard deviation along the major axis grows with t; minor axis grows slower.
    var sigmaMajor = 0.04 + 0.96 * t;             // 0.04 → 1.0
    var sigmaMinor = 0.04 + 0.96 * t * t;          // squashed at low t
    var pts = new Array(n);
    for (var i = 0; i < n; i++) {
      pts[i] = [gaussian() * sigmaMajor, gaussian() * sigmaMinor];
    }
    return pts;
  }

  function drawScatter(ctx, pts, w, h, accent) {
    ctx.clearRect(0, 0, w, h);
    // Light reference circle at radius 2 sigma (for the t=1 target)
    ctx.strokeStyle = 'rgba(120,120,120,0.20)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.32, 0, Math.PI * 2);
    ctx.stroke();
    // Crosshairs
    ctx.strokeStyle = 'rgba(120,120,120,0.18)';
    ctx.beginPath();
    ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
    ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
    ctx.stroke();

    // Render dots
    var scale = Math.min(w, h) * 0.32;
    var cx = w / 2, cy = h / 2;
    ctx.fillStyle = accent;
    for (var i = 0; i < pts.length; i++) {
      var x = cx + pts[i][0] * scale;
      var y = cy + pts[i][1] * scale;
      ctx.beginPath();
      ctx.arc(x, y, 2.0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHistogram(ctx, pts, w, h, accent) {
    ctx.clearRect(0, 0, w, h);
    // Project onto a unit vector (just take x-axis: u = (1, 0))
    var BINS = 28;
    var counts = new Array(BINS).fill(0);
    var range = 3.0;
    for (var i = 0; i < pts.length; i++) {
      var v = pts[i][0];  // 1-D projection onto u=(1,0)
      var bin = Math.floor((v + range) / (2 * range) * BINS);
      if (bin >= 0 && bin < BINS) counts[bin]++;
    }
    var maxC = Math.max.apply(null, counts);
    // Reference Gaussian curve (target N(0, 1))
    var pad = 18;
    var iw = w - pad * 2;
    var ih = h - pad * 2 - 18;
    var baseY = pad + ih;
    ctx.strokeStyle = 'rgba(120,120,120,0.45)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    var refMax = 1 / Math.sqrt(2 * Math.PI);
    for (var px = 0; px <= iw; px++) {
      var x = (px / iw) * 2 * range - range;
      var phi = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
      var y = baseY - (phi / refMax) * ih;
      if (px === 0) ctx.moveTo(pad + px, y);
      else ctx.lineTo(pad + px, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // Histogram bars
    ctx.fillStyle = accent;
    var bw = iw / BINS;
    for (var b = 0; b < BINS; b++) {
      var barH = (counts[b] / Math.max(1, maxC)) * ih;
      ctx.fillRect(pad + b * bw + 1, baseY - barH, bw - 2, barH);
    }
    // Baseline
    ctx.strokeStyle = 'rgba(60,60,60,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, baseY); ctx.lineTo(w - pad, baseY);
    ctx.stroke();
    // Caption
    ctx.fillStyle = 'rgba(60,60,60,0.6)';
    ctx.font = '10px "DM Mono", ui-monospace, monospace';
    ctx.fillText("u·z, target = N(0,1) (dashed)", pad, h - 6);
  }

  function buildSigReg() {
    var slider = document.getElementById('lwm-sigreg-slider');
    var lambda = document.getElementById('lwm-sigreg-lambda');
    var state = document.getElementById('lwm-sigreg-state');
    var note = document.getElementById('lwm-sigreg-note');
    var c2 = document.getElementById('lwm-sigreg-scatter');
    var ch = document.getElementById('lwm-sigreg-hist');
    if (!slider || !c2 || !ch) return;

    // Resize canvases for crisp rendering
    function resize(c) {
      var rect = c.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var W = Math.max(rect.width, 240);
      var H = Math.max(rect.height || 240, 240);
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      c.style.width = W + 'px';
      c.style.height = H + 'px';
      var ctx = c.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { ctx: ctx, w: W, h: H };
    }

    function getAccent() {
      var s = getComputedStyle(document.body).getPropertyValue('--accent');
      return s.trim() || '#c84b3c';
    }

    // Cache one sample per t value bucket so the cloud doesn't reshuffle on every drag tick
    var cache = {};
    function pointsAt(t) {
      var key = Math.round(t * 50) / 50;  // bucket to 51 levels
      if (!cache[key]) cache[key] = sampleEmbeddings(SIG_N, key);
      return cache[key];
    }

    var d2 = resize(c2);
    var dh = resize(ch);

    function update() {
      var raw = parseInt(slider.value, 10) / 100;          // 0..1
      var t = raw;                                          // identity mapping
      var lam = (raw * raw * 0.10).toFixed(3);              // visual: lambda in [0, 0.1]

      var pts = pointsAt(t);
      var accent = getAccent();
      drawScatter(d2.ctx, pts, d2.w, d2.h, accent);
      drawHistogram(dh.ctx, pts, dh.w, dh.h, accent);

      lambda.textContent = String(lam);
      var label, story;
      if (t < 0.15) {
        label = 'Collapsed';
        story = 'No SIGReg pressure. The encoder maps everything to a single point. The 1-D projection is a delta spike. The L2 prediction loss is happily satisfied because every prediction equals the constant target.';
      } else if (t < 0.5) {
        label = 'Anisotropic';
        story = 'SIGReg is starting to push back. The cloud opens along its strongest direction first. The histogram has a shape but is far from Gaussian.';
      } else if (t < 0.85) {
        label = 'Approaching N(0, I)';
        story = 'The cloud now opens in every direction. Every random 1-D projection looks closer to a Gaussian. The Epps-Pulley statistic is dropping fast.';
      } else {
        label = 'Isotropic Gaussian';
        story = 'At full SIGReg pressure, every random 1-D slice <span>matches N(0, 1)</span>. By the Cramér-Wold theorem, that is sufficient for the joint distribution to be N(0, I).';
      }
      state.textContent = label;
      note.innerHTML = story;
    }

    slider.addEventListener('input', update);
    window.addEventListener('resize', function () {
      d2 = resize(c2);
      dh = resize(ch);
      update();
    });
    update();
  }

  /* ── § III · Token-economy isotype ─────────────────────── */
  // Each model = a target dot count per frame.
  // We render up to MAX_DOTS dots; above that, switch to an "overflow"
  // density-pattern card with an annotation.
  var MAX_DOTS = 600;
  var MODELS = {
    'lewm': {
      label: 'LeWM',
      tokens: 1,
      params: '~15M',
      planTime: '~1 s',
      goodAt: 'cheap pixel-to-action planning',
      pred: 'next 192-d CLS token',
      blurb: 'A single 192-dim CLS token per frame. Plans live in a tiny abstract cloud.',
      styleAsLwm: true
    },
    'dino-wm': {
      label: 'DINO-WM',
      tokens: 196,
      params: '~85M (frozen DINOv2)',
      planTime: '~47 s',
      goodAt: 'visually rich planning',
      pred: 'future DINOv2 patch features',
      blurb: 'Fourteen-by-fourteen patch grid per frame. Foundation-model encoder is frozen.'
    },
    'vjepa2': {
      label: 'V-JEPA 2',
      tokens: 256,
      params: '1B+',
      planTime: '~16 s',
      goodAt: 'foundation video understanding',
      pred: 'masked spatio-temporal embeddings',
      blurb: 'Foundation-model version of the JEPA idea. EMA target encoder.'
    },
    'genie3': {
      label: 'Genie 3',
      tokens: 4096,
      params: 'undisclosed',
      planTime: '24 fps real-time',
      goodAt: 'interactive 3D world generation',
      pred: 'next pixel frame',
      blurb: 'Generates navigable worlds at 720p. It dreams pixels.'
    },
    'sora': {
      label: 'Sora',
      tokens: 28800,
      params: 'undisclosed',
      planTime: 'minutes per minute',
      goodAt: 'photoreal video generation',
      pred: 'spacetime diffusion patches',
      blurb: 'Latent diffusion in video VAE space. Tens of thousands of tokens per clip.'
    }
  };

  function buildTokens() {
    var tabs = document.getElementById('lwm-tokens-tabs');
    var dots = document.getElementById('lwm-tokens-dots');
    var info = document.getElementById('lwm-tokens-info');
    if (!tabs || !dots || !info) return;

    function render(key) {
      var m = MODELS[key];
      Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) {
        b.classList.toggle('is-active', b.dataset.model === key);
      });

      // Dots
      dots.innerHTML = '';
      dots.classList.remove('is-overflow');
      if (m.tokens > MAX_DOTS) {
        dots.classList.add('is-overflow');
      } else {
        var n = m.tokens;
        for (var i = 0; i < n; i++) {
          var d = document.createElement('span');
          d.className = 'dot' + (m.styleAsLwm ? ' lwm' : '');
          dots.appendChild(d);
        }
      }

      // Info card
      info.innerHTML = (
        '<dl>' +
          '<dt>Model</dt><dd>' + m.label + '</dd>' +
          '<dt>Tokens / frame</dt><dd>' + m.tokens.toLocaleString() + '</dd>' +
          '<dt>Parameters</dt><dd>' + m.params + '</dd>' +
          '<dt>Predicts</dt><dd>' + m.pred + '</dd>' +
          '<dt>Plan / step</dt><dd>' + m.planTime + '</dd>' +
          '<dt>Good at</dt><dd>' + m.goodAt + '</dd>' +
        '</dl>' +
        '<div class="summary">' + m.blurb + ' <span>' +
          (m.tokens === 1 ? 'One token. One arrow through a 192-dim cloud.' :
           m.tokens > MAX_DOTS ? 'That is more tokens than this card can render.' :
           m.tokens.toLocaleString() + ' dots, one per token. LeWM uses ' +
           Math.round(m.tokens / 1).toLocaleString() + 'x fewer.') +
        '</span></div>'
      );
    }

    Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () { render(b.dataset.model); });
    });

    render('lewm');
  }

  /* ── Boot ──────────────────────────────────────────────── */
  function boot() {
    buildSigReg();
    buildTokens();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
