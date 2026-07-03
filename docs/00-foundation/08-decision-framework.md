---
id: COS-008
title: Decision Framework
version: 1.0.0
status: Draft
owner: Product Team

references:
  - COS-001
  - COS-002
  - COS-003
  - COS-004
  - COS-005
  - COS-006
  - COS-007
---

# Decision Framework

This document defines how product, design and engineering decisions are made within Competency Operating System.

The goal of this framework is to ensure that every decision strengthens the platform instead of increasing unnecessary complexity.

---

# 🇬🇧 English

## Decision Process

Every significant decision should be evaluated in the following order.

### 1. Does it support the North Star?

Will this decision help people or organizations develop more effectively?

If not, stop.

---

### 2. Does it strengthen the Development Engine?

Does it improve development, assessment, methodology or decision-making?

If not, reconsider.

---

### 3. Is it part of our core domain?

Should COS own this capability?

Or is an existing external solution better?

If integration is sufficient, integration should be preferred.

---

### 4. Is it reusable?

Can this capability work across multiple industries, organizations and methodologies?

If it only solves one specific scenario, it probably does not belong in the platform core.

---

### 5. Does it reduce or increase complexity?

Every new feature introduces complexity.

The value created must clearly exceed the complexity added.

---

### 6. Is it understandable?

Can we explain this feature in one minute?

Can a user understand why it exists?

If not, simplify it.

---

### 7. Can it be measured?

Every feature should have a measurable outcome.

If success cannot be measured, the feature should be reconsidered.

---

### 8. Does it respect our principles?

Every decision must comply with:

- Product Vision
- Product Manifesto
- Architecture Principles
- Design Principles

If conflicts exist, they must be resolved before implementation.

---

## Final Rule

When in doubt, choose the solution that keeps the platform simpler, more adaptable and more focused on human development.

---

# 🇷🇺 Русский

# Процесс принятия решений

Любое значимое продуктовое, дизайнерское или архитектурное решение проходит последовательную проверку.

---

### 1. Соответствует ли это North Star?

Помогает ли это решение людям или организациям развиваться эффективнее?

Если нет — решение отклоняется.

---

### 2. Усиливает ли это Development Engine?

Улучшает ли решение процесс развития, оценки, проектирования методологий или принятия решений?

Если нет — необходимо пересмотреть решение.

---

### 3. Относится ли это к нашей предметной области?

Должен ли COS владеть этой возможностью?

Или лучше использовать существующее решение через интеграцию?

Если зрелая интеграция существует, предпочтение отдается интеграции.

---

### 4. Можно ли использовать это повторно?

Будет ли решение полезно в различных организациях, отраслях и методологиях?

Если оно решает только один частный случай, его не следует включать в ядро платформы.

---

### 5. Что это делает со сложностью системы?

Каждая новая функция увеличивает сложность.

Создаваемая ценность должна существенно превосходить эту сложность.

---

### 6. Понятно ли это пользователю?

Можно ли объяснить новую возможность за одну минуту?

Поймет ли пользователь, зачем она существует?

Если нет — решение следует упростить.

---

### 7. Можно ли измерить результат?

Для каждой новой функции должны существовать измеримые критерии успеха.

Если невозможно оценить эффективность, решение необходимо пересмотреть.

---

### 8. Соответствует ли это фундаментальным принципам проекта?

Любое решение должно соответствовать:

- North Star
- Product Vision
- Product Manifesto
- Architecture Principles
- Design Principles

Если возникает противоречие, оно должно быть устранено до начала реализации.

---

## Главное правило

Если существует несколько возможных решений, предпочтение всегда отдается тому, которое:

- делает платформу проще;
- сохраняет универсальность;
- усиливает Development Engine;
- помогает людям развиваться эффективнее.