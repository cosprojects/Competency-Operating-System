---
id: COS-RES-022
title: Learning Sources Library — обновляемый реестр учебных источников
version: 1.0.0
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
  cli/validate.ts
  cli/audit.ts
  cli/discover.ts
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
```

`learning:audit` проверяет доступность активных источников, пишет отчёт в `data/learning-sources/` и не меняет реестр автоматически.

## 7. Границы

- Источники не переопределяют компетенции автоматически.
- Курсы и агрегаторы не являются доказательством зарплат/требований рынка.
- Материалы и knowledge graph — следующий слой; эта библиотека только фиксирует, откуда брать учебные темы.
- 403-источники остаются в реестре как reference/blocked, но не участвуют в автоматическом сборе.
- Для каждой профессии нужно периодически перепроверять статус и темы.

## 8. Следующие шаги

1. Human-review 10 motion seed-блоков и 55 компетенций.
2. Запустить `learning:discover` для UX/UI, Product, Graphic при наличии Google CSE ключа.
3. Добавить извлечение тематических блоков из course pages (без копирования текста) и mapping source→competency.
4. Обновить Motion materials после принятия блока.
5. Расширить библиотеку на остальные профессии.
