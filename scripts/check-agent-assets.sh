#!/bin/sh
# Проверяет, что реестр агентских навыков актуален.
#
# Реестр живёт вне репозитория (~/Documents/dsh-skills), поэтому в CI и на
# чужой машине проверка мягко пропускается: проект не должен зависеть от
# локального окружения автора.
#
#   sh scripts/check-agent-assets.sh
#   DSH_SKILLS_DIR=/path/to/dsh-skills sh scripts/check-agent-assets.sh
set -eu

STORE=${DSH_SKILLS_DIR:-$HOME/Documents/dsh-skills}

if [ ! -x "$STORE/render-index.mjs" ]; then
  printf 'check-agent-assets: хранилище навыков не найдено (%s) — пропускаю\n' "$STORE"
  exit 0
fi

"$STORE/render-index.mjs" --check
