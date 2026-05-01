/* ═══════════════════════════════════════════════════════════════════
   LINEAR REGRESSION DESTINATION — closed-form OLS in 2D.
   Click to add points, drag points to move them. Line refits live.
   Three preset datasets: linear (default), noisy, and U-shaped
   (the failure case).
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const W = 720, H = 540;          // SVG viewBox
  const PAD = 40;
  let points = [];
  let preset = 'linear';
  let svg, hint, infoSlope, infoInt, infoR2, infoN, infoRMSE;
  let dragIdx = -1;

  function rand(seed) {
    return function () {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  function genPreset(name) {
    const r = rand(42);
    const arr = [];
    if (name === 'linear') {
      for (let i = 0; i < 20; i++) {
        const x = (i + 1) / 21;
        const y = 0.7 * x + 0.15 + (r() - 0.5) * 0.06;
        arr.push({ x, y });
      }
    } else if (name === 'noisy') {
      for (let i = 0; i < 30; i++) {
        const x = r();
        const y = 0.55 * x + 0.22 + (r() - 0.5) * 0.32;
        arr.push({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) });
      }
    } else if (name === 'parabola') {
      // The failure case — non-linear data. Best linear fit is poor.
      for (let i = 0; i < 24; i++) {
        const x = i / 23;
        const y = 0.95 * (x - 0.5) * (x - 0.5) * 4 * 0.6 + 0.15 + (r() - 0.5) * 0.05;
        arr.push({ x, y: Math.max(0, Math.min(1, y)) });
      }
    } else if (name === 'empty') {
      // empty — user adds points
    }
    return arr;
  }

  // Closed-form OLS for y = m*x + b.
  function fitOLS(pts) {
    const n = pts.length;
    if (n < 2) return null;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) {
      sx += pts[i].x;
      sy += pts[i].y;
      sxx += pts[i].x * pts[i].x;
      sxy += pts[i].x * pts[i].y;
    }
    const denom = n * sxx - sx * sx;
    if (Math.abs(denom) < 1e-9) return null;
    const m = (n * sxy - sx * sy) / denom;
    const b = (sy - m * sx) / n;
    // R² and RMSE
    const my = sy / n;
    let ssTot = 0, ssRes = 0;
    for (let i = 0; i < n; i++) {
      const yhat = m * pts[i].x + b;
      ssRes += (pts[i].y - yhat) * (pts[i].y - yhat);
      ssTot += (pts[i].y - my) * (pts[i].y - my);
    }
    const r2 = ssTot < 1e-9 ? 0 : 1 - ssRes / ssTot;
    const rmse = Math.sqrt(ssRes / n);
    return { m, b, r2, rmse };
  }

  // Coords helpers (data 0..1 → SVG pixels)
  function px(x) { return PAD + x * (W - 2 * PAD); }
  function py(y) { return H - PAD - y * (H - 2 * PAD); }
  function ix(x) { return (x - PAD) / (W - 2 * PAD); }
  function iy(y) { return (H - PAD - y) / (H - 2 * PAD); }

  function render() {
    if (!svg) return;
    const fit = fitOLS(points);
    let inner = '';

    // Axes + grid
    inner += '<rect x="' + PAD + '" y="' + PAD + '" width="' + (W - 2 * PAD) + '" height="' + (H - 2 * PAD) + '" ' +
             'fill="var(--paper)" stroke="var(--ink-dim)" stroke-width="0.6"/>';
    for (let i = 1; i < 5; i++) {
      const xx = PAD + (i / 5) * (W - 2 * PAD);
      const yy = PAD + (i / 5) * (H - 2 * PAD);
      inner += '<line x1="' + xx + '" y1="' + PAD + '" x2="' + xx + '" y2="' + (H - PAD) +
               '" stroke="var(--ink-dim)" stroke-width="0.3" opacity="0.4"/>';
      inner += '<line x1="' + PAD + '" y1="' + yy + '" x2="' + (W - PAD) + '" y2="' + yy +
               '" stroke="var(--ink-dim)" stroke-width="0.3" opacity="0.4"/>';
    }

    // Fit line + residuals
    if (fit) {
      const x0 = 0, x1 = 1;
      const y0 = fit.m * x0 + fit.b;
      const y1 = fit.m * x1 + fit.b;
      // Residual segments (faint, point → fit)
      points.forEach(function (p) {
        const yhat = fit.m * p.x + fit.b;
        inner += '<line x1="' + px(p.x).toFixed(1) + '" y1="' + py(p.y).toFixed(1) +
                 '" x2="' + px(p.x).toFixed(1) + '" y2="' + py(yhat).toFixed(1) +
                 '" stroke="var(--accent)" stroke-width="0.8" opacity="0.4" stroke-dasharray="2 2"/>';
      });
      // The fit line itself
      inner += '<line x1="' + px(x0).toFixed(1) + '" y1="' + py(y0).toFixed(1) +
               '" x2="' + px(x1).toFixed(1) + '" y2="' + py(y1).toFixed(1) +
               '" stroke="var(--accent)" stroke-width="2.2"/>';
    }

    // Points
    points.forEach(function (p, i) {
      const isDrag = i === dragIdx;
      inner += '<circle cx="' + px(p.x).toFixed(1) + '" cy="' + py(p.y).toFixed(1) + '" ' +
               'r="' + (isDrag ? 7 : 5) + '" fill="var(--ink)" ' +
               'stroke="var(--paper)" stroke-width="' + (isDrag ? 2 : 1.5) + '" ' +
               'data-idx="' + i + '" class="lr-pt" style="cursor:grab;"/>';
    });

    svg.innerHTML = inner;

    // Update readout
    if (fit) {
      infoSlope.textContent = fit.m.toFixed(3);
      infoInt.textContent = fit.b.toFixed(3);
      infoR2.textContent = fit.r2.toFixed(3);
      infoRMSE.textContent = fit.rmse.toFixed(3);
    } else {
      infoSlope.textContent = '—';
      infoInt.textContent = '—';
      infoR2.textContent = '—';
      infoRMSE.textContent = '—';
    }
    infoN.textContent = String(points.length);
  }

  function loadPreset(name) {
    preset = name;
    points = genPreset(name);
    render();
    document.querySelectorAll('.lr-preset').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.preset === name);
    });
  }

  function svgPoint(evt) {
    const rect = svg.getBoundingClientRect();
    const x = (evt.clientX - rect.left) / rect.width * W;
    const y = (evt.clientY - rect.top) / rect.height * H;
    return { x, y };
  }

  function onSvgClick(evt) {
    if (evt.target.classList && evt.target.classList.contains('lr-pt')) return; // dragstart handles
    const sp = svgPoint(evt);
    const x = ix(sp.x), y = iy(sp.y);
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    points.push({ x: x, y: y });
    render();
  }

  function onPointerDown(evt) {
    if (!evt.target.classList || !evt.target.classList.contains('lr-pt')) return;
    dragIdx = parseInt(evt.target.dataset.idx, 10);
    evt.preventDefault();
  }
  function onPointerMove(evt) {
    if (dragIdx === -1) return;
    const sp = svgPoint(evt);
    const x = ix(sp.x), y = iy(sp.y);
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
      points[dragIdx].x = x;
      points[dragIdx].y = y;
      render();
    }
  }
  function onPointerUp() {
    dragIdx = -1;
  }

  function init() {
    svg = document.getElementById('lr-canvas');
    if (!svg) return;
    hint = document.getElementById('lr-hint');
    infoSlope = document.getElementById('lr-slope');
    infoInt = document.getElementById('lr-intercept');
    infoR2 = document.getElementById('lr-r2');
    infoN = document.getElementById('lr-n');
    infoRMSE = document.getElementById('lr-rmse');

    document.querySelectorAll('.lr-preset').forEach(function (b) {
      b.addEventListener('click', function () { loadPreset(b.dataset.preset); });
    });
    const clearBtn = document.getElementById('lr-clear');
    if (clearBtn) clearBtn.addEventListener('click', function () { loadPreset('empty'); });

    svg.addEventListener('click', onSvgClick);
    svg.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    loadPreset('linear');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
