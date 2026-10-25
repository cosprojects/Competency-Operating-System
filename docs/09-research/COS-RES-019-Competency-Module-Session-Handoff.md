---
id: COS-RES-019
title: Competency Module — session handoff
version: 1.0.0
status: Draft
owner: Research Team
last_updated: 2026-10-22
references:
  - COS-RES-014
  - COS-RES-015
  - COS-RES-016
  - COS-RES-017
  - COS-RES-018
  - COS-ARCH-002
---

# COS-RES-019 — Handoff: модуль компетенций и профессий

Документ фиксирует состояние на **2026-10-22**, чтобы продолжить работу в новой сессии без восстановления контекста.

Текущий коммит: **`67b13b3`** (`main`, запушен в `origin/main`). Тесты: **127/127**, `tsc --noEmit` чистый.

## 1. Что уже собрано

### Источники
- `sources/registry.json` — определения источников (ESCO, O*NET, Практикум, Wikipedia, Internet Archive, Хабр, Medium, Stepik, YouTube, Learn Anything, профстандарты/ФГОС, hh.ru).
- `sources/spheres/it.json` — источники сферы и language priority.
- `sources/professions/it.uxui.json`, `it.product.json`, `it.motion.json`, `it.graphic.json` — occupation queries, material sources, blocked sources.
- Сборщики `professions:collect` и `tags:collect` читают source-файл профессии (`--profession`).
- Product/Graphic ESCO иногда отдаёт HTML — ошибка изолируется, сборка продолжается через O*NET. Product дополнительно получает теги из каталога Практикума `product-approach-for-designers`.

### Каталог и приоритеты
- `catalog/it.json`: **44 accepted-блока, 195 тегов, 0 материалов**.
- UX/UI: 33 accepted priority-mark, `status: accepted`, reviewer `cos-methodologist`.
- Canonical UX/UI: **34 компетенции**, `covered = 34`, `partial = 0`, `gap = 0`.

### Нормализованная модель
- `model/spheres.json` — сфера `it`.
- `model/professions.json` — 4 профессии: `it.uxui`, `it.product`, `it.motion`, `it.graphic`.
- `model/competencies.json` — **единый массив 45 компетенций** (34 базовых + 11 профессио-специфичных).
- `model/profession-competencies/*.json` — ссылки competencyId + tier/order по профессии.
- `model/professions/views/*.json` — профессиональные view: разделы, tier/order, prerequisites.

### Профессиональные view

| Профессия | Компетенций | Узлы графа | Связи |
|---|---:|---:|---:|
| UX/UI | 34 | 34 | 26 |
| Product | 30 | 30 | 29 |
| Motion | 19 | 19 | 14 |
| Graphic | 18 | 18 | 13 |

Product-граф включает JTBD, CJM, discovery, исследования, прототипы, метрики, growth/experiments и UI-слой.

### Канвасы
- `web/uxui-competency-canvas.html` — основной UX/UI.
- `web/it-product-competency-canvas.html`.
- `web/it-motion-competency-canvas.html`.
- `web/it-graphic-competency-canvas.html`.
- Табы **UX/UI · Product · Motion · Graphic** встроены прямо в каждый канвас.
- `web/competencies-review-canvas.html` — redirect на UX/UI (iframe-версия убрана).
- `canvas:profession` — сгруппированные карты; `canvas:profession-network` — сетевые канвасы; `canvas:tabs` — landing.

### Material Agent
- `src/methodology/v1/materials-agent/` — отдельный модуль: discovery → optional LLM classification → validation.
- Worker queue: `professionId + competencyId`, concurrency, retry, общий LlmBudget, coverage по элементу.
- Журналы: `data/materials-agent/<domain>-<profession>-queue.json` (gitignored).
- Review: `materials:agent:review`.
- Product/Motion/Graphic review уже есть:
  - product: 16 discovered / 8 linked;
  - motion: 14 / 3;
  - graphic: 13 / 7.
- **Материалы не приняты в каталог.**

## 2. Ключевые команды

```bash
# базовые проверки
npm run typecheck
npm test

# модель
npm run model:sync -- --domain it --profession uxui --write
npm run model:views -- --domain it --write
npm run model:validate -- --domain it --profession uxui --all

# источники и сбор
npm run professions:collect -- --domain it --profession product
npm run tags:collect -- --domain it --profession product

# каталог / приоритеты
npm run catalog:accept -- --domain it --profession uxui \
  --blocks-file data/competency/blocks-it.json,data/competency/blocks-it-uxui.json,data/competency/blocks-it-motion.json,data/competency/blocks-it-product.json,data/competency/blocks-it-graphic.json --write
npm run catalog:validate -- --domain it --require-priority
npm run priority:validate -- --domain it --profession uxui --require-complete --require-accepted

# канвасы
npm run canvas:page -- --domain it --profession uxui --source catalog
npm run canvas:profession-network -- --profession product
npm run canvas:profession-network -- --profession motion
npm run canvas:profession-network -- --profession graphic
npm run canvas:tabs

# материалы
npm run materials:agent:queue -- --domain it --profession product --classify --budget-usd 0.03
npm run materials:agent:review -- --domain it --profession product
```

Открыть review-канвас:

```bash
open web/uxui-competency-canvas.html
```

## 3. Что считается готовым

- Профессии и теги собираются из официальных источников.
- Каталог и приоритеты UX/UI accepted.
- Единый массив компетенций и profession views работают.
- Product/Motion/Graphic имеют собственные блоки для профессио-специфичных компетенций.
- Табы профессий и сетевые канвасы работают.
- Material Agent отделён от сборки компетенций.

## 4. Открытые задачи (по приоритету)

1. **Product graph**: заменить reuse-часть на product-specific каталог. Pass A по product-тегам пока даёт только 9 кандидатов и 86 unassigned из-за industrial design в ESCO/O*NET.
2. **Priority-файлы Product/Motion/Graphic**: сейчас tier/order только в profession views; отдельных priority-файлов нет.
3. **Материалы**: human-review журналов, затем `catalog.materials`; полный прогон по 44 блокам.
4. **Motion/Graphic**: добавить profession-specific блоки и материалы, затем сетевые графы.
5. **Knowledge graph**: отдельный слой competency → components/tags/materials пока не строится; по решению пользователя это следующий этап через агента материалов.
6. **Остальные профессии**: после стабилизации методики расширять за пределы 4 дизайнерских.

## 5. Известные ограничения и риски

- Product/Motion/Graphic графы частично синтетические: строятся из view, а не из полного profession-specific каталога.
- Каталог материалов пуст; Material Agent только готовит кандидатов.
- `data/` (кроме tracked source/model) gitignored: журналы, candidates, blocks, materials не попадают в репозиторий.
- `model:sync` раньше перезаписывал `professions.json`; исправлено — теперь записи других профессий сохраняются.
- ESCO для Product/Graphic может отдавать HTML; fallback O*NET, без обхода.
- Канвасы — статические HTML; отдельного frontend-приложения в репозитории нет.
- Финальная приёмка блоков/материалов остаётся human-gated.

## 6. С чего начать новую сессию

1. `git pull` и `npm run typecheck && npm test`.
2. Проверить `git status` — должен быть clean, последний коммит `67b13b3` или новее.
3. Запустить `npm run model:validate -- --domain it --profession uxui --all`.
4. Открыть `web/uxui-competency-canvas.html`, проверить табы Product/Motion/Graphic.
5. Продолжить с задачи 1: product-specific сборка навыков/знаний → компетенции → приоритеты → связи.

## 7. История

| Версия | Дата | Что зафиксировано |
|---|---|---|
| 1.0.0 | 2026-10-22 | Handoff после сборки 4 профессий, 44 блоков, 45 компетенций, Material Agent и сетевых канвасов |
