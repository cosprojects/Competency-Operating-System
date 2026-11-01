---
id: COS-EAR-003
title: Experience Principles
version: 1.1.0
status: Draft
owner: Competency Operating System Team
last_updated: 2026-10-28
references:
  - COS-EAR-002
  - COS-EAR-009
  - COS-EAR-012
  - COS-BP-005
  - COS-BP-007
  - COS-BP-009
---

# COS-EAR-003 — Experience Principles

**Status:** Draft  
**Owner:** Competency Operating System Team  
**Stage:** Experience Architecture  
**Version:** 1.1.0

---

# Status and Roadmap Position / Состояние и место в дорожной карте

## English

**This document describes the target experience, not the current product.** The COS described here assumes a completed competency base, diagnostics and a Digital Competency Profile; none of these exist in the beta.

- **Shipped today (Beta 1, 2026-10-28):** a competency map — professions, competencies, knowledge and skills, external learning materials, email sign-in, favourites, self-tracked study statuses, feedback and first-party analytics. Implemented flows: `COS-EAR-012`.
- **Not in the product:** diagnostics, level assessment, micro-cases, competency passport, personal routes and runtime AI (`COS-REL-008`, ADR-001). The target diagnostics flow is `COS-EAR-009`.
- **Roadmap:** stage I of `COS-BP-005` (public beta) is in progress; this document describes the target of stages VII–IX. Monetization stages — `COS-BP-007` §7.1; year-1 operational plan — `COS-BP-009`.
- **Terminology:** "competency profile" and "progress" mean self-tracked marks; "competency passport" is reserved for the deferred diagnostics result (`COS-BP-007` §7.2).

**Beta 1 boundary for this document.** The principles are not all equal in Beta 1: №1–№4 and №7 are not implemented; №5 and №6 are implemented partially, and only for content. Status by principle:

- **1 Development before learning** — not implemented: the beta deliberately starts with the learning-material layer.
- **2 Show the current position** — not implemented: there is no assessment or profile.
- **3 Make the next step obvious** — not implemented: there are no recommendations.
- **4 Explain recommendations** — not applicable: there are no recommendations yet.
- **5 Evidence builds trust** — partially: every material shows authority, `lastChecked` and rationale, so content claims are verifiable; there is no evidence about the user.
- **6 Hide complexity** — partially: model and graph internals are not exposed in the base interface; graph canvases are a separate optional section.
- **7 Progress must feel continuous** — not implemented: study statuses are local marks without dynamics or milestones.

## Русский

**Документ описывает целевой опыт, а не текущий продукт.** COS, описанный здесь, предполагает собранную базу компетенций, диагностику и цифровой профиль компетенций; в Beta ничего из этого нет.

- **Что работает сегодня (Beta 1, 2026-10-28):** карта компетенций — профессии, компетенции, знания и навыки, внешние учебные материалы, вход по email, избранное, самоотметки статусов изучения, обратная связь и first-party аналитика. Реализованные сценарии — `COS-EAR-012`.
- **Чего в продукте нет:** диагностики, оценки уровня, микро-кейсов, паспорта компетенций, персональных маршрутов и ИИ в runtime (`COS-REL-008`, ADR-001). Целевой сценарий диагностики — `COS-EAR-009`.
- **Дорожная карта:** этап I `COS-BP-005` (публичная Beta) в работе; документ описывает целевое состояние этапов VII–IX. Этапы монетизации — `COS-BP-007` §7.1; операционный план первого года — `COS-BP-009`.
- **Термины:** «профиль компетенций» и «прогресс» — самоотметки; «паспорт компетенций» закреплён за результатом отложенной диагностики (`COS-BP-007` §7.2).

**Граница Beta 1 для этого документа.** Принципы в Beta 1 реализованы неравномерно: №1–№4 и №7 не реализованы; №5 и №6 реализованы частично и только для контента. Статус по принципам:

- **1. Развитие важнее обучения** — не реализовано: Beta сознательно начинает со слоя учебных материалов.
- **2. Показывай текущее положение** — не реализовано: нет оценки и профиля.
- **3. Следующий шаг должен быть очевиден** — не реализовано: рекомендаций нет.
- **4. Объясняй рекомендации** — неприменимо: рекомендаций пока нет.
- **5. Доказательства создают доверие** — частично: у каждого материала показаны авторитетность, дата проверки и rationale, поэтому утверждения о контенте проверяемы; доказательств о пользователе нет.
- **6. Скрывай сложность** — частично: внутренности модели и графа в базовом интерфейсе не показаны; граф-канвасы — отдельный необязательный раздел.
- **7. Развитие должно ощущаться непрерывным** — не реализовано: статусы изучения — локальные отметки без динамики и вех.

---
# Purpose / Назначение

## English

This document defines the principles that govern every user experience decision within the Competency Operating System (COS).

Experience Principles translate the Mental Model into practical design guidance. They establish immutable rules that every product, feature, interface, workflow, and AI interaction must follow.

## Русский

Настоящий документ определяет принципы, которыми должны руководствоваться все решения в области пользовательского опыта Competency Operating System (COS).

Experience Principles переводят Mental Model в практические правила проектирования. Эти принципы являются обязательными для всех продуктов, функций, интерфейсов, пользовательских сценариев и AI-взаимодействий.

---

# Core Principle / Главный принцип

## English

Every experience should reinforce one perception:

> **COS is my navigator for professional development.**

If a design decision weakens this perception, it should be reconsidered.

## Русский

Каждое взаимодействие должно усиливать одно восприятие:

> **COS — это навигатор моего профессионального развития.**

Если проектное решение ослабляет это ощущение, его необходимо пересмотреть.

---

# Experience Principles / Принципы пользовательского опыта

## 1. Development Before Learning / Развитие важнее обучения

Learning is only one possible way to develop competencies. The experience must always focus on growth, not on consuming educational content.

Обучение — лишь один из способов развития компетенций. Пользовательский опыт всегда должен быть ориентирован на развитие, а не на прохождение учебного контента.

## 2. Show the Current Position / Показывай текущее положение

Users should always understand where they are in their professional journey and what their current competency profile represents.

Пользователь всегда должен понимать, где он находится на своем пути развития и что означает его текущий профиль компетенций.

## 3. Make the Next Step Obvious / Следующий шаг должен быть очевиден

Every screen should help users identify the most valuable next action.

Каждый экран должен помогать определить наиболее ценный следующий шаг.

## 4. Explain Recommendations / Объясняй рекомендации

Recommendations should never appear as unexplained AI decisions. Users should understand why a recommendation exists.

Любая рекомендация должна быть понятной. Пользователь должен понимать, почему система предлагает именно это действие.

## 5. Evidence Builds Trust / Доказательства создают доверие

Progress should always be supported by observable evidence rather than assumptions.

Любой прогресс должен подтверждаться наблюдаемыми доказательствами, а не предположениями.

## 6. Hide Complexity / Скрывай сложность

Complex models, adaptive algorithms, competency graphs, and internal calculations belong to the system, not to the user experience.

Сложные модели, адаптивные алгоритмы, графы компетенций и внутренние вычисления должны оставаться внутри системы, а не становиться частью пользовательского опыта.

## 7. Progress Must Feel Continuous / Развитие должно ощущаться непрерывным

Users should never feel that development ends after completing a course or assessment. Every achievement opens the next stage of growth.

Пользователь не должен ощущать, что развитие заканчивается после курса или оценки. Любое достижение становится отправной точкой для следующего этапа роста.

---

# Design Validation / Проверка проектных решений

## English

Before approving any UX solution, ask:

- Does it help users understand where they are?
- Does it help users understand where they can go?
- Does it make the next step obvious?
- Does it strengthen trust?
- Does it reinforce the navigator mental model?

If any answer is "No", the solution should be redesigned.

## Русский

Перед утверждением любого UX-решения необходимо ответить на вопросы:

- Помогает ли оно понять текущее положение?
- Помогает ли оно увидеть следующую цель?
- Делает ли следующий шаг очевидным?
- Усиливает ли доверие пользователя?
- Поддерживает ли образ COS как навигатора развития?

Если хотя бы на один вопрос ответ отрицательный, решение требует пересмотра.

---

# История изменений / Change History

| Версия | Дата | Что изменилось |
|---|---|---|
| 1.0.0 | — | Первая редакция; дата в документе не фиксировалась |
| 1.1.0 | 2026-10-28 | Добавлен раздел «Состояние и место в дорожной карте»: граница между целевым опытом и Beta 1, этапы `COS-BP-005`, план первого года `COS-BP-009`, терминологическая граница `COS-BP-007`; добавлен frontmatter по `COS-010` |
