// ─────────────────────────────────────────────────────────────
// Fallback reply templates (used when LLM call fails)
// {title} and {url} are interpolated per lab
// ─────────────────────────────────────────────────────────────

const OPENERS = [
  "Been thinking about this exact thing. Built something on it: {url}",
  "I got curious and actually made a thing for this: {url}",
  "This is one I've been studying. Made an interactive tool: {url}",
  "I ran the numbers on this. {title}: {url}",
  "Made something that gets at exactly this: {url}",
  "Honestly I built {title} for this reason: {url}",
  "Spent way too long on this. Result: {url}",
  "Same question drove me to build this: {url}",
  "Covered this with real data: {url}",
  "I mapped this out interactively: {url}",
  "Not sure if this helps but I built a thing: {url}",
  "Fell down this rabbit hole and came out with: {url}",
  "I actually built something that tries to answer this: {url}",
  "This topic has been living rent-free. Made this: {url}",
  "Made an infographic on this actually: {url}",
];

// Use crypto-random for selection (matches index.js — replies/tweets
// shouldn't be predictable from V8 PRNG state).
function cryptoRandom() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 0x100000000;
}

// Plain split-and-join. String.replace interprets $&, $', $`, $1 etc.
// in the REPLACEMENT — using split/join avoids that footgun even if
// lab.title or lab.url ever contains those characters.
function safeReplaceAll(haystack, needle, replacement) {
  return haystack.split(needle).join(replacement);
}

export function pickTemplate(lab) {
  const idx = Math.floor(cryptoRandom() * OPENERS.length);
  let template = OPENERS[idx];
  template = safeReplaceAll(template, '{title}', String(lab?.title ?? ''));
  template = safeReplaceAll(template, '{url}',   String(lab?.url   ?? ''));
  return template;
}
