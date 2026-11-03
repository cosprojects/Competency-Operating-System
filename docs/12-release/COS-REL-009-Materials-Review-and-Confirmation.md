---
id: COS-REL-009
title: Материалы — лимиты покрытия, LLM-приёмка и подтверждение ресурсов
version: 1.1.0
status: Draft
owner: Product Team
last_updated: 2026-11-03
references:
  - COS-RES-017
  - COS-RES-022
  - COS-RES-027
  - COS-RES-028
  - COS-REL-001
  - COS-REL-002
  - COS-REL-004
  - COS-REL-008
  - COS-COM-010
---

# COS-REL-009 — материалы: лимиты, LLM-приёмка, подтверждение

Спека фичи, закрывающей пробелы из [`COS-RES-028`](../09-research/COS-RES-028-Open-Materials-Discovery-and-Relevance.md):
сколько материалов нужно на формат, как методолог-LLM ранжирует и принимает, что делать с сомнительными
ресурсами (бейдж «Подтвердить» + модалка подтверждения/блокировки), как подписывать доступ.

## 1. Контекст и проблема

Сейчас контур материалов собран из двух половин:

- discovery + Pass D: `materials:agent:queue` находит материалы и через LLM-связку ставит
  `links[].relevance` (`src/methodology/v1/competency/materials/classify.ts`);
- приёмка: `materials:accept` механически берёт материалы с `relevance >= 0.7` и `access` free/freemium
  (`src/methodology/v1/materials-agent/accept.ts`), кладёт в `catalog.materials`, а `release:build`
  подмешивает их в карточки компетенций (`scripts/release/lib.ts`).

Что уже есть (факты на 2026-11-03, 11:25–11:27):

- 11 очередей Material Agent: 579 найденных материалов, 481 связь; форматы — 559 статей, 15 книг, 5 видео, **0 курсов**;
- после порога 0.7 принято **39 материалов** в `catalog.materials`; видео в продуктовой выдаче практически нет;
- публикация: 54 источника × 642 строки в `beta-1.json`, из них 89% — курсы, 1,1% — видео.

Проблемы, которые закрывает фича:

1. **Нет целевого количества.** «Хоть один материал» — не ответ на вопрос «сколько нужно, чтобы было полезно».
2. **Нет решения «принять/отклонить».** Есть только порог релевантности: LLM не выносит вердикт,
   не объясняет пользу, не отличает «пограничный» материал от явно нерелевантного.
3. **Нечего делать с сомнительным.** Сейчас принять или отклонить может только инженер командой;
   пользователь видит материал и не может ни подтвердить его, ни заблокировать.
4. **Метки доступа непонятны.** «Смешанный доступ» не говорит, что именно открыто.

## 2. Решения (приняты 2026-11-03)

| № | Вопрос из `COS-RES-028` | Решение |
|---|---|---|
| 1 | Глубина на компетенцию | Цель **2–5 материалов на каждый формат** (курс, видео, статья, справочник, кейс); меньше — допустимо только после исчерпания лимита попыток с явной пометкой `insufficient`. |
| 2 | Провайдеры | Только **официальные API/RSS** с публичной документацией и ToS. HTML-скрейпинг, обход paywall/robots и неофициальные прокси — запрещены. |
| 3 | Кто ревьюит | **Агент-методолог** (LLM-пасс `E`), с аудитом решений. Правило №7 `agents/AGENTS-competency-methodologist.md` уточнено 2026-11-03: оценка полезности материала в Pass E разрешена, оценка уровней и важности компетенций — нет. |
| 4 | Роль LLM | LLM **ранжирует и принимает сам**; сомнительное получает бейдж «Подтвердить». Подтверждать и блокировать в интерфейсе могут **только залогиненные пользователи**; порог — доля от активных залогиненных (§7.4). |
| 5 | `mixed`/непонятный доступ | **Показываем всё**: `free`, `freemium`, `mixed`, `paid` — по умолчанию, с понятной меткой. Отчёт «открытые источники» остаётся строгим free/freemium, продукт показывает ограниченный доступ с явной меткой. |

## 3. Цели и метрики

Цель: к концу Beta по каждой опубликованной компетенции есть осмысленный набор материалов
по каждому доступному формату, полученный автоматически, проверяемый и исправимый сообществом.

Метрики успеха (`[ASSUMPTION]` — ориентиры, калибруются по первому прогону):

| Метрика | Сейчас | Цель |
|---|---|---|
| Доля пар «компетенция × формат» с ≥2 принятыми материалами (статьи, справочники) | ~15% | ≥70% |
| То же для курсов | ~35% | ≥60% |
| То же для видео | ~2% | ≥50% (после включения YouTube) |
| Доля неподтверждённых ресурсов среди показанных через 2 недели | — | ≤25% |
| Доля ресурсов, заблокированных пользователями, среди показанных | — | ≤5% |
| «Подтвердили» → бейдж исчез (медиана) | — | ≤3 дня |
| Потеря публикуемых компетенций из-за новых правил | 0 | 0 |

## 4. Роли и сценарии

| Роль | Сценарий |
|---|---|
| Агент-методолог (LLM, offline-пайплайн) | получает кандидатов, ранжирует, выносит вердикт `accept/confirm/reject` с причиной и уверенностью |
| Редактор материалов (человек, offline) | запускает прогон, смотрит отчёт покрытия, разбирает `rejected` и `insufficient` |
| Пользователь (гость или залогиненный) | видит карточку с бейджем «Подтвердить», открывает модалку, подтверждает или блокирует, видит результат |
| Админ | видит очередь спорных ресурсов, может подтвердить/заблокировать принудительно, выгрузить решения в пайплайн |

## 5. User stories

- **US-1.** Как исследователь, я хочу видеть для каждой компетенции, сколько материалов по каждому формату
  нужно и чего не хватает, чтобы закрывать пробелы целенаправленно.
- **US-2.** Как методолог-агент, я хочу выносить по материалу вердикт с причиной и уверенностью,
  чтобы принимать полезное и отклонять нерелевантное без человека.
- **US-3.** Как пользователь, я хочу одним действием подтвердить сомнительный материал или сообщить,
  что он не по теме, чтобы карта становилась точнее.
- **US-4.** Как пользователь, я хочу сразу понимать, что доступно бесплатно, а что платно,
  чтобы не тратить время на закрытый ресурс.
- **US-5.** Как админ, я хочу видеть и разрешать спорные ресурсы, чтобы сообщество не могло
  испортить выдачу.

## 6. Критерии приёмки (Given/When/Then)

**Лимиты покрытия**

1. Given у компетенции 0 материалов формата «видео», When запускается полный прогон,
   Then discovery выполняет не более 3 раундов по 3 запроса и, если принятых нет, пишет
   `status: insufficient`, `attempts: 3`, `reason: no_relevant|no_source`.
2. Given у компетенции 2 принятых видео, When прогон продолжается, Then для этого формата
   цель — 3, и поиск останавливается на 5.
3. Given попытки формата исчерпаны, When запускается новый прогон в тот же день,
   Then формат не ищется повторно (cooldown), а отчёт показывает дату следующей попытки.
4. Given закончился бюджет LLM, When прогон прерывается, Then уже найденное сохраняется,
   а состояние попыток не теряется (`status: partial`).

**LLM-приёмка**

5. Given кандидат с `relevance >= 0.7`, `confidence >= 0.7`, `verdict: accept`, When приёмка,
   Then материал попадает в каталог без бейджа.
6. Given кандидат с `relevance 0.5–0.7` или `confidence 0.5–0.7`, When приёмка,
   Then материал попадает в выдачу с бейджем «Подтвердить» и причиной пограничности.
7. Given кандидат с `verdict: reject`, When приёмка, Then материал не публикуется,
   а причина отказа пишется в журнал (`off_topic`, `marketing`, `no_practice`, `duplicate`).
8. Given LLM вернула невалидный JSON, When разбор ответа, Then материал не теряется:
   он остаётся кандидатом с `verdict: confirm` и `issue: invalid_response`.

**Бейдж и модалка**

9. Given ресурс со статусом `needs_confirmation`, When открывается карточка на десктопе и мобильном,
   Then в правом верхнем углу виден бейдж «Подтвердить», а по наведению и фокусу — подсказка
   «Ресурс не подтверждён — помоги подтвердить его актуальность».
10. Given **гость** нажал бейдж, When открывается действие, Then его ведут на вход
    с возвратом к материалу, а голос не создаётся.
11. Given залогиненный пользователь нажал бейдж, When открывается модалка, Then он видит название
    ресурса и вопрос «Материал подходит?», действия «Да, подходит» и «Не подходит», и может
    закрыть окно по Escape.
11. Given пользователь выбрал «Не подходит», When он отправляет форму, Then он обязан выбрать
    причину (не по теме / недостоверный / ссылка не работает / платный или закрытый / другое),
    а после отправки видит «Спасибо, учли» и обновлённый бейдж.
12. Given тот же пользователь повторно голосует по тому же ресурсу, When отправка,
    Then его предыдущий голос заменяется (одно действие на пользователя), а не дублируется.
13. Given число блокировок достигло `required(BLOCK)` (для текущей MAU), When любой открывает карточку,
    Then ресурс скрыт из выдачи этой компетенции, а в журнале есть решение на пересмотр.
14. Given число подтверждений достигло `required(CONFIRM)`, When любой открывает карточку,
    Then бейджа нет, ресурс остаётся в выдаче.
15. Given один подтвердил и один заблокировал, When карточка отрисована,
    Then статус «спорный», бейдж остаётся, и админ видит ресурс в очереди разбора.
16. Given число активных залогиненных выросло, When статус пересчитан, Then уже подтверждённые
    ресурсы не теряют статус, а заблокированные не возвращаются без админа или перепроверки.

**Метки доступа**

16. Given `access: mixed`, When карточка отрисована, Then чип подписан «Бесплатное и платное»,
    а подсказка объясняет, что часть материалов бесплатна.
17. Given `access: paid`, When пользователь не авторизован, Then он видит «Платно»
    и ту же кнопку «Войти и открыть», что и раньше (поведение доступа не меняется).

**Методолог**

18. Given прогон Pass E, When материал получает `verdict`, Then в каталоге сохраняется
    `review: {verdict, confidence, usefulness, reason, whyUseful, flags, reviewedAt, reviewer}`.
19. Given материал уже принят, When источник обновлён или накоплены жалобы,
    Then он может быть перепроверен тем же пассом без ручной правки каталога.

## 7. Функциональные требования

### 7.1. Лимиты покрытия

Константы — один конфиг `src/methodology/v1/materials-agent/limits.ts` (новый файл), правки только там.

| Параметр | Значение | Комментарий |
|---|---:|---|
| `TARGET_PER_FORMAT` | 3 | цель для `core` |
| `MIN_PER_FORMAT` | 2 | ниже — только через `insufficient` |
| `MAX_PER_FORMAT` | 5 | далее формат не ищем |
| `TARGET_BY_TIER` | foundation 5, core 3, optional 2 | приоритет foundation |
| `MAX_FORMAT_ROUNDS` | 3 | полный прогон по формату; далее cooldown |
| `QUERIES_PER_ROUND` | курс 3, видео 3, статья 3, справочник 2, кейс 2 | запросы из query plan (R2 из `COS-RES-028`) |
| `MAX_CANDIDATES_PER_FORMAT` | 20 | сколько кандидатов уходит в LLM |
| `MAX_QUERIES_PER_COMPETENCY` | 24 | страховка от лавины запросов |
| `MAX_LLM_REVIEWS_PER_COMPETENCY` | 20 | бюджет Pass E |
| `MAX_NEW_ACCEPTS_PER_RUN` | 100 | страховка от массовой приёмки |
| `COOLDOWN_DAYS` | 30 | до следующей попытки или нового провайдера |
| `ACCEPT_RELEVANCE` | 0.7 | принять без бейджа |
| `CONFIRM_RELEVANCE` | 0.5 | ниже — отклонение |
| `ACCEPT_CONFIDENCE` | 0.7 | уверенность LLM |

Алгоритм прогона:

```text
state = load(data/materials-agent/coverage-state.json)
for competency in queue:
  for format in FORMATS:
    if accepted[format] >= target: continue
    if rounds[format] >= MAX_FORMAT_ROUNDS: mark insufficient(reason, attempts); continue
    if cooldown_until[format] > today: continue
    if queries_used >= MAX_QUERIES_PER_COMPETENCY: break
    run one round: query plan -> candidates -> dedupe -> rank -> Pass E -> accept/confirm/reject
    rounds[format] += 1
    persist state
save state
```

Состояние (JSON, gitignored): `data/materials-agent/coverage-state.json`
`{ "<professionId>": { "<competencyId>": { "<format>": { accepted, attempts, lastAttemptAt, cooldownUntil, status, reason } } } }`.
Отчёт `npm run materials:coverage -- --profession motion --report` печатает таблицу
«компетенция × формат: принято / цель / попытки / статус» и список `insufficient`.

Правило «допускается меньше»: `insufficient` ставится только после `MAX_FORMAT_ROUNDS` раундов
**или** при `MAX_QUERIES_PER_COMPETENCY`/бюджете; пробел не маскируется, а показывается в отчёте.
Ручной сброс: `materials:coverage --reset --profession motion --competency motion-timing-easing --format video`.

### 7.2. LLM-приёмка (Pass E, «методолог-ревьюер»)

Новый пасс поверх Pass D. Вход: кандидат (title, provider, kind, language, access, description,
snippet, publishedAt, сигналы провайдера) + компетенция (title, definition, компоненты, теги)
+ формат (курс/видео/статья/справочник/кейс) + уже принятое по формату.

Выход (zod `materialReviewSchema`):

```json
{
  "verdict": "accept | confirm | reject",
  "confidence": 0.0,
  "usefulness": 0.0,
  "whyUseful": "строка до 200 символов, по-русски",
  "reason": "строка до 600 символов",
  "flags": ["generic", "no_practice", "marketing", "paywall", "outdated", "no_snippet", "wrong_language"]
}
```

Правила промпта (заменяют/уточняют Pass D для материалов):

1. Судить только по переданным метаданным и короткому snippet; не выдумывать цитаты, цены, автора, лицензию.
2. Оценивать **пригодность для освоения компетенции**: точность темы, практическая ценность, актуальность, формат.
3. Не менять `url`, `access`, `price`, `language` — это данные адаптера.
4. Агрегаторы, лендинги «купи курс», страницы вакансий и карьеры — `reject`.
5. Дубли и переиздания одного материала — `reject` (duplicate).
6. `whyUseful` — для карточки «Почему подходит», коротко и по делу, без маркетинга.
7. Сомнительное — `confirm`, а не `accept`: лучше бейдж, чем тихая ошибка.

Правило приёмки:

```text
if verdict = accept and relevance >= 0.7 and confidence >= 0.7 and access in {free, freemium} -> accepted
else if verdict in {accept, confirm} and relevance >= 0.5 and confidence >= 0.5 -> needs_confirmation
else -> rejected
```

Бюджет/повтор: Pass E использует существующие `LlmBudget`, кэш `inputHash`, retry;
при исчерпании бюджета материалы остаются `confirm`-кандидатами, журнал получает `status: partial`.
Повторная проверка — только по событиям: обновление `lastChecked`, накопленные жалобы,
смена провайдера/порогов.

### 7.3. Бейдж «Подтвердить» и модалка

Показ: `reviewStatus` в публичном контенте; бейдж рендерится в правом верхнем углу карточки
(`.material-card`, компонент `MaterialCard`). Доступность: кнопка с `aria-label`, подсказка
по `focus`/`hover`, не только цветом.

Состояния и тексты:

| `reviewStatus` | Бейдж | Подсказка |
|---|---|---|
| `needs_confirmation` | «Подтвердить» | «Ресурс не подтверждён — помоги подтвердить его актуальность» |
| `disputed` | «Спорный» | «Есть сомнения в материале — посмотри и скажи, подходит ли он» |
| `confirmed` / `auto_accepted` | нет | — |
| `blocked` | карточка не рендерится | — |

Модалка (переиспользует `.modal-backdrop`, `.feedback-dialog`, кнопки и focus-trap из `FeedbackDialog`,
без новых макетов):

- заголовок «Материал подходит?»;
- подзаголовок: название ресурса + «Проверь, что он по теме компетенции «{title}», ссылка открывается,
  доступ соответствует обещанному.»;
- основное действие «Да, подходит»;
- вторичное «Не подходит» → раскрывает причины: «Не по теме», «Недостоверный», «Ссылка не работает»,
  «Платный или закрытый», «Другое» + необязательный комментарий (≤500 символов);
- отправка: «Отправить»; успех: «Спасибо, учли.»; ошибка: «Не удалось отправить. Попробуй ещё раз.»
- после действия бейдж обновляется без перезагрузки; для глобального эффекта — пороги ниже.

Гость видит бейдж и подсказку, но действие требует входа: клик ведёт на `/login?returnTo=<карточка>`
(как в `SourceLink`), после входа возвращает к материалу. Без входа голос не создаётся.

### 7.4. Аппрув и блокировка: логика

Хранение: новая таблица (см. §10). Голос скоупится парой `sourceId + competencyId`;
причины «Недостоверный» и «Ссылка не работает» дополнительно считаются сигналом на весь источник.

Действие пользователя — **только залогиненного**:

- `CONFIRM` — «подходит»;
- `BLOCK` + причина;

Порог зависит от базы: `[ASSUMPTION]` доля от **активных залогиненных пользователей** (MAU 30 дней:
различные `userId` с любым событием аналитики за 30 дней; значение кэшируется на час).
Так один голос не решает судьбу ресурса на маленькой базе, а на большой — не требуется 100%.

```text
activeUsers = max(1, distinct logged-in users with events in last 30 days)
required(action) = clamp(ceil(actionShare * activeUsers), actionMin, actionMax)

BLOCK:   share 5%,  min 2, max 10
CONFIRM: share 10%, min 2, max 15

blocks   = число разных залогиненных акторов с BLOCK
confirms = число разных залогиненных акторов с CONFIRM
adminBlock -> blocked
blocks   >= required(BLOCK)   -> blocked (скрыт из выдачи, помечен на пересмотр)
blocks   >= 1 и < required     -> disputed (бейдж «Спорный»)
confirms >= required(CONFIRM)  -> confirmed (бейдж снят)
LLM auto_accepted              -> auto_accepted (без бейджа)
иначе                          -> needs_confirmation (бейдж «Подтвердить»)
```

Примеры: 10 активных → нужно 2 блока / 2 подтверждения; 100 → 5 / 10; 500 → 10 / 15 (потолки).

- Один актор — один голос на пару; повторный голос перезаписывает предыдущий (upsert).
- Статусы монотонны: подтверждённый ресурс не теряет бейдж при росте базы; заблокированный
  не возвращается сам — только админ или перепроверка в пайплайне.
- Пороги — конфиг `SOURCE_REVIEW_THRESHOLDS` (без релиза): доли 5%/10%, минимумы 2/2,
  потолки 10/15.
- Админ (`ADMIN_EMAILS`, `requireAdmin`) может заблокировать/разблокировать ресурс одним действием.

Эффекты:

- **Сейчас**: SSR-страница профессии подмешивает актуальные статусы из БД к статическому контенту;
  скрытые ресурсы не рендерятся; бейджи считаются на сервере.
- **Пайплайн**: `npm run reviews:export` выгружает решения; `materials:accept --reviews <file>`
  не принимает заблокированные материалы; `release:build` читает `data/reviews/source-reviews.json`
  и не публикует заблокированные источники/материалы (`source_blocked`, не блокирующий gap).
- **Админка**: `/admin/reviews` — очередь спорных, принудительный блок и снятие админ-блока
  (`/api/admin/source-reviews`).
- **Аналитика**: события `source_review_open`, `source_review_submit` (`action`, `reason`).

### 7.5. Метки доступа

Функция `accessLabel` в `apps/web/src/lib/content.ts` уже есть; меняем тексты и добавляем подсказки
(`accessHint`, выводится как `title`/тултип чипа):

| `access` | Чип | Подсказка |
|---|---|---|
| `free` | «Бесплатно» | «Доступно без оплаты» |
| `freemium` | «Часть бесплатно» | «Часть материалов открыта, остальное — по подписке или платно» |
| `mixed` | «Бесплатное и платное» | «В источнике есть и бесплатные, и платные материалы» |
| `paid` | «Платно» | «Полный доступ платный; карточка показывает, что открыто» |
| `unknown` | «Доступ не проверен» | «Не удалось проверить доступ — помоги уточнить» |

Продукт по решению 2026-11-03 показывает **все** доступы по умолчанию: фильтра «только бесплатное»
пока нет, чтобы не терять полезные материалы. В отчёте `learning:aggregate` правило не меняется:
«открытые» = `free`/`freemium`.
`mixed` и `paid` живут в продукте с меткой; предлагается выводить их в отчёте отдельной
строкой «с ограничениями», чтобы цифры не смешивались.

### 7.6. Агент-методолог: состояние и изменения

Проверка 2026-11-03:

| Что | Где | Состояние |
|---|---|---|
| Роль и правила | `agents/AGENTS-competency-methodologist.md` | есть; Pass D (материалы) описан |
| Pass D в коде | `competency/materials/classify.ts`, `llm/prompts.ts` (`buildMaterialPrompt`) | работает |
| Отдельный CLI кандидатов | `npm run methodologist:patch` (`src/methodology/v1/methodologist/`) | работает, но это решения о компетенциях, не о материалах |
| Прогоны | `data/materials-agent/it-*-queue.json` (11 профессий, 11:21–11:25), кэш LLM 11:25 | собирал материалы |
| Приёмка | `materials-agent/accept.ts` порог 0.7, `materials:accept` | механическая, 39 материалов |
| Тесты | `tests/methodologist.test.ts`, `tests/materials*.test.ts` | 24/24 проходят; `typecheck` чист |

Чего нет и что добавляем:

- Pass E (вердикт, уверенность, польза, причина) — §7.2;
- правило №7 файла роли уточнено 2026-11-03: «оценка полезности материала разрешена в Pass E;
  оценка уровня и важности компетенций — по-прежнему человек» (Pass E добавлен в файл роли);
- аудит решений: `review` в каталоге + журнал `data/materials-agent/<profession>-review.json`;
- перепроверка уже принятых материалов (сейчас `materials:accept` дедупит по URL и больше их не трогает).

## 8. Нефункциональные требования

- **Приватность**: не хранить email и сырой IP; актор — `userId`; комментарий ≤500 символов;
  удаление аккаунта удаляет его голоса (`onDelete: Cascade`).
- **Анти-спам**: голосовать может только залогиненный; `sameOrigin`, rate limit на аккаунт
  (≤30 действий/час), honeypot-поле как в `/api/feedback`, zod-валидация, лимит длины.
- **Доступность**: бейдж — кнопка с `aria-label` и подсказкой по фокусу; модалка — focus-trap,
  Escape, возврат фокуса; статус не передаётся только цветом.
- **Производительность**: статусы грузятся одним запросом на страницу профессии (индекс по
  `sourceId, competencyId`); статический контент не пересобирается на лету.
- **Наблюдаемость**: события аналитики + отчёт покрытия + админ-очередь спорных.
- **Ограничения линейки**: `release:build` и `release:validate` должны продолжать проходить;
  новые поля контента — опциональные, чтобы старый JSON не ломался.

## 9. Edge cases

- Ресурс на нескольких компетенциях: голос скоупится компетенцией; глобальный сигнал — только
  «недостоверный»/«ссылка не работает».
- 1 подтверждение + 1 блокировка → «спорный», не скрыт.
- LLM приняла, пользователи заблокировали → блокировка сильнее, ресурс скрыт и уходит на пересмотр.
- Админ разблокировал → ресурс возвращается, статус `confirmed` до новых сигналов.
- Прогон пайплайна идёт в момент голосования: экспорт решений берёт снапшот на дату, не ломает прогон.
- Пустой `snippet`: Pass E обязан ставить `confirm`, а не `accept`.
- Источник без `summary` не публикуется и не получает бейдж (его просто нет в выдаче).
- Ошибка сети при отправке голоса: состояние не меняется, показывается текст ошибки.
- Двойной клик/повторная отправка: идемпотентно (upsert), кнопка блокируется на время запроса.
- Гость пытается голосовать: редирект на вход, голос не создаётся, после входа возврат к материалу.
- Мало активных пользователей (например, 5): порог равен минимуму (2), один голос не решает.

## 10. Данные и схема

`prisma/schema.prisma` (+ перегенерация `schema.local.prisma` через `npm run db:local:prepare`,
миграция `20261103...._source_reviews`):

```prisma
enum SourceReviewAction { CONFIRM BLOCK }
enum SourceReviewReason { OFF_TOPIC UNRELIABLE BROKEN LOCKED OTHER }

model SourceReview {
  id           String              @id @default(cuid())
  sourceId     String
  competencyId String
  scope        String              @default("competency") // competency | source
  action       SourceReviewAction
  reason       SourceReviewReason?
  comment      String?
  userId       String
  user         User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  actorKey     String              // u:<id>, уникальность голоса
  pagePath     String
  createdAt    DateTime            @default(now())
  updatedAt    DateTime            @updatedAt

  @@unique([sourceId, competencyId, actorKey])
  @@index([sourceId, competencyId, action])
  @@index([createdAt])
}
```

Также: `User.sourceReviews SourceReview[]`.

Контент:

- `scripts/release/lib.ts` → `PublicSource` + `apps/web/src/lib/content-types.ts` (`ContentSource`):
  `confidence?: number`, `reviewStatus?: "auto_accepted" | "needs_confirmation" | "confirmed" | "disputed" | "blocked"`,
  `whyUseful?: string`, `relevance?: number`.
- `competency/types.ts` (`Material`): `review?: { verdict, confidence, usefulness, whyUseful, reason,
  flags, reviewedAt, reviewer: "methodologist-v1" }`.
- `catalog.materials`: статусы `accepted | needs_confirmation | rejected` вместо бинарного `accepted`.

Пайплайн:

- `data/materials-agent/coverage-state.json` — попытки и лимиты (gitignored);
- `data/materials-agent/<profession>-review.json` — журнал вердиктов;
- `data/reviews/source-reviews.json` — экспорт пользовательских решений для приёмки.

## 11. Реализация: минимум изменений

Состояние на 2026-11-03: **этапы 1–4 реализованы**. Готово: метки доступа, бейдж, модалка,
БД `SourceReview`, API, SSR-мерж, аналитика, Pass E `materials:verify`, приёмка по вердикту,
`materials:coverage` с лимитами, `reviews:export`, админка `/admin/reviews`, фильтрация
заблокированного в `materials:accept` и `release:build`. Перепроверка по событиям
(`materials:recheck`) остаётся следующим шагом — см. §12.

Этап 1 — метки и бейдж без БД (0,5 дня):

- `apps/web/src/lib/content.ts`: `accessLabel`/`accessHint`, `reviewStatusLabel`;
- `scripts/release/lib.ts`, `content-types.ts`: новые поля;
- `MaterialCard.tsx`: бейдж в углу, подсказка;
- CSS: `.material-confirm`, позиционирование в `.material-card`.

Этап 2 — подтверждение в интерфейсе (1,5 дня):

- Prisma-модель + миграция;
- `apps/web/src/lib/source-review.ts` — агрегация статусов;
- `apps/web/src/app/api/source-reviews/route.ts` — POST (валидация, rate limit, upsert);
- `apps/web/src/app/professions/[slug]/page.tsx` — SSR-мерж статусов, прокидывание в `CanvasProfession`;
- `apps/web/src/components/source-review/SourceReviewDialog.tsx` (+ trigger) — на стилях `FeedbackDialog`;
- `validation.ts` — схема; `EVENT_NAMES` — два события; аналитика в `trackClient`.

Этап 3 — Pass E и лимиты (2 дня):

- `materials-agent/limits.ts`, `materials-agent/review.ts`, `cli/review.ts` (`materials:verify`),
  `cli/coverage.ts` (`materials:coverage`);
- схема и промпт в `competency/llm/schemas.ts` и `llm/prompts.ts`;
- `materials-agent/accept.ts` — приёмка по вердикту;
- `materials-agent/export-reviews.ts` — `reviews:export`;
- тесты: вердикты, пороги, состояние попыток, дедуп, повторный голос.

Этап 4 — админка и перепроверка (1 день):

- `apps/web/src/app/admin/reviews/page.tsx` + `api/admin/source-reviews/route.ts` по образцу
  `/admin/feedback`;
- `materials:recheck` — перепроверка ресурсов по событиям;
- обновить README и `COS-RES-028`/`COS-RES-022` по факту.

Фактические файлы этапов 1–2:

- `apps/web/src/lib/source-review.ts` — пороги и статусы (чистые функции);
- `apps/web/src/lib/source-review-server.ts` — активная база и сбор статусов;
- `apps/web/src/app/api/source-reviews/route.ts` — голос (только залогиненные);
- `apps/web/src/components/source-review/SourceReviewBadge.tsx` — бейдж и модалка;
- `apps/web/src/components/canvas/MaterialCard.tsx`, `CompetencyDetail.tsx`,
  `apps/web/src/app/professions/[slug]/page.tsx` — показ;
- `apps/web/src/lib/content.ts` — метки доступа и подсказки;
- `apps/web/src/lib/validation.ts` — схема и события `source_review_open/submit`;
- `prisma/schema.prisma` + миграция `20261103120000_source_reviews`;
- `apps/web/src/app/globals.css` — стили бейджа;
- `tests/source-review.test.ts` — пороги, статусы, тексты.

Фактические файлы этапа 3:

- `src/methodology/v1/materials-agent/limits.ts` — лимиты 2–5, раунды, cooldown, `acceptanceOf`;
- `src/methodology/v1/materials-agent/verdict.ts` — Pass E: вердикт, уверенность, `whyUseful`, флаги;
- `src/methodology/v1/competency/llm/schemas.ts`, `llm/prompts.ts` — схема и промпт ревью;
- `src/methodology/v1/materials-agent/accept.ts` — приёмка по вердикту (accept/confirm/reject);
- `src/methodology/v1/materials-agent/coverage.ts` + `cli/coverage.ts` — отчёт «компетенция × формат»;
- `src/methodology/v1/materials-agent/cli/verify.ts` — команда `materials:verify`;
- `src/methodology/v1/materials-agent/cli/accept.ts` — `--reviews` для фильтра блокировок;
- `scripts/reviews/export.ts` — `reviews:export` (агрегаты голосов для пайплайна);
- `scripts/release/lib.ts` — `confidence`, `relevance`, `whyUseful`, `reviewStatus` в публичном контенте;
- `tests/material-review.test.ts`, `tests/coverage.test.ts`, `tests/release.test.ts` (блокировка);
- `apps/web/src/app/admin/reviews/page.tsx`, `apps/web/src/components/admin/AdminReviewActions.tsx`,
  `apps/web/src/app/api/admin/source-reviews/route.ts`.

Команды:

```bash
npm run materials:verify  -- --domain it --profession motion --journal data/materials-agent/it-motion-queue.json
npm run materials:accept  -- --journal data/materials-agent/it-motion-verified.json --min-relevance 0.7 --write
npm run materials:coverage -- --profession motion --report
npm run materials:coverage -- --profession motion --mark-attempt   # отметить раунд поиска
npm run reviews:export
npm run materials:accept -- --reviews data/reviews/source-reviews.json --journal data/materials-agent/it-motion-verified.json --write
```

Админка: `/admin/reviews` (очередь блокировок, принудительный блок/снятие).

## 12. Out of scope

- персональные рекомендации и уровни (следующий слой ADE);
- комментарии и обсуждения под материалами;
- рейтинг «звёздами», лайки, карма автора;
- блокировка целых доменов и юридическая проверка лицензий;
- автоматическая перепроверка ссылок по расписанию (отдельная задача `learning:audit`);
- фильтры «только бесплатное» в интерфейсе (следующий шаг после меток);
- локализация интерфейса на английский.

## 13. Открытые вопросы

Решено 2026-11-03: голосуют только залогиненные; порог — доля от активных залогиненных (формула §7.4);
показываем все доступы с метками; правило №7 методолога уточнено. Остались параметры:

1. Доли и потолки формулы: сейчас `BLOCK` 5% (min 2, max 10), `CONFIRM` 10% (min 2, max 15).
   `[ASSUMPTION]` — стартовые значения; проверяются на первых данных.
2. Окно «активных пользователей»: 30 дней по событиям аналитики. `[ASSUMPTION]` — если событий мало,
   знаменатель равен 1 и работают минимумы.
3. Снимать ли бейдж сразу после собственного подтверждения (локально), пока глобальный порог
   не достигнут? `[ASSUMPTION]` — да, с пометкой «твой голос учтён».
4. Нужен ли отдельный статус «спорный» для гостя и неавторизованного, или достаточно «Подтвердить»
   с подсказкой? `[ASSUMPTION]` — достаточно одного бейджа, «Спорный» — если будет запрос.

## 14. Ссылки

- [`COS-RES-028`](../09-research/COS-RES-028-Open-Materials-Discovery-and-Relevance.md) — анализ пробелов и приоритеты;
- `COS-RES-017` — контракт Material Agent;
- `COS-RES-022` — реестр учебных источников;
- `COS-RES-027` — отчёт открытых источников;
- `COS-REL-002` — Content QA;
- `COS-REL-004` — аналитика и обратная связь;
- `COS-REL-008` — decision log (ADR-014);
- `COS-COM-010` — голос продукта;
- код: `src/methodology/v1/materials-agent/`, `src/methodology/v1/competency/materials/`,
  `scripts/release/lib.ts`, `apps/web/src/components/canvas/MaterialCard.tsx`,
  `apps/web/src/components/feedback/`.

## 15. История

| Версия | Дата | Что изменилось |
|---|---|---|
| 1.0.0 | 2026-11-03 | Первая версия: лимиты 2–5 на формат, Pass E, бейдж/модалка, аппрув, метки доступа |
| 1.1.0 | 2026-11-03 | Решения: голосуют залогиненные, порог — доля от активных залогиненных (5%/10% с min/max), показываем все доступы, правило №7 методолога уточнено и Pass E добавлен в файл роли |
| 1.2.0 | 2026-11-03 | Реализованы этапы 1–2: метки доступа, бейдж «Подтвердить», модалка, модель `SourceReview`, API, SSR-мерж, тесты логики; web build и 175 тестов проходят |
| 1.3.0 | 2026-11-03 | Реализован этап 3: Pass E (`materials:verify`), приёмка по вердикту, лимиты и отчёт `materials:coverage`, `reviews:export`, поля `confidence`/`reviewStatus` в контенте; 190 тестов |
| 1.4.0 | 2026-11-03 | Реализован этап 4: админка `/admin/reviews` с блокировкой/снятием, фильтрация заблокированного в `materials:accept` и `release:build`; 191 тест |
