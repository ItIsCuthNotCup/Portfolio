/* ═══════════════════════════════════════════════════════════════════
   MODEL ATLAS — wizard state machine + 5 mini-visualizations.
   Depends on window.ModelAtlas (from model-decision-tree.js) for the
   catalog and scoring function.

   State lives in URL hash: #q1=classification&q2=small&q3=critical&...
   so paths are shareable and the browser back button works.

   Mini-vizes are pure inline-SVG. No charting library.
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';
  if (!window.ModelAtlas) return;
  const { MODELS, ANSWER_VALUES, recommend, reasonsFor } = window.ModelAtlas;

  // ── DOM refs (resolved on init) ────────────────────────────────────
  let container, stepsEl, recPanel, browseEl;
  let progressBar, progressLabel;
  let answers = {};   // { q1_task, q2_size, ... }

  const QUESTIONS = [
    {
      id: 'q1_task',
      n: 1,
      kicker: '§ I',
      title: 'What are you predicting?',
      help: 'The shape of your target determines the family of models. This is the only hard filter the wizard applies.',
      options: [
        { v: 'classification', label: 'A category', sub: 'spam vs. not, churn vs. retain' },
        { v: 'regression',     label: 'A number',   sub: 'house price, sales forecast' },
        { v: 'clustering',     label: 'Groups in unlabeled data', sub: 'customer segments, topic discovery' },
        { v: 'anomaly',        label: 'Anomalies', sub: 'fraud, defects, intrusions' },
      ],
      viz: drawTaskMorph,
    },
    {
      id: 'q2_size',
      n: 2,
      kicker: '§ II',
      title: 'How much data do you have?',
      help: 'Some models reward scale; others overfit on it. Sample size matters more than most teams admit.',
      options: [
        { v: 'tiny',  label: 'Tiny',  sub: 'fewer than 1,000 rows' },
        { v: 'small', label: 'Small', sub: '1,000 – 100,000 rows' },
        { v: 'big',   label: 'Big',   sub: '100,000 – 10 million' },
        { v: 'huge',  label: 'Huge',  sub: 'more than 10 million' },
      ],
      viz: drawSizeGrid,
    },
    {
      id: 'q3_interp',
      n: 3,
      kicker: '§ III',
      title: 'How much do you need to explain the model?',
      help: 'A regulator, a board, or a fairness audit will not accept "the network said so." A research notebook will.',
      options: [
        { v: 'critical',   label: 'Critical',   sub: 'regulated industry, audits, fairness' },
        { v: 'helpful',    label: 'Helpful',    sub: 'analyst sanity checks' },
        { v: 'dont-care',  label: 'Not a factor', sub: 'maximize accuracy alone' },
      ],
      viz: drawInterpCompare,
    },
    {
      id: 'q4_shape',
      n: 4,
      kicker: '§ IV',
      title: 'What does your data look like?',
      help: 'Different model families are designed for different data shapes. Mismatches mean preprocessing — or lower accuracy.',
      options: [
        { v: 'numerical',   label: 'Mostly numerical',   sub: 'heights, prices, counts' },
        { v: 'categorical', label: 'Mostly categorical', sub: 'codes, labels, IDs' },
        { v: 'text',        label: 'Text',               sub: 'reviews, tickets, prose' },
        { v: 'image',       label: 'Images',             sub: 'photos, diagrams, scans' },
        { v: 'time-series', label: 'Time series',        sub: 'daily metrics, sensor logs' },
        { v: 'mixed',       label: 'Mixed / messy',      sub: 'a real production table' },
      ],
      viz: drawShapeMatrix,
    },
    {
      id: 'q5_priority',
      n: 5,
      kicker: '§ V',
      title: 'What\'s your priority?',
      help: 'Every model trades off against three others. Pick the one that hurts most when missing.',
      options: [
        { v: 'inference', label: 'Inference speed', sub: 'real-time predictions' },
        { v: 'accuracy',  label: 'Accuracy',        sub: 'squeeze every point' },
        { v: 'training',  label: 'Training speed',  sub: 'iterate fast, retrain often' },
        { v: 'size',      label: 'Small model',     sub: 'edge or browser deployment' },
      ],
      viz: drawPriorityRadar,
    },
  ];

  /* ─────────────────────────────────────────────────────────────────
     URL HASH ↔ ANSWERS
     ───────────────────────────────────────────────────────────────── */
  function readHash() {
    const out = {};
    const h = window.location.hash.replace(/^#/, '');
    if (!h) return out;
    h.split('&').forEach(function (pair) {
      const [k, v] = pair.split('=');
      if (!k || !v) return;
      const decoded = decodeURIComponent(v);
      if (k === 'q1' && ANSWER_VALUES.q1_task.includes(decoded)) out.q1_task = decoded;
      else if (k === 'q2' && ANSWER_VALUES.q2_size.includes(decoded)) out.q2_size = decoded;
      else if (k === 'q3' && ANSWER_VALUES.q3_interp.includes(decoded)) out.q3_interp = decoded;
      else if (k === 'q4' && ANSWER_VALUES.q4_shape.includes(decoded)) out.q4_shape = decoded;
      else if (k === 'q5' && ANSWER_VALUES.q5_priority.includes(decoded)) out.q5_priority = decoded;
    });
    return out;
  }
  function writeHash() {
    const parts = [];
    if (answers.q1_task)     parts.push('q1=' + encodeURIComponent(answers.q1_task));
    if (answers.q2_size)     parts.push('q2=' + encodeURIComponent(answers.q2_size));
    if (answers.q3_interp)   parts.push('q3=' + encodeURIComponent(answers.q3_interp));
    if (answers.q4_shape)    parts.push('q4=' + encodeURIComponent(answers.q4_shape));
    if (answers.q5_priority) parts.push('q5=' + encodeURIComponent(answers.q5_priority));
    const newHash = parts.length ? '#' + parts.join('&') : '#';
    if (newHash !== window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search + newHash);
    }
  }

  /* ─────────────────────────────────────────────────────────────────
     RENDER
     ───────────────────────────────────────────────────────────────── */
  function render() {
    if (!stepsEl) return;
    stepsEl.innerHTML = '';
    QUESTIONS.forEach(function (q) {
      stepsEl.appendChild(renderQuestion(q));
    });
    renderRecommendation();
    renderProgress();
  }

  function renderQuestion(q) {
    const sec = document.createElement('section');
    sec.className = 'ma-q';
    sec.id = 'ma-' + q.id;

    const header = document.createElement('div');
    header.className = 'mono ma-q-kicker';
    header.innerHTML = '<span class="idx">' + q.kicker + '</span><span>Question ' + q.n + ' of 5</span>';
    sec.appendChild(header);

    const h2 = document.createElement('h2');
    h2.className = 'serif ma-q-title';
    h2.textContent = q.title;
    sec.appendChild(h2);

    const help = document.createElement('p');
    help.className = 'ma-q-help';
    help.textContent = q.help;
    sec.appendChild(help);

    // Mini-viz frame
    const vizWrap = document.createElement('figure');
    vizWrap.className = 'ma-viz';
    vizWrap.id = 'ma-viz-' + q.id;
    sec.appendChild(vizWrap);

    // Option list
    const opts = document.createElement('div');
    opts.className = 'ma-options';
    q.options.forEach(function (opt) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ma-opt';
      btn.dataset.value = opt.v;
      btn.dataset.qid = q.id;
      if (answers[q.id] === opt.v) btn.classList.add('is-selected');
      btn.innerHTML =
        '<span class="ma-opt-label serif">' + escapeHTML(opt.label) + '</span>' +
        '<span class="ma-opt-sub mono">' + escapeHTML(opt.sub) + '</span>';
      btn.addEventListener('click', function () {
        answers[q.id] = opt.v;
        writeHash();
        render();
        scrollNext(q.n);
      });
      btn.addEventListener('mouseenter', function () {
        if (q.viz) q.viz(vizWrap, opt.v, true);
      });
      btn.addEventListener('mouseleave', function () {
        if (q.viz) q.viz(vizWrap, answers[q.id] || null, false);
      });
      opts.appendChild(btn);
    });
    sec.appendChild(opts);

    // Initial viz render
    if (q.viz) q.viz(vizWrap, answers[q.id] || null, false);

    return sec;
  }

  function renderRecommendation() {
    if (!recPanel) return;
    const allAnswered = QUESTIONS.every(function (q) { return !!answers[q.id]; });
    if (!allAnswered) {
      recPanel.classList.remove('is-visible');
      recPanel.setAttribute('aria-hidden', 'true');
      recPanel.innerHTML = '';
      return;
    }
    const ranked = recommend(answers);
    if (ranked.length === 0) {
      recPanel.innerHTML =
        '<div class="ma-rec-empty mono">No model in the catalog matches every constraint. ' +
        'Loosen one of the filters and try again.</div>';
      recPanel.classList.add('is-visible');
      return;
    }
    const top = ranked[0];
    const alts = ranked.slice(1, 3);
    const reasons = reasonsFor(top.slug, answers);

    let html =
      '<div class="mono ma-rec-kicker"><span class="idx" style="color:var(--accent)">RECOMMENDATION</span></div>' +
      '<h2 class="serif ma-rec-title">' + escapeHTML(top.name) + '</h2>' +
      '<p class="ma-rec-kick serif-italic">' + escapeHTML(top.kicker) + '</p>' +
      '<p class="ma-rec-summary">' + escapeHTML(top.summary) + '</p>' +
      (reasons.length
        ? '<ul class="ma-rec-reasons">' +
          reasons.map(function (r) { return '<li>' + escapeHTML(r) + '</li>'; }).join('') +
          '</ul>'
        : '');

    if (top.live) {
      html += '<a class="ma-rec-cta" href="/work/' + top.slug + '-lab/">Open the live demo &rarr;</a>';
    } else {
      html += '<div class="ma-rec-cta is-stub mono">Live demo coming in a later phase. The destination page is the plan.</div>';
    }

    if (alts.length) {
      html +=
        '<div class="ma-rec-alts">' +
          '<div class="mono ma-rec-alts-head">Honest alternatives</div>' +
          alts.map(function (a) {
            const linkOpen = a.live ? '<a href="/work/' + a.slug + '-lab/">' : '<span>';
            const linkClose = a.live ? '</a>' : '</span>';
            return '<div class="ma-rec-alt">' +
              linkOpen +
                '<span class="serif ma-rec-alt-name">' + escapeHTML(a.name) + '</span>' +
              linkClose +
              ' <span class="mono ma-rec-alt-kick">' + escapeHTML(a.kicker) + '</span></div>';
          }).join('') +
        '</div>';
    }

    html +=
      '<div class="ma-rec-restart"><button type="button" id="ma-restart" class="ma-restart-btn mono">' +
      '&larr; Restart the wizard</button></div>';

    recPanel.innerHTML = html;
    recPanel.classList.add('is-visible');
    recPanel.setAttribute('aria-hidden', 'false');
    document.getElementById('ma-restart').addEventListener('click', function () {
      answers = {};
      writeHash();
      render();
      const top = container.querySelector('#ma-q1_task');
      if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function renderProgress() {
    if (!progressBar) return;
    const answered = QUESTIONS.filter(function (q) { return !!answers[q.id]; }).length;
    const pct = (answered / QUESTIONS.length) * 100;
    progressBar.style.width = pct + '%';
    if (progressLabel) {
      progressLabel.textContent = answered + ' of 5 answered';
    }
  }

  function scrollNext(currentN) {
    if (currentN >= QUESTIONS.length) {
      // All done — jump to the recommendation panel.
      const rec = document.getElementById('ma-recommendation');
      if (rec) rec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const nextQ = QUESTIONS[currentN]; // currentN is 1-based, array is 0-based; this is "the next one"
    const target = document.getElementById('ma-' + nextQ.id);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ─────────────────────────────────────────────────────────────────
     BROWSE-ALL MODE
     ───────────────────────────────────────────────────────────────── */
  function renderBrowse() {
    if (!browseEl) return;
    let html = '<div class="ma-browse-grid">';
    Object.values(MODELS).forEach(function (m) {
      const linkOpen = m.live ? '<a class="ma-browse-card" href="/work/' + m.slug + '-lab/">' : '<div class="ma-browse-card is-stub">';
      const linkClose = m.live ? '</a>' : '</div>';
      const status = m.live ? '<span class="mono ma-browse-status is-live">Live</span>'
                            : '<span class="mono ma-browse-status">Phase 2/3</span>';
      html += linkOpen +
        status +
        '<h3 class="serif ma-browse-name">' + escapeHTML(m.name) + '</h3>' +
        '<p class="serif-italic ma-browse-kick">' + escapeHTML(m.kicker) + '</p>' +
        '<p class="ma-browse-summary">' + escapeHTML(m.summary) + '</p>' +
        '<div class="mono ma-browse-tags">' +
          (m.task || []).map(function (t) { return '<span>' + escapeHTML(t) + '</span>'; }).join('') +
        '</div>' +
      linkClose;
    });
    html += '</div>';
    browseEl.innerHTML = html;
  }

  /* ─────────────────────────────────────────────────────────────────
     MINI-VISUALIZATIONS
     Each accepts (mountEl, hoveredOption, isHover). When isHover is
     false, render the resting state (selected option or default).
     All hand-rolled inline SVG, no external deps.
     ───────────────────────────────────────────────────────────────── */

  // Q1: same scatter morphs based on the hovered/selected task.
  function drawTaskMorph(mount, mode, isHover) {
    const W = 480, H = 240;
    // Deterministic point set — looks the same on every render.
    const pts = [];
    let seed = 7;
    function rng() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    for (let i = 0; i < 60; i++) {
      pts.push({ x: rng(), y: rng() });
    }
    const fill = mode || 'classification';
    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" class="ma-svg">';

    if (fill === 'classification') {
      // Color by a diagonal threshold; draw a boundary line.
      pts.forEach(function (p) {
        const cls = (p.x + p.y) > 1.0 ? 'A' : 'B';
        const cx = 30 + p.x * (W - 60);
        const cy = 20 + p.y * (H - 40);
        const color = cls === 'A' ? 'var(--accent)' : 'var(--ink)';
        svg += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="3.4" fill="' + color + '" opacity="0.85"/>';
      });
      svg += '<line x1="' + (30 + 0.0 * (W - 60)).toFixed(1) + '" y1="' + (20 + 1.0 * (H - 40)).toFixed(1) +
                  '" x2="' + (30 + 1.0 * (W - 60)).toFixed(1) + '" y2="' + (20 + 0.0 * (H - 40)).toFixed(1) +
                  '" stroke="var(--ink)" stroke-width="1.2" stroke-dasharray="3 3" opacity="0.7"/>';
    } else if (fill === 'regression') {
      pts.forEach(function (p) {
        // Regression: y = 0.6x + 0.2 + noise
        const y = 0.6 * p.x + 0.2 + (p.y - 0.5) * 0.25;
        const cx = 30 + p.x * (W - 60);
        const cy = 20 + Math.max(0, Math.min(1, y)) * (H - 40);
        svg += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="3.4" fill="var(--ink)" opacity="0.7"/>';
      });
      svg += '<line x1="30" y1="' + (20 + 0.2 * (H - 40)).toFixed(1) +
                  '" x2="' + (W - 30) + '" y2="' + (20 + 0.8 * (H - 40)).toFixed(1) +
                  '" stroke="var(--accent)" stroke-width="2"/>';
    } else if (fill === 'clustering') {
      const centers = [{cx: 0.25, cy: 0.30}, {cx: 0.70, cy: 0.40}, {cx: 0.45, cy: 0.78}];
      pts.forEach(function (p) {
        // Assign to nearest center
        let best = 0, bestD = Infinity;
        centers.forEach(function (c, i) {
          const d = (p.x - c.cx) * (p.x - c.cx) + (p.y - c.cy) * (p.y - c.cy);
          if (d < bestD) { bestD = d; best = i; }
        });
        const colors = ['var(--accent)', 'var(--ink)', 'var(--ink-soft)'];
        const cx = 30 + p.x * (W - 60);
        const cy = 20 + p.y * (H - 40);
        svg += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="3.4" fill="' + colors[best] + '" opacity="0.85"/>';
      });
      // centroids as accent-ringed dots
      centers.forEach(function (c) {
        const cx = 30 + c.cx * (W - 60);
        const cy = 20 + c.cy * (H - 40);
        svg += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) +
               '" r="6" fill="none" stroke="var(--accent)" stroke-width="1.5"/>';
      });
    } else if (fill === 'anomaly') {
      pts.forEach(function (p, i) {
        const cx = 30 + p.x * (W - 60);
        const cy = 20 + p.y * (H - 40);
        // top-right and bottom-left synthetic outliers stand out
        const isOutlier = (p.x > 0.85 && p.y < 0.18) || (p.x < 0.10 && p.y > 0.85) || i === 11;
        const fillC = isOutlier ? 'var(--accent)' : 'var(--ink-dim)';
        const r = isOutlier ? 5 : 3;
        const op = isOutlier ? 1 : 0.45;
        svg += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + r + '" fill="' + fillC + '" opacity="' + op + '"/>';
      });
    }
    svg += '</svg>';
    mount.innerHTML = svg;
  }

  // Q2: four-panel small-multiples of the SAME model trained at four sample sizes.
  function drawSizeGrid(mount, mode, isHover) {
    const labels = [
      { v: 'tiny',  label: 'n = 50',     wobble: 0.30 },
      { v: 'small', label: 'n = 5,000',   wobble: 0.10 },
      { v: 'big',   label: 'n = 500,000', wobble: 0.02 },
      { v: 'huge',  label: 'n = 50M',     wobble: 0.005 },
    ];
    let svg = '<svg viewBox="0 0 480 240" xmlns="http://www.w3.org/2000/svg" class="ma-svg">';
    labels.forEach(function (cfg, i) {
      const ox = (i % 2) * 240;
      const oy = Math.floor(i / 2) * 120;
      const isActive = mode === cfg.v;
      // Panel frame
      svg += '<rect x="' + (ox + 6) + '" y="' + (oy + 6) + '" width="228" height="108" ' +
             'fill="' + (isActive ? 'color-mix(in oklab, var(--accent) 8%, transparent)' : 'transparent') + '" ' +
             'stroke="' + (isActive ? 'var(--accent)' : 'var(--ink-dim)') + '" stroke-width="' + (isActive ? 1.5 : 0.6) + '"/>';
      // Decision boundary (sin-shaped, wobble proportional to dataset size)
      let path = 'M ' + (ox + 14) + ' ';
      const w = cfg.wobble;
      for (let x = 0; x <= 220; x += 8) {
        const t = x / 220;
        const y = oy + 60 + (w * 80) * Math.sin(t * 8 + cfg.v.charCodeAt(0)) + (t - 0.5) * 30;
        path += (x === 0 ? '' : 'L ') + (ox + 14 + x) + ' ' + y.toFixed(1) + ' ';
      }
      svg += '<path d="' + path + '" fill="none" stroke="' + (isActive ? 'var(--accent)' : 'var(--ink)') +
             '" stroke-width="1.4" opacity="' + (isActive ? 1 : 0.6) + '"/>';
      // Label
      svg += '<text x="' + (ox + 14) + '" y="' + (oy + 22) + '" font-family="DM Mono,monospace" font-size="10" ' +
             'letter-spacing="0.1em" fill="var(--ink-dim)">' + cfg.label + '</text>';
    });
    svg += '</svg>';
    mount.innerHTML = svg;
  }

  // Q3: side-by-side coefficient table vs opaque weight matrix.
  function drawInterpCompare(mount, mode, isHover) {
    let svg = '<svg viewBox="0 0 480 240" xmlns="http://www.w3.org/2000/svg" class="ma-svg">';
    // LEFT: glass-box (logistic regression coefficients)
    svg += '<text x="14" y="22" font-family="DM Mono,monospace" font-size="10" letter-spacing="0.1em" fill="var(--ink-dim)">GLASS BOX · LOGISTIC</text>';
    const coefs = [
      { name: 'tenure',     w: 1.24 },
      { name: 'is_active',  w: -0.83 },
      { name: 'monthly',    w: 0.41 },
      { name: 'support',    w: 0.18 },
      { name: 'bias',       w: -0.06 },
    ];
    coefs.forEach(function (c, i) {
      const y = 50 + i * 26;
      svg += '<text x="14" y="' + y + '" font-family="DM Mono,monospace" font-size="11" fill="var(--ink)">' + c.name + '</text>';
      const barX = 110;
      const barW = Math.abs(c.w) * 50;
      const barColor = c.w > 0 ? 'var(--accent)' : 'var(--ink)';
      svg += '<rect x="' + (c.w > 0 ? barX : barX - barW) + '" y="' + (y - 9) + '" width="' + barW + '" height="10" ' +
             'fill="' + barColor + '" opacity="' + (c.w > 0 ? 0.7 : 0.45) + '"/>';
      svg += '<text x="200" y="' + y + '" font-family="DM Mono,monospace" font-size="10" fill="var(--ink-dim)" text-anchor="end">' +
             (c.w > 0 ? '+' : '') + c.w.toFixed(2) + '</text>';
    });
    // Vertical separator
    svg += '<line x1="240" y1="14" x2="240" y2="226" stroke="var(--ink-dim)" stroke-width="0.5" stroke-dasharray="2 3"/>';
    // RIGHT: black-box (MLP weight heatmap, 8x8)
    svg += '<text x="254" y="22" font-family="DM Mono,monospace" font-size="10" letter-spacing="0.1em" fill="var(--ink-dim)">BLACK BOX · MLP WEIGHTS</text>';
    let s = 13;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        const v = ((s % 1000) / 1000) * 2 - 1;
        const cx = 256 + j * 24;
        const cy = 38 + i * 24;
        const intensity = Math.abs(v);
        const isPositive = v > 0;
        const color = isPositive ? 'var(--accent)' : 'var(--ink)';
        svg += '<rect x="' + cx + '" y="' + cy + '" width="22" height="22" fill="' + color +
               '" opacity="' + (intensity * 0.7).toFixed(2) + '"/>';
      }
    }
    // Caption equating accuracy
    svg += '<text x="240" y="232" font-family="DM Mono,monospace" font-size="9" fill="var(--ink-dim)" text-anchor="middle">Both models score 0.87 AUC. Only one is auditable.</text>';
    svg += '</svg>';
    mount.innerHTML = svg;
  }

  // Q4: 6-shape × 5-family fit matrix.
  function drawShapeMatrix(mount, mode, isHover) {
    const shapes = ['numerical', 'categorical', 'text', 'image', 'time-series', 'mixed'];
    const families = [
      { key: 'linear',  label: 'Linear / Logistic' },
      { key: 'tree',    label: 'Tree / Forest' },
      { key: 'distance',label: 'KNN / SVM' },
      { key: 'bayes',   label: 'Naive Bayes' },
      { key: 'neural',  label: 'Neural Net' },
    ];
    // Fit matrix: 2 = strong, 1 = workable with prep, 0 = poor.
    const FIT = {
      linear:   { numerical: 2, categorical: 1, text: 1, image: 0, 'time-series': 1, mixed: 1 },
      tree:     { numerical: 2, categorical: 2, text: 0, image: 0, 'time-series': 1, mixed: 2 },
      distance: { numerical: 2, categorical: 1, text: 1, image: 1, 'time-series': 1, mixed: 1 },
      bayes:    { numerical: 1, categorical: 2, text: 2, image: 0, 'time-series': 0, mixed: 1 },
      neural:   { numerical: 2, categorical: 1, text: 2, image: 2, 'time-series': 2, mixed: 1 },
    };
    const cellW = 60, cellH = 30, padL = 130, padT = 30;
    const W = padL + shapes.length * cellW + 10;
    const H = padT + families.length * cellH + 10;
    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" class="ma-svg">';
    // Column headers (rotated 30°)
    shapes.forEach(function (s, j) {
      const x = padL + j * cellW + cellW / 2;
      const isActive = mode === s;
      svg += '<text x="' + x + '" y="' + (padT - 8) + '" font-family="DM Mono,monospace" font-size="10" ' +
             'fill="' + (isActive ? 'var(--accent)' : 'var(--ink)') + '" text-anchor="middle" ' +
             'transform="rotate(-25 ' + x + ' ' + (padT - 8) + ')">' + s + '</text>';
    });
    // Row headers + cells
    families.forEach(function (fam, i) {
      svg += '<text x="' + (padL - 10) + '" y="' + (padT + i * cellH + cellH / 2 + 4) + '" ' +
             'font-family="DM Mono,monospace" font-size="11" fill="var(--ink)" text-anchor="end">' + fam.label + '</text>';
      shapes.forEach(function (s, j) {
        const score = FIT[fam.key][s];
        const isActive = mode === s;
        const x = padL + j * cellW;
        const y = padT + i * cellH;
        const fill = score === 2
          ? 'color-mix(in oklab, var(--accent) 55%, transparent)'
          : score === 1
            ? 'color-mix(in oklab, var(--accent) 22%, transparent)'
            : 'transparent';
        svg += '<rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="' + (cellW - 4) + '" height="' + (cellH - 4) + '" ' +
               'fill="' + fill + '" stroke="' + (isActive ? 'var(--accent)' : 'var(--ink-dim)') + '" ' +
               'stroke-width="' + (isActive ? 1.4 : 0.4) + '"/>';
        const symbol = score === 2 ? '●' : score === 1 ? '○' : '·';
        svg += '<text x="' + (x + cellW / 2) + '" y="' + (y + cellH / 2 + 5) + '" ' +
               'font-family="DM Mono,monospace" font-size="14" fill="var(--ink)" text-anchor="middle" opacity="0.7">' + symbol + '</text>';
      });
    });
    svg += '</svg>';
    mount.innerHTML = svg;
  }

  // Q5: radar chart of remaining candidates on 4 axes (inference / accuracy / training / size).
  function drawPriorityRadar(mount, mode, isHover) {
    const cx = 240, cy = 130, R = 90;
    const axes = [
      { key: 'inference', label: 'Inference',  angle: -Math.PI / 2 },
      { key: 'accuracy',  label: 'Accuracy',   angle: 0 },
      { key: 'training',  label: 'Training',   angle: Math.PI / 2 },
      { key: 'size',      label: 'Small size', angle: Math.PI },
    ];
    // Filter candidates by what's been answered so far (Q1 hard-filter at minimum).
    let candidates = [];
    if (answers.q1_task) {
      candidates = recommend(answers).slice(0, 4);
    }
    if (candidates.length === 0) {
      // Default sample so the viz isn't blank
      candidates = [
        { slug: 'logistic-regression', name: 'Logistic Regression' },
        { slug: 'decision-tree', name: 'Decision Tree' },
        { slug: 'random-forest', name: 'Random Forest' },
      ];
    }
    // Heuristic profiles for radar (not ground truth — directional only)
    const PROFILE = {
      'logistic-regression': { inference: 0.95, accuracy: 0.65, training: 0.95, size: 0.95 },
      'linear-regression':   { inference: 0.95, accuracy: 0.60, training: 0.95, size: 0.95 },
      'decision-tree':       { inference: 0.85, accuracy: 0.70, training: 0.85, size: 0.80 },
      'random-forest':       { inference: 0.55, accuracy: 0.85, training: 0.55, size: 0.30 },
      'kmeans':              { inference: 0.85, accuracy: 0.55, training: 0.80, size: 0.85 },
      'knn':                 { inference: 0.30, accuracy: 0.65, training: 1.00, size: 0.20 },
      'svm':                 { inference: 0.65, accuracy: 0.80, training: 0.55, size: 0.70 },
      'gradient-boosting':   { inference: 0.55, accuracy: 0.90, training: 0.45, size: 0.40 },
      'naive-bayes':         { inference: 0.95, accuracy: 0.60, training: 0.95, size: 0.95 },
      'ridge-lasso':         { inference: 0.95, accuracy: 0.65, training: 0.90, size: 0.95 },
      'mlp':                 { inference: 0.50, accuracy: 0.85, training: 0.30, size: 0.40 },
      'dbscan':              { inference: 0.60, accuracy: 0.70, training: 0.65, size: 0.80 },
      'isolation-forest':    { inference: 0.70, accuracy: 0.75, training: 0.65, size: 0.65 },
    };
    let svg = '<svg viewBox="0 0 480 240" xmlns="http://www.w3.org/2000/svg" class="ma-svg">';
    // Concentric guides
    [0.33, 0.66, 1].forEach(function (r) {
      const path = axes.map(function (ax) {
        const x = cx + Math.cos(ax.angle) * R * r;
        const y = cy + Math.sin(ax.angle) * R * r;
        return x.toFixed(1) + ',' + y.toFixed(1);
      }).join(' ');
      svg += '<polygon points="' + path + '" fill="none" stroke="var(--ink-dim)" stroke-width="0.5" opacity="0.4"/>';
    });
    // Axis lines + labels
    axes.forEach(function (ax) {
      const x = cx + Math.cos(ax.angle) * R;
      const y = cy + Math.sin(ax.angle) * R;
      const isActive = mode === ax.key;
      svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x + '" y2="' + y + '" ' +
             'stroke="' + (isActive ? 'var(--accent)' : 'var(--ink-dim)') + '" stroke-width="' + (isActive ? 1.4 : 0.5) + '"/>';
      const lx = cx + Math.cos(ax.angle) * (R + 18);
      const ly = cy + Math.sin(ax.angle) * (R + 18) + 4;
      svg += '<text x="' + lx + '" y="' + ly + '" font-family="DM Mono,monospace" font-size="10" ' +
             'fill="' + (isActive ? 'var(--accent)' : 'var(--ink-dim)') + '" letter-spacing="0.1em" text-anchor="middle">' + ax.label + '</text>';
    });
    // Each candidate's polygon
    const colors = ['var(--accent)', 'var(--ink)', 'var(--ink-soft)', 'var(--ink-dim)'];
    candidates.forEach(function (c, idx) {
      const profile = PROFILE[c.slug] || { inference: 0.5, accuracy: 0.5, training: 0.5, size: 0.5 };
      const path = axes.map(function (ax) {
        const v = profile[ax.key];
        const x = cx + Math.cos(ax.angle) * R * v;
        const y = cy + Math.sin(ax.angle) * R * v;
        return x.toFixed(1) + ',' + y.toFixed(1);
      }).join(' ');
      const color = colors[idx] || 'var(--ink-dim)';
      svg += '<polygon points="' + path + '" fill="' + color + '" fill-opacity="0.10" ' +
             'stroke="' + color + '" stroke-width="1.4"/>';
      // Legend
      svg += '<rect x="350" y="' + (40 + idx * 22) + '" width="10" height="10" fill="' + color + '" opacity="0.7"/>';
      svg += '<text x="366" y="' + (49 + idx * 22) + '" font-family="DM Mono,monospace" font-size="10" fill="var(--ink)">' +
             escapeHTML(c.name) + '</text>';
    });
    svg += '</svg>';
    mount.innerHTML = svg;
  }

  /* ─────────────────────────────────────────────────────────────────
     UTILITIES
     ───────────────────────────────────────────────────────────────── */
  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ─────────────────────────────────────────────────────────────────
     INIT
     ───────────────────────────────────────────────────────────────── */
  function init() {
    container = document.getElementById('ma-wizard');
    stepsEl = document.getElementById('ma-steps');
    recPanel = document.getElementById('ma-recommendation');
    browseEl = document.getElementById('ma-browse');
    progressBar = document.getElementById('ma-progress-bar');
    progressLabel = document.getElementById('ma-progress-label');
    if (!stepsEl) return;

    answers = readHash();
    render();
    if (browseEl) renderBrowse();

    window.addEventListener('hashchange', function () {
      const next = readHash();
      // Only re-render if the values actually differ from internal state.
      let same = true;
      Object.keys(ANSWER_VALUES).forEach(function (k) {
        if (answers[k] !== next[k]) same = false;
      });
      if (!same) {
        answers = next;
        render();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
