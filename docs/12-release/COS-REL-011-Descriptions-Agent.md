---
id: COS-REL-011
title: Субагент описаний профессий, компетенций, знаний и навыков
version: 1.0.0
status: Draft
owner: Release Team
last_updated: 2026-11-03
references:
  - COS-RES-029
  - COS-REL-009
---

# COS-REL-011 — субагент описаний

## Зачем

Описания в карточках профессий, компетенций, знаний и навыков должны объяснять смысл, а не повторять
название. До этого документа:

- у всех профессий было одно шаблонное описание в release-сборке;
- 93 тега начинались с `Понимание:`/`Умение:` и дублировали название;
- 281 тег был короче 40 символов.

## Контракт

Субагент `agents/AGENTS-description-writer.md` + CLI `descriptions:agent`:

- собирает контекст из view, canonical/extra, catalog, learning sources;
- вызывает LLM по одной профессии и по одной компетенции (все её блоки/теги);
- валидирует результат детерминированно (`descriptions/validate.ts`);
- пишет только валидные описания в источники правды;
- возвращает отчёт `data/descriptions/<date>-<scope>.json`.

Валидатор:

| Тип | Длина | Запрещено |
|---|---:|---|
| профессия | 90–320 | boilerplate «структура компетенций», дубль названия |
| компетенция | 80–400 | равно названию, не по-русски |
| знание | 60–260 | префикс «Понимание:», повтор названия |
| навык | 60–260 | префикс «Умение:», повтор названия |

Дополнительно: одна строка, завершающая точка, кириллица > 50%, уникальность внутри блока
и между профессиями.

## Где хранятся описания

- профессия → `model/professions/views/<slug>.json: description`;
- компетенция → `canonical/uxui.json` или `model/competencies-extra.json`;
- знание/навык → `catalog/it.json`, `tag.definition`.

Generated `model/competencies.json` не редактируется: после записи — `npm run model:sync`.

## Команды

```bash
npm run descriptions:agent -- --profession aidesigner            # dry-run
npm run descriptions:agent -- --profession aidesigner --write    # применить
npm run descriptions:agent -- --profession all --write           # все профессии
npm run descriptions:validate                                   # без LLM
```

Флаги: `--all`/`--force` — перегенерировать валидные, `--limit`, `--budget-usd`, `--max-calls`,
`--fixture` (тесты без сети), `--date`.

## Интеграция

`npm run aggregate --write` выполняет стадию описаний после `model:sync`; отключается
`--no-descriptions`. Для новой профессии/компетенции/тега описание обязательно: `descriptions:validate`
должен проходить до `release:validate`.
