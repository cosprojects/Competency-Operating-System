---
id: COS-REL-012
title: План реализации, версионность и канбан
version: 1.0.0
status: Draft
owner: Product Team
last_updated: 2026-10-28
references:
  - COS-BP-005
  - COS-REL-000
  - COS-REL-001
  - COS-REL-008
  - COS-REL-007
---

# COS-REL-012 — План реализации, версионность и канбан

## 1. Назначение

Документ связывает стратегическую дорожную карту `COS-BP-005` с исполнением: версиями продукта, бэклогом, канбан-статусами и автоматизацией GitHub Issues/Projects.

Источники правды:

- стратегия — `COS-BP-005`;
- текущий release gate — `COS-REL-001`/`COS-REL-002`;
- задачи — [`tasks/tasks.json`](../../tasks/tasks.json);
- исполнение — GitHub Issues и Project «AXIONA Launch»;
- решения, меняющие рамку, — `COS-REL-008`.

## 2. Принципы

1. **Без фиксированных календарных сроков.** Версия выпускается по критериям готовности, а не по дате.
2. **Одна задача — один проверяемый результат.** Задача без acceptance criteria не попадает в `Ready`.
3. **Git — спецификация, GitHub — исполнение.** `tasks/tasks.json` хранит задачу и её issue-номер; Project показывает живой статус.
4. **Версия — не этап roadmap, а проверяемый инкремент.** Один этап может содержать несколько версий; версия может закрывать часть этапа.
5. **Канбан не врёт.** Если задача в `Review`/`Done`, у неё есть ссылка на issue/PR и проверенный результат.
6. **Автоматизация не отменяет ревью.** AI может подготовить задачу, контент или код; человек подтверждает переход в `Done`.

## 3. Версионность

Формат: `vMAJOR.MINOR.PATCH`.

- `MAJOR` — несовместимое изменение продуктовой модели или публичного контракта (например, v1.0.0 — коммерческая экосистема).
- `MINOR` — новая проверяемая возможность или этап (Digital Profile, маршруты, оценка).
- `PATCH` — исправления, качество контента, безопасность, инфраструктура без нового сценария.

| Версия | Этап | Цель | Выход версии |
|---|---|---|---|
| `v0.1.0` | I | Beta 1 foundation | Демо-карта 4 профессий, 54 компетенции, аккаунт, сохранения, отзывы, аналитика |
| `v0.2.0` | I | Public Beta readiness | Публичная Beta: РФ-хостинг, PostgreSQL, legal, домен, QA, первые 15–25 участников |
| `v0.3.0` | II / IV | Beta learning & quality | Отчёт Beta, исправление контента, личное пространство v2 |
| `v0.4.0` | III | Source automation | Описанный процесс источников, discovery/relevance, health-check |
| `v0.5.0` | V / VI | Expansion & commercial validation | Новые профессии, интервью, партнёрские предложения, гипотезы монетизации |
| `v0.6.0` | VII | Digital Competency Profile | Профиль, evidence, подтверждение, API/UI |
| `v0.7.0` | VIII | Personal development routes | Цели, gap analysis, маршрут, объяснимые рекомендации |
| `v0.8.0` | IX | Competency assessment | Критерии, практические задания, проверка, интеграция в профиль |
| `v0.9.0` | X | Organization space | Роли/команды, gap-анализ, организационный пилот |
| `v1.0.0` | XI / XII | Commercial ecosystem | Монетизация, партнёры, интеграции, устойчивая модель |

Правила:

- Версия не объявляется «готовой», пока не выполнены acceptance criteria всех её P0-задач.
- P1/P2 могут переноситься в следующую версию, P0 — нет.
- Новая версия начинается с плана, а не с кода: сначала `tasks/tasks.json`, затем issues, затем реализация.
- Патч-версия (`v0.2.1`) допускается для исправлений без нового сценария; она не заменяет продуктовую версию.

## 4. Канбан

| Статус | Значение | Условие входа | Условие выхода |
|---|---|---|---|
| `Backlog` | Идея/задача известна, но не готова | Есть title, description, version | Появились acceptance criteria и зависимости |
| `Ready` | Можно брать в работу | Все acceptance criteria, area, priority, version | Назначен исполнитель/начата работа |
| `In Progress` | Работа начата | Есть issue, назначен owner | Есть PR/результат, тесты/проверки |
| `Review` | Результат проверяется | PR/артефакт готов, acceptance закрыт | Проверка пройдена или возврат |
| `Done` | Результат принят | Acceptance, проверки, документация | Задача закрыта в issue |

Дополнительно в Project можно включить `Blocked`, но в манифесте пока используются пять статусов, чтобы не плодить состояния без автоматики.

Правила:

- `Backlog` не обязан иметь issue; `Ready` и далее — обязан.
- `In Progress` без issue — ошибка процесса.
- `Done` без acceptance — ошибка процесса.
- Один PR может закрывать несколько задач, если это указано в описании.

## 5. Структура задачи

```json
{
  "id": "T-001",
  "version": "v0.1.0",
  "title": "Проверить content gate",
  "description": "Сделать spot-check 54 компетенций и 29 источников.",
  "acceptance": ["Проверены 4 страницы профессий"],
  "priority": "P0",
  "area": "Content",
  "stage": "I",
  "status": "Ready",
  "labels": [],
  "issueNumber": 123,
  "issueUrl": "https://github.com/.../issues/123"
}
```

Поля:

- `version` — версия из `tasks/tasks.json.versions`;
- `stage` — этап roadmap (`I`…`XII`);
- `area` — Content, Web, Infra, Design, Research, Legal, QA, Analytics, Product, Docs, Architecture, Business, Release;
- `priority` — P0…P3;
- `status` — канбан-статус;
- `acceptance` — проверяемые пункты, не «сделать хорошо».

## 6. Definition of Ready

Задача готова к работе, если:

1. Понятен результат и пользователь/система, для кого он.
2. Есть 1–5 acceptance criteria, проверяемых без вкусовщины.
3. Указаны версия, этап, область, приоритет.
4. Понятны зависимости от других задач.
5. Если задача контентная — указан источник/метод проверки.
6. Если задача инфраструктурная — указан критерий отката/проверки.

## 7. Definition of Done

1. Все acceptance criteria выполнены.
2. `npm run typecheck` и `npm run test` зелёные (для кода).
3. Для контента — `release:validate` PASS.
4. Для релиза — `release:build` и release notes.
5. Документация/decision log обновлены, если изменилась рамка.
6. Issue закрыт, Project status = `Done`.

## 8. Бэклог

Стартовый бэклог — 40 задач в `tasks/tasks.json`. После апрува 2026-10-28 активны только v0.1.0 и v0.2.0 (15 задач); 25 задач дальних версий помечены `deferred` и закрыты до планирования версии. Детализация и решения — `COS-REL-013`.

| Версия | Задач | P0 | Что входит |
|---|---:|---:|---|
| v0.1.0 | 5 | 1 | spot-check, дизайн (один epic), Vercel demo, docs, профиль |
| v0.2.0 | 10 | 7 | legal, РФ-хостинг, домен/email, deploy, QA, аналитика, отзывы, приглашения, access+audit, релиз |
| v0.3.0 (deferred) | 4 | 1 | отчёт Beta, контент, личное пространство, дизайн-система |
| v0.4.0 (deferred) | 3 | 0 | процесс источников, discovery/relevance, health-check |
| v0.5.0 (deferred) | 4 | 0 | новые профессии, коммерческие гипотезы, партнёры |
| v0.6.0 (deferred) | 3 | 0 | Digital Profile, evidence, API/UI |
| v0.7.0 (deferred) | 3 | 0 | цели, gap analysis, объяснимые рекомендации |
| v0.8.0 (deferred) | 3 | 0 | критерии, практические задания, интеграция оценки |
| v0.9.0 (deferred) | 3 | 0 | орг-пространство, роли, пилот |
| v1.0.0 (deferred) | 2 | 0 | монетизация, экосистема |

Текущее состояние:

- `T-001` — Ready, P0: human spot-check content gate.
- `T-002` — In Progress, P1: дизайн и интерфейс по макетам.
- `T-003` — Review, P1: проверка Vercel demo.
- `T-004` — Done: roadmap и release-документация синхронизированы.

## 9. Автоматизация

### 9.1. Локально

```bash
npm run tasks:list
npm run tasks:add -- \
  --title "..." --description "..." \
  --version v0.2.0 --priority P0 --area Infra --stage I \
  --acceptance "..."

npm run tasks:sync -- --dry-run
npm run tasks:sync -- --version v0.2.0
npm run tasks:sync -- --update
```

`tasks:sync`:

- создаёт/находит issues по маркеру `<!-- axiona-task:T-001 -->`;
- создаёт labels `task`, `release:v0.2.0`, `priority:p0`, `area:infra`, `stage:i`;
- создаёт milestone версии `v0.2.0` с описанием цели;
- сохраняет `issueNumber` и `issueUrl` в манифест.

Токен: `GH_TOKEN`/`GITHUB_TOKEN` или `tasks/.env.local` (gitignored). Нужны права Issues read/write; Projects read/write — если включаем синхронизацию полей.

### 9.2. GitHub Project

Включить в Project «AXIONA Launch»:

1. **Auto-add to project**: filter `is:issue is:open label:task`.
2. **Item added to project** → Status = `Backlog`.
3. **Pull request linked to issue** → Status = `In Progress`.
4. **Pull request merged** и **Item closed** → Status = `Done`.
5. Поля Project: `Status`, `Priority`, `Area`, `Stage`, `Release` — созданы и заполняются `scripts/tasks/project.ts` для активных задач.
6. `Status` в Project: `Backlog`, `Ready`, `In progress`, `In review`, `Done`; маппинг из статусов манифеста выполняется скриптом.

### 9.3. Push / коммит

`.github/workflows/tasks-sync.yml` запускается при изменении `tasks/tasks.json`:

- если добавлен secret `PROJECT_TOKEN`, создаёт issues/milestones и коммитит issue-номера обратно;
- без секрета — пропускает sync и ничего не ломает.

Коммит сам по себе задачу не создаёт. Коммит меняет `tasks.json`; Action/`tasks:sync` превращает изменение в issues. PR с `Closes #123` двигает задачу по канбану через встроенные workflows.

### 9.4. Чат

Пользователь: «добавь задачу …». Агент:

1. добавляет запись в `tasks/tasks.json`;
2. запускает `npm run tasks:sync -- --version <version>`;
3. коммитит манифест с issue-номером.

Если токена нет, агент готовит задачу, а sync выполняет пользователь.

## 10. Процесс релиза версии

1. Все P0 задачи версии — `Done`.
2. `release:validate` PASS; `release:build` собран.
3. Обновлены `COS-BP-005`/release docs и release notes.
4. Создан git tag `vX.Y.Z`.
5. В GitHub создан milestone/release; issues закрыты.
6. Project status всех задач версии — `Done`.
7. Следующая версия начинается с `tasks:add` и review бэклога.

## 11. Что автоматизировано сейчас

- локальный манифест задач и версии;
- создание issues, labels, milestones;
- сохранение issue-номеров в git;
- push-action для sync;
- встроенные Project workflows для auto-add/status;
- PR/issue связь через `Closes #`.

## 12. Что осталось настроить

- `GH_TOKEN`/`PROJECT_TOKEN` и реальный `tasks:sync`;
- Project fields и GraphQL-синхронизация Status/Priority/Area/Stage/Release;
- правило автообновления манифеста из Project (pull) — чтобы `tasks.json` не расходился с канбаном;
- решение, какие задачи входят в первую публичную Beta (v0.2.0) и какие можно перенести.

## 13. Риски

| Риск | Смягчение |
|---|---|
| Задачи расходятся с Project | Issue-номер в манифесте; sync по маркеру; периодический `tasks:sync --update` |
| AI создаёт слишком общие задачи | Definition of Ready; acceptance criteria; ревью перед Ready |
| Токен утекает | Только `tasks/.env.local`/secret; не коммитить; fine-grained PAT |
| Слишком большой бэклог | P0/P1 фокус на v0.2.0; остальное Backlog |
| Версия превращается в календарь | Exit criteria, а не дата |
| Project fields заполняются вручную | Следующий шаг — GraphQL field sync |
