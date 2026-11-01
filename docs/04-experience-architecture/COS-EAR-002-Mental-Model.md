---
id: COS-EAR-002
title: Mental Model
version: 1.1.0
status: Draft
owner: Competency Operating System Team
last_updated: 2026-10-28
references:
  - COS-EAR-003
  - COS-EAR-009
  - COS-EAR-012
  - COS-BP-005
  - COS-BP-007
  - COS-BP-009
---

# COS-EAR-002 — Mental Model

**Status:** Draft  
**Owner:** Competency Operating System Team  
**Stage:** Experience Architecture  
**Version:** 1.1.0

---

# Status and Roadmap Position / Состояние и место в дорожной карте

## English

**This document describes the target experience, not the current product.** The COS described here assumes a completed competency base, diagnostics and a Digital Competency Profile; none of these exist in the beta.

- **Shipped today (Beta 1, 2026-10-28):** a competency map — professions, competencies, knowledge and skills, external learning materials, email sign-in, favourites, self-tracked study statuses, feedback and first-party analytics. Implemented flows: `COS-EAR-012`.
- **Not in the product:** diagnostics, level assessment, micro-cases, competency passport, personal routes and runtime AI (`COS-REL-008`, ADR-001). The target diagnostics flow is `COS-EAR-009`.
- **Roadmap:** stage I of `COS-BP-005` (public beta) is in progress; this document describes the target of stages VII–IX. Monetization stages — `COS-BP-007` §7.1; year-1 operational plan — `COS-BP-009`.
- **Terminology:** "competency profile" and "progress" mean self-tracked marks; "competency passport" is reserved for the deferred diagnostics result (`COS-BP-007` §7.2).

**Beta 1 boundary for this document.** The «navigator» model cannot be used as a promise today: Beta 1 is a map, not a navigator. It answers «what does this profession consist of and where do I start», not the four questions above. Answering those requires diagnostics, goals and recommendations — stages VII–IX.

## Русский

**Документ описывает целевой опыт, а не текущий продукт.** COS, описанный здесь, предполагает собранную базу компетенций, диагностику и цифровой профиль компетенций; в Beta ничего из этого нет.

- **Что работает сегодня (Beta 1, 2026-10-28):** карта компетенций — профессии, компетенции, знания и навыки, внешние учебные материалы, вход по email, избранное, самоотметки статусов изучения, обратная связь и first-party аналитика. Реализованные сценарии — `COS-EAR-012`.
- **Чего в продукте нет:** диагностики, оценки уровня, микро-кейсов, паспорта компетенций, персональных маршрутов и ИИ в runtime (`COS-REL-008`, ADR-001). Целевой сценарий диагностики — `COS-EAR-009`.
- **Дорожная карта:** этап I `COS-BP-005` (публичная Beta) в работе; документ описывает целевое состояние этапов VII–IX. Этапы монетизации — `COS-BP-007` §7.1; операционный план первого года — `COS-BP-009`.
- **Термины:** «профиль компетенций» и «прогресс» — самоотметки; «паспорт компетенций» закреплён за результатом отложенной диагностики (`COS-BP-007` §7.2).

**Граница Beta 1 для этого документа.** Ментальная модель «навигатор» сегодня не может использоваться как обещание: Beta 1 — это карта, а не навигатор. Она отвечает на вопрос «из чего состоит профессия и с чего начать», но не на четыре вопроса выше. Ответы на них требуют диагностики, целей и рекомендаций — этапы VII–IX.

---
# Purpose / Назначение

## English

This document defines the mental model that the Competency Operating System (COS) should establish in the minds of its users.

The Mental Model is the foundation of the entire Experience Architecture. It determines how users perceive the platform, make decisions, understand progress, and interact with every feature of the system.

All user journeys, navigation, information architecture, interaction patterns, and interface components must reinforce this mental model.

## Русский

Настоящий документ определяет ментальную модель, которую Competency Operating System (COS) формирует у своих пользователей.

Mental Model является фундаментом всей Experience Architecture. Она определяет, как человек воспринимает платформу, принимает решения, понимает свой прогресс и взаимодействует со всеми возможностями системы.

Все пользовательские сценарии, навигация, информационная архитектура, паттерны взаимодействия и элементы интерфейса должны усиливать именно эту ментальную модель.

---

# The Core Mental Model / Основная ментальная модель

## English

Users should never perceive COS as a learning platform.

Instead, they should naturally understand a single idea:

> **COS is my navigator for professional development.**
>
> It shows where I am today, where I can go, and what the most valuable next step is.

The platform does not ask users to understand competencies, graphs, adaptive engines, or educational methodologies. Those belong to the internal architecture of the system.

The only model users need to understand is that COS continuously helps them move toward their professional goals.

## Русский

Пользователь никогда не должен воспринимать COS как образовательную платформу.

Вместо этого он должен естественным образом понимать одну простую идею:

> **COS — это навигатор моего профессионального развития.**
>
> Он показывает, где я нахожусь сейчас, куда могу прийти и какой следующий шаг даст наибольший эффект.

Платформа не требует понимания компетентностных моделей, графов знаний, адаптивных алгоритмов или образовательных методик. Всё это относится к внутренней архитектуре системы.

Единственная модель, которую должен понимать пользователь, — COS постоянно помогает двигаться к следующему уровню профессионального развития.

---

# The Four Questions / Четыре главных вопроса

## English

Every interaction in COS should help users answer four fundamental questions:

1. **Where am I now?** — What competencies do I currently possess?
2. **Where do I want to go?** — What role, goal, or professional direction am I pursuing?
3. **What is preventing me?** — Which competency gaps separate my current state from my desired future?
4. **What should I do next?** — Which action will produce the greatest positive impact right now?

## Русский

Каждое взаимодействие с COS должно помогать человеку ответить всего на четыре вопроса:

1. **Где я сейчас?** — Какими компетенциями я уже обладаю?
2. **Куда я хочу попасть?** — Какой роли, цели или профессионального направления я хочу достичь?
3. **Что мне мешает?** — Каких компетенций мне не хватает для достижения цели?
4. **Что делать дальше?** — Какой следующий шаг принесет наибольший эффект?

---

# Experience Principle / Принцип проектирования опыта

## English

Whenever a design decision is made, it should be evaluated against a single question:

> **Does this help the user feel that COS is guiding their professional journey?**

If the answer is no, the solution should be reconsidered.

## Русский

Любое проектное решение должно проверяться одним вопросом:

> **Помогает ли это решение пользователю чувствовать, что COS сопровождает его профессиональное развитие?**

Если ответ отрицательный, решение требует пересмотра.

---

# История изменений / Change History

| Версия | Дата | Что изменилось |
|---|---|---|
| 1.0.0 | — | Первая редакция; дата в документе не фиксировалась |
| 1.1.0 | 2026-10-28 | Добавлен раздел «Состояние и место в дорожной карте»: граница между целевым опытом и Beta 1, этапы `COS-BP-005`, план первого года `COS-BP-009`, терминологическая граница `COS-BP-007`; добавлен frontmatter по `COS-010` |
