# COS-DDD-006 — Aggregates & Invariants

**Status:** Reviewed 
**Version:** 0.2  
**Iteration:** Domain-Driven Design  
**Owner:** Competency Operating System (COS)  
**Last Updated:** 2026-07-04

---

# Purpose (EN)

This document defines the Aggregate Roots of the Competency Operating System (COS) and the business invariants that each aggregate is responsible for protecting.

An Aggregate represents a business consistency boundary. It ensures that critical business rules remain valid whenever the domain changes.

This document focuses exclusively on business consistency and intentionally excludes implementation details.

---

# Назначение (RU)

Документ определяет корни агрегатов (Aggregate Roots) платформы Competency Operating System (COS) и бизнес-инварианты, которые обязан защищать каждый агрегат.

Агрегат представляет собой границу согласованности предметной области. Его задача — гарантировать соблюдение критически важных бизнес-правил при любом изменении состояния предметной области.

Документ рассматривает исключительно вопросы согласованности бизнес-модели и не затрагивает программную реализацию.

---

# Scope (EN)

This document defines:

- Aggregate Roots;
- business responsibilities of aggregates;
- business invariants;
- ownership boundaries.

This document intentionally excludes:

- Domain Events;
- Domain Services;
- repositories;
- persistence;
- infrastructure.

---

# Область документа (RU)

Документ определяет:

- корни агрегатов;
- бизнес-ответственность агрегатов;
- бизнес-инварианты;
- границы ответственности.

Документ не рассматривает:

- доменные события;
- доменные сервисы;
- репозитории;
- хранение данных;
- инфраструктуру.

---

# Aggregate Overview (EN)

| Aggregate Root | Business Responsibility |
|----------------|-------------------------|
| Competency | Protects the integrity of competency definitions and relationships. |
| Development Profile | Protects the current competency state of an individual. |
| Development Goal | Protects the definition and integrity of development objectives. |
| Development Path | Protects the integrity of an adaptive development plan. |
| Assessment | Protects competency evaluation results. |
| Methodology | Protects competency development methodology. |
| Organization | Protects organizational development structure and policies. |

---

# Обзор агрегатов (RU)

| Корень агрегата | Бизнес-ответственность |
|-----------------|------------------------|
| Компетенция | Обеспечивает целостность определения компетенции и связей между компетенциями. |
| Профиль развития | Поддерживает актуальное состояние развития компетенций пользователя. |
| Цель развития | Обеспечивает целостность целей развития пользователя. |
| Траектория развития | Обеспечивает целостность персональной траектории развития. |
| Оценка | Обеспечивает целостность результатов оценки компетенций. |
| Методология | Обеспечивает целостность методологии развития компетенций. |
| Организация | Обеспечивает целостность организационной структуры и правил развития. |

---

# Business Invariants (EN)

## Competency

The aggregate guarantees that:

- every competency has a unique identity;
- every competency belongs to one Competency Framework;
- competency relationships remain structurally valid.

---

## Development Profile

The aggregate guarantees that:

- every Development Profile belongs to one User;
- the competency state remains internally consistent;
- the current profile state is always traceable through its development history.

---

## Development Goal

The aggregate guarantees that:

- every goal belongs to one Development Profile;
- every goal defines a measurable target state;
- completion of a goal is permanently recorded as part of the development history;
- if repeated competency development is required, a new development cycle is created instead of reactivating the completed goal.

---

## Development Path

The aggregate guarantees that:

- every development path belongs to one Development Profile;
- development activities follow a valid adaptive sequence;
- completed development activities remain part of the learner's development history.

---

## Assessment

The aggregate guarantees that:

- every assessment evaluates defined competencies;
- assessment results remain traceable;
- assessment history preserves its integrity.

---

## Methodology

The aggregate guarantees that:

- every methodology version is uniquely identifiable;
- competency development rules remain internally consistent;
- historical methodology versions remain available for reference.

---

## Organization

The aggregate guarantees that:

- organizational hierarchy remains valid;
- every member belongs to one organization;
- organizational competency policies remain internally consistent.

---

# Бизнес-инварианты (RU)

## Компетенция

Агрегат гарантирует, что:

- каждая компетенция имеет уникальную идентичность;
- каждая компетенция принадлежит одной модели компетенций;
- связи между компетенциями остаются структурно корректными.

---

## Профиль развития

Агрегат гарантирует, что:

- каждый профиль развития принадлежит одному пользователю;
- состояние компетенций остается внутренне согласованным;
- текущее состояние профиля всегда может быть подтверждено историей развития.

---

## Цель развития

Агрегат гарантирует, что:

- каждая цель относится к одному профилю развития;
- каждая цель определяет измеримое целевое состояние;
- факт достижения цели сохраняется как часть истории развития;
- при необходимости повторного развития создается новый цикл развития, а не повторно активируется уже завершенная цель.

---

## Траектория развития

Агрегат гарантирует, что:

- каждая траектория развития относится к одному профилю развития;
- последовательность этапов развития остается корректной;
- завершенные этапы развития сохраняются как часть истории развития пользователя.

---

## Оценка

Агрегат гарантирует, что:

- оцениваются только определенные компетенции;
- результаты оценки остаются прослеживаемыми;
- история оценки сохраняет свою целостность.

---

## Методология

Агрегат гарантирует, что:

- каждая версия методологии имеет уникальную идентификацию;
- правила развития компетенций остаются внутренне согласованными;
- предыдущие версии методологии доступны для анализа.

## Организация

Агрегат гарантирует, что:

- организационная структура остается корректной;
- каждый участник принадлежит одной организации;
- организационные политики развития остаются внутренне согласованными.

---

# Architectural Note (EN)

The aggregates presented in this document represent the current understanding of business consistency boundaries within the Competency Operating System.

As the domain model evolves through subsequent Domain-Driven Design documents, particularly Domain Events and Business Processes, some aggregate boundaries may be refined.

Such refinements do not change the business concepts themselves. They improve the consistency boundaries that protect those concepts.

---

# Архитектурное примечание (RU)

Представленные агрегаты отражают текущее понимание границ согласованности предметной области Competency Operating System.

По мере развития модели предметной области в следующих документах Domain-Driven Design, особенно при проектировании Domain Events и Business Processes, границы отдельных агрегатов могут быть уточнены.

Подобные изменения не изменяют сами бизнес-понятия. Они уточняют границы согласованности, обеспечивающие корректную работу предметной области.

---

# Design Principles (EN)

The aggregate model follows these principles:

- every aggregate protects business consistency;
- every aggregate owns a single business responsibility;
- aggregate boundaries are defined by business rules rather than technical implementation;
- business invariants are enforced inside aggregate boundaries;
- collaboration between aggregates occurs through explicit domain interactions.

---

# Принципы проектирования (RU)

Модель агрегатов строится по следующим принципам:

- каждый агрегат защищает согласованность бизнес-правил;
- каждый агрегат обладает одной основной областью ответственности;
- границы агрегатов определяются бизнес-правилами, а не технической реализацией;
- бизнес-инварианты обеспечиваются внутри границ агрегата;
- взаимодействие агрегатов осуществляется через явно определенные доменные взаимодействия.

---

# Out of Scope (EN)

This document intentionally excludes:

- Domain Events;
- Domain Services;
- Application Services;
- repositories;
- persistence mechanisms;
- software architecture.

---

# Не входит в область документа (RU)

Документ намеренно не рассматривает:

- доменные события;
- доменные сервисы;
- прикладные сервисы;
- репозитории;
- механизмы хранения данных;
- программную архитектуру.

---

# Related Documents

- Foundation Book v0.3
- COS-DDD-001 — Core Domain
- COS-DDD-002 — Domain Landscape
- COS-DDD-003 — Bounded Context Map
- COS-DDD-004 — Ubiquitous Language
- COS-DDD-005 — Domain Model
- COS-DDD-007 — Domain Events

---

# Decision Log

## Decision (EN)

The Competency Operating System protects business consistency through a set of Aggregate Roots, each responsible for enforcing a clearly defined set of business invariants.

Aggregate boundaries are established according to business consistency requirements rather than implementation concerns.

---

## Решение (RU)

Согласованность предметной области Competency Operating System обеспечивается набором корней агрегатов (Aggregate Roots), каждый из которых отвечает за соблюдение определенного набора бизнес-инвариантов.

Границы агрегатов определяются требованиями предметной области к согласованности бизнес-данных, а не особенностями программной реализации.

---

## Rationale (EN)

Separating consistency boundaries allows the domain model to evolve independently while protecting critical business rules.

This approach supports future refinement of the model without changing the fundamental business concepts.

---

## Обоснование (RU)

Выделение отдельных границ согласованности позволяет предметной модели развиваться независимо, сохраняя целостность ключевых бизнес-правил.

Такой подход обеспечивает возможность дальнейшего уточнения модели без изменения фундаментальных бизнес-понятий.

---

## Consequences (EN)

All future Domain Events, Domain Services and Business Processes must respect the aggregate boundaries and business invariants defined in this document.

If future analysis reveals more appropriate consistency boundaries, aggregate composition may be refined while preserving the existing business concepts.

---

## Последствия (RU)

Все последующие Domain Events, Domain Services и Business Processes должны учитывать границы агрегатов и бизнес-инварианты, определенные в данном документе.

Если дальнейший анализ предметной области покажет более подходящие границы согласованности, состав агрегатов может быть уточнен без изменения существующих бизнес-понятий.