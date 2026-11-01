---
id: COS-EAR-006
title: User Journeys
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

# COS-EAR-006 — User Journeys

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

**Beta 1 boundary for this document.** Beta 1 has no development journeys. The only repeatable loop is: choose a profession → open a competency → save it or mark a study status → return via `/saved` → open a material. The journey framework below applies once goals and a profile exist (stages VII–VIII).

## Русский

**Документ описывает целевой опыт, а не текущий продукт.** COS, описанный здесь, предполагает собранную базу компетенций, диагностику и цифровой профиль компетенций; в Beta ничего из этого нет.

- **Что работает сегодня (Beta 1, 2026-10-28):** карта компетенций — профессии, компетенции, знания и навыки, внешние учебные материалы, вход по email, избранное, самоотметки статусов изучения, обратная связь и first-party аналитика. Реализованные сценарии — `COS-EAR-012`.
- **Чего в продукте нет:** диагностики, оценки уровня, микро-кейсов, паспорта компетенций, персональных маршрутов и ИИ в runtime (`COS-REL-008`, ADR-001). Целевой сценарий диагностики — `COS-EAR-009`.
- **Дорожная карта:** этап I `COS-BP-005` (публичная Beta) в работе; документ описывает целевое состояние этапов VII–IX. Этапы монетизации — `COS-BP-007` §7.1; операционный план первого года — `COS-BP-009`.
- **Термины:** «профиль компетенций» и «прогресс» — самоотметки; «паспорт компетенций» закреплён за результатом отложенной диагностики (`COS-BP-007` §7.2).

**Граница Beta 1 для этого документа.** В Beta 1 маршрутов развития нет. Единственный повторяемый цикл: выбрать профессию → открыть компетенцию → сохранить её или поставить статус изучения → вернуться через `/saved` → открыть материал. Модель маршрутов ниже применима, когда появятся цели и профиль (этапы VII–VIII).

---
# Purpose / Назначение

## English

This document defines the high-level development journeys that users experience within the Competency Operating System (COS).

Unlike traditional User Journey Maps that describe interface interactions, this document describes how users evolve while the platform supports their professional development. Detailed role-specific journeys and interface flows are defined in subsequent UX specifications.

## Русский

Настоящий документ определяет высокоуровневые маршруты развития пользователей в Competency Operating System (COS).

В отличие от классических User Journey Map, описывающих взаимодействие с интерфейсом, данный документ описывает изменение состояния пользователя в процессе профессионального развития. Детальные сценарии для ролей и экранов определяются в последующих UX-спецификациях.

---

# Journey Framework / Модель маршрута развития

## English

Every journey within COS follows the same continuous cycle:

```text
Current State
      ↓
Self Discovery
      ↓
Goal Definition
      ↓
Development Journey
      ↓
Evidence & Validation
      ↓
Updated Competency Profile
      ↓
New Opportunities
      ↓
Next Journey
```

Development never ends. Every completed journey becomes the starting point for the next one.

## Русский

Любой маршрут развития в COS следует единому непрерывному циклу:

```text
Текущее состояние
       ↓
Самопознание
       ↓
Определение цели
       ↓
Маршрут развития
       ↓
Доказательства и подтверждение
       ↓
Обновленный профиль компетенций
       ↓
Новые возможности
       ↓
Следующий маршрут
```

Развитие не имеет конечной точки. Каждый завершенный маршрут становится началом следующего.

---

# Core Development Journeys / Основные маршруты развития

## Journey 1 — Discover Yourself / Узнай себя

The user discovers their current strengths, competencies, interests, and potential through diagnostics and profile analysis.

Пользователь получает понимание своих текущих компетенций, сильных сторон, интересов и потенциала с помощью диагностики и анализа профиля.

## Journey 2 — Define Your Direction / Определи направление

The user selects a desired professional role, competency target, or personal development objective.

Пользователь выбирает профессиональную цель, желаемую роль или направление развития.

## Journey 3 — Start Developing / Начни развитие

The platform generates a personalized development journey and recommends the most valuable first step.

Платформа формирует персональный маршрут развития и предлагает наиболее ценный первый шаг.

## Journey 4 — Grow Continuously / Развивайся непрерывно

Learning, practice, assessment, mentoring, and real-world experience continuously update the competency profile and adapt the journey.

Обучение, практика, оценка, наставничество и профессиональная деятельность непрерывно обновляют профиль компетенций и корректируют маршрут.

## Journey 5 — Achieve and Continue / Достигай и двигайся дальше

Reaching a goal expands the user's opportunities and naturally initiates the next development journey.

Достижение цели открывает новые возможности и становится отправной точкой для следующего этапа развития.

---

# Relationship to UX / Связь с UX

## English

This document defines the architecture of development journeys.

Detailed user flows, task flows, interaction sequences, wireflows, and role-specific journeys are separate UX artifacts built upon this framework.

## Русский

Настоящий документ определяет архитектуру маршрутов развития.

Детальные пользовательские сценарии, task flow, wireflow, последовательности взаимодействий и ролевые маршруты являются отдельными UX-артефактами, основанными на данной модели.

---

# Summary / Итог

## English

COS does not guide users through features. It guides them through continuous personal and professional growth.

## Русский

COS сопровождает пользователя не по функциям системы, а по пути непрерывного личного и профессионального развития.

---

# История изменений / Change History

| Версия | Дата | Что изменилось |
|---|---|---|
| 1.0.0 | — | Первая редакция; дата в документе не фиксировалась |
| 1.1.0 | 2026-10-28 | Добавлен раздел «Состояние и место в дорожной карте»: граница между целевым опытом и Beta 1, этапы `COS-BP-005`, план первого года `COS-BP-009`, терминологическая граница `COS-BP-007`; добавлен frontmatter по `COS-010` |
