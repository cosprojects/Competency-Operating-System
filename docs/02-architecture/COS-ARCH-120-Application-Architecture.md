# COS-ARCH-120 — Application Architecture

**Status:** Draft  
**Version:** 1.0  
**Phase:** Enterprise Architecture  
**Owner:** Competency Operating System (COS)  
**Last Updated:** 2026-07-12

---

# Purpose (EN)

This document defines the Application Architecture of the Competency Operating System (COS).

Application Architecture translates Business Capabilities into collaborating application services.

Each application service implements one or more business capabilities while remaining independent from infrastructure and technology decisions.

The purpose of this document is to define the logical structure of the application layer and the responsibilities of each application service.

---

# Назначение (RU)

Документ определяет прикладную архитектуру Competency Operating System (COS).

Application Architecture преобразует бизнес-возможности в прикладные сервисы, которые совместно реализуют функциональность платформы.

Каждый прикладной сервис реализует одну или несколько бизнес-возможностей, сохраняя независимость от конкретных технологий и инфраструктуры.

Цель документа — определить логическую структуру прикладного уровня и ответственность каждого сервиса.

---

# Scope (EN)

Application Architecture answers the following questions:

- Which application services exist?
- Which business capabilities do they implement?
- How are responsibilities distributed?
- Which services collaborate?
- Where are the application boundaries?

The document intentionally does not define:

- APIs
- Databases
- Infrastructure
- Deployment
- Communication protocols

---

# Область применения (RU)

Application Architecture отвечает на следующие вопросы:

- Какие прикладные сервисы существуют?
- Какие бизнес-возможности они реализуют?
- Как распределяется ответственность?
- Какие сервисы взаимодействуют?
- Где проходят границы прикладной архитектуры?

Документ намеренно не описывает:

- API
- базы данных
- инфраструктуру
- способы развертывания
- протоколы взаимодействия

---

# Application Architecture Principles (EN)

Every application service:

- implements one or more Business Capabilities;
- owns a clearly defined responsibility;
- exposes business functionality rather than technical details;
- collaborates through explicit contracts;
- may evolve independently.

Application services must never duplicate responsibilities.

---

# Принципы Application Architecture (RU)

Каждый прикладной сервис:

- реализует одну или несколько бизнес-возможностей;
- обладает собственной областью ответственности;
- предоставляет бизнес-функции, а не технические детали;
- взаимодействует с другими сервисами через явные контракты;
- может развиваться независимо.

Ответственность сервисов не должна пересекаться.

---

# Application Services

| Service | Business Capability |
|----------|---------------------|
| Identity Service | Identity Management |
| Competency Service | Competency Management |
| Knowledge Service | Knowledge Management |
| Learning Service | Learning Delivery |
| Practice Service | Practice & Simulation |
| Verified Assessment Service | Verified Assessment |
| Evidence Service | Evidence Management |
| Development Profile Service | Development Profile |
| Adaptive Development Service | Adaptive Development |
| Recommendation Service | Recommendation |
| Organization Service | Organization Management |
| Content Service | Content Management |
| Analytics Service | Analytics |
| Communication Service | Communication |
| Notification Service | Notification |
| Certification Service | Certification |
| Administration Service | Administration |

---

# Application Responsibility Model

Every service owns its own business responsibility.

No application service directly manages another service's business data.

Cross-service collaboration happens only through defined contracts.

---

# Модель ответственности

Каждый сервис владеет собственной областью ответственности.

Ни один сервис не управляет внутренними данными другого сервиса.

Совместная работа осуществляется только через согласованные прикладные контракты.

---

# Verified Assessment

Verified Assessment Service coordinates the complete trusted assessment lifecycle.

The service may internally use specialized verification components responsible for identity verification, environment verification, exam monitoring, AI analysis and evidence validation.

These components are part of the Verified Assessment capability and may be developed as independent modules while remaining integral parts of the Competency Operating System.

---

# Verified Assessment

Сервис Verified Assessment координирует полный цикл проведения доверенного оценивания.

В своей работе сервис может использовать специализированные компоненты верификации, отвечающие за подтверждение личности, проверку условий проведения, мониторинг экзаменационного процесса, анализ с применением ИИ и проверку достоверности полученных данных.

Эти компоненты являются частью функционала Verified Assessment и могут разрабатываться как независимые модули, оставаясь при этом неотъемлемыми элементами системы Competency Operating System.

---

# Logical Service Collaboration

The primary application flow is:

```text
Learning Service

↓

Practice Service

↓

Verified Assessment Service

↓

Evidence Service

↓

Competency Service

↓

Development Profile Service

↓

Adaptive Development Service

↓

Recommendation Service
```

Supporting services cooperate throughout the lifecycle.

---

# Логическое взаимодействие сервисов

Основной поток прикладной архитектуры выглядит следующим образом.

```text
Learning Service

↓

Practice Service

↓

Verified Assessment Service

↓

Evidence Service

↓

Competency Service

↓

Development Profile Service

↓

Adaptive Development Service

↓

Recommendation Service
```

Поддерживающие сервисы взаимодействуют с данным процессом на различных этапах.

---

# Relationship with Business Capability Map (EN)

Each application service exists solely to implement one or more Business Capabilities.

No service should exist without a corresponding capability defined in COS-ARCH-110.

---

# Связь с Business Capability Map (RU)

Каждый прикладной сервис существует исключительно для реализации одной или нескольких бизнес-возможностей, определенных в COS-ARCH-110.

Создание сервисов вне Business Capability Map не допускается.

---

# Relationship with Data Architecture (EN)

The next architectural layer defines the information owned by each application service.

Application services own business responsibilities.

Data Architecture defines business information ownership.

---

# Связь с Data Architecture (RU)

Следующий архитектурный уровень определяет данные, которыми владеет каждый прикладной сервис.

Application Architecture определяет ответственность.

Data Architecture определяет владение информацией.

---

# Result (EN)

The project now possesses a stable logical application architecture derived directly from the Business Capability Map.

This document becomes the foundation for Data Architecture and Integration Architecture.

---

# Итог (RU)

Проект получает устойчивую прикладную архитектуру, непосредственно вытекающую из Business Capability Map.

Данный документ становится основой для проектирования Data Architecture и Integration Architecture.