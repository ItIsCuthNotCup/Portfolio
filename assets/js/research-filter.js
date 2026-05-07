/* ═══════════════════════════════════════════════════════════
   RESEARCH INDEX — chip filter + search + click animation

   - Single-select category chips. Active chip filters the grid.
   - Substring search across name + line + metric + tags.
   - Hash routing: /#research?cat=p loads with Papers preselected.
   - Click animation: tile zooms into viewport (is-launching), then
     navigates. Disabled with prefers-reduced-motion.
   - Stagger entry via --idx custom property on each tile.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function parseHash() {
    var h = window.location.hash || '';
    var out = { cat: 'all', q: '' };
    if (!h.startsWith('#research')) return out;
    var qIdx = h.indexOf('?');
    if (qIdx === -1) return out;
    h.slice(qIdx + 1).split('&').forEach(function (kv) {
      var eq = kv.indexOf('=');
      if (eq === -1) return;
      var k = decodeURIComponent(kv.slice(0, eq));
      var v = decodeURIComponent(kv.slice(eq + 1));
      if (k === 'cat') out.cat = v;
      else if (k === 'q') out.q = v;
    });
    return out;
  }

  function writeHash(state) {
    var parts = [];
    if (state.cat && state.cat !== 'all') parts.push('cat=' + encodeURIComponent(state.cat));
    if (state.q) parts.push('q=' + encodeURIComponent(state.q));
    var hash = '#research' + (parts.length ? '?' + parts.join('&') : '');
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', hash);
    }
  }

  ready(function init() {
    var index = document.getElementById('research');
    if (!index) return;

    var grid = document.getElementById('tile-grid');
    var chipsEl = document.getElementById('research-chips');
    var searchEl = document.getElementById('research-search-input');
    var readoutEl = document.getElementById('research-readout');
    var emptyEl = document.getElementById('research-empty');
    if (!grid || !chipsEl) return;

    var tiles = Array.prototype.slice.call(grid.querySelectorAll('.tile'));

    // Pre-build per-tile haystacks for fast substring search
    var hay = tiles.map(function (t) {
      var name = (t.querySelector('.tile-name') || {}).textContent || '';
      var fig = (t.querySelector('.tile-fig') || {}).textContent || '';
      var line = (t.querySelector('.tile-line') || {}).textContent || '';
      var metric = (t.querySelector('.tile-metric') || {}).textContent || '';
      var tags = t.getAttribute('data-tags') || '';
      var cat = t.getAttribute('data-cat') || '';
      return (name + ' ' + fig + ' ' + line + ' ' + metric + ' ' + tags + ' ' + cat).toLowerCase();
    });

    var total = tiles.length;

    // Set --idx on each tile for the staggered entry animation
    tiles.forEach(function (t, i) {
      t.style.setProperty('--idx', String(i));
    });

    var state = parseHash();
    if (searchEl && state.q) searchEl.value = state.q;

    function applyFilter() {
      var cat = state.cat || 'all';
      var q = (state.q || '').trim().toLowerCase();
      var visible = 0;

      for (var i = 0; i < tiles.length; i++) {
        var tCat = tiles[i].getAttribute('data-cat') || '';
        var matchCat = (cat === 'all') || (tCat === cat);
        var matchQ = !q || hay[i].indexOf(q) !== -1;
        var visible_i = matchCat && matchQ;
        tiles[i].classList.toggle('is-filtered-out', !visible_i);
        if (visible_i) visible++;
      }

      // Update chip active state
      Array.prototype.forEach.call(chipsEl.querySelectorAll('.research-chip'), function (b) {
        b.classList.toggle('is-active', (b.getAttribute('data-cat') || 'all') === cat);
      });

      // Readout
      if (readoutEl) {
        if (q || cat !== 'all') {
          readoutEl.innerHTML = '<strong>' + visible + '</strong> of ' + total;
        } else {
          readoutEl.innerHTML = '<strong>' + total + '</strong> labs';
        }
      }

      // Empty state
      if (emptyEl) {
        emptyEl.classList.toggle('is-visible', visible === 0);
      }
    }

    // Wire chip clicks
    Array.prototype.forEach.call(chipsEl.querySelectorAll('.research-chip'), function (b) {
      b.addEventListener('click', function () {
        state.cat = b.getAttribute('data-cat') || 'all';
        writeHash(state);
        applyFilter();
      });
    });

    // Wire search input (debounced)
    if (searchEl) {
      var t;
      searchEl.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () {
          state.q = searchEl.value;
          writeHash(state);
          applyFilter();
        }, 80);
      });
    }

    // Hash change → re-apply (for back/forward nav and external links)
    window.addEventListener('hashchange', function () {
      var next = parseHash();
      state.cat = next.cat;
      state.q = next.q;
      if (searchEl && searchEl.value !== state.q) searchEl.value = state.q;
      applyFilter();
    });

    /* ── Click animation: zoom into page ────────────────────
       Intercept primary left-clicks. Add .is-launching to the
       tile (CSS scales it up + fades to 0). After the animation
       completes, navigate. Right-click, middle-click, modifier-
       click bypass (browser handles natively).
    ──────────────────────────────────────────────────────── */
    var REDUCE_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var LAUNCH_MS = REDUCE_MOTION ? 0 : 380;

    tiles.forEach(function (t) {
      t.addEventListener('click', function (e) {
        // Bypass for non-primary, modifier, or auxiliary clicks
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (e.button !== undefined && e.button !== 0) return;

        var href = t.getAttribute('href');
        if (!href) return;

        if (REDUCE_MOTION) return;  // let normal navigation happen

        e.preventDefault();
        t.classList.add('is-launching');

        // Slightly dim other tiles for focus
        tiles.forEach(function (other) {
          if (other !== t) other.style.opacity = '0.4';
        });

        setTimeout(function () {
          window.location.href = href;
        }, LAUNCH_MS);
      });
    });

    applyFilter();
  });
})();
