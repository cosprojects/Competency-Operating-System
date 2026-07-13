# COS-ADE-140 — Recommendation Logic

**Status:** Draft  
**Version:** 1.0  
**Phase:** Adaptive Development Engine  
**Owner:** Competency Operating System (COS)  
**Last Updated:** 2026-07-13

---

# Purpose (EN)

This document defines the Recommendation Logic used by the Adaptive Development Engine (ADE).

Recommendation Logic transforms Adaptive Decisions into personalized recommendations suitable for different participants of the competency development process.

The Recommendation Logic does not create decisions.

It communicates previously approved Adaptive Decisions.

---

# Назначение (RU)

Документ определяет модель Recommendation Logic, используемую Adaptive Development Engine (ADE).

Recommendation Logic преобразует Adaptive Decision в персонализированные рекомендации для различных участников процесса развития компетенций.

Recommendation Logic не принимает решений.

Она представляет пользователям уже сформированные Adaptive Decision.

---

# Scope (EN)

Recommendation Logic answers the following questions:

- How are Adaptive Decisions presented?
- How are recommendations personalized?
- How are recommendations explained?
- How do recommendations differ for different roles?

The document intentionally does not define:

- decision making;
- competency evaluation;
- adaptive routing;
- prediction.

---

# Область применения (RU)

Recommendation Logic отвечает на следующие вопросы:

- Как представляются Adaptive Decision?
- Каким образом персонализируются рекомендации?
- Как объясняются рекомендации?
- Чем отличаются рекомендации для различных ролей?

Документ намеренно не описывает:

- принятие решений;
- оценку компетенций;
- маршрутизацию;
- прогнозирование.

---

# Recommendation Principles

## Decision Preservation

Recommendations never modify Adaptive Decisions.

---

## Role Awareness

Recommendations are adapted to participant responsibilities.

---

## Explainability

Every recommendation explains:

- why;
- what;
- expected outcome.

---

## Context Awareness

Recommendations consider organizational context, methodology and participant role.

---

# Принципы рекомендаций

## Сохранение решения

Recommendation не изменяет Adaptive Decision.

---

## Учет роли

Рекомендации адаптируются под роль участника процесса.

---

## Объяснимость

Каждая рекомендация отвечает на вопросы:

- почему;
- что необходимо сделать;
- какого результата ожидает система.

---

## Учет контекста

Рекомендации формируются с учетом организации, методологии и роли пользователя.

---

# Recommendation Lifecycle

```text
Adaptive Decision

↓

Role Analysis

↓

Recommendation Generation

↓

Explanation

↓

Publication
```

---

# Жизненный цикл рекомендации

```text
Adaptive Decision

↓

Определение роли

↓

Формирование рекомендации

↓

Формирование объяснения

↓

Публикация
```

---

# Recommendation Roles

Recommendations may be generated for:

- Learner;
- Mentor;
- Teacher;
- Manager;
- Organization;
- Administrator.

Each role receives its own presentation of the same Adaptive Decision.

---

# Роли получателей

Рекомендации могут формироваться для:

- обучающегося;
- наставника;
- преподавателя;
- руководителя;
- организации;
- администратора.

Каждая роль получает собственное представление одного и того же Adaptive Decision.

---

# Relationship with Adaptive Routing

Adaptive Routing determines the next Development Action.

Recommendation Logic communicates this action.

---

# Связь с Adaptive Routing

Adaptive Routing определяет следующее действие по развитию.

Recommendation Logic представляет это действие участникам процесса.

---

# Relationship with Prediction Model

Prediction Model may enrich recommendations with future development forecasts.

Recommendation Logic does not perform prediction itself.

---

# Связь с Prediction Model

Prediction Model может дополнять рекомендации прогнозами развития.

Recommendation Logic самостоятельно прогнозирование не выполняет.

---

# Result (EN)

Recommendation Logic provides a consistent, explainable and role-aware communication layer between Adaptive Decisions and platform participants.

---

# Итог (RU)

Recommendation Logic определяет единый механизм представления Adaptive Decision различным участникам процесса развития компетенций, сохраняя объяснимость и соответствие ролям.