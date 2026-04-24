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

  // ═══════════════════════════════════════════════════════════
  //  CONTACT FORM — POSTs to /api/contact (Cloudflare Pages Function)
  // ═══════════════════════════════════════════════════════════
  (function initContactForm() {
    var form = document.getElementById('contact-form');
    if (!form) return;
    var status = document.getElementById('contact-status');
    var submitBtn = form.querySelector('.contact-submit');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.classList.contains('sending')) return;

      // Gather fields
      var data = {};
      Array.prototype.forEach.call(form.elements, function (el) {
        if (el.name) data[el.name] = el.value;
      });

      form.classList.remove('sent', 'failed');
      form.classList.add('sending');
      if (submitBtn) submitBtn.disabled = true;
      status.textContent = 'Sending…';

      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
        .then(function (res) {
          var ct = res.headers.get('content-type') || '';
          // If the response isn't JSON, an intermediary (redirect, DNS
          // fallback, CDN error page) intercepted us. Surface that as
          // a diagnosable error instead of a cryptic parse failure.
          if (!ct.toLowerCase().includes('application/json')) {
            return res.text().then(function (t) {
              return {
                ok: false,
                error:
                  'Got a non-JSON response (status ' +
                  res.status +
                  '). Usually DNS or a proxy issue. First 60 chars: ' +
                  (t || '').slice(0, 60).replace(/\s+/g, ' '),
              };
            });
          }
          return res.json().then(function (body) {
            // Compose a readable error even when Resend gave us
            // upstream detail. Helps spot the cause at a glance.
            var err = body && body.error;
            if (body && body.upstream) err += ' (upstream ' + body.upstream + ')';
            if (body && body.hint) err += ' ' + body.hint;
            if (body && body.detail) err += ' — ' + body.detail;
            return {
              ok: res.ok && body && body.ok,
              error: err,
            };
          });
        })
        .then(function (result) {
          if (!result.ok) throw new Error(result.error || 'Send failed.');
          form.classList.add('sent');
          status.textContent = 'Sent. I reply within two business days.';
          form.reset();
        })
        .catch(function (err) {
          form.classList.add('failed');
          status.textContent =
            (err && err.message ? err.message : 'Send failed.') +
            ' You can also email Jacob_Cuthbertson@outlook.com directly.';
        })
        .then(function () {
          form.classList.remove('sending');
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  })();
})();
