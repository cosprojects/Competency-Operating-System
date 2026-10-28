---
id: COS-REL-003
title: Архитектура продукта Beta 1
version: 1.0.0
status: Draft
owner: Engineering
last_updated: 2026-10-28
references:
  - COS-REL-000
  - COS-REL-001
  - COS-REL-004
  - COS-REL-005
  - COS-REL-008
  - COS-ARCH-160
---

# COS-REL-003 — Архитектура продукта Beta 1

## 1. Принципы

- **Тонкое приложение, сильный контент.** Продукт — viewer над проверенной моделью, а не новая платформа.
- **Один источник истины.** Контент остаётся в JSON-модели и каталоге; приложение читает производный JSON.
- **Пользовательские данные отдельно.** PostgreSQL хранит только аккаунт, избранное, статусы, отзывы, события и согласия.
- **Никаких runtime-LLM.** DeepSeek используется только в офлайн-пайплайне контента.
- **Контур данных.** Сейчас — локальная машина (SQLite) и Vercel только для demo; перед публичным запуском — приложение, PostgreSQL, бэкапы и email в РФ. Внешних auth/analytics-сервисов в runtime нет.

## 2. Стек

| Слой | Решение |
|---|---|
| Frontend/Backend | Next.js App Router, React, TypeScript, Tailwind |
| Контент | JSON из `model/` + `catalog/` + `learning-sources/`; сборка `scripts/release/build.ts` |
| БД | SQLite локально; PostgreSQL 16 + Prisma для публичного контура |
| Аутентификация | собственная, magic link по email |
| Email | локально — console; публично — РФ-провайдер через HTTP JSON API |
| Аналитика | first-party `AnalyticsEvent` |
| Хостинг | сейчас локально / Vercel preview; публично — РФ VM + Docker Compose |
| Бэкапы | локально — файл; публично — `pg_dump` в РФ Object Storage |
| CI | GitHub Actions: typecheck, unit/integration, release:validate, web build |

## 3. Структура репозитория

```text
apps/web/
  src/app/                    # маршруты Next.js
  src/components/             # UI
  src/lib/auth.ts             # magic link, сессии
  src/lib/db.ts               # Prisma client
  src/lib/analytics.ts        # события, allowlist
  src/lib/content.ts          # чтение сгенерированного JSON
  src/content/generated/      # beta-1.json, не коммитится
  tests/                      # unit/integration
release/
  beta-1.json
  beta-1-source-review.json
scripts/release/
  validate.ts
  build.ts
prisma/
  schema.prisma               # Beta (PostgreSQL)
  schema.local.prisma         # generated для локальной SQLite, gitignored
  assessment.schema.prisma    # будущая диагностика, не используется
docs/12-release/
```

`web/` остаётся каталогом сгенерированных HTML-канвасов; публичная Beta их не использует.

## 4. Data flow

```text
model/competencies.json
model/professions.json
model/profession-competencies/*.json
catalog/it.json
learning-sources/registry.json
        + release/beta-1.json
        + release/beta-1-source-review.json
                │
                ▼
        scripts/release/build.ts
                │
                ▼
apps/web/src/content/generated/beta-1.json
                │
                ▼
Next.js server components → HTML
```

Пользовательские действия:

```text
Браузер → Next.js → SQLite локально / PostgreSQL в РФ (публичный контур)
События → /api/events → SQLite локально / PostgreSQL в РФ
Magic link → console локально / РФ-провайдер → пользователь
```

## 5. Публичный контент

`beta-1.json` содержит:

- `releaseId`, `generatedAt`, `qualityBarVersion`;
- профессии: id, slug, title, titleEn, описание, покрытие;
- секции: id, title, описание;
- компетенции: id, title, definition, tier, order, prerequisites, знания, навыки, материалы;
- материалы: id, title, kind, access, language, authority, summary, url, lastChecked, rationale;
- счётчики и список исключённых компетенций с причинами.

Правила сборки:

- блоки берутся только `status: accepted`;
- теги только `evidenceState: supported`, `kind: knowledge|skill`;
- источники только `status: active`, `authority: primary`, не `discoveryOnly`, с `summary`;
- компетенция без 2 знаний/1 навыка/источника не попадает в публичный JSON;
- AI-слой и `it.aidesigner` исключены манифестом;
- prerequisites фильтруются вместе с исключёнными.

## 6. Схема БД

```prisma
enum FavoriteTarget { COMPETENCY SOURCE }
enum StudyStatusValue { NOT_STARTED LEARNING LEARNED }
enum FeedbackType {
  CONTENT_ERROR
  MISSING_COMPETENCY
  BAD_MATERIAL
  MISSING_FEATURE
  IMPROVEMENT
  GENERAL
}
enum FeedbackStatus { NEW TRIAGED RESOLVED }
enum ConsentKind { TERMS PRIVACY ANALYTICS MARKETING }

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  createdAt     DateTime @default(now())
  lastSeenAt    DateTime?
  deletedAt     DateTime?
  sessions      Session[]
  favorites     Favorite[]
  statuses      StudyStatus[]
  feedback      Feedback[]
  consents      ConsentRecord[]
}

model LoginToken {
  id             String    @id @default(cuid())
  email          String
  tokenHash      String    @unique
  returnTo       String?
  consentVersion String?
  expiresAt      DateTime
  usedAt         DateTime?
  createdAt      DateTime  @default(now())
  @@index([email, expiresAt])
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  lastSeenAt DateTime?
  @@index([userId])
}

model Favorite {
  id         String         @id @default(cuid())
  userId     String
  user       User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  targetType FavoriteTarget
  targetId   String
  createdAt  DateTime       @default(now())
  @@unique([userId, targetType, targetId])
  @@index([userId, createdAt])
}

model StudyStatus {
  id           String           @id @default(cuid())
  userId       String
  user         User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  competencyId String
  status       StudyStatusValue @default(NOT_STARTED)
  updatedAt    DateTime         @updatedAt
  @@unique([userId, competencyId])
}

model Feedback {
  id           String         @id @default(cuid())
  userId       String?
  user         User?          @relation(fields: [userId], references: [id], onDelete: SetNull)
  type         FeedbackType
  targetType   FavoriteTarget?
  targetId     String?
  rating       Int?
  comment      String?
  contactEmail String?
  pagePath     String
  status       FeedbackStatus @default(NEW)
  createdAt    DateTime       @default(now())
  resolvedAt   DateTime?
  @@index([status, createdAt])
  @@index([type, createdAt])
}

model AnalyticsEvent {
  id        String   @id @default(cuid())
  name      String
  anonId    String?
  userId    String?
  path      String?
  props     Json?
  createdAt DateTime @default(now())
  @@index([name, createdAt])
  @@index([anonId, createdAt])
}

model ConsentRecord {
  id        String      @id @default(cuid())
  userId    String
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  kind      ConsentKind
  version   String
  grantedAt DateTime    @default(now())
  revokedAt DateTime?
  @@unique([userId, kind, version])
  @@index([userId, kind, grantedAt])
}
```

`prisma/assessment.schema.prisma` сохраняет будущую диагностическую модель; Beta её не использует.

## 7. Маршруты

| Путь | Назначение | Доступ |
|---|---|---|
| `/` | Лендинг продукта, 4 профессии | Публичный |
| `/professions` | Список профессий | Публичный |
| `/professions/[slug]` | Карта профессии | Публичный |
| `/competencies/[id]` | Компетенция: знания, навыки, материалы | Публичный; внешние ссылки — после входа |
| `/saved` | Избранное | Пользователь |
| `/account` | Аккаунт, согласия, удаление | Пользователь |
| `/login`, `/login/check-email` | Вход | Публичный |
| `/auth/verify` | GET подтверждение, POST вход | Публичный |
| `/feedback` | Общий отзыв | Публичный |
| `/legal/privacy`, `/legal/terms`, `/legal/cookies` | Документы | Публичный |
| `/admin/feedback`, `/admin/metrics` | Админка | Админ |
| `POST /api/auth/request` | Запрос ссылки | Публичный, rate limit |
| `POST /api/auth/logout` | Выход | Пользователь |
| `POST/DELETE /api/favorites` | Избранное | Пользователь |
| `POST /api/study-status` | Статус | Пользователь |
| `POST /api/feedback` | Отзыв | Публичный/пользователь |
| `POST /api/events` | Событие | Публичный, allowlist |
| `GET /api/health` | Health | Публичный |
| `GET /admin/feedback/export` | Экспорт | Админ |

## 8. Аутентификация

- Токен: 32 случайных байта; в БД SHA-256 hash; TTL 15 минут; одноразовый.
- GET `/auth/verify?token=` показывает страницу с кнопкой; POST погашает токен и создаёт сессию.
- Ответ на `/api/auth/request` всегда одинаковый; не раскрываем наличие аккаунта.
- Rate limit: 5 запросов/час на email, 20/час на IP-хэш.
- Cookie: `__Host-axiona_session`, HttpOnly, Secure, SameSite=Lax, 30 дней.
- После входа — `returnTo`; открытый redirect запрещён, только внутренние пути.
- Logout удаляет сессию; удаление аккаунта — все пользовательские записи + анонимизация событий.

## 9. Безопасность

- Заголовки: CSP без inline-скриптов (кроме nonce), HSTS, X-Content-Type-Options, Referrer-Policy.
- Мутации: Server Actions или route handlers с Origin-check; SameSite cookie.
- Валидация Zod; лимиты длины; honeypot в отзывах.
- CSV: экранирование формул (`=`, `+`, `-`, `@`).
- Логи без email, токенов, текстов отзывов и сырого IP.
- Внешние ссылки: `rel="noopener noreferrer"`, `target="_blank"`.
- Секреты только в env; `.env*` в `.gitignore`; DeepSeek key не используется в runtime.

## 10. Краевые случаи

- Сканер почты открыл ссылку → GET не гасит токен.
- Токен истёк/использован → понятный экран и повторный запрос.
- Пользователь открыл ссылку в другом браузере → сессия создаётся после POST.
- Дубликат избранного/статуса → идемпотентно.
- Нет согласия на аналитику → события не пишутся, продукт работает.
- Материал недоступен → «Сообщить о проблеме» с типом `BAD_MATERIAL`.
- Контент не прошёл gate → сборка падает; страница не публикуется.
- Удаление аккаунта → очистка cookie и записей; события без userId.
- Домен/редиректы → старые корпоративные URL на `axiona.biz`, без циклов.
- Мобильный/клавиатура → 360px, фокус, контраст, подписи.
