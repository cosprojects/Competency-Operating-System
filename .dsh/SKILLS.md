# Навыки и команды проекта

> Сгенерировано из `~/Documents/dsh-skills` — не редактируй вручную.
> Обновить: `~/Documents/dsh-skills/render-index.mjs --project /Users/kirillnevzorov/Competency-Operating-System`.

## Доступные агентские навыки

| Команда | Что делает | Пример запроса |
|---|---|---|
| `/ba-analyze` | Проанализировать проект или его часть как бизнес-аналитик — карта домена, сценарии, пробелы в требованиях, риски и вопросы; отчёт пишется в существующую структуру docs/ проекта. | Разбери docs/05-business-architecture и напиши, каких требований не хватает |
| `/ba-docs-review` | Аудит документации проекта — полнота, противоречия, устаревшие ссылки, дубли, термины вне глоссария, несоответствие коду; отчёт с приоритетами и безопасные правки. | Проверь docs/ перед релизом: противоречия, устаревшие ссылки, термины |
| `/ba-spec` | Написать спеку фичи как бизнес-аналитик — user stories, критерии приёмки Given/When/Then, функциональные и нефункциональные требования, edge cases, out of scope; файл пишется в docs/ проекта по его конвенциям. | Напиши спеку на онбординг новичка в продукт |
| `/changelog` | Собрать лог изменений за рабочую сессию с момента последнего логирования и обновить блок «Лог обновлений» на главной — дата, общее название и описание ровно из трёх предложений. | Составь лог за день |
| `/figma-context` | Основной пайплайн Figma → код: снимок дизайна в файлы репозитория через REST API по PAT, реализация и сверка по локальным файлам вместо живых вызовов официального MCP с его дневной квотой. | Сними контекст экрана онбординга из Figma в docs/design/figma и опиши структуру |
| `/ux-copy` | Написать или переписать интерфейсный текст — подписи, кнопки, ошибки, пустые состояния, онбординг, прогресс, подтверждения — по голосу продукта, с тремя вариантами и обоснованием выбора. | Перепиши текст ошибки для экрана сохранения профиля |
| `/ux-copy-review` | Отредактировать и оценить готовые тексты по рубрике — вердикт, 8 критериев, правки «до → после», без похвалы и без переписывания смысла. | Отревью 10 строк из FeedbackForm перед релизом |
| `/ux-strings` | Инвентаризация пользовательских строк проекта — где живут, длины, дубли, расхождения терминов и нарушения анти-слоп; отчёт с приоритетами и планом правок. | Собери инвентаризацию строк в apps/web и покажи топ проблем |
| `/ux-voice` | Собрать или обновить голос продукта (voice & tone) и правила текста из существующих документов, кода и решений — чтобы все тексты писались в одном стиле. | Собери голос продукта из docs/06-communication и зафиксируй в гайде |

## Команды проекта (`package.json`)

| Скрипт | Что запускает |
|---|---|
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | `node --experimental-strip-types --test tests/*.test.ts` |
| `npm run changelog:collect` | `node --experimental-strip-types scripts/changelog/collect.ts` |
| `npm run changelog:apply` | `node --experimental-strip-types scripts/changelog/apply.ts` |
| `npm run changelog:check` | `node --experimental-strip-types scripts/changelog/apply.ts -- --check` |
| `npm run agents:check` | `sh scripts/check-agent-assets.sh` |
| `npm run figma:compare` | `node scripts/web/figma-compare.mjs` |
| `npm run db:generate` | `prisma generate` |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run catalog:validate` | `node --experimental-strip-types src/methodology/v1/competency/cli/catalog.ts` |
| `npm run canonical:validate` | `node --experimental-strip-types src/methodology/v1/competency/cli/canonical-validate.ts` |
| `npm run canonical:report` | `node --experimental-strip-types src/methodology/v1/competency/cli/canonical-validate.ts -- --report` |
| `npm run materials:agent:queue` | `node --experimental-strip-types src/methodology/v1/materials-agent/cli/queue.ts` |
| `npm run model:sync` | `node --experimental-strip-types src/methodology/v1/competency/model/cli/sync.ts` |
| `npm run model:validate` | `node --experimental-strip-types src/methodology/v1/competency/model/cli/validate.ts` |
| `npm run model:views` | `node --experimental-strip-types src/methodology/v1/competency/model/cli/views.ts` |
| `npm run materials:agent:review` | `node --experimental-strip-types src/methodology/v1/materials-agent/cli/review.ts` |
| `npm run learning:validate` | `node --experimental-strip-types src/methodology/v1/learning-sources/cli/validate.ts` |
| `npm run learning:audit` | `node --experimental-strip-types src/methodology/v1/learning-sources/cli/audit.ts` |
| `npm run learning:map` | `node --experimental-strip-types src/methodology/v1/learning-sources/cli/map.ts` |
| `npm run learning:topics` | `node --experimental-strip-types src/methodology/v1/learning-sources/cli/topics.ts` |
| `npm run release:report` | `node --experimental-strip-types scripts/release/validate.ts -- --release beta-1 --report --allow-draft` |
| `npm run release:validate` | `node --experimental-strip-types scripts/release/validate.ts -- --release beta-1` |
| `npm run release:validate:draft` | `node --experimental-strip-types scripts/release/validate.ts -- --release beta-1 --allow-draft` |
| `npm run release:build` | `node --experimental-strip-types scripts/release/build.ts -- --release beta-1` |
| `npm run release:build:draft` | `node --experimental-strip-types scripts/release/build.ts -- --release beta-1 --allow-draft` |
| `npm run web:dev` | `npm --workspace apps/web run dev` |
| `npm run web:build` | `npm run release:build:draft && npm --workspace apps/web run build` |
| `npm run web:build:release` | `npm run release:validate && npm run release:build && npm --workspace apps/web run build` |
| `npm run web:start` | `npm --workspace apps/web run start` |
| `npm run web:typecheck` | `npm run release:build:draft && npm --workspace apps/web run typecheck` |
| `npm run db:deploy` | `prisma migrate deploy` |
| `npm run metrics:report` | `node --experimental-strip-types scripts/metrics/report.ts` |
| `npm run finance:model` | `node --experimental-strip-types scripts/business-model/financial-model.ts` |
| `npm run db:local:prepare` | `node --experimental-strip-types scripts/dev/local-schema.ts` |
| `npm run db:local:push` | `prisma db push --schema prisma/schema.local.prisma --skip-generate` |
| `npm run db:local:generate` | `prisma generate --schema prisma/schema.local.prisma` |
| `npm run db:local` | `npm run db:local:prepare && npm run db:local:push && npm run db:local:generate` |
| `npm run learning:aggregate` | `node --experimental-strip-types src/methodology/v1/learning-sources/cli/aggregate.ts` |
| `npm run sources:expand` | `node --experimental-strip-types src/methodology/v1/learning-sources/cli/expand.ts` |
| `npm run sources:provider-test` | `node --experimental-strip-types src/methodology/v1/learning-sources/cli/provider-test.ts` |
| `npm run materials:accept` | `node --experimental-strip-types src/methodology/v1/materials-agent/cli/accept.ts` |
| `npm run materials:verify` | `node --experimental-strip-types src/methodology/v1/materials-agent/cli/verify.ts` |
| `npm run materials:coverage` | `node --experimental-strip-types src/methodology/v1/materials-agent/cli/coverage.ts` |
| `npm run reviews:export` | `node --experimental-strip-types scripts/reviews/export.ts` |
| `npm run reviews:decide` | `node --experimental-strip-types scripts/reviews/decide.ts` |
| `npm run sources:remove` | `node --experimental-strip-types src/methodology/v1/learning-sources/cli/remove.ts` |
| `npm run sources:access` | `node --experimental-strip-types src/methodology/v1/learning-sources/cli/access.ts` |
| `npm run sources:repair` | `node --experimental-strip-types src/methodology/v1/learning-sources/cli/repair.ts` |
| `npm run aggregate` | `node --experimental-strip-types scripts/aggregate/index.ts` |
| `npm run materials:daily` | `node --experimental-strip-types src/methodology/v1/materials-agent/cli/daily.ts` |
| `npm run descriptions:agent` | `node --experimental-strip-types src/methodology/v1/competency/cli/descriptions-agent.ts` |
| `npm run descriptions:validate` | `node --experimental-strip-types src/methodology/v1/competency/cli/descriptions-validate.ts` |

## Как пользоваться

- В сообщении: `/имя-навыка` — например `/ux-copy` или `/ba-spec`.
- Или словами: «перепиши этот текст», «проверь документацию» — агент загрузит подходящий навык сам.
- Полный реестр всех ролей: `~/Documents/dsh-skills/INDEX.md`.
