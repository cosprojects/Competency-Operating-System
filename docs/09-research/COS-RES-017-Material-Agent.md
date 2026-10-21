---
id: COS-RES-017
title: Material Agent — отдельный контур наполнения материалами
version: 1.0.0
status: Draft
owner: Research Team
last_updated: 2026-10-21
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

## 6. Следующая архитектура

На следующем этапе Material Agent можно вынести в отдельный процесс/воркер:

- очередь задач `professionId + competencyId`;
- отдельный бюджет и retry;
- независимый запуск по расписанию;
- журнал и coverage как единственный контракт с агрегатором;
- human-review материалов — отдельный шаг;
- агрегатор не ждёт материалы и не падает без них.

## 7. Текущий smoke-результат

На 2 accepted-компетенциях, sources `wikipedia,habr,medium`:

- discovery: 8 материалов;
- classification: 3 связи;
- validation: 0 ошибок;
- журнал: `data/materials-agent/it-uxui.json`.

Это проверка механики, не полное покрытие каталога.

## 8. Ограничения

- Агент не принимает материалы в каталог.
- Полные тексты, транскрипты и платный контент не сохраняются.
- Платные курсы — только публичные метаданные и `price.observedAt`.
- Robots/paywall/логин не обходятся.
- `Learn Anything` остаётся degraded: клиентский Jazz без публичного HTTP API.

## 9. История изменений

| Версия | Дата | Что изменилось |
|---|---|---|
| 1.0.0 | 2026-10-21 | Выделен отдельный Material Agent: контракт, стадии, CLI, журнал, тесты, smoke-прогон |
