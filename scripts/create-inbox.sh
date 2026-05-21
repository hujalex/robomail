#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://agentmail-demo.vercel.app}"
API_KEY="${API_KEY:?API_KEY env var is required}"
USERNAME="${1:?Usage: $0 <username> <domain>}"
DOMAIN="${2:?Usage: $0 <username> <domain>}"

curl -s -X POST "$BASE_URL/v1/inboxes" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USERNAME\", \"domain\": \"$DOMAIN\"}" \
  | jq . 2>/dev/null || cat
