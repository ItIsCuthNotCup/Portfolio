/* ═══════════════════════════════════════════════════════════
   DEEPSEEK-V4 LAB — vanilla JS
   Lone job: animate the KV-cache line chart's strokes when the
   chart enters the viewport. Everything else on the page is
   static SVG + CSS.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function animateKvChart() {
    var chart = document.getElementById('kv-chart');
    if (!chart) return;
    var paths = chart.querySelectorAll('path');
    if (!paths.length) return;

    // Prep each path: measure length, set dash-offset for hidden state.
    paths.forEach(function (p) {
      var L;
      try { L = p.getTotalLength(); } catch (e) { L = 1000; }
      p.style.strokeDasharray = L + ' ' + L;
      p.style.strokeDashoffset = L;
      p.style.transition = 'stroke-dashoffset 1400ms cubic-bezier(0.22, 0.61, 0.36, 1)';
    });

    function reveal() {
      paths.forEach(function (p, i) {
        // Stagger so the four series don't all draw in unison.
        setTimeout(function () {
          p.style.strokeDashoffset = '0';
        }, i * 140);
      });
    }

    // Respect reduced-motion: just show the lines, don't animate.
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      paths.forEach(function (p) { p.style.strokeDashoffset = '0'; });
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
      // Fallback: just reveal immediately.
      reveal();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', animateKvChart);
  } else {
    animateKvChart();
  }
})();
