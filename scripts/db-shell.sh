#!/usr/bin/env bash
# Safe ad-hoc DB access while jobsync_app is running.
# scripts/ isn't part of the container image, so the query script is inlined
# and piped into `node -e` inside the container (uses the container's own
# @prisma/client + DATABASE_URL, never touches dev.db from the host).
#
# Usage:
#   ./scripts/db-shell.sh "select * from Job limit 5;"
set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: $0 \"<SQL query>\"" >&2
  exit 1
fi

QUERY="$1"

docker exec -i jobsync_app node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\$queryRawUnsafe(process.argv[1])
  .then((rows) => {
    console.log(JSON.stringify(rows, (_k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
  })
  .catch((err) => { console.error(err.message); process.exit(1); })
  .finally(() => prisma.\$disconnect());
" "$QUERY"
