# COS-DDD-001 — Core Domain

**Status:** Reviewed  
**Version:** 0.1  
**Iteration:** Domain-Driven Design  
**Owner:** Competency Operating System (COS)  
**Last Updated:** 2026-07-04

---

# Purpose (EN)

This document defines the Core Domain of the Competency Operating System (COS).

Its purpose is to establish the primary business domain of the platform, identify the unique business capability that differentiates COS from conventional learning systems, and define the foundation for all subsequent Domain-Driven Design artifacts.

This document intentionally excludes implementation details, software architecture, infrastructure, APIs and data models.

---

# Назначение (RU)

Документ определяет **Core Domain** платформы Competency Operating System (COS).

Его цель — зафиксировать основную предметную область платформы, определить ключевую бизнес-способность системы и сформировать основу для всех последующих документов Domain-Driven Design.

Документ намеренно не рассматривает вопросы реализации, программной архитектуры, инфраструктуры, API и моделей данных.

---

# Scope (EN)

This document defines:

- the primary business problem;
- the Core Domain of COS;
- the business value created by the platform;
- the strategic focus of the product.

This document does not define:

- entities;
- aggregates;
- bounded contexts;
- domain services;
- business processes;
- software architecture.

---

# Область документа (RU)

Документ определяет:

- основную бизнес-проблему;
- Core Domain платформы COS;
- создаваемую бизнес-ценность;
- стратегический фокус продукта.

Документ не определяет:

- сущности;
- агрегаты;
- Bounded Context;
- доменные сервисы;
- бизнес-процессы;
- программную архитектуру.

---

# Business Problem (EN)

Traditional learning systems primarily manage educational content.

Learning Management Systems (LMS) organize courses.

Learning Experience Platforms (LXP) recommend content.

Competency matrices describe expected skills.

None of these systems continuously model how a person's competencies evolve over time or determine the optimal next development step based on current capability.

As a result:

- learning paths remain static;
- competency gaps remain hidden;
- development is measured by completed activities rather than achieved capabilities;
- organizations cannot objectively manage competency growth.

---

# Бизнес-проблема (RU)

Традиционные образовательные системы преимущественно управляют учебным контентом.

LMS организуют курсы.

LXP рекомендуют материалы.

Матрицы компетенций описывают ожидаемые навыки.

Ни одна из этих систем не моделирует непрерывное развитие компетенций человека и не определяет оптимальный следующий шаг развития на основе текущего состояния.

В результате:

- образовательные траектории остаются статичными;
- дефициты компетенций выявляются недостаточно точно;
- развитие измеряется прохождением материалов, а не изменением компетентности;
- организация не может объективно управлять развитием сотрудников.

---

# Core Domain (EN)

The Core Domain of Competency Operating System is **Adaptive Competency Development**.

The platform continuously models competencies, evaluates their evolution and determines the most effective next development step.

The central business objective of COS is not delivering educational content.

The central objective is improving human capability through adaptive competency development.

Educational content, assessments, simulations, methodologies and learning resources exist only as mechanisms supporting competency evolution.

---

# Core Domain (RU)

Основной предметной областью Competency Operating System является **адаптивное развитие компетенций**.

Платформа непрерывно моделирует компетенции человека, оценивает их развитие и определяет наиболее эффективный следующий шаг развития.

Главной бизнес-задачей COS является не доставка образовательного контента.

Главная задача платформы — развитие человеческих компетенций посредством адаптивного управления процессом развития.

Курсы, оценки, симуляции, методики и образовательные материалы являются инструментами поддержки развития компетенций.

---

# Core Business Capability (EN)

The primary capability of COS is the ability to continuously answer five business questions:

1. What competencies does a person currently possess?
2. What is the maturity level of each competency?
3. Which competency gaps currently exist?
4. What development action should happen next?
5. How has competency changed over time?

---

# Основная бизнес-способность (RU)

Главная бизнес-способность COS заключается в непрерывном ответе на пять вопросов:

1. Какими компетенциями человек обладает сейчас?
2. Каков уровень зрелости каждой компетенции?
3. Какие дефициты существуют?
4. Какой следующий шаг развития наиболее эффективен?
5. Как изменяются компетенции во времени?

---

# Strategic Differentiation (EN)

COS is not an LMS.

COS is not a content platform.

COS is not a competency matrix.

COS is a Development Intelligence Platform whose primary business asset is the competency model.

Everything else supports that model.

---

# Стратегическое отличие (RU)

COS не является LMS.

COS не является платформой образовательного контента.

COS не является матрицей компетенций.

COS представляет собой Development Intelligence Platform, главным бизнес-активом которой является модель компетенций.

Все остальные компоненты платформы существуют для поддержки этой модели.

---

# Core Domain Boundary (EN)

The Core Domain begins when competency development becomes observable and manageable.

The Core Domain ends before implementation concerns such as user interface, databases, communication protocols or infrastructure.

Technology serves the domain.

The domain never depends on technology.

---

# Границы Core Domain (RU)

Core Domain начинается там, где развитие компетенций становится наблюдаемым и управляемым.

Core Domain заканчивается до появления вопросов реализации, интерфейсов, хранения данных, API или инфраструктуры.

Технологии обслуживают предметную область.

Предметная область не зависит от технологий.

---

# Architectural Implications (EN)

This definition establishes several architectural consequences:

- Competency is the primary business object.
- Development is the primary business process.
- Assessment supports development.
- Learning content supports development.
- Adaptive decision-making is part of the Core Domain.
- All future bounded contexts must contribute to competency evolution.

---

# Архитектурные выводы (RU)

Данное определение определяет несколько архитектурных следствий:

- Компетенция является главным бизнес-объектом.
- Развитие является главным бизнес-процессом.
- Оценка поддерживает развитие.
- Контент поддерживает развитие.
- Адаптивное принятие решений относится к Core Domain.
- Все последующие Bounded Context должны работать на развитие компетенций.

---

# Out of Scope (EN)

This document intentionally excludes:

- Domain Landscape;
- Bounded Contexts;
- Ubiquitous Language;
- Domain Model;
- Aggregates;
- Domain Events;
- Domain Services;
- Business Processes;
- Enterprise Architecture.

---

# Не входит в область документа (RU)

Документ намеренно не рассматривает:

- Ландшафт домена;
- Ограниченный контекст;
- Повсеместный язык;
- Модель домена;
- Агрегаты;
- События домена;
- Сервисы домена;
- Бизнес-процессы;
- Архитектура предприятия.

---

# Related Documents

- Foundation Book v0.3
- COS-DDD-002 — Domain Landscape
- COS Engineering Standard

---

# Decision Log

## Decision

The Core Domain of COS is defined as **Adaptive Competency Development**.

## Rationale

This definition aligns with the Foundation Book and establishes competency evolution as the primary business concern of the platform.

## Consequences

All future Domain-Driven Design documents must treat competencies as the central business concept and ensure that every domain model, bounded context and business process contributes directly or indirectly to competency development.