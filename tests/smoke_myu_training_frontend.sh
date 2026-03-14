#!/usr/bin/env bash
set -euo pipefail

FRONTEND_URL="${FRONTEND_URL:-http://127.0.0.1:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@test.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-test123}"

printf '[smoke] check frontend routes\n'
curl -fsS "$FRONTEND_URL/dashboard" >/dev/null
curl -fsS "$FRONTEND_URL/admin/myu-training" >/dev/null

printf '[smoke] login admin\n'
LOGIN_JSON=$(curl -fsS -H 'content-type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  "$FRONTEND_URL/api/auth/login")

TOKEN=$(printf '%s' "$LOGIN_JSON" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
if [ -z "${TOKEN:-}" ]; then
  echo '[smoke] token non ottenuto dal login admin'
  exit 1
fi

printf '[smoke] admin workspace + proactive endpoint\n'
curl -fsS -H "Authorization: Bearer $TOKEN" "$FRONTEND_URL/api/admin/myu-training/workspace" >/dev/null
if ! curl -fsS -H "Authorization: Bearer $TOKEN" "$FRONTEND_URL/api/myu/proactive/signals" >/dev/null; then
  echo '[smoke] warning: endpoint /api/myu/proactive/signals non disponibile su questo ambiente'
fi

echo '[smoke] ok MYU Training frontend/admin endpoints'
