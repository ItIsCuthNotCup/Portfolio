/* ═══════════════════════════════════════════════════════════
   CLAUDE SKILLS LAB — S11
   Three jobs:
   - Set the dateline
   - Power the four chart tooltips:
       Chart 1: power-law bar chart (hover row → repo details)
       Chart 3: 2x2 quadrant scatter (hover bubble → skill details)
       Chart 4: verb frequency (hover bar → example descriptions)
   - Animate the timeline area chart on first scroll into view
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

  /* ── Shared tooltip ────────────────────────────────────── */
  function makeTooltip(host) {
    var tip = document.createElement('div');
    tip.className = 'cs-tooltip';
    tip.setAttribute('role', 'tooltip');
    host.appendChild(tip);
    return {
      el: tip,
      show: function (html, x, y) {
        tip.innerHTML = html;
        var rect = host.getBoundingClientRect();
        var tw = tip.offsetWidth || 240;
        // Clamp to host width
        var left = Math.max(8, Math.min(x - tw / 2, rect.width - tw - 8));
        var top = y - tip.offsetHeight - 14;
        if (top < 8) top = y + 18;
        tip.style.left = left + 'px';
        tip.style.top = top + 'px';
        tip.classList.add('is-visible');
      },
      hide: function () { tip.classList.remove('is-visible'); }
    };
  }

  function svgRowCoords(el, host) {
    // For a hovered group/element inside an SVG, return approximate
    // (x, y) in host's local coordinate space for tooltip placement.
    var bbox = el.getBoundingClientRect();
    var hbox = host.getBoundingClientRect();
    return {
      x: bbox.left + bbox.width / 2 - hbox.left,
      y: bbox.top - hbox.top
    };
  }

  /* ── § II · Power-law bar chart tooltips ─────────────────── */
  (function wirePowerLaw() {
    var host = document.getElementById('cs-powerlaw-host');
    if (!host) return;
    var tip = makeTooltip(host);
    var rows = host.querySelectorAll('[data-row]');
    rows.forEach(function (row) {
      var name = row.getAttribute('data-name') || '';
      var stars = row.getAttribute('data-stars') || '';
      var author = row.getAttribute('data-author') || '';
      var note = row.getAttribute('data-note') || '';
      function show() {
        var html = '<strong>' + name + '</strong><br>' +
          stars + ' stars &middot; ' + author +
          (note ? '<br><span style="opacity:.75">' + note + '</span>' : '');
        var p = svgRowCoords(row, host);
        tip.show(html, p.x, p.y);
      }
      row.addEventListener('mouseenter', show);
      row.addEventListener('focus', show, true);
      row.addEventListener('mouseleave', tip.hide);
      row.addEventListener('blur', tip.hide, true);
    });
  })();

  /* ── § III · Surge timeline reveal ──────────────────────── */
  (function wireTimelineReveal() {
    var svg = document.getElementById('cs-timeline-svg');
    if (!svg) return;
    var areas = svg.querySelectorAll('[data-area]');
    if (!areas.length) return;
    areas.forEach(function (a) {
      a.style.transformOrigin = 'left center';
      a.style.transform = 'scaleX(0)';
      a.style.transition = 'transform 1100ms cubic-bezier(0.22, 0.61, 0.36, 1)';
    });
    function reveal() {
      areas.forEach(function (a, i) {
        setTimeout(function () { a.style.transform = 'scaleX(1)'; }, i * 180);
      });
    }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      areas.forEach(function (a) { a.style.transform = 'scaleX(1)'; });
      return;
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { reveal(); io.disconnect(); }
        });
      }, { threshold: 0.25 });
      io.observe(svg);
    } else {
      reveal();
    }
  })();

  /* ── § IV · 2x2 quadrant tooltips ───────────────────────── */
  (function wireQuadrant() {
    var host = document.getElementById('cs-quadrant-host');
    if (!host) return;
    var tip = makeTooltip(host);
    var bubbles = host.querySelectorAll('[data-bubble]');
    bubbles.forEach(function (b) {
      var name = b.getAttribute('data-name') || '';
      var author = b.getAttribute('data-author') || '';
      var stars = b.getAttribute('data-stars') || '';
      var why = b.getAttribute('data-why') || '';
      function show() {
        var html = '<strong>' + name + '</strong><br>' +
          author + ' &middot; ' + stars + ' stars' +
          (why ? '<br><span style="opacity:.75">' + why + '</span>' : '');
        var p = svgRowCoords(b, host);
        tip.show(html, p.x, p.y);
      }
      b.addEventListener('mouseenter', show);
      b.addEventListener('focus', show, true);
      b.addEventListener('mouseleave', tip.hide);
      b.addEventListener('blur', tip.hide, true);
    });
  })();

  /* ── § V · Verb frequency tooltips ──────────────────────── */
  (function wireVerbs() {
    var host = document.getElementById('cs-verbs-host');
    if (!host) return;
    var tip = makeTooltip(host);
    var rows = host.querySelectorAll('[data-verb]');
    rows.forEach(function (row) {
      var verb = row.getAttribute('data-verb') || '';
      var count = row.getAttribute('data-count') || '';
      var ex = row.getAttribute('data-example') || '';
      function show() {
        var html = '<strong>' + verb + '</strong> &middot; ' + count + ' of 100 sampled<br>' +
          (ex ? '<span style="opacity:.85">"' + ex + '"</span>' : '');
        var p = svgRowCoords(row, host);
        tip.show(html, p.x, p.y);
      }
      row.addEventListener('mouseenter', show);
      row.addEventListener('focus', show, true);
      row.addEventListener('mouseleave', tip.hide);
      row.addEventListener('blur', tip.hide, true);
    });
  })();
})();
