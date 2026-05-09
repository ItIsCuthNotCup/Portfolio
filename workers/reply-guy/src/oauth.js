// ─────────────────────────────────────────────────────────────
// OAuth 1.0a signing for Twitter API v2
// ─────────────────────────────────────────────────────────────

function percentEncode(str) {
  return encodeURIComponent(str)
    .replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Generate OAuth 1.0a signature base string and sign with HMAC-SHA1.
 * Returns the full Authorization header value.
 */
export async function oauthHeader(method, url, oauthParams, consumerSecret, tokenSecret) {
  // Collect all params for signature
  const sigParams = { ...oauthParams };

  const sortedKeys = Object.keys(sigParams).sort();
  const paramStr = sortedKeys
    .map(k => `${percentEncode(k)}=${percentEncode(sigParams[k])}`)
    .join('&');

  const base = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramStr)}`;

  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret || '')}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingKey),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(base));
  const signature = arrayBufferToBase64(sigBytes);

  // Build the final OAuth header string
  const headerParams = { ...oauthParams, oauth_signature: signature };
  const headerStr = Object.keys(headerParams)
    .sort()
    .map(k => `${percentEncode(k)}="${percentEncode(headerParams[k])}"`)
    .join(', ');

  return `OAuth ${headerStr}`;
}

/** Generate fresh oauth_nonce and oauth_timestamp */
export function oauthNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 32; i++) {
    nonce += chars[bytes[i] % chars.length];
  }
  return nonce;
}

export function oauthTimestamp() {
  return Math.floor(Date.now() / 1000).toString();
}
