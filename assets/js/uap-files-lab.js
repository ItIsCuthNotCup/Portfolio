/* ═══════════════════════════════════════════════════════════
   UAP FILES LAB — S13
   Three jobs:
   - Set the dateline
   - Power four chart tooltips:
       Chart 1 (§II)  inventory map     — hover pin → encounter detail
       Chart 2 (§III) resolution stack  — hover bar → outcome breakdown
       Chart 3 (§IV)  reports per year  — hover bar → year + era + event
       Chart 4 (§V)   belief lines      — hover dot → survey + question
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
    tip.className = 'uf-tooltip';
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

  /* ── §II · Inventory map pins ───────────────────────────── */
  (function wireInventory() {
    var host = document.getElementById('uf-inventory-host');
    if (!host) return;
    var tip = makeTooltip(host);
    var pins = host.querySelectorAll('[data-pin]');
    pins.forEach(function (pin) {
      var name = pin.getAttribute('data-name') || '';
      var agency = pin.getAttribute('data-agency') || '';
      var year = pin.getAttribute('data-year') || '';
      var detail = pin.getAttribute('data-detail') || '';
      var outlet = pin.getAttribute('data-outlet') || '';
      function show() {
        var html = '<strong>' + name + '</strong><br>' +
          agency + ' &middot; ' + year +
          (detail ? '<br>' + detail : '') +
          (outlet ? '<br><span style="opacity:.7">via ' + outlet + '</span>' : '');
        var p = svgCoords(pin, host);
        tip.show(html, p.x, p.y);
      }
      pin.addEventListener('mouseenter', show);
      pin.addEventListener('focus', show, true);
      pin.addEventListener('mouseleave', tip.hide);
      pin.addEventListener('blur', tip.hide, true);
    });
  })();

  /* ── §III · Resolution stacked bars ─────────────────────── */
  (function wireResolution() {
    var host = document.getElementById('uf-resolution-host');
    if (!host) return;
    var tip = makeTooltip(host);
    var bars = host.querySelectorAll('[data-bar]');
    bars.forEach(function (bar) {
      var name = bar.getAttribute('data-name') || '';
      var period = bar.getAttribute('data-period') || '';
      var total = bar.getAttribute('data-total') || '';
      var resolved = bar.getAttribute('data-resolved') || '';
      var unresolved = bar.getAttribute('data-unresolved') || '';
      var anomaly = bar.getAttribute('data-anomaly') || '';
      var et = bar.getAttribute('data-et') || '';
      var src = bar.getAttribute('data-source') || '';
      function show() {
        var html = '<strong>' + name + '</strong><br>' +
          period + ' &middot; n=' + total +
          (resolved ? '<br>resolved: ' + resolved : '') +
          (unresolved ? '<br>unresolved: ' + unresolved : '') +
          (anomaly ? '<br>anomaly: ' + anomaly : '') +
          (et ? '<br>ET: ' + et : '') +
          (src ? '<br><span style="opacity:.7">' + src + '</span>' : '');
        var p = svgCoords(bar, host);
        tip.show(html, p.x, p.y);
      }
      bar.addEventListener('mouseenter', show);
      bar.addEventListener('focus', show, true);
      bar.addEventListener('mouseleave', tip.hide);
      bar.addEventListener('blur', tip.hide, true);
    });
  })();

  /* ── §IV · Reports per year time series ─────────────────── */
  (function wireTimeline() {
    var host = document.getElementById('uf-timeline-host');
    if (!host) return;
    var tip = makeTooltip(host);
    var bars = host.querySelectorAll('[data-bar-pt]');
    bars.forEach(function (bar) {
      var year = bar.getAttribute('data-year') || '';
      var reports = bar.getAttribute('data-reports') || '';
      var era = bar.getAttribute('data-era') || '';
      var ev = bar.getAttribute('data-event') || '';
      function show() {
        var html = '<strong>' + year + '</strong> &middot; ' + reports + ' reports<br>' +
          '<span style="opacity:.8">' + era + '</span>' +
          (ev ? '<br>' + ev : '');
        var p = svgCoords(bar, host);
        tip.show(html, p.x, p.y);
      }
      bar.addEventListener('mouseenter', show);
      bar.addEventListener('focus', show, true);
      bar.addEventListener('mouseleave', tip.hide);
      bar.addEventListener('blur', tip.hide, true);
    });
  })();

  /* ── §V · Belief gap dots ───────────────────────────────── */
  (function wireBelief() {
    var host = document.getElementById('uf-belief-host');
    if (!host) return;
    var tip = makeTooltip(host);
    var pts = host.querySelectorAll('[data-pt]');
    pts.forEach(function (pt) {
      var year = pt.getAttribute('data-year') || '';
      var pct = pt.getAttribute('data-pct') || '';
      var survey = pt.getAttribute('data-survey') || '';
      var question = pt.getAttribute('data-question') || '';
      function show() {
        var html = '<strong>' + survey + ' ' + year + '</strong>: ' + pct + '%' +
          (question ? '<br>Question: ' + question : '');
        var p = svgCoords(pt, host);
        tip.show(html, p.x, p.y);
      }
      pt.addEventListener('mouseenter', show);
      pt.addEventListener('focus', show, true);
      pt.addEventListener('mouseleave', tip.hide);
      pt.addEventListener('blur', tip.hide, true);
    });
  })();
})();
