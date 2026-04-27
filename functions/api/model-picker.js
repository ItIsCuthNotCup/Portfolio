// ═══════════════════════════════════════════════════════════
// /api/model-picker — Cloudflare Pages Function
// RAG over OpenRouter's catalog. Both embedding and generation
// route through the user's OPENROUTER_API_KEY.
//
// Contract from /CLAUDE.md hard rule #4: NEVER emit 5xx.
// Runtime errors return 200 with { ok: false, error }.
// 400 only for client validation. 405 for wrong method.
// ═══════════════════════════════════════════════════════════

const EMBED_MODEL = 'google/gemini-embedding-2-preview';
const GEN_MODEL   = 'google/gemini-2.0-flash-001';
const OPENROUTER  = 'https://openrouter.ai/api/v1';

// Hard caps
const MAX_INPUT_CHARS  = 1500;
const MAX_OUTPUT_TOKENS = 400;
const TOP_K            = 4;
const RATE_PER_HOUR    = 10;
const RATE_PER_DAY     = 30;
const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24h
const DAILY_SPEND_CAP_USD = 2.00;

// Approx per-call cost for the spend cap. Conservative upper bound:
// ~700 input tokens + 400 output tokens against gemini-2.0-flash
// pricing (~$0.10/$0.40 per M).
const ESTIMATED_COST_PER_CALL_USD = 0.0003;

// On-topic keyword guard. Cheap; intentionally permissive — we only
// reject queries that have NO model-related signal at all.
const ONTOPIC_PATTERNS = [
  /\b(model|llm|gpt|claude|gemini|llama|mistral|qwen|deepseek|grok|phi|cohere|openai|anthropic)\b/i,
  /\b(token|context|prompt|embedding|reasoning|vision|tool[- ]?use|json[- ]?mode)\b/i,
  /\b(cheap|cheapest|fast|fastest|best|reliable|under \$|per million|\/m\b)\b/i,
  /\b(open[- ]?source|api|inference|chat|generate|generation|completion)\b/i,
];

// ─────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────
export async function onRequest(context) {
  const { request, env } = context;

  // CORS / method gate
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'POST only' }, 405);
  }

  try {
    if (!env.OPENROUTER_API_KEY) {
      return okFalse('Server is missing the OPENROUTER_API_KEY secret. Set it in the Cloudflare Pages dashboard under Settings → Variables and Secrets.');
    }

    // Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ ok: false, error: 'Body must be JSON.' }, 400);
    }

    const query = (body && typeof body.query === 'string') ? body.query.trim() : '';
    if (!query) {
      return jsonResponse({ ok: false, error: 'Missing "query" string.' }, 400);
    }
    if (query.length > MAX_INPUT_CHARS) {
      return jsonResponse({ ok: false, error: `Query exceeds ${MAX_INPUT_CHARS}-character limit.` }, 400);
    }

    // Topic guard
    const onTopic = ONTOPIC_PATTERNS.some(rx => rx.test(query));
    if (!onTopic) {
      return okFalse("This picker only answers questions about choosing an LLM. Try one of the suggested questions or rephrase yours to mention models, tokens, context, pricing, or capabilities.");
    }

    // Rate limit + spend cap (KV-backed if available, else in-memory pass)
    const ipHash = await hashIp(request);
    const rateMsg = await checkAndBumpRate(env, ipHash);
    if (rateMsg) return okFalse(rateMsg);

    const spendMsg = await checkAndBumpSpend(env);
    if (spendMsg) return okFalse(spendMsg);

    // Cache check (24h)
    const cacheKey = await sha256Hex(`mp:${normalizeQuery(query)}`);
    const cached = await readCache(env, cacheKey);
    if (cached) {
      return jsonResponse({
        ok: true,
        cached: true,
        ...cached,
        trace: `cache hit · ${cached.candidates?.length || 0} candidates · ${GEN_MODEL}`,
      });
    }

    // Load catalog
    const catalog = await loadCatalog(context);
    if (!catalog || !Array.isArray(catalog.chunks) || catalog.chunks.length === 0) {
      return okFalse('Model catalog is empty. The indexing notebook has not run yet — see /work/model-picker-lab/README.md.');
    }

    // Hard-constraint extraction (regex)
    const constraints = extractConstraints(query);
    let pool = applyConstraints(catalog.chunks, constraints);
    let constraintsRelaxed = false;
    if (pool.length === 0) {
      // Graceful fallback: keep the catalog full, note in trace.
      pool = catalog.chunks;
      constraintsRelaxed = true;
    }

    // Detect stub mode — if catalog has no embeddings, skip the embed
    // step and rank by structural fit (cheapest first, larger context).
    const hasEmbeddings = pool.some(c => Array.isArray(c.embedding) && c.embedding.length > 0);
    const isStub = !hasEmbeddings || catalog.stub === true;

    const t0 = Date.now();
    let embedMs = 0;
    let queryVec = null;
    if (!isStub) {
      queryVec = await embedQuery(env, query);
      embedMs = Date.now() - t0;
    }

    // Ranking: cosine similarity if we have embeddings, otherwise
    // structural-fit fallback (price ascending, context descending).
    const ranked = isStub
      ? pool
          .map(c => ({ chunk: c, score: structuralScore(c) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, TOP_K)
      : pool
          .map(c => ({ chunk: c, score: cosine(queryVec, c.embedding) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, TOP_K);

    const candidates = ranked.map(r => stripEmbedding(r.chunk));

    // Build prompt
    const systemPrompt = buildSystemPrompt(candidates, constraints, constraintsRelaxed);

    // Stream the generation back to the browser as SSE
    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        const send = (event, data) => {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const traceStart = isStub
            ? `stub catalog · structural ranking · ${pool.length} of ${catalog.chunks.length} candidates after filters`
            : `embedded · ${embedMs} ms · ${pool.length} of ${catalog.chunks.length} candidates after filters`;
          send('trace', { text: traceStart });
          send('candidates', { candidates });

          const genResp = await fetch(`${OPENROUTER}/chat/completions`, {
            method: 'POST',
            headers: openrouterHeaders(env),
            body: JSON.stringify({
              model: GEN_MODEL,
              stream: true,
              max_tokens: MAX_OUTPUT_TOKENS,
              temperature: 0.3,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: query },
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

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });

            // OpenRouter streams OpenAI-compatible SSE chunks
            let nl;
            while ((nl = buf.indexOf('\n')) >= 0) {
              const line = buf.slice(0, nl).trim();
              buf = buf.slice(nl + 1);
              if (!line) continue;
              if (!line.startsWith('data:')) continue;
              const payload = line.slice(5).trim();
              if (payload === '[DONE]') break;
              try {
                const parsed = JSON.parse(payload);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  fullText += delta;
                  send('token', { text: delta });
                }
              } catch { /* ignore */ }
            }
          }

          // Cache the final result
          const totalMs = Date.now() - t0;
          const traceLine = `embed ${embedMs}ms · retrieved ${candidates.length} of ${pool.length} · ${GEN_MODEL} · ${totalMs}ms total · ~$${ESTIMATED_COST_PER_CALL_USD.toFixed(4)}`;
          await writeCache(env, cacheKey, {
            ok: true,
            answer: fullText,
            candidates,
            constraints,
            constraints_relaxed: constraintsRelaxed,
          });
          send('done', { trace: traceLine });
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
    // CLAUDE.md hard rule #4: never 5xx.
    return okFalse(err?.message || 'Unexpected runtime error.');
  }
}

// ─────────────────────────────────────────────────────────────
// Catalog loader
// ─────────────────────────────────────────────────────────────
async function loadCatalog(context) {
  // Pages Functions can read static assets via context.env.ASSETS or
  // by fetching the same origin. The fetch path is more portable.
  try {
    const url = new URL('/assets/data/model-picker/models.json', context.request.url);
    const r = await fetch(url.toString(), { cf: { cacheTtl: 600 } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Hard-constraint extraction (regex)
// ─────────────────────────────────────────────────────────────
function extractConstraints(q) {
  const lower = q.toLowerCase();
  const out = {
    price_in_max:  null,
    price_out_max: null,
    price_any_max: null,
    ctx_min:       null,
    needs:         {
      vision:      false,
      tools:       false,
      json:        false,
      reasoning:   false,
      open_source: false,
    },
  };

  // Price ceilings — match "$5/M", "$5 per million", "under $5", "below $1"
  // Capture the number; assume "/M tokens" if the unit is omitted.
  const priceRegexes = [
    /(?:under|below|less than|cheaper than)\s*\$?\s*(\d+(?:\.\d+)?)\s*(?:\/\s*m|per\s*million|\s*\/?\s*1m)?/i,
    /\$?\s*(\d+(?:\.\d+)?)\s*\/\s*m\b/i,
    /\$?\s*(\d+(?:\.\d+)?)\s*per\s*million/i,
  ];
  for (const rx of priceRegexes) {
    const m = q.match(rx);
    if (m) {
      const n = parseFloat(m[1]);
      if (!isNaN(n)) {
        // If "output" is mentioned anywhere near, attribute to output;
        // if "input" near, to input; else apply to both.
        if (/output/i.test(q)) out.price_out_max = n;
        else if (/input/i.test(q)) out.price_in_max = n;
        else out.price_any_max = n;
        break;
      }
    }
  }

  // Context window minimums
  const ctxMatches = [
    { rx: /(\d+(?:\.\d+)?)\s*m\s*(?:\+)?\s*context/i,         scale: 1_000_000 },
    { rx: /(\d+(?:\.\d+)?)\s*k\s*(?:\+)?\s*context/i,         scale: 1_000 },
    { rx: /(\d+(?:\.\d+)?)\s*m\s*token\s*(?:\+)?\s*context?/i, scale: 1_000_000 },
    { rx: /context\s*(?:window\s*)?(?:over|above|>=|\bat least\b)\s*(\d+)\s*([km])/i, scaleFromUnit: true },
    { rx: /(\d+)\s*([km])\s*(?:\+)?\s*context/i, scaleFromUnit: true },
  ];
  for (const { rx, scale, scaleFromUnit } of ctxMatches) {
    const m = q.match(rx);
    if (m) {
      const n = parseFloat(m[1]);
      let s = scale;
      if (scaleFromUnit) {
        const unit = (m[2] || '').toLowerCase();
        s = unit === 'm' ? 1_000_000 : 1_000;
      }
      if (!isNaN(n) && s) {
        out.ctx_min = Math.round(n * s);
        break;
      }
    }
  }
  // Phrases like "long context" / "long-context" → require >= 200k
  if (out.ctx_min == null && /\blong[- ]?context\b/i.test(q)) {
    out.ctx_min = 200_000;
  }

  // Capabilities
  if (/\b(vision|image|multimodal|see images?)\b/i.test(q))                          out.needs.vision = true;
  if (/\b(tool[- ]?use|tool[- ]?call|function[- ]?call|tools?\b(?!\s*(?:to|of)))/i.test(q)) out.needs.tools = true;
  if (/\bjson[- ]?(mode|output|schema)?\b/i.test(q))                                  out.needs.json = true;
  if (/\b(reasoning|reason|think(?:ing)?|chain[- ]?of[- ]?thought)\b/i.test(q))       out.needs.reasoning = true;
  if (/\b(open[- ]?source|open[- ]?weight|self[- ]?host(?:ed)?)\b/i.test(q))          out.needs.open_source = true;

  return out;
}

function applyConstraints(chunks, c) {
  return chunks.filter(ch => {
    if (c.price_any_max != null) {
      const inP  = ch.input_price_per_m;
      const outP = ch.output_price_per_m;
      if ((inP != null && inP > c.price_any_max) || (outP != null && outP > c.price_any_max)) return false;
    }
    if (c.price_in_max != null && ch.input_price_per_m != null && ch.input_price_per_m > c.price_in_max) return false;
    if (c.price_out_max != null && ch.output_price_per_m != null && ch.output_price_per_m > c.price_out_max) return false;
    if (c.ctx_min != null && (ch.context_length || 0) < c.ctx_min) return false;
    if (c.needs.vision    && !ch.modalities?.vision) return false;
    if (c.needs.tools     && !ch.capabilities?.tools) return false;
    if (c.needs.json      && !ch.capabilities?.json) return false;
    if (c.needs.reasoning && !ch.capabilities?.reasoning) return false;
    if (c.needs.open_source && !ch.is_open_source) return false;
    return true;
  });
}

// ─────────────────────────────────────────────────────────────
// Embedding via OpenRouter
// ─────────────────────────────────────────────────────────────
async function embedQuery(env, text) {
  // OpenRouter exposes /api/v1/embeddings for supported models.
  const r = await fetch(`${OPENROUTER}/embeddings`, {
    method: 'POST',
    headers: openrouterHeaders(env),
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!r.ok) {
    const t = await safeText(r);
    throw new Error(`Embedding call failed: ${truncate(t, 200)}`);
  }
  const data = await r.json();
  const vec = data?.data?.[0]?.embedding;
  if (!Array.isArray(vec)) throw new Error('Embedding response was malformed.');
  return vec;
}

// ─────────────────────────────────────────────────────────────
// Cosine similarity
// ─────────────────────────────────────────────────────────────
function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}

function stripEmbedding(c) {
  const { embedding, ...rest } = c;
  return rest;
}

// Structural fit: cheaper + larger context = higher score.
// Used only when embeddings are missing (stub mode).
function structuralScore(c) {
  const inP  = c.input_price_per_m  ?? 50;
  const outP = c.output_price_per_m ?? 50;
  const ctx  = c.context_length     ?? 4_000;
  // Lower price → higher score. Cap influence so a $0.01 model doesn't dominate.
  const priceScore = 1 / (1 + Math.min(inP + outP, 100));
  const ctxScore   = Math.log10(ctx + 1) / 8; // gentle ramp
  return priceScore + ctxScore * 0.2;
}

// ─────────────────────────────────────────────────────────────
// Prompt builder
// ─────────────────────────────────────────────────────────────
function buildSystemPrompt(candidates, constraints, relaxed) {
  const lines = [];
  lines.push('You help users pick an LLM from OpenRouter. You are recommending FROM the catalog excerpt below — do NOT invent models or recommend any model not in this list.');
  lines.push('');
  lines.push('Output format:');
  lines.push('  1. Two to three plain sentences naming the top recommendation and why.');
  lines.push('  2. One sentence on caveats or tradeoffs if relevant.');
  lines.push('  3. Reference candidate models by their human name (the "name" field).');
  lines.push('');
  lines.push('Be concise. No bullet lists. No markdown headers. Use confident language ONLY for facts present in the catalog (price, context, capabilities). Hedge subjective claims about "quality" or "best at" — frame them as what the model card says, not as benchmarks you have run.');
  lines.push('Refuse politely if the user asks you to do anything other than recommend from the catalog.');
  lines.push('');
  if (relaxed) {
    lines.push('NOTE: The user requested hard constraints that matched zero models. The candidates below are the closest semantic matches WITHOUT the hard filters. Mention this in the answer ("no models matched X exactly, but these come closest").');
    lines.push('');
  }
  lines.push('Detected hard constraints (from regex pre-pass):');
  lines.push('  ' + JSON.stringify(constraints));
  lines.push('');
  lines.push('Candidate models:');
  candidates.forEach((c, i) => {
    lines.push(`[${i + 1}] ${c.name} (${c.id})`);
    lines.push(`    provider: ${c.provider}`);
    lines.push(`    input_price_per_m: ${c.input_price_per_m ?? 'unknown'}, output_price_per_m: ${c.output_price_per_m ?? 'unknown'}`);
    lines.push(`    context_length: ${c.context_length ?? 'unknown'}, max_output_tokens: ${c.max_output_tokens ?? 'unknown'}`);
    const caps = [];
    if (c.modalities?.vision) caps.push('vision');
    if (c.modalities?.audio) caps.push('audio');
    if (c.capabilities?.tools) caps.push('tools');
    if (c.capabilities?.json) caps.push('json');
    if (c.capabilities?.reasoning) caps.push('reasoning');
    if (c.is_open_source) caps.push('open-source');
    lines.push(`    capabilities: ${caps.join(', ') || 'text-only'}`);
    lines.push(`    latency_tier: ${c.latency_tier || 'unknown'}`);
    if (c.tagline) lines.push(`    best_for: ${c.tagline}`);
  });
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────
// Rate limit + spend cap (Cloudflare KV if bound; otherwise no-op)
// ─────────────────────────────────────────────────────────────
async function checkAndBumpRate(env, ipHash) {
  if (!env.MODEL_PICKER_KV) return null; // KV not bound → skip; flagged in README
  const hourKey = `rate:h:${ipHash}:${currentHour()}`;
  const dayKey  = `rate:d:${ipHash}:${currentDay()}`;
  const [hourCt, dayCt] = await Promise.all([
    env.MODEL_PICKER_KV.get(hourKey),
    env.MODEL_PICKER_KV.get(dayKey),
  ]);
  const h = parseInt(hourCt || '0', 10);
  const d = parseInt(dayCt  || '0', 10);
  if (h >= RATE_PER_HOUR) return `Rate limit: ${RATE_PER_HOUR} requests per hour. Try again next hour.`;
  if (d >= RATE_PER_DAY)  return `Rate limit: ${RATE_PER_DAY} requests per day. Try again tomorrow.`;
  await Promise.all([
    env.MODEL_PICKER_KV.put(hourKey, String(h + 1), { expirationTtl: 3700 }),
    env.MODEL_PICKER_KV.put(dayKey,  String(d + 1), { expirationTtl: 90000 }),
  ]);
  return null;
}

async function checkAndBumpSpend(env) {
  if (!env.MODEL_PICKER_KV) return null;
  const key = `spend:${currentDay()}`;
  const cur = parseFloat(await env.MODEL_PICKER_KV.get(key) || '0');
  if (cur >= DAILY_SPEND_CAP_USD) {
    return `Daily spend cap of $${DAILY_SPEND_CAP_USD.toFixed(2)} reached. Picker is paused until UTC midnight.`;
  }
  await env.MODEL_PICKER_KV.put(
    key,
    (cur + ESTIMATED_COST_PER_CALL_USD).toFixed(6),
    { expirationTtl: 90000 },
  );
  return null;
}

async function readCache(env, key) {
  if (!env.MODEL_PICKER_KV) return null;
  const v = await env.MODEL_PICKER_KV.get(`cache:${key}`, 'json');
  return v;
}
async function writeCache(env, key, value) {
  if (!env.MODEL_PICKER_KV) return;
  try {
    await env.MODEL_PICKER_KV.put(`cache:${key}`, JSON.stringify(value), { expirationTtl: CACHE_TTL_SECONDS });
  } catch { /* swallow */ }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
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
    'HTTP-Referer': 'https://jakecuth.com/work/model-picker-lab/',
    'X-Title': 'jakecuth.com · model-picker',
  };
}
async function hashIp(request) {
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '0.0.0.0';
  return sha256Hex(`mp-ip:${ip}`);
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
function normalizeQuery(q) {
  return q.toLowerCase().replace(/\s+/g, ' ').trim();
}
function truncate(s, n) {
  if (!s) return '';
  return s.length <= n ? s : s.slice(0, n) + '…';
}
async function safeText(resp) {
  try { return await resp.text(); } catch { return ''; }
}
