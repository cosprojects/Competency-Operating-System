---
id: COS-RES-021
title: Motion и Graphic — источники, mapping и связные графы
version: 1.1.0
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
| Motion | 224 (было 172) | 83 | 10 | 131 | 92 (50 Practicum) |
| Graphic | 204 (было 122) | 112 | 10 | 82 | 118 (76 Practicum) |

Инструменты остаются отдельным слоем (`kind: tool`) и не используются как доказательство компетенции.

## 3. Mapping тегов и компетенций

Файлы: `mapping/it.motion.json`, `mapping/it.graphic.json`; проверка — `mapping:validate`.

| Профессия | Компетенций | direct | adjacent | none | Использовано тегов | Исключено |
|---|---:|---:|---:|---:|---:|---:|
| Motion | 28 | 12 | 11 | 5 | 48 | 44 |
| Graphic | 18 | 11 | 6 | 1 | 62 | 54 |

«none» — компетенции без Practicum/O\*NET-доказательств (переиспользованные блоки UX/UI): motion — интерактивные прототипы, Framer, FigJam, дизайн-системы, адаптивность; graphic — FigJam. Каждый собранный knowledge/skill-тег либо использован, либо исключён с причиной; «без решения» — 0.

## 4. Графы

`model/professions/views/motion.json`:

- **28 компетенций, 42 явных prerequisites, 1 компонента**, единственный корень — `ux-design-thinking`; tier: **8 foundation / 15 core / 5 optional**;
- расширение до 28 сделано по учебным источникам (`COS-RES-022`, версия 1.5.0 хендоффа): добавлены принципы анимации, style frames, монтаж, звук, 3D-анимация, композитинг, motion-айдентика, инструментарий, продакшн и showreel; `motion-storyboarding` убран из view (остаётся в едином массиве как историческая запись);
- `motion-animation-principles` и `motion-timing-easing` — фундамент движения; `ui-motion` опирается на тайминг и композицию; 3D идёт цепочкой анимация → рендер → композитинг; продакшн опирается на инструментарий и композитинг; showreel — на продакшн и айдентику;
- `ui-framer` — core (инструмент не фундамент) и опирается на Figma + интерактивные прототипы; handoff — на Framer и motion; доступность — на состояния и motion.

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
| 2 | Принципы анимации | foundation | own | direct | 3 |
| 3 | Тайминг и кривые ускорения | foundation | own | direct | 2 |
| 4 | Style frames и арт-дирекшн | foundation | own | adjacent | 5 |
| 5 | Теория цвета и колористика | foundation | reuse | direct | 3 |
| 6 | Типографика | foundation | reuse | direct | 3 |
| 7 | Композиция, сетки и визуальная иерархия | foundation | reuse | direct | 3 |
| 8 | Анимация и motion design | foundation | reuse | direct | 11 |
| 9 | Состояния и микровзаимодействия | core | reuse | adjacent | 1 |
| 10 | Визуальная коммуникация | core | reuse | direct | 5 |
| 11 | Интерактивные прототипы | core | reuse | none | 0 |
| 12 | Монтаж и ритм | core | own | adjacent | 3 |
| 13 | Звуковой дизайн и синхронизация | core | own | direct | 1 |
| 14 | 3D-анимация и риггинг | core | own | adjacent | 3 |
| 15 | 3D, свет и рендер | core | own | direct | 6 |
| 16 | Композитинг и VFX | core | own | adjacent | 3 |
| 17 | Motion-айдентика и бренд-системы | core | own | adjacent | 3 |
| 18 | Моушн-инструментарий | core | own | direct | 6 |
| 19 | Продакшн и пайплайн | core | own | adjacent | 5 |
| 20 | Showreel и портфолио | optional | own | direct | 3 |
| 21 | Figma: компоненты и автолейаут | core | reuse | direct | 1 |
| 22 | Framer: интерактивные прототипы | core | reuse | none | 0 |
| 23 | Передача макетов в разработку | core | reuse | adjacent | 3 |
| 24 | FigJam: воркшопы и картирование | optional | reuse | none | 0 |
| 25 | Дизайн-системы и токены | optional | reuse | none | 0 |
| 26 | Доступность и инклюзивный дизайн | core | reuse | adjacent | 1 |
| 27 | Адаптивность и responsive UI | optional | reuse | none | 0 |
| 28 | Визуализация данных | optional | reuse | adjacent | 3 |

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
| Motion | 30 | 30 | 0 | 59 | 26 | **28/28** | $0.0185 |
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

1. Human-review Motion-расширения: 10 новых motion-компетенций и блоков приняты технически, но их теги синтетические; mapping 28/28 показывает, какие Practicum/O*NET-теги могут их подтвердить. Отдельно — evidence-backed предложения блоков Product (5) и Graphic (3) из seeds/Pass B (`data/competency/proposed-blocks-*.json`). Accepted-блоки не менялись.
2. Human-review журналов материалов и приёмка в `catalog.materials` — только после проверки.
3. Motion/Graphic mapping содержит «none»-компетенции и исключённые темы (проекты, инструменты, карьерные модули) — это нормальный черновик, а не финальная онтология.
4. ESCO в текущем окружении недоступен (прокси/HTML); сборка через O\*NET/Практикум без обхода.
5. Knowledge graph не строится (отложен).

## 9. История изменений

| Версия | Дата | Что изменилось |
|---|---|---|
| 1.0.0 | 2026-10-25 | Motion/Graphic: Practicum-источники и санитайзер тегов, mapping 19/18 компетенций, связные графы 29/33 связи, материалы 19/19 и 18/18 покрытия |
| 1.1.0 | 2026-10-26 | Motion расширен до 28 компетенций / 42 связей (`COS-RES-022`); mapping пересобран 28/28 (12/11/5); санитайзер Practicum-тегов исправлен (кириллические вопросы не отсекались из-за `\b`) и применён к каталоговым тегам; материалы Motion 30/59/26, покрытие 28/28 |
