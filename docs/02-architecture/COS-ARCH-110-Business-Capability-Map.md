# COS-ARCH-110 — Business Capability Map

**Status:** Draft  
**Version:** 1.0  
**Phase:** Enterprise Architecture  
**Owner:** Competency Operating System (COS)  
**Last Updated:** 2026-07-12

---

# Purpose (EN)

This document defines the Business Capability Map of the Competency Operating System (COS).

A Business Capability represents what the platform is able to accomplish from a business perspective, independent of software implementation, organizational structure or technology.

Business Capabilities provide the foundation for Application Architecture and ensure that technical services are derived from business needs rather than implementation choices.

---

# Назначение (RU)

Документ определяет карту бизнес-возможностей Competency Operating System (COS).

Бизнес-возможность (Business Capability) описывает способность платформы выполнять определенную бизнес-функцию независимо от программной реализации, организационной структуры или используемых технологий.

Business Capability Map является связующим звеном между Domain-Driven Design и Application Architecture.

---

# Scope (EN)

The Business Capability Map answers the following questions:

- What business capabilities exist within COS?
- Which capabilities create the core value of the platform?
- Which capabilities support the competency development lifecycle?
- How do capabilities cooperate?
- Which capabilities become application services later?

The document intentionally does not define:

- software services;
- APIs;
- databases;
- infrastructure;
- implementation details.

---

# Область применения (RU)

Business Capability Map отвечает на следующие вопросы:

- Какие бизнес-возможности существуют в COS?
- Какие возможности формируют основную ценность платформы?
- Какие возможности участвуют в жизненном цикле развития компетенций?
- Как бизнес-возможности взаимодействуют между собой?
- Какие возможности впоследствии будут реализованы прикладными сервисами?

Документ намеренно не описывает:

- программные сервисы;
- API;
- базы данных;
- инфраструктуру;
- детали реализации.

---

# Capability Principles (EN)

Business Capabilities describe stable business functions.

Each capability:

- is independent of technology;
- is independent of implementation;
- owns a single business responsibility;
- delivers measurable business value;
- may evolve without changing its business purpose.

---

# Принципы Business Capability (RU)

Business Capability описывает устойчивую бизнес-функцию платформы.

Каждая бизнес-возможность:

- независима от технологий;
- независима от программной реализации;
- обладает собственной областью ответственности;
- создает измеримую ценность;
- может изменять внутреннюю реализацию без изменения бизнес-назначения.

---

# Capability Hierarchy (EN)

Business Capabilities are grouped into three logical layers.

## Core Capabilities

Business capabilities that define the value proposition of COS.

Without these capabilities the platform cannot fulfill its mission.

## Supporting Capabilities

Capabilities that enable and strengthen the core competency development process.

## Platform Capabilities

Capabilities required for sustainable operation, administration and governance.

---

# Иерархия возможностей (RU)

Все бизнес-возможности COS разделяются на три уровня.

## Core Capabilities

Основные возможности, формирующие ценность платформы.

Без них Competency Operating System теряет свое назначение.

## Supporting Capabilities

Возможности, обеспечивающие и усиливающие основные процессы развития компетенций.

## Platform Capabilities

Возможности, необходимые для эксплуатации, управления и сопровождения платформы.

---

# Core Business Capabilities

| Capability | Description |
|------------|-------------|
| Competency Management | Управление моделью компетенций и уровнями развития |
| Knowledge Management | Управление знаниями, навыками и образовательной моделью |
| Learning Delivery | Предоставление образовательного опыта |
| Practice & Simulation | Практические задания, тренажеры и симуляции |
| Verified Assessment | Доверенная оценка результатов обучения и практики |
| Evidence Management | Управление подтвержденными доказательствами развития |
| Adaptive Development | Построение и динамическая корректировка индивидуального маршрута развития |
| Development Profile | Формирование доверенного цифрового профиля развития пользователя |
| Recommendation | Персональные рекомендации по дальнейшему развитию |

---

# Capability Development Flow

The core value of COS is created through a continuous competency development lifecycle.

```text
Learning

↓

Practice & Simulation

↓

Verified Assessment

↓

Evidence Management

↓

Competency Management

↓

Development Profile

↓

Adaptive Development
```

Each capability contributes to the formation of a trusted Development Profile.

---

# Цепочка формирования ценности

Основная ценность COS создается через непрерывный жизненный цикл развития компетенций.

```text
Обучение

↓

Практика и симуляции

↓

Подтвержденная оценка (Verified Assessment)

↓

Управление доказательствами (Evidence)

↓

Управление компетенциями

↓

Профиль развития

↓

Адаптивное развитие
```

Каждая бизнес-возможность участвует в формировании доверенного цифрового профиля развития пользователя.

---

# Supporting Business Capabilities

| Capability | Description |
|------------|-------------|
| Identity Management | Управление пользователями и идентификацией |
| Organization Management | Управление организациями и командами |
| Content Management | Управление образовательным контентом |
| Analytics | Аналитика процессов обучения и развития |
| Communication | Взаимодействие участников образовательного процесса |
| Notification | Уведомления пользователей |
| Certification | Выдача сертификатов на основании подтвержденных Evidence |

---

# Platform Capabilities

| Capability | Description |
|------------|-------------|
| Administration | Администрирование платформы |
| Configuration | Конфигурация системы |
| Audit | Аудит действий |
| Security Management | Управление безопасностью |
| Integration Management | Интеграция с внешними системами |

---

# Capability Relationships (EN)

Business Capabilities cooperate to create a trusted competency development ecosystem.

Each capability owns a distinct business responsibility.

Capabilities may depend on one another but remain independently evolvable.

---

# Связи между возможностями (RU)

Бизнес-возможности совместно формируют единую систему развития компетенций.

Каждая возможность обладает собственной ответственностью.

Возможности могут использовать результаты друг друга, сохраняя независимость своего развития.

---

# Relationship with Domain-Driven Design (EN)

Business Capabilities are built upon the bounded contexts defined during Domain-Driven Design.

DDD defines business ownership.

Business Capability Map defines business functionality.

---

# Связь с Domain-Driven Design (RU)

Business Capability Map строится поверх предметных областей, определенных в Domain-Driven Design.

DDD определяет границы ответственности.

Business Capability Map определяет бизнес-возможности этих областей.

---

# Relationship with Business Architecture (EN)

Business Architecture defines how the business is organized.

Business Capability Map defines what the business is capable of doing.

---

# Связь с Business Architecture (RU)

Business Architecture описывает устройство бизнеса.

Business Capability Map определяет возможности бизнеса.

---

# Relationship with Application Architecture (EN)

Each Business Capability will later be implemented by one or more application services.

Verified Assessment is implemented as an independent application service.

The implementation may use an external Proctor Digital System (PDS) through a dedicated integration layer without changing the business capability model.

---

# Связь с Application Architecture (RU)

Каждая бизнес-возможность в дальнейшем будет реализована одним или несколькими прикладными сервисами.

Verified Assessment реализуется отдельным прикладным сервисом.

Техническая реализация может использовать внешний Proctor Digital System (PDS) через слой интеграции, при этом бизнес-модель платформы остается неизменной.

---

# Result (EN)

The project now possesses a stable Business Capability Map describing the complete competency development lifecycle.

This document becomes the primary business foundation for Application Architecture.

---

# Итог (RU)

Проект получает устойчивую карту бизнес-возможностей, описывающую полный жизненный цикл развития компетенций.

Business Capability Map становится основной бизнес-моделью для последующего проектирования Application Architecture.