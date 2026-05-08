(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     TOKENIZATION LAB — BPE visualizer
     Pure-JS Byte Pair Encoding training loop.
     ═══════════════════════════════════════════════════════════ */

  // ── DOM refs ──
  const $ = (id) => document.getElementById(id);
  const textarea       = $('tk-textarea');
  const stepBtn        = $('tk-step');
  const autoBtn        = $('tk-autoplay');
  const resetBtn       = $('tk-reset');
  const vocabSlider    = $('tk-vocab-slider');
  const vocabVal       = $('tk-vocab-val');
  const mergeStatus    = $('tk-merge-status');
  const tokenStream    = $('tk-token-stream');
  const tokenCount     = $('tk-token-count');
  const historyList    = $('tk-history-list');
  const statTokens     = $('tk-stat-tokens');
  const statVocab      = $('tk-stat-vocab');
  const statCompression= $('tk-stat-compression');

  const decoder = new TextDecoder('utf-8', { fatal: false });

  // ── State ──
  let state = {
    text: '',
    tokens: [],
    vocab: new Map(),      // id -> Uint8Array
    merges: [],            // {a, b, newId, count}
    nextId: 256,
    targetVocabSize: 64,
    initialTokenCount: 0,
    autoPlayId: null,
    isPlaying: false,
  };

  // ── Helpers ──
  function vocabSizeFromSlider(v) {
    // slider 4..9 -> 16,32,64,128,256,512
    return 1 << v;
  }

  function getTokenString(id) {
    const bytes = state.vocab.get(id);
    if (!bytes) return '?';
    if (id < 256) {
      const b = bytes[0];
      if (b === 0x20) return '\\s';
      if (b === 0x0a) return '\\n';
      if (b === 0x09) return '\\t';
      if (b === 0x0d) return '\\r';
      if (b >= 0x20 && b < 0x7f) return String.fromCharCode(b);
      return '0x' + b.toString(16).padStart(2, '0');
    }
    const s = decoder.decode(bytes);
    if (s === ' ') return '\\s';
    if (s === '\n') return '\\n';
    if (s === '\t') return '\\t';
    if (s === '\r') return '\\r';
    return s;
  }

  function truncate(str, max) {
    return str.length > max ? str.slice(0, max) + '…' : str;
  }

  // ── Core BPE ──
  function init(text) {
    state.text = text;
    const bytes = new TextEncoder().encode(text);
    state.tokens = Array.from(bytes);
    state.initialTokenCount = state.tokens.length;
    state.vocab = new Map();
    for (let i = 0; i < 256; i++) {
      state.vocab.set(i, new Uint8Array([i]));
    }
    state.merges = [];
    state.nextId = 256;
    stopAutoPlay();
    render();
  }

  function bpeStep() {
    if (state.tokens.length < 2) return false;
    if (state.nextId >= state.targetVocabSize) return false;

    // Count adjacent pairs
    const counts = new Map();
    for (let i = 0; i < state.tokens.length - 1; i++) {
      const key = state.tokens[i] * 1000000 + state.tokens[i + 1];
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    let bestKey = null;
    let bestCount = 0;
    for (const [key, cnt] of counts) {
      if (cnt > bestCount) {
        bestCount = cnt;
        bestKey = key;
      }
    }

    if (bestCount < 2) return false;

    const a = Math.floor(bestKey / 1000000);
    const b = bestKey % 1000000;
    const newId = state.nextId;

    // Build new vocab entry
    const aBytes = state.vocab.get(a);
    const bBytes = state.vocab.get(b);
    const merged = new Uint8Array(aBytes.length + bBytes.length);
    merged.set(aBytes);
    merged.set(bBytes, aBytes.length);
    state.vocab.set(newId, merged);

    // Replace globally
    const next = [];
    let i = 0;
    while (i < state.tokens.length) {
      if (i < state.tokens.length - 1 && state.tokens[i] === a && state.tokens[i + 1] === b) {
        next.push(newId);
        i += 2;
      } else {
        next.push(state.tokens[i]);
        i += 1;
      }
    }

    state.tokens = next;
    state.merges.push({ a, b, newId, count: bestCount });
    state.nextId++;
    return true;
  }

  function step() {
    const ok = bpeStep();
    if (ok) render();
    return ok;
  }

  function startAutoPlay() {
    if (state.isPlaying) return;
    state.isPlaying = true;
    autoBtn.classList.add('active');
    autoBtn.textContent = 'Pause';
    state.autoPlayId = setInterval(() => {
      const ok = bpeStep();
      if (ok) {
        render();
      } else {
        stopAutoPlay();
      }
    }, 100);
  }

  function stopAutoPlay() {
    state.isPlaying = false;
    autoBtn.classList.remove('active');
    autoBtn.textContent = 'Auto-play';
    if (state.autoPlayId) {
      clearInterval(state.autoPlayId);
      state.autoPlayId = null;
    }
  }

  // ── Render ──
  function render() {
    const newestId = state.merges.length ? state.merges[state.merges.length - 1].newId : -1;

    // Token stream
    if (state.tokens.length === 0) {
      tokenStream.innerHTML = '<div class="tk-token-empty mono">Enter text and press Step to begin.</div>';
    } else {
      tokenStream.innerHTML = '';
      const frag = document.createDocumentFragment();
      for (const id of state.tokens) {
        const pill = document.createElement('span');
        pill.className = 'tk-pill';
        if (id < 256) pill.classList.add('byte');
        if (id === newestId) pill.classList.add('new');

        const idSpan = document.createElement('span');
        idSpan.className = 'tk-pill-id';
        idSpan.textContent = String(id);

        const textSpan = document.createElement('span');
        textSpan.textContent = truncate(getTokenString(id), 24);

        pill.appendChild(idSpan);
        pill.appendChild(textSpan);
        frag.appendChild(pill);
      }
      tokenStream.appendChild(frag);
    }
    tokenCount.textContent = String(state.tokens.length);

    // Stats
    statTokens.textContent = String(state.tokens.length);
    statVocab.textContent = String(state.nextId);
    const ratio = state.initialTokenCount / Math.max(1, state.tokens.length);
    statCompression.textContent = ratio.toFixed(2) + '\u00d7';

    // Merge history
    if (state.merges.length === 0) {
      historyList.innerHTML = '<li class="tk-history-empty mono">No merges yet.</li>';
    } else {
      historyList.innerHTML = '';
      const frag = document.createDocumentFragment();
      // Show newest first, limit to 50
      const start = Math.max(0, state.merges.length - 50);
      for (let i = state.merges.length - 1; i >= start; i--) {
        const m = state.merges[i];
        const li = document.createElement('li');

        const idSpan = document.createElement('span');
        idSpan.className = 'h-id mono';
        idSpan.textContent = '#' + m.newId;

        const pairSpan = document.createElement('span');
        pairSpan.className = 'h-pair';
        const aStr = truncate(getTokenString(m.a), 12);
        const bStr = truncate(getTokenString(m.b), 12);
        pairSpan.textContent = aStr + ' + ' + bStr;

        const countSpan = document.createElement('span');
        countSpan.className = 'h-count mono';
        countSpan.textContent = '\u00d7' + m.count;

        li.appendChild(idSpan);
        li.appendChild(pairSpan);
        li.appendChild(countSpan);
        frag.appendChild(li);
      }
      historyList.appendChild(frag);
    }

    // Status line
    const remaining = state.targetVocabSize - state.nextId;
    if (remaining <= 0) {
      mergeStatus.textContent = 'Target vocabulary reached (' + state.targetVocabSize + ' tokens).';
    } else if (state.tokens.length < 2) {
      mergeStatus.textContent = 'Sequence too short to merge further.';
    } else {
      mergeStatus.textContent = state.nextId + ' tokens in vocabulary. ' + remaining + ' merges remaining to target.';
    }
  }

  // ── Events ──
  stepBtn.addEventListener('click', () => {
    stopAutoPlay();
    step();
  });

  autoBtn.addEventListener('click', () => {
    if (state.isPlaying) {
      stopAutoPlay();
    } else {
      startAutoPlay();
    }
  });

  resetBtn.addEventListener('click', () => {
    stopAutoPlay();
    init(textarea.value);
  });

  vocabSlider.addEventListener('input', () => {
    state.targetVocabSize = vocabSizeFromSlider(parseInt(vocabSlider.value, 10));
    vocabVal.textContent = String(state.targetVocabSize);
    render();
  });

  textarea.addEventListener('input', () => {
    stopAutoPlay();
    init(textarea.value);
  });

  // Edge-case cards
  document.querySelectorAll('.tk-edge-card').forEach((card) => {
    card.addEventListener('click', () => {
      const text = card.dataset.text;
      if (text) {
        textarea.value = text;
        stopAutoPlay();
        init(text);
        // Scroll to demo
        document.querySelector('.tk-section-demo').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Keyboard shortcut: space to step when focused inside panel
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target === document.body) {
      e.preventDefault();
      stopAutoPlay();
      step();
    }
  });

  // ── Boot ──
  state.targetVocabSize = vocabSizeFromSlider(parseInt(vocabSlider.value, 10));
  init(textarea.value);
})();
