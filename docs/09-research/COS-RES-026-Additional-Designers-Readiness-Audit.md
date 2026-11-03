---
id: COS-RES-026
title: Дополнительные дизайнерские профессии — readiness-аудит
version: 1.2.0
status: Draft
owner: Research Team
last_updated: 2026-11-03
references:
  - COS-RES-018
  - COS-RES-019
  - COS-RES-020
  - COS-RES-021
  - COS-RES-022
  - COS-RES-023
  - COS-RES-024
  - COS-RES-025
---

# COS-RES-026 — Readiness-аудит восьми профессий

## 1. Зачем

В Beta 1 задеплоены четыре профессии: UX/UI, Product, Motion, Graphic.
Остальные восемь уже имеют profession views и learning-связи, но не входят в публичную сборку.

Аудит отвечает на вопросы:

- что уже собрано;
- где есть реальное evidence из Practicum-тегов;
- чего не хватает до accepted-блоков и деплоя.

## 2. Метод

Для каждой профессии:

1. собраны Practicum-страницы и теги (`professions:collect`, `tags:collect`);
2. создан черновой mapping собранных knowledge/skill-тегов на view (`mapping:draft`);
3. проверен `mapping:validate`;
4. сверены profession view, каталог, AI-слой и release-манифест.

Важно: mapping — **черновой, эвристический**. Это не доказательство и не приёмка. `direct/adjacent/none` показывают, где есть материал для human-review, а где его нет.

## 3. Результат

| Профессия | Компетенций | Тегов | Direct | Adjacent | None | Accepted-блоков | AI-комп. |
|---|---:|---:|---:|---:|---:|---:|---:|
| Дизайнер презентаций | 22 | 29 | 4 | 3 | 15 | 0 | 9 |
| Дизайнер приложений | 35 | 5 | 2 | 0 | 33 | 0 | 9 |
| UX-исследователь | 27 | 11 | 2 | 3 | 22 | 0 | 9 |
| Арт-директор | 25 | 9 | 1 | 2 | 22 | 0 | 9 |
| 3D-дизайнер | 24 | 87 | 7 | 6 | 11 | **7** | 9 |
| Дизайнер интерьеров | 23 | 65 | 7 | 8 | 8 | **5** | 9 |
| Веб-дизайнер | 33 | 64 | 10 | 7 | 16 | **3** | 9 |
| AI-дизайнер | 27 | 25 | 2 | 4 | 21 | 0 | 9 |

`mapping:validate` для всех восьми: **0 ошибок**, но много предупреждений `без доказательств`.

## 4. Что это значит

### Сильные стороны

- У всех восьми есть **связные profession views** с tier/order/prerequisites и AI-слоем (`COS-RES-023/024`).
- У всех есть learning-связи с источниками.
- Для 3D, интерьеров и веба собрано достаточно тегов, чтобы начать содержательный mapping: 87/65/64 тегов, 13/15/17 компетенций с direct/adjacent.
- Для presentation, uxresearch и artdir есть тематические Practicum-теги, но покрытие фрагментарное.

### Блокеры деплоя

1. **Нет полного accepted-набора** ни у одной из восьми профессий. Pilot-блоки есть только у 3D (7), интерьеров (5) и веба (3); остальные специфичные компетенции без блоков.
2. **Нет source-review решений** для beta-1 по этим профессиям.
3. **Mapping черновой**: `none` у appdesign 33/35, artdir 22/25, uxresearch 22/27, aidesigner 21/27.
4. **Нет материалов** и material-review для этих профессий.
5. Appdesign и artdir имеют слишком мало собранных тегов (5 и 9): нужен дополнительный источник или ручная evidence-карта, иначе блоки будут синтетическими.

Поэтому **не добавляем их в release/beta-1.json** до появления полного набора accepted-блоков и source-review. Иначе в MVP появятся пустые или недоказанные карточки.

Проверка 3D в release 2026-11-03: gate **FAIL** — `composition=72`, `source_review_missing=19`, `source_summary_missing=11`, `no_block=1`; 3D имеет 7 опубликованных компетенций из 24. Manifest возвращён к четырём профессиям.

## 5. Что уже сделано этим аудитом

- собраны Practicum-профессии и теги для 8 профессий;
- добавлен воспроизводимый `mapping:draft`;
- созданы черновые mapping-файлы:
  - `mapping/it.presentation.json`;
  - `mapping/it.appdesign.json`;
  - `mapping/it.uxresearch.json`;
  - `mapping/it.artdir.json`;
  - `mapping/it.3ddesigner.json`;
  - `mapping/it.interior.json`;
  - `mapping/it.webdesigner.json`;
  - `mapping/it.aidesigner.json`;
- проверка mapping: 0 ошибок;
- pilot-сборка блоков: 3D — 7 (полный набор специфичных, включая hard-surface/sculpting/texturing/lighting/rendering/compositing/modeling), интерьеры — 5, веб — 3; каталог 69 блоков / 320 тегов;
- зафиксированы пробелы и порядок доработки.

## 6. Следующий порядок доработки

1. **3D-дизайнер** — лучший кандидат на pilot: 87 тегов, 13 покрытых компетенций. Собрать accepted-блоки по mapping, затем материалы.
2. **Дизайнер интерьеров** — 65 тегов, 15 покрытых; тот же путь.
3. **Веб-дизайнер** — 64 тега, 17 покрытых; много переиспользуемых UI-блоков.
4. **Дизайнер презентаций** — 29 тегов; нужно усилить content/data/visualization-компетенции.
5. **UX-исследователь** — 11 тегов; усилить методами и синтезом.
6. **Арт-директор** — 9 тегов; нужен отдельный источник по бренд-стратегии и команде.
7. **Дизайнер приложений** — 5 тегов; источник почти пустой, нужен новый Practicum/ESco-путь или ручная карта.
8. **AI-дизайнер** — 25 тегов, но AI-слой исключён из Beta; отложить до post-Beta.

## 7. Команды

```bash
# сбор тегов
npm run professions:collect -- --domain it --profession 3ddesigner
npm run tags:collect -- --domain it --profession 3ddesigner

# черновой mapping + проверка
npm run mapping:draft -- --profession 3ddesigner
npm run mapping:validate -- --domain it --profession 3ddesigner

# pilot-блоки из mapping
npm run blocks:from-mapping -- --profession 3ddesigner --budget-usd 0.03

# проверка release
npm run release:report -- --release beta-1
```

## 8. История

| Версия | Дата | Что зафиксировано |
|---|---|---|
| 1.0.0 | 2026-10-31 | Аудит 8 профессий, сбор тегов, черновой mapping, blockers и порядок доработки |
| 1.1.0 | 2026-11-03 | Pilot `blocks:from-mapping`: 3D 2 блока, интерьеры 5, веб 3; каталог 63 блока / 291 тег; release по-прежнему 4 профессии |
| 1.2.0 | 2026-11-03 | 3D добит до 7 специфичных блоков (69 блоков / 320 тегов); попытка добавить 3D в beta-1 остановлена gate: не хватает source-review, source summary и части блоков |
