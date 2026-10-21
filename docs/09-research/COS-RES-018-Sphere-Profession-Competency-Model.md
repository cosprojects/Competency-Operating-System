---
id: COS-RES-018
title: Модель сфера → профессия → компетенции и систематизация источников
version: 1.0.0
status: Draft
owner: Research Team
last_updated: 2026-10-21
references:
  - COS-RES-014
  - COS-RES-016
  - COS-RES-017
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

## 4. Команды

```bash
npm run model:sync -- --domain it --profession uxui --write
npm run model:validate -- --domain it --profession uxui
```

`model:sync` собирает нормализованные файлы из canonical map, priority, registry и targets. `model:validate` проверяет ссылочную целостность: сфера → профессия, профессия → компетенция, порядок, prerequisites, source-файлы.

## 5. Текущий срез

- сфера: `it`;
- профессия: `it.uxui`;
- компетенций в едином массиве: **34**;
- profession-competencies: **34**;
- источников сферы: все из registry, с ролями и статусами;
- у профессии: ESCO/O*NET/Практикум + material sources;
- `model:validate`: 0 ошибок.

## 6. Следующие профессии

Для motion / product / graphic:

1. добавить `canonical/<profession>.json` с собственными разделами (или переиспользовать существующие competency ids);
2. добавить `model/profession-competencies/<profession>.json` с tier/order этой профессии;
3. добавить `sources/professions/<profession>.json` с поисковыми запросами;
4. расширить `spheres/it.json` списком профессий;
5. `model:sync`/`model:validate` — без дублирования компетенций.

## 7. Ограничения

- Пока нормализованная модель генерируется из UX/UI canonical map; ручное редактирование `competencies.json` не является источником истины.
- `profession-competencies` использует `priorityHint` canonical map. Для разных профессий это нужно заменить на profession-specific tier/order.
- Источники сферы/профессии пока не подключены к сборщикам напрямую; следующий шаг — читать эти файлы в `professions:collect` / `tags:collect`.

## 8. История изменений

| Версия | Дата | Что изменилось |
|---|---|---|
| 1.0.0 | 2026-10-21 | Введены сфера/профессия/единый массив компетенций и source-файлы; `model:sync`, `model:validate`, нормализованный UX/UI |
