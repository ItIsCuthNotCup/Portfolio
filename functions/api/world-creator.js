// ═══════════════════════════════════════════════════════════
// /api/world-creator — Cloudflare Pages Function
//
// Generates a single self-contained HTML scene file from a user prompt
// via OpenRouter. The file uses Three.js loaded from CDN, all logic
// inline, no external assets. Streamed back to the browser, rendered
// in a sandboxed iframe.
//
// Inspired by petergpt/claude-opus-47-context-worlds (MIT). Credit
// surfaced prominently in the lab page.
//
// CLAUDE.md hard rule #4: NEVER emit 5xx. Runtime errors return
// 200 with { ok: false, error }.
// ═══════════════════════════════════════════════════════════

const GEN_MODEL  = 'deepseek/deepseek-v4-pro';   // Code-gen tier model on OpenRouter
const OPENROUTER = 'https://openrouter.ai/api/v1';

// Hard caps. World generation is genuinely expensive — these are tight.
const MAX_INPUT_CHARS    = 800;     // Short prompts are better anyway
const MAX_OUTPUT_TOKENS  = 16000;   // ~50 KB of HTML
const RATE_PER_HOUR      = 3;
const RATE_PER_DAY       = 6;
const CACHE_TTL_SECONDS  = 60 * 60 * 24 * 7;  // 7 days — generations are expensive, cache hard
const DAILY_SPEND_CAP_USD = 5.00;
const ESTIMATED_COST_PER_CALL_USD = 0.15;     // Generous upper bound for Sonnet 4.5 with 16k output

// On-topic guard: world / scene / 3D / landscape / city / build keywords.
// Cheap pre-check before any model call.
const ONTOPIC_PATTERNS = [
  /\b(world|scene|landscape|city|forest|mountain|ocean|island|temple|castle|tower|building|bridge|park|street|garden|cave|desert|valley|skyline|cathedral|palace|ruin|harbor|village|fortress|library|labyrinth|tower|abbey|observatory|monastery|terrace|plaza|square|stage|arena)\b/i,
  /\b(machu|picchu|stonehenge|pyramid|colosseum|notre|kyoto|venice|santorini|petra|angkor|easter|atlantis|tokyo|paris|new york|london|barcelona|prague)\b/i,
  /\b(low[- ]?poly|voxel|isometric|wireframe|ascii|fractal|abstract|geometric|3d|three.?d|three\.?js|render|model)\b/i,
  /\b(at sunset|at dawn|at dusk|at night|by moonlight|in the rain|in the snow|in fog|underwater|in space|in clouds|in mist)\b/i,
  /\b(make|create|build|generate|render|show|design|craft|imagine|visualize|sculpt)\b/i,
];

// System prompt — explicit and constrained to keep generations renderable.
const SYSTEM_PROMPT = `You generate self-contained 3D scenes as a single HTML file.

REQUIREMENTS — non-negotiable:
1. Output ONLY one complete HTML document. No prose, no markdown fences, no explanation. Start with <!DOCTYPE html> and end with </html>.
2. The HTML must be self-contained: no external assets except the Three.js CDN script tag below. All geometry, materials, lighting, animation, and interaction live inline.
3. Required script tag in <head>: <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
4. Use only THREE.js r128 features. No imports, no modules, no ES module syntax. Plain <script> with global THREE.
5. CRITICAL: Do NOT use OrbitControls, PointerLockControls, or any THREE.*Controls helper — those are separate files not in r128 core. Implement camera motion yourself with a continuous orbit, slow flythrough, or animated rotation. Listen to mouse/scroll/touch on window/document directly if you want interactivity.
6. The page background and any styles must work inside an iframe sandboxed with allow-scripts only. Avoid localStorage, top-level navigation, alert(), prompt(), confirm(), or fetch().
7. The renderer canvas must fill 100% of the viewport. Set body { margin: 0; overflow: hidden; }. Resize handler required.
8. Performance budget: target 60fps on a 5-year-old laptop. Keep total geometry under ~50,000 vertices. Use BufferGeometry, low-poly aesthetics, baked lighting where possible.
9. Aesthetic: muted palette, atmospheric lighting (fog OK), low-poly or stylized — like an architectural model, not a photoreal render. Editorial restraint.
10. Animate something subtly: slow camera orbit, rotating object, cloud drift, water shimmer. The scene should not be still.

If the user prompt is unsafe, off-topic, or asks for anything that violates these rules, output a minimal HTML page that explains the refusal in one sentence and renders a simple THREE.js wireframe sphere as a placeholder.`;

// ─────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'POST only' }, 405);
  }

  try {
    if (!env.OPENROUTER_API_KEY) {
      return okFalse('Server is missing the OPENROUTER_API_KEY secret. Set it in the Cloudflare Pages dashboard under Settings → Variables and Secrets.');
    }

    let body;
    try { body = await request.json(); }
    catch { return jsonResponse({ ok: false, error: 'Body must be JSON.' }, 400); }

    const prompt = (body && typeof body.prompt === 'string') ? body.prompt.trim() : '';
    if (!prompt) {
      return jsonResponse({ ok: false, error: 'Missing "prompt" string.' }, 400);
    }
    if (prompt.length > MAX_INPUT_CHARS) {
      return jsonResponse({ ok: false, error: `Prompt exceeds ${MAX_INPUT_CHARS}-character limit.` }, 400);
    }

    const onTopic = ONTOPIC_PATTERNS.some(rx => rx.test(prompt));
    if (!onTopic) {
      return okFalse("This generator builds 3D scenes — places, landscapes, structures, atmospheric vignettes. Try something like 'Machu Picchu at sunset' or 'low-poly Venice canals at dawn.'");
    }

    // Rate limit + spend cap (KV-backed if available, else no-op)
    const ipHash = await hashIp(request);
    const rateMsg = await checkAndBumpRate(env, ipHash);
    if (rateMsg) return okFalse(rateMsg);
    const spendMsg = await checkAndBumpSpend(env);
    if (spendMsg) return okFalse(spendMsg);

    // Cache check — long TTL because generations are expensive
    const cacheKey = await sha256Hex(`wc:${normalizePrompt(prompt)}`);
    const cached = await readCache(env, cacheKey);
    if (cached) {
      return jsonResponse({
        ok: true,
        cached: true,
        html: cached.html,
        trace: `cache hit · ${cached.html.length} chars · ${GEN_MODEL}`,
      });
    }

    // Stream from OpenRouter, accumulate, save to cache, return as JSON
    const t0 = Date.now();
    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        const send = (event, data) => {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          send('trace', { text: `generating · ${GEN_MODEL}` });

          const genResp = await fetch(`${OPENROUTER}/chat/completions`, {
            method: 'POST',
            headers: openrouterHeaders(env),
            body: JSON.stringify({
              model: GEN_MODEL,
              stream: true,
              max_tokens: MAX_OUTPUT_TOKENS,
              temperature: 0.7,
              messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user',   content: prompt },
              ],
            }),
          });

          if (!genResp.ok || !genResp.body) {
            const errText = await safeText(genResp);
            send('error', { message: `Generation failed: ${truncate(errText, 240)}` });
            send('done', { trace: 'generation failed' });
            controller.close();
            return;
          }

          const reader = genResp.body.getReader();
          const dec = new TextDecoder('utf-8');
          let buf = '';
          let fullText = '';
          let lastFlush = Date.now();

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });

            let nl;
            while ((nl = buf.indexOf('\n')) >= 0) {
              const line = buf.slice(0, nl).trim();
              buf = buf.slice(nl + 1);
              if (!line || !line.startsWith('data:')) continue;
              const payload = line.slice(5).trim();
              if (payload === '[DONE]') break;
              try {
                const parsed = JSON.parse(payload);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) fullText += delta;
              } catch { /* ignore */ }
            }

            // Send periodic progress updates to keep the UI alive
            if (Date.now() - lastFlush > 600) {
              send('progress', { chars: fullText.length });
              lastFlush = Date.now();
            }
          }

          // Strip any markdown code fences if the model added them
          const cleaned = stripCodeFences(fullText);
          if (!cleaned.toLowerCase().includes('<!doctype') && !cleaned.toLowerCase().includes('<html')) {
            send('error', { message: 'Model output is not a valid HTML document.' });
            send('done', { trace: 'invalid output' });
            controller.close();
            return;
          }

          await writeCache(env, cacheKey, { html: cleaned });
          const totalMs = Date.now() - t0;
          send('html', { text: cleaned });
          send('done', {
            trace: `${cleaned.length.toLocaleString()} chars · ${GEN_MODEL} · ${totalMs}ms · ~$${ESTIMATED_COST_PER_CALL_USD.toFixed(2)}`,
          });
          controller.close();
        } catch (err) {
          send('error', { message: err?.message || 'Streaming failed' });
          send('done', { trace: 'failed' });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders(),
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    return okFalse(err?.message || 'Unexpected runtime error.');
  }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function stripCodeFences(s) {
  let t = s.trim();
  // Remove ```html ... ``` or ``` ... ``` wrappers if present
  if (t.startsWith('```')) {
    t = t.replace(/^```[a-zA-Z]*\n/, '').replace(/```\s*$/, '');
  }
  return t.trim();
}

async function checkAndBumpRate(env, ipHash) {
  if (!env.MODEL_PICKER_KV) return null; // share KV namespace with other labs
  const hourKey = `wc:rate:h:${ipHash}:${currentHour()}`;
  const dayKey  = `wc:rate:d:${ipHash}:${currentDay()}`;
  const [hourCt, dayCt] = await Promise.all([
    env.MODEL_PICKER_KV.get(hourKey),
    env.MODEL_PICKER_KV.get(dayKey),
  ]);
  const h = parseInt(hourCt || '0', 10);
  const d = parseInt(dayCt  || '0', 10);
  if (h >= RATE_PER_HOUR) return `Rate limit: ${RATE_PER_HOUR} world generations per hour. Try again next hour.`;
  if (d >= RATE_PER_DAY)  return `Rate limit: ${RATE_PER_DAY} world generations per day. Try again tomorrow.`;
  await Promise.all([
    env.MODEL_PICKER_KV.put(hourKey, String(h + 1), { expirationTtl: 3700 }),
    env.MODEL_PICKER_KV.put(dayKey,  String(d + 1), { expirationTtl: 90000 }),
  ]);
  return null;
}

async function checkAndBumpSpend(env) {
  if (!env.MODEL_PICKER_KV) return null;
  const key = `wc:spend:${currentDay()}`;
  const cur = parseFloat(await env.MODEL_PICKER_KV.get(key) || '0');
  if (cur >= DAILY_SPEND_CAP_USD) {
    return `Daily spend cap of $${DAILY_SPEND_CAP_USD.toFixed(2)} reached. World creator is paused until UTC midnight.`;
  }
  await env.MODEL_PICKER_KV.put(
    key, (cur + ESTIMATED_COST_PER_CALL_USD).toFixed(6), { expirationTtl: 90000 }
  );
  return null;
}

async function readCache(env, key) {
  if (!env.MODEL_PICKER_KV) return null;
  return await env.MODEL_PICKER_KV.get(`wc:cache:${key}`, 'json');
}
async function writeCache(env, key, value) {
  if (!env.MODEL_PICKER_KV) return;
  try {
    await env.MODEL_PICKER_KV.put(`wc:cache:${key}`, JSON.stringify(value), { expirationTtl: CACHE_TTL_SECONDS });
  } catch { /* swallow */ }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' },
  });
}
function okFalse(error) {
  return jsonResponse({ ok: false, error }, 200);
}
function openrouterHeaders(env) {
  return {
    'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://jakecuth.com/work/world-creator-lab/',
    'X-Title': 'jakecuth.com · world-creator',
  };
}
async function hashIp(request) {
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '0.0.0.0';
  return sha256Hex(`wc-ip:${ip}`);
}
async function sha256Hex(s) {
  const bytes = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function currentHour() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}`;
}
function currentDay() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}
function normalizePrompt(p) {
  return p.toLowerCase().replace(/\s+/g, ' ').trim();
}
function truncate(s, n) {
  if (!s) return '';
  return s.length <= n ? s : s.slice(0, n) + '…';
}
async function safeText(resp) {
  try { return await resp.text(); } catch { return ''; }
}
