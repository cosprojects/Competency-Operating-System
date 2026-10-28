---
id: COS-REL-002
title: Контентная работа и приёмка Beta 1
version: 1.0.0
status: Draft
owner: Product Team
last_updated: 2026-10-28
references:
  - COS-REL-001
  - COS-REL-008
  - COS-RES-019
  - COS-RES-022
  - COS-ARCH-002
  - AGENTS-competency-methodologist
---

# COS-REL-002 — Контентная работа и приёмка Beta 1

> **Статус 2026-10-28:** `release:validate` проходит: 54/54 компетенции, 110/110 связей, 0 пробелов. Нормализация AI-assisted; манифест остаётся `draft` до spot-check основателя. Результат — `reports/beta-1-content-gate-closure.md`.

## 1. Принцип

Качество сборки — предусловие диагностики. Если знания и навыки собраны произвольно, следующий слой будет измерять не то, что заявлено. Поэтому контентный gate строгий, а не «проверка перед запуском».

Контент — критический путь Beta. Приложение можно собрать быстрее, чем довести 37 компетенций; публиковать непроверенные знания и навыки нельзя. AI готовит evidence и черновики, человек принимает решение. Ни один сгенерированный тег не становится `supported` без ссылки на источник и человеческого подтверждения.

## 2. Backlog

### 2.1. Компетенции без подтверждённого состава (21)

| Профессия | Компетенции |
|---|---|
| Product | `product-jtbd`, `product-cjm`, `product-strategy`, `product-growth`, `product-experimentation` |
| Motion | `motion-animation-principles`, `motion-timing-easing`, `motion-styleframes`, `motion-editing`, `motion-sound-design`, `motion-3d-animation`, `motion-3d-rendering`, `motion-compositing`, `motion-brand-systems`, `motion-toolchain`, `motion-production`, `motion-showreel` |
| Graphic | `graphic-brand-identity`, `graphic-print-production`, `graphic-editorial-layout` |
| UX/UI | `ui-figjam` |

`ui-figjam` переиспользуется в Motion и Graphic; закрытие одного блока покрывает три связи.

### 2.2. Компетенции с неполным составом

- 11 компетенций имеют только знания; нужно добавить/подтвердить навыки.
- 3 компетенции имеют только навыки; нужно добавить/подтвердить знания.
- 2 компетенции имеют оба типа, но недостаточный объём.

Точный список формируется `npm run release:report -- --release beta-1`; он является источником истины для батчей.

### 2.3. Источники

- 3 пробела: `ux-ethics-privacy`, `ui-framer`, `product-growth`.
- 26 уникальных источников используются четырьмя профессиями; 23 требуют описания.
- Для каждой из 125 уникальных пар «компетенция–источник» нужно решение в `release/beta-1-source-review.json`: `accepted`, `replaced` или `excluded` + причина. Решение можно дать один раз на пару, без дублирования по профессиям.
- Битые/деградировавшие ссылки заменяются; платные материалы помечаются, paywall не обходится.
- Для Beta допускается активный не-агрегатор источник (`primary` или `secondary`); вторичный помечается в UI и идёт в backlog на замену первичным. Агрегаторы и `discoveryOnly` не публикуются.

## 3. Процесс

### Шаг 1. AI-подготовка

- Использовать существующие seed/теги; не выдумывать URL, цитаты, цены и авторов.
- `competency:seed` + `competency:build` дают предложения блоков с `sourceRefs`.
- Всё, что не выводится из источника, остаётся `modelProposal=true` и идёт человеку.
- Инструмент не становится навыком; язык/фреймворк/программа — инструменты.

### Шаг 2. Человеческая проверка

Основатель проверяет каждый блок:

- название и определение соответствуют профессии;
- знания и навыки разделены корректно;
- каждый тег опирается на конкретный источник;
- нет дублей и соседних по смыслу формулировок;
- нет инструмента вместо навыка;
- источник действительно относится к компетенции, а не к профессии в целом.

Решение: `accepted` / `rejected` с причиной. Отклонённое не попадает в каталог.

### Шаг 3. Принятие в каталог

```bash
npm run catalog:accept -- --domain it --profession <profession> \
  --blocks-file <blocks.json> --write
npm run model:sync -- --domain it --profession <profession> --write
npm run model:views -- --domain it --write
npm run model:validate -- --domain it --profession <profession> --all --require-blocks
```

### Шаг 4. Источники

- Добавить `summary` (1–2 предложения) для используемых источников.
- Проверить `title`, `url`, `kind`, `access`, `authority`, `languages`, `lastChecked`.
- Запустить `learning:validate`, `learning:audit`, `learning:map -- --report`.
- Зафиксировать решение по каждой связи в `release/beta-1-source-review.json`.

### Шаг 5. Release gate

```bash
npm run release:report -- --release beta-1
npm run release:checklist
npm run release:validate -- --release beta-1
npm run release:build -- --release beta-1
```

`release:report` показывает пробелы и не блокирует работу. `release:validate` падает при любом пробеле. `release:build` собирает публичный JSON только после успешной валидации.

## 4. Батчи

| Батч | Состав | Цель |
|---|---|---|
| 1 | Product 5 + Graphic 3 + UX/UI 3 (`ui-figjam`, источники `ux-ethics-privacy`, `ui-framer`) | Закрыть самые заметные пробелы и общий `ui-figjam` |
| 2 | Motion 6: principles, timing, styleframes, editing, sound, showreel | Быстрые motion-компетенции с готовыми seeds |
| 3 | Motion 6: 3d-animation, 3d-rendering, compositing, brand-systems, toolchain, production | Оставшийся motion-блок |
| 4 | 11 «только знания» + 3 «только навыки» + 2 недостаточный объём | Довести состав до 2 знаний / 1 навыка |
| 5 | 26 описаний источников + финальная сверка 110 связей | Source gate |

Батчи 1–3 можно вести параллельно с разработкой приложения. Батчи 4–5 — финальный контентный gate.

## 5. Критерии выхода

- 54 уникальные компетенции, 110 связей, 0 ошибок `release:validate`.
- 0 компетенций без 2 знаний/1 навыка среди опубликованных.
- 0 компетенций без активного не-агрегатор источника с описанием; вторичные помечены.
- 0 битых ссылок среди опубликованных.
- 0 `needs_review` тегов в публичном наборе.
- 26 источников с описанием; 3 пробела закрыты или компетенции исключены с причиной.
- Подписанный отчёт с таблицей решений и остаточными рисками.

## 6. Остаточные риски

- Часть источников — общие каталоги курсов; релевантность подтверждается человеком, а не автоматически.
- Для некоторых компетенций один источник; это допустимо для Beta, но помечается как зона роста.
- AI-слой и 8 профессий остаются вне публикации; это осознанное ограничение, а не забытый backlog.
