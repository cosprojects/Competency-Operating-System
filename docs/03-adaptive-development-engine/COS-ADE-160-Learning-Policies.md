# COS-ADE-160 — Learning Policies

**Status:** Draft  
**Version:** 1.0  
**Phase:** Adaptive Development Engine  
**Owner:** Competency Operating System (COS)  
**Last Updated:** 2026-07-13

---

# Purpose (EN)

This document defines the Learning Policies used by the Adaptive Development Engine (ADE).

Learning Policies establish the organizational, methodological and regulatory constraints governing adaptive decision making throughout the competency development lifecycle.

Policies define the boundaries within which Adaptive Decisions may be generated.

---

# Назначение (RU)

Документ определяет модель Learning Policies, используемую Adaptive Development Engine (ADE).

Learning Policies устанавливают организационные, методологические и нормативные ограничения, которым должно соответствовать принятие адаптивных решений на протяжении всего жизненного цикла развития компетенций.

Политики определяют границы, в рамках которых могут формироваться Adaptive Decision.

---

# Scope (EN)

Learning Policies answer the following questions:

- Which adaptive decisions are permitted?
- Which organizational rules must be respected?
- Which methodological requirements are mandatory?
- Which verification rules apply?
- How do policies influence adaptive development?

The document intentionally does not define:

- decision algorithms;
- competency evaluation;
- prediction methods;
- implementation technologies.

---

# Область применения (RU)

Learning Policies отвечают на следующие вопросы:

- Какие Adaptive Decision являются допустимыми?
- Какие организационные правила необходимо соблюдать?
- Какие требования методологии являются обязательными?
- Какие правила подтверждения компетенций применяются?
- Каким образом политики влияют на адаптивное развитие?

Документ намеренно не описывает:

- алгоритмы принятия решений;
- оценку компетенций;
- методы прогнозирования;
- технологии реализации.

---

# Policy Principles (EN)

## Policy Before Decision

Every Adaptive Decision shall comply with all applicable Learning Policies.

---

## Organization Specific

Policies may differ between organizations while preserving the common Decision Model.

---

## Methodology Driven

Policies shall support the selected development methodology.

---

## Explainability

Every policy affecting a decision shall be identifiable and explainable.

---

## Consistency

Policies shall produce consistent results for identical situations.

---

# Принципы политик (RU)

## Приоритет политик

Каждое Adaptive Decision должно соответствовать применимым Learning Policies.

---

## Специфика организации

Организации могут использовать собственные политики, не изменяя Decision Model.

---

## Следование методологии

Политики должны соответствовать выбранной методологии развития.

---

## Объяснимость

Любая политика, повлиявшая на решение, должна быть известна и объяснима.

---

## Последовательность

Одинаковые ситуации должны приводить к одинаковому применению политик.

---

# Policy Categories (EN)

Learning Policies may include:

## Development Policies

Rules governing competency development.

---

## Assessment Policies

Rules governing competency assessment.

---

## Verified Assessment Policies

Rules defining when verified assessment is mandatory.

---

## Certification Policies

Rules governing competency certification.

---

## Organizational Policies

Organization-specific development requirements.

---

## Compliance Policies

Regulatory and legal requirements.

---

# Категории политик (RU)

Learning Policies могут включать:

## Политики развития

Правила сопровождения развития компетенций.

---

## Политики оценки

Правила проведения оценки компетенций.

---

## Политики Verified Assessment

Правила обязательного подтверждения результатов оценки.

---

## Политики сертификации

Правила присвоения компетенций.

---

## Организационные политики

Внутренние требования организации.

---

## Политики соответствия

Требования законодательства и нормативных документов.

---

# Policy Evaluation (EN)

Before publishing an Adaptive Decision the engine evaluates all applicable policies.

Policies may:

- permit a decision;
- restrict a decision;
- require additional development actions;
- require additional verification;
- reject a decision.

---

# Проверка политик (RU)

Перед публикацией Adaptive Decision движок проверяет применимые Learning Policies.

Политики могут:

- разрешить решение;
- ограничить решение;
- потребовать дополнительные действия по развитию;
- потребовать дополнительную проверку;
- отклонить решение.

---

# Policy Hierarchy (EN)

When multiple policies apply simultaneously, evaluation follows the predefined policy hierarchy.

More restrictive policies take precedence over less restrictive policies.

The policy hierarchy is defined by the organization.

---

# Иерархия политик (RU)

Если одновременно применяются несколько политик, их проверка выполняется в соответствии с установленной иерархией.

Более строгие политики имеют приоритет над менее строгими.

Конкретная иерархия определяется организацией.

---

# Policy Lifecycle (EN)

```text
Policy Definition

↓

Policy Publication

↓

Policy Evaluation

↓

Adaptive Decision

↓

Policy Review

↓

Policy Update
```

Policies evolve independently from the Decision Model.

---

# Жизненный цикл политик (RU)

```text
Определение политики

↓

Публикация политики

↓

Проверка политики

↓

Adaptive Decision

↓

Анализ применения

↓

Обновление политики
```

Learning Policies могут изменяться независимо от Decision Model.

---

# Relationship with Decision Model (EN)

The Decision Model generates Adaptive Decisions.

Learning Policies determine whether those decisions are permissible.

---

# Связь с Decision Model (RU)

Decision Model формирует Adaptive Decision.

Learning Policies определяют допустимость сформированного решения.

---

# Relationship with Enterprise Architecture (EN)

Learning Policies represent business rules originating from the Enterprise Architecture.

The Adaptive Development Engine applies these rules during adaptive decision making.

---

# Связь с Enterprise Architecture (RU)

Learning Policies являются реализацией бизнес-правил, определенных в Enterprise Architecture.

Adaptive Development Engine использует эти правила в процессе принятия адаптивных решений.

---

# Result (EN)

Learning Policies establish the organizational governance framework for adaptive decision making while preserving a unified Decision Model across different organizations.

---

# Итог (RU)

Learning Policies определяют систему организационного управления процессом принятия адаптивных решений, позволяя различным организациям использовать единый Adaptive Development Engine без изменения его базовой логики.