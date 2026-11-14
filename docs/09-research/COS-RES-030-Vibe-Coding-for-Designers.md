---
id: COS-RES-030
title: Вайб-кодинг для дизайнера — воркфлоу, компетенции и интеграция в AI-дизайнера
version: 1.1.0
status: Draft
owner: Research Team
last_updated: 2026-11-13
references:
  - COS-RES-024
  - COS-RES-025
  - COS-RES-029
  - COS-REL-009
---

# COS-RES-030 — вайб-кодинг для дизайнера

Источник — гайд «Vibe coding · 30-day roadmap» (vamshi.work, 10 экранов). Задача: разобрать воркфлоу,
соотнести с текущими компетенциями AI-дизайнера, найти инструменты и обучение и интегрировать это
в профессию — прежде всего через источники, материалы и явные границы компетенций.

## 1. Воркфлоу гайда

Гайд предлагает один сквозной маршрут: **Idea → Design → Prompt → Build → Test → Ship**, где AI пишет большую
часть кода, а дизайнер ведёт продукт, проверяет результат и принимает решения. Ключевая рамка:
«не нужно становиться разработчиком» — цель в том, чтобы дизайнер мог сам превращать идею в рабочий прототип.

## 2. Этапы, знания и навыки

| Этап гайда | Дни | Что делает дизайнер | Знания | Навыки | Инструменты |
|---|---|---|---|---|---|
| Понять vibe coding | Before Day 1 | Осознаёт рамку: AI генерирует код, дизайнер ведёт и проверяет | Что такое vibe coding; границы применимости | Ставить задачу, проверять результат, принимать решения | Figma, Lovable/v0 (промпт), GitHub |
| Основы веба | 1–3 | Понимает, из чего состоит сайт | HTML (структура), CSS (стили/адаптивность), JS (логика), компоненты, API | Читать структуру страницы и код, объяснять задачу | MDN, web.dev, javascript.info |
| Первый AI-инструмент | 4–7 | Осваивает один инструмент сборки | Возможности и ограничения инструмента | Собрать страницу по описанию, запустить, проверить | Lovable, v0, Replit, Cursor |
| Промптинг под UI | 8–10 | Формулирует требования вместо «сделай красиво» | Формула Context + Requirements + Constraints + Expected Behavior | Писать промпт с контекстом, ограничениями и ожидаемым поведением | v0/Lovable prompt box, docs |
| Figma → код | 11–15 | Переносит свой макет в рабочий UI | Как макет превращается в компоненты и стили | Сверять макет и реализацию, править расхождения, проверять адаптив | Figma (Dev Mode, Make), Cursor/v0 |
| Функциональность | 16–20 | Проектирует состояния и данные | State, формы и валидация, аутентификация, база данных, API | Собрать работающий сценарий (добавить/изменить/удалить), проверить данные | Replit, Supabase/Auth.js, Next.js |
| Отладка с AI | 21–25 | Разбирает ошибки и правит код | Ошибки в консоли, root cause, версии | Читать консоль, объяснять баг агенту, просить минимальный фикс, тестировать изменения, откатывать через Git | Chrome DevTools, Cursor, GitHub |
| Запуск продукта | 26–30 | Доводит один проект до публичной ссылки | Чек-лист готовности: адаптив, доступность, валидация, состояния, деплой | Проверить по чек-листу, задеплоить, дать ссылку | Vercel, GitHub, Lighthouse |

Инструменты гайда: **Figma, Lovable, v0, Replit, Cursor, GitHub** (плюс Vercel/деплой на этапе Ship).

## 3. Маппинг на компетенции AI-дизайнера

Профессия на 2026-11-13: 56 компетенций в 13 разделах. Покрытие по этапам:

| Этап | Компетенции AI-дизайнера | Характер покрытия |
|---|---|---|
| Idea / Design | `ux-design-thinking`, `ux-user-research`, `ux-product-thinking`, `ux-requirements`, `ux-wireframes`, `ux-user-flows`, `ui-figma` | полное: исследования, сценарии, вайрфреймы, Figma |
| Prompt | `ai-prompting`, `aidesigner-prompt-systems` | полное: структура промпта и библиотеки |
| Build | `aidesigner-ai-prototyping`, `aidesigner-ai-ui-generation`, `aidesigner-ai-development` | полное, но с разными границами (см. §4) |
| Build: агенты и контекст | `aidesigner-mcp-integration`, `aidesigner-agent-orchestration` | полное для контекста и цепочек агентов |
| Выбор инструмента | `aidesigner-tool-landscape`, `aidesigner-tool-evaluation` | полное: ландшафт и критерии выбора |
| Test / Debug | `aidesigner-quality-eval`, `aidesigner-visual-qa`, `ux-usability-testing` | полное: качество AI-результата, сверка с макетом; «отладка кода с агентом» добавлена в `aidesigner-ai-development` (2026-11-13) |
| Ship | `ui-handoff`, `aidesigner-ai-development`, `aidesigner-integration` | полное: передача в разработку плюс «Сборка и окружения» / «Доводить прототип до публичной ссылки» в `aidesigner-ai-development` (2026-11-13) |
| Сквозное | `aidesigner-technical-literacy`, `aidesigner-automation`, `ai-workflow-integration` | полное: функциональная часть (state/forms/auth/DB/API) добавлена в `aidesigner-technical-literacy` (2026-11-13) |

## 4. Соответствия, дубли и границы

1. **Прототип vs разработка.** Гайд ведёт один поток «собрал → работает → задеплоил». В модели это две
   компетенции: `aidesigner-ai-prototyping` (работающий прототип для проверки гипотез) и
   `aidesigner-ai-development` (реализация с архитектурной целостностью, версиями и предсказуемостью).
   Это не дубль, а граница: прототип можно не доводить до продакшна, а разработку — доводить. Гайд полезно
   прочитать как переход между ними; в материалах обе компетенции теперь получают общие источники по
   инструментам, но разные акценты (скорость проверки vs контроль версий и качества).
2. **Промптинг.** `ai-prompting` — общая практика, `aidesigner-prompt-systems` — библиотеки и воспроизводимость,
   а гайды Lovable/v0 дают то же самое в контексте конкретного инструмента. Это один паттерн на трёх уровнях:
   знание → система → инструментальный рецепт; материалы так и разложены.
3. **Проверка результата.** `ux-usability-testing` (пользователи), `aidesigner-quality-eval` (качество AI-результата),
   `aidesigner-visual-qa` (соответствие макету) — разные предметы, дубля нет. Но «отладка кода» из гайда
   не покрыта ни одной из них явно.
4. **Выбор инструмента.** `aidesigner-tool-landscape` (что есть) и `aidesigner-tool-evaluation` (что выбрать)
   работают на каждом этапе гайда: сначала осваиваем один инструмент, потом сравниваем и выбираем.
5. **Одинаковые пути к одному результату.** Гайд предлагает собирать UI из промпта (v0/Lovable) **и** из
   Figma-макета (Dev Mode/Cursor). В модели это две разные компетенции (`aidesigner-ai-ui-generation` и
   `aidesigner-visual-qa`/`ui-handoff`), и обе легитимны — материалы не выбирают «единственно правильный» путь.

## 5. Пробелы — закрыты (решение основателя 2026-11-13)

Основатель одобрил закрытие пробелов расширением существующих компетенций и добавлением `ui-accessibility`.

| Пробел | Что сделано |
|---|---|
| **Функциональность прототипа**: состояние, формы, аутентификация, БД, API | `aidesigner-technical-literacy`: +3 знания (State интерфейса, Формы и валидация, Аутентификация и сессии) и +2 навыка (Проверять состояния экрана, Описывать данные и доступ в задаче) |
| **Отладка AI-кода**: консоль, root cause, минимальный фикс | `aidesigner-ai-development`: +1 знание (Root cause и минимальный фикс) и +1 навык (Разбирать ошибку с агентом) |
| **Деплой и публичная ссылка** | `aidesigner-ai-development`: +1 знание (Сборка и окружения) и +1 навык (Доводить прототип до публичной ссылки) |
| **Доступность как критерий приёмки** | `ui-accessibility` добавлена в профессию (секция «Качество и валидация», core), в её блок добавлены 2 знания (WCAG и уровни соответствия; Структура страницы и семантика) и 2 навыка (Проверять доступность по чек-листу; Проверять интерфейс клавиатурой и скринридером) |

Итог по AI-дизайнеру: **57 компетенций**, 13 секций; gate PASS (293/392 связей, 131/131 опубликованных компетенций, 0 пробелов).

## 6. Интеграция: что добавлено

- **31 источник** в `learning-sources/registry.json` (`discoveryOnly`, authority secondary): инструменты
  (Replit, GitHub, Vercel) и обучающие материалы (MDN, web.dev, javascript.info, React, Next.js, Supabase,
  Auth.js, Chrome DevTools, Lighthouse, WCAG, GitHub Skills, freeCodeCamp, Lovable/v0/Cursor docs, Figma-гайды).
- **27 материалов** в каталоге после Pass E (`materials:verify`): 25 из трека + 2 по доступности
  (`web.dev — Learn Accessibility`, `W3C — How to Meet WCAG`) после добавления `ui-accessibility`;
  все приняты с бейджем «Подтвердить».
- Материалы разложены по компетенциям: `aidesigner-technical-literacy` (основы веба), `aidesigner-ai-development`
  (React, Next.js, Supabase, Auth.js, Git, деплой), `aidesigner-mcp-integration` (правила и контекст агента),
  `aidesigner-ai-prototyping` (v0, Replit, Lovable prompting), `ai-prompting` и `aidesigner-prompt-systems`
  (промпт-гайды и библиотека), `aidesigner-visual-qa` (DevTools, Lighthouse), `ui-handoff` и
  `aidesigner-design-tokens` (Figma Dev Mode и Variables).
- В пользовательском интерфейсе материалы появятся в карточках этих компетенций AI-дизайнера.

## 7. Инструменты и ссылки

| Инструмент | Продукт | Документация / обучение |
|---|---|---|
| Figma | https://www.figma.com/ | https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma · https://www.figma.com/best-practices/guide-to-developer-handoff/ |
| Lovable | https://lovable.dev/ | https://docs.lovable.dev/prompting/prompting-one · https://docs.lovable.dev/prompting/prompting-library |
| v0 | https://v0.dev/ | https://v0.dev/docs/quickstart |
| Replit | https://replit.com/ | https://docs.replit.com/ |
| Cursor | https://cursor.com/ | https://cursor.com/learn · https://docs.cursor.com/context/rules |
| GitHub | https://github.com/ | https://docs.github.com/en · https://skills.github.com/ |
| Vercel (деплой) | https://vercel.com/ | https://vercel.com/docs |

Базовые знания: MDN Learn web development, web.dev Learn HTML/CSS/Forms/Accessibility, javascript.info, React Learn,
Next.js Docs, Supabase Docs, Auth.js, Chrome DevTools, Lighthouse, WCAG Quickref, freeCodeCamp.
Контекст термина: Simon Willison «Not all AI-assisted programming is vibe coding», пост Andrej Karpathy.

## 8. Рекомендации

1. **Сейчас** (без изменения состава профессии): оставить 25 материалов и 31 источник; на карточках
   компетенций это закрывает «как это делается» — от основ веба до деплоя.
2. **Следующий шаг**: решить по четырём пробелам из §5 — расширять существующие компетенции или добавлять новые.
   Рекомендация: расширить `aidesigner-technical-literacy` и `aidesigner-ai-development` (дешевле и не ломает
   состав), а `ui-accessibility` добавить в профессию отдельно — это универсальная компетенция дизайнера.
3. **Human review**: 25 материалов приняты с бейджем «Подтвердить» (verdict `confirm`), нужен human spot-check.

## 9. История изменений

| Версия | Дата | Что изменилось |
|---|---|---|
| 1.0.0 | 2026-11-13 | Разобран гайд «Vibe coding · 30-day roadmap»: воркфлоу по 9 этапам, маппинг на 56 компетенций AI-дизайнера, дубли/границы, 4 пробела; добавлены 31 источник и 25 материалов |
| 1.1.0 | 2026-11-13 | Пробелы закрыты: расширены `aidesigner-technical-literacy` и `aidesigner-ai-development`, добавлена `ui-accessibility` (57 компетенций); +2 материала по доступности (всего 27) |
