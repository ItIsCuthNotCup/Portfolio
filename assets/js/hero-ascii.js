/* ═══════════════════════════════════════════════════════════════
   hero-ascii.js — restrained ASCII humanoid for the hero stage

   Owns one <canvas> inside #scene-canvas. Replaces the Three.js
   point cloud with a monochrome ASCII silhouette that:
     1. fades in from the right on first viewport entry (~600ms)
     2. loops a subtle walk cycle (1.2s) with opposing arm/leg swing
     3. melts top-to-bottom as the hero scrolls out of view, with
        characters falling into a faint puddle. Scrolling back up
        re-forms the figure (the melt is a pure function of scroll
        progress, not a destructive simulation).

   Honors prefers-reduced-motion. Pauses when off-screen. DPR-aware.
   No external libs, no DOM mutation per frame, no global side
   effects. Cleanup via the returned dispose() handle.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const HOST_ID = 'scene-canvas';
  const HERO_ID = 'hero';

  // ── Density ramp (lightest → densest)
  const RAMP = ' .·:-=+*xX#@█';
  const RAMP_N = RAMP.length;

  // ── Cell metrics. The font is monospace, so each cell is the same
  //    pixel box. Tuned so a typical 460×560 container gives ~32 cols
  //    by ~38 rows — enough to read as a person, not so many that
  //    per-frame work hurts.
  const CELL_W = 12;
  const CELL_H = 16;
  const FONT_PX = 14;
  const FONT_FAMILY = "ui-monospace, 'DM Mono', 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace";

  // ── Walk cycle period (seconds)
  const WALK_PERIOD = 1.2;

  // ── Ink color resolution: grab the site's --ink at init time so we
  //    track the active theme without listening for theme changes.
  function resolveInk() {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
    return v || '#111111';
  }

  function prefersReducedMotion() {
    return window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ── Body model. Joint positions are expressed in "shape space"
  //    (an abstract 1×2-tall coordinate centered on the figure).
  //    The render pass scales these to the cell grid.
  //
  //    The walk is parameterized by phase ∈ [0, 1).
  function buildPose(phase) {
    const sw = Math.sin(phase * Math.PI * 2);   // primary swing
    const sw2 = Math.sin(phase * Math.PI * 4);  // double-frequency for vertical bob
    const armA = sw * 0.35;
    const armB = -sw * 0.35;
    const legA = sw * 0.32;
    const legB = -sw * 0.32;
    const bob = sw2 * 0.018;

    // Head & torso anchors (x is horizontal, y goes downward)
    const headY = 0.10 + bob;
    const neckY = 0.20 + bob;
    const hipY = 0.55 + bob;
    const cx = 0.50;

    // Joint positions
    const shoulderL = [cx - 0.075, neckY + 0.02];
    const shoulderR = [cx + 0.075, neckY + 0.02];
    const elbowL = [cx - 0.105 + Math.sin(armA) * 0.04, neckY + 0.16 + Math.cos(armA) * 0.02];
    const elbowR = [cx + 0.105 + Math.sin(armB) * 0.04, neckY + 0.16 + Math.cos(armB) * 0.02];
    const handL = [cx - 0.115 + Math.sin(armA) * 0.10, neckY + 0.32 + Math.cos(armA) * 0.05];
    const handR = [cx + 0.115 + Math.sin(armB) * 0.10, neckY + 0.32 + Math.cos(armB) * 0.05];
    const hipL = [cx - 0.055, hipY];
    const hipR = [cx + 0.055, hipY];
    const kneeL = [cx - 0.060 + Math.sin(legA) * 0.05, hipY + 0.16];
    const kneeR = [cx + 0.060 + Math.sin(legB) * 0.05, hipY + 0.16];
    const footL = [cx - 0.060 + Math.sin(legA) * 0.10, hipY + 0.34];
    const footR = [cx + 0.060 + Math.sin(legB) * 0.10, hipY + 0.34];

    return {
      head: [cx, headY],
      neck: [cx, neckY],
      hip: [cx, hipY],
      shoulderL, shoulderR,
      elbowL, elbowR,
      handL, handR,
      hipL, hipR,
      kneeL, kneeR,
      footL, footR,
      bob,
    };
  }

  // ── Density rasterization helpers. They mutate `density` (a flat
  //    Float32Array of length cols*rows). Each helper adds, never
  //    subtracts, so multiple parts can compose into thicker areas.

  function addDisc(density, cols, rows, cx, cy, r, weight) {
    const minX = Math.max(0, Math.floor(cx - r));
    const maxX = Math.min(cols - 1, Math.ceil(cx + r));
    const minY = Math.max(0, Math.floor(cy - r));
    const maxY = Math.min(rows - 1, Math.ceil(cy + r));
    for (let y = minY; y <= maxY; y++) {
      const dy = y - cy;
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > r) continue;
        const t = 1 - d / r;
        density[y * cols + x] += t * weight;
      }
    }
  }

  function addSegment(density, cols, rows, x1, y1, x2, y2, thickness, weight) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const steps = Math.ceil(len * 1.2);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      addDisc(density, cols, rows, x1 + dx * t, y1 + dy * t, thickness, weight);
    }
  }

  // ── Sample the pose into the density grid.
  function rasterizeBody(density, cols, rows, pose) {
    // Map shape-space (0..1 horizontal, 0..1 vertical) to cell grid.
    // Compose head, torso, arms, legs.
    const W = cols, H = rows;
    const px = (p) => p[0] * W;
    const py = (p) => p[1] * H;

    // Torso (thick)
    addSegment(density, cols, rows, px(pose.neck), py(pose.neck),
               px(pose.hip), py(pose.hip), 2.6, 1.0);
    // Shoulders
    addSegment(density, cols, rows, px(pose.shoulderL), py(pose.shoulderL),
               px(pose.shoulderR), py(pose.shoulderR), 1.6, 0.85);
    // Hips
    addSegment(density, cols, rows, px(pose.hipL), py(pose.hipL),
               px(pose.hipR), py(pose.hipR), 1.4, 0.75);
    // Arms
    addSegment(density, cols, rows, px(pose.shoulderL), py(pose.shoulderL),
               px(pose.elbowL), py(pose.elbowL), 1.1, 0.95);
    addSegment(density, cols, rows, px(pose.elbowL), py(pose.elbowL),
               px(pose.handL), py(pose.handL), 0.95, 0.9);
    addSegment(density, cols, rows, px(pose.shoulderR), py(pose.shoulderR),
               px(pose.elbowR), py(pose.elbowR), 1.1, 0.95);
    addSegment(density, cols, rows, px(pose.elbowR), py(pose.elbowR),
               px(pose.handR), py(pose.handR), 0.95, 0.9);
    // Legs
    addSegment(density, cols, rows, px(pose.hipL), py(pose.hipL),
               px(pose.kneeL), py(pose.kneeL), 1.4, 1.0);
    addSegment(density, cols, rows, px(pose.kneeL), py(pose.kneeL),
               px(pose.footL), py(pose.footL), 1.2, 0.95);
    addSegment(density, cols, rows, px(pose.hipR), py(pose.hipR),
               px(pose.kneeR), py(pose.kneeR), 1.4, 1.0);
    addSegment(density, cols, rows, px(pose.kneeR), py(pose.kneeR),
               px(pose.footR), py(pose.footR), 1.2, 0.95);
    // Head
    addDisc(density, cols, rows, px(pose.head), py(pose.head), 2.6, 1.0);
    // Neck (thin)
    addSegment(density, cols, rows, px(pose.head), py(pose.head) + 1.5,
               px(pose.neck), py(pose.neck), 0.7, 0.7);
  }

  // ── Faint lighting bias: top-front cells brighten slightly so the
  //    figure has volume rather than reading flat.
  function shadeBias(density, cols, rows) {
    for (let y = 0; y < rows; y++) {
      const lift = 1 - (y / rows) * 0.18;
      const row = y * cols;
      for (let x = 0; x < cols; x++) {
        const v = density[row + x];
        if (v <= 0) continue;
        density[row + x] = v * lift;
      }
    }
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ── Main module
  function initHeroAscii() {
    const host = document.getElementById(HOST_ID);
    const hero = document.getElementById(HERO_ID);
    if (!host || !hero) return null;

    // Mark the host so the legacy Three.js initScene() bails.
    host.dataset.ascii = '1';
    host.setAttribute('aria-hidden', 'true');

    const reduced = prefersReducedMotion();

    // Clean any prior content (e.g., webgl canvas if it raced)
    while (host.firstChild) host.removeChild(host.firstChild);

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.pointerEvents = 'none';
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);

    const ctx = canvas.getContext('2d');

    let dpr = 1;
    let cssW = 0, cssH = 0;
    let cols = 0, rows = 0;
    let density = null;     // current frame density grid
    let prevDensity = null; // last frame, used for shed-time tracking
    let shedTime = null;    // per-cell time the cell was first removed by melt

    function resize() {
      const rect = host.getBoundingClientRect();
      cssW = Math.max(1, Math.round(rect.width));
      cssH = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.max(8, Math.floor(cssW / CELL_W));
      rows = Math.max(8, Math.floor(cssH / CELL_H));
      density = new Float32Array(cols * rows);
      prevDensity = new Float32Array(cols * rows);
      shedTime = new Float32Array(cols * rows);
      ctx.font = `${FONT_PX}px ${FONT_FAMILY}`;
      ctx.textBaseline = 'top';
    }

    // ── Resize handling via ResizeObserver (cheap, no layout reads
    //    inside the frame loop)
    const ro = new ResizeObserver(() => { resize(); });
    ro.observe(host);
    resize();

    // ── Scroll progress (0 = hero in view, 1 = scrolled ~60% out)
    let meltTarget = 0;
    let meltCurrent = 0;

    function readScroll() {
      const rect = hero.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when top of hero is at top of viewport. Increases as the
      // hero scrolls up out of view.
      const scrolled = -rect.top;
      const span = Math.max(1, rect.height * 0.6);
      meltTarget = clamp(scrolled / span, 0, 1);
    }
    let scrollScheduled = false;
    function onScroll() {
      if (scrollScheduled) return;
      scrollScheduled = true;
      requestAnimationFrame(() => {
        scrollScheduled = false;
        readScroll();
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    readScroll();

    // ── Visibility (pause when hero scrolls fully out of frame)
    let visible = true;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === hero) visible = e.isIntersecting;
      }
    }, { threshold: 0 });
    io.observe(hero);

    // ── Entry fade
    const startedAt = performance.now();
    const ENTRY_MS = 600;

    // ── Walk phase
    let phase = 0;

    // ── Render loop
    let raf = 0;
    let last = performance.now();
    let running = true;

    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (!visible && meltCurrent > 0.98) {
        // Fully melted + offscreen: skip work entirely
        last = now;
        return;
      }

      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Smooth the melt for nicer scrubbing
      meltCurrent += (meltTarget - meltCurrent) * Math.min(1, dt * 8);
      const melt = meltCurrent;

      // Walk advance
      if (!reduced) phase = (phase + dt / WALK_PERIOD) % 1;

      // Entry alpha
      const elapsed = now - startedAt;
      const entry = reduced ? 1 : Math.min(1, elapsed / ENTRY_MS);
      const entryOffsetX = (1 - entry) * cssW * 0.18;

      // Build pose & density
      const pose = buildPose(reduced ? 0 : phase);
      // Reset
      for (let i = 0; i < density.length; i++) density[i] = 0;
      rasterizeBody(density, cols, rows, pose);
      shadeBias(density, cols, rows);

      // ── Apply melt: cells whose row >= meltLine vanish; the rest
      //    fade. Top dissolves first.
      const meltLine = (1 - melt) * (rows + 4);
      // Update shedTime for newly removed cells (and reset on un-melt)
      for (let y = 0; y < rows; y++) {
        const yJitter = (Math.sin(y * 11.3) * 0.5 + Math.cos(y * 3.1) * 0.5) * 1.4;
        const rowLine = meltLine - yJitter;
        const isShed = y < (rows - rowLine);
        const rowStart = y * cols;
        for (let x = 0; x < cols; x++) {
          const i = rowStart + x;
          if (isShed) {
            if (shedTime[i] === 0) {
              // mark with current time (in seconds-since-init)
              shedTime[i] = (now - startedAt) / 1000 + 0.0001;
            }
            density[i] = 0;
          } else {
            shedTime[i] = 0;
          }
        }
      }

      // ── Draw
      ctx.clearRect(0, 0, cssW, cssH);

      // Body fill color (near-white on dark themes, dark ink on light)
      const ink = resolveInk();
      ctx.fillStyle = ink;
      ctx.globalAlpha = 0.95;

      const offX = entryOffsetX;
      const offY = 0;
      // Cell origin so the figure centers visually
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const v = density[y * cols + x];
          if (v <= 0.04) continue;
          const idx = Math.min(RAMP_N - 1, Math.floor(v * (RAMP_N - 0.001)));
          const ch = RAMP[idx];
          ctx.fillText(ch, x * CELL_W + offX, y * CELL_H + offY);
        }
      }

      // ── Falling shed characters (computed each frame, not stored)
      //    Cells with shedTime > 0 emit a character that descends.
      ctx.globalAlpha = 0.7;
      const tNow = (now - startedAt) / 1000;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const st = shedTime[i];
          if (st === 0) continue;
          const age = tNow - st;
          if (age < 0 || age > 1.4) continue;
          // Falling cell still draws while falling
          const fall = age * age * 60;       // gravity-ish
          const drift = Math.sin((y * 0.4 + x * 0.6 + age * 2)) * 4;
          const alpha = Math.max(0, 1 - age / 1.4);
          // Step down the density ramp as it ages
          const idx = Math.max(0, Math.min(RAMP_N - 1,
            (RAMP_N - 1) - Math.floor(age * 6)));
          const ch = RAMP[idx];
          ctx.globalAlpha = 0.55 * alpha;
          ctx.fillText(ch, x * CELL_W + drift + offX, y * CELL_H + fall + offY);
        }
      }

      // ── Faint puddle near the bottom when fully melted
      if (melt > 0.6) {
        const puddleAlpha = Math.min(1, (melt - 0.6) / 0.4) * 0.45;
        ctx.globalAlpha = puddleAlpha;
        const puddleY = rows - 2;
        for (let x = Math.floor(cols * 0.18); x < Math.floor(cols * 0.82); x++) {
          const noise = Math.sin(x * 0.6 + tNow) * 0.2 + 0.6;
          const idx = Math.max(0, Math.min(RAMP_N - 1, Math.floor(noise * 4)));
          ctx.fillText(RAMP[idx], x * CELL_W + offX, puddleY * CELL_H + offY);
        }
      }

      ctx.globalAlpha = 1;
    }
    raf = requestAnimationFrame(frame);

    // ── Public dispose
    function dispose() {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      while (host.firstChild) host.removeChild(host.firstChild);
      delete host.dataset.ascii;
    }

    return { dispose };
  }

  // Boot at DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeroAscii);
  } else {
    initHeroAscii();
  }
})();
