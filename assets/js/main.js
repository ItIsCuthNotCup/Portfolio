(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     EDITORIAL PORTFOLIO — JS
     Three.js 3D scene · scroll tracking · theme · cursor
     ═══════════════════════════════════════════════════════════ */

  // ── Dateline clock ──
  function updateDateline() {
    const el = document.getElementById('dateline-time');
    if (!el) return;
    const d = new Date();
    el.textContent = d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
  updateDateline();
  setInterval(updateDateline, 30000);

  // ── Masthead issue / date (auto-updates per month) ──
  // Falls through silently if the static fallback spans aren't present.
  try {
    const now = new Date();
    const issueEl = document.getElementById('masthead-issue');
    const dateEl = document.getElementById('masthead-date');
    if (issueEl) issueEl.textContent = String(now.getMonth() + 1).padStart(2, '0');
    if (dateEl) {
      dateEl.textContent = now.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    }
  } catch (_) { /* keep static fallback */ }

  // ── Scroll progress bar ──
  const progressBar = document.getElementById('progress');
  let lastScroll = 0;
  let scrollVelocity = 0;
  let activeShape = 'ico';

  function onScroll() {
    const y = window.scrollY;
    const h = document.documentElement.scrollHeight - window.innerHeight;
    const p = Math.max(0, Math.min(1, y / Math.max(1, h)));
    if (progressBar) progressBar.style.width = (p * 100).toFixed(2) + '%';

    // velocity
    scrollVelocity = y - lastScroll;
    lastScroll = y;

    // detect active shape section
    const sections = document.querySelectorAll('[data-shape]');
    const mid = window.innerHeight * 0.45;
    let best = null;
    let bestDist = Infinity;
    sections.forEach(function (s) {
      const r = s.getBoundingClientRect();
      const center = (r.top + r.bottom) / 2;
      const d = Math.abs(center - mid);
      if (r.bottom > 0 && r.top < window.innerHeight && d < bestDist) {
        bestDist = d;
        best = s.getAttribute('data-shape');
      }
    });
    if (best && best !== activeShape) {
      activeShape = best;
      if (sceneState) sceneState.setShape(best);
      updateCaption(best);
    }
    if (sceneState) sceneState.velocity = scrollVelocity;
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // ── Shape metadata for captions ──
  var SHAPE_META = {
    ico:     { fig: '00', title: 'Icosahedron / identity',  coord: '+0.000, +0.000' },
    knot:    { fig: '01', title: 'Torus Knot / connection', coord: '+0.942, \u20130.314' },
    lattice: { fig: '02', title: 'Lattice / network',       coord: '\u20130.707, +0.707' },
    helix:   { fig: '03', title: 'Helix / sequence',        coord: '+0.500, \u20130.866' },
    stack:   { fig: '04', title: 'Stack / system',          coord: '\u20130.866, +0.500' },
    particle:{ fig: '05', title: 'Particle Field / projects', coord: '+0.000, +1.000' },
  };

  function updateCaption(shape) {
    var m = SHAPE_META[shape] || SHAPE_META.ico;
    var figEl = document.getElementById('scene-fig');
    var titleEl = document.getElementById('scene-title');
    var coordEl = document.getElementById('scene-coord');
    if (figEl) figEl.textContent = 'FIG.' + m.fig;
    if (titleEl) titleEl.textContent = m.title;
    if (coordEl) coordEl.textContent = m.coord;
  }

  // ── Custom cursor ──
  (function initCursor() {
    if (matchMedia('(hover: none)').matches) return;
    var dot = document.getElementById('cursor-dot');
    if (!dot) return;
    dot.style.display = 'block';
    window.addEventListener('mousemove', function (e) {
      dot.style.left = e.clientX + 'px';
      dot.style.top = e.clientY + 'px';
      var el = e.target;
      var isHover = !!(el.closest && el.closest('a, button, input, label, .theme-btn'));
      dot.classList.toggle('hover', isHover);
    });
  })();

  // ── Theme switching ──
  (function initTheme() {
    var btns = document.querySelectorAll('.theme-btn');
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var t = btn.getAttribute('data-t');
        document.documentElement.setAttribute('data-theme', t);
        btns.forEach(function (b) { b.classList.toggle('active', b === btn); });
      });
    });
  })();

  // ── Smooth anchor scroll ──
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id === '#') return;
      var target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ── Video autoplay on scroll ──
  var videoObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.play().catch(function () {});
      } else {
        entry.target.pause();
      }
    });
  }, { threshold: 0.3 });
  document.querySelectorAll('video[data-autoplay]').forEach(function (v) {
    videoObserver.observe(v);
  });

  // ══════════════════════════════════════════════════════════
  // THREE.JS 3D POINT-CLOUD SCENE
  // ══════════════════════════════════════════════════════════

  var sceneState = null;

  function samplePointsFromGeometry(geo, count) {
    geo.computeBoundingBox();
    var pos = geo.attributes.position;
    var idx = geo.index;
    var triCount = idx ? idx.count / 3 : pos.count / 3;
    var areas = new Float32Array(triCount);
    var total = 0;
    var a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    var ab = new THREE.Vector3(), ac = new THREE.Vector3(), cross = new THREE.Vector3();
    for (var i = 0; i < triCount; i++) {
      var ia = idx ? idx.getX(i*3) : i*3;
      var ib = idx ? idx.getX(i*3+1) : i*3+1;
      var ic = idx ? idx.getX(i*3+2) : i*3+2;
      a.fromBufferAttribute(pos, ia);
      b.fromBufferAttribute(pos, ib);
      c.fromBufferAttribute(pos, ic);
      ab.subVectors(b, a); ac.subVectors(c, a);
      cross.crossVectors(ab, ac);
      areas[i] = cross.length() * 0.5;
      total += areas[i];
    }
    var cum = new Float32Array(triCount);
    var s = 0;
    for (var i = 0; i < triCount; i++) { s += areas[i]; cum[i] = s / total; }
    var out = new Float32Array(count * 3);
    for (var k = 0; k < count; k++) {
      var r = Math.random();
      var lo = 0, hi = triCount - 1;
      while (lo < hi) { var mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
      var ii = lo;
      var ia = idx ? idx.getX(ii*3) : ii*3;
      var ib = idx ? idx.getX(ii*3+1) : ii*3+1;
      var ic = idx ? idx.getX(ii*3+2) : ii*3+2;
      a.fromBufferAttribute(pos, ia);
      b.fromBufferAttribute(pos, ib);
      c.fromBufferAttribute(pos, ic);
      var u = Math.random(), v = Math.random();
      if (u + v > 1) { u = 1 - u; v = 1 - v; }
      var w = 1 - u - v;
      out[k*3]   = a.x * w + b.x * u + c.x * v;
      out[k*3+1] = a.y * w + b.y * u + c.y * v;
      out[k*3+2] = a.z * w + b.z * u + c.z * v;
    }
    return out;
  }

  function latticePoints(count) {
    var out = new Float32Array(count * 3);
    var r = 1.15;
    var i = 0, guard = 0;
    while (i < count && guard < count * 20) {
      guard++;
      var x = (Math.floor(Math.random() * 16) - 7.5) / 7.5;
      var y = (Math.floor(Math.random() * 16) - 7.5) / 7.5;
      var z = (Math.floor(Math.random() * 16) - 7.5) / 7.5;
      var d = Math.sqrt(x*x+y*y+z*z);
      if (d < 0.3 || d > r) continue;
      out[i*3] = x * 1.1; out[i*3+1] = y * 1.1; out[i*3+2] = z * 1.1;
      i++;
    }
    for (; i < count; i++) {
      var t = Math.random() * Math.PI * 2;
      var p = Math.acos(2*Math.random()-1);
      out[i*3] = Math.sin(p)*Math.cos(t);
      out[i*3+1] = Math.sin(p)*Math.sin(t);
      out[i*3+2] = Math.cos(p);
    }
    return out;
  }

  function stackedBoxesPoints(count) {
    var out = new Float32Array(count * 3);
    var steps = 6;
    for (var i = 0; i < count; i++) {
      var s = i % steps;
      var size = 0.45;
      var bx = (s - 2.5) * 0.35;
      var by = (s - 2.5) * 0.35;
      out[i*3]   = bx + (Math.random() - 0.5) * size;
      out[i*3+1] = by + (Math.random() - 0.5) * size;
      out[i*3+2] =      (Math.random() - 0.5) * size;
    }
    return out;
  }

  function helixPoints(count) {
    var out = new Float32Array(count * 3);
    var turns = 6;
    for (var i = 0; i < count; i++) {
      var t = i / count;
      var ang = t * turns * Math.PI * 2;
      var r = 1.0 + (Math.random() - 0.5) * 0.05;
      out[i*3]   = Math.cos(ang) * r;
      out[i*3+1] = (t - 0.5) * 2.4;
      out[i*3+2] = Math.sin(ang) * r;
    }
    return out;
  }

  function particleSpherePoints(count) {
    var out = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      var t = Math.random() * Math.PI * 2;
      var p = Math.acos(2*Math.random()-1);
      var r = 1.0 + (Math.random() - 0.5) * 0.15;
      out[i*3]   = Math.sin(p)*Math.cos(t)*r;
      out[i*3+1] = Math.sin(p)*Math.sin(t)*r;
      out[i*3+2] = Math.cos(p)*r;
    }
    return out;
  }

  function buildTargets(count) {
    var ico = new THREE.IcosahedronGeometry(1.1, 3);
    var knot = new THREE.TorusKnotGeometry(0.8, 0.26, 180, 24);
    return {
      ico: samplePointsFromGeometry(ico, count),
      knot: samplePointsFromGeometry(knot, count),
      lattice: latticePoints(count),
      helix: helixPoints(count),
      stack: stackedBoxesPoints(count),
      particle: particleSpherePoints(count),
    };
  }

  function getInkColor() {
    var v = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
    var c = new THREE.Color();
    try { c.set(v); } catch (e) { c.set('#111'); }
    return c;
  }

  function initScene() {
    var host = document.getElementById('scene-canvas');
    if (!host || typeof THREE === 'undefined') return;

    var w = function () { return host.clientWidth; };
    var h = function () { return host.clientHeight; };

    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w(), h());
    host.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(35, w()/h(), 0.1, 100);
    camera.position.set(0, 0, 4.2);

    var COUNT = 2600;
    var targets = buildTargets(COUNT);

    var current = new Float32Array(targets.ico);
    var from = new Float32Array(targets.ico);
    var to = new Float32Array(targets.ico);

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(current, 3));
    var sizes = new Float32Array(COUNT);
    for (var i = 0; i < COUNT; i++) sizes[i] = 0.4 + Math.random() * 1.0;
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    var material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: getInkColor() },
        uSize: { value: 2.0 * renderer.getPixelRatio() },
        uOpacity: { value: 0.9 },
      },
      vertexShader: [
        'attribute float aSize;',
        'uniform float uSize;',
        'void main() {',
        '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  gl_PointSize = aSize * uSize * (1.0 / -mv.z);',
        '  gl_Position = projectionMatrix * mv;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor;',
        'uniform float uOpacity;',
        'void main() {',
        '  vec2 uv = gl_PointCoord - 0.5;',
        '  float d = length(uv);',
        '  if (d > 0.5) discard;',
        '  float alpha = smoothstep(0.5, 0.15, d) * uOpacity;',
        '  gl_FragColor = vec4(uColor, alpha);',
        '}',
      ].join('\n'),
      transparent: true,
      depthWrite: false,
    });

    var points = new THREE.Points(geo, material);
    scene.add(points);

    // Faint bounding wire cube
    var boxGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(2.6, 2.6, 2.6));
    var boxMat = new THREE.LineBasicMaterial({ color: getInkColor(), transparent: true, opacity: 0.12 });
    var box = new THREE.LineSegments(boxGeo, boxMat);
    scene.add(box);

    // Tick axes
    var axesMat = new THREE.LineBasicMaterial({ color: getInkColor(), transparent: true, opacity: 0.25 });
    var axesGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-1.5, 0, 0), new THREE.Vector3(1.5, 0, 0),
      new THREE.Vector3(0, -1.5, 0), new THREE.Vector3(0, 1.5, 0),
      new THREE.Vector3(0, 0, -1.5), new THREE.Vector3(0, 0, 1.5),
    ]);
    var axes = new THREE.LineSegments(axesGeo, axesMat);
    scene.add(axes);

    var state = {
      renderer: renderer, scene: scene, camera: camera,
      points: points, box: box, axes: axes,
      boxMat: boxMat, axesMat: axesMat, material: material,
      current: current, from: from, to: to, targets: targets,
      morph: 1, currentShape: 'ico',
      rotation: { x: 0, y: 0, z: 0 },
      velocity: 0, baseSpin: 0.0025,
    };

    state.setShape = function (name) {
      if (!name || !targets[name]) return;
      if (state.currentShape === name && state.morph >= 1) return;
      state.from.set(state.current);
      state.to.set(targets[name]);
      state.morph = 0;
      state.currentShape = name;
    };

    state.refreshColors = function () {
      var c = getInkColor();
      material.uniforms.uColor.value = c;
      boxMat.color = c;
      axesMat.color = c;
    };

    function onResize() {
      renderer.setSize(w(), h());
      camera.aspect = w()/h();
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', onResize);

    // Watch for theme changes to recolor
    var obs = new MutationObserver(function () { state.refreshColors(); });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    function tick() {
      if (state.morph < 1) {
        state.morph = Math.min(1, state.morph + 0.018);
        var t = state.morph;
        var e = t*t*(3 - 2*t); // smoothstep
        for (var i = 0; i < state.current.length; i++) {
          state.current[i] = state.from[i] + (state.to[i] - state.from[i]) * e;
        }
        geo.attributes.position.needsUpdate = true;
      }

      state.velocity *= 0.92;
      state.rotation.y += state.baseSpin + state.velocity * 0.0008;
      state.rotation.x += state.baseSpin * 0.35;
      points.rotation.set(state.rotation.x, state.rotation.y, 0);
      box.rotation.set(state.rotation.x, state.rotation.y, 0);
      axes.rotation.set(state.rotation.x, state.rotation.y, 0);

      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    }
    tick();

    sceneState = state;
  }

  // Wait for Three.js to load, then init
  if (typeof THREE !== 'undefined') {
    initScene();
  } else {
    window.addEventListener('load', function () {
      if (typeof THREE !== 'undefined') initScene();
    });
  }

  // Fire initial scroll
  onScroll();

  /* ═══════════════════════════════════════════════════════════
     TEXT SCRAMBLE
     Decode-wave reveal across [data-scramble] elements.

     Layout-stable strategy: every character is wrapped in an
     inline-block span whose width is pinned to its FINAL glyph's
     rendered width. Mutating each span's textContent during the
     animation can never change the H1's line-wrap or height, so
     anything below the H1 stays exactly where it was.

     Word-level wrapping is preserved because we only span
     non-whitespace runs and leave actual whitespace as plain text
     between them. Italic / accent child spans are preserved
     because each text node is replaced in-place — character spans
     are inserted under the same parent (which keeps inheriting
     the styling).
     ═══════════════════════════════════════════════════════════ */
  function scrambleElement(root, opts) {
    opts = opts || {};
    var duration = opts.duration || 1100;
    var scrambleSpeed = opts.scrambleSpeed || 50;
    // Letters only — reads as prose, not keyboard mashing.
    var POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

    function run() {
      // Walk leaf text nodes; replace each with a sequence of
      // word-grouped character spans. Build a flat list of all
      // character entries for the animation loop.
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      var origNodes = [];
      var n;
      while ((n = walker.nextNode())) origNodes.push(n);
      if (origNodes.length === 0) return;

      var charEntries = [];

      origNodes.forEach(function (textNode) {
        var text = textNode.nodeValue;
        if (text.length === 0) return;
        var parent = textNode.parentNode;
        var frag = document.createDocumentFragment();

        // Split into runs of whitespace vs non-whitespace so
        // line-wrap happens at word boundaries — never mid-word.
        var parts = text.split(/(\s+)/);
        parts.forEach(function (part) {
          if (part.length === 0) return;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(part));
          } else {
            // Word wrapper — inline-block + nowrap means the browser
            // treats the entire word as one unbreakable unit. Without
            // this, the browser would happily break a line between any
            // two character spans, splitting words like 't|hat'.
            var wordSpan = document.createElement('span');
            wordSpan.className = 'scr-w';
            wordSpan.style.display = 'inline-block';
            wordSpan.style.whiteSpace = 'nowrap';

            for (var i = 0; i < part.length; i++) {
              var span = document.createElement('span');
              span.className = 'scr-c';
              span.textContent = part.charAt(i);
              wordSpan.appendChild(span);
              charEntries.push({ span: span, finalChar: part.charAt(i) });
            }
            frag.appendChild(wordSpan);
          }
        });

        parent.replaceChild(frag, textNode);
      });

      // Pin each char-span's width to its rendered final width.
      // Read all dimensions first (one layout pass), then write
      // all styles (no thrashing).
      var widths = charEntries.map(function (e) {
        return e.span.getBoundingClientRect().width;
      });
      charEntries.forEach(function (e, i) {
        e.span.style.display = 'inline-block';
        e.span.style.width = widths[i] + 'px';
        e.span.style.textAlign = 'center';
      });

      var totalLen = charEntries.length;
      var start = performance.now();

      function frame(now) {
        var p = Math.min(1, (now - start) / duration);
        var seed = Math.floor(now / scrambleSpeed);

        for (var k = 0; k < totalLen; k++) {
          var entry = charEntries[k];
          var c = entry.finalChar;
          var my = k / totalLen;
          var glyph;
          if (p > my + 0.02) {
            glyph = c;
          } else if (/[A-Za-z]/.test(c)) {
            glyph = POOL.charAt((k * 31 + seed * 17) % POOL.length);
          } else {
            glyph = c;
          }
          if (entry.span.firstChild && entry.span.firstChild.nodeValue !== glyph) {
            entry.span.firstChild.nodeValue = glyph;
          }
        }

        if (p < 1) requestAnimationFrame(frame);
      }

      requestAnimationFrame(frame);
    }

    // Wait for webfonts so character widths are measured against
    // the real Newsreader, not the system fallback.
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(run);
    } else {
      run();
    }
  }

  function initScramble() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    var targets = document.querySelectorAll('[data-scramble]');
    targets.forEach(function (el, i) {
      var delay = parseInt(el.getAttribute('data-scramble-delay') || (i * 150), 10);
      var dur = parseInt(el.getAttribute('data-scramble-duration') || '1100', 10);
      setTimeout(function () { scrambleElement(el, { duration: dur }); }, delay);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScramble);
  } else {
    initScramble();
  }
})();
