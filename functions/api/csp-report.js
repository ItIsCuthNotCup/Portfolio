// ═══════════════════════════════════════════════════════════
// /api/csp-report — Cloudflare Pages Function
//
// Receives CSP violation reports from browsers (browsers POST to
// the URL given in `report-uri`). Logs to console so they show up
// in `wrangler pages deployment tail` and the Cloudflare dashboard
// log feed. Returns 204.
//
// The site's CSP is currently in Report-Only mode. This endpoint
// is the data-collection step that makes it possible to flip the
// directive to enforcing later with evidence about what trips it.
//
// Contract from /CLAUDE.md hard rule #4: NEVER emit 5xx. Any
// runtime error returns 204 anyway — we'd rather lose a report
// than serve Cloudflare's branded error page to the user.
// ═══════════════════════════════════════════════════════════

// Browsers cap report bodies at ~16 KB but a defensive limit is
// cheap. Anything larger gets truncated before logging.
const MAX_LOG_CHARS = 4000;

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
  if (request.method !== 'POST') {
    return new Response(null, { status: 204 });
  }

  try {
    const ct = (request.headers.get('content-type') || '').toLowerCase();
    let body;
    if (ct.includes('application/csp-report') || ct.includes('application/json') || ct.includes('application/reports+json')) {
      body = await request.json();
    } else {
      body = await request.text();
    }
    const ua = request.headers.get('user-agent') || '';
    const ref = request.headers.get('referer') || '';
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    const truncated = payload.length > MAX_LOG_CHARS
      ? payload.slice(0, MAX_LOG_CHARS) + '…'
      : payload;
    // One line per report so log search stays simple.
    console.log(`[csp-report] ua="${ua}" ref="${ref}" body=${truncated}`);
  } catch (err) {
    console.log(`[csp-report] parse-failure: ${err && err.message ? err.message : 'unknown'}`);
  }

  return new Response(null, { status: 204 });
}
