// POST /api/contact
// Accepts a JSON body from the site's contact form, validates it,
// and sends the message via Resend to Jacob_Cuthbertson@outlook.com.
//
// Environment variables required (set in Cloudflare Pages -> Settings
// -> Environment Variables, encrypted/"secret"):
//   RESEND_API_KEY   : an API key from https://resend.com (re_xxx)
//
// Security notes:
// - API key never touches the client.
// - HTML escape all user input before rendering into the email body.
// - Honeypot field silently swallows obvious bots.
// - Length caps on every field so a bad actor can't blow up the payload.
// - Basic email-shape check; full validity isn't necessary because the
//   address is only used as Reply-To and the real sender address comes
//   from the authenticated Resend sender.
// - Reply-To set to the form submitter's email so replies from Outlook
//   go directly back to them, not to the Resend relay address.

const TO_EMAIL = 'Jacob_Cuthbertson@outlook.com';
const FROM_EMAIL = 'Portfolio Contact <onboarding@resend.dev>';

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

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost({ request, env }) {
  // Parse JSON body
  let data;
  try {
    data = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const name = (data.name || '').toString().trim();
  const email = (data.email || '').toString().trim();
  const company = (data.company || '').toString().trim();
  const message = (data.message || '').toString().trim();
  const hp = (data.hp || '').toString();

  // Honeypot: bots fill this hidden field. Return OK silently so they
  // don't know they were caught.
  if (hp) return json({ ok: true });

  // Required fields
  if (!name || !email || !message) {
    return json({ error: 'Name, email, and message are required.' }, 400);
  }

  // Length caps
  if (
    name.length > MAX_NAME ||
    email.length > MAX_EMAIL ||
    company.length > MAX_COMPANY ||
    message.length > MAX_MESSAGE
  ) {
    return json({ error: 'One of the fields is too long.' }, 400);
  }

  // Basic email shape
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'That email address looks off.' }, 400);
  }

  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    return json({ error: 'Server misconfigured: RESEND_API_KEY missing.' }, 500);
  }

  // Compose the email. HTML-escape every field we interpolate into the body.
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

  // Fire to Resend
  let resendRes;
  try {
    resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        reply_to: email,
        subject,
        html,
        text,
      }),
    });
  } catch (err) {
    console.error('Resend network error:', err);
    return json({ error: 'Network error reaching email service.' }, 502);
  }

  if (!resendRes.ok) {
    const body = await resendRes.text().catch(() => '');
    console.error('Resend API error:', resendRes.status, body);
    return json({ error: 'Email service rejected the request.' }, 502);
  }

  return json({ ok: true });
}

// GET /api/contact — diagnostic ping. Safe to expose: it only reveals
// whether the function is running and whether the env var is bound.
// Used by the site owner to verify a deploy picked up the Resend key;
// returns nothing a visitor couldn't learn by trying the form.
export async function onRequestGet({ env }) {
  return json({
    ok: true,
    service: 'contact',
    configured: Boolean(env.RESEND_API_KEY),
  });
}

// Any other method -> 405
export async function onRequest() {
  return new Response(null, {
    status: 405,
    headers: { Allow: 'GET, POST' },
  });
}
