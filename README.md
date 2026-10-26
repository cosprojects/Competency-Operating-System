# Competency Operating System (COS)

AI-native platform for competency assessment, learning pathways and workforce development.

## Status

🚧 Research & Architecture


## Визуализация компетенций

`npm run canvas:page -- --domain it --profession uxui --source review --include-seed` собирает `web/uxui-competency-canvas.html` — самодостаточную страницу-канвас с сетью UX/UI-компетенций.


## Каноническая карта UX/UI

`src/methodology/v1/competency/canonical/uxui.json` — два блока (UX/UI), 9 разделов и 34 компетенции со статусами `covered` / `partial` / `gap`. Сейчас: 34 covered / 0 partial / 0 gap; в каталоге 54 блока, 237 тегов. Проверка и coverage-отчёт:

```bash
npm run canonical:validate -- --domain it --profession uxui --source review --include-seed --report
```


## Material Agent

Материалы вынесены в отдельный контур: `npm run materials:agent -- --domain it --profession uxui --limit 2 --sources wikipedia,habr,medium`. Журнал — `data/materials-agent/`; агент не меняет каталог и не пишет в граф.

Очередь покрывает компетенции profession view (включая переиспользованные блоки через `canonicalIds`). Полные прогоны: UX/UI — 33 элемента / 65 материалов / 31 связь (34/34 компетенций); Product — 31 / 68 / 35 (30/30); Motion — 30 / 59 / 26 (28/28); Graphic — 20 / 39 / 22 (18/18). Все 4 профессии покрыты на 100%, `catalog.materials` = 0 (human-review не выполнен). Команда:

```bash
npm run materials:agent:queue -- --domain it --profession product --per-competency 1 \
  --sources wikipedia,habr,medium --concurrency 3 --retry 2 --classify --budget-usd 0.15 --max-calls 120
npm run materials:agent:review -- --domain it --profession product
```


## Модель сфера → профессия → компетенции

`npm run model:sync -- --domain it --profession uxui --write` собирает `model/spheres.json`, `model/professions.json`, `model/competencies.json` и `model/profession-competencies/uxui.json`. Компетенции хранятся один раз в едином массиве; профессия ссылается на них с tier/order. Источники — `sources/spheres/it.json` и `sources/professions/it.uxui.json`.


## Профессиональные view

`model/professions/views/<profession>.json` задают разделы и приоритеты для разных профессий, переиспользуя единый массив компетенций. `model:views --write` генерирует `model/profession-competencies/*.json` и source-файлы профессий. Схемы собраны для 11 профессий: UX/UI, product, motion, graphic + presentation, appdesign, uxresearch, artdir, 3ddesigner, interior, webdesigner (см. [COS-RES-023](docs/09-research/COS-RES-023-Additional-Designer-Professions.md)).


## Карты профессий

`npm run canvas:profession -- --profession motion` (также `product`, `graphic`) собирает HTML-карту профессии из profession view и единого массива компетенций.


Сборка по профессии: `npm run professions:collect -- --domain it --profession motion`, затем `npm run tags:collect -- --domain it --profession motion`. Запросы берутся из `sources/professions/<profession>.json`.


Единый массив компетенций: **103** (34 базовых + 69 профессио-специфичных); 11 profession views: uxui 34, product 30, motion 28, graphic 18, presentation 13, appdesign 26, uxresearch 18, artdir 16, 3ddesigner 15, interior 14, webdesigner 24; каталог: 54 блока, 237 тегов (у всех accepted-блоков заполнены `canonicalIds`).

Priority/order профессии хранится в `model/professions/views/<profession>.json` и материализуется в `model/profession-competencies/<profession>.json` вместе с prerequisites. Отдельный `priority/product.json` не вводится: `priority/uxui.json` — block-level accepted marks UX/UI, а Product работает на уровне канонических компетенций. Проверка:

```bash
npm run model:validate -- --domain it --profession product --all --require-blocks
```


Сетевые канвасы профессий: `npm run canvas:profession-network -- --profession product` (также `motion`, `graphic`). Все три графа связные, с единственным корнем `ux-design-thinking`: Product 30 узлов / 41 связь, Motion 28 / 42, Graphic 18 / 33.


Сопоставление тегов компетенциям: `mapping/it.<profession>.json` + `npm run mapping:validate -- --domain it --profession <profession> --report`. Product 30/30 (direct 11 / adjacent 15 / none 4), Motion 28/28 (12/11/5), Graphic 18/18 (11/6/1). Подробнее — [COS-RES-020](docs/09-research/COS-RES-020-Product-Competency-Assembly.md) и [COS-RES-021](docs/09-research/COS-RES-021-Motion-Graphic-Competency-Assembly.md). Practicum подключён как источник для всех четырёх профессий; теги курсов проходят санитайзер.


Материалы новых профессий: `npm run materials:agent:review -- --domain it --profession motion` (также `product`, `graphic`). Review показывает покрытие компетенций профессии; это review-артефакты, не accepted-материалы.


Evidence-backed блоки: в `seeds/it.json` заполнены `tagHints` для 11 профессио-специфичных компетенций; `competency:seed --domain it --profession product --tags-file data/competency/tags-it-product.json`, затем `competency:build` дают предложения блоков с реальными sourceRefs (`data/competency/proposed-blocks-*.json`, не приняты).

Human-review канвас: `npm run canvas:tabs`, затем открыть `web/competencies-review-canvas.html` — переключение 11 профессий в одном окне (UX/UI, Product, Motion, Graphic, Презентации, Приложения, UX-исследования, Арт-дирекшн, 3D, Интерьеры, Веб-дизайн).


Handoff для продолжения: [COS-RES-019](docs/09-research/COS-RES-019-Competency-Module-Session-Handoff.md).


Библиотека учебных источников: [COS-RES-022](docs/09-research/COS-RES-022-Learning-Sources-Library.md). Связи «компетенция → источник» ведутся в `model/learning-source-links.json` и мержатся при `model:sync`; реестр — 73 источника (55 active), покрытие: UX/UI 32/34, Product 28/30, Motion 27/28, Graphic 18/18, новые 7 профессий — 100%. Команды: `npm run learning:validate`, `npm run learning:audit`, `npm run learning:map -- --report`, `npm run learning:topics -- --profession motion --report` (robots-safe извлечение тем, без копирования текста), `npm run learning:discover`.
