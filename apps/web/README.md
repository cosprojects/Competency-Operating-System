# AXIONA Web (Beta 1)

Next.js-приложение для карты компетенций. Контент не редактируется здесь: он собирается из `../../release/beta-1.json` и модели командой `npm run release:build` / `release:build:draft`.

## Локальный запуск

```bash
# из корня репозитория
npm run db:local             # SQLite data/local.db + локальный Prisma client
cp apps/web/.env.example apps/web/.env.local   # APP_URL, ADMIN_EMAILS, LEGAL_VERSION
npm run release:build:draft  # черновой контент для preview
npm run web:dev              # http://localhost:3000
```

`db:local` — для разработки без PostgreSQL. Перед production build выполните `npm run db:generate` (PostgreSQL).

Публичные страницы работают и без БД; вход, сохранения, отзывы и админка требуют локальную SQLite (`db:local`) или PostgreSQL.

## Vercel demo / продакшн

- Vercel: Root Directory `apps/web`, конфигурация в `apps/web/vercel.json`. Demo не является продакшн-контуром ПДн.
- Продакшн: РФ-хостинг, PostgreSQL, `npm run db:deploy`, затем `npm run web:build`.
- Docker: `Dockerfile` + `docker-compose.yml`, `Caddyfile`.

```bash
npm run release:validate -- --release beta-1
npm run release:build -- --release beta-1
npm run web:build
npm --workspace apps/web run start
```

## Данные

- Контент: `src/content/generated/beta-1.json` (генерируется, не коммитится).
- Пользовательские данные: локально SQLite `data/local.db`; публично PostgreSQL, схема `prisma/schema.prisma`.
- Будущая диагностическая схема: `prisma/assessment.schema.prisma`, не используется.

## Проверки

```bash
npm run web:typecheck
npm run web:build
```

Перед публичным запуском — `COS-REL-005` (runbook) и `COS-REL-001` (quality bar).
