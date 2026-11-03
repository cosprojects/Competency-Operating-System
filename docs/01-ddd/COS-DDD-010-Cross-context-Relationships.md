# COS-DDD-010 — Cross-context Relationships

**Status:** In Review  
**Version:** 0.1  
**Iteration:** Domain-Driven Design  
**Owner:** Competency Operating System (COS)  
**Last Updated:** 2026-07-05

---

# Purpose (EN)

This document defines how Bounded Contexts collaborate within the Competency Operating System (COS).

Its purpose is to establish clear interaction boundaries while preserving the autonomy of each context and protecting the integrity of the Core Domain.

Rather than describing implementation details, this document specifies architectural relationships between business capabilities.

---

# Назначение (RU)

Документ определяет принципы взаимодействия ограниченных контекстов (Bounded Contexts) в Competency Operating System (COS).

Его цель — установить понятные правила взаимодействия между контекстами, сохранив их автономность и защитив целостность Core Domain.

Документ описывает не технические интеграции, а архитектурные отношения между бизнес-возможностями платформы.

---

# Scope (EN)

This document defines:

- relationships between Bounded Contexts;
- dependency types;
- collaboration principles;
- autonomy rules;
- anti-corruption strategy;
- evolution principles.

This document intentionally excludes:

- APIs;
- messaging technologies;
- implementation;
- deployment architecture.

---

# Область документа (RU)

Документ определяет:

- отношения между ограниченными контекстами;
- типы зависимостей;
- принципы взаимодействия;
- правила автономности;
- стратегию Anti-Corruption Layer;
- принципы развития архитектуры.

Документ не рассматривает:

- API;
- технологии обмена сообщениями;
- детали реализации;
- инфраструктуру развертывания.

---

# Relationship Principles (EN)

Cross-context collaboration within COS follows several fundamental principles.

Every Bounded Context owns its business model and protects its own consistency.

Contexts collaborate through explicit contracts rather than sharing internal models.

Business knowledge flows across contexts without transferring ownership.

---

# Принципы взаимодействия (RU)

Взаимодействие между ограниченными контекстами COS строится на нескольких фундаментальных принципах.

Каждый Bounded Context владеет собственной бизнес-моделью и самостоятельно обеспечивает ее согласованность.

Контексты взаимодействуют через явно определенные контракты, а не через совместное использование внутренних моделей.

Бизнес-знания могут распространяться между контекстами, однако ответственность за модель остается у владельца контекста.

---

# Relationship Types

| Relationship | Description (EN) | Описание (RU) |
|--------------|------------------|---------------|
| Publishes | Produces Domain Events | Публикует доменные события |
| Consumes | Uses Domain Events from another Context | Использует доменные события другого контекста |
| Influences | Affects business decisions | Влияет на принятие бизнес-решений |
| Constrains | Defines business constraints | Определяет бизнес-ограничения |
| Supplies | Provides business information | Предоставляет бизнес-информацию |
| Coordinates | Coordinates multiple Contexts | Координирует работу нескольких контекстов |

---

# Context Collaboration Matrix

| Source Context | Relationship | Target Context |
|----------------|--------------|----------------|
| Assessment | Publishes | Development Profile |
| Assessment | Publishes | Adaptive Development |
| Evidence Management | Supplies | Competency Evaluation |
| Competency | Supplies | Development Planning |
| Methodology | Constrains | Adaptive Development |
| Methodology | Constrains | Learning Experience |
| Organization | Constrains | Development Planning |
| Development Profile | Influences | Adaptive Development |
| Adaptive Development | Coordinates | Learning Experience |
| Learning Experience | Publishes | Evidence Management |

---

# Матрица взаимодействия контекстов

| Исходный контекст | Тип связи | Целевой контекст |
|-------------------|-----------|------------------|
| Assessment | Публикует | Development Profile |
| Assessment | Публикует | Adaptive Development |
| Evidence Management | Предоставляет данные | Competency Evaluation |
| Competency | Предоставляет данные | Development Planning |
| Methodology | Ограничивает | Adaptive Development |
| Methodology | Ограничивает | Learning Experience |
| Organization | Определяет ограничения | Development Planning |
| Development Profile | Влияет | Adaptive Development |
| Adaptive Development | Координирует | Learning Experience |
| Learning Experience | Публикует | Evidence Management |

---

# Context Dependency Principles (EN)

Dependencies between contexts should always remain directional.

A Context may depend on another Context's published knowledge but never on its internal implementation.

No Context is allowed to directly modify another Context's internal business state.

---

# Принципы зависимостей между контекстами (RU)

Зависимости между контекстами должны быть однонаправленными.

Контекст может использовать опубликованные бизнес-знания другого контекста, но не зависит от его внутренней реализации.

Ни один контекст не имеет права напрямую изменять внутреннее состояние другого контекста.