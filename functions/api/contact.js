// POST /api/contact
// Accepts a JSON body from the site's contact form, validates it, and
// sends the message via Resend to Jacob_Cuthbertson@outlook.com.
//
// Environment variables required (set in Cloudflare Pages -> Settings
// -> Variables and Secrets, type=Secret, Production env):
//   RESEND_API_KEY   : an API key from https://resend.com (re_xxx)
//
// Implementation notes:
// - Single onRequest handler dispatches by method. Having both
//   onRequestPost AND onRequest caused issues where Pages' fallback
//   asset-serving behavior returned index.html on POST in some
//   deployments. Folding all methods into one function avoids that.
// - Every response goes through json() which sets Content-Type, so
//   the frontend never sees HTML regardless of which branch runs.
// - Entire handler wrapped in try/catch so an unexpected exception
//   still returns JSON 500 rather than bubbling to Cloudflare's
//   default HTML error page.

// Defaults; can be overridden per-environment via Cloudflare env vars
// (Pages project -> Settings -> Variables and Secrets, as plain vars,
// not Secrets). Once you verify jakecuth.com in Resend, point
// CONTACT_FROM at an address on that verified domain and you can
// send to any recipient. Until then, CONTACT_TO must be the email
// you signed up for Resend with (Resend sandbox rule).
const DEFAULT_TO = 'commandercuth@gmail.com';
const DEFAULT_FROM = 'Portfolio Contact <onboarding@resend.dev>';

const MAX_NAME = 200;
const MAX_EMAIL = 200;
const MAX_COMPANY = 200;
const MAX_MESSAGE = 5000;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

async function handleGet({ env }) {
  return json({
    ok: true,
    service: 'contact',
    method: 'GET',
    configured: Boolean(env.RESEND_API_KEY),
  });
}

async function handlePost({ request, env }) {
  // Parse JSON body. We accept a wider range of content types to be
  // forgiving; some clients send application/json; charset=utf-8.
  let data;
  try {
    const ct = (request.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/json')) {
      data = await request.json();
    } else {
      // Fall back to parsing the raw body as JSON in case CT is missing.
      const text = await request.text();
      data = text ? JSON.parse(text) : {};
    }
  } catch (err) {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  // Null-safety: "null" or an array body would pass JSON parse but
  // then crash on data.name. Treat non-objects as bad input.
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return json({ ok: false, error: 'Invalid request body.' }, 400);
  }

  // Diagnostic shortcut: POST {"diag": true} returns a live health
  // check, no email sent. Useful from the browser devtools console.
  if (data.diag === true) {
    return json({
      ok: true,
      service: 'contact',
      method: 'POST',
      configured: Boolean(env.RESEND_API_KEY),
      ts: Date.now(),
    });
  }

  const name = (data.name || '').toString().trim();
  const email = (data.email || '').toString().trim();
  const company = (data.company || '').toString().trim();
  const message = (data.message || '').toString().trim();
  const hp = (data.hp || '').toString();

  // Honeypot: bots fill this hidden field.
  if (hp) return json({ ok: true });

  // Required fields
  if (!name || !email || !message) {
    return json({ ok: false, error: 'Name, email, and message are required.' }, 400);
  }

  // Length caps
  if (
    name.length > MAX_NAME ||
    email.length > MAX_EMAIL ||
    company.length > MAX_COMPANY ||
    message.length > MAX_MESSAGE
  ) {
    return json({ ok: false, error: 'One of the fields is too long.' }, 400);
  }

  // Basic email shape
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: 'That email address looks off.' }, 400);
  }

  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    // Return 200 with ok:false so Cloudflare's edge doesn't intercept
    // a 5xx status and replace our JSON with an HTML error page.
    return json({ ok: false, error: 'Server misconfigured: RESEND_API_KEY missing.' });
  }

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeCompany = escapeHtml(company);
  const safeMessage = escapeHtml(message);

  const html = `
<div style="font-family: -apple-system, Helvetica, Arial, sans-serif; line-height:1.45; color:#111;">
  <p><strong>From:</strong> ${safeName} &lt;${safeEmail}&gt;</p>
  ${company ? `<p><strong>Company / context:</strong> ${safeCompany}</p>` : ''}
  <p><strong>Message:</strong></p>
  <div style="white-space: pre-wrap; border-left: 3px solid #999; padding-left: 12px; color:#333;">${safeMessage}</div>
  <hr style="border:none; border-top:1px solid #ddd; margin:24px 0;">
  <p style="font-size:12px; color:#888;">
    Sent from the contact form on jakecuth.com. Reply goes directly to the sender.
  </p>
</div>`.trim();

  const text = [
    `From: ${name} <${email}>`,
    company ? `Company / context: ${company}` : null,
    '',
    'Message:',
    message,
    '',
    '--',
    'Sent from the contact form on jakecuth.com.',
  ]
    .filter((l) => l !== null)
    .join('\n');

  const subject = `Portfolio inquiry · ${name}${company ? ` · ${company}` : ''}`;

  // Resolve the to/from at request time so env var changes take
  // effect immediately on deploy (no code change needed once the user
  // verifies a domain in Resend).
  const toEmail = (env.CONTACT_TO && String(env.CONTACT_TO).trim()) || DEFAULT_TO;
  const fromEmail = (env.CONTACT_FROM && String(env.CONTACT_FROM).trim()) || DEFAULT_FROM;

  // Timeout so a hanging Resend call can't pin the Worker and trigger
  // Cloudflare's own 502 edge error.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  let resendRes;
  let networkErr = null;
  try {
    resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        reply_to: email,
        subject,
        html,
        text,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    networkErr = (err && (err.name === 'AbortError' ? 'timeout' : err.message)) || String(err);
  } finally {
    clearTimeout(timeoutId);
  }

  if (networkErr) {
    // 200 + ok:false so Cloudflare can't swap in its HTML error page.
    return json({ ok: false, error: 'Network error reaching email service.', detail: networkErr });
  }

  if (!resendRes.ok) {
    const status = resendRes.status;
    let upstreamBody = '';
    try { upstreamBody = (await resendRes.text()).slice(0, 400); } catch {}
    // Translate common Resend status codes into actionable hints.
    let hint = '';
    if (status === 401) {
      hint = 'RESEND_API_KEY is invalid or revoked. Create a new key at resend.com/api-keys.';
    } else if (status === 403) {
      hint =
        'Resend sandbox policy. Either (a) verify jakecuth.com as a sending domain in Resend ' +
        'and set CONTACT_FROM to an address on it, or (b) set CONTACT_TO to the email you ' +
        'signed up for Resend with.';
    } else if (status === 422) {
      hint = 'Resend rejected the email payload. See upstreamBody for the specific field complaint.';
    }
    // 200 + ok:false so Cloudflare can't swap in its HTML error page.
    return json({
      ok: false,
      error: 'Email service rejected the request.',
      upstream: status,
      upstreamBody,
      hint,
    });
  }

  return json({ ok: true });
}

// Single entry point. Dispatches by method. Wraps the entire body in
// try/catch so any unexpected exception returns JSON, never HTML.
export async function onRequest(ctx) {
  try {
    const method = ctx.request.method.toUpperCase();
    if (method === 'GET') return await handleGet(ctx);
    if (method === 'POST') return await handlePost(ctx);
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Allow: 'GET, POST, OPTIONS',
        },
      });
    }
    return json({ ok: false, error: 'Method not allowed.' }, 405, { Allow: 'GET, POST, OPTIONS' });
  } catch (err) {
    // Any uncaught error still yields JSON, not HTML. Status 200 so
    // Cloudflare's edge doesn't replace our body with its own
    // branded 5xx error page.
    return json({
      ok: false,
      error: 'Internal error.',
      detail: String((err && err.message) || err),
    });
  }
}
