---
id: COS-EAR-004
title: Information Architecture
version: 1.1.0
status: Draft
owner: Competency Operating System Team
last_updated: 2026-10-28
references:
  - COS-EAR-005
  - COS-EAR-008
  - COS-EAR-011
  - COS-EAR-012
  - COS-BP-005
  - COS-BP-007
  - COS-BP-009
---

# COS-EAR-004 — Information Architecture

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

**Beta 1 boundary for this document.** Beta 1 information architecture is content-centric: profession → section → competency → knowledge/skills/materials. The only identity objects are the account, favourites and study statuses. Profile-centric architecture is stages VII and `COS-BP-007` §7.1 stage 1; the Organization and Intelligence spaces exist only as concepts.

## Русский

**Документ описывает целевой опыт, а не текущий продукт.** COS, описанный здесь, предполагает собранную базу компетенций, диагностику и цифровой профиль компетенций; в Beta ничего из этого нет.

- **Что работает сегодня (Beta 1, 2026-10-28):** карта компетенций — профессии, компетенции, знания и навыки, внешние учебные материалы, вход по email, избранное, самоотметки статусов изучения, обратная связь и first-party аналитика. Реализованные сценарии — `COS-EAR-012`.
- **Чего в продукте нет:** диагностики, оценки уровня, микро-кейсов, паспорта компетенций, персональных маршрутов и ИИ в runtime (`COS-REL-008`, ADR-001). Целевой сценарий диагностики — `COS-EAR-009`.
- **Дорожная карта:** этап I `COS-BP-005` (публичная Beta) в работе; документ описывает целевое состояние этапов VII–IX. Этапы монетизации — `COS-BP-007` §7.1; операционный план первого года — `COS-BP-009`.
- **Термины:** «профиль компетенций» и «прогресс» — самоотметки; «паспорт компетенций» закреплён за результатом отложенной диагностики (`COS-BP-007` §7.2).

**Граница Beta 1 для этого документа.** Информационная архитектура Beta 1 контент-центрична: профессия → раздел → компетенция → знания/навыки/материалы. Единственные объекты «личности» — аккаунт, избранное и статусы изучения. Профиль-центричная архитектура — этапы VII и 1 `COS-BP-007` §7.1; пространства организации и интеллектуальной аналитики существуют только как концепты.

---
# Purpose / Назначение

## English

This document defines how information is organized within the Competency Operating System (COS).

Information Architecture transforms the business domain into a coherent information space that allows every user to understand their current state, navigate the platform with confidence, and make informed decisions about professional development.

It defines *what information exists*, *how it is structured*, and *how users access it*. It does not define navigation, user flows, or interface layouts.

## Русский

Настоящий документ определяет принципы организации информации в Competency Operating System (COS).

Информационная архитектура преобразует бизнес-домен в целостное информационное пространство, позволяющее пользователю понимать свое текущее состояние, уверенно ориентироваться в системе и принимать решения о своем профессиональном развитии.

Документ определяет, *какая информация существует*, *как она организована* и *как пользователь получает к ней доступ*. Он не описывает навигацию, пользовательские сценарии или структуру экранов — экранная композиция зафиксирована в `COS-EAR-008`.

---

# Information Architecture Vision / Видение информационной архитектуры

## English

The information architecture of COS is **profile-centric**, not content-centric.

Traditional learning platforms organize information around courses, lessons, and catalogs. COS organizes information around the individual.

The Digital Competency Profile is the central information object of the platform. Every other information entity either contributes to, derives from, or supports the continuous evolution of that profile.

## Русский

Информационная архитектура COS является **профиль-центричной**, а не контент-центричной.

Традиционные образовательные платформы организуют информацию вокруг курсов, уроков и каталогов. COS организует информацию вокруг человека.

Цифровой профиль компетенций является центральным информационным объектом платформы. Все остальные сущности либо формируют его, либо используют его, либо помогают его развитию.

---

# Central Information Model / Центральная информационная модель

```text
                         User
                           │
                           ▼
            Digital Competency Profile
                           │
      ┌────────────┬────────────┬────────────┐
      ▼            ▼            ▼
 Competencies   Goals      Behavioral Data
      │            │            │
      └────────────┴────────────┘
                   │
                   ▼
        Adaptive Development Route
                   │
      ┌────────────┼────────────┐
      ▼            ▼            ▼
 Knowledge     Learning     Assessment
   Graph       Activities     Results
      │            │            │
      └────────────┴────────────┘
                   │
                   ▼
          Updated Competency Profile
```

## English

The profile continuously evolves as new evidence is collected, assessed, and incorporated into the user's competency model.

## Русский

Профиль непрерывно развивается по мере появления новых доказательств, результатов оценки и профессиональной деятельности пользователя.

---

# Information Spaces / Информационные пространства

## 1. Identity Space / Пространство личности

Contains information describing the individual.

Содержит информацию, описывающую человека.

- User
- Digital Competency Profile
- Goals
- Interests
- Preferences
- Behavioral Characteristics

## 2. Knowledge Space / Пространство знаний

Contains the knowledge graph and educational assets.

Содержит граф знаний и образовательные ресурсы.

- Knowledge Graph
- Competencies
- Skills
- Learning Resources
- Assessments
- Evidence

## 3. Journey Space / Пространство развития

Represents the user's adaptive development journey.

Описывает персональный маршрут развития пользователя.

- Current Position
- Target Role
- Development Route
- Recommendations
- Milestones
- Achievements

## 4. Organization Space / Пространство организации

Supports organizational competency development.

Поддерживает развитие компетенций на уровне организации.

- Company
- Departments
- Teams
- Roles
- Employees
- Methodologists
- KPIs
- Mandatory Certifications

## 5. Intelligence Space / Пространство интеллектуальной аналитики

Contains system-generated insights.

Содержит результаты интеллектуальной обработки данных.

- Analytics
- Skill Gap Analysis
- Predictions
- Recommendations
- Opportunities
- Risks

---

# Information Design Principles / Принципы информационной архитектуры

## English

- The profile is the primary entry point to the system.
- Information should answer the four questions defined in the Mental Model.
- Content is contextual, not central.
- Every information object should contribute to competency development.
- Complex relationships should remain invisible unless they help decision-making.
- Information should evolve together with the user.

## Русский

- Профиль пользователя является главной точкой входа в систему.
- Информация должна помогать отвечать на четыре вопроса Mental Model.
- Контент является средством развития, а не центром системы.
- Каждый информационный объект должен поддерживать развитие компетенций.
- Сложные взаимосвязи скрываются до тех пор, пока они не помогают принять решение.
- Информационная модель развивается вместе с пользователем.

Как эти принципы выражаются в наполнении секций — какой контент подставляется, по какому правилу и что остаётся слотом — описано в `COS-EAR-011`.

---

# Summary / Итог

## English

The Competency Operating System organizes information around people rather than educational content. The Digital Competency Profile serves as the core of the information architecture, while knowledge, development activities, organizational structures, and AI-generated insights continuously enrich and refine that profile.

## Русский

Competency Operating System организует информацию вокруг человека, а не вокруг образовательного контента. Центральным элементом информационной архитектуры является цифровой профиль компетенций, который непрерывно развивается благодаря знаниям, практической деятельности, оценке, организационным данным и интеллектуальной аналитике.

---

# История изменений / Change History

| Версия | Дата | Что изменилось |
|---|---|---|
| 1.0.0 | — | Первая редакция; дата в документе не фиксировалась |
| 1.1.0 | 2026-10-28 | Добавлен раздел «Состояние и место в дорожной карте»: граница между целевым опытом и Beta 1, этапы `COS-BP-005`, план первого года `COS-BP-009`, терминологическая граница `COS-BP-007`; добавлен frontmatter по `COS-010` |
