#!/usr/bin/env bash
# マイグレーションとRLSを素のPostgreSQLで検証する。
#   使い方: PGHOST=... PGPORT=... PGUSER=postgres ./scripts/test-db.sh
#   一時DBを作成 → Supabase互換シム → migrations → tests の順に実行し、最後に削除する。
set -euo pipefail
cd "$(dirname "$0")/.."
DB="mj_nexus_test_$$"
PSQL=(psql -v ON_ERROR_STOP=1 -q -X -o /dev/null)
cleanup() { "${PSQL[@]}" -d postgres -c "drop database if exists $DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT
"${PSQL[@]}" -d postgres -c "create database $DB"
"${PSQL[@]}" -d "$DB" -f supabase/tests/00_supabase_shim.sql
for f in supabase/migrations/*.sql; do
  echo "apply  $f"
  "${PSQL[@]}" -d "$DB" -f "$f"
done
for f in supabase/tests/[1-9]*.sql; do
  echo "test   $f"
  "${PSQL[@]}" -d "$DB" -f "$f"
done
echo "DB tests passed"
