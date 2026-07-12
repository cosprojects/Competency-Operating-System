# COS-DDD-008 — Domain Services

**Status:** Reviewed  
**Version:** 0.1  
**Iteration:** Domain-Driven Design  
**Owner:** Competency Operating System (COS)  
**Last Updated:** 2026-07-05

---

# Purpose (EN)

This document defines the Domain Services of the Competency Operating System (COS).

Domain Services encapsulate business decisions that cannot be assigned to a single Aggregate.

A Domain Service coordinates multiple parts of the domain while preserving business consistency.

---

# Назначение (RU)

Документ определяет доменные сервисы (Domain Services) платформы Competency Operating System (COS).

Доменные сервисы инкапсулируют бизнес-решения, которые невозможно отнести к одному агрегату.

Domain Service координирует несколько частей предметной области, сохраняя согласованность бизнес-модели.

---

# Scope (EN)

This document defines:

- Domain Services;
- business responsibilities;
- participating aggregates;
- published Domain Events;
- business decisions.

This document intentionally excludes:

- Application Services;
- APIs;
- infrastructure;
- implementation.

---

# Область документа (RU)

Документ определяет:

- доменные сервисы;
- бизнес-ответственность;
- используемые агрегаты;
- публикуемые доменные события;
- принимаемые бизнес-решения.

Документ не рассматривает:

- прикладные сервисы;
- API;
- инфраструктуру;
- реализацию.

---

# Domain Service Principles (EN)

A Domain Service exists when a business decision requires knowledge that belongs to multiple Aggregates.

Domain Services coordinate business behavior but never own business state.

---

# Принципы Domain Services (RU)

Domain Service появляется тогда, когда бизнес-решение требует знаний сразу нескольких агрегатов.

Доменные сервисы координируют поведение предметной области, но не владеют ее состоянием.

---

# Domain Services

## Service 1

### Service

Adaptive Development Service

---

### Purpose (EN)

Creates and continuously adjusts personalized development strategies.

---

### Назначение (RU)

Формирует и постоянно корректирует персональную стратегию развития.

---

### Uses

- Development Profile
- Development Goal
- Competency
- Methodology
- Evidence

---

### Publishes

- Development Path Changed

---

### Business Decisions

- determines the optimal development strategy;
- recalculates the development path after significant state changes;
- prioritizes competencies for future development.

---

## Service 2

### Service

Competency Evaluation Service

---

### Purpose (EN)

Determines changes in competency state based on available evidence and assessment results.

---

### Назначение (RU)

Определяет изменение состояния компетенций на основе результатов оценки и подтвержденных доказательств.

---

### Uses

- Assessment
- Evidence
- Development Profile

---

### Publishes

- Competency State Changed

---

### Business Decisions

- evaluates competency maturity;
- identifies competency growth;
- identifies competency degradation;
- determines competency validity.

---

## Service 3

### Service

Development Planning Service

---

### Purpose (EN)

Creates or updates an individual's Development Path.

---

### Назначение (RU)

Формирует или корректирует персональную траекторию развития.

---

### Uses

- Development Goal
- Methodology
- Development Profile

---

### Publishes

- Development Path Changed

---

### Business Decisions

- selects learning sequence;
- adapts development priorities;
- synchronizes goals with current competency state.

---

## Service 4

### Service

Evidence Validation Service

---

### Purpose (EN)

Determines whether available evidence is sufficient to support competency development.

---

### Назначение (RU)

Определяет достаточность доказательств для подтверждения развития компетенций.

---

### Uses

- Evidence
- Assessment
- Competency

---

### Publishes

- Evidence Verified

---

### Business Decisions

- validates evidence quality;
- resolves conflicting evidence;
- confirms evidence authenticity.

## Service 5

### Service

Competency Lifecycle Service

---

### Purpose (EN)

Monitors the lifecycle of competencies and determines when competency states require review, revalidation or adaptation.

The service recognizes that competencies are dynamic assets whose maturity and relevance change over time.

---

### Назначение (RU)

Отслеживает жизненный цикл компетенций и определяет моменты, когда состояние компетенций требует пересмотра, повторного подтверждения или корректировки.

Сервис рассматривает компетенции как динамические активы, уровень зрелости и актуальность которых изменяются с течением времени.

---

### Uses

- Development Profile
- Competency
- Assessment
- Evidence
- Methodology

---

### Publishes

- Competency State Changed

---

### Business Decisions

- detects competency degradation;
- identifies obsolete competencies;
- determines competency revalidation requirements;
- evaluates competency relevance;
- identifies competencies requiring maintenance.

---

## Service 6

### Service

Methodology Resolution Service

---

### Purpose (EN)

Determines the most appropriate development methodology for a specific competency development scenario.

---

### Назначение (RU)

Определяет наиболее подходящую методологию развития для конкретной ситуации развития компетенций.

---

### Uses

- Methodology
- Competency
- Development Goal

---

### Publishes

- Methodology Changed

---

### Business Decisions

- selects development methodology;
- resolves methodology conflicts;
- determines applicable competency framework.

---

## Service 7

### Service

Organization Policy Service

---

### Purpose (EN)

Applies organization-specific development policies while preserving the integrity of the core domain model.

---

### Назначение (RU)

Применяет правила конкретной организации, сохраняя целостность основной предметной модели.

---

### Uses

- Organization
- Development Profile
- Methodology

---

### Publishes

- Organization Policy Changed

---

### Business Decisions

- applies organization competency policies;
- validates mandatory competency requirements;
- resolves organization-specific development constraints.

---

# Design Principles (EN)

The Domain Service model follows these principles:

- Domain Services make business decisions.
- Domain Services never own business state.
- Every service coordinates multiple Aggregates.
- Services publish business state transitions through Domain Events.
- Business rules remain inside the domain and are independent of implementation technologies.

---

# Принципы проектирования (RU)

Модель Domain Services строится по следующим принципам:

- Domain Services принимают бизнес-решения.
- Domain Services не владеют состоянием предметной области.
- Каждый сервис координирует работу нескольких агрегатов.
- Сервисы публикуют изменения состояния предметной области через Domain Events.
- Бизнес-логика остается независимой от технологий реализации.

---

# Traceability

## Foundation

- Product Vision
- Product Manifesto
- Architecture Principles

## Related DDD

- COS-DDD-005 — Domain Model
- COS-DDD-006 — Aggregates & Invariants
- COS-DDD-007 — Domain Events

## Next

- COS-DDD-009 — Business Processes

---

# Out of Scope (EN)

This document intentionally excludes:

- Application Services;
- REST APIs;
- Microservices;
- Infrastructure;
- Message Brokers;
- Technical Orchestration.

---

# Не входит в область документа (RU)

Документ намеренно не рассматривает:

- прикладные сервисы;
- REST API;
- микросервисы;
- инфраструктуру;
- брокеры сообщений;
- техническую оркестрацию.

---

# Related Documents

- Foundation Book v0.3
- COS-DDD-005 — Domain Model
- COS-DDD-006 — Aggregates & Invariants
- COS-DDD-007 — Domain Events
- COS-DDD-009 — Business Processes

---

# Decision Log

## Decision (EN)

The Competency Operating System delegates complex business decisions to Domain Services whenever those decisions require knowledge spanning multiple Aggregates.

Domain Services coordinate domain behavior while preserving Aggregate autonomy.

---

## Решение (RU)

Competency Operating System делегирует сложные бизнес-решения Domain Services в тех случаях, когда принятие решения требует использования данных сразу нескольких агрегатов.

Domain Services координируют поведение предметной области, сохраняя независимость агрегатов.

---

## Rationale (EN)

Separating decision-making from state ownership keeps the domain model cohesive, scalable and easier to evolve.

It also allows sophisticated business intelligence—such as adaptive development planning—to remain inside the domain rather than being distributed across Aggregates.

---

## Обоснование (RU)

Разделение принятия решений и хранения состояния делает предметную модель более целостной, масштабируемой и удобной для развития.

Это также позволяет сосредоточить сложную бизнес-аналитику, такую как адаптивное планирование развития, внутри предметной области, а не распределять ее между агрегатами.

---

## Consequences (EN)

Future Business Processes and Enterprise Architecture must treat Domain Services as the primary location for cross-domain business decision making.

Adaptive Development Engine is realized through one or more Domain Services rather than a single monolithic component.

---

## Последствия (RU)

При разработке Business Processes и Enterprise Architecture Domain Services должны рассматриваться как основное место принятия бизнес-решений, затрагивающих несколько агрегатов.

Adaptive Development Engine реализуется одним или несколькими Domain Services, а не одним монолитным компонентом.