(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     TIME-USE LAB — frontend
     - Loads /assets/data/time-use/cohorts.json
     - Renders a 24-hour radial clock for the selected cohort
       (proportional ring segments by activity, sized by minutes)
     - Compare view: bar deltas between two cohorts
     - Surprise reveals: 6 pre-curated findings as small horizontal bars
     ═══════════════════════════════════════════════════════════ */

  // Color palette: 13 muted, editorial colors. One per activity bucket.
  // Calibrated so that the dominant activities (sleep, work, TV) read as
  // distinct bands in the ring without any feeling like accents.
  const ACTIVITY_COLORS = {
    "Sleep":              "#3b4a59",   // slate
    "Personal care":      "#a78b6a",   // muted tan
    "Work":               "#7e3a3a",   // brick
    "Education":          "#7a6e3d",   // olive-bronze
    "Childcare":          "#ad6c52",   // terracotta
    "Housework":          "#5a6b54",   // moss
    "Shopping":           "#947b5b",   // wheat
    "Eating out":         "#8c6447",   // cocoa
    "Socializing":        "#5a7a8c",   // dusty blue
    "Watching TV":        "#5d4d7a",   // plum
    "Phone/computer":     "#3d6a7d",   // teal
    "Sports/exercise":    "#3a6a4d",   // forest
    "Religious/volunteer":"#7c5a8c",   // mauve
    "Travel":             "#6b6b6b",   // graphite
    "Other":              "#8a8474",   // stone
  };

  // Activity ordering in legend + ring (sleep first, then time-of-day-ish)
  const ACTIVITY_ORDER = [
    "Sleep", "Personal care", "Work", "Education", "Childcare",
    "Housework", "Shopping", "Eating out", "Socializing",
    "Watching TV", "Phone/computer", "Sports/exercise",
    "Religious/volunteer", "Travel", "Other",
  ];

  let DATA = null;
  let currentCohort = "Total";

  const $axisAge   = document.getElementById('tu-axis-age');
  const $axisEmp   = document.getElementById('tu-axis-employment');
  const $axisPar   = document.getElementById('tu-axis-parent');
  const $reset     = document.getElementById('tu-reset');
  const $clock     = document.getElementById('tu-clock');
  const $clockHead = document.getElementById('tu-clock-head');
  const $legend    = document.getElementById('tu-legend-list');
  const $coverage  = document.getElementById('tu-coverage');
  const $cmpA      = document.getElementById('tu-cmp-a');
  const $cmpB      = document.getElementById('tu-cmp-b');
  const $cmpBars   = document.getElementById('tu-compare-bars');
  const $surprises = document.getElementById('tu-surprises');
  const $receipts  = document.getElementById('tu-receipts');

  // ── Utilities ──────────────────────────────────────────────
  const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, ch =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  const fmtMin = m => m == null ? '—' :
    (m >= 60 ? `${Math.floor(m/60)}h ${Math.round(m%60)}m` : `${Math.round(m)}m`);

  // ── Load + bootstrap ───────────────────────────────────────
  async function load() {
    const r = await fetch('/assets/data/time-use/cohorts.json', { cache: 'force-cache' });
    if (!r.ok) throw new Error('cohorts.json failed to load');
    DATA = await r.json();
    if ($coverage) {
      const yrs = DATA.years_pooled || [];
      $coverage.textContent = DATA.stub
        ? `2023 published averages (stub)`
        : `${yrs[0]}–${yrs[yrs.length-1]}`;
    }
    return DATA;
  }

  // ── Cohort picker ──────────────────────────────────────────
  function buildPicker() {
    const axes = DATA.cohort_axes || {};
    function chip(label, parent) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tu-chip';
      b.textContent = label;
      b.dataset.cohort = label;
      b.addEventListener('click', () => selectCohort(label));
      parent.appendChild(b);
    }
    (axes.age        || []).forEach(c => chip(c, $axisAge));
    (axes.employment || []).forEach(c => chip(c, $axisEmp));
    (axes.parent     || []).forEach(c => chip(c, $axisPar));
    if ($reset) $reset.addEventListener('click', () => selectCohort('Total'));
    selectCohort('Total');
  }

  function selectCohort(label) {
    if (!DATA.cohorts[label]) return;
    currentCohort = label;
    document.querySelectorAll('.tu-chip').forEach(c =>
      c.classList.toggle('active', c.dataset.cohort === label));
    drawClock();
    drawLegend();
    if ($clockHead) $clockHead.textContent = label === 'Total'
      ? 'Total population, average day'
      : `${label}, average day`;
  }

  // ── 24-hour radial clock ───────────────────────────────────
  function drawClock() {
    if (!$clock) return;
    const cohort = DATA.cohorts[currentCohort] || {};
    const buckets = ACTIVITY_ORDER
      .filter(b => b in cohort && cohort[b]?.total_min)
      .map(b => ({ name: b, min: cohort[b].total_min }));
    const total = buckets.reduce((s, b) => s + b.min, 0) || 1440;

    const R_OUTER = 200;
    const R_INNER = 105;
    let svg = '';

    // Hour ticks + labels — render under segments
    for (let h = 0; h < 24; h++) {
      const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
      const x1 = (R_OUTER + 2) * Math.cos(a);
      const y1 = (R_OUTER + 2) * Math.sin(a);
      const x2 = (R_OUTER + 8) * Math.cos(a);
      const y2 = (R_OUTER + 8) * Math.sin(a);
      svg += `<line class="hour-tick" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"/>`;
      if (h % 3 === 0) {
        const lx = (R_OUTER + 18) * Math.cos(a);
        const ly = (R_OUTER + 18) * Math.sin(a);
        const label = h === 0 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}a` : `${h-12}p`;
        svg += `<text class="hour-label" x="${lx.toFixed(2)}" y="${(ly + 3).toFixed(2)}" text-anchor="middle">${label}</text>`;
      }
    }

    // Segments — each occupies a fraction of the ring proportional to its minutes
    let cursor = 0; // running angular position, starting at 12 o'clock (top)
    function arcPath(startAngle, endAngle, rOuter, rInner) {
      const x1 = rOuter * Math.cos(startAngle), y1 = rOuter * Math.sin(startAngle);
      const x2 = rOuter * Math.cos(endAngle),   y2 = rOuter * Math.sin(endAngle);
      const x3 = rInner * Math.cos(endAngle),   y3 = rInner * Math.sin(endAngle);
      const x4 = rInner * Math.cos(startAngle), y4 = rInner * Math.sin(startAngle);
      const large = (endAngle - startAngle) > Math.PI ? 1 : 0;
      return `M${x1.toFixed(2)},${y1.toFixed(2)} ` +
             `A${rOuter},${rOuter} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} ` +
             `L${x3.toFixed(2)},${y3.toFixed(2)} ` +
             `A${rInner},${rInner} 0 ${large} 0 ${x4.toFixed(2)},${y4.toFixed(2)} Z`;
    }
    buckets.forEach(b => {
      const frac = b.min / total;
      const start = cursor * Math.PI * 2 - Math.PI / 2;
      const end   = (cursor + frac) * Math.PI * 2 - Math.PI / 2;
      const color = ACTIVITY_COLORS[b.name] || '#888';
      const d = arcPath(start, end, R_OUTER, R_INNER);
      const safeName = escapeHtml(b.name);
      svg += `<path class="seg" data-act="${safeName}" fill="${color}" d="${d}">
                <title>${safeName} — ${fmtMin(b.min)}</title>
              </path>`;
      cursor += frac;
    });

    // Hub stat: total tracked minutes (always 1,440 by construction; we display
    // the largest activity instead because that's the more interesting number)
    const top = buckets.reduce((a, b) => b.min > a.min ? b : a, { min: 0, name: '—' });
    svg += `<text class="hub-stat-num" x="0" y="-2">${fmtMin(top.min)}</text>`;
    svg += `<text class="hub-stat-lbl" x="0" y="18">${escapeHtml(top.name).toUpperCase()}</text>`;

    $clock.innerHTML = svg;
  }

  // ── Legend ─────────────────────────────────────────────────
  function drawLegend() {
    if (!$legend) return;
    const cohort = DATA.cohorts[currentCohort] || {};
    const items = ACTIVITY_ORDER
      .filter(b => b in cohort && cohort[b]?.total_min)
      .map(b => ({ name: b, min: cohort[b].total_min }))
      .sort((a, b) => b.min - a.min);
    $legend.innerHTML = items.map(it => `
      <li>
        <span class="tu-legend-swatch" style="background:${ACTIVITY_COLORS[it.name] || '#888'}"></span>
        <span class="tu-legend-name">${escapeHtml(it.name)}</span>
        <span class="tu-legend-min">${fmtMin(it.min)}</span>
      </li>
    `).join('');
  }

  // ── Compare bars ───────────────────────────────────────────
  function buildCompare() {
    if (!$cmpA || !$cmpB) return;
    const opts = Object.keys(DATA.cohorts)
      .map(k => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`).join('');
    $cmpA.innerHTML = opts;
    $cmpB.innerHTML = opts;
    $cmpA.value = 'Employed full time';
    $cmpB.value = 'Not employed';
    [$cmpA, $cmpB].forEach(el => el.addEventListener('change', drawCompare));
    drawCompare();
  }

  function drawCompare() {
    if (!$cmpBars) return;
    const a = DATA.cohorts[$cmpA.value] || {};
    const b = DATA.cohorts[$cmpB.value] || {};
    const maxMin = Math.max(
      ...ACTIVITY_ORDER.flatMap(act => [a[act]?.total_min || 0, b[act]?.total_min || 0])
    ) || 1;
    const rows = ACTIVITY_ORDER
      .filter(act => a[act]?.total_min || b[act]?.total_min)
      .map(act => {
        const aMin = a[act]?.total_min || 0;
        const bMin = b[act]?.total_min || 0;
        const delta = bMin - aMin;
        const major = Math.abs(delta) >= 15;
        const sign = delta > 0 ? '+' : delta < 0 ? '' : '';
        return `
          <div class="tu-cmp-row${major ? ' diff-major' : ''}">
            <span class="name">${escapeHtml(act)}</span>
            <span class="tu-cmp-bar a"><span class="fill" style="width:${Math.round((aMin/maxMin)*100)}%"></span></span>
            <span class="tu-cmp-bar b"><span class="fill" style="width:${Math.round((bMin/maxMin)*100)}%"></span></span>
            <span class="tu-cmp-delta${major ? ' major' : ''}">${sign}${Math.round(delta)}m</span>
          </div>`;
      }).join('');
    $cmpBars.innerHTML = `
      <div class="tu-cmp-row" style="border-bottom:1px solid var(--ink-dim); padding-bottom:6px; opacity:0.7;">
        <span class="name" style="font-size:10px; letter-spacing:0.16em; text-transform:uppercase;">Activity</span>
        <span style="font-size:10px; letter-spacing:0.16em; text-transform:uppercase; color:var(--ink-dim);">${escapeHtml($cmpA.value)}</span>
        <span style="font-size:10px; letter-spacing:0.16em; text-transform:uppercase; color:var(--ink-dim);">${escapeHtml($cmpB.value)}</span>
        <span class="tu-cmp-delta">B − A</span>
      </div>
      ${rows}`;
  }

  // ── Surprises ──────────────────────────────────────────────
  function drawSurprises() {
    if (!$surprises) return;
    const out = (DATA.surprises || []).map((s, i) => {
      const fig = `${i + 1}`.padStart(2, '0');
      let inner = '';
      if (s.compare_cohorts) {
        const [c1, c2] = s.compare_cohorts;
        const v1 = DATA.cohorts[c1]?.[s.activity]?.total_min;
        const v2 = DATA.cohorts[c2]?.[s.activity]?.total_min;
        const max = Math.max(v1 || 0, v2 || 0) || 1;
        inner = `
          <div class="tu-surprise-bars">
            <div class="tu-surprise-bar-row">
              <span class="tu-surprise-bar"><span class="fill" style="width:${Math.round(((v1||0)/max)*100)}%"></span><span class="label-inside">${escapeHtml(c1)}</span></span>
              <span class="tu-surprise-bar-num">${fmtMin(v1)}</span>
            </div>
            <div class="tu-surprise-bar-row">
              <span class="tu-surprise-bar alt"><span class="fill" style="width:${Math.round(((v2||0)/max)*100)}%"></span><span class="label-inside">${escapeHtml(c2)}</span></span>
              <span class="tu-surprise-bar-num">${fmtMin(v2)}</span>
            </div>
          </div>`;
      } else if (s.compare_sex) {
        const [k1, k2] = s.compare_sex;
        const cell = DATA.cohorts[s.cohort]?.[s.activity] || {};
        const v1 = cell[`${k1}_min`];
        const v2 = cell[`${k2}_min`];
        const max = Math.max(v1 || 0, v2 || 0) || 1;
        inner = `
          <div class="tu-surprise-bars">
            <div class="tu-surprise-bar-row">
              <span class="tu-surprise-bar"><span class="fill" style="width:${Math.round(((v1||0)/max)*100)}%"></span><span class="label-inside">${escapeHtml(k1)}</span></span>
              <span class="tu-surprise-bar-num">${fmtMin(v1)}</span>
            </div>
            <div class="tu-surprise-bar-row">
              <span class="tu-surprise-bar alt"><span class="fill" style="width:${Math.round(((v2||0)/max)*100)}%"></span><span class="label-inside">${escapeHtml(k2)}</span></span>
              <span class="tu-surprise-bar-num">${fmtMin(v2)}</span>
            </div>
          </div>`;
      } else {
        const v = DATA.cohorts[s.cohort]?.[s.activity]?.total_min;
        const max = 300; // fixed scale for single-value reveal
        inner = `
          <div class="tu-surprise-bars">
            <div class="tu-surprise-bar-row">
              <span class="tu-surprise-bar"><span class="fill" style="width:${Math.round(((v||0)/max)*100)}%"></span><span class="label-inside">${escapeHtml(s.cohort)}</span></span>
              <span class="tu-surprise-bar-num">${fmtMin(v)}</span>
            </div>
          </div>`;
      }
      return `
        <div class="tu-surprise-card">
          <div class="mono tu-surprise-fig">No. ${fig} · ${escapeHtml(s.activity)}</div>
          <h3 class="tu-surprise-title">${escapeHtml(s.title)}</h3>
          ${inner}
        </div>`;
    }).join('');
    $surprises.innerHTML = out;
  }

  // ── Receipts ───────────────────────────────────────────────
  async function drawReceipts() {
    if (!$receipts) return;
    try {
      const r = await fetch('/assets/data/time-use/methodology.json', { cache: 'no-cache' });
      const m = r.ok ? await r.json() : {};
      const cells = [
        { label: 'Cohorts indexed',  value: m.cohort_count ?? '—' },
        { label: 'Activity buckets', value: m.activity_buckets ?? '—' },
        { label: 'Years pooled',     value: m.years_pooled ?? '—' },
        { label: 'Last refresh',     value: (m.last_refresh || '').split('T')[0] || '—' },
      ];
      $receipts.innerHTML = cells.map(c => `
        <div class="tu-receipt">
          <div class="tu-receipt-label">${escapeHtml(c.label)}</div>
          <div class="tu-receipt-value">${escapeHtml(c.value)}</div>
        </div>
      `).join('');
    } catch {
      $receipts.innerHTML = '';
    }
  }

  // ── Bootstrap ──────────────────────────────────────────────
  load().then(() => {
    buildPicker();
    buildCompare();
    drawSurprises();
    drawReceipts();
  }).catch(err => {
    console.error('time-use-lab: data load failed', err);
  });
})();
