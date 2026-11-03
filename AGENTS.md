# AGENTS.md — Competency Operating System (AXIONA COS)

## Что это за проект

AI-native платформа компетенций: карта профессий, компетенции, знания, навыки и материалы.
Текущий этап — Beta 1 (карта профессий дизайнера). Диагностика, оценка уровня и ИИ в runtime — отложенный слой.
Стек: Next.js (`apps/web`), методология в `src/methodology/v1`, Prisma, контент в `model/` → JSON.

## Навыки агента

Глобальные навыки подключены из `~/Documents/dsh-skills` (симлинки в `.dsh/skills`), проектный
`/changelog` лежит прямо в `.dsh/skills/changelog` и коммитится вместе с репозиторием:

| Команда | Роль |
|---|---|
| `/ba-analyze`, `/ba-spec`, `/ba-docs-review` | бизнес-аналитик: анализ, спеки, аудит документации |
| `/ux-copy`, `/ux-copy-review`, `/ux-voice`, `/ux-strings` | UX-писатель: тексты, ревью, голос, инвентаризация строк |
| `/figma-context` | дизайн: снимок Figma в файлы репозитория и реализация по нему |
| `/changelog` | лог обновлений: собрать дайджест рабочей сессии и обновить блок на главной |

- Полная шпаргалка проекта (навыки + npm-скрипты): `.dsh/SKILLS.md`.
- Реестр всех ролей и навыков: `~/Documents/dsh-skills/INDEX.md`.
- Перед импровизацией проверь, есть ли подходящий навык, и используй его.

## Голос продукта

`docs/06-communication/COS-COM-010-Voice-and-Tone.md` — обращение на «ты», дружеский наставник-навигатор,
мотивация через аргументацию без давления. При расхождении с `COS-COM-008/009` (там «вы») действует COS-COM-010.

## Figma → код (основной пайплайн)

Любой запрос «сверстай / актуализируй элемент по макету» начинается со **снимка дизайна в репозиторий**, а не с живых вызовов MCP.

```sh
~/Documents/dsh-skills/tools/figma.sh \
  "https://www.figma.com/design/<fileKey>/<name>?node-id=1-2" \
  --out docs/design/figma
```

1. Снимок требует Figma PAT в macOS Keychain. Если токена нет — попроси пользователя выполнить
   `~/Documents/dsh-skills/tools/figma-pat-set.sh`; не подменяй снимок вызовами MCP.
2. Работай по файлам: `docs/design/figma/<fileKey>/CONTEXT.md`, `nodes/*.json`, `images/*`.
3. Меняй только затрагиваемый элемент; сверяй токены с `apps/web/src/app/globals.css`
   (`--ink`, `--muted`, `--soft`, `--accent`, `--accent-sky`, `--line-soft`, `--r-12/16/24`) и с существующими компонентами.
4. Проверяй: `npm run typecheck`, затем визуальную сверку с макетом (Chrome с `--remote-debugging-port=9222`, dev-сервер на 3100):

   ```sh
   npm run figma:compare -- \
     --url http://127.0.0.1:3100/professions/uxui \
     --selector ".profession-summary" \
     --design docs/design/figma/<fileKey>/images/<node>.png \
     --out scripts/web/figma-parity/compare/<slug>
   ```

   Скрипт печатает `diffPercent` и `meanDelta` и кладёт `web.png`, `design.png`, `diff.png`, `side-by-side.png`, `report.json`.
   `side-by-side.png` показывай в ответе — это и есть доказательство «до/после».
5. Снапшот переиспользуй: при неизменном `lastModified` повторный снимок не нужен, `--force` — только при сомнении.
6. `CONTEXT.md` и `nodes/*.json` можно коммитить; изображения — в `.gitignore`.

Официальный Figma MCP — только fallback: Code Connect (`get_code_connect_map`), скриншот активного выделения,
точечные `get_metadata`/`get_design_context` при доступной квоте. При `Rate limit exceeded` MCP не использовать:
пайплайн снимка идёт через REST API и квоту MCP не тратит.

## Лог обновлений

Блок «Лог обновлений» на главной — три последние записи из `apps/web/src/content/changelog.ts`.
Ведёт его агент `/changelog`, контракт — `agents/AGENTS-changelog-session.md`.

- Запускается **только по явной команде пользователя**; сам, по таймеру или после других задач не логирует.
- Окно — с момента последнего логирования (`.changelog/state.json`) до текущего момента.
- Запись = дата, общее название (до 60 символов) и описание ровно из 3 предложений (до 450).
- `npm run changelog:collect` — дайджест из сессий DSH и git в `.changelog/digest-*.md`.
- `npm run changelog:apply -- --entry <json> [--replace] [--until <ISO>]` — вставить или обновить запись.
- `npm run changelog:check` — проверить контракт лога; `npm run typecheck` — сборку.
- `state.json` обновляет `apply`; не правь его руками, иначе следующее окно начнётся раньше.

## Документация

- Источник правды — `docs/` с нумерованными разделами `00-foundation` … `12-release`.
- Имена файлов: `COS-<AREA>-<NNN>-<Title>.md`. Не создавай новые разделы и префиксы без нужды.
- Термины: `docs/00-foundation/05-domain-glossary.md`. Решения, меняющие рамку: `docs/12-release/COS-REL-008-Decision-Log.md`.
- Роли проекта описаны в `agents/AGENTS-*.md` — читай их перед работой в соответствующей области.

## Ассеты и изображения

Статика приложения — это `apps/web/public/` (Next.js отдаёт её по абсолютным путям от корня: `/brand/logo-mark.svg`).

| Что | Куда | Как подключать |
|---|---|---|
| Иконки интерфейса | `apps/web/src/components/icons.tsx` (inline SVG) | `import { IconStar }` — предпочтительный путь: цвет через `currentColor`, размер через CSS |
| Бренд, логотипы | `apps/web/public/brand/` | `<img src="/brand/logo-mark.svg" width={34} height={32} alt="" />` |
| Шрифты | `apps/web/public/fonts/` | `@font-face { src: url("/fonts/...") }` в `globals.css` |
| Растровые изображения, иллюстрации, og-картинки | `apps/web/public/images/` | `<img src="/images/..." />` или абсолютный URL |
| Снимки и референсы Figma | `docs/design/figma/<fileKey>/` | служебный артефакт, не ассет приложения; `images/` в `.gitignore` |

Правила:

- Имя файла — kebab-case, без пробелов и кириллицы; SVG экспортировать с `viewBox` и без фиксированных `width/height` в корне.
- Для новой иконки сначала проверь `icons.tsx`: возможно, она уже есть. Файлы в `apps/web/public/icons/` кодом сейчас не используются — не добавляй туда новых без причины.
- Референс из Figma превращается в ассет только осознанным экспортом: иконка → компонент или `public/icons`, картинка → `public/images`. Снимок узла из пайплайна в `public/` не кладём.
- Скриншоты для отчётов и документации — в `docs/…`, не в `public/`.

## Агрегация ресурсной базы

Основная точка входа — `npm run aggregate -- --profession all` (план) и `npm run aggregate -- --profession all --write`
(полный проход: источники → реестр → связи → модель → review → gate). Подробности — `README.md` и
`docs/09-research/COS-RES-028-Open-Materials-Discovery-and-Relevance.md`.
Legacy-канвасы `web/*.html` и `web:canvases` удалены: контент и модель собираются через `release:build`.
Полный промпт-контракт для новой сессии: `agents/AGENTS-aggregation-session.md`.

## Проверка перед «готово»

```sh
npm run typecheck
npm run test
```

Контентный gate перед релизом: `npm run release:report -- --release beta-1`, затем `release:validate` и `release:build`.
