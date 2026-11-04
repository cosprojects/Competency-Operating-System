# AXIONA task manager

Версии, канбан-правила и Definition of Ready/Done — [`COS-REL-012`](../docs/12-release/COS-REL-012-Delivery-Plan-and-Versioning.md).

`tasks/tasks.json` — источник задач в git. GitHub Issues — рабочее представление, GitHub Project «AXIONA Launch» — доска.

```text
чат → tasks/tasks.json → npm run tasks:sync → Issues → Project
                                      ↑
                          GitHub Action на push (optional)
```

## Почему не «задачи из коммитов»

Коммит или push сам по себе не создаёт задачу: GitHub Projects умеет автоматически добавлять **issues и PR**, но не парсит произвольный текст коммита в задачу. Надёжнее держать задачи в `tasks/tasks.json`, а коммитом фиксировать изменение этого файла. Push может запускать sync через Action — тогда задача появится без ручного запуска.

## Настройка

1. Создай fine-grained personal access token:
   - Repository access: `cosprojects/Competency-Operating-System`;
   - Issues: Read and write;
   - Projects: Read and write (если позже понадобится ставить поля проекта);
   - Metadata: Read.
2. Положи токен в `tasks/.env.local` (файл в `.gitignore`) или в окружение:

```bash
# tasks/.env.local
GH_TOKEN=github_pat_...
GITHUB_PROJECT_NUMBER=1   # опционально, если нужен GraphQL-доступ к полям
```

Или:

```bash
export GH_TOKEN=github_pat_...
```

3. В GitHub Project `AXIONA Launch` включи встроенный workflow **Auto-add to project**:
   - filter: `is:issue is:open label:task`
   - при добавлении ставь Status = `Backlog`.
4. Включи/проверь:
   - **Pull request linked to issue** → Status = `In Progress`;
   - **Pull request merged** и **Item closed** → Status = `Done`;
   - **Auto-add sub-issues to project** — уже включён.

## Команды

```bash
npm run tasks:doctor               # проверить токен и доступ к repo
npm run tasks:list
npm run tasks:add -- \
  --title "Проверить content gate" \
  --description "Сделать spot-check 54 компетенций и 29 источников." \
  --version v0.1.0 --priority P0 --area Content --stage I \
  --acceptance "Проверены 4 страницы профессий" \
  --acceptance "Проверены 3 новых источника"

npm run tasks:sync -- --dry-run              # показать, что будет создано
npm run tasks:sync -- --version v0.2.0       # только задачи версии
npm run tasks:sync                           # все задачи
npm run tasks:sync -- --update                # обновить существующие issues
```

`tasks:sync`:
- создаёт issue с маркером `<!-- axiona-task:T-001 -->`;
- создаёт milestone версии `vX.Y.Z` с целью из `versions`;
- сохраняет `issueNumber`/`issueUrl` в `tasks/tasks.json`;
- создаёт labels `task`, `release:*`, `priority:*`, `area:*`, `stage:*`;
- не перезаписывает issue без `--update`.

После sync закоммить `tasks/tasks.json` — это фиксирует связь задачи с issue.

## Чат

Попроси агента: «добавь задачу …». Агент:
1. добавляет запись в `tasks/tasks.json`;
2. запускает `npm run tasks:sync`;
3. коммитит `tasks/tasks.json` с issue-номером.

Если `GH_TOKEN` не задан, агент подготовит задачу в файле, а sync выполнишь ты.

## Коммиты и PR

- Ветка: `T-001-content-gate`.
- В PR: `Closes #<issue_number>`.
- Встроенные workflows переведут issue в `In Progress` / `Done`.
- Push, меняющий `tasks/tasks.json`, может запускать `.github/workflows/tasks-sync.yml`; для этого добавь repository secret `PROJECT_TOKEN` (тот же PAT). Без секрета шаг пропускается.

## Схема задачи

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
  "status": "Backlog",
  "labels": [],
  "issueNumber": 123
}
```

## Troubleshooting

- **`Нужен GH_TOKEN`** — проверь, что файл лежит именно в `tasks/.env.local`, а не в `.env.example`, корне `.env.local` или `apps/web/.env.local`. CLI читает только `tasks/.env.local` и env процесса.
- **`tasks:doctor` показывает `user`, но Project API возвращает `FORBIDDEN`** — fine-grained-токену не дали доступ к Projects (для user-owned Projects его может не быть). Это не мешает создавать issues; для синхронизации полей/добавления существующих issues нужен classic PAT со scope `project`.
- **Issues созданы, но Project пустой** — встроенный workflow Auto-add срабатывает на новые items. Существующие issues добавь через Project → Add item (фильтр `label:task`) или classic PAT-скриптом.
- **Токен случайно попал в `.env.example`** — перенеси в `tasks/.env.local`, верни пример к пустому виду и не коммить секрет. Если токен уже был в коммите — отзови и создай новый.
