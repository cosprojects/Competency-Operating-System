# COS-ARCH-001 — Product Development Workflow

**Status:** Accepted  
**Version:** 1.0  
**Phase:** Engineering Standard  
**Owner:** Competency Operating System (COS)

---

# Purpose (EN)

This document defines the official development workflow of the Competency Operating System.

It establishes a single engineering process shared by architects, designers, developers, analysts, AI assistants and all future contributors.

The goal is to ensure that every decision follows the same architectural direction and that the platform evolves consistently over time.

---

# Назначение (RU)

Документ определяет официальный процесс разработки Competency Operating System.

Он устанавливает единый инженерный процесс для архитекторов, дизайнеров, разработчиков, аналитиков, методологов и AI-ассистентов.

Главная цель — обеспечить последовательное развитие платформы без потери архитектурной целостности.

---

# Core Principle

COS is designed from meaning to implementation.

Every architectural layer depends on the previous one.

Lower layers must never redefine higher-level decisions.

Architecture evolves from business understanding toward technical implementation.

---

# Основной принцип

COS проектируется от смыслов к реализации.

Каждый следующий архитектурный уровень опирается на предыдущий.

Нижележащие уровни никогда не переопределяют решения, принятые на более высоких уровнях.

---

# Development Order

The official development order of COS is fixed.

No stage may be skipped.

---

## Stage 00 — Mental Model

Purpose:

Establish how COS should be understood.

Artifacts:

- Mental Model

Result:

A shared conceptual understanding of the platform.

---

## Stage 01 — Foundation

Purpose:

Define why the platform exists.

Artifacts:

- Foundation Book
- Product Vision
- Product Boundaries
- Design Principles
- Architecture Principles

Result:

Product philosophy and strategic direction.

---

## Stage 02 — Domain Discovery

Purpose:

Discover the business domain.

Artifacts:

- Domain Vision
- Ubiquitous Language
- DDD Summary

Result:

A common business language.

No implementation decisions are allowed.

---

## Stage 03 — Strategic DDD

Purpose:

Split the domain into business responsibilities.

Artifacts:

- Core Domain
- Supporting Domains
- Generic Domains
- Bounded Contexts
- Context Map

Result:

Business ownership is defined.

---

## Stage 04 — Tactical DDD

Purpose:

Build the domain model.

Artifacts:

- Aggregates
- Entities
- Value Objects
- Domain Events
- Domain Services
- Repositories

Result:

Complete domain model.

---

## Stage 05 — Enterprise Architecture

Purpose:

Design the platform architecture.

Artifacts:

- Business Architecture
- Application Architecture
- Data Architecture
- Integration Architecture
- Technology Architecture

Result:

System architecture.

---

## Stage 06 — Adaptive Development Engine

Purpose:

Design the decision-making model that transforms trusted competency information into adaptive development decisions.

Artifacts:

- Decision Model
- Adaptive Routing
- Recommendation Logic
- Evidence Processing
- Prediction
- Learning Policies

Result:

Core competitive advantage.

---

## Stage 07 — Experience Architecture

Purpose:

Design how users interact with the business model.

Artifacts:

- Personas
- User Goals
- User Journeys
- Information Architecture
- Navigation Model
- Screen Map

Result:

Complete UX architecture.

No visual design is produced yet.

---

## Stage 08 — UI Design

Purpose:

Transform Experience Architecture into interface.

Artifacts:

- Wireframes
- Design System
- High Fidelity Screens
- Interactive Prototype

Result:

Complete interface design.

---

## Stage 09 — MVP Definition

Purpose:

Define the smallest valuable product.

Artifacts:

- MVP Scope
- Release Plan
- Product Roadmap

Result:

Implementation-ready product scope.

---

## Stage 10 — Implementation

Purpose:

Build the product.

Artifacts:

- Backend
- Frontend
- APIs
- Infrastructure
- Deployment

Result:

Working software.

---

# Architectural Rules

The following rules are mandatory.

1. Never skip architectural levels.

2. Every document depends only on documents from previous stages.

3. Git is the single source of truth.

4. Documentation precedes implementation.

5. Architecture precedes interface.

6. Interface reflects the domain model.

7. Technology never defines business architecture.

8. Adaptive Development Engine remains the Core Domain.

9. New concepts must not be introduced without architectural justification.

10. Existing concepts should be reused whenever possible.

---

# Iteration Workflow

Each major stage is developed independently.

Each iteration contains:

Discussion

↓

Agreement

↓

Documentation

↓

Git Commit

↓

Context Book

↓

Knowledge Update

↓

Next Iteration

---

# AI Working Rules

Every AI assistant participating in the project must:

- read the Mental Model;
- read the Foundation Book;
- follow this workflow;
- continue existing architecture;
- avoid redesigning approved decisions;
- maintain terminology consistency;
- prefer mature solutions over multiple alternatives.

---

# Definition of Done

A document is considered complete only if:

- it has been discussed;
- it has been approved;
- it has been committed to Git;
- it has been included in the current Context Book;
- all related documents have been updated if necessary.

---

# Final Principle

The purpose of this workflow is not to slow development.

Its purpose is to ensure that every future architectural, design and engineering decision contributes to a single coherent Competency Operating System.

The platform should evolve without losing its conceptual integrity.

# Порядок разработки продукта

Официальный процесс разработки Competency Operating System является фиксированным.

Ни один этап не может быть пропущен или выполнен раньше предыдущего.

Каждый последующий архитектурный уровень строится на результатах предыдущего.

---

## Этап 00 — Mental Model

### Цель

Сформировать единое понимание того, чем является Competency Operating System.

### Артефакты

- Mental Model

### Результат

Единая концептуальная модель платформы.

Все участники проекта одинаково понимают назначение и философию COS.

---

## Этап 01 — Foundation

### Цель

Определить, зачем существует платформа и какие принципы лежат в её основе.

### Артефакты

- Foundation Book
- Product Vision
- Product Boundaries
- Design Principles
- Architecture Principles
- Decision Framework

### Результат

Полностью сформирована продуктовая философия и стратегическое направление развития платформы.

---

## Этап 02 — Domain Discovery

### Цель

Исследовать предметную область и сформировать единый бизнес-язык проекта.

### Артефакты

- Domain Vision
- Ubiquitous Language
- DDD Summary

### Результат

Сформирован единый словарь предметной области.

На данном этапе запрещается обсуждать техническую реализацию.

---

## Этап 03 — Strategic DDD

### Цель

Разделить систему на независимые бизнес-контексты.

### Артефакты

- Core Domain
- Supporting Domains
- Generic Domains
- Bounded Contexts
- Context Map

### Результат

Определены зоны ответственности и границы предметной области.

---

## Этап 04 — Tactical DDD

### Цель

Спроектировать внутреннюю модель каждого бизнес-контекста.

### Артефакты

- Aggregates
- Entities
- Value Objects
- Domain Events
- Domain Services
- Repositories

### Результат

Полностью сформирована доменная модель платформы.

---

## Этап 05 — Enterprise Architecture

### Цель

Спроектировать архитектуру всей платформы.

### Артефакты

- Business Architecture
- Application Architecture
- Data Architecture
- Integration Architecture
- Technology Architecture

### Результат

Определена архитектура всей системы и взаимодействие между её компонентами.

---

## Этап 06 — Adaptive Development Engine

### Цель

Разработать модель принятия решений, преобразующую достоверную информацию о компетенциях в адаптивные решения по развитию.

### Артефакты

- Decision Model
- Adaptive Routing
- Recommendation Logic
- Evidence Processing
- Prediction Model
- Learning Policies

### Результат

Спроектировано главное конкурентное преимущество Competency Operating System — механизм интеллектуального сопровождения развития пользователя.

---

## Этап 07 — Experience Architecture

### Цель

Спроектировать пользовательский опыт взаимодействия с бизнес-моделью платформы.

На данном этапе ещё не создаются макеты интерфейсов.

### Артефакты

- Personas
- User Goals
- User Journeys
- Information Architecture
- Navigation Model
- Screen Map

### Результат

Полностью определена архитектура пользовательского опыта.

---

## Этап 08 — UI Design

### Цель

Преобразовать Experience Architecture в пользовательский интерфейс.

### Артефакты

- Wireframes
- Design System
- High Fidelity Screens
- Interactive Prototype

### Результат

Подготовлен полный дизайн интерфейсов продукта, готовый к разработке.

---

## Этап 09 — MVP Definition

### Цель

Определить минимальную версию продукта, достаточную для проверки ключевых гипотез.

### Артефакты

- MVP Scope
- Release Plan
- Product Roadmap

### Результат

Сформирован объём первой версии продукта и план её реализации.

---

## Этап 10 — Implementation

### Цель

Реализовать платформу.

### Артефакты

- Backend
- Frontend
- API
- Infrastructure
- Deployment

### Результат

Работающая версия Competency Operating System.

---

# Принцип последовательности

Каждый следующий этап может использовать только результаты предыдущих этапов.

Например:

- UI Design не может начинаться до завершения Experience Architecture.
- Experience Architecture не может начинаться до завершения Enterprise Architecture.
- Enterprise Architecture не может проектироваться без завершённого Domain-Driven Design.
- Domain-Driven Design не может выполняться без утверждённых Foundation и Mental Model.

---

# Главный принцип разработки

**COS проектируется от смыслов к реализации.**

Мы никогда не начинаем с технологий, интерфейсов или базы данных.

Сначала определяется предметная область, затем архитектура, затем пользовательский опыт, затем дизайн и только после этого начинается программная реализация.

Именно этот подход обеспечивает архитектурную целостность платформы и позволяет ей развиваться без потери первоначальной концепции.