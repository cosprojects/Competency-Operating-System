# COS-ARCH-130 — Data Architecture

**Status:** Draft  
**Version:** 1.0  
**Phase:** Enterprise Architecture  
**Owner:** Competency Operating System (COS)  
**Last Updated:** 2026-07-12

---

# Purpose (EN)

This document defines the Data Architecture of the Competency Operating System (COS).

Data Architecture describes the business information managed by the platform, the ownership of that information and its lifecycle.

It does not define databases or storage technologies.

Instead, it defines the logical information model that supports the competency development ecosystem.

---

# Назначение (RU)

Документ определяет архитектуру данных Competency Operating System (COS).

Data Architecture описывает бизнес-информацию платформы, ее владельцев и жизненный цикл.

Документ не определяет базы данных или технологии хранения.

Его задача — сформировать логическую модель информации, необходимой для функционирования экосистемы развития компетенций.

---

# Scope (EN)

Data Architecture answers the following questions:

- Which business information exists?
- Which application service owns each information domain?
- How does information evolve?
- Which information is shared across services?
- What are the logical relationships between information domains?

The document intentionally does not define:

- databases;
- storage technologies;
- schemas;
- indexes;
- infrastructure.

---

# Область применения (RU)

Data Architecture отвечает на следующие вопросы:

- Какая бизнес-информация существует в платформе?
- Какой сервис является владельцем каждого информационного домена?
- Как развивается информация на протяжении жизненного цикла?
- Какая информация используется несколькими сервисами?
- Как связаны между собой информационные домены?

Документ намеренно не описывает:

- базы данных;
- технологии хранения;
- физические схемы;
- индексы;
- инфраструктуру.

---

# Data Architecture Principles (EN)

The Data Architecture of COS follows several principles.

## Business Information First

Information is modeled from a business perspective rather than a technical perspective.

## Single Ownership

Each information domain has exactly one owning application service.

## Shared Consumption

Information may be consumed by many services but modified only by its owner.

## Independent Evolution

Information domains evolve independently while preserving stable business contracts.

---

# Принципы Data Architecture (RU)

Архитектура данных COS строится на следующих принципах.

## Приоритет бизнес-информации

Информация моделируется исходя из бизнес-смысла, а не технической реализации.

## Единственный владелец

Каждый информационный домен имеет одного владельца.

## Совместное использование

Информация может использоваться многими сервисами, но изменяется только владельцем.

## Независимое развитие

Информационные домены могут развиваться независимо при сохранении стабильных бизнес-контрактов.

---

# Information Domains

| Information Domain | Owner Service |
|--------------------|---------------|
| Identity | Identity Service |
| Organization | Organization Service |
| Competency | Competency Service |
| Knowledge | Knowledge Service |
| Learning Content | Content Service |
| Learning Progress | Learning Service |
| Practice Session | Practice Service |
| Assessment | Verified Assessment Service |
| Evidence | Evidence Service |
| Development Profile | Development Profile Service |
| Recommendation | Recommendation Service |
| Analytics | Analytics Service |
| Certification | Certification Service |

---

# Information Ownership

Each information domain has a single authoritative owner.

The owner is responsible for:

- creation;
- validation;
- modification;
- lifecycle management;
- publication through business contracts.

No other application service may directly modify information owned by another service.

---

# Владение информацией

Каждый информационный домен имеет единственного владельца.

Владелец отвечает за:

- создание;
- проверку корректности;
- изменение;
- управление жизненным циклом;
- публикацию информации через прикладные контракты.

Другие сервисы не имеют права напрямую изменять принадлежащие ему данные.

---

# Information Lifecycle

The logical information lifecycle of COS is:

```text
Knowledge

↓

Learning Progress

↓

Practice Session

↓

Verified Assessment

↓

Evidence

↓

Competency

↓

Development Profile

↓

Adaptive Development
```

Every stage enriches the trusted information about the learner.

---

# Жизненный цикл информации

Основной поток информации в COS выглядит следующим образом.

```text
Knowledge

↓

Learning Progress

↓

Practice Session

↓

Verified Assessment

↓

Evidence

↓

Competency

↓

Development Profile

↓

Adaptive Development
```

Каждый этап дополняет доверенную информацию о развитии пользователя.

---

# Information Relationships

Information domains form a continuous chain of competency development.

Evidence connects verified assessments with competency evolution.

Development Profile aggregates information from multiple information domains while remaining an independent business object.

---

# Связи информационных доменов

Информационные домены образуют непрерывную цепочку развития компетенций.

Evidence связывает результаты подтвержденной оценки с развитием компетенций.

Development Profile агрегирует информацию из различных информационных доменов, сохраняя собственную ответственность.

---

# Relationship with Application Architecture (EN)

Application Architecture defines which service owns business responsibilities.

Data Architecture defines which service owns business information.

Every information domain belongs to exactly one application service.

---

# Связь с Application Architecture (RU)

Application Architecture определяет ответственность прикладных сервисов.

Data Architecture определяет владение информацией.

Каждый информационный домен принадлежит только одному прикладному сервису.

---

# Relationship with Integration Architecture (EN)

Integration Architecture defines how information is exchanged.

Data Architecture defines who owns the information being exchanged.

---

# Связь с Integration Architecture (RU)

Integration Architecture определяет способы обмена информацией.

Data Architecture определяет владельцев этой информации.

---

# Result (EN)

The project now possesses a stable business information model describing ownership and lifecycle of all major information domains.

This document becomes the foundation for Integration Architecture.

---

# Итог (RU)

Проект получает устойчивую модель бизнес-информации, определяющую владельцев и жизненный цикл основных информационных доменов.

Документ становится основой для проектирования Integration Architecture.