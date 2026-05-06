/* ═══════════════════════════════════════════════════════════
   SUBQUADRATIC LAB — TEST. 06
   - Populate dateline
   - Animate the bench-chart bars on first scroll
   Everything else on the page is static SVG + CSS.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Populate dateline.
  (function setDateline() {
    var el = document.getElementById('dateline-time');
    if (!el) return;
    var now = new Date();
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    el.textContent = months[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear();
  })();

  function animateChart() {
    var chart = document.getElementById('sq-bench-chart');
    if (!chart) return;
    var bars = chart.querySelectorAll('rect[data-grow]');
    if (!bars.length) return;

    bars.forEach(function (b) {
      var w = b.getAttribute('width');
      b.setAttribute('data-target-width', w);
      b.setAttribute('width', '0');
      b.style.transition = 'width 1100ms cubic-bezier(0.22, 0.61, 0.36, 1)';
    });

    function reveal() {
      bars.forEach(function (b, i) {
        setTimeout(function () {
          b.setAttribute('width', b.getAttribute('data-target-width'));
        }, i * 80);
      });
    }

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      bars.forEach(function (b) { b.setAttribute('width', b.getAttribute('data-target-width')); });
      return;
    }

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            reveal();
            io.disconnect();
          }
        });
      }, { threshold: 0.25 });
      io.observe(chart);
    } else {
      reveal();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', animateChart);
  } else {
    animateChart();
  }
})();
