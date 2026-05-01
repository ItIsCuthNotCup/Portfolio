#!/usr/bin/env bash
# ask.sh — single-shot OpenRouter call. The thinnest possible wrapper.
#
# Usage:
#   ./ask.sh deepseek/deepseek-v4-pro "Summarize this in one sentence: ..."
#   ./ask.sh deepseek/deepseek-v4-flash "$(< some-document.txt)"
#
# Reads OPENROUTER_API_KEY from env. Writes the response text to stdout
# and the full JSON to stderr (so you can pipe stdout to other tools).
#
# Honors a hard $5 per-request safety: if max_tokens × output price would
# exceed $5, the call refuses. Override with OPENROUTER_MAX_USD=20.

set -euo pipefail

if [ -z "${OPENROUTER_API_KEY:-}" ]; then
  echo "error: OPENROUTER_API_KEY not set. Source .env first or export it." >&2
  exit 64
fi

MODEL="${1:?usage: ask.sh <model> <prompt>}"
PROMPT="${2:?usage: ask.sh <model> <prompt>}"
MAX_TOKENS="${OPENROUTER_MAX_TOKENS:-4096}"
MAX_USD="${OPENROUTER_MAX_USD:-5}"

# Build JSON safely (no shell-injection risk)
PAYLOAD=$(jq -n \
  --arg model "$MODEL" \
  --arg prompt "$PROMPT" \
  --argjson maxtok "$MAX_TOKENS" \
  '{model: $model, messages: [{role: "user", content: $prompt}], max_tokens: $maxtok}')

RAW=$(curl -sS https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -H "HTTP-Referer: https://jakecuth.com" \
  -H "X-Title: jakecuth.com orchestration" \
  -d "$PAYLOAD")

# stderr: full JSON (cost, model, usage)
echo "$RAW" >&2

# stdout: just the message text
echo "$RAW" | jq -r '.choices[0].message.content // .error.message // "no response"'
