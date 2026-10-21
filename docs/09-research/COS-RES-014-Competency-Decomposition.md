---
id: COS-RES-014
title: Сборка каталога компетенций, компонентов и тегов
version: 1.5.0
status: Draft
owner: Research Team
last_updated: 2026-10-21
references:
  - COS-RES-009
  - COS-RES-010
  - COS-RES-011
  - COS-RES-013
  - COS-ARCH-002
---

# COS-RES-014 — Сборка каталога компетенций, компонентов и тегов

## 1. Назначение

Документ описывает метод «от общего к частному»:

```
домен → профессия → компетенция → компонент → тег (знание/навык) → материал
```

Скрипты делают детерминированную работу: поиск, сбор, дедуп, идентичность, валидацию, запись. LLM-методолог делает только смысловую часть: группировку тегов, декомпозицию компетенции, формулировки и сопоставление материалов. Человек принимает блоки и материалы.

Документ не заменяет `COS-RES-013`: профиль профессии остаётся деревом представления, а каталог компетенций — отдельной сущностью, которая может ссылаться на листья профиля и узлы графа позже.

## 2. Границы

- Каталог не меняет `design-competency-graph.json` и не поднимает `methodologyVersion` графа.
- LLM не принимает решения: его ответ — предложение, статус вычисляет детерминированный валидатор.
- Инструмент не становится компетенцией или тегом знания. `kind: tool` хранится отдельно.
- Сходство слов, близость тегов и уверенность LLM не являются доказательством.
- Материалы: только метаданные и короткий snippet; полные тексты, транскрипты и скачивание не сохраняются.
- Платные курсы: только публичная карточка/метаданные и ссылка. Paywall, логин и обход защиты не используются.
- Каталог пишется в `src/methodology/v1/competency/catalog/<domain>.json` только после human-приёмки. Журналы-кандидаты — в `data/competency/`.

## 3. Уровни и модель данных

| Уровень | Сущность | Что хранится |
|---|---|---|
| L0 | Domain | `it`, `design`, ... |
| L1 | ProfessionRecord | название, алиасы, классификаторы, sourceRefs |
| L2 | CompetencyBlock | определение, scope, профессии, компоненты, теги, evidence |
| L3 | CompetencyComponent | раздел компетенции: название, определение, порядок, tagIds |
| L4 | TagRecord | знание/навык: название, определение, kind, sourceRefs, evidenceState, materialIds |
| L5 | Material | статья/курс/видео/книга: провайдер, URL, язык, доступ, цена (observed), лицензия, links |

Основные идентификаторы:
- `Tag.id = tag_<hash(normalized title + kind)>` — один тег у нескольких профессий.
- `CompetencyBlock.id = comp_<hash(normalized title)>`, slug после приёмки; переименование даёт alias.
- `Component.id = <competencySlug>.<componentSlug>`.
- `Material.id = material_<hash(provider + externalId)>`; fallback — canonical URL.
- `previousSlugs` хранит старые slug после переименования.

Статусы: `candidate`, `needs_review`, `accepted`, `rejected`. Evidence states: `supported`, `qualified`, `contradicted`, `refuted`, `incomplete`, `no_evidence`, `unread`, `unavailable`, `needs_review`.

## 4. Этапы

### Stage 0. Реестр источников и разведка
`src/methodology/v1/competency/sources/registry.json`: id, тип, лицензия, доступ, возможности, статус, адаптер. `npm run sources:discover -- --domain it --query "..."` проверяет доступность и пишет `data/competency/sources.json`. `blocked`/`unavailable` не используются, обход не делается.

### Stage 1. Профессии
`npm run professions:collect -- --domain it` читает `targets/it.json` (14 IT-профессий) и собирает источники ESCO/O*NET/Практикум. Кросс-идентичность — по внешним ID, не по похожести. Выход: `data/competency/professions-it.json`.

### Stage 2. Теги
`npm run tags:collect -- --domain it [--profession id]` собирает навыки/знания:
- ESCO — essential/optional + описание;
- O*NET — Software Skills (tool), Essential Skills (skill), Knowledge (knowledge);
- Практикум — инструменты и темы уроков.
Теги дедуплицируются по `(normalized title, kind)`, sourceRefs агрегируются. Выход: `data/competency/tags-it.json`.

### Stage 2b. Top-down seed (каноническая гранулярность)
`npm run competency:seed -- --domain it --seed color-theory` материализует человеческий seed из `src/methodology/v1/competency/seeds/it.json`: название, определение, профессии и подсказки тегов. Seed — это зафиксированное намерение человека, а не вывод LLM; он задаёт уровень «Теория цвета», которого bottom-up Pass A из учебных тем не выводит. Материализованные кандидаты идут в тот же Pass B и проходят те же валидаторы, но всё равно требуют human-приёмки.

### Stage 3. Кандидаты (Pass A)
`npm run competency:candidates -- --domain it [--fixture file] [--limit-batches N] [--budget-usd N]`.
LLM предлагает группы тегов; батчи собираются внутри одной профессии (общий алфавитный порядок разрезал бы связанные темы). Валидатор проверяет: все `tagId` из батча, ≥2 тегов, без tool/transversal, без дублей названий, каждый тег назначен или в `unassignedTagIds`. Выход: `data/competency/candidates-it.json` + review.

### Stage 4. Блоки (Pass B)
`npm run competency:build -- --domain it [--slug ...] [--fixture file] [--limit N]`.
LLM предлагает 2–8 компонентов, 1–12 тегов в каждом; тег: `title`, `kind`, `definition`, `evidenceTagIds`, `modelProposal`. Валидатор: id из входа, без инструментов, без URL/выдуманных цитат, покрытие ≥50%, без дублей, `modelProposal=false` требует evidence. Выход: `data/competency/blocks-it.json` + review; статус всегда `needs_review`.

### Stage 4b. Сведение кандидатов
`npm run competency:reconcile -- --domain it [--fixture file]`. LLM получает только id/названия/определения кандидатов и объединяет те, что описывают один предмет работы. Валидатор проверяет: каждый id ровно один раз, нет новых id, названия не дублируют каталог, теги объединённых кандидатов не теряются. Ответ разбит на чанки по 40 кандидатов, чтобы не упираться в лимит вывода. Это предложение, не приёмка.

### Stage 5. Приёмка
`npm run competency:review -- --domain it` собирает review-пакет. Человек принимает блок в `src/methodology/v1/competency/catalog/it.json`; `npm run catalog:validate -- --domain it` проверяет каталог (id, slug, ссылки, accepted-статусы).

### Stage 6. Профиль профессии
`npm run competency:compose -- --domain it --profession frontend` собирает `profession → competency → components → tags → materials` в `data/competency/profiles/`. `writesToGraph:false`.

### Stage 7. Материалы (финальный этап)
`npm run materials:sources` — реестр material-источников.
`npm run materials:collect -- --domain it [--profession id] [--sources ...]`:
- статьи: Wikipedia (MediaWiki API, CC BY-SA);
- статьи: Хабр (публичный json-эндпоинт `/kek/v2/articles/`; `/search/` запрещён robots — не используем; приоритет ru, затем en);
- статьи: Medium (тематический RSS `/feed/tag/`; `/search?q=` запрещён robots — не используем; только en, доступ freemium, метаданные и snippet);
- видео/книги: Internet Archive advancedsearch (лицензия записи проверяется);
- курсы: Stepik API (free/paid, цена как observed metadata);
- видео: YouTube Data API только при `YOUTUBE_API_KEY`, без скачивания;
- Learn Anything: зарегистрирован, но публичного HTTP API нет — темы/ссылки отдаются клиентским Jazz sync; клиентский JS не исполняем и не скрейпим, источник `degraded`.
- Языки: собираем ru/en; `other` отбрасываем; сортировка ru → en.
`npm run materials:classify -- --domain it [--fixture file]` — LLM Pass D, валидатор связей; `access`/`price` берутся из адаптера, не из LLM.
`npm run materials:review -- --domain it` — review-пакет.
`npm run materials:validate -- --domain it --require-coverage` — ссылки, доступ, покрытие, платные с датой наблюдения цены.
`npm run materials:refresh -- --domain it [--check-links]` — обновление `retrievedAt`, проверка ссылок.

## 5. LLM-методолог

`competency/llm/`: transport, prompts, schemas (zod), policy/budget, structured runner.

| Pass | Задача | Что не делает |
|---|---|---|
| A | группировка тегов в кандидатов | не добавляет теги, не принимает |
| B | компоненты и теги компетенции | не выдумывает источники, не ставит уровни |
| C (опц.) | аудит блока | только issues |
| D | сопоставление материалов | не меняет access/price, не придумывает URL |
| E (опц.) | аудит материалов | только issues |

Правила: JSON по zod-схеме; статический system-блок стабилен для prefix caching; входные фрагменты в `<source_evidence>`; один repair-retry; бюджет вызовов/стоимости; кеш по `inputHash`; `modelConfidence` не влияет на статус; валидатор — единственный источник статуса.

## 6. Команды и артефакты

```
sources:discover, professions:collect, tags:collect,
competency:seed, competency:candidates, competency:reconcile, competency:build, competency:review, competency:evaluate,
priority:template, priority:validate, competency:canvas,
catalog:validate, competency:compose,
materials:sources, materials:collect, materials:classify, materials:review,
materials:validate, materials:refresh
```

Кандидаты — `data/competency/` (gitignore). Принятый каталог — `src/methodology/v1/competency/catalog/it.json` (в git). Все журналы `writesToGraph:false`.

## 7. Текущий срез (2026-10-21)

- Реестр: 13 источников; активны ESCO, O*NET, Практикум, Wikipedia, Internet Archive, Хабр, Medium; Stepik degraded; Learn Anything degraded (client-only Jazz, публичного HTTP API нет); hh.ru blocked (403 DDoS-Guard, обход не делаем).
- 14 IT-профессий собраны; полный `tags:collect` дал **1512 тегов** (knowledge 376, skill 235, tool 901).
- Pass A по всем IT-тегам: **114 кандидатов**, 322 неназначенных тега, 115 замечаний, 49 вызовов, ~$0.12; reconcile: **114 → 94** кандидата, 3 вызова, issues 0.
- Pass B (первые 20 кандидатов): **20 блоков**, 26 новых тегов, issues 0, ~$0.015. Это черновики `needs_review`.
- Seed-эталон: `color-theory` → 6 тегов → Pass B дал **5 компонентов, 11 тегов**, issues 0, $0.0019; материалы — 3 статьи Wikipedia, классификация 3 связи, `materials:validate` — 0 ошибок. Блок `needs_review`, не принят.
- Материалы: 20 блоков → **53 статьи Wikipedia** (сбор ~4 мин); классификация: 24 связи, 14/20 компетенций с материалом, issues 29 (в основном корректные отказы от нерелевантных статей); `materials:validate` — 0 ошибок. Stepik 502, Internet Archive по этим запросам не дал видео; YouTube без ключа.
- Материалы эталона «Теория цвета»: **9 материалов** — 3 Wikipedia (ru), 3 Хабра (ru), 3 Medium (en); после классификации 7 связей, 0 ошибок; Internet Archive — timeout, Learn Anything — degraded.
- Gold-set протокол: `competency:evaluate`, фикстура `gold-candidates.json`; на ней precision/recall/exact = 1. На живом Pass A — **0/5**: кандидаты дробят «Теорию цвета» на визуальные подтемы; reconcile этого не исправляет. Батчинг по профессиям (UX/UI: 34 кандидата, 9 вызовов, ~$0.027) разрыв сохраняет.
- Вывод: bottom-up группировка даёт гранулярность «учебных тем», а не каноническую компетенцию уровня «Теория цвета». Нужно продуктовое решение: (а) принять granularity как есть, (б) top-down seed/рубрика канонических компетенций, (в) отдельный Pass «свести подтемы в компетенцию» с human-приёмкой. Это открытый вопрос, не приёмка.
- Тесты: **92/92**; typecheck чистый.
- Каталог `catalog/it.json` пока пуст: приёмка блоков — следующий human-шаг.

## 8. Приёмка

- Каждый тег имеет sourceRef; 0 tool-as-knowledge.
- Pass A: gold set 100+ пар «тег → компетенция», precision ≥0.90, recall ≥0.70, exact verdict (COS-RES-011); разметка фиксируется до прогона. Команда: `npm run competency:evaluate -- --domain it --gold <file> --candidates <file>`. Фикстурный протокол: `tests/fixtures/competency/gold-candidates.json`.
- Блоки: 10–20 блоков по рубрике; Color Theory — эталон; все accepted подписаны человеком.
- Материалы: у каждой accepted-компетенции ≥1 принятый материал; 0 paywall-обхода и выдуманных snippet; платные помечены и имеют `price.observedAt`; покрытие free/paid видно в отчёте.
- Система: детерминированный повтор, resume, бюджет LLM, 0 graph/DB writes.

## 9. Журнал ошибок и запретов

- Не восстанавливать закрытый список фраз; группировка не по словам.
- Не считать LLM-confidence доказательством.
- Не принимать блок без human-приёмки.
- Не обходить paywall/логин/robots; `blocked` фиксируется.
- Не хранить полные тексты и транскрипты; только метаданные и короткий snippet.
- Не подгонять каталог под один источник.

## 10. История изменений

| Версия | Дата | Что изменилось |
|---|---|---|
| 1.0.0 | 2026-10-21 | Метод: реестр источников, профессии, теги, Pass A/B, приёмка, профиль, материалы; реализован каркас команд и тестов |
| 1.1.0 | 2026-10-21 | Полный сбор IT-тегов (1512), Pass A (114→94 после reconcile), Pass B (20 блоков), материалы (53 статьи, 24 связи), `competency:evaluate` и gold-set протокол; зафиксирован разрыв качества Pass A на живой разметке |
| 1.2.0 | 2026-10-21 | Батчи Pass A сгруппированы по профессии; UX/UI: 34 кандидата, 95 unassigned, 18 issues. Gold по-прежнему 0/5; зафиксировано решение о granularity |
| 1.3.0 | 2026-10-21 | Добавлен top-down seed канонических компетенций (`competency:seed`, `seeds/it.json`). Seed «Теория цвета» → 5 компонентов, 11 тегов, 3 материала; блок остаётся `needs_review` |
| 1.4.0 | 2026-10-21 | Добавлены Хабр и Medium (robots-safe: без `/search/`), язык ru→en, `other` отбрасывается; Learn Anything зарегистрирован как degraded из-за client-only Jazz. Эталон: 9 материалов, 7 связей |
| 1.5.0 | 2026-10-21 | Добавлена ссылка на `COS-RES-015`: приоритеты foundation/core/optional и раскладка канваса |
