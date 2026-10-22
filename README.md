# Competency Operating System (COS)

AI-native platform for competency assessment, learning pathways and workforce development.

## Status

🚧 Research & Architecture


## Визуализация компетенций

`npm run canvas:page -- --domain it --profession uxui --source review --include-seed` собирает `web/uxui-competency-canvas.html` — самодостаточную страницу-канвас с сетью UX/UI-компетенций.


## Каноническая карта UX/UI

`src/methodology/v1/competency/canonical/uxui.json` — два блока (UX/UI), 9 разделов и 34 компетенции со статусами `covered` / `partial` / `gap`. Сейчас: 34 covered / 0 partial / 0 gap; в каталоге 42 блока, 186 тегов. Проверка и coverage-отчёт:

```bash
npm run canonical:validate -- --domain it --profession uxui --source review --include-seed --report
```


## Material Agent

Материалы вынесены в отдельный контур: `npm run materials:agent -- --domain it --profession uxui --limit 2 --sources wikipedia,habr,medium`. Журнал — `data/materials-agent/`; агент не меняет каталог и не пишет в граф.


## Модель сфера → профессия → компетенции

`npm run model:sync -- --domain it --profession uxui --write` собирает `model/spheres.json`, `model/professions.json`, `model/competencies.json` и `model/profession-competencies/uxui.json`. Компетенции хранятся один раз в едином массиве; профессия ссылается на них с tier/order. Источники — `sources/spheres/it.json` и `sources/professions/it.uxui.json`.


## Профессиональные view

`model/professions/views/{product,motion,graphic}.json` задают разделы и приоритеты для разных профессий, переиспользуя единый массив компетенций. `model:views --write` генерирует `model/profession-competencies/*.json` и source-файлы профессий.


## Карты профессий

`npm run canvas:profession -- --profession motion` (также `product`, `graphic`) собирает HTML-карту профессии из profession view и единого массива компетенций.


Сборка по профессии: `npm run professions:collect -- --domain it --profession motion`, затем `npm run tags:collect -- --domain it --profession motion`. Запросы берутся из `sources/professions/<profession>.json`.


Единый массив компетенций: **43** (34 базовых + 9 профессио-специфичных); profession views: product 28, motion 19, graphic 18; каталог: 42 блока, 186 тегов.


Сетевые канвасы профессий: `npm run canvas:profession-network -- --profession product` (также `motion`, `graphic`).


Материалы новых профессий: `npm run materials:agent:review -- --domain it --profession motion` (также `product`, `graphic`). Это review-артефакты, не accepted-материалы.


Human-review канвас: `npm run canvas:tabs`, затем открыть `web/competencies-review-canvas.html` — переключение UX/UI, Product, Motion, Graphic в одном окне.
