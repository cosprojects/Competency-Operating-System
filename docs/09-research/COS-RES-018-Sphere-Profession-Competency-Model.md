---
id: COS-RES-018
title: Модель сфера → профессия → компетенции и систематизация источников
version: 2.1.0
status: Draft
owner: Research Team
last_updated: 2026-10-25
references:
  - COS-RES-014
  - COS-RES-016
  - COS-RES-017
  - COS-RES-020
  - COS-RES-021
---

# COS-RES-018 — Сфера → профессия → компетенции и источники

## 1. Назначение

До этого слоя данные лежали так:

- `sources/registry.json` — единый реестр источников;
- `targets/it.json` — цели по профессиям домена;
- `canonical/uxui.json` — структура одной профессии;
- `catalog/it.json` — блоки домена;
- `priority/uxui.json` — приоритеты одной профессии.

Для нескольких профессий и переиспользования компетенций этого мало. Вводится нормализованный слой:

```
Сфера (sphere)
  └── Профессия (profession)
        └── ProfessionCompetency → ссылка на единый Competency
```

Компетенция хранится **один раз** в `model/competencies.json`. Профессия хранит только ссылку, tier и order. Поэтому одна и та же компетенция может входить в UX/UI, motion, product и graphic с разными приоритетами.

## 2. Структура файлов

```
src/methodology/v1/competency/
  sources/
    registry.json                    # канонические определения источников
    spheres/it.json                  # источники сферы + language priority
    professions/it.uxui.json         # поисковые запросы и material sources профессии
  model/
    spheres.json                     # сферы и список профессий
    professions.json                 # индекс профессий
    competencies.json                # ЕДИНЫЙ массив компетенций
    profession-competencies/
      uxui.json                      # ссылки: competencyId + tier + order + prerequisites
    professions/views/
      product.json                   # профессиональная view: разделы + ссылки + tier/order
      motion.json
      graphic.json
```

### Сфера

`model/spheres.json`:

```json
{
  "id": "it",
  "title": "IT и цифровые продукты",
  "professionIds": ["it.uxui"]
}
```

### Профессия

`model/professions.json`:

```json
{
  "id": "it.uxui",
  "sphereId": "it",
  "title": "UX/UI-дизайнер",
  "canonicalMapFile": "canonical/uxui.json",
  "catalogFile": "catalog/it.json",
  "priorityFile": "priority/uxui.json",
  "sourcesFile": "sources/professions/it.uxui.json"
}
```

### Единый массив компетенций

`model/competencies.json` содержит `id`, branch/section, title, definition, `priorityHint`, sourceEvidence. Это единственное место, где живёт содержательное определение компетенции.

### Связка профессии

`model/profession-competencies/uxui.json`:

```json
{
  "professionId": "it.uxui",
  "sphereId": "it",
  "competencies": [
    { "competencyId": "ux-design-thinking", "tier": "foundation", "order": 1, "prerequisites": [] }
  ]
}
```

Именно здесь появляются разные приоритеты для разных профессий. Блоки и теги остаются в каталоге.

## 3. Источники

- `sources/registry.json` — что это за источник, лицензия, доступ, статус, адаптер.
- `sources/spheres/it.json` — какие источники относятся к сфере, language priority (`ru`, затем `en`), роль (`occupations`, `skills`, `materials`, `standards`), статус.
- `sources/professions/it.uxui.json` — конкретные поисковые запросы профессии по ESCO/O*NET/Практикуму, material source ids, blocked source ids.

Это разделяет «где искать вообще» (сфера) и «как искать эту профессию» (профессия). Реестр остаётся единственным источником определений и лицензий.

## 4. Профессиональные view и переиспользование

Для нескольких профессий одна и та же глобальная компетенция получает **разные tier/order**:

`model/professions/views/motion.json`:

```json
{
  "professionId": "it.motion",
  "sections": [
    {
      "id": "motion-craft",
      "title": "Кинетика и интерактив",
      "competencies": [
        { "competencyId": "ui-motion", "tier": "foundation", "order": 5 },
        { "competencyId": "ui-interaction-states", "tier": "core", "order": 6 }
      ]
    }
  ]
}
```

`model:views` материализует это в `model/profession-competencies/<slug>.json` с `sectionId/sectionTitle` и **prerequisites**, не создавая копий компетенций. Так `ui-motion` может быть `foundation` у motion, `core` у UX/UI и `optional` у product.

Prerequisites из view — источник истины для слоя order профессии: `buildProfessionCompetenciesFromView` переносит их в `profession-competencies`, `validateProfessionView` требует, чтобы prerequisite входил в профессию и имел меньший `order`, а `model:validate` дополнительно ловит циклы. Для product/motion/graphic это и есть priority/order слой; отдельный `priority/<profession>.json` не вводится, потому что `priority/uxui.json` — block-level accepted marks UX/UI (см. `COS-RES-020`, §5).

Текущие view:
- `it.product` — 30 ссылок и **41 связь prerequisites**, связный граф с единственным корнем `ux-design-thinking`; включая Discovery/JTBD/CJM, метрики, стратегию, рост и эксперименты;
- `it.motion` — 19 ссылок, уклон в кинетику, тайминг, сторибординг и 3D;
- `it.graphic` — 18 ссылок, уклон в бренд, печать и редакционный дизайн.

## 5. Команды

```bash
npm run model:sync -- --domain it --profession uxui --write
npm run model:views -- --domain it --write
npm run model:validate -- --domain it --profession uxui --all --require-blocks
npm run mapping:validate -- --domain it --profession product --report
npm run canvas:profession -- --profession motion
npm run canvas:profession -- --profession product
npm run canvas:profession -- --profession graphic
npm run canvas:profession-network -- --profession product
npm run canvas:profession-network -- --profession motion
npm run canvas:profession-network -- --profession graphic
npm run canvas:tabs
```

Human-review канвас: `web/competencies-review-canvas.html` — табы по профессиям (UX/UI, Product, Motion, Graphic) вместо tier-фильтров внутри страницы. Tier-легенда остаётся в карточках/деталях.

`model:sync` собирает нормализованные файлы из canonical map, priority, registry и targets. `model:validate` проверяет ссылочную целостность: сфера → профессия, профессия → компетенция, порядок, prerequisites (существование, порядок, циклы), source-файлы; с `--require-blocks` — наличие accepted-блока для каждой компетенции профессии. `mapping:validate` проверяет сопоставление собранных тегов компетенциям (см. `COS-RES-020`).

## 6. Текущий срез

- сфера: `it`;
- профессий: **4** — `it.uxui`, `it.product`, `it.motion`, `it.graphic`;
- компетенций в едином массиве: **45** (34 базовых + 11 профессио-специфичных);
- каталог домена: **44 блока, 195 тегов** (UX/UI + profession-specific);
- profession-competencies: UX/UI — 34, product — 30 (41 prerequisites), motion — 19 (29 prerequisites), graphic — 18 (33 prerequisites); все графы — 1 компонента с корнем `ux-design-thinking`;
- переиспользуемых компетенций: **34** (базовые входят в несколько профессий; 9 специфичных — в свою);
- источники: `sources/spheres/it.json` + отдельный файл на каждую профессию (`sources/professions/it.*.json`); Material Agent берёт `materialSourceIds` из source-файла профессии, по умолчанию только active;
- страницы: `web/it-uxui-competency-canvas.html`, `web/it-product-competency-map.html`, `web/it-motion-competency-map.html`, `web/it-graphic-competency-map.html`, сетевые `web/it-product-competency-canvas.html`, `web/it-motion-competency-canvas.html`, `web/it-graphic-competency-canvas.html`; единый review-канвас `web/competencies-review-canvas.html` с табами по профессиям;
- mapping: `mapping/it.product.json` — 30/30 (direct 11 / adjacent 15 / none 4); `mapping/it.motion.json` — 19/19 (9/5/5); `mapping/it.graphic.json` — 18/18 (11/6/1); «без решения» 0;
- источники профессий: Practicum подключён для UX/UI, product, motion и graphic;
- acceptance-состояние: 44/44 accepted-блоков имеют `canonicalIds`; 0 accepted-материалов;
- `model:validate --all --require-blocks`: 0 ошибок; тесты 146/146.

## 7. Следующие профессии

Product-, Motion- и Graphic-итерации завершены (`COS-RES-020`, `COS-RES-021`): view, prerequisites, mapping и canvas пересобраны для всех трёх профессий. Дальше — калибровка методики и расширение за пределы дизайнерских профессий: проверить occupation-маппинг, mapping тегов, prerequisites, материалы, затем human-review.

## 8. Ограничения

- Пока нормализованная модель генерируется из UX/UI canonical map; ручное редактирование `competencies.json` не является источником истины.
- `profession-competencies` для UX/UI использует `priorityHint` canonical map; для product/motion/graphic tier/order/prerequisites берутся из view.
- Product priority/order слой — view + материализованная `profession-competencies/product.json`; отдельный `priority/product.json` не вводится (см. `COS-RES-020`, §5).
- `professions:collect` читает `sources/professions/<profession>.json` и разрешает только объявленные occupation sources; `--profession motion` использует motion-запросы.
- `tags:collect --profession <slug>` читает `data/competency/professions-<domain>-<slug>.json`, а не общий файл.
- Material Agent использует `materialSourceIds` из source-файла и по умолчанию только active.
- Теги 5 product-specific блоков синтетические (`sourceRefs: []`, `needs_review`); mapping — черновик для human-review.
- Следующий шаг — human-review mapping → evidence-backed пересборка блоков, затем материалы (Material Agent) и motion/graphic по той же схеме.

## 9. История изменений

| Версия | Дата | Что изменилось |
|---|---|---|
| 1.0.0 | 2026-10-21 | Введены сфера/профессия/единый массив компетенций и source-файлы; `model:sync`, `model:validate`, нормализованный UX/UI |
| 1.1.0 | 2026-10-21 | Добавлены profession views для product/motion/graphic, `model:views`, переиспользование 34 компетенций и разные tier/order |
| 1.2.0 | 2026-10-21 | Добавлены profession map pages (`canvas:profession`), Material Agent читает source-файл профессии, active material sources по умолчанию |
| 1.3.0 | 2026-10-21 | `professions:collect --profession` и `tags:collect --profession` подключены к source-файлам; motion smoke: 1 профессия, 172 тега |
| 1.4.0 | 2026-10-21 | Добавлены 9 профессио-специфичных компетенций (motion timing/3D, product strategy/growth/experiments, graphic brand/print/editorial); общий массив 43, страницы пересобраны |
| 1.5.0 | 2026-10-21 | Добавлены сетевые канвасы для product/motion/graphic (`canvas:profession-network`); source-файлы используются сборщиками; 127 тестов |
| 1.6.0 | 2026-10-21 | Порядок UX/UI исправлен: дизайн-мышление → исследования, аналитика 17-я после метрик, requirements/wireframes переставлены; добавлен tabbed review canvas по профессиям без tier-фильтров |
| 1.7.0 | 2026-10-22 | Product graph: 28 узлов / 27 связей; добавлены межраздельные prerequisites (design thinking → product thinking/research, UX research → IA, product thinking → metrics, design → UI color) |
| 1.8.0 | 2026-10-22 | Product: Practicum `product-approach-for-designers` подключён через профессию, из каталога извлекаются тематические теги (CJM, JTBD, гипотезы, юзабилити, дизайн-системы); 182 тега |
| 1.9.0 | 2026-10-22 | Product graph расширен до 30 узлов: JTBD и CJM; 29 связей; каталог 44 блока / 195 тегов; глобальный массив 45 компетенций |
| 2.0.0 | 2026-10-25 | canonicalIds у всех 44 accepted-блоков; prerequisites материализуются и валидируются; `--require-blocks`; Product: исправлены O*NET-занятия (15-1255.00 + 13-1161.00), 368 тегов, mapping 30/30, связный граф 41 связь, canvas/map пересобраны; решение по priority/order — `COS-RES-020` |
| 2.1.0 | 2026-10-25 | Motion/Graphic: Practicum-источники и санитайзер тегов (228/204 тега), mapping 19/19 и 18/18, связные графы 29/33 связи, материалы 19/19 и 18/18 покрытия — `COS-RES-021` |
