# COS-ADE-130 — Adaptive Routing

**Status:** Draft  
**Version:** 1.0  
**Phase:** Adaptive Development Engine  
**Owner:** Competency Operating System (COS)  
**Last Updated:** 2026-07-13

---

# Purpose (EN)

This document defines the Adaptive Routing model used by the Adaptive Development Engine (ADE).

Adaptive Routing determines the next optimal development action based on the current Competency State, trusted Evidence and applicable development policies.

Unlike traditional learning paths, adaptive routes are continuously recalculated throughout the competency development lifecycle.

---

# Назначение (RU)

Документ определяет модель Adaptive Routing, используемую Adaptive Development Engine (ADE).

Adaptive Routing определяет следующее оптимальное действие по развитию на основе текущего Competency State, доверенных Evidence и действующих политик развития.

В отличие от традиционных образовательных маршрутов, адаптивный маршрут непрерывно пересчитывается на протяжении всего жизненного цикла развития компетенций.

---

# Scope (EN)

Adaptive Routing answers the following questions:

- How is the next development action selected?
- How is the development route updated?
- When should the route change?
- How do development policies affect routing?
- How does routing support continuous competency development?

The document intentionally does not define:

- recommendation algorithms;
- competency evaluation methods;
- AI implementation;
- learning content selection.

---

# Область применения (RU)

Adaptive Routing отвечает на следующие вопросы:

- Каким образом выбирается следующее действие по развитию?
- Как обновляется маршрут развития?
- В каких случаях маршрут изменяется?
- Каким образом политики развития влияют на маршрутизацию?
- Как маршрутизация поддерживает непрерывное развитие компетенций?

Документ намеренно не описывает:

- алгоритмы рекомендаций;
- методы оценки компетенций;
- реализацию искусственного интеллекта;
- выбор конкретного учебного контента.

---

# Routing Principles (EN)

## Continuous Routing

Development routes are continuously updated.

There is no permanently fixed learning path.

---

## State Driven

Routing decisions are based on the current Competency State.

---

## Decision Driven

Every route modification originates from an Adaptive Decision.

---

## Evidence Responsive

New trusted Evidence may immediately affect the development route.

---

## Goal Oriented

Routing always aims to reduce the gap between the current and target competency states.

---

# Принципы маршрутизации (RU)

## Непрерывная маршрутизация

Маршрут развития непрерывно обновляется.

Фиксированный образовательный маршрут отсутствует.

---

## Основано на Competency State

Маршрутизация использует текущее состояние компетенций пользователя.

---

## Основано на Adaptive Decision

Любое изменение маршрута является результатом Adaptive Decision.

---

## Реакция на Evidence

Появление новых доверенных Evidence может привести к немедленному изменению маршрута.

---

## Ориентация на цель

Каждое изменение маршрута направлено на сокращение разрыва между текущим и целевым состоянием компетенции.

---

# Routing Inputs (EN)

Adaptive Routing consumes:

- Development Profile;
- Competency States;
- Adaptive Decision;
- Learning Policies;
- Organizational Constraints.

---

# Входные данные маршрутизации (RU)

Adaptive Routing использует:

- Development Profile;
- Competency State;
- Adaptive Decision;
- политики обучения;
- ограничения организации.

---

# Adaptive Routing Lifecycle (EN)

```text
Current Development Profile

↓

Competency State

↓

Adaptive Decision

↓

Next Development Action

↓

Development Route Updated

↓

Evidence

↓

Competency State Updated
```

Adaptive Routing updates only the next step of the development route.

The remaining route is continuously re-evaluated.

---

# Жизненный цикл маршрутизации (RU)

```text
Текущий Development Profile

↓

Competency State

↓

Adaptive Decision

↓

Следующее действие по развитию

↓

Обновление маршрута

↓

Evidence

↓

Обновленный Competency State
```

Adaptive Routing определяет только следующее действие маршрута.

Дальнейший маршрут непрерывно пересматривается по мере появления новой информации.

---

# Development Actions (EN)

Adaptive Routing may select different categories of development actions.

Examples include:

- learning;
- practice;
- project activity;
- mentoring;
- simulation;
- independent work;
- competency verification;
- reassessment.

The concrete implementation of each action is performed by the corresponding application services.

---

# Действия по развитию (RU)

Adaptive Routing может выбирать различные категории действий по развитию.

Например:

- обучение;
- практика;
- проектная деятельность;
- наставничество;
- симуляция;
- самостоятельная работа;
- подтверждение компетенции;
- повторная оценка.

Непосредственное выполнение каждого действия осуществляется соответствующими прикладными сервисами платформы.

---

# Route Recalculation (EN)

A development route may be recalculated whenever:

- new Evidence is processed;
- Competency State changes;
- organizational policies change;
- target competencies change;
- development methodology changes.

---

# Пересчет маршрута (RU)

Маршрут развития может быть пересчитан при:

- появлении новых Evidence;
- изменении Competency State;
- изменении политик организации;
- изменении целевых компетенций;
- изменении методологии развития.

---

# Relationship with Decision Model (EN)

Decision Model determines what the next adaptive decision should be.

Adaptive Routing transforms that decision into the next step of the development route.

---

# Связь с Decision Model (RU)

Decision Model определяет следующее Adaptive Decision.

Adaptive Routing преобразует это решение в следующий шаг маршрута развития пользователя.

---

# Relationship with Recommendation Logic (EN)

Adaptive Routing determines the next development action.

Recommendation Logic determines how that action should be presented to platform participants.

---

# Связь с Recommendation Logic (RU)

Adaptive Routing определяет следующее действие по развитию.

Recommendation Logic определяет способ представления этого действия пользователю и другим участникам процесса.

---

# Result (EN)

Adaptive Routing defines a continuous and adaptive mechanism for managing development routes based on current competency information rather than predefined educational plans.

---

# Итог (RU)

Adaptive Routing определяет непрерывный механизм управления маршрутами развития, основанный на текущем состоянии компетенций пользователя, а не на заранее заданных образовательных планах.