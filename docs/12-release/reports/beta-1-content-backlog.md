# Beta 1 — content backlog

Сгенерировано из `release:report` и используется для батчей `COS-REL-002`. Это не приёмка: каждый пункт должен быть проверен и подписан человеком.

Дата снимка: 2026-10-28. Опубликовано связей: 46/110; уникальных: 17/54.

`source_review_missing` и `source_summary_missing` есть почти у всех связей, пока не заполнен `release/beta-1-source-review.json` и не добавлены `summary`. Черновой отчёт показывает 46 опубликованных связей; строгий `release:validate` — 0, пока source gate не пройден.

## Компетенции по профессиям

### UX/UI-дизайнер

| Компетенция | Тип | Что закрыть |
|---|---|---|
| `ux-user-research` — Пользовательские исследования | core | composition, source_review_missing, source_summary_missing |
| `ux-requirements` — Анализ требований и постановка задач | core | composition, source_review_missing, source_summary_missing |
| `ux-experiments` — UX-метрики и эксперименты | optional | composition, source_review_missing, source_summary_missing |
| `ux-metrics` — Продуктовые метрики и бизнес-обоснование | core | composition, source_review_missing, source_summary_missing |
| `ux-ethics-privacy` — Этика, приватность и ограничения | optional | composition, no_source |
| `ux-analytics` — Продуктовая аналитика | core | composition, source_review_missing, source_summary_missing |
| `ui-visual-elements` — Иконки и визуальные элементы | core | composition, source_review_missing, source_summary_missing |
| `ui-visual-communication` — Визуальная коммуникация | core | composition, source_review_missing, source_summary_missing |
| `ui-design-systems` — Дизайн-системы и токены | core | composition, source_review_missing, source_summary_missing |
| `ui-responsive` — Адаптивность и responsive UI | core | composition, source_review_missing, source_summary_missing |
| `ui-accessibility` — Доступность и инклюзивный дизайн | core | composition, source_review_missing, source_summary_missing |
| `ui-motion` — Анимация и motion design | core | composition, source_review_missing, source_summary_missing |
| `ui-figjam` — FigJam: воркшопы и картирование | optional | composition, source_review_missing, source_summary_missing |
| `ui-framer` — Framer: интерактивные прототипы | optional | composition, no_source |
| `ui-handoff` — Передача макетов в разработку | core | composition, source_review_missing, source_summary_missing |
| `ui-web-technologies` — Веб-технологии и ограничения реализации | optional | composition, source_review_missing, source_summary_missing |
| `ui-data-visualization` — Визуализация данных | optional | composition, source_review_missing, source_summary_missing |

### Продуктовый дизайнер

| Компетенция | Тип | Что закрыть |
|---|---|---|
| `ux-ethics-privacy` — Этика, приватность и ограничения | optional | composition, no_source |
| `product-jtbd` — Jobs-to-be-Done | foundation | composition, source_review_missing, source_summary_missing |
| `ux-user-research` — Пользовательские исследования | core | composition, source_review_missing, source_summary_missing |
| `product-cjm` — Customer Journey Map | core | composition, source_review_missing, source_summary_missing |
| `ux-requirements` — Анализ требований и постановка задач | core | composition, source_review_missing, source_summary_missing |
| `ux-metrics` — Продуктовые метрики и бизнес-обоснование | core | composition, source_review_missing, source_summary_missing |
| `ux-analytics` — Продуктовая аналитика | core | composition, source_review_missing, source_summary_missing |
| `ux-experiments` — UX-метрики и эксперименты | optional | composition, source_review_missing, source_summary_missing |
| `ui-data-visualization` — Визуализация данных | optional | composition, source_review_missing, source_summary_missing |
| `ui-design-systems` — Дизайн-системы и токены | core | composition, source_review_missing, source_summary_missing |
| `ui-accessibility` — Доступность и инклюзивный дизайн | core | composition, source_review_missing, source_summary_missing |
| `ui-visual-communication` — Визуальная коммуникация | core | composition, source_review_missing, source_summary_missing |
| `product-strategy` — Продуктовая стратегия | foundation | composition, source_review_missing, source_summary_missing |
| `product-growth` — Рост, воронки и удержание | core | composition, no_source |
| `product-experimentation` — Эксперименты и проверка гипотез | core | composition, source_review_missing, source_summary_missing |

### Моушн-дизайнер

| Компетенция | Тип | Что закрыть |
|---|---|---|
| `motion-animation-principles` — Принципы анимации | foundation | composition, source_review_missing, source_summary_missing |
| `motion-timing-easing` — Тайминг и кривые ускорения | foundation | composition, source_review_missing, source_summary_missing |
| `motion-styleframes` — Style frames и арт-дирекшн | foundation | composition, source_review_missing, source_summary_missing |
| `ui-motion` — Анимация и motion design | core | composition, source_review_missing, source_summary_missing |
| `ui-visual-communication` — Визуальная коммуникация | core | composition, source_review_missing, source_summary_missing |
| `motion-editing` — Монтаж и ритм | core | composition, source_review_missing, source_summary_missing |
| `motion-sound-design` — Звуковой дизайн и синхронизация | core | composition, source_review_missing, source_summary_missing |
| `motion-3d-animation` — 3D-анимация и риггинг | core | composition, source_review_missing, source_summary_missing |
| `motion-3d-rendering` — 3D, свет и рендер | core | composition, source_review_missing, source_summary_missing |
| `motion-compositing` — Композитинг и VFX | core | composition, source_review_missing, source_summary_missing |
| `motion-brand-systems` — Motion-айдентика и бренд-системы | core | composition, source_review_missing, source_summary_missing |
| `motion-toolchain` — Моушн-инструментарий | core | composition, source_review_missing, source_summary_missing |
| `motion-production` — Продакшн и пайплайн | core | composition, source_review_missing, source_summary_missing |
| `motion-showreel` — Showreel и портфолио | optional | composition, source_review_missing, source_summary_missing |
| `ui-framer` — Framer: интерактивные прототипы | optional | composition, no_source |
| `ui-handoff` — Передача макетов в разработку | core | composition, source_review_missing, source_summary_missing |
| `ui-figjam` — FigJam: воркшопы и картирование | optional | composition, source_review_missing, source_summary_missing |
| `ui-design-systems` — Дизайн-системы и токены | core | composition, source_review_missing, source_summary_missing |
| `ui-accessibility` — Доступность и инклюзивный дизайн | core | composition, source_review_missing, source_summary_missing |
| `ui-responsive` — Адаптивность и responsive UI | core | composition, source_review_missing, source_summary_missing |
| `ui-data-visualization` — Визуализация данных | optional | composition, source_review_missing, source_summary_missing |

### Графический дизайнер

| Компетенция | Тип | Что закрыть |
|---|---|---|
| `ui-visual-elements` — Иконки и визуальные элементы | core | composition, source_review_missing, source_summary_missing |
| `ui-visual-communication` — Визуальная коммуникация | core | composition, source_review_missing, source_summary_missing |
| `ui-data-visualization` — Визуализация данных | optional | composition, source_review_missing, source_summary_missing |
| `ui-figjam` — FigJam: воркшопы и картирование | optional | composition, source_review_missing, source_summary_missing |
| `ui-handoff` — Передача макетов в разработку | core | composition, source_review_missing, source_summary_missing |
| `ui-web-technologies` — Веб-технологии и ограничения реализации | optional | composition, source_review_missing, source_summary_missing |
| `ui-design-systems` — Дизайн-системы и токены | core | composition, source_review_missing, source_summary_missing |
| `ui-accessibility` — Доступность и инклюзивный дизайн | core | composition, source_review_missing, source_summary_missing |
| `graphic-brand-identity` — Бренд-айдентика | foundation | composition, source_review_missing, source_summary_missing |
| `graphic-print-production` — Печать и производство | core | composition, source_review_missing, source_summary_missing |
| `graphic-editorial-layout` — Редакционный дизайн и вёрстка | core | composition, source_review_missing, source_summary_missing |

## Источники, используемые четырьмя профессиями

| Источник | Тип | Authority | Summary | Компетенций |
|---|---|---|---|---:|
| Яндекс Практикум — каталог дизайна | course-platform | primary | нет | 15 |
| School of Motion | school | primary | нет | 12 |
| Coursera — Microsoft Product Design and UX/UI Fundamentals | course-platform | secondary | нет | 12 |
| Motion Design School — курсы | school | primary | нет | 11 |
| Coursera — UX/UI Design Fundamentals | course-platform | secondary | нет | 10 |
| Great Learning — Free UI/UX course | course-platform | secondary | нет | 10 |
| Figma — Design Basics | reference | primary | нет | 10 |
| Udacity — Product Design | course-platform | secondary | нет | 7 |
| Codecademy — Introduction to UI/UX | course-platform | secondary | нет | 6 |
| Coursera — Fundamentals of Graphic Design | course-platform | secondary | нет | 5 |
| Яндекс Практикум — UX-исследования для дизайнеров | course-platform | primary | нет | 4 |
| Alison — Graphic Design | course-platform | secondary | нет | 4 |
| Motion Design School — YouTube | video-channel | primary | нет | 3 |
| UX Design Institute — Free UX Design Course | course-platform | secondary | нет | 2 |
| Яндекс Практикум — дизайн мобильных приложений | course-platform | primary | нет | 2 |
| School of Motion — бесплатные материалы | school | primary | нет | 2 |
| Coursera — Design Fundamentals with AI | course-platform | secondary | нет | 1 |
| Scrimba — Intro to UI Design Fundamentals | course-platform | secondary | нет | 1 |
| Great Learning — Intro to Graphic Design with Photoshop | course-platform | secondary | нет | 1 |
| What Is Motion Design School — Petrick | portfolio-case | secondary | нет | 1 |
| Coursera — Free Web Design courses | course-platform | secondary | нет | 1 |
| Яндекс Практикум — веб-дизайнер | course-platform | primary | нет | 1 |
| Alison — Web Design with HTML | course-platform | secondary | нет | 1 |
| Яндекс Практикум — презентации с ИИ | course-platform | primary | нет | 1 |
| Яндекс Практикум — 3D-дженералист | course-platform | primary | нет | 1 |
| Motion Design School — Vimeo | video-channel | primary | нет | 1 |

## Пробелы без источника

- product-growth — Рост, воронки и удержание
- ui-framer — Framer: интерактивные прототипы
- ux-ethics-privacy — Этика, приватность и ограничения

## Порядок работы

1. Батч 1: Product 5 + Graphic 3 + UX/UI `ui-figjam`, источники `ux-ethics-privacy`, `ui-framer`.
2. Батч 2–3: Motion 12.
3. Батч 4: компетенции только со знаниями/только с навыками.
4. Батч 5: 26 source review + summaries; затем `release:validate`.
