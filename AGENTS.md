# AGENTS.md — Competency Operating System (AXIONA COS)

## Что это за проект

AI-native платформа компетенций: карта профессий, компетенции, знания, навыки и материалы.
Текущий этап — Beta 1 (карта профессий дизайнера). Диагностика, оценка уровня и ИИ в runtime — отложенный слой.
Стек: Next.js (`apps/web`), методология в `src/methodology/v1`, Prisma, контент в `model/` → JSON.

## Навыки агента

Подключены из `~/Documents/dsh-skills` (симлинки в `.dsh/skills`):

| Команда | Роль |
|---|---|
| `/ba-analyze`, `/ba-spec`, `/ba-docs-review` | бизнес-аналитик: анализ, спеки, аудит документации |
| `/ux-copy`, `/ux-copy-review`, `/ux-voice`, `/ux-strings` | UX-писатель: тексты, ревью, голос, инвентаризация строк |

- Полная шпаргалка проекта (навыки + npm-скрипты): `.dsh/SKILLS.md`.
- Реестр всех ролей и навыков: `~/Documents/dsh-skills/INDEX.md`.
- Перед импровизацией проверь, есть ли подходящий навык, и используй его.

## Голос продукта

`docs/06-communication/COS-COM-010-Voice-and-Tone.md` — обращение на «ты», дружеский наставник-навигатор,
мотивация через аргументацию без давления. При расхождении с `COS-COM-008/009` (там «вы») действует COS-COM-010.

## Документация

- Источник правды — `docs/` с нумерованными разделами `00-foundation` … `12-release`.
- Имена файлов: `COS-<AREA>-<NNN>-<Title>.md`. Не создавай новые разделы и префиксы без нужды.
- Термины: `docs/00-foundation/05-domain-glossary.md`. Решения, меняющие рамку: `docs/12-release/COS-REL-008-Decision-Log.md`.
- Роли проекта описаны в `agents/AGENTS-*.md` — читай их перед работой в соответствующей области.

## Проверка перед «готово»

```sh
npm run typecheck
npm run test
```

Контентный gate перед релизом: `npm run release:report -- --release beta-1`, затем `release:validate` и `release:build`.
