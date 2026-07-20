

# COS-EAR-005 — Navigation Architecture

**Status:** Draft  
**Owner:** Competency Operating System Team  
**Stage:** Experience Architecture  
**Version:** 1.0

---

# Purpose / Назначение

## English

This document defines the navigation architecture of the Competency Operating System (COS).

Navigation within COS operates on two complementary layers. Structural Navigation enables users to access the platform's capabilities, while Development Navigation guides users through their professional development journey. Together they ensure that users can both find functionality and continuously understand their next best step. The purpose of navigation is to continuously answer one question:

> **Where am I, and what is my best next step?**

## Русский

Настоящий документ определяет архитектуру навигации Competency Operating System (COS).

Навигация в COS построена на двух взаимодополняющих уровнях. Структурная навигация обеспечивает доступ к возможностям платформы, а навигация развития сопровождает человека на пути его профессионального роста. Вместе они позволяют пользователю одновременно понимать, где находится нужная функция и какой следующий шаг приблизит его к цели. Главная задача навигации — постоянно отвечать на один вопрос:

> **Где я сейчас и какой следующий шаг будет наиболее ценным?**

---

# Navigation Vision / Видение навигации

## English

Users should never feel that they are navigating an application.

Instead, they should feel that they are navigating their own development.

Every interaction should strengthen the perception that COS always knows the current position, understands the destination, and can suggest the most valuable route forward.

## Русский

Пользователь не должен ощущать, что он перемещается по приложению.

Он должен ощущать, что движется по собственному пути развития.

Каждое взаимодействие должно усиливать ощущение, что COS знает текущее положение пользователя, понимает его цель и способен предложить наиболее ценный маршрут.

### Organizational Perspective / Организационная перспектива

#### English

The navigation model applies equally to individuals and organizations.

An individual navigates toward personal competency goals, while an organization navigates toward business objectives through the collective development of its people.

The experience should therefore present organizations as living systems that continuously evolve rather than static administrative structures.

#### Русский

Модель навигации одинаково применима как к отдельному человеку, так и к организации.

Человек движется к личным профессиональным целям, а организация — к бизнес-целям через развитие своих сотрудников.

Поэтому организация должна восприниматься не как набор административных разделов, а как развивающаяся система, состояние которой постоянно изменяется.

---

# Two Navigation Layers / Два уровня навигации

## English

### Structural Navigation

Structural Navigation organizes the platform into discoverable capabilities such as Journey, Knowledge, Organization, Profile, and Settings. Its purpose is to help users locate functions and information efficiently.

It answers the question:

> **Where is the functionality I need?**

### Development Navigation

Development Navigation is unique to COS. It accompanies users throughout their competency development journey by continuously presenting their current state, destination, competency gaps, and the most valuable next action.

It answers the question:

> **What should I do next to achieve my goal?**

The two layers work together: Structural Navigation provides orientation within the product, while Development Navigation provides orientation within the user's professional growth.

## Русский

### Структурная навигация

Структурная навигация организует возможности платформы в понятные разделы, такие как Journey, Knowledge, Organization, Profile и Settings. Ее задача — помогать пользователю быстро находить необходимые функции и информацию.

Она отвечает на вопрос:

> **Где находится нужная функция?**

### Навигация развития

Навигация развития является отличительной особенностью COS. Она сопровождает пользователя на протяжении всего пути развития компетенций, постоянно показывая текущее состояние, цель, дефициты компетенций и наиболее ценный следующий шаг.

Она отвечает на вопрос:

> **Что мне делать дальше, чтобы приблизиться к своей цели?**

Оба уровня работают совместно: структурная навигация помогает ориентироваться в продукте, а навигация развития — ориентироваться в собственном профессиональном развитии.

# Navigation Model / Модель навигации

## English

Within the Development Navigation layer, the primary navigation object is not a page.

The primary navigation object is the **Journey**.

Every information space is entered through the user's current journey.

```text
Identity
     │
     ▼
Current Journey
 ├── Current Position
 ├── Next Step
 ├── Goal
 ├── Progress
 └── Opportunities
      │
      ├── Knowledge Space
      ├── Organization Space
      └── Intelligence Space
```

## Русский

В рамках навигации развития основным объектом навигации является не страница.

Основным объектом навигации является **маршрут развития (Journey)**.

Все информационные пространства открываются через текущую траекторию пользователя.

---

# Navigation Principles / Принципы навигации

## English

- The journey is always visible.
- The current position is always identifiable.
- The next recommended step is always explicit.
- Users navigate through goals rather than application sections.
- Every completed action updates the journey.
- Navigation adapts as the user evolves.

## Русский

- Маршрут развития всегда находится перед глазами пользователя.
- Текущее положение всегда понятно.
- Следующий рекомендуемый шаг всегда очевиден.
- Пользователь движется через цели, а не через разделы приложения.
- Каждое завершенное действие изменяет маршрут.
- Навигация развивается вместе с пользователем.

---

# Navigation Across Information Spaces / Навигация между информационными пространствами

## English

Navigation connects five information spaces into a single experience:

- **Identity Space** — Who am I?
- **Journey Space** — Where am I going?
- **Knowledge Space** — What should I learn or refresh?
- **Organization Space** — How does my development contribute to my organization?
- **Intelligence Space** — What insights help me make better decisions?

The active information space depends on both the current journey and the user's role.

For individuals, the journey is centered on personal competency development.

For organizational roles (Managers, HR, Methodologists, Executives), navigation expands to include organizational capabilities such as teams, departments, competency health, mandatory certifications, development plans, KPIs, and organizational forecasts.

Regardless of role, the navigation experience remains consistent: the platform always answers where the current subject is, where it is going, and what the next best action is.

## Русский

Навигация объединяет пять информационных пространств в единый пользовательский опыт:

- **Identity Space** — Кто я?
- **Journey Space** — Куда я иду?
- **Knowledge Space** — Что мне следует изучить или обновить?
- **Organization Space** — Как мое развитие связано с развитием организации?
- **Intelligence Space** — Какие выводы помогут принять лучшее решение?

Активное информационное пространство определяется одновременно текущим маршрутом и ролью пользователя.

Для отдельного человека навигация строится вокруг личного развития компетенций.

Для руководителей, HR, методологов и других организационных ролей навигация расширяется и включает развитие подразделений, команд, состояние компетенций, обязательные аттестации, планы развития, KPI и прогнозы развития организации.

При этом базовая модель навигации остается неизменной: платформа всегда помогает понять текущее состояние субъекта управления, его цель и следующий наиболее ценный шаг.

---

# Experience Outcome / Результат пользовательского опыта

## English

Successful navigation means that users never think about the interface. They understand only three things:

- where they are;
- where they want to go;
- what they should do next.

Everything else is managed by the platform.

## Русский

Успешная навигация означает, что пользователь практически не думает об интерфейсе. Он всегда понимает только три вещи:

- где он находится;
- куда стремится;
- что следует сделать дальше.

Все остальное берет на себя платформа.