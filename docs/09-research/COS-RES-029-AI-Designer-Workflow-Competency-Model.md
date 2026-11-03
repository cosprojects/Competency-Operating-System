---
id: COS-RES-029
title: AI-дизайнер: workflow и целевая модель компетенций
version: 1.0.0
status: Draft
owner: Research Team
last_updated: 2026-11-03
references:
  - COS-RES-025
  - COS-REL-009
  - COS-RES-028
  - COS-REL-010
---

# COS-RES-029 — AI-дизайнер: workflow и целевая модель компетенций

Исследование профессиональной специализации AI Designer и декомпозиция предложенного
workflow на знания, навыки и компетенции. Документ — основа для следующей итерации модели
`it.aidesigner` и сбора материалов через `npm run aggregate`.

## 0. Реализация 2026-11-03

Модель применена к `it.aidesigner`:

- 13 секций, **56 компетенций** (27 были в AI-модели, 18 переиспользованы, 10 новых);
- для 10 новых компетенций созданы accepted-блоки с knowledge/skills (5–6 знаний, 4–5 навыков);
- источники собраны `sources:expand` (Brave + LLM), ссылки «компетенция–источник» обновлены;
- `release:validate`: **gate PASS**, 292/292 связи, 131/131 компетенция, AI-дизайнер 56/56;
- `web:build` — exit 0, 219 тестов, typecheck чист.

Ручного spot-check требуют: скопированные источники смежных компетенций (для сценариев, UI,
дизайн-систем, QA, technical literacy), а также sourced-блоки новых компетенций.

## 1. Исходная позиция

Предложенный workflow: **Research → Architecture → Scenarios → Interfaces → Design System →
Development → Validation**, развёрнутый в 12 этапов:

1. Product Discovery & Research
2. Product Strategy & Requirements
3. UX Architecture & User Journey Design
4. UI Design & Visual Exploration
5. Prototyping & Interaction
6. Design System Engineering
7. AI-Assisted Development & Vibe Coding
8. AI Media Production
9. Motion Design & Interactive Animation
10. Workflow Automation & AI Orchestration
11. Quality Assurance & Design Validation
12. Documentation, Collaboration & Delivery

Плюс 6 сквозных направлений: AI Literacy, Prompt Engineering, AI Agent Management,
Design & Critical Thinking, Technical Literacy, Responsible AI.

Ключевая рамка, которую фиксируем:

- AI Designer — не «UX/UI-дизайнер с нейросетями», а специалист, организующий полный цикл
  создания цифрового продукта с AI-моделями, агентами, автоматизацией и традиционным дизайном.
- Ценность — в управлении процессом и качестве результата, а не в количестве инструментов.
- Инструменты — примеры реализации, а не компетенции: они меняются, компетенции остаются.
- Человек отвечает за цели, архитектуру, критерии качества и ключевые решения.

## 2. Что уже есть в модели

Текущий `it.aidesigner`: 4 секции, 27 компетенций, 19 accepted-блоков AI-слоя,
профессия опубликована в Beta 1 (`status: ready`).

Сильные стороны текущей модели:

- есть AI-фундамент: `ai-model-landscape`, `ai-prompting`, `aidesigner-tool-landscape`,
  `aidesigner-prompt-systems`, `aidesigner-tool-evaluation`;
- есть AI-продакшн: `ai-visual-generation`, `aidesigner-visual-generation`,
  `aidesigner-series-adaptation`, `ai-video-audio`, `aidesigner-video-audio`, `ai-copy-content`;
- есть автоматизация и качество: `aidesigner-automation`, `ai-workflow-integration`,
  `aidesigner-quality-eval`;
- есть этика и внедрение: `ai-ethics-rights`, `aidesigner-integration`, `ai-research-synthesis`;
- переиспользованы сильные компетенции других профессий: `ux-user-research`, `ux-requirements`,
  `ui-layout`, `ui-figma`, `ui-visual-communication`.

Чего не хватает относительно предложенного workflow:

| Пробел | Следствие |
|---|---|
| Нет явного этапа Product Strategy / requirements в AI-контексте | `ux-product-thinking` есть, но без AI-декомпозиции гипотез, PRD и приоритизации |
| Нет отдельной UX-архитектуры со сценариями, IA и journey | `ux-user-flows`/`ux-information-architecture` не входят в текущий view |
| Нет дизайн-систем как инженерной компетенции (tokens, variables, themes, sync) | `ui-design-systems` не входит; `ui-components` не входит |
| Нет AI-assisted development (Cursor, agents, код, Git) | Ключевой этап профессии отсутствует |
| Нет MCP и передачи дизайн-контекста агентам | Упоминается в тексте, но не оформлено в компетенцию |
| Нет prototyping как отдельной AI-компетенции | `ux-interactive-prototype` не входит |
| Нет агентной оркестрации (tool calling, multi-agent, human-in-the-loop) | `aidesigner-automation` покрывает пайплайны, но не агентов |
| Нет visual QA / design-to-code проверки | `aidesigner-quality-eval` — про качество AI-результата, не про реализацию |
| Нет technical literacy и documentation/delivery | Отсутствуют `ui-handoff`, `ai-layout-docs` в текущем view |
| Нет motion в AI-контексте | `ui-motion`/`motion-*` не входят |

## 3. Целевая структура

13 секций: 12 этапов workflow + «Сквозные компетенции». Не все компетенции создаются
с нуля: часть берётся из других профессий, часть уже есть в AI-слое, новые — только
там, где действительно появляется отдельная профессиональная способность.

Легенда: **E** — existing (уже в модели), **S** — shared (берём из другой профессии),
**N** — new (нужна новая компетенция).

### 3.1. Research & Discovery

Компетенции: `ux-user-research` (S), `ux-interviews` (S), `ux-personas` (S), `product-jtbd` (S),
`ai-research-synthesis` (E).

Знания: Research Methodology, Qualitative/Quantitative Research, JTBD, Customer Development,
Competitive Analysis, Prompt Engineering.

Навыки: формирование исследовательских запросов; AI-поиск и проверка источников;
анализ интервью; кластеризация потребностей; синтез выводов; Research Report / Personas /
JTBD Map / Problem Statements.

### 3.2. Product Strategy & Requirements

Компетенции: `ux-product-thinking` (S), `ux-requirements` (S), `product-strategy` (S),
`aidesigner-ai-features` (E).

Знания: Product Discovery, MVP, Agile/Scrum/Kanban, User Story Mapping, Prioritization,
AI product constraints (uncertainty, explainability, human-in-the-loop).

Навыки: гипотезы → требования; PRD и User Stories; acceptance criteria; приоритизация;
проверка непротиворечивости; проектирование AI-фич с контролем пользователя.

### 3.3. UX Architecture & Scenarios

Компетенции: `ux-information-architecture` (S), `ux-user-flows` (S), `ux-wireframes` (S),
**`aidesigner-ai-scenarios` (N)**.

Знания: IA, Interaction Design, User Journey Mapping, Cognitive Psychology, Usability,
Design Patterns, AI-assisted scenario generation.

Навыки: структура продукта и навигация; flow/journey/task flow; happy path, альтернативы,
ошибки, edge cases; генерация и критика сценариев с AI; поиск пропущенных состояний.

**Новая компетенция — AID `aidesigner-ai-scenarios`:** «Проектировать и проверять
пользовательские сценарии с помощью AI, включая альтернативные и ошибочные ветки».
Knowledge: User Flow, Journey Map, Error/Edge Cases, Prompt Engineering, Interaction Patterns.
Skills: формулировать сценарии для AI; генерировать альтернативы; проверять полноту состояний;
сравнивать варианты; документировать Interaction Specification.

### 3.4. UI Design & Visual Exploration

Компетенции: `ui-layout` (S), `ui-visual-communication` (S), `ui-color` (S), `ui-typography` (S),
`ui-responsive` (S), `ui-figma` (S), **`aidesigner-ai-ui-generation` (N)**.

Знания: Visual/UI Design, Typography, Color, Grid, Composition, Responsive, Accessibility,
AI image/UI generation.

Навыки: visual direction и moodboard; wireframes → hi-fi; генерация и отбор вариантов;
работа с Figma; контроль консистентности; AI image generation.

**Новая компетенция — `aidesigner-ai-ui-generation`:** «Генерировать и доводить UI-концепции
с помощью AI-инструментов, сохраняя визуальную систему и качество».
Knowledge: Figma Make/Stitch/v0, prompt-to-UI, design constraints, visual hierarchy.
Skills: prompt-to-layout; сравнение вариантов; перенос в Figma; правка сгенерированного;
контроль сетки/типографики/состояний.

### 3.5. Prototyping & Interaction

Компетенции: `ux-lowfi-prototype` (S), `ux-interactive-prototype` (S),
**`aidesigner-ai-prototyping` (N)**.

Знания: Prototyping, Interaction Design, State Management, Component Interaction,
Basic Frontend (HTML/CSS/JS), AI prototyping tools.

Навыки: кликабельные прототипы; интерактивные состояния; работающие прототипы через
Figma Make/Framer/v0/Lovable/Bolt/Replit/Cursor; проверка сценариев; быстрая модификация.

**Новая компетенция — `aidesigner-ai-prototyping`:** «Создавать работающие прототипы
интерфейса с помощью AI-инструментов и проверять на них пользовательские сценарии».
Knowledge: prototyping fidelity, state, generated code, basic React/HTML/CSS.
Skills: выбрать инструмент под гипотезу; собрать прототип; проверить сценарий; передать
в разработку; оценить ограничения прототипа.

### 3.6. Design System Engineering

Компетенции: `ui-design-systems` (S), `ui-components` (S),
**`aidesigner-design-tokens` (N)**, **`aidesigner-design-system-engineering` (N)**.

Знания: Design Systems, Atomic Design, Design Tokens, Variables, Semantic Tokens,
Component Architecture, Governance, Accessibility, Figma Variables/MCP.

Навыки: токены и темы; компоненты/варианты/состояния; документация; анализ макетов;
автоматическое извлечение стилей; синхронизация токенов с кодом; MCP-передача контекста.

**Новая компетенция — `aidesigner-design-tokens`:** «Проектировать и поддерживать
систему токенов и тем (primitive/semantic/component)».
Knowledge: token taxonomy, aliases, themes, contrast, naming.
Skills: собрать токены; light/dark; семантика; экспорт в код; проверка консистентности.

**Новая компетенция — `aidesigner-design-system-engineering`:** «Автоматизировать
создание, документирование и синхронизацию дизайн-системы с кодом».
Knowledge: Figma Variables, MCP, Storybook, Tokens Studio, Style Dictionary, governance.
Skills: анализ интерфейса; извлечение стилей; генерация компонентов; документация;
проверка design-to-code соответствия.

### 3.7. AI-Assisted Development

Компетенции: **`aidesigner-ai-development` (N)**, **`aidesigner-mcp-integration` (N)**.

Знания: HTML/CSS/JS/TS, React, component architecture, Git, API, MCP, AI coding agents,
generated code risks.

Навыки: среда и структура проекта; генерация интерфейсного кода; работа с существующим
кодом; отладка; Git; подключение MCP; контроль качества сгенерированного кода;
визуальная проверка реализации.

**Новая компетенция — `aidesigner-ai-development`:** «Реализовывать интерфейс с помощью
AI coding agents, не разрушая архитектуру продукта».
Knowledge: React/TS, component architecture, Git, API, debugging.
Skills: поставить задачу агенту; сгенерировать/модифицировать код; работать с репозиторием;
отладить; проверить сборку/типы; оценить долг и ограничения генерации.

**Новая компетенция — `aidesigner-mcp-integration`:** «Подключать AI-агентов к дизайн-
и проектному контексту через MCP и Skills».
Knowledge: MCP, tool calling, context window, permissions, structured context.
Skills: настроить MCP; передать контекст Figma/репозитория; ограничить доступ;
проверить, что агент использует актуальные данные; документировать подключение.

### 3.8. AI Media Production

Компетенции: `ai-visual-generation` (E), `aidesigner-visual-generation` (E),
`aidesigner-series-adaptation` (E), `ai-video-audio` (E), `aidesigner-video-audio` (E),
`ai-copy-content` (E).

Знания: generative media, image/video/audio/3D, visual storytelling, prompt engineering,
copyright/licensing.

Навыки: промпты под визуал; референсы и стиль; серии; видео/аудио; 3D-ассеты;
интеграция в интерфейс; проверка прав и качества.

3D-генерацию не выделяем в отдельную компетенцию: она входит в `ai-visual-generation`
как знание/навык, пока не появится отдельная профессиональная роль 3D-продакшна.

### 3.9. Motion & Interaction

Компетенции: `ui-motion` (S), `motion-animation-principles` (S),
`motion-timing-easing` (S).

Знания: motion design, animation principles, UI motion, timing/easing, interactive animation.

Навыки: микровзаимодействия; переходы; анимационные состояния; интеграция motion в UI;
AI-генерация анимационных ассетов (как часть `ai-visual-generation`/`ai-video-audio`).

### 3.10. Workflow Automation & AI Orchestration

Компетенции: `aidesigner-automation` (E), `ai-workflow-integration` (E),
**`aidesigner-agent-orchestration` (N)**.

Знания: workflow automation, API/REST/webhooks/JSON, MCP, AI agents, agent orchestration,
LLM fundamentals, basic Python.

Навыки: автоматизация операций; API-интеграции; MCP; специализированные агенты;
передача контекста; многоэтапные процессы; human-in-the-loop; обработка ошибок.

**Новая компетенция — `aidesigner-agent-orchestration`:** «Проектировать и управлять
последовательностью AI-агентов и инструментов для производственной задачи».
Knowledge: agentic workflows, tool calling, memory/skills, multi-agent, failure modes.
Skills: декомпозировать задачу на агентов; определить инструменты; настроить контекст;
добавить проверки и human-in-the-loop; обработать сбои; оценить результат.

### 3.11. Quality Assurance & Design Validation

Компетенции: `aidesigner-quality-eval` (E), **`aidesigner-visual-qa` (N)**,
`ux-usability-testing` (S), `ux-metrics` (S).

Знания: software testing, visual regression, usability, accessibility, product analytics,
UX metrics, AI-assisted QA.

Навыки: тест-кейсы; визуальная проверка; функциональные проверки; сравнение макета и
реализации; AI-анализ ошибок; UX-метрики.

**Новая компетенция — `aidesigner-visual-qa`:** «Проверять соответствие реализации
дизайну и требованиям, используя AI и инструменты визуального тестирования».
Knowledge: visual regression, Playwright/Chromatic/Storybook, screenshots, design tokens.
Skills: сравнить Figma и браузер; найти расхождения; проверить состояния/адаптивность;
сгенерировать тест-кейсы; оформить дефекты.

### 3.12. Documentation, Collaboration & Delivery

Компетенции: `ui-handoff` (S), `ai-layout-docs` (E).

Знания: design documentation, technical specification, version control, Agile collaboration,
delivery, design handoff.

Навыки: документация с AI; спецификации; задачи; Git; синхронизация дизайна и разработки;
подготовка результатов стейкхолдерам.

### 3.13. Сквозные компетенции

Компетенции: `ux-design-thinking` (S), `ai-model-landscape` (E), `ai-prompting` (E),
`aidesigner-prompt-systems` (E), `aidesigner-tool-landscape` (E),
`aidesigner-tool-evaluation` (E), `ai-ethics-rights` (E),
**`aidesigner-technical-literacy` (N)**.

Знания: LLM/multimodal/diffusion, context/tokens/embeddings, RAG/fine-tuning/inference,
hallucinations/evaluation; prompt structure, context engineering, few-shot, structured output;
agents/tool calling/MCP/memory; design & systems thinking; frontend/backend/API/DB/Git/deployment;
privacy/IP/copyright/ethics/bias/security.

Навыки: выбор модели; оценка генерации; структурированные промпты; шаблоны; постановка задач
агентам; подключение инструментов; критическая оценка AI-результатов; проверка источников;
защита данных; работа с API/Git; понимание технических ограничений.

**Новая компетенция — `aidesigner-technical-literacy`:** «Понимать техническую
архитектуру продукта настолько, чтобы ставить задачи агентам и разработчикам и проверять
результат».
Knowledge: web architecture, API, databases, Git, deployment, browser/runtime.
Skills: читать архитектуру; работать с API; пользоваться Git; формулировать технические
ограничения; проверять реализацию без роли программиста.

## 4. Сводка целевой модели

| Секция | Компетенции | Новые |
|---|---|---|
| Research & Discovery | 5 | 0 |
| Strategy & Requirements | 4 | 0 |
| UX Architecture & Scenarios | 4 | 1 |
| UI Design & Visual | 7 | 1 |
| Prototyping & Interaction | 3 | 1 |
| Design System Engineering | 4 | 2 |
| AI-Assisted Development | 2 | 2 |
| AI Media Production | 6 | 0 |
| Motion & Interaction | 3 | 0 |
| Automation & Orchestration | 3 | 1 |
| Quality & Validation | 4 | 1 |
| Documentation & Delivery | 2 | 0 |
| Cross-cutting | 8 | 1 |
| **Итого** | **55** | **10** |

Из 55 компетенций: 10 новых, 27 уже в AI-модели, 18 переиспользуются из других профессий.

## 5. Что делать дальше (порядок)

1. **Утвердить матрицу** и границы новых компетенций (особенно `aidesigner-ai-development`,
   `aidesigner-mcp-integration`, `aidesigner-agent-orchestration`).
2. **Добавить 10 новых компетенций** в `competencies-extra.json` (id, title, definition,
   tier) и пересобрать `views/aidesigner.json` из 13 секций.
3. **Обновить блоки знаний/навыков** для новых компетенций: components + tags
   (knowledge/skill) с доказательствами; без `sourceRefs` блок остаётся candidate, не accepted.
4. **Собрать материалы агрегатором**:
   `npm run aggregate -- --profession aidesigner --fetch --write`
   (источники по новым компетенциям; журналы сохраняются).
5. **Добрать каталожные материалы** через `npm run materials:daily` (2–5 на формат,
   приоритет — новые компетенции).
6. **Прогнать** `model:validate`, `release:validate`, `web:build`; опубликовать только
   прошедшие quality bar; остальные — `allowPartialProfessions`.

## 6. Corner cases и ограничения

- **Инструменты не равны компетенциям.** Figma/Cursor/MCP — примеры, а не отдельные сущности;
  при смене инструмента компетенция остаётся.
- **Пересечения.** AI-компетенции не должны дублировать `ux-*`/`ui-*`: исследование,
  архитектура, UI и motion берутся из общей модели, AI-специфика — только новое качество.
- **Границы профессии.** AI Designer не становится ML-инженером: техническая грамотность
  нужна для постановки задач и проверки, не для обучения моделей.
- **Материалы.** 2–5 на формат; при отсутствии источника после 3 раундов — `insufficient`
  и ручное решение, а не бесконечный поиск.
- **Публикация.** Если новые компетенции не прошли quality bar, они не показываются
  (allowPartialProfessions), а не публикуются с пустыми знаниями.
- **AI-слой.** Общие `ai-*` компетенции остаются в `publication.coreCompetencyPrefixes`;
  не дублировать их в других профессиях.
- **Устаревание инструментов.** В карточках компетенций перечислять категории инструментов,
  а не конкретные продукты; конкретные ссылки — в материалах.

## 7. Источники

- Практика AXIONA: Figma MCP, Cursor, Skills, Design Tokens/Variables, design-to-code,
  AI-assisted prototyping, Git.
- Figma (ноябрь 2026): MCP, агентные сценарии, Figma Make, Variables.
- Официальные документации и курсы — кандидаты для сбора материалов через `sources:expand`.
