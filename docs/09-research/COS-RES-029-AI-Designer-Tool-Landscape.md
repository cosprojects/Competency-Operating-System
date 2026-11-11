---
id: COS-RES-029
title: AI-инструменты дизайнера по этапам UX — ландшафт и материалы
version: 1.1.0
status: Draft
owner: Research Team
last_updated: 2026-11-11
references:
  - COS-RES-024
  - COS-RES-025
  - COS-RES-028
  - COS-REL-009
---

# COS-RES-029 — AI-инструменты дизайнера по этапам UX

Источник подборки — схема «AI tools for every stage of UX design» (vamshi.work). Задача: разобрать список,
сопоставить инструменты с компетенциями AI-дизайнера и завести официальные ссылки так, чтобы их можно было
мониторить, а сами инструменты — видеть в материалах компетенций.

> Профессия `it.aidesigner` на 2026-11-11 расширена до **56 компетенций в 13 разделах** (включая
> вайрфреймы, прототипы, юзабилити-тестирование, AI-прототипирование, UI-генерацию, AI-разработку).
> Инструменты из подборки разложены по актуальным компетенциям этой версии профессии.

## 1. Что сделано

| Шаг | Результат |
|---|---|
| Разобраны 24 инструмента из 7 этапов UX | таблица ниже |
| Для каждого проверены официальный сайт и документация (HTTP, title, meta) | 48 записей в `learning-sources/registry.json` (`discoveredBy: manual`, `discoveryOnly: true`, `lastChecked: 2026-11-11`) |
| Инструменты сопоставлены с компетенциями профессии | 19 материалов в каталоге (`kind: docs`), 26 связей «материал–компетенция» |
| Материалы прошли Pass E (`materials:verify`) | 4 принято без бейджа (Stitch, Lovable, v0, Cursor), 15 — с бейджем «Подтвердить», 1 отклонён (Miro AI) |
| 4 платных инструмента | заведены как источники для мониторинга, в материалы не идут (правило приёмки: только free/freemium) |
| Каталог после прогона | 135 блоков / 658 тегов / 65 материалов |

## 2. Ландшафт: этап → инструмент → компетенция

| Этап | Инструмент | Доступ | Материал в компетенции | Pass E |
|---|---|---|---|---|
| Research | Perplexity | freemium | `ai-research-synthesis` | бейдж |
| Research | Claude | freemium | `ai-prompting`, `ai-research-synthesis` | бейдж |
| Research | Dovetail | freemium | `ai-research-synthesis` | бейдж |
| Research | NotebookLM | freemium | `ai-research-synthesis` | бейдж |
| Ideate | ChatGPT | freemium | `ai-prompting` | бейдж |
| Ideate | FigJam AI | paid | источники: продукт + документация | — |
| Ideate | Miro AI | freemium | отклонён Pass E: справка о функциях продукта, не о сценариях | — |
| Ideate | Whimsical AI | freemium | `aidesigner-ai-scenarios` | бейдж |
| Wireframe | Relume | freemium | `ux-wireframes`, `ai-layout-docs` | бейдж |
| Wireframe | Uizard | freemium | `ux-wireframes` | бейдж |
| Wireframe | Visily | freemium | `ux-wireframes` | бейдж |
| UI design | Figma AI | paid | источники: продукт + документация | — |
| UI design | Google Stitch | free | `aidesigner-ai-ui-generation` | **принят** |
| UI design | Adobe Firefly | freemium | `aidesigner-visual-generation`, `ai-visual-generation` | бейдж |
| Prototype | Figma Make | freemium | `aidesigner-ai-prototyping`, `ux-interactive-prototype` | бейдж |
| Prototype | Lovable | freemium | `aidesigner-ai-prototyping`, `ux-interactive-prototype` | **принят** |
| Prototype | v0 | freemium | `aidesigner-ai-prototyping` | **принят** |
| Test | Maze | freemium | `ux-usability-testing` | бейдж |
| Test | Attention Insight | freemium | `aidesigner-visual-qa`, `ui-visual-communication` | бейдж |
| Test | Lyssna | freemium | `ux-usability-testing` | бейдж |
| Handoff | Figma Dev Mode | paid | источники: продукт + документация | — |
| Handoff | Claude Code | paid | источники: продукт + документация | — |
| Handoff | Cursor | freemium | `aidesigner-ai-development` | **принят** |
| Handoff | Locofy | freemium | `aidesigner-ai-development`, `ui-handoff` | бейдж |

Итог по этапам: Research — 4 материала, Ideate — 2, Wireframe — 3, UI design — 2, Prototype — 3, Test — 2,
Handoff — 2 (Cursor, Locofy), плюс 1 материал про промптинг (Claude) и 1 про визуальную проверку (Attention Insight).
Без материалов остались 5 инструментов: четыре платных и Miro AI (отклонён Pass E).

## 3. Ссылки на продукты и документацию

Все адреса проверены 2026-11-11. Бот-защита (403 для curl, в браузере открывается): Claude, ChatGPT, Miro, Adobe Firefly —
для них в реестре отмечен `httpStatus: 403` и примечание.

| Инструмент | Продукт | Документация |
|---|---|---|
| Perplexity | https://www.perplexity.ai/ | https://www.perplexity.ai/help-center |
| Claude | https://claude.ai/ | https://support.anthropic.com/ |
| Dovetail | https://dovetail.com/ | https://docs.dovetail.com/ |
| NotebookLM | https://notebooklm.google/ | https://support.google.com/notebooklm?hl=ru |
| ChatGPT | https://chatgpt.com/ | https://help.openai.com/ |
| FigJam AI | https://www.figma.com/figjam/ai/ | https://help.figma.com/hc/en-us/articles/18706554628119-Make-boards-and-diagrams-with-FigJam-AI |
| Miro AI | https://miro.com/ai/ | https://help.miro.com/hc/en-us |
| Whimsical AI | https://whimsical.com/ai | https://help.whimsical.com/ |
| Relume | https://www.relume.io/ | https://resources.relume.io/resources/docs/essential-tools-to-get-started |
| Uizard | https://uizard.io/ | https://support.uizard.io/en/ |
| Visily | https://www.visily.ai/ | https://support.visily.ai/portal/en/kb |
| Figma AI | https://www.figma.com/ai/ | https://help.figma.com/hc/en-us/articles/23955143044247-Use-First-Draft-with-Figma-AI |
| Google Stitch | https://stitch.withgoogle.com/ | https://stitch.withgoogle.com/ |
| Adobe Firefly | https://www.adobe.com/products/firefly.html | https://helpx.adobe.com/firefly.html |
| Figma Make | https://www.figma.com/make/ | https://help.figma.com/hc/en-us/articles/31722591905559-Figma-Make-FAQs |
| Lovable | https://lovable.dev/ | https://docs.lovable.dev/ |
| v0 | https://v0.dev/ | https://v0.dev/docs |
| Maze | https://maze.co/ | https://help.maze.co/ |
| Attention Insight | https://attentioninsight.com/ | https://attentioninsight.com/knowledgebase/ |
| Lyssna | https://www.lyssna.com/ | https://help.lyssna.com/ |
| Figma Dev Mode | https://www.figma.com/dev-mode/ | https://help.figma.com/hc/en-us/articles/15023124644247 |
| Claude Code | https://www.anthropic.com/claude-code | https://docs.anthropic.com/en/docs/claude-code |
| Cursor | https://cursor.com/ | https://docs.cursor.com/ |
| Locofy | https://www.locofy.ai/ | https://www.locofy.ai/docs/ |

## 4. Мониторинг

- В реестре 48 источников (`<tool>` и `<tool>-docs`), `authority: secondary`, `status: active`, `discoveryOnly: true` —
  это мониторинговые записи, а не доказательства компетенций; поэтому они не создают предупреждений `learning:map`.
- Периодичность: раз в квартал проверять доступность и актуальность URL; при смене URL или закрытии доступа —
  `sources:access` / `sources:repair`, при устаревании — правка `summary` и материала.
- Инструменты — быстро меняющийся рынок: список этапов и привязки к компетенциям пересматривать раз в полгода.
- Бот-защищённые страницы автоматически не парсим (правило COS-RES-028); проверка — вручную в браузере.

## 5. Связь с профессией

Инструменты распределены по этапам UX и не вводят новых компетенций: ландшафт инструментов — `aidesigner-tool-landscape`,
ресёрч — `ai-research-synthesis`, вайрфреймы — `ux-wireframes`, сценарии — `aidesigner-ai-scenarios`,
UI-генерация — `aidesigner-ai-ui-generation`, визуал — `aidesigner-visual-generation` / `ai-visual-generation`,
прототипы — `aidesigner-ai-prototyping` / `ux-interactive-prototype`, тесты — `ux-usability-testing`,
визуальная проверка — `aidesigner-visual-qa`, разработка и handoff — `aidesigner-ai-development` / `ui-handoff`.

## 6. История изменений

| Версия | Дата | Что изменилось |
|---|---|---|
| 1.0.0 | 2026-11-11 | Разобрана подборка 24 AI-инструментов: 48 источников, 19 материалов, привязки к компетенциям первой версии профессии |
| 1.1.0 | 2026-11-11 | Профессия расширена до 56 компетенций; материалы переразложены по новым компетенциям (вайрфреймы, прототипы, тесты, AI-разработка); Pass E: 4 принято, 15 с бейджем, 1 отклонён |
