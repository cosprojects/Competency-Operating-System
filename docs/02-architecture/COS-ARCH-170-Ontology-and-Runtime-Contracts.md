---
id: COS-ARCH-170
title: Ontology and Runtime Contracts
version: 1.0.0
status: Draft
owner: Engineering
last_updated: 2026-11-04
references:
  - COS-ARCH-002
  - COS-ARCH-120
  - COS-ARCH-130
  - COS-ARCH-140
  - COS-ARCH-160
  - COS-RES-014
  - COS-RES-017
  - COS-REL-008
---

# COS-ARCH-170 — контракты онтологии и рантайма

## 0. Зачем этот документ

Агенты (`agents/AGENTS-*.md`) уже описывают роли, но общаются не друг с другом, а через
файлы и журналы. Пока агентов запускает человек через `npm run aggregate`, это работает.
Как только прогоны начнёт запускать оркестратор, нужен ответ на два вопроса:

1. **Что именно передаётся между шагами?** — контракт узла и ребра онтологии.
2. **Что такое «прогон» и «шаг»?** — контракт рантайма: run, step, artifact, human review.

Этот документ фиксирует оба контракта и то, как они ложатся на текущие данные.

Реализация: `src/methodology/v1/contracts/`. Проверка: `npm run contracts:validate`.

## 1. Граница: контракт ≠ политика качества

Контракт проверяет **структуру** и жёсткие инварианты: id, тип, связи, разрешённые переходы,
наличие источника у опубликованного узла. Контракт **не** проверяет длину описания — иначе
он начнёт падать на легаси-данных, его отключат, и он перестанет работать совсем.

Требования к тексту — отдельная **политика качества** (`QUALITY_RULES`), как `qualityBar`
в релизном манифесте. Она сообщается как долг, а не как ошибка сборки:

| Что | Где | Поведение |
|---|---|---|
| Структура, связи, переходы | `ontologyNodeSchema`, `ontologyEdgeSchema` | ошибка, exit 1 |
| Длина описаний, наличие источников | `QUALITY_RULES`, `checkNodeQuality` | отчёт о долге; `--strict` превращает в ошибку |

## 2. Узел онтологии

`OntologyNode` — единственный объект, которым обмениваются агенты и который попадает
в события `COS-ARCH-140`.

| Поле | Тип | Обязательно | Смысл |
|---|---|---|---|
| `id` | `^[a-z0-9][a-z0-9._-]{2,63}$` | да | стабильный id: `ux-design-thinking`, `it.uxui`, `tag_06ae…` |
| `type` | `profession / role / competency / skill / knowledge` | да | тип узла |
| `title`, `titleEn` | string | title да | название |
| `definition` | string ≥ 15 | да | определение (длина по политике — отдельно) |
| `aliases` | string[] | нет | синонимы для поиска и склейки |
| `parentId` | nodeId | устарело | одиночный родитель; заменён рёбрами `part_of` |
| `professionIds` | nodeId[] | нет | профессии, где узел используется |
| `priorityHint` | `foundation / core / optional` | нет | приоритет изучения |
| `scope` | `universal / profession` | нет | применимость |
| `lifecycle` | `candidate → review → accepted → published → deprecated / rejected` | да | стадия публикации |
| `evidenceState` | `missing / partial / supported / needs_review` | да | чем подтверждён |
| `reviewState` | `not_required / pending / confirmed` | да | проверен ли человеком |
| `version` | int ≥ 1 | да | версия узла |
| `evidence` | `SourceRef[]` | да (может быть пустым) | источники-доказательства |
| `provenance` | agent + contractVersion + версии модели/промпта + runId/stepId | да | воспроизводимость |

### 2.1. Три ортогональные оси вместо одного статуса

Узел может быть `published`, но с `evidenceState: needs_review`. Это не противоречие,
а два разных вопроса: «опубликован ли» и «чем подтверждён». Сведение их в один статус
теряет информацию и делает невозможным аудит.

### 2.2. Маппинг существующих словарей

`normalizeNodeState()` сводит текущие словари в три оси без миграции данных:

| Источник | Было | Стало |
|---|---|---|
| кандидаты компетенций | `candidate / needs_review / accepted / rejected` | `candidate / review / accepted / rejected` |
| блоки и теги каталога | `status: accepted`, `evidenceState: supported / needs_review` | `lifecycle` + `evidenceState` |
| теги | `needsReview: true/false` | `reviewState: pending / confirmed` |
| материалы | `accepted / needs_confirmation / rejected` | не узлы: это `Material`, связь `material→node` |

### 2.3. Жёсткие инварианты

- **I-1.** `published` ⇒ `evidence.length ≥ 1` и `reviewState = confirmed`.
- **I-2.** `evidenceState = supported` ⇒ `evidence.length ≥ 1`.
- **I-3.** `skill` и `knowledge` — глобальные узлы: членство выражается рёбрами `part_of`
  (many-to-many), и у каждого такого узла в снимке есть ≥ 1 входящее ребро `part_of`.
- **I-4.** `definition` непустой (структурно ≥ 15 символов).
- **I-5.** Переходы `lifecycle` — только из `LIFECYCLE_TRANSITIONS`
  (`rejected → accepted` запрещён, `published → accepted` запрещён).
- **I-6.** Ребро не может соединять узел с самим собой.
- **I-7.** В снимке нет дублей id узлов и рёбер; все концы рёбер существуют.

## 3. Ребро онтологии

`OntologyEdge` — типизированная связь. Направление задано явно, чтобы граф можно было
обходить детерминированно.

| Тип | from → to | Пример |
|---|---|---|
| `covers` | профессия → компетенция | `it.uxui` покрывает `ux-design-thinking` |
| `prerequisite` | компетенция → компетенция | `ui-color` требует `ux-design-thinking` (to — пререквизит) |
| `part_of` | знание/навык → компетенция | членство: один узел может входить в несколько компетенций |
| `related` | узел → узел | кросс-профессиональная связь |
| `primary_for` | источник → узел | помеченный primary-источник компетенции |

Ребро несёт `strength` (0–1), `evidence[]` и `provenance` — иначе связь недоказуема.

## 4. Рантайм: прогон, шаг, артефакт

```
Run (ontology.production@1.0.0)
 ├─ step: research.plan        agent: orchestrator-v1     → artifact: queries.json
 ├─ step: research.collect     agent: collector-v1        → artifact: materials.json
 ├─ step: review.materials     agent: methodologist-v1    → human review → decisions.json
 ├─ step: rewrite.formulations agent: writer-v1           → artifact: descriptions.json
 ├─ step: materials.attach     agent: material-agent-v1   → artifact: links.json   (writesToGraph)
 └─ step: release.publish      agent: publisher-v1        → snapshot.json           (writesToGraph)
```

| Сущность | Ключевые поля | Инварианты |
|---|---|---|
| `Run` | id, pipelineId, pipelineVersion, status, params, budget, steps[] | терминальный статус ⇒ `finishedAt`; `spentUsd ≤ maxCostUsd`; шаги принадлежат прогону |
| `Step` | id, runId, stage, agent, status, attempt, **position**, idempotencyKey, inputRef, outputRef, metrics, error | `succeeded` ⇒ `outputRef`; `failed` ⇒ `error`; один и тот же `stage` в прогоне — только с `attempt > 1` |
| `ArtifactRef` | id, kind, uri, sha256, bytes | артефакт иммутабелен: адресуется по `sha256` |
| `HumanReviewRequest` | id, runId, stepId, assigneeRole, items[] | ≥ 1 элемент; `resolvedAt` обязателен при `done` |

**Идемпотентность.** `idempotencyKey(pipelineId, pipelineVersion, stage, input)` — sha256
от канонического входа. Повторная доставка того же входа не создаёт второй шаг и не тратит
квоту Brave.

**Пайплайн — это данные, а не порядок в скрипте.** `PIPELINE` описывает порядок стадий,
агента, `requiresReview` и `writesToGraph`. Оркестратор может быть любым: npm-скрипт сейчас,
BullMQ-воркер на шаге 2, Temporal — если появятся многосуточные процессы.

## 5. Стадии под сценарий продукта

| Стадия | Агент | Вход | Выход | Человек | Пишет в граф |
|---|---|---|---|---|---|
| `research.plan` | orchestrator-v1 | `professionIds[]` | `queries[]` | — | нет |
| `research.collect` | collector-v1 | `professionId`, `queries` | `materials[]` + `source{mode, journal}` | — | нет |
| `review.materials` | methodologist-v1 | `items[]` (материалы + snippet) | `decisions[]` (accepted / needs_confirmation / rejected) | **да** | нет |
| `rewrite.formulations` | writer-v1 | `nodeIds[]` | `descriptions[]` | — | нет |
| `materials.attach` | material-agent-v1 | `decisions[]` | `links[]` | — | **да** |
| `release.publish` | publisher-v1 | `releaseId` | `snapshot` + `artifactRef` | **да** | **да** |

Бизнес-аналитик — отдельный пайплайн `business.analysis@1.0.0` (`analysis.market`), он не
участвует в публикации онтологии и не может менять узлы.

**Подключено к рантайму:** `research.plan` (запросы из профессий) и `research.collect` (сбор
из журнала `sources:expand`, приёмка — `accept` + `confidence ≥ 0.75`). Остальные стадии
помечаются `blocked` до своей очереди.

**Связывание стадий.** Вход шага не берётся из воздуха: он собирается из параметров прогона
и выходов предыдущих шагов, а выходы хранятся в артефактах и перечитываются при
возобновлении прогона:

| Стадия | Откуда вход |
|---|---|
| `research.plan` | `params.professionIds` |
| `research.collect` | `queries` из `research.plan` |
| `review.materials` | `materials[]` из `research.collect` |
| `rewrite.formulations` | `competencyId` принятых решений методолога |
| `materials.attach` | `decisions[]` из `review.materials` |
| `release.publish` | `params.releaseId` |

Если вход собрать не из чего — стадия падает с `input_unavailable`, а не «додумывает» данные.

Правило: **ни один агент не публикует сам.** Публикация — отдельный шаг с отдельным агентом
и подтверждением человеком.

## 6. Как контракт ложится на текущие данные

Прогон `npm run contracts:validate` на репозитории:

```
узлы: 809  рёбра: 691
  по типу:    knowledge 387 · skill 271 · competency 138 · profession 13
  жизненный:  accepted 809
  evidence:   supported 791 · missing 18
  рёбра:      covers 433 · prerequisite 258
предупреждения:
  · блоков с неоднозначным canonicalIds: 6 (созданы как отдельные узлы)
  · рёбер-дублей схлопнуто: 229 (пререквизиты приходят из нескольких профессий)
долг качества: 416 узлов короче политики описаний
RESULT: PASS
```

Что это показывает:

- контракт покрывает **все** существующие сущности без миграции: 13 профессий, 132
  компетенции модели + 6 спорных блоков, 658 знаний/навыков;
- 6 блоков с двумя `canonicalIds` — единственная структурная неоднозначность; они стали
  отдельными узлами со связями `covers` к обеим компетенциям;
- 229 дублей рёбер — пререквизиты повторяются в разных профессиях; в графе это одно ребро;
- 416 узлов не проходят политику описаний — это долг перед релизом, а не ошибка контракта.

## 7. Отвергнутые альтернативы

| Вариант | Почему нет |
|---|---|
| Kafka / event streaming | `COS-ARCH-160` уже отложил; для 6 стадий хватает Postgres + BullMQ |
| Графовая БД (Neo4j) | граф помещается в Postgres-таблицы; проекция по `edges` достаточна |
| LangGraph / CrewAI | нужен детерминированный конвейер, а не свободный агентный цикл; воспроизводимость важнее «агентности» |
| Один общий `status` | смешивает публикацию, доказанность и ревью — три разных вопроса |
| Минимальная длина описания в контракте | контракт начал бы падать на легаси; вынесено в политику качества |
| «Агент сам публикует результат» | публикация — отдельный шаг с человеком и версией |
| JSON Schema вместо zod | в проекте уже zod; второй формат создаёт дрейф |

## 8. Рантайм (шаг 2 — реализовано)

```
src/methodology/v1/workflow/
  store.ts          порт WorkflowStore (рантайм не зависит от Prisma)
  store-prisma.ts   адаптер PostgreSQL/SQLite
  store-memory.ts   адаптер для тестов
  artifacts.ts      FileArtifactSink / InMemoryArtifactSink (sha256, иммутабельность)
  runner.ts         create / advance / retry, идемпотентность, ретраи, бюджет
  handlers.ts       подключённые стадии (пока research.plan)
  cli/run.ts        операторский CLI
```

Таблицы: `WorkflowRun`, `WorkflowStep`, `WorkflowArtifact` (+ enum-статусы).
Шаг хранит `position` (порядок в пайплайне), `attempt` (номер попытки),
`idempotencyKey`, ссылки на артефакты входа/выхода, метрики и ошибку.

### Как это работает

| Событие | Поведение |
|---|---|
| `create` | создаёт прогон и **планирует все стадии** как `pending` с ключами идемпотентности |
| `advance` | выполняет шаги по порядку до первой терминальной/блокирующей точки |
| повтор входа | если шаг с таким же `idempotencyKey` уже `succeeded` — шаг получает `skipped` и ссылку на его артефакт; стадия не выполняется второй раз |
| retryable-ошибка | сохраняется `failed`-попытка, создаётся следующий `attempt`; после лимита прогон `failed` |
| неретраибельная ошибка | прогон `failed` сразу, ошибка с кодом в шаге |
| стадия без обработчика | шаг `blocked` с `stage_not_wired`, прогон `partially_succeeded` |
| превышение бюджета | шаг `failed` с `budget_exceeded` до вызова модели/сети |

Перед каждой записью шаг и прогон валидируются контрактом (`stepSchema`, `runSchema`) —
невалидное состояние физически не попадает в БД.

### Проверено на локальной БД

```
run_cf6080deca  partially_succeeded
  · research.plan       skipped    ← тот же вход уже выполнялся: артефакт переиспользован
  ✓ research.collect    succeeded  3 мс  27 материалов из expansion-uxui-2026-11-03.json
  ■ review.materials    blocked    stage_not_wired
  · rewrite.formulations … release.publish   pending
```

Два важных факта из прогона:

1. **Связывание стадий работает через артефакты.** `research.plan` был `skipped`, но `research.collect`
   всё равно получил `queries` — они прочитаны из артефакта прошлого прогона, а не из памяти процесса.
2. **Сбор не тратит квоту.** 27 материалов взяты из журнала расширения (`mode: journal`), а не из Brave.
   Живой режим — отдельное осознанное действие оператора, не побочный эффект прогона.

### Что ещё нужно для production

- **миграция Prisma**: модели добавлены в `schema.prisma`, локально применены через
  `db push`; для PostgreSQL нужен `prisma migrate dev --name workflow_runtime`;
- **подключение стадий**: каждая стадия добавляется в `handlers.ts` и покрывается тестом;
- **очередь**: `advance` сейчас синхронный; BullMQ-воркер — следующий слой.

## 9. Дальше

1. **`review.materials` — очередь ревью.** Таблица решений, статус `awaiting_review`
   (прогон останавливается и ждёт методолога), CLI `run:review`. Затем `rewrite.formulations`,
   `materials.attach`, `release.publish`.
2. **Живой режим сбора** (`mode: live`) как отдельная команда с явным подтверждением квоты.
3. **Очередь вместо синхронного advance** (BullMQ + Redis, по `COS-ARCH-160`).
4. **Публикация:** outbox + события `COS-ARCH-140` (`Competency Update`,
   `Evidence Publication`) + `Publisher` с иммутабельным артефактом релиза и откатом.
5. **Дальше** — eval-гейты на извлечение и матчинг, бюджет стоимости на прогон.

## 10. Как проверять

```bash
npm run contracts:validate              # отчёт по реальным данным
npm run contracts:validate -- --json    # машинный отчёт для CI
npm run contracts:validate -- --strict  # долг качества = ошибка

npm run run:cli -- create --profession it.uxui          # создать прогон
npm run run:cli -- advance <runId>                      # выполнить
npm run run:cli -- status  <runId>                      # статус и артефакты
npm run run:cli -- list                                 # все прогоны
npm run run:cli -- retry   <runId> <stepId>             # повторить шаг
```

Код: `src/methodology/v1/contracts/` (контракты) и `src/methodology/v1/workflow/` (рантайм).
Тесты: `tests/contracts.test.ts`, `tests/workflow.test.ts`.
