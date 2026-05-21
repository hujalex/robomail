#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [ -z "${DATABASE_URL:-}" ] && [ -f "$ENV_FILE" ]; then
  DATABASE_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | cut -d'=' -f2-)
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: DATABASE_URL is not set" >&2
  exit 1
fi

ACCOUNT_NAME="${1:-My Account}"
PLAIN_KEY="sk_live_$(openssl rand -hex 24)"
PREFIX="${PLAIN_KEY:0:12}"
HASHED_KEY=$(printf '%s' "$PLAIN_KEY" | openssl dgst -sha256 | awk '{print $NF}')

ACCOUNT_ID=$(psql "$DATABASE_URL" --tuples-only --no-align <<SQL
WITH acc AS (
  INSERT INTO accounts (name) VALUES ('$ACCOUNT_NAME') RETURNING id
), ins AS (
  INSERT INTO api_keys (account_id, name, prefix, hashed_key)
  SELECT id, 'Default', '$PREFIX', '$HASHED_KEY' FROM acc
)
SELECT id FROM acc;
SQL
)

echo "Account ID : $ACCOUNT_ID"
echo "API Key    : $PLAIN_KEY"
echo ""
echo "Add to .env:"
echo "API_KEY=$PLAIN_KEY"
