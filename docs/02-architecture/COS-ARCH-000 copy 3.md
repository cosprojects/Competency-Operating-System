# COS-ARCH-000 — Mental Model

**Status:** Accepted  
**Version:** 1.0  
**Phase:** Foundation Architecture  
**Owner:** Competency Operating System (COS)  
**Last Updated:** 2026-07-12

---

# Purpose (EN)

This document provides a conceptual model of the Competency Operating System (COS).

Its purpose is to help readers understand how to think about the platform before studying the Foundation Book, Domain-Driven Design (DDD) documentation or Enterprise Architecture.

This document intentionally avoids implementation details and formal architectural terminology wherever possible.

---

# Назначение (RU)

Документ описывает концептуальную модель Competency Operating System (COS).

Его задача — помочь читателю понять, как следует воспринимать платформу до изучения Foundation Book, документации по Domain-Driven Design (DDD) и Enterprise Architecture.

Документ намеренно избегает деталей реализации и сложной архитектурной терминологии, объясняя устройство платформы простым языком.

---

# Why COS Exists (EN)

Most educational platforms focus on delivering learning content.

They answer questions such as:

- Which course should I take?
- Which lesson should I complete?
- What certificate will I receive?

COS answers a different question.

Instead of managing learning, COS manages professional development.

Learning is only one possible way to develop.

Professional experience, mentoring, projects, assessments, certifications and practice are equally important.

COS therefore models the entire development process rather than the educational process alone.

---

# Почему существует COS (RU)

Большинство образовательных платформ сосредоточены на предоставлении учебного контента.

Они отвечают на вопросы:

- Какой курс пройти?
- Какой урок открыть?
- Какой сертификат получить?

COS отвечает на другой вопрос.

Вместо управления обучением COS управляет профессиональным развитием человека.

Обучение является лишь одним из способов развития.

Практический опыт, наставничество, участие в проектах, прохождение оценки, получение сертификатов и ежедневная практика рассматриваются как равноправные источники развития компетенций.

Поэтому COS моделирует не образовательный процесс, а весь процесс развития человека.

---

# How to Think About COS (EN)

COS should not be viewed as a Learning Management System.

It should not be viewed as an online course platform.

It should not be viewed as a competency database.

Instead, COS should be understood as a continuously operating system that observes, evaluates and supports professional development.

Its primary responsibility is not delivering content.

Its primary responsibility is making informed development decisions.

---

# Как воспринимать COS (RU)

COS не следует рассматривать как классическую LMS.

Это не каталог курсов и не система хранения компетенций.

COS следует воспринимать как постоянно работающую интеллектуальную систему сопровождения профессионального развития.

Главная задача платформы — не выдавать образовательный контент.

Главная задача платформы — принимать обоснованные решения о дальнейшем развитии человека.

---

# Mental Models

## Mental Model 1

### COS is not a School

#### EN

A school delivers education.

COS supports continuous development.

Education is one instrument among many.

The platform remains valuable before learning begins, during learning and long after formal education has ended.

#### RU

Школа предоставляет образование.

COS сопровождает непрерывное развитие человека.

Обучение является лишь одним из множества инструментов развития.

Платформа остается полезной до начала обучения, во время обучения и после его завершения.

---

## Mental Model 2

### COS is not a Course Catalog

#### EN

Traditional educational platforms organize courses.

COS organizes development.

Courses are selected only when they contribute to achieving development goals.

#### RU

Традиционные образовательные платформы организуют курсы.

COS организует процесс развития.

Курсы подбираются только тогда, когда они действительно помогают достичь целей развития.

---

## Mental Model 3

### Competency is not a Certificate

#### EN

A certificate confirms that an assessment has been completed.

A competency reflects a person's actual capability.

Competencies evolve throughout professional life.

They may improve, decline, become obsolete or require confirmation.

#### RU

Сертификат подтверждает факт прохождения оценки.

Компетенция отражает реальные способности человека.

Компетенции изменяются на протяжении всей профессиональной жизни.

Они могут развиваться, деградировать, терять актуальность и требовать повторного подтверждения.

---

## Mental Model 4

### Development Path is not a Curriculum

#### EN

A curriculum is usually predefined.

A Development Path continuously adapts to changes in competency state, goals, methodology and available evidence.

The path is expected to evolve throughout the entire Development Journey.

#### RU

Учебная программа обычно создается заранее.

Траектория развития (Development Path) постоянно адаптируется в зависимости от изменений компетенций, целей развития, методологии и накопленных доказательств.

Предполагается, что траектория развития будет изменяться на протяжении всего пути развития человека.

---

## Mental Model 5

### Adaptive Development Engine is not an Algorithm

#### EN

The Adaptive Development Engine is the decision-making intelligence of the platform.

It continuously analyzes information from different parts of the domain and determines what should happen next.

Algorithms may change over time.

The responsibility of the engine remains the same.

#### RU

Adaptive Development Engine — это интеллектуальный механизм принятия решений платформы.

Он непрерывно анализирует информацию из различных частей предметной области и определяет, какие действия следует выполнить дальше.

Используемые алгоритмы могут изменяться.

Назначение Adaptive Development Engine остается неизменным.

---

# How COS Thinks

## EN

The Competency Operating System continuously observes changes within the development domain.

It does not simply recommend courses.

Instead, it continuously answers questions such as:

- What has changed?
- What should happen next?
- Which competencies require attention?
- Which goals remain relevant?
- What evidence is still missing?

The platform therefore behaves as an intelligent decision support system rather than a traditional educational platform.

---

## RU

Competency Operating System непрерывно наблюдает за изменениями в процессе развития человека.

Платформа не ограничивается рекомендацией учебных материалов.

Она постоянно отвечает на вопросы:

- Что изменилось?
- Что следует сделать дальше?
- Какие компетенции требуют внимания?
- Какие цели остаются актуальными?
- Каких подтверждений развития пока недостаточно?

Таким образом COS выступает интеллектуальной системой поддержки принятия решений, а не традиционной образовательной платформой.

---

# Understanding Bounded Context

## EN

Different parts of COS solve different business problems.

Each part has its own responsibility and its own understanding of the domain.

For example:

- Assessment evaluates competency.
- Learning Experience delivers learning.
- Development Profile maintains development history.
- Organization defines organizational policies.

Each part focuses only on its own business responsibility.

Together they form a complete system.

---

## RU

Разные части COS решают разные бизнес-задачи.

Каждая из них отвечает только за собственную область ответственности и по-своему рассматривает процесс развития.

Например:

- Assessment оценивает компетенции.
- Learning Experience организует процесс обучения.
- Development Profile хранит историю развития.
- Organization определяет корпоративные правила.

Каждый контекст отвечает только за собственную область знаний.

Вместе они образуют единую систему.

---

# Understanding Domain Events

## EN

A Domain Event represents a meaningful change within the business domain.

Examples include:

- competency state changed;
- assessment completed;
- evidence verified;
- development path updated.

Events allow different parts of the platform to react without becoming tightly coupled.

---

## RU

Domain Event представляет собой значимое изменение предметной области.

Например:

- изменилось состояние компетенции;
- завершилась оценка;
- подтверждено доказательство;
- обновлена траектория развития.

События позволяют различным частям платформы реагировать на изменения, не становясь жестко зависимыми друг от друга.

---

# Understanding Domain Services

## EN

Some business decisions require information from multiple parts of the platform.

These decisions cannot belong to a single business object.

Domain Services exist to make those decisions.

They coordinate business knowledge while leaving business data inside the appropriate domain models.

---

## RU

Некоторые бизнес-решения требуют информации сразу из нескольких частей платформы.

Такие решения невозможно закрепить за одной сущностью предметной области.

Для этого существуют Domain Services.

Они принимают бизнес-решения, используя знания нескольких контекстов, при этом сами данные продолжают храниться в соответствующих моделях предметной области.

---

# Why DDD Was Needed

## EN

The purpose of Domain-Driven Design was not to prepare microservices or databases.

Its purpose was to identify responsibilities.

DDD allowed COS to answer questions such as:

- Who owns each business concept?
- Who makes each business decision?
- Which information belongs together?
- How can the platform evolve without losing consistency?

---

## RU

Цель Domain-Driven Design заключалась не в проектировании микросервисов или базы данных.

Главной задачей было определить ответственность внутри предметной области.

DDD позволил ответить на вопросы:

- Кто отвечает за каждое бизнес-понятие?
- Кто принимает каждое бизнес-решение?
- Какие данные должны находиться вместе?
- Как развивать платформу, сохраняя целостность модели?

---

# Reading Order

## EN

The recommended reading order for the architecture documentation is:

1. COS-ARCH-000 — Mental Model
2. Foundation Book
3. Domain-Driven Design (DDD)
4. Enterprise Architecture
5. Application Architecture
6. Implementation Documentation

---

## RU

Рекомендуемый порядок изучения архитектурной документации:

1. COS-ARCH-000 — Mental Model
2. Foundation Book
3. Domain-Driven Design (DDD)
4. Enterprise Architecture
5. Application Architecture
6. Документация реализации

---

# Next Steps

## EN

After understanding this document, the reader should continue with the Foundation Book.

The Foundation Book explains why the platform exists.

The DDD documentation explains how the domain is organized.

Enterprise Architecture explains how the platform will be built.

---

## RU

После знакомства с данным документом рекомендуется перейти к Foundation Book.

Foundation Book объясняет назначение платформы.

DDD-документация описывает устройство предметной области.

Enterprise Architecture покажет, каким образом эта модель будет реализована в архитектуре системы.

---

# Architecture Principles Summary

## EN

The Competency Operating System is built on several fundamental ideas:

- development is continuous;
- competencies are dynamic;
- decisions should be evidence-based;
- adaptation is more valuable than standardization;
- business knowledge is distributed across specialized domains;
- the platform exists to support lifelong professional development.

---

## RU

Competency Operating System строится на нескольких фундаментальных идеях:

- развитие является непрерывным процессом;
- компетенции динамичны;
- решения должны приниматься на основе подтвержденных данных;
- адаптация важнее универсальных сценариев;
- бизнес-знания распределены между специализированными областями;
- главная цель платформы — сопровождать человека на протяжении всей профессиональной жизни.

---

# Final Thought

## EN

COS should be understood not as software for education, but as an operating system for human development.

Everything else in the repository expands this idea.

---

## RU

COS следует воспринимать не как программное обеспечение для обучения, а как операционную систему сопровождения развития человека.

Все остальные документы репозитория раскрывают и детализируют именно эту идею.