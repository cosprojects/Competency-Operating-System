---
id: COS-RES-015
title: Приоритизация компетенций и раскладка канваса
version: 1.0.0
status: Draft
owner: Research Team
last_updated: 2026-10-21
references:
  - COS-RES-014
  - COS-EAR-008
  - COS-EAR-011
  - COS-COM-006
  - COS-ARCH-002
---

# COS-RES-015 — Приоритизация компетенций и раскладка канваса

## 1. Назначение

Документ вводит отдельную ось **«необходимость для изучения»** для компетенций и определяет, как от неё зависит раскладка на канвасе.

Приоритет не заменяет существующие сигналы `isCore`, `marketDemandWeight` и `aiAutomationRisk` графа. Это продуктовая ось обучения:

```
foundation (фундаментальная) → core (основная) → optional (необязательная)
```

Каждая компетенция получает mark в отдельном файле `src/methodology/v1/competency/priority/<profession>.json`. Каталог остаётся источником структуры и доказательств; маркировка — отдельным human-owned слоем.

## 2. Уровни

| Tier | Метка | Смысл | Канвас |
|---|---|---|---|
| `foundation` | Фундаментальная | Без неё нельзя осваивать основные компетенции; база профессии | Центр, крупная карточка, `emphasis: primary` |
| `core` | Основная | Обязательна для работы в профессии, но не фундамент для остальных | Внутреннее кольцо, `emphasis: secondary` |
| `optional` | Необязательная | Специализация, смежная тема или контекст; можно пропустить без блокировки основных | Внешнее кольцо, `emphasis: tertiary`, opacity 0.65 |

`order` — сквозной порядок изучения в профессии, а не порядок внутри tier. `prerequisites` — явные зависимости; они же становятся рёбрами канваса.

## 3. Схема маркировки

```json
{
  "priorityVersion": "1.0.0",
  "domain": "it",
  "professionId": "it.uxui",
  "updatedOn": "2026-10-21",
  "status": "draft",
  "marks": [
    {
      "competencyId": "comp_c8e03682adf7",
      "tier": "foundation",
      "order": 1,
      "prerequisites": [],
      "rationale": "Универсальная визуальная база: цвет и композиция нужны большинству визуальных компетенций.",
      "confidence": "high",
      "reviewer": "methodologist",
      "reviewedAt": "2026-10-21",
      "signals": { "scope": "universal", "graphNodeIds": ["node_form_comp"] }
    }
  ]
}
```

Обязательные поля: `competencyId`, `tier`, `order`, `rationale` (≥20 символов), `confidence`, `reviewer`, `reviewedAt`. `prerequisites` и `signals` могут быть пустыми.

Mark не содержит `verifiedLevel`, `confidencePercent` и текста урока. Уровень человека по-прежнему считает движок, а не эта маркировка.

## 4. Рубрика

- **foundation**: универсальная база (`scope: "universal"`), встречается в большинстве профессий, является предпосылкой для ≥2 основных компетенций, без неё нельзя освоить `core`.
- **core**: обязательна для целевой профессии, соответствует `isCore: true` трека/профессиональному требованию или явно нужна для рабочих задач.
- **optional**: специализация, смежное направление, контекст; пропуск не блокирует `core` и `foundation`.

`isCore`, `marketDemandWeight`, `aiAutomationRisk` — **сигналы для человека**, а не автоматический tier. LLM не выставляет финальный tier, не заполняет `reviewer`/`reviewedAt` и не принимает marks.

### 4.1. Валидация

`priority:validate` проверяет:
- mark относится к блоку выбранной профессии;
- один mark на компетенцию, `order` уникален и положителен;
- `prerequisites` существуют, нет self-reference и циклов;
- зависимость не идёт позже зависимой: tier-ранг prerequisite ≤ текущего; при равном tier `order` меньше;
- `--require-complete` — все блоки профессии отмечены, есть хотя бы одна `foundation` и `core`;
- `--require-accepted` — файл `status: "accepted"`, у всех marks заполнен `reviewedAt`.

Предупреждения (не ошибки): дубли названий блоков, `optional` больше 50%, блоки в статусе `needs_review`.

## 5. Шаблон маркировки

```bash
npm run priority:template -- --domain it --profession uxui --source review --include-seed
```

Источники:
- `catalog` — accepted-блоки каталога;
- `review` — `data/competency/blocks-it.json`;
- `--include-seed` — добавить `data/competency/blocks-it-uxui.json` (эталон «Теория цвета»).

Выход:
- `data/competency/priority/it-uxui-template.md` — таблица для методолога;
- `data/competency/priority/it-uxui-template.json` — машинный скелет;
- рабочая маркировка — `src/methodology/v1/competency/priority/uxui.json`.

Шаблон не заполняет tier автоматически. Существующие marks сохраняются; для незаполненных строк выводится `—`.

Текущий срез UX/UI: 15 review-блоков + seed «Теория цвета» = 16 строк; в файле `priority/uxui.json` заполнен только пример «Теории цвета» (`foundation`, order 1). Остальные строки — работа методолога.

## 6. Канвас

`npm run competency:canvas -- --domain it --profession uxui --source review --include-seed --allow-partial`

Выход: `data/competency/canvas/it-uxui.json`, `writesToGraph: false`.

### 6.1. Контракт

```json
{
  "layoutVersion": "1.0.0",
  "domain": "it",
  "professionId": "it.uxui",
  "viewport": { "width": 1200, "height": 800 },
  "nodes": [
    {
      "competencyId": "comp_...",
      "title": "Теория цвета и колористика",
      "tier": "foundation",
      "order": 1,
      "ring": 0,
      "angle": 0,
      "x": 600, "y": 400,
      "width": 220, "height": 68,
      "emphasis": "primary",
      "opacity": 1,
      "nodeVariant": "core_root"
    }
  ],
  "edges": [],
  "bounds": { "minX": 450, "minY": 326, "maxX": 750, "maxY": 474 },
  "diagnostics": [],
  "writesToGraph": false
}
```

### 6.2. Алгоритм

1. Берутся только компетенции с marks; при `--allow-partial` отсутствующие попадают в `diagnostics`, без флага команда падает.
2. `foundation` — центр: 1 карточка по центру, 2–3 — ряд, больше — сетка до 3 колонок; размер `220×68`.
3. `core` — внутреннее кольцо вокруг foundation. Радиус растёт, если дуга кольца меньше `width + 40`; угол — сверху по часовой стрелке, сортировка по `order`.
4. `optional` — внешнее кольцо; при >12 узлов второй пояс `ring: 3`; `opacity: 0.65`.
5. Если `foundation` нет, `core` становится центральным; если нет `core`, `optional` занимает первое доступное кольцо.
6. Рёбра строятся только из `prerequisites`; синергия по словам не выдумывается.
7. Координаты — логические единицы; `bounds` фактический, `viewport` минимальный. Рендерер масштабирует/панорамирует.
8. Детерминизм: одинаковый вход → одинаковый JSON; сортировка по tier, `order`, `competencyId`.

### 6.3. Standalone-страница

```bash
npm run canvas:page -- --domain it --profession uxui --source review --include-seed
```

Генерирует `web/uxui-competency-canvas.html`: самодостаточную страницу без внешних зависимостей. На ней:
- карточки компетенций с коротким описанием и tier-бейджем;
- SVG-сеть по `prerequisites`;
- кольца foundation/core/optional;
- hover подсвечивает связи, клик открывает панель с компонентами и тегами;
- фильтры по tier.

Для страницы используется **отдельный черновой слой** `visualization/uxui.json`: он позволяет показать все собранные блоки до завершения human-маркировки. Баннер и `status: "draft"` явно говорят, что tier/связи не утверждены. После заполнения `priority/uxui.json` страница может быть пересобрана поверх официальных marks (команда поддерживает `--source catalog`; конфиг визуализации можно заменить).

### 6.4. Визуальные правила

- `foundation` — центр, крупнее, `emphasis: primary`, `nodeVariant: core_root`;
- `core` — внутреннее кольцо, `secondary`;
- `optional` — внешнее кольцо, `tertiary`, приглушённость.

## 7. Интеграция

- `ProfessionProfile.competencies[]` получает `studyPriority` (tier/order/rationale/confidence); Markdown профиля показывает `[Фундаментальная]` и т.п.
- `catalog:validate --require-priority` требует marks для accepted-блоков профессии.
- Пайплайн: `priority-template` (agent) → `priority-review` (human) → `priority-validate` (agent) → `canvas-build` (agent) → остальные шаги материалов.
- В репозитории нет frontend/рендерера; документ задаёт контракт данных и алгоритм. UI потребляет `canvas/it-uxui.json`.

## 8. Ограничения

- Приоритет ставится на уровне блока компетенции, не компонента/тега; компоненты наследуют tier при раскрытии.
- Канвас v1 показывает `CompetencyBlock`, а не заменяет `design-competency-graph.json`; маппинг на существующие графовые узлы — отдельная задача.
- Автоматическая LLM-подсказка tier не входит в v1: финальный tier — human-owned.
- Каталог `catalog/it.json` может быть пуст; тогда шаблон и канвас идут от review-блоков с явной диагностикой.

## 9. История изменений

| Версия | Дата | Что изменилось |
|---|---|---|
| 1.0.0 | 2026-10-21 | Введены foundation/core/optional, priority-файл, шаблон, валидатор и детерминированная раскладка канваса |
