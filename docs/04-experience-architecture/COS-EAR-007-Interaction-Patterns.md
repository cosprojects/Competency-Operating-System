---
id: COS-EAR-007
title: Interaction Patterns
version: 1.1.0
status: Draft
owner: Competency Operating System Team
last_updated: 2026-10-28
references:
  - COS-EAR-006
  - COS-EAR-012
  - COS-BP-005
  - COS-REL-008
  - COS-BP-007
  - COS-BP-009
---

# COS-EAR-007 — Interaction Patterns

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

**Beta 1 boundary for this document.** Gap: none of the five canonical patterns covers the Beta 1 flows (browse the map, open a competency, collect a material). Before designing new screens, decide whether to add a canonical «Explore / Reference» pattern or to accept that Beta 1 sits outside this pattern set — otherwise the document silently stops being the rule for the current product.

## Русский

**Документ описывает целевой опыт, а не текущий продукт.** COS, описанный здесь, предполагает собранную базу компетенций, диагностику и цифровой профиль компетенций; в Beta ничего из этого нет.

- **Что работает сегодня (Beta 1, 2026-10-28):** карта компетенций — профессии, компетенции, знания и навыки, внешние учебные материалы, вход по email, избранное, самоотметки статусов изучения, обратная связь и first-party аналитика. Реализованные сценарии — `COS-EAR-012`.
- **Чего в продукте нет:** диагностики, оценки уровня, микро-кейсов, паспорта компетенций, персональных маршрутов и ИИ в runtime (`COS-REL-008`, ADR-001). Целевой сценарий диагностики — `COS-EAR-009`.
- **Дорожная карта:** этап I `COS-BP-005` (публичная Beta) в работе; документ описывает целевое состояние этапов VII–IX. Этапы монетизации — `COS-BP-007` §7.1; операционный план первого года — `COS-BP-009`.
- **Термины:** «профиль компетенций» и «прогресс» — самоотметки; «паспорт компетенций» закреплён за результатом отложенной диагностики (`COS-BP-007` §7.2).

**Граница Beta 1 для этого документа.** Пробел: ни один из пяти канонических паттернов не описывает сценарии Beta 1 (просмотр карты, открытие компетенции, сбор материала). До проектирования новых экранов нужно решить: добавить канонический паттерн «Explore / Reference» или зафиксировать, что Beta 1 лежит вне этого набора, — иначе документ молча перестаёт быть правилом для текущего продукта.

---
# Purpose / Назначение

## English

This document defines the canonical interaction patterns used throughout the Competency Operating System (COS).

Interaction Patterns describe how the platform communicates with users while supporting their development journey. They define recurring models of interaction rather than interface components or visual behavior.

Every screen, workflow, and AI-assisted experience should be composed from these canonical patterns.

## Русский

Настоящий документ определяет канонические паттерны взаимодействия Competency Operating System (COS).

Interaction Patterns описывают, каким образом платформа взаимодействует с человеком на протяжении его пути развития. Документ определяет повторяющиеся модели взаимодействия, а не компоненты интерфейса или визуальные элементы.

Каждый экран, пользовательский сценарий и AI-взаимодействие должны строиться на основе этих канонических паттернов.

---

# Relationship to Experience Architecture / Связь с Experience Architecture

## English

Interaction Patterns bridge the gap between User Journeys and interface design.

- User Journeys describe **how the user evolves**.
- Interaction Patterns describe **how COS supports that evolution**.
- UI Components describe **how interactions are presented visually**.

## Русский

Interaction Patterns являются связующим звеном между маршрутами развития пользователя и дизайном интерфейсов.

- User Journeys описывают, **как меняется человек**.
- Interaction Patterns описывают, **как COS сопровождает эти изменения**.
- UI Components определяют, **как это взаимодействие выглядит в интерфейсе**.

---

# Canonical Interaction Patterns / Канонические паттерны взаимодействия

## 1. Discover / Исследование

**Purpose**

Help users better understand themselves.

**Interaction Flow**

```text
Question
      ↓
Analysis
      ↓
Insight
      ↓
Explanation
```

The system transforms data into understandable insights.

Система преобразует данные в понятные пользователю выводы.

---

## 2. Decide / Выбор

**Purpose**

Support informed decision-making.

**Interaction Flow**

```text
Current State
      ↓
Goal
      ↓
Available Options
      ↓
Recommendation
      ↓
Decision
```

The system does not replace user decisions; it provides context and recommendations.

Система не принимает решения за пользователя, а предоставляет контекст и рекомендации.

---

## 3. Develop / Развитие

**Purpose**

Guide users through meaningful development activities.

**Interaction Flow**

```text
Knowledge
      ↓
Practice
      ↓
Reflection
      ↓
Evidence
```

Development combines learning, practice, and real-world application.

Развитие объединяет обучение, практику и применение знаний.

---

## 4. Validate / Подтверждение

**Purpose**

Transform evidence into validated competency growth.

**Interaction Flow**

```text
Evidence
      ↓
Assessment
      ↓
Feedback
      ↓
Updated Profile
```

Every meaningful achievement should strengthen the competency profile.

Каждое значимое достижение должно усиливать профиль компетенций.

---

## 5. Evolve / Эволюция

**Purpose**

Open new opportunities after meaningful progress.

**Interaction Flow**

```text
Achievement
      ↓
New Opportunity
      ↓
Updated Journey
```

Progress is never presented as the end of the process. Every achievement naturally leads to the next stage of development.

Развитие никогда не заканчивается достижением цели. Каждый результат становится началом нового этапа.

---

# Design Implications / Последствия для проектирования

## English

Every feature implemented within COS should support one or more canonical interaction patterns.

New interaction models should only be introduced when they cannot be represented by the existing patterns.

This keeps the user experience predictable, coherent, and easy to learn.

## Русский

Каждая функция COS должна реализовывать один или несколько канонических паттернов взаимодействия.

Новые модели взаимодействия допускается вводить только в случае, если существующие паттерны не позволяют корректно описать необходимый пользовательский опыт.

Такой подход обеспечивает целостность, предсказуемость и простоту взаимодействия с системой.

---

# Summary / Итог

## English

Interaction Patterns establish a consistent language of interaction between users and COS. Regardless of role or feature, the platform always supports users through the same fundamental interaction models.

## Русский

Interaction Patterns формируют единый язык взаимодействия между пользователем и COS. Независимо от роли или функциональности системы, пользователь сталкивается с одними и теми же фундаментальными моделями взаимодействия, что делает опыт целостным и понятным.

---

# История изменений / Change History

| Версия | Дата | Что изменилось |
|---|---|---|
| 1.0.0 | — | Первая редакция; дата в документе не фиксировалась |
| 1.1.0 | 2026-10-28 | Добавлен раздел «Состояние и место в дорожной карте»: граница между целевым опытом и Beta 1, этапы `COS-BP-005`, план первого года `COS-BP-009`, терминологическая граница `COS-BP-007`; добавлен frontmatter по `COS-010` |
