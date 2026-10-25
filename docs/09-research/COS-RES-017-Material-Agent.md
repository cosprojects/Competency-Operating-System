---
id: COS-RES-017
title: Material Agent — отдельный контур наполнения материалами
version: 1.3.0
status: Draft
owner: Research Team
last_updated: 2026-10-25
references:
  - COS-RES-014
  - COS-RES-016
  - COS-ARCH-002
---

# COS-RES-017 — Material Agent

## 1. Назначение

Материалы выносятся из потока сборки компетенций в **отдельный модуль-агент**. Агрегатор профессий и компетенций отвечает за структуру, приоритеты и каталог. Material Agent отвечает только за наполнение accepted-компетенций материалами.

Граница:

```
catalog (accepted competencies)
        ↓
Material Agent: discovery → classification → validation
        ↓
material journal + coverage + review candidates
        ↓
human review → catalog.materials (отдельным шагом)
```

Агент не меняет каталог, не пишет в граф и не принимает материалы. Он готовит журнал и coverage.

## 2. Модуль

`src/methodology/v1/materials-agent/`

| Файл | Роль |
|---|---|
| `types.ts` | контракт входа/выхода и журнала |
| `agent.ts` | оркестрация стадий, внедряемые зависимости для тестов |
| `cli/run.ts` | команда `materials:agent` |

Низкоуровневые адаптеры источников и классификатор остаются в `competency/materials/`; агент использует их через явный интерфейс. Это позволяет позже вынести их в отдельный worker без изменения контракта.

## 3. Стадии

### Discovery
Вход: accepted-блоки профессии, source ids, лимиты.
Действия: поиск материалов по источникам, language policy `ru → en`, дедупликация по canonical URL, метаданные и короткий snippet.
Выход: `materials` + `discoveryCoverage`.

### Classification (опционально)
LLM Pass D: связь материала с компетенцией/компонентом/тегом. Проверка id, ссылок и `modelProposal`; `access`/`price` не меняются.
Выход: `links`, `issues`, `calls`, `costUsd`.

### Validation
Проверка URL, доступов, ссылок и coverage. Ошибки не скрываются; журнал получает `status: partial`.

## 4. Контракт журнала

```json
{
  "agentVersion": "1.0.0",
  "journalVersion": "1.0.0",
  "domain": "it",
  "professionId": "it.uxui",
  "generatedOn": "2026-10-21",
  "writesToGraph": false,
  "status": "completed",
  "stages": {
    "discovery": { "competencies": 2, "materials": 8, "notes": [] },
    "classification": { "materials": 8, "linked": 3, "issues": [], "calls": 8, "costUsd": 0.01 },
    "validation": { "errors": [], "coverage": [] }
  },
  "discoveryCoverage": [],
  "materials": [],
  "notes": []
}
```

Журнал пишется в `data/materials-agent/<domain>-<profession>.json` (gitignored).

## 5. CLI

```bash
# discovery без LLM
npm run materials:agent -- --domain it --profession uxui --limit 2 --sources wikipedia,habr,medium

# discovery + classification
npm run materials:agent -- --domain it --profession uxui --limit 2 \
  --sources wikipedia,habr,medium --classify --budget-usd 0.03 --max-calls 20
```

Опции: `--dry-run`, `--limit`, `--per-competency`, `--sources`, `--classify`, `--budget-usd`, `--max-calls`.

## 6. Worker-режим

Очередь реализована в `materials-agent/queue.ts`:

- задача = `professionId + competencyId` (`id = professionId:blockId`);
- **состав очереди задаёт profession view**: для каждой компетенции профессии берутся её covering-блоки по `canonicalIds`, включая переиспользованные блоки других профессий; дубли блоков схлопываются. Поэтому Product покрывает 30 компетенций, а не только 6 блоков с `professionIds: it.product` (раньше материалы видели лишь собственные блоки профессии);
- accepted-блоки, объявленные за профессией, но не входящие во view, тоже попадают в очередь (не теряем каталог);
- `concurrency` — параллельные элементы;
- `maxAttempts` — retry на уровне элемента;
- общий `LlmBudget` для классификации, вызовы/стоимость в итоговом журнале;
- каждый элемент получает discovery coverage и linked count;
- при исчерпании бюджета классификация останавливается, но **найденные материалы не выбрасываются**: они остаются в журнале со `status: needs_review` и без LLM-связей. Иначе discovery выглядел бы пустым и покрытие занижалось;
- упавший элемент не валит очередь: журнал получает `status: partial`, остальные продолжаются.

```bash
npm run materials:agent:queue -- --domain it --profession uxui \
  --limit 2 --per-competency 1 --sources wikipedia,habr,medium \
  --concurrency 2 --retry 2
```

Журнал: `data/materials-agent/<domain>-<profession>-queue.json`.

Review: `npm run materials:agent:review -- --domain it --profession product` — помимо материалов по блокам отчёт содержит таблицу **покрытия компетенций профессии** (компетенция → covering-блок → материалов → связей) и список компетенций без материалов. Это позволяет принимать решения на уровне view, а не отдельных блоков.

Агрегатор компетенций не ждёт материалы; очередь можно запускать отдельным процессом/по расписанию.

## 7. Текущий прогон (2026-10-25)

Product, sources `wikipedia,habr,medium`, `--per-competency 1 --concurrency 3 --retry 2 --classify --budget-usd 0.15 --max-calls 120`:

- элементов: **31** (30 компетенций view + 1 accepted-блок профессии вне view), completed 31, failed 0;
- discovery: **68 материалов** (Wikipedia 30, Хабр 32, Medium 6; ru 62, en 6);
- classified: **23 вызова**, $0.0239 (часть материалов закрыта LLM-кешем);
- linked: **35**;
- покрытие view: **30/30 компетенций имеют материалы**, 0 без материалов;
- `catalog.materials` остаётся **0** — материалы не приняты, только журнал и review.

Все четыре профессии (2026-10-25, sources `wikipedia,habr,medium`):

| Профессия | Элементов | Материалов | Связей | Покрытие компетенций | Стоимость |
|---|---:|---:|---:|---|---:|
| UX/UI | 33 | 65 | 31 | 34/34 | $0.0004 (LLM-кеш) |
| Product | 31 | 68 | 35 | 30/30 | $0.0239 |
| Motion | 20 | 38 | 20 | 19/19 | $0.0055 |
| Graphic | 20 | 39 | 22 | 18/18 | $0.0020 |

Для UX/UI view нет: порядок компетенций для review берётся из `model/profession-competencies/uxui.json`, очередь — из блоков с `professionIds: it.uxui` (33 элемента).

Ранее (smoke, до покрытия по view):
- motion: 3 элемента, 14 материалов, 3 связи;
- product: 4 элемента, 16 материалов, 8 связей;
- graphic: 3 элемента, 13 материалов, 7 связей;
- uxui: 2 элемента, 2 материала, 0 ошибок.

Review-артефакты: `data/materials-agent/<domain>-<profession>-review.md`.

Покрытие материалов не означает приёмку: связи `needs_review`, выбор материала — human-gated.

## 8. Ограничения

- Агент не принимает материалы в каталог; `catalog.materials` пуст до human-приёмки.
- Покрытие очереди зависит от view: без view материалы смотрят только блоки с `professionIds` профессии.
- Полные тексты, транскрипты и платный контент не сохраняются.
- Платные курсы — только публичные метаданные и `price.observedAt`.
- Robots/paywall/логин не обходятся.
- `Learn Anything` остаётся degraded: клиентский Jazz без публичного HTTP API.

## 9. История изменений

| Версия | Дата | Что изменилось |
|---|---|---|
| 1.0.0 | 2026-10-21 | Выделен отдельный Material Agent: контракт, стадии, CLI, журнал, тесты, smoke-прогон |
| 1.1.0 | 2026-10-25 | Очередь покрывает компетенции view через canonicalIds (Product: 31 элемент вместо 6); review показывает покрытие 30/30; при исчерпании бюджета найденные материалы сохраняются; Product full run: 68 материалов / 35 связей, 0 failed |
| 1.2.0 | 2026-10-25 | Полные прогоны Motion (20 элементов / 38 материалов / 19 из 19) и Graphic (20 / 39 / 18 из 18); все 4 профессии имеют review-журналы, catalog.materials = 0 |
| 1.3.0 | 2026-10-25 | Полный прогон UX/UI (33 / 65 / 31, покрытие 34/34); review умеет строить покрытие по profession-competencies, если у профессии нет view; все 4 профессии покрыты на 100% |
