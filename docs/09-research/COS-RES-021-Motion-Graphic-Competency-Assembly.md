---
id: COS-RES-021
title: Motion и Graphic — источники, mapping и связные графы
version: 1.0.0
status: Draft
owner: Research Team
last_updated: 2026-10-25
references:
  - COS-RES-014
  - COS-RES-015
  - COS-RES-017
  - COS-RES-018
  - COS-RES-019
  - COS-RES-020
---

# COS-RES-021 — Motion и Graphic: источники, mapping и связные графы

Итерация продолжает схему Product (`COS-RES-020`) для двух оставшихся профессий. UX/UI-приоритеты (33 accepted mark) не менялись; новые блоки не принимались.

## 1. Что было не так

1. **Графы были несвязными.** Motion: 19 узлов, 14 связей (из них явных prerequisites — 0, остальное — fallback-цепочки внутри разделов), **5 компонент**: визуальные основы, кинетика, инструменты, системы и motion-специализация жили отдельно. Graphic: 18 узлов, 13 связей, тоже **5 компонент**.
2. **Нет Practicum-источника.** У motion/graphic в `targets/it.json` не было `practicum`, поэтому теги шли только из O\*NET: 42 уникальных knowledge/skill, из них 33 — общие домены (Biology, Chemistry, Geography...). Темы курсов не попадали в словарь.
3. **Мусор в Practicum-тегах.** После подключения страниц курсов `collectPracticumTags` вытаскивал абзацы, маркетинговые фразы, карьерные тексты и вопросы («Навыки работы с ИИ сейчас так же важны…», «Куда пойти работать», «Что такое моушн-дизайн») как knowledge-теги.
4. **Motion-tier несогласованность:** `ui-framer` (инструмент) стоял в foundation, `motion-timing-easing` — foundation с order 17.

## 2. Исправление источников

`targets/it.json`:

| Профессия | Добавлено |
|---|---|
| Motion | Practicum `motion-designer` |
| Graphic | Practicum `graphic-designer` |

`collectPracticumTags` получил санитайзер `isUsablePracticumTitle` (в `sources/practicum.ts`):

- отбрасываются абзацы и предложения (длина > 80, наличие `.`/`!`/`?` внутри или в конце);
- отбрасываются карьерные/маркетинговые конструкции (`карьер`, `ваканс`, `резюме`, `портфолио`, `зарплат`, `фриланс`, `стажиров`, `ментор`, `поиск работы`…);
- отбрасываются вопросы и фразы от первого лица (`как…`, `что такое…`, `владею…`, `создаю…`, `делаю…`, `монтирую…`);
- отбрасываются общие заголовки (`Профессия`, `Инструменты и навыки`).

Результат `tags:collect --profession`:

| Профессия | Всего тегов | knowledge | skill | tool | Уникальных knowledge/skill |
|---|---:|---:|---:|---:|---:|
| Motion | 228 (было 172) | 87 | 10 | 131 | 96 (54 Practicum) |
| Graphic | 204 (было 122) | 112 | 10 | 82 | 118 (76 Practicum) |

Инструменты остаются отдельным слоем (`kind: tool`) и не используются как доказательство компетенции.

## 3. Mapping тегов и компетенций

Файлы: `mapping/it.motion.json`, `mapping/it.graphic.json`; проверка — `mapping:validate`.

| Профессия | Компетенций | direct | adjacent | none | Использовано тегов | Исключено |
|---|---:|---:|---:|---:|---:|---:|
| Motion | 19 | 9 | 5 | 5 | 45 | 51 |
| Graphic | 18 | 11 | 6 | 1 | 62 | 59 |

«none» — компетенции без Practicum/O\*NET-доказательств (переиспользованные блоки UX/UI): motion — интерактивные прототипы, Framer, FigJam, дизайн-системы, адаптивность; graphic — FigJam. Каждый собранный knowledge/skill-тег либо использован, либо исключён с причиной; «без решения» — 0.

## 4. Графы

`model/professions/views/motion.json`:

- 19 компетенций, **29 явных prerequisites** (было 14 fallback-связей), **1 компонента**, единственный корень — `ux-design-thinking`;
- tier: **6 foundation / 9 core / 4 optional**;
- `ui-framer` переведён из foundation в core (инструмент не является фундаментом) и опирается на Figma + интерактивные прототипы;
- `motion-timing-easing` поднят на order 2 как motion-специфичный фундамент; `ui-motion` опирается на тайминг и композицию; сторибординг и 3D — на тайминг/композицию/motion; handoff — на Framer и motion; доступность — на состояния и motion.

`model/professions/views/graphic.json`:

- 18 компетенций, **33 явных prerequisites** (было 13 fallback), **1 компонента**, корень — `ux-design-thinking`;
- tier: **7 foundation / 4 core / 7 optional** (без изменения состава tier);
- цепочка визуальных основ: дизайн-мышление → цвет → типографика → композиция → визуальные элементы → визуальная коммуникация;
- инструменты: Figma → FigJam/handoff/web-технологии;
- системы: композиция/элементы/типографика → дизайн-системы → компоненты → доступность;
- специализация: визуальная коммуникация/типографика/цвет → бренд-айдентика → печать → редакционная вёрстка.

Компетенции по строкам:

| # | Motion | Tier | Блок | Support | Теги |
|---:|---|---|---|---|---:|
| 1 | Дизайн-мышление | foundation | reuse | adjacent | 6 |
| 2 | Тайминг и кривые ускорения | foundation | own | direct | 2 |
| 3 | Теория цвета и колористика | foundation | reuse | direct | 3 |
| 4 | Типографика | foundation | reuse | direct | 3 |
| 5 | Композиция, сетки и визуальная иерархия | foundation | reuse | direct | 3 |
| 6 | Анимация и motion design | foundation | reuse | direct | 11 |
| 7 | Состояния и микровзаимодействия | core | reuse | adjacent | 1 |
| 8 | Визуальная коммуникация | core | reuse | direct | 5 |
| 9 | Интерактивные прототипы | core | reuse | none | 0 |
| 10 | Figma: компоненты и автолейаут | core | reuse | direct | 1 |
| 11 | Framer: интерактивные прототипы | core | reuse | none | 0 |
| 12 | Передача макетов в разработку | core | reuse | adjacent | 3 |
| 13 | FigJam: воркшопы и картирование | optional | reuse | none | 0 |
| 14 | Дизайн-системы и токены | optional | reuse | none | 0 |
| 15 | Доступность и инклюзивный дизайн | core | reuse | adjacent | 1 |
| 16 | Адаптивность и responsive UI | optional | reuse | none | 0 |
| 17 | Визуализация данных | optional | reuse | adjacent | 3 |
| 18 | Сторибординг и режиссура движения | core | own | direct | 2 |
| 19 | 3D, свет и рендер | core | own | direct | 6 |

| # | Graphic | Tier | Блок | Support | Теги |
|---:|---|---|---|---|---:|
| 1 | Дизайн-мышление | foundation | reuse | direct | 8 |
| 2 | Теория цвета и колористика | foundation | reuse | direct | 4 |
| 3 | Типографика | foundation | reuse | direct | 4 |
| 4 | Композиция, сетки и визуальная иерархия | foundation | reuse | direct | 4 |
| 5 | Иконки и визуальные элементы | foundation | reuse | direct | 4 |
| 6 | Визуальная коммуникация | foundation | reuse | direct | 5 |
| 7 | Продуктовое мышление | optional | reuse | adjacent | 4 |
| 8 | Визуализация данных | optional | reuse | direct | 4 |
| 9 | Figma: компоненты и автолейаут | core | reuse | direct | 2 |
| 10 | FigJam: воркшопы и картирование | optional | reuse | none | 0 |
| 11 | Передача макетов в разработку | core | reuse | adjacent | 5 |
| 12 | Веб-технологии и ограничения реализации | optional | reuse | adjacent | 6 |
| 13 | Дизайн-системы и токены | optional | reuse | adjacent | 4 |
| 14 | Компоненты и паттерны | optional | reuse | adjacent | 2 |
| 15 | Доступность и инклюзивный дизайн | optional | reuse | adjacent | 2 |
| 16 | Бренд-айдентика | foundation | own | direct | 6 |
| 17 | Печать и производство | core | own | direct | 5 |
| 18 | Редакционный дизайн и вёрстка | core | own | direct | 4 |

Собственные accepted-блоки: motion — тайминг, сторибординг, 3D; graphic — бренд-айдентика, печать, редакционная вёрстка (по 4 синтетических тега без `sourceRefs`). Остальные компетенции — переиспользованные блоки UX/UI, теперь связанные через `canonicalIds`.

## 5. Priority/order слой

Отдельные `priority/motion.json` и `priority/graphic.json` не вводятся — действует то же решение, что и для Product (`COS-RES-020`, §5):

- источник истины — `model/professions/views/<profession>.json`;
- проекция — `model/profession-competencies/<profession>.json` (prerequisites сохраняются);
- `model:validate` проверяет существование prerequisites, порядок, циклы и `--require-blocks`;
- UX/UI `priority/uxui.json` не затрагивается.

## 6. Материалы

Очередь материалов теперь строится по view (`COS-RES-017`, 1.1.0), поэтому покрывает все компетенции:

| Профессия | Элементов | completed | failed | Материалов | Связей | Покрытие компетенций | Стоимость |
|---|---:|---:|---:|---:|---:|---|---:|
| Motion | 20 | 20 | 0 | 38 | 20 | **19/19** | $0.0055 |
| Graphic | 20 | 20 | 0 | 39 | 22 | **18/18** | $0.0020 |

Review: `data/materials-agent/it-motion-review.md`, `data/materials-agent/it-graphic-review.md`. `catalog.materials` = 0 — материалы не приняты, нужен human-review.

## 7. Команды

```bash
npm run typecheck && npm test
npm run model:validate -- --domain it --profession motion --all --require-blocks
npm run mapping:validate -- --domain it --profession motion --report
npm run mapping:validate -- --domain it --profession graphic --report
npm run professions:collect -- --domain it --profession motion
npm run tags:collect -- --domain it --profession motion
npm run materials:agent:queue -- --domain it --profession motion --per-competency 1 \
  --sources wikipedia,habr,medium --concurrency 3 --retry 2 --classify --budget-usd 0.10 --max-calls 80
npm run materials:agent:review -- --domain it --profession motion
npm run canvas:profession-network -- --profession motion
npm run canvas:profession -- --profession motion
npm run canvas:tabs
```

## 8. Ограничения и открытые задачи

1. Human-review mapping Motion/Graphic и привязка реальных Practicum-тегов к accepted-блокам (сейчас теги 6 собственных блоков синтетические).
2. Human-review журналов материалов и приёмка в `catalog.materials` — только после проверки.
3. Motion/Graphic mapping содержит «none»-компетенции и исключённые темы (проекты, инструменты, карьерные модули) — это нормальный черновик, а не финальная онтология.
4. ESCO в текущем окружении недоступен (прокси/HTML); сборка через O\*NET/Практикум без обхода.
5. Knowledge graph не строится (отложен).

## 9. История изменений

| Версия | Дата | Что изменилось |
|---|---|---|
| 1.0.0 | 2026-10-25 | Motion/Graphic: Practicum-источники и санитайзер тегов, mapping 19/18 компетенций, связные графы 29/33 связи, материалы 19/19 и 18/18 покрытия |
