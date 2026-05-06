/* ═══════════════════════════════════════════════════════════
   RESEARCH INDEX — search filter across all bands
   - One sticky search input filters every card by substring
   - Bands with zero matches collapse via [hidden]
   - Atlas callout collapses when its band collapses
   - Live readout of total visible
   - Hash routing: /#models, /#stories, /#papers, /#primers scroll
     to the respective band; /#research scrolls to the index head
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

  ready(function init() {
    var index = document.getElementById('research');
    if (!index) return;
    var searchEl = document.getElementById('research-search-input');
    var readoutEl = document.getElementById('research-readout');
    var emptyEl = document.getElementById('research-empty');
    var bands = Array.prototype.slice.call(index.querySelectorAll('.research-band'));

    // Build per-card haystacks (lowercased) for fast substring matching
    var cards = Array.prototype.slice.call(index.querySelectorAll('.lab-card, .primer-row'));
    var hay = cards.map(function (c) {
      var name = (c.querySelector('.lab-name, .primer-name') || {}).textContent || '';
      var line = (c.querySelector('.lab-line, .primer-line') || {}).textContent || '';
      var metric = (c.querySelector('.lab-metric') || {}).textContent || '';
      var fig = (c.querySelector('.lab-fig, .primer-fig') || {}).textContent || '';
      var tags = c.getAttribute('data-tags') || '';
      return (name + ' ' + line + ' ' + metric + ' ' + fig + ' ' + tags).toLowerCase();
    });
    var total = cards.length;

    function applyFilter() {
      var q = (searchEl ? searchEl.value : '').trim().toLowerCase();
      var visible = 0;

      // Toggle each card
      for (var i = 0; i < cards.length; i++) {
        var match = !q || hay[i].indexOf(q) !== -1;
        cards[i].classList.toggle('is-filtered-out', !match);
        if (match) visible++;
      }

      // Collapse bands that have no visible cards (when filtering)
      bands.forEach(function (band) {
        if (!q) {
          band.removeAttribute('hidden');
          return;
        }
        var any = band.querySelector('.lab-card:not(.is-filtered-out), .primer-row:not(.is-filtered-out)');
        if (any) band.removeAttribute('hidden');
        else band.setAttribute('hidden', '');
      });

      // Readout
      if (readoutEl) {
        if (q) {
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

    if (searchEl) {
      var t;
      searchEl.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(applyFilter, 80);
      });
    }

    // Initial
    applyFilter();

    // Smooth scroll for in-page jumps
    function smoothScrollTo(hash) {
      var el = document.querySelector(hash);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    document.querySelectorAll('a[href^="/#"], a[href^="#"]').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      var hashOnly = href.startsWith('#') ? href : (href.startsWith('/#') ? href.slice(1) : '');
      if (!hashOnly || hashOnly.length < 2) return;
      // Only intercept if the target exists on this page
      if (!document.querySelector(hashOnly)) return;
      a.addEventListener('click', function (e) {
        var t = document.querySelector(hashOnly);
        if (!t) return;
        e.preventDefault();
        smoothScrollTo(hashOnly);
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', hashOnly);
        }
      });
    });

    // Honor hash on load
    if (window.location.hash && document.querySelector(window.location.hash)) {
      // Defer to after layout settles
      setTimeout(function () {
        smoothScrollTo(window.location.hash);
      }, 50);
    }
  });
})();
