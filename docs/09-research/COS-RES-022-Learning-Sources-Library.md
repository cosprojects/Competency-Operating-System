---
id: COS-RES-022
title: Learning Sources Library — обновляемый реестр учебных источников
version: 1.4.0
status: Draft
owner: Research Team
last_updated: 2026-10-26
references:
  - COS-RES-015
  - COS-RES-018
  - COS-RES-019
  - COS-RES-020
  - COS-RES-021
---

# COS-RES-022 — Learning Sources Library

## 1. Зачем

Нужен отдельный, обновляемый слой учебных источников:

- где смотреть актуальные навыки и знания по профессии;
- какие источники первичные, а какие — агрегаторы/дубли;
- что доступно автоматически, а что требует человека;
- как связать источник с компетенцией и позже — с материалами.

Это **не** граф знаний и **не** автоматическое доверие к курсам. Источник остаётся внешним свидетельством, пока человек не принял его данные.

## 2. Где лежит

```text
src/methodology/v1/learning-sources/
  types.ts          # схема LearningSourceRecord/Registry
  validate.ts       # проверки реестра
  audit.ts          # HTTP-проверка доступности
  search.ts         # Google CSE provider + поисковые шаблоны
  registry.json     # сам реестр (tracked)
  map.ts            # проекция source→competency, валидация и покрытие
  cli/validate.ts
  cli/audit.ts
  cli/discover.ts
  cli/map.ts
```

Реестр: `src/methodology/v1/learning-sources/registry.json`.

## 3. Схема записи

```ts
{
  id, title, url,
  kind: "school" | "course-platform" | "video-channel" | "video-playlist" |
        "portfolio-case" | "aggregator" | "blog" | "reference",
  professionIds: ["it.motion"],
  languages: ["en", "ru"],
  access: "free" | "freemium" | "paid" | "mixed" | "unknown",
  authority: "primary" | "secondary" | "aggregator",
  status: "active" | "degraded" | "blocked" | "duplicate" | "planned",
  topics: string[],
  discoveredBy: "user" | "search" | "manual",
  lastChecked, httpStatus?, finalUrl?, duplicateOf?, notes?
}
```

Правила:

- `blocked` не считается плохим источником — это статус доступности для автоматики.
- `duplicate` обязан ссылаться на `duplicateOf`.
- `authority` отражает роль, а не качество: агрегатор может быть полезен для discovery, но не для приёмки навыков.
- `topics` — короткие темы, не копии описаний курсов.

## 4. Аудит присланных источников

Проверка 2026-10-22 (реестр), motion-источники перепроверены 2026-10-26: **33 записи, 24 active, 7 blocked, 2 duplicate**.

### Motion

| Источник | Роль | Статус |
|---|---|---|
| motiondesign.school/courses | primary school | active |
| motiondesign.school YouTube | primary video | active |
| School of Motion | primary school | active |
| School of Motion /free | primary free | active |
| motiondesign.school Vimeo | primary video | active |
| petrick.co MDS case | secondary case | active |
| practicum design catalog | primary program catalog | active |
| coursetrain / coursehunter | aggregator | active/duplicate |

Вывод: Motion Design School и School of Motion — первоисточники; CourseTrain/CourseHunter — агрегаторы и дубли, их нельзя считать отдельными подтверждениями.

### UX/UI

- Figma Design Basics — primary reference.
- Coursera / Great Learning / Codecademy — course platforms, secondary.
- UX Design Institute blog — aggregator/обзор тем.
- Class Central, Medium — **403 Cloudflare**, только ссылки для человека.
- UX Woman — кураторский список.

### Product

- Coursera Microsoft, Udacity, Alison, Great Learning — course platforms.
- Class Central, Udemy — 403.
- Product-источники частично пересекаются с UX/UI; дубли не считаются отдельными подтверждениями.

### Graphic

- Coursera, Alison, Great Learning — course platforms.
- YouTube playlist — video.
- Class Central, Udemy, Canva restricted — 403/ограничены.
- Canva restricted не является учебным источником.

## 5. Что дал аудит Motion

Текущий Motion view был слишком UI-центричным: 19 компетенций, мало 3D/звука/монтажа/продакшна. По источникам выявлены новые вводные:

- принципы анимации (12 principles, spacing, вес);
- style frames и арт-дирекшн;
- звуковой дизайн и синхронизация;
- композитинг/VFX;
- монтаж и ритм;
- 3D-анимация и риггинг;
- motion-айдентика и бренд-системы;
- After Effects / Cinema 4D / Blender / Spline / Unreal;
- продакшн-пайплайн;
- showreel и портфолио.

Внесено:

- **10 новых motion-компетенций** в единый массив;
- **Motion view: 28 компетенций, 42 связи**;
- 10 seed-определений с темами и source evidence;
- 10 motion-блоков приняты в каталог;
- каталог: **54 блока, 237 тегов**;
- глобальный массив: **55 компетенций**.

Связи компетенций с источниками хранятся в `learningSourceIds` у компетенций. Это прослеживаемость, а не автоматическая приёмка содержания.

Догоняющие изменения 2026-10-26:

- `mapping/it.motion.json` пересобран под 28 компетенций: 28/28 (direct 12, adjacent 11, none 5), `motion-storyboarding` убран, 10 новых motion-компетенций сопоставлены с собранными Practicum/O*NET-тегами;
- `mapping:validate --profession motion` — 0 ошибок, «без решения» 0;
- исправлен санитайзер Practicum-тегов: `\b` в JS не работает для кириллицы, поэтому вопросы вида «Как понять…» проходили в теги; теперь фильтр использует `(\s|$)`, а также применяется к тегам каталога программ;
- после пересбора тегов: motion 224 (knowledge 83), graphic 199 (knowledge 107); материалы Motion перезапущены на 28 компетенций — 30 элементов / 59 материалов / 26 связей, покрытие 28/28.

## 6. Автоматизация поиска

Команда:

```bash
npm run learning:discover -- --profession motion --limit 10
```

Что делает:

- берёт шаблоны `motion design free courses`, `motion design school courses`, `after effects motion design course`, `3d motion design course`;
- вызывает **Google Programmable Search JSON API** (CSE), первые 10 результатов на запрос;
- сохраняет кандидатов в `data/learning-sources/discovered-*.json`;
- **не добавляет кандидатов в реестр автоматически** — нужен human-review.

Требуются:

```bash
export GOOGLE_CSE_API_KEY=...
export GOOGLE_CSE_CX=...
```

Без ключей команда завершается с кодом 2 и объясняет, что нужно. Google HTML не парсится, блокировки не обходятся.

Дополнительно:

```bash
npm run learning:validate   # схема, дубли, source links
npm run learning:audit -- --profession motion
npm run learning:map -- --report
```

`learning:audit` проверяет доступность активных источников, пишет отчёт в `data/learning-sources/` и не меняет реестр автоматически. Аудит Motion (2026-10-26): 9 проверенных источников, 9 active, 0 degraded.

### 6.1. Mapping source → competency

Ручной, tracked-слой: `src/methodology/v1/competency/model/learning-source-links.json`.

- запись — `competencyId`, `sourceIds`, `rationale`;
- `model:sync` мержит его в `competencies.json` (union с `learningSourceIds` из canonical/extra, без дублей); неизвестная компетенция — ошибка, чтобы опечатка не терялась;
- это единственное место, где ведётся связь «где учиться компетенции»; при пересборке модели связи не теряются;
- источник — место обучения, а не доказательство содержания: приёмка остаётся human-gated.

`learning:map` строит обратную проекцию `competency.learningSourceIds` и проверяет:

- источник существует в реестре;
- `blocked`/`duplicate` источник не может быть доказательством компетенции;
- источник объявлен для профессии компетенции (`professionIds`);
- агрегатор не считается достаточным свидетельством — только предупреждение с требованием первичного источника;
- активные источники без связей попадают в предупреждения, чтобы их не забывали.

### 6.2. Discovery-only источники

Не каждый активный источник должен быть связан с компетенцией: каталоги курсов, обзоры и карьерные страницы полезны для поиска, но не являются свидетельством содержания. Для них в реестре есть флаг `discoveryOnly: true` (8 источников: CourseTrain/CourseHunter, UX Woman, UX Design Institute, career/catalog-страницы Coursera/Alison/Great Learning, YouTube-плейлист Graphic).

Правила:

- `discoveryOnly` не может быть `primary` источником (ошибка `learning:validate`);
- такой источник не даёт предупреждения «активен, но не связан» — решение явное, а не забытое;
- если его всё же связать с компетенцией, `learning:map` вернёт ошибку: свидетельством он не является.

После разметки `learning:map`: **0 предупреждений**, 0 ошибок; предупреждения остаются для неразмеченных активных источников с уникальными темами.

Покрытие на 2026-10-26 (после связывания источников):

| Профессия | Компетенций с активным первичным источником |
|---|---:|
| UX/UI | 24/34 |
| Product | 23/30 |
| Motion | 23/28 |
| Graphic | 14/18 |

Связано 43 из 55 компетенций, ошибок 0. Не связаны компетенции, для которых в реестре нет подходящей темы (например, продуктовые метрики, аналитика, доступность, FigJam): это честные пробелы, а не автоматическое доверие к курсам.

## 7. Границы

- Источники не переопределяют компетенции автоматически.
- Курсы и агрегаторы не являются доказательством зарплат/требований рынка.
- Материалы и knowledge graph — следующий слой; эта библиотека только фиксирует, откуда брать учебные темы.
- 403-источники остаются в реестре как reference/blocked, но не участвуют в автоматическом сборе.
- Для каждой профессии нужно периодически перепроверять статус и темы.

## 8. Следующие шаги

1. Human-review 10 motion seed-блоков и 55 компетенций.
2. Запустить `learning:discover` для UX/UI, Product, Graphic при наличии Google CSE ключа.
3. Добавить извлечение тематических блоков из course pages (без копирования текста).
4. Разобрать предупреждения `learning:map` (сделано: 8 каталогов/обзоров размечены `discoveryOnly`, предупреждений 0).
5. Обновить Motion materials после принятия блока (сделано: 30 элементов / 59 материалов / покрытие 28/28).
6. Расширить библиотеку на остальные профессии.

## 9. История изменений

| Версия | Дата | Что изменилось |
|---|---|---|
| 1.0.0 | 2026-10-26 | Реестр 33 учебных источников, motion расширен до 28 компетенций (10 новых блоков), `learning:validate` / `learning:audit` / `learning:discover` |
| 1.1.0 | 2026-10-26 | Консистентность Motion: mapping 28/28, исправлен санитайзер кириллических вопросов, теги каталога проходят фильтр, материалы Motion 28/28 |
| 1.2.0 | 2026-10-26 | `learning:map`: проекция source→competency, проверка blocked/duplicate/профессии, coverage-отчёт; аудит Motion 9/9 active; покрытие Motion 10/28, остальные профессии — backlog |
| 1.3.0 | 2026-10-26 | `model/learning-source-links.json`: 62 ручные связи competency→source, merge в `model:sync`; покрытие источников: UX/UI 24/34, Product 23/30, Motion 23/28, Graphic 14/18 (43/55 компетенций), ошибок 0 |
| 1.4.0 | 2026-10-26 | Флаг `discoveryOnly` для каталогов/обзоров (8 источников); `learning:map` — 0 предупреждений; discoveryOnly нельзя использовать как свидетельство; 154 теста |
