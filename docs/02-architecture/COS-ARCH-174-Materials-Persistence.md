---
id: COS-ARCH-174
title: Materials Persistence
version: 1.0.0
status: Draft
owner: Engineering
last_updated: 2026-11-04
references:
  - COS-ARCH-170
  - COS-ARCH-171
  - COS-ARCH-172
  - COS-REL-008
---

# COS-ARCH-174 — состояние материалов и решений в БД

## 0. Зачем

До этого шага привязки жили в `data/workflow/attached-materials.json`, а решения
приёмки — только в артефактах прогона. Это работало для одного оператора, но:
файл не переживает параллельные прогоны (гонка), нет истории решений для калибровки
порогов, нет запросов «что привязано к компетенции» без чтения всех артефактов.

## 1. Схема

| Таблица | Ключ | Зачем |
|---|---|---|
| `Material` | `id` + `@unique canonicalUrl` | один ресурс = одна строка, независимо от прогона |
| `MaterialLink` | `@unique (materialId, nodeId)` | связь материал↔компетенция без дублей на уровне БД |
| `ReviewDecision` | `runId + stepId` | журнал решений приёмки: исход, причина, версия политики, сигналы |

`Material.id` детерминирован: `material_<sha1(canonicalUrl)[:12]>`. Уникальность
`canonicalUrl` — последний рубеж: даже если логика дедупа ошибётся, БД не даст
создать второй материал по той же ссылке.

`ReviewDecision.signalsJson` хранит снимок сигналов (вердикт, уверенность,
релевантность, флаги, историю домена) — это датасет для shadow-калибровки порогов
и для аудита: видно, **почему** политика так решила.

## 2. Порты и адаптеры

```
MaterialsStore (порт)
  ├─ PrismaMaterialsStore  — прод (PostgreSQL), локально SQLite
  ├─ FileMaterialsStore    — локальные прогоны до включения БД, импорт старых данных
  └─ InMemoryMaterialsStore — тесты
```

Стадии `materials.attach` и `review.materials` работают только через порт:
одна логика, три хранилища, без ветвлений. Старый файловый реестр не удалён —
он стал адаптером.

## 3. Миграция и наполнение

Миграция: `prisma/migrations/20261104160000_materials_and_review` (генерируется
через `prisma migrate diff` из схемы до/после, без живой БД).

Перенос накопленного состояния:

```bash
npm run materials:import-ledger   # 25 материалов, 25 связей из файлового реестра
```

## 4. Проверено на локальной БД

```
приёмка it.motion: 26 решений → 24 опубликовано с бейджем, 2 скрыто
привязка:          linked 12, newMaterials 12, duplicates 24
повторный прогон:  newMaterials 0, duplicates ≥ 1  ← база не растёт

БД → Material 37 · MaterialLink 37 · ReviewDecision 26
исходы: AUTO_ACCEPT 2 · BADGE 8 · QUARANTINE 1 · QUEUE 13 · AUTO_REJECT 2
```

## 5. Что это даёт

- **Идемпотентность между прогонами** держится на уникальных ключах БД, а не на
  аккуратности файла.
- **Калибровка порогов**: `ReviewDecision` — готовый набор «политика против
  человека» для shadow-режима (COS-ARCH-171 §5).
- **Аудит**: по `runId` видно, какие материалы и с какими причинами прошли в релиз.
- **Запросы для продукта**: «материалы компетенции» — один join, а не разбор артефактов.

## 6. Ограничения и дальше

- Аудит-выборка в админке пока не реализована: `ReviewDecision` пишется, но
  `/admin/reviews` показывает только community-голоса (`SourceReview`). Следующий шаг —
  страница аудита на `ReviewDecision`.
- `Material` пока не связан с `SourceReview` (голоса сообщества) — нужен общий ключ.
- Каталог `catalog/it.json` остаётся источником публикуемого контента: БД — источник
  состояния прогонов, не публикации. Перенос публикации в БД — отдельное решение.

## 7. Как проверить

```bash
npm run db:local
npm run materials:import-ledger
npm run run:cli -- create --profession it.motion --release check-1
npm run run:cli -- advance <runId>
node -e "..."   # или: npm run review:shadow -- --profession it.motion
```

Код: `src/methodology/v1/materials/`, `prisma/schema.prisma`,
`scripts/materials/import-ledger.ts`.
