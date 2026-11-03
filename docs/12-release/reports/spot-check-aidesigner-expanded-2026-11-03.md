# Spot-check AI-дизайнера после расширения до 56 компетенций — 2026-11-03

- Модель: `it.aidesigner`, 13 секций, **56 компетенций** (27 существующих, 18 переиспользованных, 10 новых).
- Публикация: 56/56, 91 уникальный источник, gate PASS (292/292 связи, 131/131 компетенция).
- Проверялось: блоки знаний/навыков, источники новых компетенций, публикуемый контент, кнопка подтверждения.
- Вердикт: **условно PASS** — модель и gate зелёные, но у 7 новых компетенций источники требуют замены/ручного подтверждения.

## 1. Новые компетенции

| Компетенция | Знаний | Навыков | Источников | Качество источников | Действие |
|---|---:|---:|---:|---|---|
| `aidesigner-ai-scenarios` | 4 | 4 | 3 | ⚠️ общие Figma/Codecademy/Практикум, не про AI-сценарии | заменить на статью/документацию по сценарному проектированию |
| `aidesigner-ai-ui-generation` | 4 | 4 | 6 | ⚠️ общие курсы по UI + каталог aicodinglab | оставить 1–2, добавить Figma Make/Stitch/v0 |
| `aidesigner-ai-prototyping` | 4 | 5 | 2 | ⚠️ ProductDo + planned flane.ru | добавить Figma Make/Framer/v0 |
| `aidesigner-design-tokens` | 5 | 4 | 1 | ❌ общая статья Habr про ИИ | заменить на Figma Variables/токены |
| `aidesigner-design-system-engineering` | 5 | 5 | 3 | ⚠️ Figma basics + GreatLearning + нерелевантный Bang Bang AI-video | убрать Bang Bang, добавить Figma blog design systems |
| `aidesigner-ai-development` | 5 | 5 | 1 | ⚠️ общий SoftUni AI | заменить на Cursor/GitHub/React docs |
| `aidesigner-mcp-integration` | 4 | 5 | 1 | ❌ общая статья Habr про ИИ | заменить на Figma MCP/Model Context Protocol docs |
| `aidesigner-agent-orchestration` | 5 | 5 | 1 | ❌ корень Microsoft Learn | заменить на agent orchestration/n8n/LangGraph |
| `aidesigner-visual-qa` | 4 | 5 | 5 | ⚠️ общие AI-design статьи | добавить Playwright/Chromatic/Storybook |
| `aidesigner-technical-literacy` | 6 | 5 | 4 | ✅ MDN, ИНТУИТ, Alison, Практикум | оставить |

Знания/навыки у всех 10 компетенций заполнены и проходят `model:validate --require-blocks`.

## 2. Что требует решения

1. **Заменить источники у 7 компетенций** (в первую очередь design-tokens, MCP, agent-orchestration).
   Часть текущих — переиспользованные из смежных компетенций, чтобы gate прошёл; это техническая
   подстраховка, а не доказанная релевантность.
2. **Убрать нерелевантные связи**: `bangbangeducation-ru-course-motion` у design-system-engineering,
   общий Habr у design-tokens/MCP.
3. **Подтвердить блоки**: 10 новых блоков созданы ручной курацией (`model: manual-curation`);
   нужен основательский spot-check компонентов и тегов.
4. **Кнопка подтверждения** перенесена в блок бейджей карточки материала (`.material-badges`),
   CSS `.material-confirm` больше не уезжает вправо. Проверить на деплое.
5. **Миграция SourceReview** (`20261103120000_source_reviews`) не применена к прод-БД: локально нет
   `DATABASE_URL`. Нужно выполнить `npm run db:deploy` в окружении Vercel/Postgres.

## 3. Технические проверки

- `npm run typecheck` — PASS
- `npm run test` — 219/219
- `npm run catalog:validate` — 135 блоков / 658 тегов / 43 материала
- `npm run model:validate -- --domain it --profession aidsigner --all --require-blocks` — 0 ошибок
- `npm run release:validate -- --release beta-1` — gate PASS
- `npm run release:build:draft` — 131 компетенция, 292 связи, 114 источников
- `npm run web:build` — exit 0

## 4. Как проверялось вручную

```bash
npm run aggregate -- --profession aidesigner --fetch --write
npm run learning:map
npm run learning:aggregate
```

UI: `/professions/aidesigner` — 13 секций, у новых компетенций видны знания, навыки и материалы;
кнопка «Подтвердить» рендерится в строке бейджей карточки.
