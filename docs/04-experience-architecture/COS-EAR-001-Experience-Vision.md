---
id: COS-EAR-001
title: Experience Architecture Vision
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
  - COS-REL-008
  - COS-BP-009
---

# COS-EAR-001 — Experience Architecture Vision

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

**Beta 1 boundary for this document.** The vision of COS as a personal operating system for professional growth is not delivered in Beta 1. The current product gives orientation inside a profession and its materials; the first real steps toward this vision are the personal space (`COS-BP-005` stage IV) and the self-tracked profile (`COS-BP-007` §7.1 stage 1).

## Русский

**Документ описывает целевой опыт, а не текущий продукт.** COS, описанный здесь, предполагает собранную базу компетенций, диагностику и цифровой профиль компетенций; в Beta ничего из этого нет.

- **Что работает сегодня (Beta 1, 2026-10-28):** карта компетенций — профессии, компетенции, знания и навыки, внешние учебные материалы, вход по email, избранное, самоотметки статусов изучения, обратная связь и first-party аналитика. Реализованные сценарии — `COS-EAR-012`.
- **Чего в продукте нет:** диагностики, оценки уровня, микро-кейсов, паспорта компетенций, персональных маршрутов и ИИ в runtime (`COS-REL-008`, ADR-001). Целевой сценарий диагностики — `COS-EAR-009`.
- **Дорожная карта:** этап I `COS-BP-005` (публичная Beta) в работе; документ описывает целевое состояние этапов VII–IX. Этапы монетизации — `COS-BP-007` §7.1; операционный план первого года — `COS-BP-009`.
- **Термины:** «профиль компетенций» и «прогресс» — самоотметки; «паспорт компетенций» закреплён за результатом отложенной диагностики (`COS-BP-007` §7.2).

**Граница Beta 1 для этого документа.** Видение COS как персональной операционной системы профессионального развития в Beta 1 не реализовано. Сегодня продукт даёт ориентацию внутри профессии и её материалов; первые реальные шаги к этому видению — личное пространство (этап IV `COS-BP-005`) и self-tracked профиль (этап 1 `COS-BP-007` §7.1).

---
# Purpose / Назначение

## English

This document defines the vision of the user experience within the Competency Operating System (COS).

Experience Architecture translates the business architecture into meaningful interactions between people and the platform. It defines how users perceive, navigate, and accomplish competency development regardless of interface or device.

## Русский

Настоящий документ определяет видение пользовательского опыта Competency Operating System (COS).

Experience Architecture преобразует бизнес-архитектуру в понятный и последовательный пользовательский опыт. Она определяет, каким образом человек воспринимает платформу, ориентируется в ней и достигает своих целей развития независимо от конкретного интерфейса или устройства.

---

# Scope / Область действия

## English

This document establishes the principles governing the overall experience of COS.

It does not define user flows, screens, visual design, UI components, or interaction specifications. Those are described in subsequent Experience Architecture and UI documents.

## Русский

Документ определяет принципы построения общего пользовательского опыта COS.

Он не описывает пользовательские сценарии, экраны, визуальный дизайн, компоненты интерфейса или спецификации взаимодействия. Эти вопросы рассматриваются в последующих документах Experience Architecture и UI.

---

# Experience Vision / Видение пользовательского опыта

## English

COS is not experienced as a learning platform. It is experienced as a personal operating system for professional growth.

Every interaction should reinforce a single mental model: the user is continuously developing competencies, while the platform provides clarity, guidance, evidence, and adaptive recommendations.

The experience must reduce uncertainty, support informed decisions, and help users understand both their current state and their next meaningful step.

## Русский

COS должен восприниматься не как образовательная платформа, а как персональная операционная система профессионального развития.

Каждое взаимодействие должно усиливать единую ментальную модель: человек непрерывно развивает свои компетенции, а платформа помогает понимать текущее состояние, фиксировать доказательства развития и выбирать следующий наиболее ценный шаг.

Пользовательский опыт должен снижать неопределенность, помогать принимать решения и обеспечивать ощущение непрерывного прогресса.

---

# Guiding Principles / Основные принципы

## English

- Development is more important than learning.
- Every action should have visible value.
- Complexity belongs to the system, not the user.
- Progress should always be understandable.
- Recommendations should be explainable.
- Evidence should build trust.
- The experience should remain consistent across all touchpoints.

## Русский

- Развитие важнее обучения.
- Каждое действие должно иметь понятную ценность.
- Сложность должна оставаться внутри системы, а не ложиться на пользователя.
- Прогресс должен быть понятным и измеримым.
- Любая рекомендация должна быть объяснимой.
- Доказательства должны формировать доверие.
- Пользовательский опыт должен быть единым во всех точках взаимодействия.

---

> **Note / Примечание**
>
> This document establishes the vision for Experience Architecture. User journeys, interaction patterns, navigation, information architecture, and interface design are specified in subsequent documents.
>
> Настоящий документ определяет только видение Experience Architecture. Пользовательские сценарии, паттерны взаимодействия, навигация, информационная архитектура и дизайн интерфейсов описываются в последующих документах.

---

# История изменений / Change History

| Версия | Дата | Что изменилось |
|---|---|---|
| 1.0.0 | — | Первая редакция; дата в документе не фиксировалась |
| 1.1.0 | 2026-10-28 | Добавлен раздел «Состояние и место в дорожной карте»: граница между целевым опытом и Beta 1, этапы `COS-BP-005`, план первого года `COS-BP-009`, терминологическая граница `COS-BP-007`; добавлен frontmatter по `COS-010` |
