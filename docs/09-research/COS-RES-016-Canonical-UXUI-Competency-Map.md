---
id: COS-RES-016
title: Каноническая карта компетенций UX/UI
version: 1.2.0
status: Draft
owner: Research Team
last_updated: 2026-10-21
references:
  - COS-RES-013
  - COS-RES-014
  - COS-RES-015
  - COS-EAR-008
  - COS-ARCH-002
---

# COS-RES-016 — Каноническая карта компетенций UX/UI

## 1. Назначение

Каноническая карта — это **верхнеуровневая структура профессии**, которая задаёт:

- два больших блока: **UX** (пользовательский опыт) и **UI** (интерфейс);
- разделы внутри каждого блока: исследования, сценарии/IA, прототипирование, продукт, визуальные основы, дизайн-системы, интерактивность, инструментарий;
- перечень компетенций с определениями, tier-подсказками и статусом покрытия;
- явные **пробелы** (`gap`), которые ещё не закрыты блоками каталога.

Карта не заменяет каталог и не является графом. Это навигационный и приоритизационный слой: он показывает, что должно быть в профессии, что уже собрано, а что отсутствует.

Файл: `src/methodology/v1/competency/canonical/uxui.json`.

## 2. Два верхних блока

| Блок | Что описывает | Основные разделы |
|---|---|---|
| **UX — пользовательский опыт** | Понимание людей, задач, контекста и сценариев; проектирование поведения продукта до визуального слоя | Исследования; Сценарии и информационная архитектура; Прототипирование и проверка; Продукт и стратегия |
| **UI — интерфейс** | Визуальный и интерактивный слой: как интерфейс выглядит, ощущается и передаётся в разработку | Визуальные основы; Дизайн-системы и компоненты; Интерактивность и анимация; Инструментарий и передача в разработку |

Важно: **исследования** — раздел UX, **инструментарий** — раздел UI. Figma/Figma/FigJam/Framer — не замена компетенциям, а отдельный раздел владения инструментами и передачи результата.

## 3. Схема

```json
{
  "canonicalVersion": "0.1.0",
  "domain": "it",
  "professionId": "it.uxui",
  "status": "draft",
  "branches": [
    {
      "id": "ux",
      "order": 1,
      "title": "UX — пользовательский опыт",
      "definition": "...",
      "sections": [
        {
          "id": "ux-research",
          "order": 1,
          "title": "Исследования",
          "definition": "...",
          "competencies": [
            {
              "id": "ux-user-research",
              "order": 1,
              "title": "Пользовательские исследования",
              "definition": "...",
              "priorityHint": "core",
              "status": "partial",
              "coveredBy": ["comp_ec6bb5ba0dd5"],
              "sourceEvidence": { "taxonomyLeaves": ["Interviews"], "graphNodeIds": ["node_ux_research"] }
            }
          ]
        }
      ]
    }
  ],
  "excludedBlocks": [
    { "blockId": "comp_9d115869b128", "reason": "Общий O*NET-набор, не отдельная UX/UI-компетенция" }
  ]
}
```

Поля компетенции:
- `priorityHint` — `foundation` / `core` / `optional`; это **подсказка**, финальный приоритет — `priority/<profession>.json` (`COS-RES-015`);
- `status` — `covered` (есть блок), `partial` (есть частичное покрытие), `gap` (блока нет);
- `coveredBy` — id блоков каталога/review-слоя;
- `sourceEvidence` — ссылки на листья таксономии и узлы графа;
- `excludedBlocks` — блоки, которые не являются UX/UI-компетенциями и не должны попадать в карту.

## 4. Текущий срез

Каноническая карта содержит **34 компетенции**:

| Показатель | Значение |
|---|---|
| Всего | 34 |
| covered | 34 |
| partial | 0 |
| gap | **0** |
| UX-покрытие | 16 covered / 0 partial / 0 gap |
| UI-покрытие | 18 covered / 0 partial / 0 gap |

Покрытые/частично покрытые ядра:
- UI: цвет, типографика, композиция и сетки, визуальные элементы, визуальная коммуникация, адаптивность, анимация, визуализация данных;
- UX: анализ требований, пользовательские исследования (partial), продуктовая аналитика (partial), бизнес-метрики (partial), этика/приватность (partial).

18 gap-компетенций закрыты seed-блоками и приняты в каталог v0.1: персоны, интервью, юзабилити-тестирование, IA, user flows, вайрфреймы, low-fi/hi-fi/интерактивные прототипы, UX-метрики, продуктовое мышление, дизайн-системы, компоненты, состояния, Figma/FigJam/Framer. В каталоге 33 блока (один блок покрывает две канонические компетенции), 137 тегов, 0 материалов; приоритеты — 33 mark. Все 34 компетенции карты имеют `coveredBy`, поэтому `covered = 34`.

Это закрытие **структурное**, а не финальная методическая приёмка. Оставшиеся проверки качества:
- Figma/FigJam/Framer построены на ограниченном наборе тегов и требуют отдельного ревью;
- FigJam-блок частично опирается на общие Figma-теги;
- часть UX-блоков (product thinking, experiments) требует проверки на соответствие реальным задачам;
- материалы к новым блокам ещё не собраны.

## 5. Валидация

```bash
npm run canonical:validate -- --domain it --profession uxui --source catalog --report
```

Проверки:
- ровно два верхних блока `ux`/`ui` для UX/UI;
- уникальные id и порядки branch/section/competency;
- `covered`/`partial` требуют существующих `coveredBy`; `gap` не может иметь `coveredBy`;
- все блоки профессии классифицированы как `coveredBy` или `excludedBlocks`;
- ссылки на блоки существуют и относятся к профессии;
- считает покрытие по branch/section/status.

Отчёт: `data/competency/canonical/it-uxui-coverage.md`.

## 6. Приёмка и приоритеты

```bash
npm run catalog:accept -- --domain it --profession uxui --write
npm run priority:canonical -- --domain it --profession uxui --write
npm run catalog:validate -- --domain it --require-priority
npm run priority:validate -- --domain it --profession uxui --require-complete
```

`catalog:accept` берёт блоки, классифицированные картой, и записывает accepted-каталог. `priority:canonical` создаёт **черновые** marks по `priorityHint` (reviewer `canonical-draft`) для всех блоков каталога; это не финальная human-маркировка.

## 7. Как обновлять карту

```bash
npm run competency:seed -- --domain it
npm run competency:build -- --domain it --profession uxui \
  --candidates-file data/competency/seeds/it.candidates.json \
  --tags-file data/competency/tags-it.json
npm run canonical:apply -- --domain it --profession uxui \
  --blocks-file data/competency/blocks-it-uxui.json --write
npm run canonical:validate -- --domain it --profession uxui \
  --source review --include-seed --report
```

`canonical:apply` не понижает уже `covered`-компетенции до `partial`; новые review-блоки получают `partial` до приёмки.

## 8. Как использовать дальше

1. **Закрыть gap-компетенции**: сгенерировать seed/блоки по каноническому списку, начиная с foundation/core (research, IA, flows, prototyping, design systems, tools).
2. **Обновить приоритеты**: `priorityHint` из карты — черновая подсказка; финальный tier — human-owned.
3. **Пересобрать канвас**: после появления блоков для gap-компетенций страница должна показывать всю карту, включая секции UX/UI, а не только текущие 16 review-блоков.
4. **Принять каталог**: `covered`-блоки после human-review становятся accepted; `partial` остаются с пометкой о неполноте.

## 9. Ограничения

- Карта v1 не является онтологией всех возможных UX/UI-ролей: она задаёт базу профессии и допускает расширение секций.
- `priorityHint` не является утверждённым приоритетом; это вход для `COS-RES-015`.
- `coveredBy` может ссылаться на review-блоки; после приёмки id сохраняются.
- Инструменты (Figma/FigJam/Framer) — отдельная секция UI; они не выдаются за знания или навыки.
- Карта не пишет в граф и не меняет каталог.

## 10. История изменений

| Версия | Дата | Что изменилось |
|---|---|---|
| 1.0.0 | 2026-10-21 | Введена каноническая карта UX/UI: два блока, 8 разделов, 34 компетенции, статусы covered/partial/gap, валидатор и coverage-отчёт |
| 1.1.0 | 2026-10-21 | 18 gap-компетенций закрыты seed-блоками (19 блоков, 75 тегов); карта 9 covered / 25 partial / 0 gap, добавлен `canonical:apply` и пересобрана страница на 34 узла |
| 1.2.0 | 2026-10-21 | Каталог v0.1 принят: 33 блока / 137 тегов; 33 priority marks; карта 34 covered / 0 partial / 0 gap; страница пересобрана от каталога |
