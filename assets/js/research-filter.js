/* ═══════════════════════════════════════════════════════════
   RESEARCH FILTER — homepage chips + search
   - Single-select category chips
   - Substring search across name + lab-line + tags
   - URL hash routing (/#research?cat=ai-economy) for deep links
     from the masthead and from external links
   - No history pollution; uses replaceState
   - Pure DOM filter via classList toggle on .lab-card
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
    // Accept patterns: #research, #research?cat=ai-economy, #research?cat=...&q=...
    var h = window.location.hash || '';
    var out = { cat: 'all', q: '' };
    if (!h.startsWith('#research')) return out;
    var qIdx = h.indexOf('?');
    if (qIdx === -1) return out;
    var query = h.slice(qIdx + 1);
    query.split('&').forEach(function (kv) {
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
    } else {
      window.location.hash = hash;
    }
  }

  ready(function init() {
    var grid = document.getElementById('research-grid');
    if (!grid) return;
    var chipsEl = document.getElementById('research-chips');
    var searchEl = document.getElementById('research-search-input');
    var readoutEl = document.getElementById('research-readout');
    var emptyEl = document.getElementById('research-empty');
    if (!chipsEl || !searchEl) return;

    var cards = Array.prototype.slice.call(grid.querySelectorAll('.lab-card'));
    var total = cards.length;

    // Pre-build a haystack per card for fast substring search
    var hayPerCard = cards.map(function (c) {
      var name = (c.querySelector('.lab-name') || {}).textContent || '';
      var line = (c.querySelector('.lab-line') || {}).textContent || '';
      var metric = (c.querySelector('.lab-metric') || {}).textContent || '';
      var tags = c.getAttribute('data-tags') || '';
      return (name + ' ' + line + ' ' + metric + ' ' + tags).toLowerCase();
    });

    var state = parseHash();

    function applyFilter() {
      var cat = state.cat || 'all';
      var q = (state.q || '').trim().toLowerCase();
      var visible = 0;
      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var cardCat = card.getAttribute('data-category') || '';
        var matchesCat = (cat === 'all') || (cardCat === cat);
        var matchesQ = !q || hayPerCard[i].indexOf(q) !== -1;
        var visible_i = matchesCat && matchesQ;
        card.classList.toggle('is-filtered-out', !visible_i);
        if (visible_i) visible++;
      }

      // Update chip active state
      Array.prototype.forEach.call(chipsEl.querySelectorAll('.research-chip'), function (b) {
        b.classList.toggle('is-active', b.getAttribute('data-cat') === cat);
      });

      // Update readout
      if (readoutEl) {
        if (q || cat !== 'all') {
          readoutEl.innerHTML = '<strong>' + visible + '</strong> of ' + total + ' shown';
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

    // Wire search input
    if (state.q) searchEl.value = state.q;
    var searchTimer;
    searchEl.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        state.q = searchEl.value;
        writeHash(state);
        applyFilter();
      }, 90);
    });

    // Re-apply on hashchange (e.g., user clicks the masthead Research dropdown)
    window.addEventListener('hashchange', function () {
      var next = parseHash();
      state.cat = next.cat;
      state.q = next.q;
      if (searchEl.value !== state.q) searchEl.value = state.q;
      applyFilter();
      // Scroll into view if hash points to research
      if (window.location.hash.indexOf('#research') === 0) {
        var sec = document.getElementById('research');
        if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    // Initial apply
    applyFilter();
  });
})();
