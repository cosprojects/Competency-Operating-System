#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

set -a
. ./.env.production
set +a

npm run db:deploy
