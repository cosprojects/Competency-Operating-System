#!/bin/sh
# Ставит локальный pre-commit хук: проверка реестра агентских навыков.
# Хуки в .git/hooks не версионируются, поэтому установку держим скриптом.
#
#   sh scripts/install-git-hooks.sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
HOOK="$ROOT/.git/hooks/pre-commit"

if [ ! -d "$ROOT/.git" ]; then
  echo "error: $ROOT не git-репозиторий" >&2
  exit 1
fi

cat > "$HOOK" <<'HOOK'
#!/bin/sh
# Проверка актуальности реестра агентских навыков (локальное хранилище).
set -eu
STORE=${DSH_SKILLS_DIR:-$HOME/Documents/dsh-skills}
if [ ! -x "$STORE/render-index.mjs" ]; then
  exit 0
fi
if ! "$STORE/render-index.mjs" --check; then
  echo "" >&2
  echo "Реестр навыков устарел. Обнови: $STORE/render-index.mjs" >&2
  echo "Пропустить проверку: git commit --no-verify" >&2
  exit 1
fi
HOOK

chmod +x "$HOOK"
echo "установлен: $HOOK"
