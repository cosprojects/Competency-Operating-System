---
id: COS-RES-020
title: Product-specific сборка компетенций — источники, mapping, граф и слой приоритетов
version: 1.0.0
status: Draft
owner: Research Team
last_updated: 2026-10-25
references:
  - COS-RES-014
  - COS-RES-015
  - COS-RES-016
  - COS-RES-017
  - COS-RES-018
  - COS-RES-019
---

# COS-RES-020 — Product-specific сборка компетенций

Документ фиксирует итерацию по профессии `it.product`: исправление источников, сопоставление product-тегов с 30 компетенциями, пересборку связного графа и решение по слою priority/order. UX/UI-приоритеты (33 accepted mark) не менялись.

## 1. Что было не так

1. **Product-узлы без блоков.** В Product view 30 компетенций, но 10 из них не находили accepted-блок: `ux-user-research`, `ux-analytics`, `ux-requirements`, `ux-metrics`, `ux-ethics-privacy`, `ui-typography`, `ui-layout`, `ui-accessibility`, `ui-visual-communication`, `ui-data-visualization`. Причина не в отсутствии блоков, а в том, что у 14 accepted-блоков UX/UI не было поля `canonicalIds`, а network-канвас сопоставляет блоки только по нему. Узлы рисовались без компонентов и тегов.
2. **Неверное occupation-сопоставление Product.** O*NET lookup вёл на `27-1021.00 Commercial and Industrial Designers`, ESCO-titleIncludes разрешал `industrial designer`. Отсюда 182 product-тега преимущественно про индустриальный дизайн (CAD/CAM, ювелирка, керамика) и «мало кандидатов» у Pass A.
3. **Граф был несвязным.** `{product-strategy, product-growth, product-experimentation}` — отдельная компонента из 3 узлов без prerequisites; остальные 27 узлов — вторая.
4. **Product-теги блоков синтетические.** У блоков JTBD/CJM/стратегии/роста/экспериментов `sourceRefs: []` и `evidenceState: needs_review`, хотя в собранных Practicum-тегах есть реальные JTBD, CJM, RICE, SMART, User Story, гипотезы.

## 2. Исправление источников

`targets/it.json` для `product`:

| Было | Стало |
|---|---|
| O*NET `27-1021.00 Commercial and Industrial Designers` | O*NET `15-1255.00 Web and Digital Interface Designers` + `13-1161.00 Market Research Analysts and Marketing Specialists` |
| ESCO titleIncludes `product designer`, `industrial designer` | ESCO titleIncludes `product designer` |

O*NET-занятия выбраны по локальной базе `occupation_data` (не выдуманы): `15-1255.00` — цифровые интерфейсы, `13-1161.00` — исследование рынка/клиента, метрики и аналитика. `collectProfessions` теперь принимает **все явно объявленные SOC-коды**, а не только первое совпадение; `tagsForProfession` собирает теги из каждого O*NET-источника профессии.

Результат `tags:collect --profession product`:

| Показатель | Было | Стало |
|---|---:|---:|
| Всего тегов | 182 | 368 |
| knowledge | 69 | 47 |
| skill | 54 | 10 |
| tool | 59 | 311 (цифровые инструменты, отдельный слой) |

Индустриальный шум заменён на релевантные домены (Sales and Marketing, Customer and Personal Service, Psychology, Sociology and Anthropology, Economics and Accounting, Communications and Media, Mathematics, Monitoring) и 14 Practicum-тегов продуктового подхода.

## 3. Сопоставление product-тегов и 30 компетенций

Файл: `src/methodology/v1/competency/mapping/it.product.json`. Проверка:

```bash
npm run mapping:validate -- --domain it --profession product --report
```

Правила валидатора (`mapping/validate.ts`):

- все 30 компетенций view описаны ровно один раз;
- `direct`/`adjacent` требуют тегов, `none` — пустой список и rationale;
- теги должны существовать в собранном наборе и быть `knowledge`/`skill` (инструмент — не доказательство);
- тег нельзя одновременно использовать и исключать;
- каждый собранный knowledge/skill-тег либо использован, либо явно исключён (инструменты не учитываются).

Итог: **direct — 11, adjacent — 15, none — 4; использовано 30 тегов, исключено 26; без решения 0.** «none» — четыре компетенции прототипирования (вайрфреймы, low-fi, hi-fi, интерактивные прототипы): product-теги их не подтверждают, блоки осознанно переиспользованы из UX/UI.

Support по компетенциям:

| Support | Компетенции |
|---|---|
| direct | JTBD, CJM, пользовательские исследования, интервью, требования (User Story), юзабилити-тестирование, UX-метрики/эксперименты, дизайн-системы, компоненты, стратегия, эксперименты |
| adjacent | дизайн-мышление, продуктовое мышление, этика, персоны, IA, флоу, метрики, аналитика, визуализация данных, цвет, типографика, композиция, доступность, визуальная коммуникация, рост |
| none | вайрфреймы, low-fi, hi-fi, интерактивные прототипы |

Mapping — **черновик для human-review**, не приёмка. Он не переписывает accepted-блоки и не меняет каталог.

## 4. Граф Product

`model/professions/views/product.json` пересобран: 30 компетенций, 6 разделов, **41 явная связь prerequisites** (было 29, из них 3-узловая изолированная компонента). Теперь граф — **одна компонента с единственным корнем** `ux-design-thinking`, связи идут от foundation к advanced.

Ключевые изменения порядка и связей:

- `analytics` перенесена после `metrics` (17 → 18), `experiments` — после аналитики;
- `usability-testing` перенесена после интерактивных прототипов (16);
- JTBD идёт до CJM и до персон, CJM опирается на JTBD и персоны;
- требования опираются на флоу и вайрфреймы, прототипы — цепочкой low-fi → hi-fi → interactive;
- дизайн-системы опираются на IA и композицию, компоненты → доступность;
- `product-strategy` переведена из foundation в core и опирается на продуктовое мышление и метрики; рост — на стратегию и аналитику; эксперименты — на стратегию и UX-эксперименты.

| # | Компетенция | Tier | Блок | Support | Теги |
|---:|---|---|---|---|---:|
| 1 | Дизайн-мышление | foundation | reuse | adjacent | 2 |
| 2 | Продуктовое мышление | foundation | reuse | adjacent | 3 |
| 3 | Этика, приватность и ограничения | optional | reuse | adjacent | 1 |
| 4 | Jobs-to-be-Done | foundation | own | direct | 2 |
| 5 | Пользовательские исследования | core | reuse | direct | 5 |
| 6 | Интервью и наблюдение | core | reuse | direct | 3 |
| 7 | Персоны и сегментация | core | reuse | adjacent | 3 |
| 8 | Customer Journey Map | core | own | direct | 1 |
| 9 | Информационная архитектура | core | reuse | adjacent | 1 |
| 10 | Пользовательские сценарии и флоу | core | reuse | adjacent | 1 |
| 11 | Вайрфреймы и структура экранов | core | reuse | none | 0 |
| 12 | Анализ требований и постановка задач | core | reuse | direct | 3 |
| 13 | Низкодетализированные прототипы | core | reuse | none | 0 |
| 14 | Высокодетализированные прототипы | core | reuse | none | 0 |
| 15 | Интерактивные прототипы | core | reuse | none | 0 |
| 16 | Юзабилити-тестирование | core | reuse | direct | 3 |
| 17 | Продуктовые метрики и бизнес-обоснование | core | reuse | adjacent | 3 |
| 18 | Продуктовая аналитика | core | reuse | adjacent | 3 |
| 19 | UX-метрики и эксперименты | core | reuse | direct | 3 |
| 20 | Визуализация данных | optional | reuse | adjacent | 2 |
| 21 | Теория цвета и колористика | core | reuse | adjacent | 2 |
| 22 | Типографика | core | reuse | adjacent | 2 |
| 23 | Композиция, сетки и визуальная иерархия | core | reuse | adjacent | 2 |
| 24 | Дизайн-системы и токены | core | reuse | direct | 3 |
| 25 | Компоненты и паттерны | core | reuse | direct | 2 |
| 26 | Доступность и инклюзивный дизайн | core | reuse | adjacent | 2 |
| 27 | Визуальная коммуникация | optional | reuse | adjacent | 3 |
| 28 | Продуктовая стратегия | core | own | direct | 5 |
| 29 | Рост, воронки и удержание | core | own | adjacent | 3 |
| 30 | Эксперименты и проверка гипотез | core | own | direct | 5 |

Tier-раскладка: **3 foundation / 24 core / 3 optional**. Пять собственных product-блоков (JTBD, CJM, стратегия, рост, эксперименты, 20 тегов), остальные 25 — переиспользованные accepted-блоки UX/UI, теперь явно связанные через `canonicalIds`.

## 5. Решение по priority/order Product

**Решение: отдельный `priority/product.json` не вводится.** Причины:

- `priority/uxui.json` — block-level marks (33 accepted, `competencyId` = id блока каталога), это принятый human-owned слой UX/UI. Product view работает на уровне **канонических компетенций**, где одна компетенция может опираться на переиспользованный блок UX/UI; копия блочных marks создала бы второй источник истины и конфликт с UX/UI.
- Источник истины Product по tier/order/prerequisites — `model/professions/views/product.json`.
- Материализованная проекция — `model/profession-competencies/product.json`; теперь она **сохраняет prerequisites** (раньше `buildProfessionCompetenciesFromView` их терял) и является проверяемым слоем priority/order профессии.

Валидация слоя (`model:validate`):

- prerequisites существуют внутри профессии, не образуют циклов и не идут позже зависимой компетенции по `order`;
- `--require-blocks` требует accepted-блок для каждой компетенции профессии;
- порядок/циклы prerequisites проверяются и в самом view (`validateProfessionView`), поэтому ошибка ловится на `model:views`.

```bash
npm run model:validate -- --domain it --profession product --all --require-blocks
# model:validate it.product: competencies 45; profession links 30; errors 0
# model:validate --all: professions 4; reused competencies 34; errors 0
```

UX/UI при этом не затронут: `priority:validate --domain it --profession uxui --require-complete --require-accepted` — 33 marks, 0 ошибок.

## 6. Честный статус

- **Evidence-backed:** источники Product (O*NET/Практикум), 368 собранных тегов, mapping 30/30, структура view/графа, связи и order.
- **Собственные accepted-блоки:** 5 product-specific блоков (JTBD, CJM, стратегия, рост, эксперименты) с 20 тегами.
- **Синтетическое / не accepted:** теги этих 5 блоков не имеют `sourceRefs` и остаются `needs_review` — mapping показывает, какие реальные product-теги могут их подтвердить, но принятие остаётся human-gated. Переиспользованные блоки UX/UI для 25 компетенций — осознанный reuse, а не собственные product-блоки.
- **Pass A на улучшенных тегах:** 13 кандидатов / 17 неназначенных / 0 issues (на старом индустриальном наборе было 9 / 86). Кандидаты — черновики в `data/`, не приняты; гранулярность «учебных тем» сохраняется, поэтому канонический уровень задают seeds/view, а не bottom-up.
- **Evidence-backed пересборка (подготовлено, не принято):** в `seeds/it.json` для 5 product-компетенций заполнены `tagHints` из собранных Practicum-тегов; `competency:seed --profession product --tags-file data/competency/tags-it-product.json` даёт 5–9 тегов на компетенцию, Pass B — 5 блоков-предложений с реальными `sourceRefs` (1–5 на блок). Артефакты: `data/competency/proposed-blocks-it-product.json`, `review/proposed-blocks-it-product.md`. Accepted-каталог не менялся; приёмка остаётся human-gated.
- Материалов accepted: 0. Knowledge graph не строится (отложен по решению пользователя).

## 7. Команды итерации

```bash
# проверки
npm run typecheck && npm test
npm run model:validate -- --domain it --profession product --all --require-blocks
npm run mapping:validate -- --domain it --profession product --report
npm run catalog:validate -- --domain it --require-priority
npm run priority:validate -- --domain it --profession uxui --require-complete --require-accepted

# источники Product
npm run professions:collect -- --domain it --profession product
npm run tags:collect -- --domain it --profession product

# граф и страницы
npm run model:views -- --domain it --write
npm run canvas:profession -- --profession product
npm run canvas:profession-network -- --profession product
npm run canvas:tabs
```

## 8. Ограничения и открытые задачи

1. Подтвердить mapping human-review и принять/отклонить evidence-backed предложения блоков (`proposed-blocks-it-product.json`) — только человек решает, заменять ли synthetic-теги accepted-блоков.
2. Seeds для Product уже содержат `tagHints`; после приёмки предложений — перегенерировать каталог и mapping.
3. Материалы Product — только после фиксации графа: `materials:agent:queue`, затем human-review журналов.
4. Motion и Graphic — по той же схеме (источники → mapping → prerequisites → canvas).
5. Knowledge graph (competency → components/tags/materials) не строится.
6. ESCO для Product недоступен в текущем окружении (прокси отдаёт HTML); сборка продолжается через O*NET/Практикум без обхода.

## 9. История изменений

| Версия | Дата | Что изменилось |
|---|---|---|
| 1.0.0 | 2026-10-25 | Product: исправлены O*NET-занятия и multi-SOC сбор, 368 тегов; mapping 30/30; связный граф 41 связь; решение по priority/order слою; Product canvas/map пересобраны |
