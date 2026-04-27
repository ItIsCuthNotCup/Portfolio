(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     MODEL PICKER LAB — frontend
     Reads /api/model-picker (Cloudflare Pages Function), streams
     the answer, renders the comparison table, populates the
     receipts panel from /assets/data/model-picker/methodology.json
     ═══════════════════════════════════════════════════════════ */

  // ── DOM refs ───────────────────────────────────────────────
  const $input    = document.getElementById('mp-input');
  const $charnum  = document.getElementById('mp-charnum');
  const $submit   = document.getElementById('mp-submit');
  const $suggest  = document.getElementById('mp-suggest-list');
  const $result   = document.getElementById('mp-result');
  const $trace    = document.getElementById('mp-trace');
  const $traceTxt = document.getElementById('mp-trace-text');
  const $answer   = document.getElementById('mp-answer');
  const $tbody    = document.getElementById('mp-table-body');
  const $error    = document.getElementById('mp-error');
  const $receipts = document.getElementById('mp-receipts');

  if (!$input || !$submit) return;

  let inFlight = false;

  // ── Char counter ───────────────────────────────────────────
  function updateChar() {
    if ($charnum) $charnum.textContent = String($input.value.length);
  }
  $input.addEventListener('input', updateChar);
  updateChar();

  // ── Submit on Enter (without shift), or button click ──────
  $input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitQuery();
    }
  });
  $submit.addEventListener('click', submitQuery);

  // Suggestion buttons → fill input + auto-submit
  if ($suggest) {
    $suggest.addEventListener('click', (e) => {
      const btn = e.target.closest('.mp-suggest-btn');
      if (!btn) return;
      const q = btn.dataset.q || btn.textContent.trim();
      $input.value = q;
      updateChar();
      submitQuery();
    });
  }

  // ── Render utilities ───────────────────────────────────────
  function fmtPrice(p) {
    if (p == null || isNaN(p)) return '—';
    if (p === 0) return 'free';
    if (p < 1) return '$' + p.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
    if (p < 10) return '$' + p.toFixed(2);
    return '$' + p.toFixed(1);
  }

  function fmtCtx(n) {
    if (!n) return '—';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (n >= 1_000)    return Math.round(n / 1_000) + 'k';
    return String(n);
  }

  function capCell(chunk) {
    const caps = [
      { key: 'V', on: !!chunk.modalities?.vision },
      { key: 'T', on: !!chunk.capabilities?.tools },
      { key: 'J', on: !!chunk.capabilities?.json },
      { key: 'R', on: !!chunk.capabilities?.reasoning, accent: true },
    ];
    return '<span class="mp-caps">' + caps.map(c =>
      `<span class="mp-cap${c.on ? ' on' : ''}${c.on && c.accent ? ' accent' : ''}" title="${c.key === 'V' ? 'vision' : c.key === 'T' ? 'tools' : c.key === 'J' ? 'JSON mode' : 'reasoning'}">${c.key}</span>`
    ).join('') + '</span>';
  }

  function latCell(tier) {
    const filled = tier === 'fast' ? 3 : tier === 'medium' ? 2 : 1;
    return '<span class="mp-lat">' +
      [1,2,3].map(i => `<span class="mp-lat-dot${i <= filled ? ' on' : ''}"></span>`).join('') +
      '</span>';
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, ch =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])
    );
  }

  function renderTable(chunks) {
    if (!$tbody) return;
    $tbody.innerHTML = chunks.map(c => {
      const provider  = escapeHtml(c.provider || '—');
      const name      = escapeHtml(c.name || c.id || '—');
      const url       = c.id ? `https://openrouter.ai/${encodeURIComponent(c.id)}` : '#';
      const pIn       = fmtPrice(c.input_price_per_m);
      const pOut      = fmtPrice(c.output_price_per_m);
      const ctx       = fmtCtx(c.context_length);
      const tier      = c.latency_tier || 'medium';
      const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
      const tagline   = escapeHtml(c.tagline || '—');
      return `
        <tr>
          <td class="model">
            <span class="provider">${provider}</span>
            <a href="${url}" target="_blank" rel="noopener">${name}</a>
          </td>
          <td class="num">${pIn}</td>
          <td class="num">${pOut}</td>
          <td class="num">${ctx}</td>
          <td>${capCell(c)}</td>
          <td>${latCell(tier)} <span style="margin-left:6px;color:var(--ink-dim);font-size:10px;letter-spacing:0.1em;text-transform:uppercase;">${escapeHtml(tierLabel)}</span></td>
          <td class="bestfor">${tagline}</td>
        </tr>
      `;
    }).join('');
  }

  // Wrap any model name from the candidates that appears in the answer prose
  // with a styled span. Done after streaming finishes.
  function highlightModelRefs(chunks) {
    if (!$answer || !chunks?.length) return;
    let html = $answer.innerHTML;
    const seen = new Set();
    chunks.forEach(c => {
      const name = c.name;
      if (!name || seen.has(name)) return;
      seen.add(name);
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, 'g');
      html = html.replace(re, `<span class="mp-model-ref">${escapeHtml(name)}</span>`);
    });
    $answer.innerHTML = html;
  }

  // ── Trace updates ──────────────────────────────────────────
  function setTrace(text, done = false) {
    if (!$trace || !$traceTxt) return;
    $traceTxt.textContent = text;
    $trace.classList.toggle('done', done);
  }

  // ── Error rendering ────────────────────────────────────────
  function showError(msg) {
    if (!$error) return;
    $error.hidden = false;
    $error.innerHTML = `<span class="label">Couldn't run that</span>${escapeHtml(msg)}`;
  }
  function clearError() {
    if (!$error) return;
    $error.hidden = true;
    $error.innerHTML = '';
  }

  // ── Submit ─────────────────────────────────────────────────
  async function submitQuery() {
    if (inFlight) return;
    const q = $input.value.trim();
    if (!q) {
      $input.focus();
      return;
    }
    if (q.length > 1500) {
      showError('Query is over the 1,500-character limit.');
      return;
    }

    inFlight = true;
    $submit.disabled = true;
    clearError();
    $result.hidden = false;
    $answer.innerHTML = '<span class="mp-cursor"></span>';
    $tbody.innerHTML = '';
    setTrace('embedding query…');

    try {
      const resp = await fetch('/api/model-picker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });

      // Endpoint never emits 5xx by contract — always 200 with ok:false on failure.
      if (!resp.ok && resp.status !== 200) {
        throw new Error(`Endpoint returned HTTP ${resp.status}`);
      }

      const ct = resp.headers.get('content-type') || '';

      // JSON path — error case (ok:false) or non-streaming success
      if (ct.includes('application/json')) {
        const body = await resp.json();
        if (body.ok === false) {
          $answer.innerHTML = '';
          showError(body.error || 'Something went wrong on our side.');
          setTrace('done', true);
          return;
        }
        // Non-streaming success (cache hit)
        if (body.candidates) renderTable(body.candidates);
        if (body.answer) {
          $answer.innerHTML = '';
          $answer.textContent = body.answer;
          highlightModelRefs(body.candidates || []);
        }
        if (body.trace) setTrace(body.trace, true);
        else setTrace('done', true);
        return;
      }

      // SSE / text-stream path
      if (!resp.body) throw new Error('No response body to stream.');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let answerText = '';
      let candidates = null;
      let traceFinal = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE-style events split on double newline
        let idx;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (!raw.trim()) continue;

          // Each event is "data: {json}" possibly with "event: <name>"
          let evtName = 'message';
          let dataStr = '';
          raw.split('\n').forEach(line => {
            if (line.startsWith('event:')) evtName = line.slice(6).trim();
            else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
          });
          if (!dataStr) continue;

          let payload;
          try { payload = JSON.parse(dataStr); }
          catch { continue; }

          if (evtName === 'trace' && payload.text) {
            setTrace(payload.text);
          } else if (evtName === 'candidates' && Array.isArray(payload.candidates)) {
            candidates = payload.candidates;
            renderTable(candidates);
          } else if (evtName === 'token' && typeof payload.text === 'string') {
            answerText += payload.text;
            $answer.innerHTML = escapeHtml(answerText) + '<span class="mp-cursor"></span>';
          } else if (evtName === 'error' && payload.message) {
            $answer.innerHTML = '';
            showError(payload.message);
          } else if (evtName === 'done') {
            traceFinal = payload.trace || '';
          }
        }
      }

      // Final pass
      $answer.innerHTML = escapeHtml(answerText);
      if (candidates) highlightModelRefs(candidates);
      setTrace(traceFinal || 'done', true);
    } catch (err) {
      $answer.innerHTML = '';
      showError(err && err.message ? err.message : 'Network error.');
      setTrace('failed', true);
    } finally {
      inFlight = false;
      $submit.disabled = false;
    }
  }

  // ── Receipts panel ─────────────────────────────────────────
  async function loadReceipts() {
    if (!$receipts) return;
    try {
      const resp = await fetch('/assets/data/model-picker/methodology.json', { cache: 'no-cache' });
      if (!resp.ok) throw new Error('methodology.json missing');
      const m = await resp.json();
      const cells = [
        { label: 'Models indexed',     value: m.model_count ?? '—' },
        { label: 'Last refresh',       value: m.last_refresh_human ?? '—' },
        { label: 'Embedding model',    value: m.embedding_model ?? '—', smallish: true },
        { label: 'Generation model',   value: m.generation_model ?? '—', smallish: true },
        { label: 'Avg cost / query',   value: m.avg_cost_per_query ?? '—', unit: 'cents' },
        { label: 'TTFT (target)',      value: m.ttft_target_ms ?? '—', unit: 'ms' },
        { label: 'Daily spend cap',    value: m.daily_spend_cap ?? '—', unit: 'USD' },
        { label: 'Cache TTL',          value: m.cache_ttl_hours ?? '—', unit: 'hr' },
      ];
      $receipts.innerHTML = cells.map(c => {
        const valHtml = c.smallish
          ? `<span style="font-size:18px;line-height:1.25;display:inline-block;">${escapeHtml(c.value)}</span>`
          : `${escapeHtml(c.value)}${c.unit ? `<span class="small">${escapeHtml(c.unit)}</span>` : ''}`;
        return `
          <div class="mp-receipt">
            <div class="mp-receipt-label">${escapeHtml(c.label)}</div>
            <div class="mp-receipt-value">${valHtml}</div>
          </div>
        `;
      }).join('');
    } catch (err) {
      // Non-fatal; show a placeholder.
      $receipts.innerHTML = '<div class="mp-receipt" style="grid-column: 1 / -1;"><div class="mp-receipt-label">Receipts</div><div class="mp-receipt-value" style="font-size:16px;">methodology.json not yet built — run notebooks/model_picker_lab.py to generate it</div></div>';
    }
  }
  loadReceipts();
})();
