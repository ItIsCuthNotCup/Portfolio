# reply-guy — Twitter auto-reply for jakecuth.com

Finds tweets about your lab topics and replies with a natural-sounding
message + link to the relevant interactive infographic. Runs on a cron
trigger with per-lab and per-user cooldowns.

## Twitter API tier requirements

| Tier | Reads/month | Posts/month | Cost | Viable? |
|------|-----------|------------|------|---------|
| Free | 100 | 500 | $0 | Marginal. 1 run/day, 2 searches. |
| Basic | 10,000 | 3,000 | $100/mo | Yes. 6 runs/day, 2 searches each. |

**The Free tier is tight.** You get 100 search reads per month, which
means roughly one search per day. You can either accept this cadence or
upgrade to Basic ($100/mo) for proper throughput.

With Basic: 2 searches per run, 6 runs/day = 360 searches/month (well
within 10,000). Each search uses an OR'd query covering one lab's keywords
so 2 searches means 2 labs checked per tick.

## How it works

1. Cron fires (configurable, default every 4 hours)
2. Selects N labs from the rotation (all 18 cycle evenly)
3. Searches Twitter for each lab's keywords (`-is:retweet -is:reply -has:links lang:en`)
4. Filters: skips old tweets, short tweets, negative/hostile language, already-replied
5. Generates a reply via OpenRouter LLM (falls back to templates if LLM fails)
6. Posts via Twitter API v2 (OAuth 1.0a user context)
7. Records in KV: replied tweet IDs (7-day TTL), lab cooldown (60 min), user cooldown (24h)

## Setup

### 1. Twitter API credentials

Go to https://developer.twitter.com/en/portal/projects-and-apps

Create a Project + App. Under "Keys and tokens" generate:

- **Consumer Keys** → `X_CONSUMER_KEY` + `X_CONSUMER_KEY_SECRET`
- **Access Token & Secret** → `X_ACCESS_TOKEN` + `X_ACCESS_TOKEN_SECRET`
  (OAuth 1.0a, Read + Write permissions)
- **Bearer Token** → `X_BEARER_TOKEN`

### 2. OpenRouter API key

Get one at https://openrouter.ai/keys

Cost: ~$0.0002/reply (Gemini Flash). At 12 replies/day = ~$0.07/month.

### 3. Deploy

```bash
cd workers/reply-guy

# Install wrangler if you haven't
npm install -g wrangler

# Login
npx wrangler login

# Create KV namespace
npx wrangler kv:namespace create "REPLY_GUY_KV"

# Copy the output `id` into wrangler.toml for both `id` and `preview_id`

# Set secrets (you'll be prompted for each)
npx wrangler secret put X_CONSUMER_KEY
npx wrangler secret put X_CONSUMER_KEY_SECRET
npx wrangler secret put X_ACCESS_TOKEN
npx wrangler secret put X_ACCESS_TOKEN_SECRET
npx wrangler secret put X_BEARER_TOKEN
npx wrangler secret put OPENROUTER_API_KEY

# Deploy
npx wrangler deploy
```

### 4. Test it

```bash
# Status page
curl https://reply-guy.YOUR_SUBDOMAIN.workers.dev/

# Dry run (searches but doesn't post)
curl -X POST https://reply-guy.YOUR_SUBDOMAIN.workers.dev/run \
  -H 'Content-Type: application/json' \
  -d '{"dry_run": true}'

# Live run
curl -X POST https://reply-guy.YOUR_SUBDOMAIN.workers.dev/run \
  -H 'Content-Type: application/json' \
  -d '{"dry_run": false}'
```

### 5. Monitor

Cloudflare Dashboard → Workers & Pages → reply-guy → Logs.

## Configuration

Edit constants at the top of `src/index.js`:

| Constant | Default | Description |
|---|---|---|
| `MAX_REPLIES_PER_RUN` | 3 | Max replies posted per cron tick |
| `MAX_SEARCHES_PER_RUN` | 2 | Max Twitter searches per tick |
| `MAX_TWEET_AGE_MS` | 6 hours | Skip tweets older than this |
| `LAB_COOLDOWN_MS` | 60 min | Don't reuse same lab in this window |
| `USER_COOLDOWN_MS` | 24 hours | Don't reply to same author in this window |

### Adjust cron for your tier

In `wrangler.toml`:

```toml
# Free tier (100 reads/month) — once daily, 2 searches
crons = ["0 14 * * *"]

# Basic tier ($100/mo, 10,000 reads/month) — every 4 hours
crons = ["0 */4 * * *"]
```

## Lab keywords

Edit `src/lab-keywords.json`. Each lab has:

- `search`: Keywords used in the Twitter search query (OR'd together)
- `match`: Keywords for confirming a tweet is about this topic (future use)

## Debugging

The `/status` endpoint shows:
- Last cron run timestamp
- Lab rotation index
- Recent replied tweet IDs
- Current config values

Worker logs (Cloudflare Dashboard) capture any Twitter API errors,
OpenRouter failures, or KV issues.
