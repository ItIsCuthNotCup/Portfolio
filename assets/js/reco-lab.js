(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     RECO LAB — page logic
     Loads 6 JSON artifacts, renders the Flixer interactive grid,
     aggregates similarity neighbours per click, swaps algorithms,
     and draws a live taste vector + divergence panel — all in-browser.
     ═══════════════════════════════════════════════════════════ */

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const DATA_BASE = '/assets/data/reco/';

  const FILES = [
    'movies', 'rows', 'methodology',
    'similarity_content', 'similarity_collab', 'similarity_hybrid',
  ];

  // Runtime state shared across renderers
  const state = {
    movies: null,              // Map<id, movie>
    moviesArr: [],             // array
    rows: [],                  // curated row definitions from rows.json
    neighbors: {               // { content, collab, hybrid } → {movieId: [[nid, sim], ...]}
      content: null, collab: null, hybrid: null,
    },
    methodology: null,
    alg: 'content',            // current algorithm
    liked: new Set(),          // movieIds the user has clicked
    lazyObs: null,             // IntersectionObserver for poster images
  };

  // ── Fetch all artifacts in parallel ─────────────────────────
  Promise.all(FILES.map(name =>
    fetch(DATA_BASE + name + '.json').then(r => {
      if (!r.ok) throw new Error('fetch failed: ' + name);
      return r.json();
    })
  )).then(results => {
    const d = {};
    FILES.forEach((name, i) => { d[name] = results[i]; });
    window.__reco = d;                    // handy for console debugging
    init(d);
  }).catch(err => {
    console.error('[reco-lab] artifact load failed', err);
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div style="position:fixed;bottom:20px;right:20px;padding:12px 16px;background:var(--paper-2);border:1px solid var(--ink);font-family:DM Mono,monospace;font-size:11px;">could not load recommender data — try a hard refresh</div>'
    );
  });

  // ── Main ─────────────────────────────────────────────────────
  function init(d) {
    // Index movies by id for O(1) lookup
    state.moviesArr = d.movies.movies;
    state.movies = new Map(state.moviesArr.map(m => [m.id, m]));
    state.rows = d.rows.rows;
    state.methodology = d.methodology;
    state.neighbors.content = d.similarity_content.neighbors;
    state.neighbors.collab = d.similarity_collab.neighbors;
    state.neighbors.hybrid = d.similarity_hybrid.neighbors;

    // Lazy loading for posters
    setupLazyLoader();

    // Hero stats + methodology panel
    renderDateline();
    renderHeroStats();
    renderReceipts();

    // Build the rows
    renderRows();

    // Wire up the algorithm toggle and reset button
    wireControls();

    // Initial empty states for the viz panels
    updateAlgoCards();
    updateTasteChart();
    updateDivergencePanel();
  }

  // ═══════════════════════════════════════════════════════════
  // UTIL
  // ═══════════════════════════════════════════════════════════
  function cleanTitle(title) {
    // "Godfather, The (1972)" style → "The Godfather"
    const noYear = title.replace(/\s*\(\d{4}\)$/, '');
    return noYear.replace(/^(.*),\s(The|A|An)$/i, '$2 $1');
  }

  function setupLazyLoader() {
    if (typeof IntersectionObserver === 'undefined') return;  // ancient browsers
    state.lazyObs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        const src = img.getAttribute('data-src');
        if (src) {
          img.src = src;
          img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
          img.addEventListener('error', () => img.remove(), { once: true });
        }
        state.lazyObs.unobserve(img);
      });
    }, { rootMargin: '200px 0px' });
  }

  function lazyObserve(img) {
    if (state.lazyObs) state.lazyObs.observe(img);
    else { img.src = img.getAttribute('data-src'); img.classList.add('loaded'); }
  }

  // ═══════════════════════════════════════════════════════════
  // DATELINE / HERO STATS
  // ═══════════════════════════════════════════════════════════
  function renderDateline() {
    const el = document.getElementById('dateline-time');
    if (!el) return;
    const now = new Date();
    const fmt = now.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
    el.textContent = fmt;
  }

  function renderHeroStats() {
    const m = state.methodology;
    const rEl = document.getElementById('stat-ratings');
    const uEl = document.getElementById('stat-users');
    if (rEl) rEl.textContent = Number(m.num_ratings).toLocaleString();
    if (uEl) uEl.textContent = Number(m.num_users).toLocaleString();

    const regEl = document.getElementById('regenerated-at');
    if (regEl && m.regenerated_at) {
      regEl.textContent = new Date(m.regenerated_at)
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    const alphaEl = document.getElementById('hybrid-alpha-val');
    if (alphaEl && typeof m.hybrid_alpha === 'number') {
      alphaEl.textContent = 'α = ' + m.hybrid_alpha;
    }
  }

  function renderReceipts() {
    const m = state.methodology;
    const grid = document.getElementById('receipts-grid');
    if (!grid) return;
    const items = [
      { v: Number(m.num_ratings).toLocaleString(),    l: 'ratings in corpus' },
      { v: Number(m.num_users).toLocaleString(),      l: 'MovieLens users' },
      { v: Number(m.num_movies_total).toLocaleString(), l: 'films before curation' },
      { v: Number(m.num_movies_displayed).toLocaleString(), l: 'titles indexed' },
      { v: Number(m.precomputed_pairs).toLocaleString(), l: 'precomputed pairs' },
      { v: '<1ms',                                    l: 'per-click latency' },
    ];
    grid.innerHTML = items.map(it =>
      `<div class="metric"><div class="serif metric-value">${it.v}</div><div class="mono metric-label">${it.l}</div></div>`
    ).join('');
  }

  // ═══════════════════════════════════════════════════════════
  // ROWS + POSTERS
  // ═══════════════════════════════════════════════════════════
  function renderRows() {
    const container = document.getElementById('flixer-rows');
    container.innerHTML = '';

    // Dynamic "Because you liked" row always renders first; starts as
    // Top Picks from rows.json
    const seed = state.rows.find(r => r.id === 'top-picks');
    const topRow = buildRow({
      id: 'because',
      title: 'Top Picks',
      subtitle: 'globally top-rated — start clicking',
      ids: seed ? seed.ids : [],
    });
    topRow.classList.add('flixer-row-dynamic');
    container.appendChild(topRow);

    // Static curated rows — genres + decades
    state.rows
      .filter(r => r.id !== 'top-picks')
      .forEach(r => {
        container.appendChild(buildRow({
          id: r.id,
          title: r.title,
          subtitle: r.kind,
          ids: r.ids,
        }));
      });
  }

  function buildRow({ id, title, subtitle, ids }) {
    const row = document.createElement('div');
    row.className = 'flixer-row';
    row.dataset.rowId = id;

    const head = document.createElement('div');
    head.className = 'flixer-row-head';
    head.innerHTML =
      `<h3 class="flixer-row-title">${escapeHtml(title)}</h3>` +
      `<span class="flixer-row-kind">${escapeHtml(subtitle || '')}</span>`;
    row.appendChild(head);

    const scroll = document.createElement('div');
    scroll.className = 'flixer-row-scroll';
    ids.forEach(mid => {
      const movie = state.movies.get(mid);
      if (movie) scroll.appendChild(makePoster(movie));
    });
    row.appendChild(scroll);
    return row;
  }

  function makePoster(movie) {
    const poster = document.createElement('div');
    poster.className = 'poster';
    poster.dataset.movieId = String(movie.id);
    if (state.liked.has(movie.id)) poster.classList.add('liked');

    if (movie.poster) {
      const img = document.createElement('img');
      img.alt = movie.title;
      img.setAttribute('data-src', movie.poster);
      img.loading = 'lazy';
      poster.appendChild(img);
      lazyObserve(img);
    } else {
      // Placeholder (notebook ran without TMDB key) — typography fallback
      const ph = document.createElement('div');
      ph.className = 'poster-placeholder';
      ph.innerHTML =
        `<div class="ph-title">${escapeHtml(cleanTitle(movie.title))}</div>` +
        `<div class="ph-year">${movie.year || ''}</div>`;
      poster.appendChild(ph);
    }

    poster.addEventListener('click', () => handleLike(movie.id));
    poster.addEventListener('mouseenter', (e) => showTooltip(e, movie));
    poster.addEventListener('mousemove', moveTooltip);
    poster.addEventListener('mouseleave', hideTooltip);
    return poster;
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ═══════════════════════════════════════════════════════════
  // INTERACTIONS
  // ═══════════════════════════════════════════════════════════
  function handleLike(mid) {
    if (state.liked.has(mid)) state.liked.delete(mid);
    else state.liked.add(mid);

    // Update poster visual state everywhere it appears
    document.querySelectorAll(`.poster[data-movie-id="${mid}"]`).forEach(el => {
      el.classList.toggle('liked', state.liked.has(mid));
    });

    // Re-render dynamic row + panels
    updateBecauseRow();
    updateTasteChart();
    updateDivergencePanel();
    updateLikesCount();
  }

  function wireControls() {
    // Algorithm toggle
    document.querySelectorAll('.algo-toggle button').forEach(btn => {
      btn.addEventListener('click', () => {
        const alg = btn.dataset.alg;
        if (alg === state.alg) return;
        state.alg = alg;
        document.querySelectorAll('.algo-toggle button').forEach(b =>
          b.setAttribute('aria-selected', b === btn ? 'true' : 'false')
        );
        updateAlgoCards();
        updateBecauseRow();
        // Divergence panel doesn't change because it shows all 3 — but
        // re-render to avoid any staleness.
        updateDivergencePanel();
      });
    });

    // Reset
    const reset = document.getElementById('reset-btn');
    if (reset) reset.addEventListener('click', () => {
      state.liked.clear();
      document.querySelectorAll('.poster.liked').forEach(el => el.classList.remove('liked'));
      updateBecauseRow();
      updateTasteChart();
      updateDivergencePanel();
      updateLikesCount();
    });
  }

  function updateLikesCount() {
    const el = document.getElementById('likes-count');
    if (el) el.textContent = String(state.liked.size);
    const cap = document.getElementById('flixer-caption');
    if (cap) {
      if (state.liked.size === 0) {
        cap.textContent = 'Seeded with globally top-rated titles. Start clicking — the top row will become yours.';
      } else {
        cap.textContent = `Top row ranked by ${state.alg} similarity aggregated across your ${state.liked.size} liked title${state.liked.size === 1 ? '' : 's'}.`;
      }
    }
  }

  function updateAlgoCards() {
    document.querySelectorAll('.algo-card').forEach(c => {
      c.classList.toggle('active', c.dataset.alg === state.alg);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // AGGREGATE NEIGHBOURS — the core ranking
  // ═══════════════════════════════════════════════════════════
  /**
   * Given a set of liked movieIds and an algorithm, return the top-N
   * recommended movieIds ranked by summed similarity, with per-rec
   * explainability metadata.
   *
   * @returns [{id, score, topBecause: [{likedId, sim}, ...]}]
   */
  function recommend(likedIds, alg, n = 20) {
    if (!likedIds || likedIds.length === 0) return [];
    const neighbors = state.neighbors[alg];
    const scores = new Map();        // movieId → summed similarity
    const because = new Map();       // movieId → [{likedId, sim}, ...]

    for (const liked of likedIds) {
      const neigh = neighbors[String(liked)];
      if (!neigh) continue;
      for (const [nid, sim] of neigh) {
        if (likedIds.includes(nid)) continue;  // skip already-liked
        scores.set(nid, (scores.get(nid) || 0) + sim);
        const list = because.get(nid) || [];
        list.push({ likedId: liked, sim });
        because.set(nid, list);
      }
    }

    const ranked = [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([id, score]) => {
        const srcList = (because.get(id) || [])
          .sort((a, b) => b.sim - a.sim)
          .slice(0, 3);
        return { id, score, topBecause: srcList };
      });
    return ranked;
  }

  // ═══════════════════════════════════════════════════════════
  // THE DYNAMIC "BECAUSE YOU LIKED" ROW
  // ═══════════════════════════════════════════════════════════
  function updateBecauseRow() {
    const row = document.querySelector('[data-row-id="because"]');
    if (!row) return;

    const liked = [...state.liked];
    const title = row.querySelector('.flixer-row-title');
    const kind = row.querySelector('.flixer-row-kind');
    const scroll = row.querySelector('.flixer-row-scroll');

    scroll.innerHTML = '';

    if (liked.length === 0) {
      // Fallback: re-use top picks
      title.innerHTML = 'Top Picks';
      kind.textContent = 'globally top-rated — start clicking';
      const seed = state.rows.find(r => r.id === 'top-picks');
      if (seed) seed.ids.forEach(id => {
        const m = state.movies.get(id);
        if (m) scroll.appendChild(makePoster(m));
      });
      return;
    }

    const recs = recommend(liked, state.alg, 20);
    if (recs.length === 0) {
      title.innerHTML = 'Top Picks';
      kind.textContent = 'no neighbours found — pick more';
      return;
    }

    // Title: "Because you liked Blade Runner"
    const primary = state.movies.get(liked[liked.length - 1]);
    title.innerHTML =
      `Because you liked <em>${escapeHtml(cleanTitle(primary.title))}</em>`;
    kind.textContent = state.alg;

    recs.forEach(rec => {
      const movie = state.movies.get(rec.id);
      if (!movie) return;
      const p = makePoster(movie);
      p.dataset.reason = JSON.stringify(rec.topBecause);
      scroll.appendChild(p);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // TOOLTIP (hover explainability)
  // ═══════════════════════════════════════════════════════════
  const tooltipEl = document.getElementById('reco-tooltip');

  function showTooltip(e, movie) {
    if (!tooltipEl) return;
    const poster = e.currentTarget;
    const reasonJSON = poster.dataset.reason;

    let becauseHtml = '';
    if (reasonJSON) {
      try {
        const because = JSON.parse(reasonJSON);
        if (because.length) {
          const top = because[0];
          const src = state.movies.get(top.likedId);
          if (src) {
            becauseHtml =
              `<div class="tt-because">Because you liked <em>${escapeHtml(cleanTitle(src.title))}</em> · sim ${top.sim.toFixed(2)}</div>`;
          }
        }
      } catch (_) { /* noop */ }
    }

    const genres = (movie.genres || []).slice(0, 3).join(' · ');
    const ratingStr = movie.avg_rating
      ? `★ ${movie.avg_rating.toFixed(1)} · ${movie.num_ratings} ratings`
      : '';

    tooltipEl.innerHTML =
      `<div><span class="tt-title">${escapeHtml(cleanTitle(movie.title))}</span>` +
      `<span class="tt-year">${movie.year || ''}</span></div>` +
      `<div class="tt-meta">${escapeHtml(genres)}${genres && ratingStr ? ' · ' : ''}${ratingStr}</div>` +
      becauseHtml;

    tooltipEl.setAttribute('data-show', 'true');
    tooltipEl.setAttribute('aria-hidden', 'false');
    moveTooltip(e);
  }

  function moveTooltip(e) {
    if (!tooltipEl || tooltipEl.getAttribute('data-show') !== 'true') return;
    const pad = 14;
    const rect = tooltipEl.getBoundingClientRect();
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    if (x + rect.width > window.innerWidth - 8) x = e.clientX - rect.width - pad;
    if (y + rect.height > window.innerHeight - 8) y = e.clientY - rect.height - pad;
    tooltipEl.style.left = `${x}px`;
    tooltipEl.style.top = `${y}px`;
  }

  function hideTooltip() {
    if (!tooltipEl) return;
    tooltipEl.setAttribute('data-show', 'false');
    tooltipEl.setAttribute('aria-hidden', 'true');
  }

  // ═══════════════════════════════════════════════════════════
  // TASTE VECTOR — SVG horizontal bars
  // ═══════════════════════════════════════════════════════════
  function updateTasteChart() {
    const svg = document.getElementById('taste-chart');
    const empty = document.getElementById('taste-empty');
    if (!svg) return;

    const liked = [...state.liked];
    if (liked.length === 0) {
      svg.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }
    if (empty) empty.classList.add('hidden');

    // Aggregate genre weights across liked movies
    const weights = new Map();
    let total = 0;
    for (const id of liked) {
      const m = state.movies.get(id);
      if (!m || !m.genres) continue;
      for (const g of m.genres) {
        weights.set(g, (weights.get(g) || 0) + 1);
        total += 1;
      }
    }
    if (total === 0) { svg.innerHTML = ''; return; }

    const sorted = [...weights.entries()]
      .map(([g, w]) => ({ g, w, pct: w / total }))
      .sort((a, b) => b.w - a.w)
      .slice(0, 10);

    // Render
    const W = 900, H = 420;
    const labelW = 180;
    const barsLeft = labelW + 20;
    const barsRight = W - 80;
    const top = 20;
    const rowH = Math.min(38, (H - 40) / Math.max(1, sorted.length));

    svg.innerHTML = '';
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const maxPct = Math.max(...sorted.map(s => s.pct));

    sorted.forEach((s, i) => {
      const y = top + i * rowH;
      const barW = ((s.pct / maxPct) * (barsRight - barsLeft));

      // Label (genre)
      const label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('x', labelW);
      label.setAttribute('y', y + rowH * 0.6);
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('font-family', 'Newsreader, serif');
      label.setAttribute('font-size', '16');
      label.setAttribute('fill', 'var(--ink)');
      label.textContent = s.g;
      svg.appendChild(label);

      // Bar background
      const bg = document.createElementNS(SVG_NS, 'rect');
      bg.setAttribute('x', barsLeft);
      bg.setAttribute('y', y + rowH * 0.25);
      bg.setAttribute('width', barsRight - barsLeft);
      bg.setAttribute('height', rowH * 0.5);
      bg.setAttribute('fill', 'var(--rule)');
      svg.appendChild(bg);

      // Bar
      const bar = document.createElementNS(SVG_NS, 'rect');
      bar.setAttribute('x', barsLeft);
      bar.setAttribute('y', y + rowH * 0.25);
      bar.setAttribute('width', Math.max(1, barW));
      bar.setAttribute('height', rowH * 0.5);
      bar.setAttribute('fill', i === 0 ? 'var(--accent)' : 'var(--ink)');
      svg.appendChild(bar);

      // Value
      const val = document.createElementNS(SVG_NS, 'text');
      val.setAttribute('x', barsLeft + barW + 10);
      val.setAttribute('y', y + rowH * 0.6);
      val.setAttribute('font-family', 'DM Mono, monospace');
      val.setAttribute('font-size', '11');
      val.setAttribute('fill', 'var(--ink-soft)');
      val.textContent = `${(s.pct * 100).toFixed(0)}%`;
      svg.appendChild(val);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // DIVERGENCE PANEL — algorithms side by side
  // ═══════════════════════════════════════════════════════════
  function updateDivergencePanel() {
    const wrap = document.getElementById('divergence-wrap');
    const empty = document.getElementById('divergence-empty');
    if (!wrap) return;

    const liked = [...state.liked];

    // Wipe existing summary/cols but keep empty-state element
    [...wrap.children].forEach(c => {
      if (c.id !== 'divergence-empty') c.remove();
    });

    if (liked.length === 0) {
      if (empty) empty.classList.remove('hidden');
      return;
    }
    if (empty) empty.classList.add('hidden');

    const algs = [
      { key: 'content', label: 'Content-based' },
      { key: 'collab',  label: 'Collaborative' },
      { key: 'hybrid',  label: 'Hybrid' },
    ];
    const recs = {};
    algs.forEach(a => {
      recs[a.key] = recommend(liked, a.key, 10).map(r => r.id);
    });

    // Overlaps
    const inAll = recs.content.filter(id => recs.collab.includes(id) && recs.hybrid.includes(id));
    const inTwo = new Set();
    for (const list of [recs.content, recs.collab, recs.hybrid]) {
      for (const id of list) {
        let n = 0;
        if (recs.content.includes(id)) n++;
        if (recs.collab.includes(id)) n++;
        if (recs.hybrid.includes(id)) n++;
        if (n >= 2 && !inAll.includes(id)) inTwo.add(id);
      }
    }

    // Pairwise Jaccard overlaps (for the summary row)
    const jaccard = (a, b) => {
      const setA = new Set(a), setB = new Set(b);
      const inter = [...setA].filter(x => setB.has(x)).length;
      const union = new Set([...setA, ...setB]).size;
      return union === 0 ? 0 : inter / union;
    };

    const summary = document.createElement('div');
    summary.className = 'divergence-summary';
    summary.innerHTML = `
      <div class="divergence-stat"><div class="stat-value">${inAll.length}</div><div class="stat-label">all three agree</div></div>
      <div class="divergence-stat"><div class="stat-value">${(jaccard(recs.content, recs.collab) * 100).toFixed(0)}%</div><div class="stat-label">content vs collab</div></div>
      <div class="divergence-stat"><div class="stat-value">${(jaccard(recs.content, recs.hybrid) * 100).toFixed(0)}%</div><div class="stat-label">content vs hybrid</div></div>
      <div class="divergence-stat"><div class="stat-value">${(jaccard(recs.collab, recs.hybrid) * 100).toFixed(0)}%</div><div class="stat-label">collab vs hybrid</div></div>
    `;
    wrap.appendChild(summary);

    // Three columns
    const cols = document.createElement('div');
    cols.className = 'divergence-cols';
    algs.forEach(a => {
      const col = document.createElement('div');
      col.className = 'divergence-col';
      const listHtml = recs[a.key].map((id, i) => {
        const m = state.movies.get(id);
        if (!m) return '';
        let cls = 'unique';
        let mark = 'only this';
        if (inAll.includes(id)) { cls = 'consensus-all'; mark = 'all'; }
        else if (inTwo.has(id)) { cls = 'consensus-two'; mark = '2 of 3'; }
        return `<li class="${cls}"><span class="rank">${String(i + 1).padStart(2, '0')}</span><span>${escapeHtml(cleanTitle(m.title))}</span><span class="mark">${mark}</span></li>`;
      }).join('');
      col.innerHTML = `<h4>${a.label}</h4><ol>${listHtml}</ol>`;
      cols.appendChild(col);
    });
    wrap.appendChild(cols);
  }

})();
