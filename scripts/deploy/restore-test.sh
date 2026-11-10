#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

if [ $# -ne 1 ]; then
  echo "usage: $0 path/to/backup.sql.gz" >&2
  exit 2
fi
BACKUP="$1"
RESTORE_DB="${RESTORE_DB:-axiona_restore}"

docker compose --env-file .env.production exec -T db \
  sh -c 'dropdb --if-exists -U "$POSTGRES_USER" "$1" && createdb -U "$POSTGRES_USER" "$1"' sh "$RESTORE_DB"
gunzip -c "$BACKUP" | docker compose --env-file .env.production exec -T db \
  sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1"' sh "$RESTORE_DB"

echo "restore-test: OK -> $RESTORE_DB"
