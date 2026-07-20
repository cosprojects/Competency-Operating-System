

# COS-EAR-004 — Information Architecture

**Status:** Draft  
**Owner:** Competency Operating System Team  
**Stage:** Experience Architecture  
**Version:** 1.0

---

# Purpose / Назначение

## English

This document defines how information is organized within the Competency Operating System (COS).

Information Architecture transforms the business domain into a coherent information space that allows every user to understand their current state, navigate the platform with confidence, and make informed decisions about professional development.

It defines *what information exists*, *how it is structured*, and *how users access it*. It does not define navigation, user flows, or interface layouts.

## Русский

Настоящий документ определяет принципы организации информации в Competency Operating System (COS).

Информационная архитектура преобразует бизнес-домен в целостное информационное пространство, позволяющее пользователю понимать свое текущее состояние, уверенно ориентироваться в системе и принимать решения о своем профессиональном развитии.

Документ определяет, *какая информация существует*, *как она организована* и *как пользователь получает к ней доступ*. Он не описывает навигацию, пользовательские сценарии или структуру экранов.

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

---

# Summary / Итог

## English

The Competency Operating System organizes information around people rather than educational content. The Digital Competency Profile serves as the core of the information architecture, while knowledge, development activities, organizational structures, and AI-generated insights continuously enrich and refine that profile.

## Русский

Competency Operating System организует информацию вокруг человека, а не вокруг образовательного контента. Центральным элементом информационной архитектуры является цифровой профиль компетенций, который непрерывно развивается благодаря знаниям, практической деятельности, оценке, организационным данным и интеллектуальной аналитике.