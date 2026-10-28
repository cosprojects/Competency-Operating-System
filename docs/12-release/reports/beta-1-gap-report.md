# Beta 1 — gap report

- Release: `beta-1`
- Manifest status: `draft`
- As of: 2026-10-28
- Source review: draft (review/summary gaps не блокируют)

## Totals

| Показатель | Значение |
|---|---:|
| Профессий | 4 |
| Связей всего | 146 |
| Связей в публикуемой части | 110 |
| Исключено связей | 36 |
| Опубликовано связей | 46 |
| Уникальных компетенций | 54 |
| Уникальных опубликованных | 17 |
| Уникальных источников | 26 |
| Пробелов | 633 |
| Блокирующих пробелов | 69 |
| Gate | FAIL |

## По профессиям

| Профессия | Связей | В публикации | Исключено | Опубликовано | Блокирующих пробелов |
|---|---:|---:|---:|---:|---:|
| UX/UI-дизайнер | 43 | 34 | 9 | 17 | 19 |
| Продуктовый дизайнер | 39 | 30 | 9 | 15 | 17 |
| Моушн-дизайнер | 37 | 28 | 9 | 7 | 22 |
| Графический дизайнер | 27 | 18 | 9 | 7 | 11 |

## Пробелы по типам

| Тип | Количество |
|---|---:|
| `source_review_missing` | 282 |
| `source_summary_missing` | 282 |
| `composition` | 64 |
| `no_source` | 5 |

## Компетенции, требующие работы

### UX/UI-дизайнер

- `ux-user-research` — Пользовательские исследования (composition, source_review_missing, source_summary_missing)
- `ux-requirements` — Анализ требований и постановка задач (composition, source_review_missing, source_summary_missing)
- `ux-experiments` — UX-метрики и эксперименты (composition, source_review_missing, source_summary_missing)
- `ux-metrics` — Продуктовые метрики и бизнес-обоснование (composition, source_review_missing, source_summary_missing)
- `ux-ethics-privacy` — Этика, приватность и ограничения (composition, no_source)
- `ux-analytics` — Продуктовая аналитика (composition, source_review_missing, source_summary_missing)
- `ui-visual-elements` — Иконки и визуальные элементы (composition, source_review_missing, source_summary_missing)
- `ui-visual-communication` — Визуальная коммуникация (composition, source_review_missing, source_summary_missing)
- `ui-design-systems` — Дизайн-системы и токены (composition, source_review_missing, source_summary_missing)
- `ui-responsive` — Адаптивность и responsive UI (composition, source_review_missing, source_summary_missing)
- `ui-accessibility` — Доступность и инклюзивный дизайн (composition, source_review_missing, source_summary_missing)
- `ui-motion` — Анимация и motion design (composition, source_review_missing, source_summary_missing)
- `ui-figjam` — FigJam: воркшопы и картирование (composition, source_review_missing, source_summary_missing)
- `ui-framer` — Framer: интерактивные прототипы (composition, no_source)
- `ui-handoff` — Передача макетов в разработку (composition, source_review_missing, source_summary_missing)
- `ui-web-technologies` — Веб-технологии и ограничения реализации (composition, source_review_missing, source_summary_missing)
- `ui-data-visualization` — Визуализация данных (composition, source_review_missing, source_summary_missing)

### Продуктовый дизайнер

- `ux-ethics-privacy` — Этика, приватность и ограничения (composition, no_source)
- `product-jtbd` — Jobs-to-be-Done (composition, source_review_missing, source_summary_missing)
- `ux-user-research` — Пользовательские исследования (composition, source_review_missing, source_summary_missing)
- `product-cjm` — Customer Journey Map (composition, source_review_missing, source_summary_missing)
- `ux-requirements` — Анализ требований и постановка задач (composition, source_review_missing, source_summary_missing)
- `ux-metrics` — Продуктовые метрики и бизнес-обоснование (composition, source_review_missing, source_summary_missing)
- `ux-analytics` — Продуктовая аналитика (composition, source_review_missing, source_summary_missing)
- `ux-experiments` — UX-метрики и эксперименты (composition, source_review_missing, source_summary_missing)
- `ui-data-visualization` — Визуализация данных (composition, source_review_missing, source_summary_missing)
- `ui-design-systems` — Дизайн-системы и токены (composition, source_review_missing, source_summary_missing)
- `ui-accessibility` — Доступность и инклюзивный дизайн (composition, source_review_missing, source_summary_missing)
- `ui-visual-communication` — Визуальная коммуникация (composition, source_review_missing, source_summary_missing)
- `product-strategy` — Продуктовая стратегия (composition, source_review_missing, source_summary_missing)
- `product-growth` — Рост, воронки и удержание (composition, no_source)
- `product-experimentation` — Эксперименты и проверка гипотез (composition, source_review_missing, source_summary_missing)

### Моушн-дизайнер

- `motion-animation-principles` — Принципы анимации (composition, source_review_missing, source_summary_missing)
- `motion-timing-easing` — Тайминг и кривые ускорения (composition, source_review_missing, source_summary_missing)
- `motion-styleframes` — Style frames и арт-дирекшн (composition, source_review_missing, source_summary_missing)
- `ui-motion` — Анимация и motion design (composition, source_review_missing, source_summary_missing)
- `ui-visual-communication` — Визуальная коммуникация (composition, source_review_missing, source_summary_missing)
- `motion-editing` — Монтаж и ритм (composition, source_review_missing, source_summary_missing)
- `motion-sound-design` — Звуковой дизайн и синхронизация (composition, source_review_missing, source_summary_missing)
- `motion-3d-animation` — 3D-анимация и риггинг (composition, source_review_missing, source_summary_missing)
- `motion-3d-rendering` — 3D, свет и рендер (composition, source_review_missing, source_summary_missing)
- `motion-compositing` — Композитинг и VFX (composition, source_review_missing, source_summary_missing)
- `motion-brand-systems` — Motion-айдентика и бренд-системы (composition, source_review_missing, source_summary_missing)
- `motion-toolchain` — Моушн-инструментарий (composition, source_review_missing, source_summary_missing)
- `motion-production` — Продакшн и пайплайн (composition, source_review_missing, source_summary_missing)
- `motion-showreel` — Showreel и портфолио (composition, source_review_missing, source_summary_missing)
- `ui-framer` — Framer: интерактивные прототипы (composition, no_source)
- `ui-handoff` — Передача макетов в разработку (composition, source_review_missing, source_summary_missing)
- `ui-figjam` — FigJam: воркшопы и картирование (composition, source_review_missing, source_summary_missing)
- `ui-design-systems` — Дизайн-системы и токены (composition, source_review_missing, source_summary_missing)
- `ui-accessibility` — Доступность и инклюзивный дизайн (composition, source_review_missing, source_summary_missing)
- `ui-responsive` — Адаптивность и responsive UI (composition, source_review_missing, source_summary_missing)
- `ui-data-visualization` — Визуализация данных (composition, source_review_missing, source_summary_missing)

### Графический дизайнер

- `ui-visual-elements` — Иконки и визуальные элементы (composition, source_review_missing, source_summary_missing)
- `ui-visual-communication` — Визуальная коммуникация (composition, source_review_missing, source_summary_missing)
- `ui-data-visualization` — Визуализация данных (composition, source_review_missing, source_summary_missing)
- `ui-figjam` — FigJam: воркшопы и картирование (composition, source_review_missing, source_summary_missing)
- `ui-handoff` — Передача макетов в разработку (composition, source_review_missing, source_summary_missing)
- `ui-web-technologies` — Веб-технологии и ограничения реализации (composition, source_review_missing, source_summary_missing)
- `ui-design-systems` — Дизайн-системы и токены (composition, source_review_missing, source_summary_missing)
- `ui-accessibility` — Доступность и инклюзивный дизайн (composition, source_review_missing, source_summary_missing)
- `graphic-brand-identity` — Бренд-айдентика (composition, source_review_missing, source_summary_missing)
- `graphic-print-production` — Печать и производство (composition, source_review_missing, source_summary_missing)
- `graphic-editorial-layout` — Редакционный дизайн и вёрстка (composition, source_review_missing, source_summary_missing)

## Исключено

- `excluded-prefix:ai-`: 36

## Что делать

1. Закрыть `no_block` и `composition` по батчам из `COS-REL-002`.
2. Добавить/заменить источники и заполнить `summary`.
3. Принять решения в `release/beta-1-source-review.json`.
4. Повторить `release:validate -- --release beta-1`.
