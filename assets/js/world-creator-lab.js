(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     WORLD CREATOR LAB — frontend
     - Loads /assets/data/worlds/machu-picchu.html into the iframe
       on first paint (the seed scene)
     - On submit, POSTs to /api/world-creator (Cloudflare Pages
       Function), streams back HTML, swaps it into iframe via srcdoc
     - Suggestion buttons fill input + auto-submit
     ═══════════════════════════════════════════════════════════ */

  const $input    = document.getElementById('wc-input');
  const $charnum  = document.getElementById('wc-charnum');
  const $submit   = document.getElementById('wc-submit');
  const $suggest  = document.getElementById('wc-suggest-list');
  const $trace    = document.getElementById('wc-trace');
  const $traceTxt = document.getElementById('wc-trace-text');
  const $error    = document.getElementById('wc-error');
  const $frame    = document.getElementById('wc-frame');
  const $frameTitle = document.getElementById('wc-frame-title');
  const $frameMeta  = document.getElementById('wc-frame-meta');

  if (!$input || !$submit || !$frame) return;

  let inFlight = false;

  // ── Char counter ───────────────────────────────────────────
  function updateChar() {
    if ($charnum) $charnum.textContent = String($input.value.length);
  }
  $input.addEventListener('input', updateChar);
  updateChar();

  // ── Seed scene loads via src= so iframe URL stays neat ─────
  $frame.src = '/assets/data/worlds/machu-picchu.html';

  // ── Submit on button or Enter ──────────────────────────────
  $input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitPrompt();
    }
  });
  $submit.addEventListener('click', submitPrompt);

  if ($suggest) {
    $suggest.addEventListener('click', (e) => {
      const btn = e.target.closest('.wc-suggest-btn');
      if (!btn) return;
      const q = btn.dataset.q || btn.textContent.trim();
      $input.value = q;
      updateChar();
      submitPrompt();
    });
  }

  // ── Trace + error rendering ────────────────────────────────
  function setTrace(text, done = false) {
    if (!$trace || !$traceTxt) return;
    $trace.hidden = false;
    $traceTxt.textContent = text;
    $trace.classList.toggle('done', done);
  }
  function showError(msg) {
    if (!$error) return;
    $error.hidden = false;
    $error.innerHTML = `<span class="label">Couldn't build that</span>${escapeHtml(msg)}`;
  }
  function clearError() {
    if (!$error) return;
    $error.hidden = true;
    $error.innerHTML = '';
  }
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, ch =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  // ── Render generated HTML in the iframe ────────────────────
  function renderHtmlInFrame(html, title) {
    // srcdoc lets us drop arbitrary HTML in without a same-origin URL,
    // and iframe sandbox="allow-scripts" prevents the contained scripts
    // from touching the parent page.
    $frame.removeAttribute('src');
    $frame.srcdoc = html;
    if (title && $frameTitle) $frameTitle.textContent = title;
  }

  // ── Submit ─────────────────────────────────────────────────
  async function submitPrompt() {
    if (inFlight) return;
    const q = ($input.value || '').trim();
    if (!q) { $input.focus(); return; }
    if (q.length > 800) {
      showError('Prompt is over the 800-character limit.');
      return;
    }

    inFlight = true;
    $submit.disabled = true;
    clearError();
    setTrace('starting…');

    try {
      const resp = await fetch('/api/world-creator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: q }),
      });

      if (!resp.ok && resp.status !== 200) {
        throw new Error(`Endpoint returned HTTP ${resp.status}`);
      }

      const ct = resp.headers.get('content-type') || '';

      // JSON path: ok:false errors, OR cache-hit non-streaming success
      if (ct.includes('application/json')) {
        const body = await resp.json();
        if (body.ok === false) {
          showError(body.error || 'Something went wrong on our side.');
          setTrace('done', true);
          return;
        }
        if (body.html) {
          renderHtmlInFrame(body.html, q);
          if (body.trace && $frameMeta) $frameMeta.textContent = body.trace;
          setTrace(body.trace || 'cache hit', true);
        }
        return;
      }

      // SSE stream path
      if (!resp.body) throw new Error('No response body to stream.');
      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let finalHtml = '';
      let finalTrace = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (!raw.trim()) continue;

          let evtName = 'message';
          let dataStr = '';
          raw.split('\n').forEach(line => {
            if (line.startsWith('event:')) evtName = line.slice(6).trim();
            else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
          });
          if (!dataStr) continue;

          let payload;
          try { payload = JSON.parse(dataStr); } catch { continue; }

          if (evtName === 'trace' && payload.text) {
            setTrace(payload.text);
          } else if (evtName === 'progress' && payload.chars != null) {
            setTrace(`generating · ${payload.chars.toLocaleString()} chars streamed`);
          } else if (evtName === 'html' && typeof payload.text === 'string') {
            finalHtml = payload.text;
          } else if (evtName === 'error' && payload.message) {
            showError(payload.message);
          } else if (evtName === 'done') {
            finalTrace = payload.trace || '';
          }
        }
      }

      if (finalHtml) {
        renderHtmlInFrame(finalHtml, q);
        if ($frameMeta) $frameMeta.textContent = finalTrace;
        setTrace(finalTrace || 'done', true);
      } else if (!$error.hidden) {
        // error already shown; nothing else to do
      } else {
        showError('No HTML received from the model.');
        setTrace('failed', true);
      }
    } catch (err) {
      showError(err && err.message ? err.message : 'Network error.');
      setTrace('failed', true);
    } finally {
      inFlight = false;
      $submit.disabled = false;
    }
  }
})();
