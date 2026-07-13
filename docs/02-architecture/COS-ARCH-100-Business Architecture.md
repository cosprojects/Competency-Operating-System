# COS-ARCH-100 — Business Architecture

**Status:** Draft  
**Version:** 1.0  
**Phase:** Enterprise Architecture  
**Owner:** Competency Operating System (COS)  
**Last Updated:** 2026-07-12

---

# Purpose (EN)

This document defines the Business Architecture of the Competency Operating System (COS).

It describes how the platform is organized from a business perspective, independent of implementation details, software architecture or technology choices.

The Business Architecture establishes the stable business foundation upon which Application Architecture, Data Architecture and Technology Architecture are built.

---

# Назначение (RU)

Документ описывает бизнес-архитектуру Competency Operating System (COS).

Он определяет устройство платформы с точки зрения бизнеса, независимо от программной реализации, технической архитектуры и используемых технологий.

Бизнес-архитектура является фундаментом для последующих документов по Application Architecture, Data Architecture и Technology Architecture.

---

# Scope (EN)

Business Architecture answers the following questions:

- What business capabilities exist?
- Which business services does the platform provide?
- Which actors interact with the platform?
- Which business processes are supported?
- Where are the boundaries of business responsibility?

It intentionally does not describe:

- software services;
- databases;
- APIs;
- integrations;
- infrastructure.

---

# Область применения (RU)

Business Architecture отвечает на вопросы:

- Какие бизнес-возможности существуют в платформе?
- Какие бизнес-сервисы предоставляет COS?
- Кто взаимодействует с платформой?
- Какие бизнес-процессы поддерживаются?
- Где проходят границы бизнес-ответственности?

Документ намеренно не описывает:

- программные сервисы;
- базы данных;
- API;
- интеграции;
- инфраструктуру.

---

# Architecture Principles (EN)

The Business Architecture of COS follows several principles.

## Business before Technology

Business decisions define technical decisions.

Technology must implement the business model rather than influence it.

## Stable Business Language

All architectural documents use a shared business vocabulary established during Domain-Driven Design.

## Separation of Responsibilities

Every business capability has a clearly defined responsibility.

Responsibilities should never overlap unnecessarily.

## Independent Business Evolution

Business capabilities should be able to evolve independently while preserving overall platform consistency.

---

# Принципы бизнес-архитектуры (RU)

Бизнес-архитектура COS строится на нескольких принципах.

## Бизнес определяет технологии

Бизнес-модель формирует техническую архитектуру.

Технологии реализуют бизнес-решения, а не определяют их.

## Единый язык предметной области

Во всех архитектурных документах используется единая терминология, сформированная на этапе Domain-Driven Design.

## Разделение ответственности

Каждая бизнес-возможность имеет четко определенную область ответственности.

Ответственность не должна дублироваться между различными частями платформы.

## Независимое развитие

Каждая часть бизнес-модели должна иметь возможность развиваться независимо, сохраняя целостность всей системы.

---

# Business Actors (EN)

Business Architecture defines the participants that interact with COS.

Actors represent business roles rather than software users.

Typical actors include:

- Individual
- Mentor
- Assessor
- Organization
- Administrator
- Content Provider
- External Certification Provider

The detailed definition of actors belongs to the domain model.

---

# Бизнес-акторы (RU)

Business Architecture определяет участников, взаимодействующих с COS.

Акторы представляют бизнес-роли, а не программные сущности.

Типовые участники:

- Пользователь
- Наставник
- Эксперт
- Организация
- Администратор
- Поставщик образовательного контента
- Внешняя система сертификации

Подробное описание ролей приводится в документации предметной области.

---

# Business Capabilities (EN)

Business Capabilities describe what the platform is able to do.

Capabilities remain stable even when implementation changes.

Detailed capability mapping is described in dedicated architecture documents.

---

# Бизнес-возможности (RU)

Business Capabilities описывают, какими возможностями обладает платформа.

Бизнес-возможности значительно стабильнее программной реализации и сохраняются даже при изменении технологий.

Подробная карта возможностей будет описана отдельным документом.

---

# Business Services (EN)

Business Services expose business capabilities to actors.

A business service represents value delivered by the platform rather than technical functionality.

---

# Бизнес-сервисы (RU)

Business Services предоставляют бизнес-возможности участникам платформы.

Бизнес-сервис отражает ценность для пользователя, а не программную функцию.

---

# Business Processes (EN)

Business Processes coordinate multiple business capabilities in order to achieve business goals.

Each process may involve several domains while preserving responsibility boundaries defined by DDD.

---

# Бизнес-процессы (RU)

Бизнес-процессы объединяют несколько бизнес-возможностей для достижения определенной цели.

Один процесс может использовать несколько предметных областей, сохраняя установленные Domain-Driven Design границы ответственности.

---

# Business Boundaries (EN)

Business Architecture follows the bounded contexts defined by Domain-Driven Design.

No capability should violate established business boundaries.

Application Architecture will later translate these boundaries into software architecture.

---

# Границы бизнес-архитектуры (RU)

Business Architecture использует границы предметных областей, определенные на этапе Domain-Driven Design.

Ни одна бизнес-возможность не должна нарушать эти границы.

На следующем этапе эти границы будут преобразованы в архитектуру программной системы.

---

# Relationship with DDD (EN)

Business Architecture extends Domain-Driven Design.

DDD defines responsibilities.

Business Architecture defines how those responsibilities cooperate to create business value.

---

# Связь с Domain-Driven Design (RU)

Business Architecture развивает результаты Domain-Driven Design.

DDD определяет ответственность.

Business Architecture показывает, как различные области совместно создают ценность для пользователей платформы.

---

# Result (EN)

After completing this stage, the project has a stable business architecture that serves as the foundation for Application Architecture, Data Architecture and Technology Architecture.

---

# Итог (RU)

После завершения данного этапа проект получает устойчивую бизнес-архитектуру, которая становится основой для разработки Application Architecture, Data Architecture и Technology Architecture.