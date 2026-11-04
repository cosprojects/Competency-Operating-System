# AXIONA task manager

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
2. Положи токен в окружение, не в репозиторий:

```bash
export GH_TOKEN=github_pat_...
```

Или в macOS Keychain и экспортируй перед запуском.

3. В GitHub Project `AXIONA Launch` включи встроенный workflow **Auto-add to project**:
   - filter: `is:issue is:open label:task`
   - при добавлении ставь Status = `Backlog`.
4. Включи/проверь:
   - **Pull request linked to issue** → Status = `In Progress`;
   - **Pull request merged** и **Item closed** → Status = `Done`;
   - **Auto-add sub-issues to project** — уже включён.

## Команды

```bash
npm run tasks:list
npm run tasks:add -- \
  --title "Проверить content gate" \
  --description "Сделать spot-check 54 компетенций и 29 источников." \
  --priority P0 --area Content --stage I \
  --acceptance "Проверены 4 страницы профессий" \
  --acceptance "Проверены 3 новых источника"

npm run tasks:sync -- --dry-run   # показать, что будет создано
npm run tasks:sync                # создать/найти issues
npm run tasks:sync -- --update    # обновить title/body/labels существующих issues
```

`tasks:sync`:
- создаёт issue с маркером `<!-- axiona-task:T-001 -->`;
- сохраняет `issueNumber`/`issueUrl` в `tasks/tasks.json`;
- создаёт labels `task`, `priority:*`, `area:*`, `stage:*`;
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
  "title": "Проверить content gate",
  "description": "Сделать spot-check 54 компетенций и 29 источников.",
  "acceptance": ["Проверены 4 страницы профессий"],
  "priority": "P0",
  "area": "Content",
  "stage": "I",
  "status": "Backlog",
  "labels": []
}
```
