# Competency Operating System (COS)

AI-native платформа компетенций: карта профессий, компетенции, знания/навыки и учебные материалы.
MVP — слой сборки компетенций и ресурсной базы; диагностика и ИИ в runtime — следующий слой.

## Beta 1 — карта компетенций дизайнера

- Публикуется **12 профессий** (UX/UI, Product, Motion, Graphic, 3D, Интерьеры, Веб, Презентации,
  UX-исследования, Арт-дирекшн, Приложения, **AI-дизайнер**). AI-слой публикуется как ядро только в
  AI-дизайнере (`publication.coreProfessionIds`, ADR-015); в остальных профессиях — `deferred-post-beta`.
- Гейм-дизайнер `it.game` собран в модели (13-я профессия, 30 связей, 30/30 компетенций с активным
  первичным источником), но в публикацию Beta 1 не входит до accepted-блоков и материалов.
- В модели **132 компетенции**, в публикации **131**, связей «профессия–компетенция» — **292**.
- Ресурсная база: **168 источников** (131 active, 47 найдены автоматически), **43 материала** в каталоге.
- Content gate: 292/292 связи, 131/131 компетенция, 0 пробелов. `release:validate` — PASS. AI-дизайнер — 13 секций, 56 компетенций.
- Source review — AI-assisted (1 385 решений), нужен spot-check
  основателя. Манифест остаётся `draft`.

## Основной инструмент: агрегация по профессиям

`npm run aggregate` — единая точка входа, которая собирает ресурсную базу профессии и доводит её
до проверенного релизного контента:

```bash
# план без изменений
npm run aggregate -- --profession all

# применить, используя сохранённые журналы прогона (Brave не тратится)
npm run aggregate -- --profession all --write

# заново сходить в Brave и сразу записать
npm run aggregate -- --profession motion,uxui --fetch --write

# только источники для одной профессии, без release-сборки
npm run aggregate -- --profession motion --write --no-release
```

Что происходит по шагам:

1. `sources:expand` — официальные провайдеры (Brave Search, Wikipedia, GitHub; YouTube — API/RSS),
   скоринг кандидатов, LLM-ревью (`accept`/`confirm`/`reject`) и запись в `learning-sources/registry.json`.
2. `sources:repair` — blocked-источники отвязываются, `professionIds` расширяются по связям.
3. `model:sync` — связи «компетенция–источник» мержатся в `competency/model/competencies.json`.
4. `reviews:decide` — AI-assisted source review для публикационного gate.
5. `learning:map` / `learning:aggregate` — покрытие и открытые источники по профессиям.
6. `release:validate` / `release:build:draft` — gate и черновая сборка контента.

Журналы прогонов: `data/learning-sources/expansion-<profession>-<date>.json`; отчёт агрегации —
`data/aggregation/aggregate-<scope>-<date>.json`.

### Quality gate источников

- записываются только `accept` с `confidence ≥ 0.75`, заголовки-мусор (курсовые, дипломы, новости,
  вакансии) отсекаются;
- `--audit` проверяет HTTP-доступность; `planned`/`blocked` в публикацию не идут;
- домен, уже бывший в реестре, не дублируется — новый материал связывается с компетенцией;
- ручные операции: `sources:remove`, `sources:access`, `sources:provider-test`.

### Материалы в каталоге

Каталожные материалы (`catalog.materials`) проходят отдельный контур:

```bash
npm run materials:agent:queue -- --domain it --profession motion --per-competency 1 --classify
npm run materials:agent:review -- --domain it --profession motion
npm run materials:verify -- --domain it --profession motion --journal data/materials-agent/it-motion-queue.json
npm run materials:accept -- --journal data/materials-agent/it-motion-verified.json --min-relevance 0.7 --write
npm run materials:coverage -- --profession motion --report
npm run reviews:export
```

Неподтверждённые материалы показываются с бейджем «Подтвердить»: залогиненный пользователь
подтверждает или блокирует через модалку; пороги — доля от активных залогиненных (5% / 10%).
Правила приёмки — [`COS-REL-009`](docs/12-release/COS-REL-009-Materials-Review-and-Confirmation.md).

### Ежедневный добор материалов

### Описания профессий и карточек

`npm run descriptions:agent` собирает информативные описания профессий, компетенций, знаний и навыков
из контекста блоков и источников, проверяет их валидатором и пишет в источники правды.
Входит в `npm run aggregate --write`; проверка без LLM — `npm run descriptions:validate`.
Подробности — [`COS-REL-011`](docs/12-release/COS-REL-011-Descriptions-Agent.md).


Автоматизация добавляет **один материал в день** в самый дефицитный формат компетенции
(цель 2–5 на формат). По умолчанию — dry-run:

```bash
npm run materials:daily                 # план дня, сеть не тратится
npm run materials:daily -- --write      # один поиск + Pass E + приёмка одного материала
```

Алгоритм, ротация источников, cooldown и корнер-кейсы — [`COS-REL-010`](docs/12-release/COS-REL-010-Daily-Materials-Automation.md).
Ежедневный GitHub Actions выключен по умолчанию: включи переменную `MATERIALS_DAILY_ENABLED=true`
и секрет `DEEPSEEK_API_KEY`.

## Быстрый старт

```bash
npm install
npm run db:local            # SQLite data/local.db + локальный Prisma client
cp apps/web/.env.example apps/web/.env.local
npm run release:build:draft
npm run web:dev
```

Проверки перед «готово»:

```bash
npm run typecheck
npm run test
npm run release:validate -- --release beta-1   # строгий gate
npm run web:build                              # то, что собирает Vercel
```

## Web-интерфейс (Beta 1)

Собран по макетам `AXIONA — mvp` (Figma, project 6) и повторяет три состояния продукта:

- `/` — главная: что внутри, как начать, дорожная карта развития;
- `/professions` — выбор профессии: поиск по названию и по навыкам;
- `/professions/<slug>` — канвас профессии: разделы/компетенции, схема с поиском и масштабом,
  карточка компетенции (знания, «в профессии», навыки, материалы).

Общие элементы: `nav-rail`, модалка обратной связи (сохраняется в БД и уходит на `FEEDBACK_EMAIL`),
редиректы со старых адресов `/canvas`, `/competencies/<id>`, `/feedback`. Материалы разбиты по форматам,
карточки подтягивают обложку/аннотацию через `/api/link-preview` (og:image / og:description, кэш на сутки,
SSRF-защита). Схема канваса считается детерминированно из разделов профессии (`apps/web/src/lib/graph-layout.ts`).

## Данные и модель

- `src/methodology/v1/competency/canonical/uxui.json` — каноническая карта UX/UI.
- `src/methodology/v1/competency/model/competencies.json` — единый массив **122** компетенций.
- `model/professions/views/<profession>.json` — разделы и приоритеты 12 profession view.
- `model/learning-source-links.json` — связи «компетенция → источник», мержатся при `model:sync`.
- `learning-sources/registry.json` — реестр источников; `catalog/it.json` — 125 блоков, 565 тегов,
  43 материала.
- Публичный контент — производный JSON (`apps/web/src/content/generated/beta-1.json`).

Сборка модели и проверка:

```bash
npm run model:sync -- --domain it --profession uxui --write
npm run model:validate -- --domain it --profession product --all --require-blocks
```

## Планирование задач

Задачи ведутся в [`tasks/tasks.json`](tasks/tasks.json), синхронизируются в GitHub Issues и Project «AXIONA Launch»:

```bash
npm run tasks:list
npm run tasks:add -- --title "..." --description "..." --version v0.2.0 --priority P1 --area Web --stage I --acceptance "..."
npm run tasks:sync -- --dry-run
npm run tasks:sync
```

Подробно — [`tasks/README.md`](tasks/README.md). Для sync нужен `GH_TOKEN`; commit/push с изменением `tasks/tasks.json` может запускать GitHub Action.

## Документация

- Источник правды — `docs/` с разделами `00-foundation` … `12-release`.
- Программа Beta 1, quality bar, runbook: [`docs/12-release/`](docs/12-release/).
- Решения, меняющие рамку: [`COS-REL-008`](docs/12-release/COS-REL-008-Decision-Log.md).
- Финальная сводка ресурсной базы:
  [`beta-1-sources-expansion-2026-11-03.md`](docs/12-release/reports/beta-1-sources-expansion-2026-11-03.md).
- Аудит документации и legacy-скриптов:
  [`cleanup-2026-11-03.md`](docs/12-release/reports/cleanup-2026-11-03.md).
- Стратегическая дорожная карта: [`COS-BP-005`](docs/08-business-plan/COS-BP-005-Product-Roadmap-AXIONA-COS.md).
- Термины: [`docs/00-foundation/05-domain-glossary.md`](docs/00-foundation/05-domain-glossary.md).
- Для новой сессии агрегации: [`agents/AGENTS-aggregation-session.md`](agents/AGENTS-aggregation-session.md) — промпт-контракт и порядок работы.

## Хостинг и статус

Локальная разработка и Vercel demo (`apps/web/vercel.json`). Корпоративный сайт — `axiona.world`;
переезд на РФ-хостинг и публичный запуск — после готовности MVP и юридического sign-off.
Vercel demo не является продакшн-контуром персональных данных: реальные регистрации там не открываются.

✅ Beta 1: контентный gate пройден, AI-дизайнер опубликован (12 профессий, 121 компетенция), spot-check AI-дизайнера проведён — манифест `beta-1` в статусе `ready`. Vercel собирает `web:build:release` (строгий `release:validate` в CI).
