# COS-DDD-007 — Domain Events

**Status:** In Review  
**Version:** 0.1  
**Iteration:** Domain-Driven Design  
**Owner:** Competency Operating System (COS)  
**Last Updated:** 2026-07-05

---

# Purpose (EN)

This document defines the Domain Events of the Competency Operating System (COS).

Domain Events represent significant business state transitions that occur within the domain and may affect other Bounded Contexts.

Unlike technical events, Domain Events describe meaningful changes in the business itself.

---

# Назначение (RU)

Документ определяет доменные события (Domain Events) платформы Competency Operating System (COS).

Доменные события отражают значимые изменения состояния предметной области, которые могут быть важны для других ограниченных контекстов.

В отличие от технических событий, Domain Events описывают изменения бизнеса, а не действия системы.

---

# Scope (EN)

This document defines:

- Domain Events;
- business meaning of each event;
- event publishers;
- affected business contexts;
- typical business triggers.

This document intentionally excludes:

- message brokers;
- event transport;
- integration events;
- implementation.

---

# Область документа (RU)

Документ определяет:

- доменные события;
- бизнес-смысл каждого события;
- владельцев событий;
- затрагиваемые контексты;
- типичные бизнес-триггеры.

Документ не рассматривает:

- брокеры сообщений;
- транспорт событий;
- интеграционные события;
- программную реализацию.

---

# Domain Event Principles (EN)

Within COS, a Domain Event represents a meaningful transition of business state.

A Domain Event is published when the business model changes in a way that may influence other parts of the domain.

Domain Events do not represent user interface actions or technical operations.

---

# Принципы Domain Events (RU)

В COS доменное событие представляет собой значимое изменение состояния предметной области.

Domain Event публикуется тогда, когда изменение бизнес-состояния может повлиять на другие части предметной области.

Доменные события не описывают действия пользователя в интерфейсе и не отражают технические операции.

---

# Domain Events

## Event 1

### Event Name

**Competency State Changed**

---

### Business Meaning (EN)

The state of one or more competencies has changed.

The change may represent growth, degradation, validation, expiration or any other meaningful state transition.

---

### Бизнес-смысл (RU)

Состояние одной или нескольких компетенций изменилось.

Изменение может означать развитие, деградацию, подтверждение, потерю актуальности или любое другое значимое изменение состояния.

---

### Published By

Development Profile

---

### Affected Contexts

- Adaptive Development Engine
- Assessment
- Learning Experience
- Evidence Management

---

### Typical Triggers

- assessment completed
- new evidence verified
- competency expiration
- practical experience confirmed
- competency degradation detected

---

## Event 2

### Event Name

**Development Goal State Changed**

---

### Business Meaning (EN)

The lifecycle state of a development goal has changed.

Examples include creation, activation, completion, suspension or cancellation.

---

### Бизнес-смысл (RU)

Изменилось состояние цели развития.

Например:

- создана;
- активирована;
- достигнута;
- приостановлена;
- отменена.

---

### Published By

Development Goal

---

### Affected Contexts

- Development Profile
- Adaptive Development Engine

---

### Typical Triggers

- new goal created
- goal completed
- goal cancelled
- methodology updated

---

## Event 3

### Event Name

**Development Path Changed**

---

### Business Meaning (EN)

The recommended development path has been created or modified.

---

### Бизнес-смысл (RU)

Сформирована или изменена рекомендуемая траектория развития.

---

### Published By

Development Path

---

### Affected Contexts

- Learning Experience
- Development Profile

---

### Typical Triggers

- competency state changed
- methodology updated
- development goal changed

---

## Event 4

### Event Name

**Assessment Completed**

---

### Business Meaning (EN)

A competency assessment has been completed and its results are available for the domain.

---

### Бизнес-смысл (RU)

Оценка компетенций завершена, а результаты стали доступны предметной области.

---

### Published By

Assessment

---

### Affected Contexts

- Development Profile
- Adaptive Development Engine
- Evidence Management

---

### Typical Triggers

- assessment submitted
- automatic evaluation completed
- expert evaluation completed

## Event 5

### Event Name

**Evidence Verified**

---

### Business Meaning (EN)

Evidence supporting competency development has been validated and is now considered trustworthy within the domain.

---

### Бизнес-смысл (RU)

Подтверждено доказательство, подтверждающее развитие компетенции.

После проверки данное доказательство может использоваться другими частями предметной области.

---

### Published By

Evidence Management

---

### Affected Contexts

- Development Profile
- Assessment
- Adaptive Development Engine

---

### Typical Triggers

- expert verification completed
- automatic validation passed
- external certification confirmed

---

## Event 6

### Event Name

**Methodology Changed**

---

### Business Meaning (EN)

A competency development methodology has changed in a way that may affect existing or future development paths.

---

### Бизнес-смысл (RU)

Методология развития изменилась таким образом, что это может повлиять на существующие или будущие траектории развития.

---

### Published By

Methodology

---

### Affected Contexts

- Adaptive Development Engine
- Development Path
- Learning Experience

---

### Typical Triggers

- methodology version published
- competency framework updated
- educational strategy revised

---

## Event 7

### Event Name

**Organization Policy Changed**

---

### Business Meaning (EN)

An organizational policy affecting competency development has changed.

---

### Бизнес-смысл (RU)

Изменились организационные правила, влияющие на развитие компетенций.

---

### Published By

Organization

---

### Affected Contexts

- Development Profile
- Adaptive Development Engine
- Learning Experience

---

### Typical Triggers

- competency requirements updated
- certification policy revised
- organizational standards changed

---

## Event 8

### Event Name

**Learning Object State Changed**

---

### Business Meaning (EN)

The availability or business status of a learning object has changed.

---

### Бизнес-смысл (RU)

Изменилось состояние образовательного объекта.

Например:

- опубликован;
- архивирован;
- заменен новой версией;
- больше не рекомендуется.

---

### Published By

Learning Experience

---

### Affected Contexts

- Development Path
- Adaptive Development Engine

---

### Typical Triggers

- new learning object published
- content deprecated
- learning object replaced
- content quality reviewed

---

# Design Principles (EN)

The Domain Event model follows these principles:

- Domain Events describe business state transitions.
- Events are independent of implementation technology.
- Events communicate meaningful domain changes.
- A Domain Event may have multiple business causes.
- Events describe **what changed**, not **how it changed**.

---

# Принципы проектирования (RU)

Модель доменных событий строится по следующим принципам:

- Domain Events описывают изменения состояния предметной области.
- События не зависят от технологий реализации.
- События отражают значимые изменения бизнеса.
- Одно событие может иметь несколько бизнес-причин.
- Событие отвечает на вопрос **«что изменилось?»**, а не **«каким образом это произошло?»**.

---

# Traceability

## Foundation

- Product Vision
- Product Manifesto
- Architecture Principles

## Related DDD

- COS-DDD-003 — Bounded Context Map
- COS-DDD-005 — Domain Model
- COS-DDD-006 — Aggregates & Invariants

## Next

- COS-DDD-008 — Domain Services

---

# Out of Scope (EN)

This document intentionally excludes:

- Integration Events;
- Event Bus;
- Event Streaming;
- Messaging Infrastructure;
- Technical Events.

---

# Не входит в область документа (RU)

Документ намеренно не рассматривает:

- интеграционные события;
- шину событий;
- потоковую обработку событий;
- инфраструктуру обмена сообщениями;
- технические события.

---

# Related Documents

- Foundation Book v0.3
- COS-DDD-005 — Domain Model
- COS-DDD-006 — Aggregates & Invariants
- COS-DDD-008 — Domain Services

---

# Decision Log

## Decision (EN)

The Competency Operating System models Domain Events as significant business state transitions rather than technical actions or irreversible business facts.

This approach reflects the dynamic nature of competency development, where business states may evolve, regress, expire or be revalidated over time.

---

## Решение (RU)

Competency Operating System рассматривает Domain Events как значимые изменения состояния предметной области, а не как технические действия или необратимые бизнес-факты.

Такой подход отражает динамическую природу развития компетенций, при которой состояние может улучшаться, ухудшаться, терять актуальность или подтверждаться повторно.

---

## Rationale (EN)

Competency development is inherently dynamic.

Capturing state transitions instead of irreversible events allows the domain model to represent continuous human development more accurately.

---

## Обоснование (RU)

Развитие компетенций представляет собой непрерывный динамический процесс.

Фиксация изменений состояния вместо необратимых событий позволяет точнее моделировать реальные процессы профессионального развития человека.

---

## Consequences (EN)

Future Domain Services, Business Processes and the Adaptive Development Engine must react to domain state transitions while preserving complete development history.

---

## Последствия (RU)

Domain Services, Business Processes и Adaptive Development Engine должны строиться вокруг изменений состояния предметной области, сохраняя полную историю развития пользователя.