#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

BACKUP_DIR="${BACKUP_DIR:-/var/backups/axiona}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"

docker compose --env-file .env.production exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$BACKUP_DIR/axiona-$STAMP.sql.gz"

# Keep 14 daily dumps; rotate older files.
find "$BACKUP_DIR" -name 'axiona-*.sql.gz' -type f -mtime +14 -delete
echo "backup: $BACKUP_DIR/axiona-$STAMP.sql.gz"
