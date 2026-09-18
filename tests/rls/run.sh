#!/usr/bin/env bash
# Runs the tenant-isolation RLS test suite against the current database.
# Requires PG* env vars (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE)
# — the same ones used by the Lovable sandbox's `psql`.
#
# All fixtures are wrapped in a transaction that is rolled back at the end,
# so the test leaves no residue in the target database.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ -z "${PGHOST:-}" ]]; then
  echo "ERROR: PGHOST is not set. Enable database access in Lovable Cloud." >&2
  exit 2
fi

echo "▶ Running RLS tenant-isolation tests…"
psql -v ON_ERROR_STOP=1 -f "$DIR/tenant-isolation.sql"
echo "✅ All RLS tenant-isolation tests passed."