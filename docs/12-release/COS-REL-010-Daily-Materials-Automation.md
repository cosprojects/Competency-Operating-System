---
id: COS-REL-010
title: Ежедневный добор материалов по профессиям и компетенциям
version: 1.0.0
status: Draft
owner: Release Team
last_updated: 2026-11-03
references:
  - COS-REL-009
  - COS-RES-028
---

# COS-REL-010 — ежедневный добор материалов

Автоматизация добавляет **один материал в день** в самый дефицитный слот
«профессия × компетенция × формат». Цель — постепенно закрыть 2–5 материалов на формат
(`COS-REL-009` §7.1), не тратя лишние поисковые запросы и LLM-бюджет.

## Команды

```bash
npm run materials:daily                 # план на сегодня, сеть не вызывается
npm run materials:daily -- --write      # один поиск + LLM-ревью + приёмка одного материала
npm run materials:daily -- --force      # повторный прогон в тот же день
npm run materials:daily -- --source habr --write
npm run materials:daily -- --date 2026-11-04 --write
```

Состояние:

- `data/materials-agent/daily-plan-<date>.json` — план дня;
- `data/materials-agent/daily-state.json` — история попыток, последняя дата, ротация;
- `data/materials-agent/coverage-state.json` — attempts/lastAttemptAt по форматам.

## Алгоритм выбора слота

1. Для всех 12 profession view строится покрытие `compетенция × формат` по принятым материалам
   каталога и `coverage-state` (`buildCoverageReport`).
2. Слот — пара `(competencyId, format)`. Цель формата — по tier:
   `foundation=5`, `core=3`, `optional=2` (в границах 2–5).
3. Слот исключается, если:
   - `accepted >= target` (формат закрыт);
   - попытка уже была сегодня;
   - `attempts >= 3` и cooldown 30 дней ещё не прошёл (статус `insufficient`);
   - у компетенции нет accepted-блока в каталоге (искать некуда).
4. Приоритет слота:
   ```
   score = 2 × tierWeight + 3 × (target - accepted)/target + 2 × isNewProfession
   tierWeight: foundation=3, core=2, optional=1
   isNewProfession: у профессии 0 принятых материалов
   ```
5. Tie-break: сначала слот, который дольше не пытались; затем профессия, к которой дольше
   не возвращались; затем детерминированный `profession|competency|format`.
6. Источник выбирается ротацией: тот, который дольше всех не использовался
   (`wikipedia → habr → stepik → medium → internet-archive → learn-anything`).
7. Один прогон = один слот = один источник = максимум один принятый материал.

## Что происходит при `--write`

1. `runMaterialQueue` ищет по одной компетенции, одному источнику, `limitPerCompetency=1`.
2. Pass D/Pass E (`classify` + `reviewMaterials`) ставят вердикт и relevance.
3. Принимается только материал нужного формата, `review.status=accepted`,
   relevance ≥ 0.7, free/freemium; остальное отбрасывается.
4. `materials:accept` добавляет один материал в каталог; `duplicate canonicalUrl` и `blocked`
   источники отсекаются существующей приёмкой.
5. `coverage-state` получает `attempts+1` и `lastAttemptAt=today`, история — результат.
6. Если материал не найден или LLM отклонил — каталог не меняется, попытка всё равно
   учитывается; после 3 раундов слот уходит в `insufficient` и ждёт 30 дней.

## Корнер-кейсы

| Ситуация | Поведение |
|---|---|
| Все форматы закрыты | План `null`, сеть не вызывается, exit 0 |
| Компетенция без accepted-блока | Слот не создаётся; сначала нужен блок в каталоге |
| Новая профессия (0 материалов) | Приоритет `+2` к score; слоты создаются после появления блоков |
| Материал покрывает несколько компетенций | Один и тот же материал засчитывается в каждый формат по своим ссылкам |
| `book/docs` и `podcast` | Нормализуются в `reference`/`video` через `formatOf` |
| Дубликат URL в каталоге | Приёмка отклоняет, слот получает attempt |
| Платный/неизвестный доступ | Не принимается (free/freemium по умолчанию) |
| `needs_confirmation` | Не добавляется автоматически: нужен бейдж/человек |
| Источник недоступен/лимит/ошибка сети | Записывается `error`, слот получает cooldown |
| LLM вернул reject | `rejected`, попытка учтена |
| Бюджет LLM | Жёсткий лимит на прогон: $0.02 и 6 вызовов |
| Повторный запуск в тот же день | Игнорируется без `--force` |
| Дата/таймзона | Дата в UTC (`YYYY-MM-DD`); `--date` для ручного переопределения |
| Профессия удалена из view | В план не попадает |
| Форматов больше цели | `accepted >= target` → слот закрыт |
| 3 неудачных раунда | `insufficient`, следующая попытка через 30 дней |
| Нет `DEEPSEEK_API_KEY` | `--write` падает до поиска с понятной ошибкой; план работает |
| Каталог/модель не консистентны | Сначала `npm run model:validate` и `release:validate` |

## Ежедневный запуск

### GitHub Actions (opt-in)

В репозитории есть workflow `.github/workflows/materials-daily.yml`. Он выключен по умолчанию:

1. переменная репозитория `MATERIALS_DAILY_ENABLED=true` (Settings → Actions → Variables);
2. секрет `DEEPSEEK_API_KEY` (Settings → Secrets and variables → Actions);
3. workflow запускается по cron `0 6 * * *` UTC и вручную (`workflow_dispatch`);
4. после прогона коммитит только изменения каталога и состояние (`daily-state`, `coverage-state`).

Если переменная не выставлена — job пропускается, ничего не тратит.

### Локально / на сервере

```bash
# каждый день в 06:00
0 6 * * * cd /path/to/Competency-Operating-System && DEEPSEEK_API_KEY=... npm run materials:daily -- --write >> data/materials-agent/daily.log 2>&1
```

## Ограничения и решения

- «Один запрос» = один слот и один источник, а не один HTTP-вызов: адаптер источника может
  сделать 1–2 запроса. Это держит расход в пределах ~1 источник/день.
- Автоматизация не публикует контент: она добавляет материал в каталог, после чего
  `release:validate`/`release:build` и spot-check остаются обязательными.
- При систематических `no_material` для формата `case`/`reference` нужен новый провайдер
  или ручное решение — бесконечный поиск не запускается.
