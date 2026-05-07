/* ═══════════════════════════════════════════════════════════
   AGENT MEMORY LAB — S12
   Three jobs:
   - Set the dateline
   - Power four chart tooltips:
       Chart 1 (§II)  scoreboard       — hover row → score + source
       Chart 2 (§III) Pareto scatter   — hover bubble → cost / latency / score
       Chart 3 (§IV)  decision quadrant — hover pill → stack + evidence
       Chart 4 (§V)   adoption bars    — hover row → funding + signal
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
    tip.className = 'am-tooltip';
    tip.setAttribute('role', 'tooltip');
    host.appendChild(tip);
    return {
      el: tip,
      show: function (html, x, y) {
        tip.innerHTML = html;
        var rect = host.getBoundingClientRect();
        var tw = tip.offsetWidth || 260;
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

  function svgCoords(el, host) {
    var bbox = el.getBoundingClientRect();
    var hbox = host.getBoundingClientRect();
    return {
      x: bbox.left + bbox.width / 2 - hbox.left,
      y: bbox.top - hbox.top
    };
  }

  /* ── §II · Scoreboard tooltips ──────────────────────────── */
  (function wireScoreboard() {
    var host = document.getElementById('am-scoreboard-host');
    if (!host) return;
    var tip = makeTooltip(host);
    var rows = host.querySelectorAll('[data-row]');
    rows.forEach(function (row) {
      var name = row.getAttribute('data-name') || '';
      var score = row.getAttribute('data-score') || '';
      var cls = row.getAttribute('data-class') || '';
      var src = row.getAttribute('data-source') || '';
      var note = row.getAttribute('data-note') || '';
      function show() {
        var html = '<strong>' + name + '</strong><br>' +
          score + '% LongMemEval &middot; ' + cls +
          (src ? '<br><span style="opacity:.75">' + src + '</span>' : '') +
          (note ? '<br><span style="opacity:.75">' + note + '</span>' : '');
        var p = svgCoords(row, host);
        tip.show(html, p.x, p.y);
      }
      row.addEventListener('mouseenter', show);
      row.addEventListener('focus', show, true);
      row.addEventListener('mouseleave', tip.hide);
      row.addEventListener('blur', tip.hide, true);
    });
  })();

  /* ── §III · Pareto scatter tooltips ─────────────────────── */
  (function wirePareto() {
    var host = document.getElementById('am-pareto-host');
    if (!host) return;
    var tip = makeTooltip(host);
    var bubbles = host.querySelectorAll('[data-bubble]');
    bubbles.forEach(function (b) {
      var name = b.getAttribute('data-name') || '';
      var tokens = b.getAttribute('data-tokens') || '';
      var latency = b.getAttribute('data-latency') || '';
      var cost = b.getAttribute('data-cost') || '';
      var score = b.getAttribute('data-score') || '';
      var why = b.getAttribute('data-why') || '';
      function show() {
        var html = '<strong>' + name + '</strong><br>' +
          tokens + ' &middot; ' + latency +
          (cost ? '<br>cost: ' + cost : '') +
          (score ? '<br>score: ' + score : '') +
          (why ? '<br><span style="opacity:.75">' + why + '</span>' : '');
        var p = svgCoords(b, host);
        tip.show(html, p.x, p.y);
      }
      b.addEventListener('mouseenter', show);
      b.addEventListener('focus', show, true);
      b.addEventListener('mouseleave', tip.hide);
      b.addEventListener('blur', tip.hide, true);
    });
  })();

  /* ── §IV · Quadrant tooltips ────────────────────────────── */
  (function wireQuadrant() {
    var host = document.getElementById('am-quadrant-host');
    if (!host) return;
    var tip = makeTooltip(host);
    var items = host.querySelectorAll('[data-quad-item]');
    items.forEach(function (item) {
      var name = item.getAttribute('data-name') || '';
      var stack = item.getAttribute('data-stack') || '';
      var evidence = item.getAttribute('data-evidence') || '';
      function show() {
        var html = '<strong>' + name + '</strong>' +
          (stack ? '<br>' + stack : '') +
          (evidence ? '<br><span style="opacity:.75">' + evidence + '</span>' : '');
        var p = svgCoords(item, host);
        tip.show(html, p.x, p.y);
      }
      item.addEventListener('mouseenter', show);
      item.addEventListener('focus', show, true);
      item.addEventListener('mouseleave', tip.hide);
      item.addEventListener('blur', tip.hide, true);
    });
  })();

  /* ── §V · Adoption bar tooltips ─────────────────────────── */
  (function wireAdoption() {
    var host = document.getElementById('am-adoption-host');
    if (!host) return;
    var tip = makeTooltip(host);
    var rows = host.querySelectorAll('[data-row]');
    rows.forEach(function (row) {
      var name = row.getAttribute('data-name') || '';
      var stars = row.getAttribute('data-stars') || '';
      var cls = row.getAttribute('data-class') || '';
      var funding = row.getAttribute('data-funding') || '';
      var note = row.getAttribute('data-note') || '';
      function show() {
        var html = '<strong>' + name + '</strong><br>' +
          stars + ' &middot; ' + cls +
          (funding ? '<br>' + funding : '') +
          (note ? '<br><span style="opacity:.75">' + note + '</span>' : '');
        var p = svgCoords(row, host);
        tip.show(html, p.x, p.y);
      }
      row.addEventListener('mouseenter', show);
      row.addEventListener('focus', show, true);
      row.addEventListener('mouseleave', tip.hide);
      row.addEventListener('blur', tip.hide, true);
    });
  })();
})();
