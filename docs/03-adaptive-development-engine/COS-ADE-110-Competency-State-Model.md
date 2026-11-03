# COS-ADE-110 — Competency State Model

**Status:** Draft  
**Version:** 1.0  
**Phase:** Adaptive Development Engine  
**Owner:** Competency Operating System (COS)  
**Last Updated:** 2026-07-13

---

# Purpose (EN)

This document defines the Competency State Model used by the Adaptive Development Engine (ADE).

The Competency State represents the current evaluated state of a learner's competency based on trusted evidence, organizational policies and development methodology.

It serves as the primary analytical object consumed by the Decision Model.

---

# Назначение (RU)

Документ определяет модель состояния компетенции (Competency State Model), используемую Adaptive Development Engine (ADE).

Competency State представляет собой текущую оценку состояния компетенции пользователя, сформированную на основе доверенных Evidence, политик организации и методологии развития.

Именно Competency State является основным аналитическим объектом, используемым Decision Model.

---

# Scope (EN)

The Competency State Model answers the following questions:

- What is the current state of a competency?
- Which characteristics describe this state?
- How is the state evaluated?
- How does the state evolve over time?
- How does the state support adaptive decisions?

The document intentionally does not define:

- storage technologies;
- evaluation algorithms;
- scoring formulas;
- implementation details.

---

# Область применения (RU)

Competency State Model отвечает на следующие вопросы:

- Что представляет собой текущее состояние компетенции?
- Какими характеристиками оно описывается?
- Как оценивается состояние?
- Как оно изменяется во времени?
- Как состояние используется при принятии адаптивных решений?

Документ намеренно не описывает:

- технологии хранения;
- алгоритмы оценки;
- математические формулы;
- детали реализации.

---

# State Principles

## Evaluated, Not Stored

A Competency State is an evaluated representation rather than a permanent record.

---

## Dynamic

The state may change whenever new trusted information becomes available.

---

## Evidence-Based

Every state is derived from trusted evidence.

---

## Explainable

Every evaluated state must be explainable.

---

## Methodology-Driven

State evaluation follows the selected development methodology.

---

# Принципы модели состояния

## Оценка, а не запись

Competency State представляет собой результат оценки, а не неизменяемую запись.

---

## Динамичность

Состояние изменяется при появлении новой доверенной информации.

---

## Основано на Evidence

Любое состояние формируется исключительно на основе Evidence.

---

## Объяснимость

Каждая оценка состояния должна иметь объяснение.

---

## Следование методологии

Оценка состояния выполняется в соответствии с выбранной методологией развития.

---

# Competency State Structure

A Competency State consists of mandatory and optional dimensions.

## Mandatory Dimensions

- Current Level
- Confidence
- Target Gap

## Optional Dimensions

Examples include:

- Practical Readiness
- Evidence Coverage
- Development Velocity
- Stability
- Decay Risk
- Last Evaluation

The model is extensible and additional dimensions may be introduced without changing the core architecture.

---

# Структура состояния компетенции

Competency State состоит из обязательных и расширяемых характеристик.

## Обязательные характеристики

- Текущий уровень
- Уровень доверия
- Разрыв до целевого состояния

## Расширяемые характеристики

Например:

- Практическая готовность
- Полнота Evidence
- Скорость развития
- Устойчивость
- Риск деградации
- Последняя оценка

Модель является расширяемой и допускает добавление новых характеристик без изменения архитектуры платформы.

---

# State Lifecycle

```text
Competency Definition

↓

Evidence

↓

State Evaluation

↓

Competency State

↓

Development Profile

↓

Adaptive Decision
```

The Competency State is continuously re-evaluated as new trusted evidence becomes available.

---

# Жизненный цикл состояния

```text
Описание компетенции

↓

Evidence

↓

Оценка состояния

↓

Competency State

↓

Development Profile

↓

Adaptive Decision
```

Состояние компетенции непрерывно переоценивается по мере появления новых доверенных Evidence.

---

# Relationship with Evidence Processing

Evidence Processing prepares trusted evidence.

The Competency State Model transforms trusted evidence into an evaluated competency state.

---

# Связь с Evidence Processing

Evidence Processing подготавливает доверенные Evidence.

Competency State Model преобразует их в оценку текущего состояния компетенции.

---

# Relationship with Decision Model

The Decision Model does not analyse raw evidence directly.

It operates on evaluated Competency States.

---

# Связь с Decision Model

Decision Model не анализирует Evidence напрямую.

Все решения принимаются на основе Competency State.

---

# Result (EN)

The Competency State Model defines the evaluated representation of a learner's competency and provides the analytical foundation for adaptive decision making.

---

# Итог (RU)

Competency State Model определяет модель оценки текущего состояния компетенции пользователя и формирует аналитическую основу для принятия адаптивных решений.