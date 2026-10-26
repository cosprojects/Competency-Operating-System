---
id: COS-RES-019
title: Competency Module — session handoff
version: 1.5.0
status: Draft
owner: Research Team
last_updated: 2026-10-26
references:
  - COS-RES-014
  - COS-RES-015
  - COS-RES-016
  - COS-RES-017
  - COS-RES-018
  - COS-RES-020
  - COS-RES-021
  - COS-ARCH-002
---

# COS-RES-019 — Handoff: модуль компетенций и профессий

Документ фиксирует состояние на **2026-10-26**, чтобы продолжить работу в новой сессии без восстановления контекста. Итерация Product описана отдельно в `COS-RES-020`, Motion/Graphic — в `COS-RES-021`, учебные источники — в `COS-RES-022`.

Локальный `main` содержит коммиты итерации Product: `370265d` (canonicalIds), `3d66417` (источники Product), `b99730e` (связный граф Product + mapping), плюс docs-коммит. Тесты: **148/148**, `tsc --noEmit` чистый. `origin/main` может отставать: если агент запускался без SSH-ключа в агенте, push не прошёл. Проверить: `git status -sb`; при `ahead N` — `ssh-add ~/.ssh/id_ed25519 && git push origin main`. Reset/rebase не делать.

## 1. Что уже собрано

### Источники
- `sources/registry.json` — определения источников (ESCO, O*NET, Практикум, Wikipedia, Internet Archive, Хабр, Medium, Stepik, YouTube, Learn Anything, профстандарты/ФГОС, hh.ru).
- `sources/spheres/it.json` — источники сферы и language priority.
- `sources/professions/it.uxui.json`, `it.product.json`, `it.motion.json`, `it.graphic.json` — occupation queries, material sources, blocked sources.
- Product O*NET исправлен: `15-1255.00 Web and Digital Interface Designers` + `13-1161.00 Market Research Analysts and Marketing Specialists` вместо индустриального `27-1021.00`. `collectProfessions` принимает все объявленные SOC-коды.
- Product tags: **368** (knowledge 47, skill 10, tool 311) вместо 182 индустриальных.
- Сборщики `professions:collect` и `tags:collect` читают source-файл профессии (`--profession`).
- Учебные источники вынесены в отдельный реестр `learning-sources/registry.json` (33 записи; primary/aggregator/blocked/duplicate), см. `COS-RES-022`.

### Каталог и приоритеты
- `catalog/it.json`: **54 accepted-блока, 237 тегов, 0 материалов**. У всех блоков заполнены `canonicalIds` (backfill из canonical map; раньше 14 блоков без него выпадали из графов).
- UX/UI: 33 accepted priority-mark, `status: accepted`, reviewer `cos-methodologist`.
- Canonical UX/UI: **34 компетенции**, `covered = 34`, `partial = 0`, `gap = 0`.
- Mapping: `mapping/it.product.json` — 30/30 (direct 11, adjacent 15, none 4); `it.motion.json` — 19/19 (9/5/5); `it.graphic.json` — 18/18 (11/6/1); `mapping:validate` — 0 ошибок, «без решения» 0.
- Practicum подключён как источник для всех четырёх профессий; курс-теги проходят санитайзер (без абзацев, карьерных и маркетинговых фраз).

### Нормализованная модель
- `model/spheres.json` — сфера `it`.
- `model/professions.json` — 4 профессии: `it.uxui`, `it.product`, `it.motion`, `it.graphic`.
- `model/competencies.json` — **единый массив 55 компетенций** (34 базовых + 21 профессио-специфичная, включая 10 motion).
- `model/profession-competencies/*.json` — ссылки competencyId + tier/order + prerequisites по профессии.
- `model/professions/views/*.json` — профессиональные view: разделы, tier/order, prerequisites.

### Профессиональные view

| Профессия | Компетенций | Узлы графа | Связи |
|---|---:|---:|---:|
| UX/UI | 34 | 34 | 26 |
| Product | 30 | 30 | **41** |
| Motion | 28 | 28 | **42** |
| Graphic | 18 | 18 | **33** |

Все три графа (product, motion, graphic) теперь связные: единственный корень `ux-design-thinking`, компонент — 1. Product view: 3 foundation / 24 core / 3 optional; motion: 8/15/5; graphic: 7/4/7.

### Решение по priority/order (Priority 2)
- Отдельные `priority/product.json`, `priority/motion.json`, `priority/graphic.json` **не вводятся**: `priority/uxui.json` — block-level accepted marks UX/UI, а profession views работают на уровне канонических компетенций с переиспользованными блоками; копия создала бы второй источник истины.
- Источник истины: `model/professions/views/<profession>.json`. Материализованная проекция: `model/profession-competencies/<profession>.json` (сохраняет prerequisites).
- `model:validate` проверяет prerequisites (существование, порядок, циклы) и `--require-blocks`; `validateProfessionView` ловит ошибки на `model:views`. UX/UI priority не затронут (33 marks, 0 ошибок).

### Канвасы
- `web/uxui-competency-canvas.html` — UX/UI (34 узла / 26 связей).
- `web/it-product-competency-canvas.html` — Product (30 / 41).
- `web/it-motion-competency-canvas.html` — Motion (28 / 42).
- `web/it-graphic-competency-canvas.html` — Graphic (18 / 13).
- `web/it-*-competency-map.html` — сгруппированные карты профессий.
- Табы **UX/UI · Product · Motion · Graphic** встроены прямо в каждый канвас.
- `web/competencies-review-canvas.html` — landing со ссылками на профессии.
- `canvas:profession`, `canvas:profession-network`, `canvas:tabs`.

### Material Agent
- `src/methodology/v1/materials-agent/` — discovery → optional LLM classification → validation.
- Worker queue: состав задаёт profession view — для каждой компетенции берутся covering-блоки по `canonicalIds` (включая переиспользованные), дубли схлопываются; concurrency, retry, общий LlmBudget, coverage по элементу. При исчерпании бюджета найденные материалы сохраняются как `needs_review`, не выбрасываются.
- Журналы: `data/materials-agent/<domain>-<profession>-queue.json` (gitignored).
- Review: `materials:agent:review` — отчёт по блокам + таблица покрытия компетенций профессии.
- UX/UI full run: 33 элемента, 65 материалов, 31 связь, **34/34** компетенций; $0.0004 (LLM-кеш). Для UX/UI порядок компетенций берётся из `profession-competencies/uxui.json` (view нет).
- Product full run: 31 элемент, 68 материалов, 35 связей, **30/30** компетенций; $0.0239.
- Motion full run: 20 элементов, 38 материалов, 20 связей, **19/19** компетенций; $0.0055.
- Graphic full run: 20 элементов, 39 материалов, 22 связи, **18/18** компетенций; $0.0020.
- Итог: все 4 профессии покрыты материалами на 100%; accepted-материалов 0 (human-gated).
- **Материалы не приняты в каталог:** `catalog.materials` = 0.

## 2. Ключевые команды

```bash
# базовые проверки
npm run typecheck
npm test

# модель
npm run model:sync -- --domain it --profession uxui --write
npm run model:views -- --domain it --write
npm run model:validate -- --domain it --profession product --all --require-blocks

# mapping тегов
npm run mapping:validate -- --domain it --profession product --report

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
npm run canvas:profession -- --profession product
npm run canvas:profession-network -- --profession product
npm run canvas:tabs

# материалы
npm run materials:agent:queue -- --domain it --profession product --classify --budget-usd 0.03
npm run materials:agent:review -- --domain it --profession product
```

Открыть канвас:

```bash
open web/it-product-competency-canvas.html
```

## 3. Что считается готовым

- Профессии и теги собираются из официальных источников; Product-источники исправлены на цифровые/исследовательские занятия.
- Каталог и приоритеты UX/UI accepted; у всех accepted-блоков есть `canonicalIds`.
- Единый массив компетенций и profession views работают; prerequisites материализуются и валидируются.
- Product-граф связный; все 30 компетенций имеют tier/order, блок и связи.
- Product-теги сопоставлены 30 компетенциям (mapping draft).
- Material Agent отделён от сборки компетенций.

## 4. Открытые задачи (по приоритету)

1. **Human-review evidence-backed блоков.** В `seeds/it.json` заполнены `tagHints` для 11 профессио-специфичных компетенций (product 5, motion 3, graphic 3); `competency:seed` + Pass B дали предложения блоков с реальными Practicum-связями: product 5 блоков (sourceRefs 1–5 на блок), motion 3 (2–6), graphic 3 (5–6). Артефакты — `data/competency/proposed-blocks-it-*.json`, `review/proposed-blocks-it-*.md` (gitignored). Приёмка не выполнена; текущие accepted-блоки не менялись.
2. **Human-review материалов** — журналы и review готовы для Product (30/30), Motion (19/19), Graphic (18/18). Нужно решить, какие материалы принимать; только после этого `catalog.materials`. Перезапуск: `materials:agent:queue -- --domain it --profession <prof> --classify --budget-usd 0.15 --max-calls 120`, затем `materials:agent:review`.
3. **Human-review mapping Motion/Graphic** и привязка Practicum-тегов к accepted-блокам (теги 6 собственных блоков синтетические).
4. **Knowledge graph** (competency → components/tags/materials) — отложен по решению пользователя.
5. **Push** — если SSH-агент пуст: `ssh-add ~/.ssh/id_ed25519`, затем `git push origin main`.
6. **Остальные профессии** — после стабилизации методики расширять за пределы 4 дизайнерских (использовать схему `COS-RES-020`/`COS-RES-021`).

## 5. Известные ограничения и риски

- Product/Motion/Graphic графы строятся из view; 5 product-specific блоков accepted, остальные 25 — переиспользованные UX/UI блоки.
- Теги product-specific блоков синтетические и `needs_review`; mapping — черновик, не приёмка.
- Каталог материалов пуст; Material Agent готовит журнал/review, покрытие Product 30/30, но приёмка не выполнена.
- `data/` (кроме tracked source/model) gitignored: журналы, candidates, blocks, materials не попадают в репозиторий.
- ESCO для Product/Graphic в текущем окружении отдаёт HTML (прокси); fallback O*NET/Практикум, без обхода.
- JSON-файлы и `web/*.html` детерминированно пересобираются `model:views` / `canvas:*`.
- Канвасы — статические HTML; отдельного frontend-приложения в репозитории нет.
- Финальная приёмка блоков/материалов/приоритетов остаётся human-gated.

## 6. С чего начать новую сессию

1. `git pull` и `npm run typecheck && npm test`.
2. Проверить `git status -sb`; при `ahead N` — push (см. п. 5).
3. Запустить `npm run model:validate -- --domain it --profession product --all --require-blocks`.
4. Открыть `web/it-product-competency-canvas.html`, проверить табы и 41 связь.
5. Продолжить с задачи 1: human-review Product mapping → seed/block evidence.

## 7. История

| Версия | Дата | Что зафиксировано |
|---|---|---|
| 1.0.0 | 2026-10-22 | Handoff после сборки 4 профессий, 44 блоков, 45 компетенций, Material Agent и сетевых канвасов |
| 1.1.0 | 2026-10-25 | Product-итерация: canonicalIds для всех блоков, исправленные O*NET-занятия, 368 тегов, mapping 30/30, связный граф 41 связь, решение по priority/order, 141 тест |
| 1.2.0 | 2026-10-25 | Priority 3: очередь материалов покрывает компетенции view (Product 31 элемент, 30/30 компетенций, 68 материалов, 35 связей); review с покрытием; фикс потери материалов при исчерпании бюджета; 145 тестов |
| 1.3.0 | 2026-10-25 | Priority 4: Motion/Graphic — Practicum-источники и санитайзер тегов, mapping 19/19 и 18/18, связные графы 29/33 связи, материалы 19/19 и 18/18; все 4 профессии с review-журналами; 146 тестов |
| 1.4.0 | 2026-10-25 | Evidence-backlog: seeds tagHints для 11 компетенций, Pass B предложения блоков (product 5, motion 3, graphic 3) с реальными sourceRefs; UX/UI materials 34/34; все 4 профессии покрыты материалами, catalog.materials = 0 |
| 1.5.0 | 2026-10-26 | Motion evidence pass + learning source library: 10 motion компетенций (28 узлов / 42 связи), 10 motion-блоков, каталог 54/237, глобальный массив 55; `learning-sources` registry (33 записи, 24 active) и Google CSE discovery scaffold |
