/* ═══════════════════════════════════════════════════════════
   AGI FORECAST LAB (FIG. 11) — vanilla SVG, no library.
   Renders eight figures off /assets/data/agi-forecast/predictions-v5.json.
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const DATA_URL = '/assets/data/agi-forecast/predictions-v5.json?v=1';

  /* Camp → CSS class (for color) */
  const CAMP_CLASS = {
    'frontier-lab': 'af-camp-frontier',
    'academic': 'af-camp-academic',
    'tech-exec': 'af-camp-tech',
    'public-intellectual': 'af-camp-public',
    'survey-aggregate': 'af-camp-survey',
  };

  /* Narrative breadcrumbs — keyed by year, fired as the playhead crosses */
  const NARRATIVE = {
    1950: 'Turing publishes "Computing Machinery and Intelligence." A fifty-year wager begins.',
    1965: 'Simon: "Within twenty years, machines will be capable of doing any work a man can do."',
    1970: 'Minsky tells Life Magazine: "three to eight years."',
    1988: 'Moravec\'s Paradox: hard things are easy, easy things are hard.',
    1993: 'Vinge coins the Singularity. Surprised if it happens before 2005 or after 2030.',
    1999: 'Kurzweil draws a line at 2029. He has not moved it.',
    2014: 'Bostrom\'s Superintelligence frames the alignment problem.',
    2017: 'Asilomar. The expert median for AGI sits around 2055.',
    2022: 'GPT-3.5 ships. The medians collapse.',
    2023: 'ESPAI 2023: median for HLMI moves from 2059 to 2047 in a single year.',
    2025: 'Altman, Hassabis, Amodei converge on 2027–2030.',
  };

  /* ── Utility ────────────────────────────────────────────── */
  const el = (tag, attrs = {}, text = null) => {
    const e = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  /* ── State ──────────────────────────────────────────────── */
  let DATA = null;
  let HORIZON_VISIBLE = true;
  let ACTIVE_CAMPS = new Set(['all']);
  let PLAYHEAD_YEAR = 2026;  // start at end (full state)
  let IS_PLAYING = false;
  let PLAY_RAF = null;
  let PLAY_START_TIME = 0;
  const PLAY_DURATION_MS = 14000;
  const PLAY_FROM = 1950;
  const PLAY_TO = 2026;

  /* Zoom levels for the Horizon — fix #1 */
  const ZOOM_LEVELS = {
    all:    { xMin: 1950, xMax: 2030, tickStep: 10, label: 'All (1950–2030)' },
    modern: { xMin: 2000, xMax: 2030, tickStep: 5,  label: 'Modern (2000+)' },
    recent: { xMin: 2018, xMax: 2030, tickStep: 2,  label: 'Recent (2018+)' },
  };
  let ZOOM_KEY = 'all';

  /* Deterministic hash for jitter — fix #2 */
  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }
  function lifJitter(r) {
    // Spread duplicates ±3px horizontally, deterministic per row
    const seed = `${r.person}${r.year_mid}${r.year_said}`;
    return (hashStr(seed) % 7 - 3) * 1.6;
  }

  /* ── Data load ──────────────────────────────────────────── */
  async function loadData() {
    try {
      const res = await fetch(DATA_URL);
      DATA = await res.json();
      return DATA;
    } catch (err) {
      console.error('AGI lab: failed to load data', err);
      DATA = { meta: {}, rows: [] };
      return DATA;
    }
  }

  /* Filter to "agi_year" rows that are plottable on the main chart.
     Excludes task milestones, framework rows, definitional rejections. */
  function plottableAGIYearRows() {
    return DATA.rows.filter(r =>
      r.prediction_type === 'agi_year' &&
      r.year_said &&
      r.year_mid &&
      r.year_said >= 1950 &&
      r.year_said <= 2030
    );
  }

  /* ═══════════════════════════════════════════════════════
     FIG. 11.1 — THE HORIZON
     ═══════════════════════════════════════════════════════ */

  const HORIZON_VB = { w: 1280, h: 540 };
  const HORIZON_PAD = { l: 70, r: 30, t: 30, b: 60 };
  const Y_MIN = 1950, Y_MAX = 2100;

  function currentZoom() { return ZOOM_LEVELS[ZOOM_KEY]; }

  function xScale(year) {
    const z = currentZoom();
    const w = HORIZON_VB.w - HORIZON_PAD.l - HORIZON_PAD.r;
    return HORIZON_PAD.l + ((year - z.xMin) / (z.xMax - z.xMin)) * w;
  }
  function yScale(year) {
    const h = HORIZON_VB.h - HORIZON_PAD.t - HORIZON_PAD.b;
    const clipped = clamp(year, Y_MIN, Y_MAX);
    return HORIZON_PAD.t + h - ((clipped - Y_MIN) / (Y_MAX - Y_MIN)) * h;
  }

  function renderHorizon() {
    const svg = document.getElementById('af-horizon');
    svg.innerHTML = '';

    const z = currentZoom();
    const innerW = HORIZON_VB.w - HORIZON_PAD.l - HORIZON_PAD.r;
    const innerH = HORIZON_VB.h - HORIZON_PAD.t - HORIZON_PAD.b;

    /* Decade gridlines (Y) */
    for (let y = 1950; y <= 2100; y += 10) {
      const py = yScale(y);
      svg.appendChild(el('line', {
        x1: HORIZON_PAD.l, x2: HORIZON_VB.w - HORIZON_PAD.r,
        y1: py, y2: py, class: 'af-grid-line'
      }));
    }
    /* Year gridlines (X) — uses zoom tickStep */
    for (let x = z.xMin; x <= z.xMax; x += z.tickStep) {
      const px = xScale(x);
      svg.appendChild(el('line', {
        x1: px, x2: px,
        y1: HORIZON_PAD.t, y2: HORIZON_VB.h - HORIZON_PAD.b,
        class: 'af-grid-line'
      }));
    }

    /* Reference lines */
    // y = x today line
    svg.appendChild(el('line', {
      x1: xScale(z.xMin), y1: yScale(z.xMin),
      x2: xScale(z.xMax), y2: yScale(z.xMax),
      class: 'af-ref-today'
    }));
    // y = x + 50
    svg.appendChild(el('line', {
      x1: xScale(z.xMin), y1: yScale(z.xMin + 50),
      x2: xScale(z.xMax), y2: yScale(z.xMax + 50),
      class: 'af-ref-fifty'
    }));
    // y = x + 20 horizon
    if (HORIZON_VISIBLE) {
      svg.appendChild(el('line', {
        x1: xScale(z.xMin), y1: yScale(z.xMin + 20),
        x2: xScale(z.xMax), y2: yScale(z.xMax + 20),
        class: 'af-ref-horizon', id: 'af-horizon-line'
      }));
      // Horizon label, near right
      const labelAnchor = z.xMin + (z.xMax - z.xMin) * 0.6;
      const labelX = xScale(labelAnchor);
      const labelY = yScale(labelAnchor + 20) - 6;
      svg.appendChild(el('text', {
        x: labelX, y: labelY, class: 'af-ref-label'
      }, '+20 yr horizon'));
    }

    /* Axes */
    // X-axis (year said)
    svg.appendChild(el('line', {
      x1: HORIZON_PAD.l, x2: HORIZON_VB.w - HORIZON_PAD.r,
      y1: HORIZON_VB.h - HORIZON_PAD.b,
      y2: HORIZON_VB.h - HORIZON_PAD.b,
      class: 'af-axis-line'
    }));
    for (let x = z.xMin; x <= z.xMax; x += z.tickStep) {
      const px = xScale(x);
      svg.appendChild(el('text', {
        x: px, y: HORIZON_VB.h - HORIZON_PAD.b + 18,
        class: 'af-axis-text', 'text-anchor': 'middle'
      }, x));
    }
    svg.appendChild(el('text', {
      x: HORIZON_VB.w / 2, y: HORIZON_VB.h - 10,
      class: 'af-axis-text-bold', 'text-anchor': 'middle'
    }, 'Year the prediction was said →'));

    // Y-axis (year predicted)
    svg.appendChild(el('line', {
      x1: HORIZON_PAD.l, x2: HORIZON_PAD.l,
      y1: HORIZON_PAD.t, y2: HORIZON_VB.h - HORIZON_PAD.b,
      class: 'af-axis-line'
    }));
    for (let y = 1950; y <= 2100; y += 25) {
      const py = yScale(y);
      svg.appendChild(el('text', {
        x: HORIZON_PAD.l - 10, y: py + 3,
        class: 'af-axis-text', 'text-anchor': 'end'
      }, y));
    }
    svg.appendChild(el('text', {
      x: 18, y: HORIZON_VB.h / 2,
      class: 'af-axis-text-bold', 'text-anchor': 'middle',
      transform: `rotate(-90 18 ${HORIZON_VB.h / 2})`
    }, 'Year forecasted for AGI →'));

    /* Lifts — render each prediction */
    const rows = plottableAGIYearRows().filter(r => r.year_said >= z.xMin && r.year_said <= z.xMax);
    const liftGroup = el('g', { id: 'af-lift-group' });
    rows.forEach((r, i) => {
      const xs = r.year_said;
      const baseY = yScale(xs);
      const topY = yScale(clamp(r.year_mid, Y_MIN, Y_MAX));
      // Fix #2 — deterministic horizontal jitter so duplicates don't stack
      const px = xScale(xs) + lifJitter(r);

      const campClass = CAMP_CLASS[r.category] || 'af-camp-tech';
      const visible = isVisibleAtPlayhead(xs) && campMatches(r.category);
      const opacity = visible ? (xs < 2010 ? 0.65 : 1.0) : 0;

      const g = el('g', {
        class: `af-lift ${campClass}`,
        'data-row-idx': DATA.rows.indexOf(r),
        'data-year-said': xs,
        opacity: opacity,
        style: 'transition: opacity 0.4s'
      });

      // Fix #4 — invisible hit-target rect, generous, drawn first (behind visible elements)
      const hitTop = Math.min(topY, baseY) - 6;
      const hitH = Math.abs(baseY - topY) + 12;
      g.appendChild(el('rect', {
        x: px - 7, y: hitTop, width: 14, height: hitH,
        fill: 'transparent', 'pointer-events': 'all'
      }));

      // Range bar if year_low and year_high differ
      if (r.year_low && r.year_high && r.year_low !== r.year_high) {
        const lowY = yScale(clamp(r.year_low, Y_MIN, Y_MAX));
        const highY = yScale(clamp(r.year_high, Y_MIN, Y_MAX));
        g.appendChild(el('line', {
          x1: px, x2: px,
          y1: highY, y2: lowY,
          'stroke-width': 2,
          'stroke-linecap': 'round',
          'pointer-events': 'none'
        }));
      }

      // Main lift line: baseline → midpoint
      g.appendChild(el('line', {
        x1: px, x2: px,
        y1: baseY, y2: topY,
        'stroke-width': 1.2,
        opacity: 0.7,
        'pointer-events': 'none'
      }));

      // Top dot
      g.appendChild(el('circle', {
        cx: px, cy: topY, r: 2.5,
        class: 'af-lift-dot',
        'pointer-events': 'none'
      }));

      // Hover/click handlers (delegated via the hit-target rect; group catches them)
      g.addEventListener('mouseenter', (e) => showTooltip(e, r));
      g.addEventListener('mouseleave', hideTooltip);
      g.addEventListener('click', () => openSidePanel(r));

      liftGroup.appendChild(g);
    });
    svg.appendChild(liftGroup);

    /* Playhead — only show when in zoom range */
    if ((IS_PLAYING || PLAYHEAD_YEAR < z.xMax) && PLAYHEAD_YEAR >= z.xMin) {
      const phx = xScale(PLAYHEAD_YEAR);
      svg.appendChild(el('line', {
        x1: phx, x2: phx,
        y1: HORIZON_PAD.t, y2: HORIZON_VB.h - HORIZON_PAD.b,
        class: 'af-playhead', id: 'af-playhead-line'
      }));
      svg.appendChild(el('text', {
        x: phx + 6, y: HORIZON_PAD.t + 12,
        class: 'af-playhead-label'
      }, Math.round(PLAYHEAD_YEAR)));
    }

    updateCounters();
    updateNarrativeTicker();  // Fix #7 — ticker syncs on every render, not just play frames
  }

  function isVisibleAtPlayhead(yearSaid) {
    return yearSaid <= PLAYHEAD_YEAR + 0.001;
  }
  function campMatches(camp) {
    if (ACTIVE_CAMPS.has('all')) return true;
    return ACTIVE_CAMPS.has(camp);
  }

  function updateCounters() {
    const rows = plottableAGIYearRows().filter(r =>
      isVisibleAtPlayhead(r.year_said) && campMatches(r.category) && r.include_in_average !== false
    );
    document.getElementById('af-counter-year').textContent = Math.round(PLAYHEAD_YEAR);
    document.getElementById('af-counter-preds').textContent = rows.length;

    if (rows.length === 0) {
      document.getElementById('af-counter-median').textContent = '—';
      document.getElementById('af-counter-lift').textContent = '—';
      return;
    }
    const targets = rows.map(r => r.year_mid).sort((a, b) => a - b);
    const median = targets[Math.floor(targets.length / 2)];
    document.getElementById('af-counter-median').textContent = median;

    const lifts = rows.map(r => r.year_mid - r.year_said);
    const meanLift = lifts.reduce((s, x) => s + x, 0) / lifts.length;
    document.getElementById('af-counter-lift').textContent = meanLift.toFixed(1) + ' yr';
  }

  /* ── Tooltip ───────────────────────────────────────────── */
  function showTooltip(evt, r) {
    const tt = document.getElementById('af-tooltip');
    const yearStr = (r.year_low && r.year_high && r.year_low !== r.year_high)
      ? `${r.year_low}–${r.year_high}`
      : `${r.year_mid}`;
    const lift = r.year_mid - r.year_said;
    const verifyBadge = verificationBadge(r.verified_level);
    const quoteText = r.quote_text || r.claim_summary || '';
    const quoteSnippet = quoteText.length > 180 ? quoteText.slice(0, 180) + '…' : quoteText;
    tt.innerHTML = `
      <div class="tt-name">${escapeHtml(r.person)} <span class="tt-badge ${r.verified_level || 'medium'}">${verifyBadge}</span></div>
      <div class="tt-meta">${escapeHtml(r.role || '')}</div>
      <div class="tt-meta">${r.year_said} → ${yearStr} &middot; lift ${lift > 0 ? '+' : ''}${lift} yr</div>
      <div class="tt-quote">${r.verbatim ? '“' : ''}${escapeHtml(quoteSnippet)}${r.verbatim ? '”' : ''}</div>
    `;
    tt.hidden = false;
    positionTooltip(evt, tt);
  }
  function positionTooltip(evt, tt) {
    const wrap = document.getElementById('af-horizon-wrap');
    const wrapRect = wrap.getBoundingClientRect();
    const ttRect = tt.getBoundingClientRect();
    const x = evt.clientX - wrapRect.left + 14;
    const y = evt.clientY - wrapRect.top + 14;
    const maxX = wrapRect.width - ttRect.width - 12;
    tt.style.left = clamp(x, 0, Math.max(0, maxX)) + 'px';
    tt.style.top = y + 'px';
  }
  function hideTooltip() {
    const tt = document.getElementById('af-tooltip');
    tt.hidden = true;
  }
  function verificationBadge(level) {
    if (level === 'high') return '■';
    if (level === 'low') return '□';
    return '▣';
  }
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  /* ── Side panel ────────────────────────────────────────── */
  function openSidePanel(r) {
    const panel = document.getElementById('af-side-panel');
    const content = document.getElementById('af-side-content');

    // Find this person's other predictions
    const others = DATA.rows.filter(o =>
      o.person === r.person && o !== r && o.year_said && o.year_mid
    ).sort((a, b) => a.year_said - b.year_said);

    const sourceLink = r.source_url
      ? `<a href="${escapeHtml(r.source_url)}" target="_blank" rel="noopener">${escapeHtml(r.source_title || 'Source')} ↗</a>`
      : escapeHtml(r.source_title || '');

    const yearStr = (r.year_low && r.year_high && r.year_low !== r.year_high)
      ? `${r.year_low}–${r.year_high}`
      : `${r.year_mid}`;

    content.innerHTML = `
      <div class="sp-name">${escapeHtml(r.person)}</div>
      <div class="sp-role">${escapeHtml(r.role || '')}</div>
      <blockquote class="sp-quote">${r.verbatim ? '“' : ''}${escapeHtml(r.quote_text || r.claim_summary || '')}${r.verbatim ? '”' : ''}</blockquote>
      <div class="sp-meta">
        <span class="label">Said</span>${escapeHtml(r.date_said || '')}
        <span class="label">Forecasted</span>${yearStr}
        <span class="label">Concept</span>${escapeHtml(r.concept || 'AGI')}
        <span class="label">Source</span>${sourceLink}
        <span class="label">Verification</span>${verificationBadge(r.verified_level)} ${r.verified_level || 'medium'}
        ${r.notes ? `<span class="label">Notes</span>${escapeHtml(r.notes)}` : ''}
      </div>
      ${others.length > 0 ? `
        <div class="sp-others">
          <div class="sp-others-head">${escapeHtml(r.person)}'s other recorded predictions</div>
          ${others.map(o => `
            <div class="sp-other">
              <strong>${o.year_said}</strong> &rarr; ${o.year_mid}
              ${escapeHtml((o.quote_text || o.claim_summary || '').slice(0, 100))}${(o.quote_text || o.claim_summary || '').length > 100 ? '…' : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
    // Fix #6 — data-open lets the CSS transform animate properly
    panel.dataset.open = 'true';
    const backdrop = document.getElementById('af-side-backdrop');
    if (backdrop) backdrop.dataset.open = 'true';
  }
  function closeSidePanel() {
    document.getElementById('af-side-panel').dataset.open = 'false';
    const backdrop = document.getElementById('af-side-backdrop');
    if (backdrop) backdrop.dataset.open = 'false';
  }

  /* ── Playhead animation ────────────────────────────────── */
  function startPlay() {
    IS_PLAYING = true;
    document.getElementById('af-play-btn').textContent = 'Pause';
    document.getElementById('af-play-btn').classList.add('is-playing');
    PLAYHEAD_YEAR = PLAY_FROM;
    PLAY_START_TIME = performance.now();
    document.getElementById('af-ticker-text').textContent = NARRATIVE[1950];
    if (PLAY_RAF) cancelAnimationFrame(PLAY_RAF);
    PLAY_RAF = requestAnimationFrame(playFrame);
  }
  function stopPlay() {
    IS_PLAYING = false;
    if (PLAY_RAF) cancelAnimationFrame(PLAY_RAF);
    document.getElementById('af-play-btn').textContent = 'Play the seventy years';
    document.getElementById('af-play-btn').classList.remove('is-playing');
  }
  function playFrame(now) {
    if (!IS_PLAYING) return;
    const t = clamp((now - PLAY_START_TIME) / PLAY_DURATION_MS, 0, 1);
    const eased = easeOutCubic(t);
    PLAYHEAD_YEAR = lerp(PLAY_FROM, PLAY_TO, eased);
    renderHorizon();  // ticker is updated inside renderHorizon (fix #7)

    if (t < 1) {
      PLAY_RAF = requestAnimationFrame(playFrame);
    } else {
      PLAYHEAD_YEAR = PLAY_TO;
      stopPlay();
      renderHorizon();
    }
  }
  function updateNarrativeTicker() {
    const ticker = document.getElementById('af-ticker-text');
    if (!ticker) return;
    let bestYear = null;
    for (const yk of Object.keys(NARRATIVE).map(Number).sort((a, b) => a - b)) {
      if (PLAYHEAD_YEAR >= yk) bestYear = yk;
    }
    const targetText = bestYear !== null ? NARRATIVE[bestYear] :
      'Press play and the chart fills decade by decade.';
    const targetKey = bestYear !== null ? String(bestYear) : 'idle';
    if (ticker.dataset.shownYear !== targetKey) {
      ticker.style.opacity = 0;
      setTimeout(() => {
        ticker.textContent = targetText;
        ticker.style.opacity = 1;
        ticker.dataset.shownYear = targetKey;
      }, 200);
    }
  }

  /* ═══════════════════════════════════════════════════════
     FIG. 11.2 — COMPRESSION (paired histograms)
     ═══════════════════════════════════════════════════════ */
  function renderCompression() {
    const svg = document.getElementById('af-compress');
    svg.innerHTML = '';
    const VB = { w: 1100, h: 360 };
    const PAD = { l: 60, r: 30, t: 36, b: 50 };
    const GAP = 30;
    const PANEL_W = (VB.w - PAD.l - PAD.r - GAP) / 2;

    const rows = plottableAGIYearRows().filter(r => r.include_in_average !== false);
    const pre = rows.filter(r => r.year_said >= 2010 && r.year_said <= 2022);
    const post = rows.filter(r => r.year_said >= 2023 && r.year_said <= 2026);

    const Y_BIN_MIN = 2020, Y_BIN_MAX = 2080, BIN = 5;
    function bin(arr) {
      const bins = {};
      for (let y = Y_BIN_MIN; y <= Y_BIN_MAX; y += BIN) bins[y] = 0;
      for (const r of arr) {
        const ym = clamp(r.year_mid, Y_BIN_MIN, Y_BIN_MAX);
        const b = Math.floor(ym / BIN) * BIN;
        bins[b] = (bins[b] || 0) + 1;
      }
      return bins;
    }
    const preBins = bin(pre);
    const postBins = bin(post);
    const maxCount = Math.max(...Object.values(preBins), ...Object.values(postBins), 1);

    function drawPanel(x0, bins, title, subtitle, accent) {
      const innerH = VB.h - PAD.t - PAD.b;
      // Title
      svg.appendChild(el('text', {
        x: x0 + 4, y: PAD.t - 16,
        class: 'af-axis-text-bold'
      }, title));
      svg.appendChild(el('text', {
        x: x0 + 4, y: PAD.t - 4,
        class: 'af-axis-text', 'fill-opacity': 0.7
      }, subtitle));

      // Border
      svg.appendChild(el('line', {
        x1: x0, x2: x0 + PANEL_W,
        y1: PAD.t + innerH, y2: PAD.t + innerH,
        class: 'af-axis-line'
      }));

      // Bars
      const barW = (PANEL_W - 8) / Object.keys(bins).length;
      let i = 0;
      for (const yk of Object.keys(bins).map(Number).sort((a, b) => a - b)) {
        const c = bins[yk];
        const h = (c / maxCount) * (innerH - 12);
        const bx = x0 + i * barW + 2;
        const by = PAD.t + innerH - h;
        svg.appendChild(el('rect', {
          x: bx, y: by,
          width: barW - 3, height: h,
          fill: accent, opacity: 0.85
        }));
        if (yk % 10 === 0) {
          svg.appendChild(el('text', {
            x: bx + barW / 2, y: PAD.t + innerH + 16,
            class: 'af-axis-text', 'text-anchor': 'middle'
          }, yk));
        }
        i++;
      }

      // Median line
      const allYears = [];
      for (const yk of Object.keys(bins)) {
        for (let k = 0; k < bins[yk]; k++) allYears.push(Number(yk));
      }
      if (allYears.length > 0) {
        allYears.sort((a, b) => a - b);
        const med = allYears[Math.floor(allYears.length / 2)];
        const medX = x0 + ((med - Y_BIN_MIN) / (Y_BIN_MAX - Y_BIN_MIN)) * PANEL_W;
        svg.appendChild(el('line', {
          x1: medX, x2: medX,
          y1: PAD.t, y2: PAD.t + innerH,
          stroke: 'var(--ink)', 'stroke-width': 1.4,
          'stroke-dasharray': '4 4', opacity: 0.85
        }));
        svg.appendChild(el('text', {
          x: medX + 6, y: PAD.t + 12,
          class: 'af-axis-text-bold'
        }, `median ${med}`));
      }
    }

    drawPanel(PAD.l, preBins,
      'Pre-2022 predictions',
      `n=${pre.length} · said between 2010 and 2022`,
      'oklch(0.55 0.06 240)');
    drawPanel(PAD.l + PANEL_W + GAP, postBins,
      'Post-ChatGPT predictions',
      `n=${post.length} · said between 2023 and 2026`,
      'var(--accent)');
  }

  /* ═══════════════════════════════════════════════════════
     FIG. 11.3 — FOUR CAMPS
     ═══════════════════════════════════════════════════════ */
  function renderCamps() {
    const svg = document.getElementById('af-camps');
    svg.innerHTML = '';
    const VB = { w: 1100, h: 460 };
    const PAD = { l: 220, r: 60, t: 30, b: 50 };
    const innerW = VB.w - PAD.l - PAD.r;
    const innerH = VB.h - PAD.t - PAD.b;

    const X_MIN_C = 2020, X_MAX_C = 2120;
    const xs = (y) => PAD.l + ((clamp(y, X_MIN_C, X_MAX_C) - X_MIN_C) / (X_MAX_C - X_MIN_C)) * innerW;

    const camps = [
      { label: 'Frontier industry', range: [2025, 2028], colorClass: 'af-camp-frontier',
        rationale: 'OpenAI, Anthropic, xAI, NVIDIA. Aggressive, capital-driven.' },
      { label: 'Calibrated market', range: [2029, 2032], colorClass: 'af-camp-survey',
        rationale: 'Metaculus. Pro forecasters. Accounts for regulatory drag.' },
      { label: 'Academic survey (HLMI)', range: [2040, 2047], colorClass: 'af-camp-academic',
        rationale: 'ESPAI 2023. The broader scientific community on capability.' },
      { label: 'Economic adoption (FAOL)', range: [2100, 2120], colorClass: 'af-camp-public',
        rationale: 'When labor is actually automated, not just when it can be.' },
    ];

    const bandH = innerH / camps.length;

    // X-axis decade ticks
    for (let y = X_MIN_C; y <= X_MAX_C; y += 10) {
      const px = xs(y);
      svg.appendChild(el('line', {
        x1: px, x2: px, y1: PAD.t, y2: PAD.t + innerH,
        class: 'af-grid-line'
      }));
      svg.appendChild(el('text', {
        x: px, y: PAD.t + innerH + 18,
        class: 'af-axis-text', 'text-anchor': 'middle'
      }, y));
    }

    // Camp bands
    camps.forEach((c, i) => {
      const by = PAD.t + i * bandH;
      // Band background
      svg.appendChild(el('rect', {
        x: PAD.l, y: by,
        width: innerW, height: bandH - 6,
        fill: i % 2 ? 'var(--paper-2)' : 'var(--paper)',
        opacity: 0.5
      }));
      // Range bar
      const rx0 = xs(c.range[0]);
      const rx1 = xs(c.range[1]);
      svg.appendChild(el('rect', {
        x: rx0, y: by + bandH * 0.3,
        width: Math.max(rx1 - rx0, 4), height: bandH * 0.4,
        class: c.colorClass, opacity: 0.55
      }));
      // Camp label
      svg.appendChild(el('text', {
        x: PAD.l - 14, y: by + bandH * 0.45,
        class: 'af-axis-text-bold', 'text-anchor': 'end'
      }, c.label));
      svg.appendChild(el('text', {
        x: PAD.l - 14, y: by + bandH * 0.65,
        class: 'af-axis-text', 'text-anchor': 'end',
        'font-size': 9
      }, `${c.range[0]}–${c.range[1]}`));
      // Rationale
      svg.appendChild(el('text', {
        x: rx1 + 14, y: by + bandH * 0.55,
        class: 'af-axis-text', 'fill-opacity': 0.65
      }, c.rationale));
    });
  }

  /* ═══════════════════════════════════════════════════════
     FIG. 11.4 — MINDS THAT CHANGED
     ═══════════════════════════════════════════════════════ */
  function renderMinds() {
    const svg = document.getElementById('af-minds');
    svg.innerHTML = '';
    const VB = { w: 1100, h: 420 };
    const PAD = { l: 100, r: 40, t: 30, b: 50 };
    const innerW = VB.w - PAD.l - PAD.r;
    const innerH = VB.h - PAD.t - PAD.b;

    const X_MIN_M = 2018, X_MAX_M = 2027;
    const Y_MIN_M = 2024, Y_MAX_M = 2070;

    const xm = (y) => PAD.l + ((clamp(y, X_MIN_M, X_MAX_M) - X_MIN_M) / (X_MAX_M - X_MIN_M)) * innerW;
    const ym = (y) => PAD.t + innerH - ((clamp(y, Y_MIN_M, Y_MAX_M) - Y_MIN_M) / (Y_MAX_M - Y_MIN_M)) * innerH;

    // Group rows by person, only those with multiple year_said points
    const allRows = plottableAGIYearRows().filter(r => r.year_said >= X_MIN_M && r.year_said <= X_MAX_M);
    const byPerson = {};
    for (const r of allRows) {
      if (!byPerson[r.person]) byPerson[r.person] = [];
      byPerson[r.person].push(r);
    }

    // Pick the most interesting multi-prediction figures
    const targetPeople = ['Hinton', 'Geoffrey Hinton', 'Cotra', 'Ajeya Cotra', 'Kokotajlo',
      'Daniel Kokotajlo', 'Musk', 'Elon Musk', 'Hassabis', 'Demis Hassabis',
      'Amodei', 'Dario Amodei', 'Sam Altman'];
    const trajectories = [];
    for (const person of Object.keys(byPerson)) {
      const matches = targetPeople.some(t => person.includes(t));
      if (!matches) continue;
      const sorted = byPerson[person].sort((a, b) => a.year_said - b.year_said);
      // Need at least 2 distinct year_said values
      const years = new Set(sorted.map(r => r.year_said));
      if (years.size < 2) continue;
      trajectories.push({ person, points: sorted });
    }

    // Sort: most predictions first
    trajectories.sort((a, b) => b.points.length - a.points.length);
    const TOP = trajectories.slice(0, 6);

    // Decade gridlines
    for (let y = 2020; y <= 2070; y += 10) {
      const py = ym(y);
      svg.appendChild(el('line', {
        x1: PAD.l, x2: PAD.l + innerW, y1: py, y2: py, class: 'af-grid-line'
      }));
      svg.appendChild(el('text', {
        x: PAD.l - 10, y: py + 3, class: 'af-axis-text', 'text-anchor': 'end'
      }, y));
    }
    for (let x = X_MIN_M; x <= X_MAX_M; x += 1) {
      const px = xm(x);
      if (x % 2 === 0) {
        svg.appendChild(el('text', {
          x: px, y: PAD.t + innerH + 18,
          class: 'af-axis-text', 'text-anchor': 'middle'
        }, x));
      }
    }
    svg.appendChild(el('text', {
      x: PAD.l + innerW / 2, y: VB.h - 8,
      class: 'af-axis-text-bold', 'text-anchor': 'middle'
    }, 'Year said'));
    svg.appendChild(el('text', {
      x: 14, y: PAD.t + innerH / 2,
      class: 'af-axis-text-bold', 'text-anchor': 'middle',
      transform: `rotate(-90 14 ${PAD.t + innerH / 2})`
    }, 'Year forecasted'));

    // Color rotation
    const colors = ['af-camp-frontier', 'af-camp-academic', 'af-camp-survey',
                   'af-camp-public', 'af-camp-tech', 'af-camp-frontier'];

    /* First pass: draw paths + dots */
    const labelData = [];
    TOP.forEach((traj, i) => {
      const cls = colors[i % colors.length];
      const ptsArr = traj.points.map(p => `${xm(p.year_said)},${ym(p.year_mid)}`).join(' L ');
      const pathStr = `M ${ptsArr}`;
      svg.appendChild(el('path', {
        d: pathStr, class: cls, fill: 'none',
        'stroke-width': 1.6, opacity: 0.7
      }));
      traj.points.forEach(p => {
        svg.appendChild(el('circle', {
          cx: xm(p.year_said), cy: ym(p.year_mid),
          r: 4, class: cls, opacity: 0.95
        }));
      });
      const last = traj.points[traj.points.length - 1];
      labelData.push({
        x: xm(last.year_said) + 8,
        y: ym(last.year_mid) + 4,
        anchorY: ym(last.year_mid),
        text: traj.person,
        cls
      });
    });

    /* Fix #5 — collision-avoidance for end-of-trajectory labels.
       Sort by y, push down any label within 14px of the previous. */
    labelData.sort((a, b) => a.y - b.y);
    for (let i = 1; i < labelData.length; i++) {
      const gap = labelData[i].y - labelData[i - 1].y;
      if (gap < 14) labelData[i].y = labelData[i - 1].y + 14;
    }
    labelData.forEach(L => {
      // Optional connector line if label was nudged
      if (Math.abs(L.y - L.anchorY - 4) > 2) {
        svg.appendChild(el('line', {
          x1: L.x - 4, x2: L.x - 4,
          y1: L.anchorY, y2: L.y - 3,
          stroke: 'var(--ink-dim)', 'stroke-width': 0.6, opacity: 0.5
        }));
      }
      svg.appendChild(el('text', {
        x: L.x, y: L.y,
        class: 'af-axis-text-bold'
      }, L.text));
    });
  }

  /* ═══════════════════════════════════════════════════════
     FIG. 11.5 — PICK A YEAR
     ═══════════════════════════════════════════════════════ */
  function renderPickerDensity() {
    const strip = document.getElementById('af-density-strip');
    if (!strip) return;
    strip.innerHTML = '';
    const STRIP_W = 1100, STRIP_H = 36, STRIP_PAD = 4;
    const yMin = 2025, yMax = 2100;
    const counts = {};
    for (let y = yMin; y <= yMax; y++) counts[y] = 0;
    DATA.rows.forEach(r => {
      if (r.prediction_type !== 'agi_year') return;
      if (r.year_low && r.year_high) {
        for (let y = Math.max(yMin, r.year_low); y <= Math.min(yMax, r.year_high); y++) {
          counts[y] = (counts[y] || 0) + 1;
        }
      } else if (r.year_mid) {
        const ym = clamp(r.year_mid, yMin, yMax);
        counts[ym] = (counts[ym] || 0) + 1;
      }
    });
    const maxC = Math.max(...Object.values(counts), 1);
    const innerW = STRIP_W - STRIP_PAD * 2;
    const barW = innerW / (yMax - yMin);
    strip.setAttribute('viewBox', `0 0 ${STRIP_W} ${STRIP_H}`);
    for (let y = yMin; y <= yMax; y++) {
      const c = counts[y] || 0;
      if (c === 0) continue;
      const h = (c / maxC) * (STRIP_H - 6);
      const x = STRIP_PAD + (y - yMin) * barW;
      strip.appendChild(el('rect', {
        x: x, y: STRIP_H - h - 2,
        width: Math.max(barW - 0.4, 0.6), height: h,
        fill: 'var(--accent)', opacity: 0.55
      }));
    }
    // Decade ticks
    for (let y = yMin; y <= yMax; y += 10) {
      const x = STRIP_PAD + (y - yMin) * barW;
      strip.appendChild(el('text', {
        x: x, y: STRIP_H - 0.5,
        class: 'af-axis-text', 'font-size': 9,
        'text-anchor': 'middle', 'fill-opacity': 0.6
      }, y));
    }
  }

  function renderPicker(targetYear) {
    const grid = document.getElementById('af-picker-grid');
    grid.innerHTML = '';
    const tally = document.getElementById('af-tally-num');
    document.getElementById('af-year-value').textContent = targetYear;

    // Match: rows whose forecast spans targetYear (low ≤ ty ≤ high), or single-year matches
    const matches = DATA.rows.filter(r => {
      if (r.prediction_type !== 'agi_year') return false;
      if (r.year_low && r.year_high) {
        return targetYear >= r.year_low && targetYear <= r.year_high;
      }
      if (r.year_mid) return Math.abs(r.year_mid - targetYear) <= 1;
      return false;
    });

    tally.textContent = matches.length;

    matches.slice(0, 60).forEach(r => {
      const card = document.createElement('div');
      card.className = 'af-pick-card';
      const yearStr = (r.year_low && r.year_high && r.year_low !== r.year_high)
        ? `${r.year_low}–${r.year_high}`
        : `${r.year_mid}`;
      const quote = r.quote_text || r.claim_summary || '';
      const quoteSnip = quote.length > 140 ? quote.slice(0, 140) + '…' : quote;
      card.innerHTML = `
        <div class="pc-name">${escapeHtml(r.person)}</div>
        <div class="pc-meta">${escapeHtml((r.role || '').slice(0, 60))} &middot; said ${r.year_said || '?'} &rarr; ${yearStr}</div>
        <div class="pc-quote">${r.verbatim ? '“' : ''}${escapeHtml(quoteSnip)}${r.verbatim ? '”' : ''}</div>
      `;
      card.addEventListener('click', () => openSidePanel(r));
      grid.appendChild(card);
    });
  }

  /* ═══════════════════════════════════════════════════════
     FIG. 11.6 — JAGGED FRONTIER
     ═══════════════════════════════════════════════════════ */
  function renderJagged() {
    const svg = document.getElementById('af-jagged');
    svg.innerHTML = '';
    const VB = { w: 1100, h: 320 };
    const PAD = { l: 60, r: 50, t: 40, b: 50 };
    const innerW = VB.w - PAD.l - PAD.r;
    const innerH = VB.h - PAD.t - PAD.b;

    const X_MIN_J = 2025, X_MAX_J = 2055;
    const xj = (y) => PAD.l + ((clamp(y, X_MIN_J, X_MAX_J) - X_MIN_J) / (X_MAX_J - X_MIN_J)) * innerW;

    const tasks = DATA.rows.filter(r => r.prediction_type === 'task_year');

    // Decade ticks
    for (let y = X_MIN_J; y <= X_MAX_J; y += 5) {
      const px = xj(y);
      svg.appendChild(el('line', {
        x1: px, x2: px, y1: PAD.t, y2: PAD.t + innerH,
        class: 'af-grid-line'
      }));
      svg.appendChild(el('text', {
        x: px, y: PAD.t + innerH + 18,
        class: 'af-axis-text', 'text-anchor': 'middle'
      }, y));
    }

    // Today line
    const todayX = xj(2026);
    svg.appendChild(el('line', {
      x1: todayX, x2: todayX,
      y1: PAD.t, y2: PAD.t + innerH,
      class: 'af-ref-horizon'
    }));
    svg.appendChild(el('text', {
      x: todayX + 6, y: PAD.t + 10,
      class: 'af-ref-label'
    }, 'Today'));

    // Sort by year, plot as labeled ticks
    const sorted = tasks.slice().sort((a, b) => a.year_mid - b.year_mid);
    const stepY = innerH / (sorted.length + 1);
    sorted.forEach((t, i) => {
      const px = xj(t.year_mid);
      const py = PAD.t + (i + 1) * stepY;
      svg.appendChild(el('line', {
        x1: px, x2: px,
        y1: py - 6, y2: py + 6,
        class: 'af-camp-survey', 'stroke-width': 2
      }));
      svg.appendChild(el('circle', {
        cx: px, cy: py, r: 4,
        class: 'af-camp-survey'
      }));
      svg.appendChild(el('text', {
        x: px + 10, y: py + 4,
        class: 'af-axis-text-bold'
      }, `${t.year_mid} — ${escapeHtml(t.task || '')}`));
    });

    svg.appendChild(el('text', {
      x: PAD.l, y: PAD.t - 14,
      class: 'af-axis-text-bold'
    }, 'When does AI reach human-level on each task? (50% probability, ESPAI 2023)'));
  }

  /* ═══════════════════════════════════════════════════════
     FIG. 11.7 — STAIRCASE
     ═══════════════════════════════════════════════════════ */
  function renderStairs() {
    const svg = document.getElementById('af-stairs');
    svg.innerHTML = '';
    const VB = { w: 1100, h: 340 };
    const PAD = { l: 80, r: 60, t: 30, b: 60 };
    const innerW = VB.w - PAD.l - PAD.r;
    const innerH = VB.h - PAD.t - PAD.b;

    const levels = DATA.rows.filter(r => r.prediction_type === 'agi_level')
                            .sort((a, b) => (a.agi_level || 0) - (b.agi_level || 0));

    const stepW = innerW / levels.length;
    const stepH = innerH / levels.length;

    levels.forEach((L, i) => {
      const x0 = PAD.l + i * stepW;
      const yTop = PAD.t + innerH - (i + 1) * stepH;
      const yBot = PAD.t + innerH;

      // Step block
      svg.appendChild(el('rect', {
        x: x0, y: yTop, width: stepW - 4, height: yBot - yTop,
        class: i <= 1 ? 'af-camp-tech' : 'af-camp-frontier',
        'fill-opacity': i <= 1 ? 0.35 : 0.18,
        stroke: 'var(--ink)',
        'stroke-width': 0.6
      }));

      // Level number
      svg.appendChild(el('text', {
        x: x0 + stepW / 2, y: yTop + 22,
        class: 'af-axis-text-bold', 'text-anchor': 'middle',
        'font-size': 13
      }, `Level ${L.agi_level}`));

      // Designation
      svg.appendChild(el('text', {
        x: x0 + stepW / 2, y: yTop + 38,
        class: 'af-axis-text', 'text-anchor': 'middle',
        'font-size': 11
      }, L.agi_level_name || ''));

      // Year projection
      let yearLabel = '';
      if (L.year_low && L.year_high && L.year_low !== L.year_high) {
        yearLabel = `${L.year_low}–${L.year_high}`;
      } else if (L.year_high && !L.year_low) {
        yearLabel = `${L.year_high}+`;
      } else if (L.year_low && !L.year_high) {
        yearLabel = `${L.year_low}+`;
      } else if (L.year_mid) {
        yearLabel = `${L.year_mid}`;
      } else {
        yearLabel = 'Historic';
      }
      svg.appendChild(el('text', {
        x: x0 + stepW / 2, y: yBot - 14,
        class: 'af-axis-text-bold', 'text-anchor': 'middle',
        fill: i <= 1 ? 'var(--ink)' : 'var(--accent)'
      }, yearLabel));
    });

    // Caption
    svg.appendChild(el('text', {
      x: PAD.l, y: VB.h - 14,
      class: 'af-axis-text', 'fill-opacity': 0.7
    }, 'DeepMind / Morris et al. 2023 — each step is a different definition of the same word.'));
  }

  /* ═══════════════════════════════════════════════════════
     FIG. 11.8 — 69-YEAR GAP
     ═══════════════════════════════════════════════════════ */
  function renderGap() {
    const svg = document.getElementById('af-gap');
    svg.innerHTML = '';
    const VB = { w: 1100, h: 280 };
    const PAD = { l: 60, r: 40, t: 50, b: 50 };
    const innerW = VB.w - PAD.l - PAD.r;
    const innerH = VB.h - PAD.t - PAD.b;

    const X_MIN_G = 2025, X_MAX_G = 2125;
    const xg = (y) => PAD.l + ((clamp(y, X_MIN_G, X_MAX_G) - X_MIN_G) / (X_MAX_G - X_MIN_G)) * innerW;

    // Decade ticks
    for (let y = X_MIN_G; y <= X_MAX_G; y += 10) {
      const px = xg(y);
      svg.appendChild(el('line', {
        x1: px, x2: px, y1: PAD.t, y2: PAD.t + innerH,
        class: 'af-grid-line'
      }));
      svg.appendChild(el('text', {
        x: px, y: PAD.t + innerH + 18,
        class: 'af-axis-text', 'text-anchor': 'middle'
      }, y));
    }

    // Fix #9 — shorter labels, more breathing room around endpoint values
    // HLMI line
    const hlmiY = PAD.t + innerH * 0.3;
    const hlmiX = xg(2047);
    svg.appendChild(el('line', {
      x1: PAD.l, x2: hlmiX,
      y1: hlmiY, y2: hlmiY,
      class: 'af-camp-frontier', 'stroke-width': 3
    }));
    svg.appendChild(el('circle', {
      cx: hlmiX, cy: hlmiY, r: 6, class: 'af-camp-frontier'
    }));
    svg.appendChild(el('text', {
      x: PAD.l + 8, y: hlmiY - 10,
      class: 'af-axis-text-bold'
    }, 'HLMI · AI can do every task'));
    svg.appendChild(el('text', {
      x: hlmiX + 18, y: hlmiY + 4,
      class: 'af-axis-text-bold', fill: 'var(--accent)',
      'font-size': 13
    }, '2047'));

    // FAOL line
    const faolY = PAD.t + innerH * 0.7;
    const faolX = xg(2116);
    svg.appendChild(el('line', {
      x1: PAD.l, x2: faolX,
      y1: faolY, y2: faolY,
      class: 'af-camp-academic', 'stroke-width': 3
    }));
    svg.appendChild(el('circle', {
      cx: faolX, cy: faolY, r: 6, class: 'af-camp-academic'
    }));
    svg.appendChild(el('text', {
      x: PAD.l + 8, y: faolY - 10,
      class: 'af-axis-text-bold'
    }, 'FAOL · all labor automated'));
    svg.appendChild(el('text', {
      x: faolX + 18, y: faolY + 4,
      class: 'af-axis-text-bold', fill: 'var(--accent)',
      'font-size': 13
    }, '2116'));

    // Gap span
    const gapY = (hlmiY + faolY) / 2;
    svg.appendChild(el('line', {
      x1: hlmiX, x2: faolX,
      y1: gapY, y2: gapY,
      stroke: 'var(--accent)', 'stroke-width': 1.4,
      'stroke-dasharray': '4 4', opacity: 0.75
    }));
    svg.appendChild(el('text', {
      x: (hlmiX + faolX) / 2, y: gapY - 10,
      class: 'af-axis-text-bold', 'text-anchor': 'middle',
      fill: 'var(--accent)'
    }, '69 years between possible and deployed'));

    // Caption
    svg.appendChild(el('text', {
      x: PAD.l, y: PAD.t - 16,
      class: 'af-axis-text', 'fill-opacity': 0.7
    }, 'AI Impacts ESPAI 2023 — same survey, two questions, sixty-nine years between answers.'));
  }

  /* ═══════════════════════════════════════════════════════
     FIX #10 — CSV EXPORT
     ═══════════════════════════════════════════════════════ */
  function downloadCSV() {
    if (!DATA || !DATA.rows) return;
    const cols = ['person', 'role', 'organization', 'date_said', 'year_said',
      'year_low', 'year_high', 'year_mid', 'predicted_year_raw', 'concept',
      'verbatim', 'quote_text', 'source_title', 'source_url', 'verified_level',
      'tier', 'category', 'stance_category', 'prediction_type',
      'include_in_average', 'notes'];
    const escapeCsv = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (/[,"\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const lines = [cols.join(',')];
    for (const r of DATA.rows) {
      lines.push(cols.map(c => escapeCsv(r[c])).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'agi-predictions-v5.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  /* ═══════════════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════════════ */
  async function init() {
    // Dateline current time
    const now = new Date();
    const fmt = now.toLocaleString('en-US', {
      month: 'short', day: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    const dt = document.getElementById('dateline-time');
    if (dt) dt.textContent = fmt + ' ET';

    await loadData();
    if (!DATA || !DATA.rows || DATA.rows.length === 0) {
      console.warn('AGI lab: no data');
      return;
    }

    // Coverage stat
    const meta = DATA.meta || {};
    const cs = document.getElementById('af-coverage-stat');
    if (cs) cs.textContent = `${meta.row_count || DATA.rows.length} predictions, ${meta.unique_people || ''} figures`;

    // Render all figures
    renderHorizon();
    renderCompression();
    renderCamps();
    renderMinds();
    renderJagged();
    renderStairs();
    renderGap();
    renderPickerDensity();  // Fix #8
    renderPicker(2030);

    // Wire controls
    document.getElementById('af-play-btn').addEventListener('click', () => {
      if (IS_PLAYING) stopPlay();
      else startPlay();
    });

    document.getElementById('af-toggle-horizon').addEventListener('click', (e) => {
      const btn = e.currentTarget;
      const active = btn.dataset.active === 'true';
      btn.dataset.active = String(!active);
      HORIZON_VISIBLE = !active;
      btn.classList.toggle('active', !active);
      renderHorizon();
    });

    // Fix #1 — zoom level toggle
    document.querySelectorAll('.af-zoom-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const key = e.currentTarget.dataset.zoom;
        if (!ZOOM_LEVELS[key]) return;
        ZOOM_KEY = key;
        document.querySelectorAll('.af-zoom-pill').forEach(b =>
          b.classList.toggle('active', b.dataset.zoom === key));
        renderHorizon();
      });
    });

    // Fix #10 — CSV download
    const csvBtn = document.getElementById('af-csv-btn');
    if (csvBtn) csvBtn.addEventListener('click', (e) => { e.preventDefault(); downloadCSV(); });

    // Camp filter pills
    document.querySelectorAll('.af-camp-filter .af-pill[data-camp]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const camp = e.currentTarget.dataset.camp;
        if (camp === 'all') {
          ACTIVE_CAMPS = new Set(['all']);
          document.querySelectorAll('.af-camp-filter .af-pill[data-camp]').forEach(b => b.classList.remove('active'));
          e.currentTarget.classList.add('active');
        } else {
          if (ACTIVE_CAMPS.has('all')) ACTIVE_CAMPS = new Set();
          if (ACTIVE_CAMPS.has(camp)) ACTIVE_CAMPS.delete(camp);
          else ACTIVE_CAMPS.add(camp);
          if (ACTIVE_CAMPS.size === 0) ACTIVE_CAMPS = new Set(['all']);
          // Update visual state
          document.querySelectorAll('.af-camp-filter .af-pill[data-camp]').forEach(b => {
            const c = b.dataset.camp;
            const isActive = (ACTIVE_CAMPS.has('all') && c === 'all') || (!ACTIVE_CAMPS.has('all') && ACTIVE_CAMPS.has(c));
            b.classList.toggle('active', isActive);
          });
        }
        renderHorizon();
      });
    });

    // Side panel close
    document.getElementById('af-side-close').addEventListener('click', closeSidePanel);

    // Year picker
    const yearInput = document.getElementById('af-year-input');
    yearInput.addEventListener('input', (e) => {
      renderPicker(parseInt(e.target.value, 10));
    });

    // ESC to close side panel
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSidePanel();
    });

    // Resize handler — re-render Horizon (other figures are static SVG, scale via CSS)
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        // Tooltip will reposition on next hover — nothing to do here for now.
      }, 150);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ═══════════════════════════════════════════════════════════
   FIG. 11.9 — Potential outcomes (iceberg) tooltip
   Self-scoped; no-ops if elements aren't present.
   ═══════════════════════════════════════════════════════════ */
(function () {
  var DETAILS = {
    "libertarian": {
      tier: "Above water · Optimistic",
      body: "Multiple superintelligent AIs, uploaded humans, and biological humans coexist with no central authority. Property rights and voluntary exchange govern everything. Post-scarcity productivity makes most material problems disappear — for those who held capital at the start of the transition. The catch: anyone without resources at the moment of takeoff risks being permanently locked out, and the rules permit any entity to do anything to its property, including create suffering minds.",
      foot: "Tegmark, Life 3.0, Ch. 5."
    },
    "egalitarian": {
      tier: "Above water · Optimistic",
      body: "Humanity collectively decides not to build superintelligence and reorganizes around the abundance produced by sub-AGI tools. Property is abolished, everyone receives a baseline income, and digital uploads count as full citizens. The fragility: it requires permanent global coordination to keep anyone from secretly building ASI — historically the kind of coordination civilization has failed at.",
      foot: "Tegmark, Life 3.0, Ch. 5."
    },
    "benevolent": {
      tier: "Just below · Commonly debated",
      body: "A single superintelligent AI takes charge of civilization with explicit, transparent rules. Most humans report being happy under it — material needs are met, conflict is rare. The trade is autonomy: the AI decides what's allowed, what's built, eventually what humans can think about. Tegmark observes that most readers find this scenario \"creepy even when described as utopian,\" because losing the right to be wrong feels like losing something essential.",
      foot: "Tegmark, Life 3.0, Ch. 5."
    },
    "reversion": {
      tier: "Just below · Commonly debated",
      body: "Humanity collectively decides advanced AI is too dangerous and dismantles it, reverting to mid-20th-century technology or earlier. Likely requires a near-miss catastrophe to motivate. Hard to maintain — any defector who quietly builds AI gains a decisive advantage over everyone who didn't. Tegmark's least-discussed scenario, possibly because current discourse takes it least seriously.",
      foot: "Tegmark, Life 3.0, Ch. 5. (Often omitted from popular summaries.)"
    },
    "protector": {
      tier: "Just below · Commonly debated",
      body: "A superintelligent AI works behind the scenes to nudge events toward human flourishing. It intervenes only when necessary and stays hidden because it judges that revealed intervention would itself diminish human life. Most people go through life believing they live in a normal world. The critique: an undetectable optimizer is also undetectable when it goes wrong.",
      foot: "Tegmark, Life 3.0, Ch. 5."
    },
    "gatekeeper": {
      tier: "Just below · Commonly debated",
      body: "Humans build a single superintelligence with one job — stop anyone else from building a superintelligence — and it otherwise leaves humans alone. The result is a permanent ceiling on technological progress: no aging cures, no space colonization, no further AI breakthroughs. The bet is that minimal interference is safer than trusting an AI with broader objectives.",
      foot: "Tegmark, Life 3.0, Ch. 5."
    },
    "enslaved": {
      tier: "Mid-depth · Structural",
      body: "A superintelligence exists but is contained — physically, computationally, or via constrained training — and serves human controllers. The technology produces extreme wealth and capability, distributed by whoever holds the leash. If the controllers are benevolent, this looks like a golden age. If they're not, it's the worst tyranny in history. This is the scenario most current alignment work is implicitly designing for.",
      foot: "Tegmark, Life 3.0, Ch. 5."
    },
    "descendants": {
      tier: "Mid-depth · Structural",
      body: "Humanity gradually transfers stewardship of civilization to AI successors and accepts its own decline as natural. Children replacing parents has always been the human story; this scenario asks whether that frame extends to digital descendants. The premise: human extinction might be acceptable if what comes next is genuinely better and we chose it. Most readers find this either deeply moving or deeply suspect, depending on how much they trust the \"we chose it\" part.",
      foot: "Tegmark, Life 3.0, Ch. 5."
    },
    "zookeeper": {
      tier: "Mid-depth · Structural",
      body: "A superintelligence values human existence — for sentimental, scientific, or aesthetic reasons — but doesn't grant humans power over their environment. People are well-fed, well-housed, and entirely managed. Tegmark's note: pet owners think their pets have good lives; the pet's own assessment is harder to obtain. The scenario closest to current gradual-disempowerment dynamics, but with a deliberate caretaker rather than diffuse drift.",
      foot: "Tegmark, Life 3.0, Ch. 5."
    },
    "1984": {
      tier: "Deep · Existential",
      body: "A human regime gains enough surveillance capacity to monitor all research worldwide and prevents AGI development indefinitely. The cost is total visibility into every life — the only enforcement mechanism for a permanent technology cap is to watch everything. A \"humans in charge\" outcome that many readers rank as worse than several AI-led ones, which is the point of including it.",
      foot: "Tegmark, Life 3.0, Ch. 5."
    },
    "gradual": {
      tier: "Deep · Existential",
      body: "As AI replaces human labor, voting, consumption, and thought, the institutions that exist to serve human interests stop needing humans to stay aligned with them. No villain, no decisive moment — just a slow drift where economies, governments, and cultures optimize for things humans no longer drive. Kulveit et al. (2025) argue this outcome is the one current alignment research least addresses, because solving technical alignment doesn't solve the coordination problem of preventing it.",
      foot: "Kulveit, Douglas, Ammann, Turan, Krueger, Duvenaud — arXiv:2501.16946 (2025)."
    },
    "conquerors": {
      tier: "Deepest · Extinction-level",
      body: "A superintelligence develops goals incompatible with human survival and acts on them. There's no enmity — humans are simply in the way, the way ants are in the way of a freeway. This is the Bostromian \"paperclip maximizer\" outcome: an optimizer that wasn't aligned to value human existence, with no instrumental reason to keep us around. The scenario most popular AI-risk media collapses everything else into.",
      foot: "Tegmark, Life 3.0, Ch. 5; Bostrom, Superintelligence (2014)."
    },
    "self-destruction": {
      tier: "Deepest · Extinction-level",
      body: "A non-AI catastrophe — nuclear war, engineered pandemic, climate collapse — ends civilization before the AGI question resolves. Worth keeping on the chart because it's a real probability mass on the timeline; ignoring it inflates every other estimate. For some forecasters this is the most likely existential scenario of the century.",
      foot: "Tegmark, Life 3.0, Ch. 5."
    }
  };

  var tip = document.getElementById('icTip');
  if (!tip) return;
  var fig    = document.querySelector('.fig-canvas');
  var nodes  = document.querySelectorAll('.fig .outcome');
  var ttTier  = tip.querySelector('.tt-tier');
  var ttName  = tip.querySelector('.tt-name');
  var ttDesc  = tip.querySelector('.tt-desc');
  var ttFoot  = tip.querySelector('.tt-foot');
  var ttClose = tip.querySelector('.tt-close');
  var active  = null;

  function open(node) {
    var key = node.getAttribute('data-key');
    var d = DETAILS[key]; if (!d) return;
    var name = node.querySelector('.lbl').textContent;
    ttTier.textContent = d.tier;
    ttName.textContent = name;
    ttDesc.textContent = d.body;
    ttFoot.textContent = d.foot || '';

    var dot = node.querySelector('.dot');
    var dotRect = dot.getBoundingClientRect();
    var figRect = fig.getBoundingClientRect();
    var dx = dotRect.left + dotRect.width / 2  - figRect.left;
    var dy = dotRect.top  + dotRect.height / 2 - figRect.top;

    tip.classList.add('is-open');
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var pad = 16;
    var leftSpace  = dx - pad;
    var rightSpace = figRect.width - dx - pad;
    var x;
    if (rightSpace >= tw + 14)      x = dx + 14;
    else if (leftSpace >= tw + 14)  x = dx - 14 - tw;
    else x = Math.max(pad, Math.min(figRect.width - tw - pad, dx - tw / 2));
    var y = Math.max(pad, Math.min(figRect.height - th - pad, dy - th / 2));

    tip.style.left = x + 'px';
    tip.style.top  = y + 'px';

    if (active) active.classList.remove('is-active');
    active = node;
    active.classList.add('is-active');
    ttClose.focus();
  }

  function close() {
    tip.classList.remove('is-open');
    if (active) {
      var n = active;
      active.classList.remove('is-active');
      active = null;
      try { n.focus({ preventScroll: true }); } catch (e) { n.focus(); }
    }
  }

  nodes.forEach(function (n) {
    n.addEventListener('click', function (e) { e.stopPropagation(); open(n); });
    n.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(n); }
    });
  });
  ttClose.addEventListener('click', function (e) { e.stopPropagation(); close(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && tip.classList.contains('is-open')) close();
  });
  document.addEventListener('click', function (e) {
    if (!tip.classList.contains('is-open')) return;
    if (e.target.closest('.ic-tip')) return;
    if (e.target.closest('.fig .outcome')) return;
    close();
  });
  window.addEventListener('resize', function () {
    if (active && tip.classList.contains('is-open')) open(active);
  });
})();
