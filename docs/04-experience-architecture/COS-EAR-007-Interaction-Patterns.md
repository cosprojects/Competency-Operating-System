

# COS-EAR-007 — Interaction Patterns

**Status:** Draft  
**Owner:** Competency Operating System Team  
**Stage:** Experience Architecture  
**Version:** 1.0

---

# Purpose / Назначение

## English

This document defines the canonical interaction patterns used throughout the Competency Operating System (COS).

Interaction Patterns describe how the platform communicates with users while supporting their development journey. They define recurring models of interaction rather than interface components or visual behavior.

Every screen, workflow, and AI-assisted experience should be composed from these canonical patterns.

## Русский

Настоящий документ определяет канонические паттерны взаимодействия Competency Operating System (COS).

Interaction Patterns описывают, каким образом платформа взаимодействует с человеком на протяжении его пути развития. Документ определяет повторяющиеся модели взаимодействия, а не компоненты интерфейса или визуальные элементы.

Каждый экран, пользовательский сценарий и AI-взаимодействие должны строиться на основе этих канонических паттернов.

---

# Relationship to Experience Architecture / Связь с Experience Architecture

## English

Interaction Patterns bridge the gap between User Journeys and interface design.

- User Journeys describe **how the user evolves**.
- Interaction Patterns describe **how COS supports that evolution**.
- UI Components describe **how interactions are presented visually**.

## Русский

Interaction Patterns являются связующим звеном между маршрутами развития пользователя и дизайном интерфейсов.

- User Journeys описывают, **как меняется человек**.
- Interaction Patterns описывают, **как COS сопровождает эти изменения**.
- UI Components определяют, **как это взаимодействие выглядит в интерфейсе**.

---

# Canonical Interaction Patterns / Канонические паттерны взаимодействия

## 1. Discover / Исследование

**Purpose**

Help users better understand themselves.

**Interaction Flow**

```text
Question
      ↓
Analysis
      ↓
Insight
      ↓
Explanation
```

The system transforms data into understandable insights.

Система преобразует данные в понятные пользователю выводы.

---

## 2. Decide / Выбор

**Purpose**

Support informed decision-making.

**Interaction Flow**

```text
Current State
      ↓
Goal
      ↓
Available Options
      ↓
Recommendation
      ↓
Decision
```

The system does not replace user decisions; it provides context and recommendations.

Система не принимает решения за пользователя, а предоставляет контекст и рекомендации.

---

## 3. Develop / Развитие

**Purpose**

Guide users through meaningful development activities.

**Interaction Flow**

```text
Knowledge
      ↓
Practice
      ↓
Reflection
      ↓
Evidence
```

Development combines learning, practice, and real-world application.

Развитие объединяет обучение, практику и применение знаний.

---

## 4. Validate / Подтверждение

**Purpose**

Transform evidence into validated competency growth.

**Interaction Flow**

```text
Evidence
      ↓
Assessment
      ↓
Feedback
      ↓
Updated Profile
```

Every meaningful achievement should strengthen the competency profile.

Каждое значимое достижение должно усиливать профиль компетенций.

---

## 5. Evolve / Эволюция

**Purpose**

Open new opportunities after meaningful progress.

**Interaction Flow**

```text
Achievement
      ↓
New Opportunity
      ↓
Updated Journey
```

Progress is never presented as the end of the process. Every achievement naturally leads to the next stage of development.

Развитие никогда не заканчивается достижением цели. Каждый результат становится началом нового этапа.

---

# Design Implications / Последствия для проектирования

## English

Every feature implemented within COS should support one or more canonical interaction patterns.

New interaction models should only be introduced when they cannot be represented by the existing patterns.

This keeps the user experience predictable, coherent, and easy to learn.

## Русский

Каждая функция COS должна реализовывать один или несколько канонических паттернов взаимодействия.

Новые модели взаимодействия допускается вводить только в случае, если существующие паттерны не позволяют корректно описать необходимый пользовательский опыт.

Такой подход обеспечивает целостность, предсказуемость и простоту взаимодействия с системой.

---

# Summary / Итог

## English

Interaction Patterns establish a consistent language of interaction between users and COS. Regardless of role or feature, the platform always supports users through the same fundamental interaction models.

## Русский

Interaction Patterns формируют единый язык взаимодействия между пользователем и COS. Независимо от роли или функциональности системы, пользователь сталкивается с одними и теми же фундаментальными моделями взаимодействия, что делает опыт целостным и понятным.