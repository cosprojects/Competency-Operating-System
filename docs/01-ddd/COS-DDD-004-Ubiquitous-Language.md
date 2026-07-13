# COS-DDD-004 — Ubiquitous Language

**Status:** In Review  
**Version:** 0.1  
**Iteration:** Domain-Driven Design  
**Owner:** Competency Operating System (COS)  
**Last Updated:** 2026-13-04

Prerequisite
Foundation Domain Glossary

---

# Purpose (EN)

This document defines the Ubiquitous Language of the Competency Operating System domain model. It refines the business vocabulary introduced in the Foundation and provides precise domain semantics used by Domain-Driven Design.

Its purpose is to ensure that business experts, architects, developers, designers and AI assistants use the same terminology when discussing the platform.

Each term has a single definition and should be interpreted consistently across all project documentation.

---

# Назначение (RU)

Документ определяет Ubiquitous Language предметной области Competency Operating System. Он уточняет бизнес-термины, введенные в Foundation, и определяет их точное значение в рамках доменной модели.

Его цель — обеспечить единое понимание терминов всеми участниками проекта: экспертами предметной области, архитекторами, разработчиками, дизайнерами и ИИ-ассистентами.

Каждый термин имеет одно официальное определение и должен использоваться одинаково во всей проектной документации.

---

# Scope (EN)

This document defines:

- official business terminology;
- accepted definitions;
- ownership of terms;
- usage within the platform.

This document does not define implementation details.

---

# Область документа (RU)

Документ определяет:

- официальную терминологию предметной области;
- утвержденные определения;
- владельца каждого термина;
- область применения терминов.

Документ не рассматривает вопросы реализации.

---

# Core Terminology

| Term (EN) | Термин (RU) | Definition (EN) | Определение (RU) | Owner | Used In |
|-----------|-------------|-----------------|------------------|-------|----------|
| Competency | Компетенция | A measurable capability that can be developed and evaluated. | Измеримая способность, которую можно развивать и оценивать. | Competency Management | Entire Platform |
| Capability | Способность | A broader ability formed by one or more competencies. | Более широкая способность, формируемая одной или несколькими компетенциями. | Competency Management | Competency Model |
| Development Profile | Профиль развития | Digital representation of a person's competency state. | Цифровое представление текущего состояния развития компетенций человека. | Development Profile | Adaptive Development Engine |
| Development Path | Траектория развития | Personalized sequence of development activities. | Персонализированная последовательность действий по развитию компетенций. | Adaptive Development Engine | Learning Experience |
| Assessment | Оценка | Process of measuring competency maturity. | Процесс определения уровня развития компетенции. | Assessment | Development Profile |
| Evidence | Доказательство | Verified information confirming competency development. | Подтвержденная информация, свидетельствующая о развитии компетенции. | Evidence Management | Assessment |
| Learning Object | Образовательный объект | Any resource used to support competency development. | Любой ресурс, используемый для развития компетенций. | Learning Experience | Development Path |
| Methodology | Методология | Structured approach describing how competencies should be developed. | Формализованный подход к развитию компетенций. | Methodology | Adaptive Development Engine |
| Development Goal | Цель развития | Desired future competency state. | Желаемое состояние развития компетенций. | Development Profile | Development Planning |
| Competency Gap | Дефицит компетенции | Difference between current and target competency state. | Разница между текущим и целевым уровнем компетенции. | Adaptive Development Engine | Development Planning |
| Organization | Организация | Company or institution using the platform. | Компания или учреждение, использующее платформу. | Organization | Entire Platform |
| User | Пользователь | Person interacting with the platform. | Человек, использующий платформу. | Identity & Access | Entire Platform |
| Adaptive Development Engine | Адаптивный движок развития | Intelligent domain responsible for development recommendations. | Интеллектуальный домен, определяющий оптимальную стратегию развития. | Adaptive Development Engine | Core Domain |
| Competency Framework | Модель компетенций | Structured system describing competencies and their relationships. | Структурированная система компетенций и связей между ними. | Competency Management | Methodology |
| Development Intelligence | Интеллект развития | Analytical capability that continuously evaluates and guides competency evolution. | Аналитическая способность платформы непрерывно оценивать и направлять развитие компетенций. | Adaptive Development Engine | Core Domain |

---

# Naming Principles (EN)

- One business concept — one official term.
- One term — one definition.
- Definitions are owned by a single Bounded Context.
- New terms may only be introduced through architecture documentation.

---

# Принципы именования (RU)

- Одно бизнес-понятие — один официальный термин.
- Один термин — одно определение.
- Каждый термин имеет единственного владельца.
- Новые термины добавляются только через архитектурную документацию.

---

# Out of Scope (EN)

This document does not define:

- entities;
- aggregates;
- services;
- events;
- business rules.

---

# Не входит в область документа (RU)

Документ не определяет:

- сущности;
- агрегаты;
- сервисы;
- события;
- бизнес-правила.

---

# Related Documents

- Foundation Book v0.3
- COS-DDD-001 — Core Domain
- COS-DDD-002 — Domain Landscape
- COS-DDD-003 — Bounded Context Map
- COS-DDD-005 — Domain Model

---

# Decision Log

## Decision

The project adopts a single ubiquitous language shared across all architecture, design and implementation activities.

## Rationale

A consistent business vocabulary reduces ambiguity, improves communication and establishes a stable foundation for all subsequent Domain-Driven Design artifacts.

## Consequences

Every new domain concept introduced in future documentation must be added to this document before it is used elsewhere.