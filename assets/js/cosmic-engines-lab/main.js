// ─── Cosmic Engines · entry ─────────────────────────────────────────
// Wires the hero scroll scene, the Engine Room object viewer, the
// chapter card content, and the comparison matrix from data.js.
// ────────────────────────────────────────────────────────────────────

import { COSMIC_OBJECTS, COMPARISON_ROWS } from './data.js';
import { initHero } from './hero.js';
import { initViewer } from './viewer.js';

// Quick lookup
const BY_ID = Object.fromEntries(COSMIC_OBJECTS.map((o) => [o.id, o]));

// ─── Hero ──────────────────────────────────────────────────────────
function bootHero() {
  const container = document.getElementById('cosmic-hero');
  const canvas = document.getElementById('cosmic-hero-canvas');
  if (!container || !canvas) return;

  // Label elements (positioned absolutely over the canvas via CSS)
  const labels = {
    shadow: document.querySelector('[data-cosmic-label="shadow"]'),
    disk: document.querySelector('[data-cosmic-label="disk"]'),
    jet: document.querySelector('[data-cosmic-label="jet"]'),
    host: document.querySelector('[data-cosmic-label="host"]'),
    spectrum: document.querySelector('[data-cosmic-label="spectrum"]')
  };

  try {
    initHero({ canvas, container, labelEls: labels });
  } catch (err) {
    showWebglFallback();
    console.warn('cosmic-engines hero failed:', err);
  }
}

function showWebglFallback() {
  const fb = document.querySelector('.cosmic-webgl-fallback');
  if (fb) fb.style.display = 'flex';
}

// ─── Engine Room (object browser) ──────────────────────────────────

function bootBrowser() {
  const container = document.getElementById('cosmic-browser');
  const canvas = document.getElementById('cosmic-browser-canvas');
  const cardsWrap = document.getElementById('cosmic-browser-cards');
  const titleEl = document.getElementById('cosmic-browser-title');
  const taglineEl = document.getElementById('cosmic-browser-tagline');
  const seeingEl = document.getElementById('cosmic-browser-seeing');
  const factsEl = document.getElementById('cosmic-browser-facts');
  const sourcesEl = document.getElementById('cosmic-browser-sources');
  const sourceTagEl = document.getElementById('cosmic-browser-source-tag');
  if (!container || !canvas || !cardsWrap) return;

  // Render the card buttons
  cardsWrap.innerHTML = '';
  COSMIC_OBJECTS.forEach((obj, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cosmic-card';
    btn.setAttribute('data-id', obj.id);
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = `
      <span class="cosmic-card-glyph" style="color:${obj.accent}">${obj.glyph}</span>
      <span class="cosmic-card-name">${obj.label}</span>
      <span class="cosmic-card-tagline">${obj.tagline}</span>
    `;
    btn.addEventListener('click', () => selectObject(obj.id));
    cardsWrap.appendChild(btn);
  });

  let viewer;
  try {
    viewer = initViewer({
      canvas,
      container,
      onReady: (id, source) => {
        if (sourceTagEl) {
          sourceTagEl.textContent = source === 'glb' ? 'GLB asset · loaded' : 'Procedural · stylized';
        }
      }
    });
  } catch (err) {
    console.warn('cosmic-engines viewer failed:', err);
    showWebglFallback();
    return;
  }

  function selectObject(id) {
    const obj = BY_ID[id];
    if (!obj) return;
    // Update active card
    cardsWrap.querySelectorAll('.cosmic-card').forEach((c) => {
      const isActive = c.dataset.id === id;
      c.classList.toggle('is-active', isActive);
      c.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    // Update detail panel
    if (titleEl) titleEl.textContent = obj.label;
    if (taglineEl) taglineEl.textContent = obj.tagline;
    if (seeingEl) seeingEl.textContent = obj.seeing;
    if (factsEl) {
      factsEl.innerHTML = obj.facts
        .map(
          (f) => `
        <div class="cosmic-fact">
          <span class="cosmic-fact-k">${f.k}</span>
          <span class="cosmic-fact-v">${f.v}</span>
          <span class="cosmic-fact-conf cosmic-conf-${f.conf}">${f.conf}</span>
        </div>`
        )
        .join('');
    }
    if (sourcesEl) {
      sourcesEl.innerHTML = obj.sources
        .map(
          (s) =>
            `<a class="cosmic-source-link" href="${s.url}" target="_blank" rel="noopener noreferrer">${s.label} <span aria-hidden="true">↗</span></a>`
        )
        .join('');
    }
    // Tell the viewer
    viewer.setObject(id);
  }

  // Initial pick
  selectObject('quasar');

  // Hash routing — #engine=pulsar will jump and select
  function readHash() {
    const m = window.location.hash.match(/engine=([a-z]+)/);
    if (m && BY_ID[m[1]]) selectObject(m[1]);
  }
  readHash();
  window.addEventListener('hashchange', readHash);
}

// ─── Chapter cards ─────────────────────────────────────────────────

function bootChapters() {
  const wrap = document.getElementById('cosmic-chapters');
  if (!wrap) return;
  wrap.innerHTML = COSMIC_OBJECTS.map((obj, i) => {
    const num = String(i + 1).padStart(2, '0');
    const factsHtml = obj.facts
      .map(
        (f) => `
      <li>
        <span class="cosmic-chapter-fact-k">${f.k}</span>
        <span class="cosmic-chapter-fact-v">${f.v}</span>
      </li>`
      )
      .join('');
    const sourcesHtml = obj.sources
      .map((s) => `<a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.label} ↗</a>`)
      .join(' &middot; ');
    return `
      <article class="cosmic-chapter" id="chapter-${obj.id}" style="--accent-cosmic:${obj.accent}">
        <div class="cosmic-chapter-num mono">CH. ${num}</div>
        <h3 class="cosmic-chapter-name">${obj.label}</h3>
        <p class="cosmic-chapter-headline serif-italic">${obj.headline}</p>
        <p class="cosmic-chapter-body">${obj.matter}</p>
        <div class="cosmic-chapter-seeing">
          <div class="cosmic-chapter-label mono">What you are seeing</div>
          <p>${obj.seeing}</p>
          ${obj.notToScale ? '<div class="cosmic-chapter-noscale mono">Not to scale &middot; stylized visualization</div>' : ''}
        </div>
        <ul class="cosmic-chapter-facts">${factsHtml}</ul>
        <div class="cosmic-chapter-sources mono">${sourcesHtml}</div>
        <div class="cosmic-chapter-cta">
          <a href="#engine-room" data-cosmic-show="${obj.id}">View in Engine Room ↗</a>
        </div>
      </article>
    `;
  }).join('');

  // Engine Room jump links — also re-select inside the browser
  wrap.querySelectorAll('[data-cosmic-show]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('data-cosmic-show');
      if (id) {
        // Update hash so the browser handler re-selects
        window.location.hash = `#engine=${id}`;
      }
    });
  });
}

// ─── Comparison matrix ─────────────────────────────────────────────

function bootMatrix() {
  const tbody = document.getElementById('cosmic-matrix-body');
  if (!tbody) return;
  tbody.innerHTML = COMPARISON_ROWS.map(
    (r) => `
    <tr>
      <th scope="row">${r.object}</th>
      <td>${r.engine}</td>
      <td>${r.energy}</td>
      <td>${r.observe}</td>
      <td>${r.scale}</td>
      <td><em>${r.signature}</em></td>
    </tr>`
  ).join('');
}

// ─── Boot ──────────────────────────────────────────────────────────

if (typeof WebGLRenderingContext === 'undefined') {
  showWebglFallback();
} else {
  bootHero();
  bootBrowser();
  bootChapters();
  bootMatrix();
}

// Set the dateline on the lab
const dl = document.getElementById('cosmic-dateline-time');
if (dl) {
  const d = new Date();
  dl.textContent = d.toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'UTC'
  }) + ' UTC';
}
