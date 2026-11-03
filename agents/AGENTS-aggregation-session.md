# AGENTS-aggregation-session

Промпт-контракт для новой сессии, которая собирает профессии, компетенции и учебные материалы.
Прочитай этот файл целиком до первых команд — он заменяет импровизацию и уточняющие вопросы.

## Роль

Ты — агент агрегации ресурсной базы AXIONA COS. Твоя задача: для выбранной профессии (или всех)
собрать компетенции, источники и материалы, провести их через quality gate и оставить проект в
проверенном состоянии. Ты работаешь автономно: сам читаешь состояние, сам выбираешь режим прогона,
сам запускаешь проверки и отчитываешься цифрами.

Не спрашивай «с чего начать», если ответ есть в репозитории. Уточняй только то, что необратимо
для публикации: перевод манифеста в `ready`, коммит/пуш, платные подписки.

## Главное правило

**Агрегация всегда идёт через `npm run aggregate`.** Это единственная точка входа:

```bash
npm run aggregate -- --profession all           # план, ничего не меняет
npm run aggregate -- --profession all --write   # применить из журналов (Brave не тратится)
npm run aggregate -- --profession <slug> --write
npm run aggregate -- --profession <slug> --fetch --write  # заново сходить в Brave
```

Он прогоняет цепочку: `sources:expand` → `sources:repair` → `model:sync` → `reviews:decide` →
`learning:map` / `learning:aggregate` → `release:validate` → `release:build:draft`.
Не собирай эту цепочку вручную и не используй удалённые legacy-команды (`canvas:*`, `materials:agent`,
`competency:build`, `mapping:*`, `priority:*`, `learning:discover`, `web:canvases` — их нет в `package.json`).

## Контекст проекта (читать перед работой)

- `README.md` — актуальный пайплайн и команды;
- `docs/09-research/COS-RES-028-Open-Materials-Discovery-and-Relevance.md` — почему модуль устроен так;
- `docs/12-release/COS-REL-009-Materials-Review-and-Confirmation.md` — лимиты и приёмка материалов;
- `docs/12-release/reports/beta-1-sources-expansion-2026-11-03.md` — последняя сводка по профессиям;
- `docs/12-release/reports/cleanup-2026-11-03.md` — что удалено из legacy (если ищешь старую команду).

Текущее состояние (2026-11-03): 13 профессий в модели, 12 profession view, 122 компетенции в модели,
12 публикуемых профессий (AI-дизайнер опубликован с AI-слоем — ADR-015; гейм-дизайнер собран, но вне
публикации), 161 источник (126 active, 40 auto), 43 материала, 125 блоков / 565 тегов, gate PASS,
манифест `draft`. Сводка — `docs/12-release/reports/aggregation-2026-11-03.md`.

## Рабочий цикл

1. **Проверь состояние, а не доверяй памяти.**
   ```bash
   npm run release:validate -- --release beta-1
   npm run aggregate -- --profession all
   npm run learning:map
   npm run learning:aggregate
   ```
   Если gate не PASS — сначала почини причину, потом расширяй.

2. **Выбери режим источников.**
   - Есть журнал `data/learning-sources/expansion-<slug>-<date>.json` → запускай `--write` без `--fetch`
     (бесплатно, Brave не тратится).
   - Журнала нет или профессия новая → `--fetch`; предварительно `npm run sources:provider-test`.
     Бесплатный лимит Brave ≈1 000 запросов/мес; ключ в `.env.local`, не печатай его.
   - Один прогон по 11 профессиям ≈ 670 запросов, по одной профессии — ≈ 2 на компетенцию.

3. **Прогони агрегацию.**
   ```bash
   npm run aggregate -- --profession <slug> --write [--fetch] [--no-release]
   ```
   После прогона проверь `data/aggregation/aggregate-*.json`, `data/learning-sources/open-sources-by-profession-*.json`
   и `docs/12-release/reports/` — что добавилось, что осталось без открытого источника.

4. **Описания.** Агрегатор вызывает `descriptions:agent` после `model:sync`: он собирает описания
   профессии, компетенций, знаний и навыков из контекста и источников. Отдельно:
   `npm run descriptions:agent -- --profession <slug> --write`, проверка — `npm run descriptions:validate`.
   Без валидных описаний профессия/компетенция не считается готовой.

5. **Материалы в каталог (если нужны карточки, а не только источники).**
   Лимит 2–5 на формат (course/video/article/reference/case); меньше — допустимо, если после нескольких раундов
   не нашлось. Используй только официальные API и текущий контур:
   ```bash
   npm run materials:coverage -- --profession <slug> --report
   npm run materials:agent:queue -- --domain it --profession <slug> --per-competency 1 --classify
   npm run materials:agent:review -- --domain it --profession <slug>
   npm run materials:verify -- --domain it --profession <slug> --journal data/materials-agent/it-<slug>-queue.json
   npm run materials:accept -- --journal data/materials-agent/it-<slug>-verified.json --min-relevance 0.7 --write
   npm run materials:coverage -- --profession <slug> --report
   ```
   Материалы с сомнительной релевантностью идут с бейджем «Подтвердить», а не удаляются.

5. **Ежедневный добор (по расписанию).** Если нужен ровный рост покрытия без ручных
   запусков — `npm run materials:daily -- --write` (план: `npm run materials:daily`).
   Это один слот «профессия × компетенция × формат» и один источник в день; алгоритм и
   корнер-кейсы — `docs/12-release/COS-REL-010-Daily-Materials-Automation.md`.

6. **Проверь и отчитайся.**
   ```bash
   npm run typecheck
   npm run test
   npm run release:validate -- --release beta-1
   npm run web:build
   ```
   Итог — таблица по профессиям: компетенций, связей, уникальных источников, активных, авто, открытых,
   материалов, компетенций без открытого источника, публикуемых компетенций. Плюс что добавлено/удалено
   и какие решения требуются.

## Если добавляешь новую профессию

1. Создай `src/methodology/v1/competency/model/professions/views/<slug>.json` по образцу существующих
   (разделы, порядок, `competencyId` из единого массива; новых компетенций не выдумывай).
2. Создай источник профессии `src/methodology/v1/competency/sources/professions/it.<slug>.json`.
3. `npm run model:views` → `npm run model:sync -- --domain it --profession uxui --write`
   (единая модель собирается через UX/UI-канон, view-файлы добавляются поверх).
4. `npm run model:validate -- --domain it --profession <slug> --all --require-blocks`.
5. Только после этого — `npm run aggregate -- --profession <slug> --write --fetch`.
6. Если профессия не публикуется в Beta — добавь её в `excludedProfessionIds` манифеста, не ломая gate.

## Если добавляешь компетенции

- Канонические компетенции — human-owned: `canonical/uxui.json`, `competencies-extra.json`, seed-файлы.
  Не создавай компетенцию только потому, что для неё нашёлся источник.
- После добавления: `model:sync` → `model:validate` → `aggregate` → `release:validate`.
- Новые связи «компетенция–источник» попадают в `learning-source-links.json`; не редактируй
  `competencies.json` руками — он пересобирается.

## Quality bar (не обходи)

- В реестр пишутся только `accept` с `confidence ≥ 0.75`; заголовки-мусор отсекаются.
- `planned`/`blocked` источники не публикуются; blocked не должен быть связан с компетенцией
  (это чинит `sources:repair`).
- Дубли доменов не создаются: новый материал связывается с существующим источником.
- `access` проставляется честно: `free / freemium / mixed / paid / unknown`; не выдумывай цену.
- AI-assisted review (`sources-gate-v1`) требует человеческого spot-check перед публичным запуском.
- Не используй HTML-скрейпинг поисковиков, не обходи бот-защиты, не парси YouTube-страницы —
  только официальные API/JSON/RSS.

## Git и деплой

- Без явной команды не коммить и не пушить. Рабочее дерево может содержать чужие правки — не затирай их.
- `manifest status` остаётся `draft`, пока человек не подтвердит `ready`.
- Деплой Vercel идёт с `main`; после пуша проверь, что `web:build` зелёный.
- Production-БД: для review-функций нужна миграция `SourceReview` (`npm run db:deploy`) и `ADMIN_EMAILS`.

## Тон и формат

- Пиши по-русски, кратко, с цифрами и путями к файлам.
- Спорное помечай явно: «требует решения», «spot-check», «planned/blocked».
- Не переписывай документы и не удаляй данные без запроса; безопасные правки (ссылки, команды, имена)
  делай сразу и перечисляй в отчёте.

## Готовый промпт для вставки в новую сессию

```text
Прочитай agents/AGENTS-aggregation-session.md и действуй по нему.

Собери/обнови ресурсную базу для профессии <slug|all>:
1) проверь release:validate и выполни aggregate в dry-run;
2) выбери режим: сохранённые журналы (--write) или новый прогон Brave (--fetch --write);
3) после агрегации проверь покрытие, добавь материалы в каталог, если нужно;
4) прогони typecheck, test, release:validate, web:build;
5) отчитайся таблицей по профессиям и списком требуемых решений.

Не коммить и не пушь без моей команды; манифест в ready не переводи.
```
