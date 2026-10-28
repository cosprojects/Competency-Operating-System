# AXIONA Web (Beta 1)

Next.js-приложение для карты компетенций. Контент не редактируется здесь: он собирается из `../../release/beta-1.json` и модели командой `npm run release:build` / `release:build:draft`.

## Локальный запуск

```bash
# из корня репозитория
npm run db:local             # SQLite data/local.db + локальный Prisma client
cp apps/web/.env.example apps/web/.env.local   # APP_URL, ADMIN_EMAILS, LEGAL_VERSION
npm run release:build:draft  # черновой контент для preview
npm run web:dev              # http://localhost:3000; копирует web/*.html в public/canvas
```

`db:local` — для разработки без PostgreSQL. Перед production build выполните `npm run db:generate` (PostgreSQL).

Публичные страницы работают и без БД; вход, сохранения, отзывы и админка требуют локальную SQLite (`db:local`) или PostgreSQL.

## Vercel demo / продакшн

- Vercel: Root Directory `apps/web`, конфигурация в `apps/web/vercel.json`. Demo не является продакшн-контуром ПДн.
- Продакшн: РФ-хостинг, PostgreSQL, `npm run db:deploy`, затем `npm run web:build`.
- Docker: `Dockerfile` + `docker-compose.yml`, `Caddyfile`.

### Настройки Vercel-проекта (важно)

Репозиторий — npm-workspace монорепо: `next` объявлен только в `apps/web/package.json`,
поэтому Vercel обязан смотреть именно в `apps/web`, а не в корень (иначе падает
`Error: [NEXT_NO_VERSION] No Next.js version detected`).

- **Root Directory**: `apps/web` (Settings → Build and Deployment). Не пустой и не `web` —
  `web/` в корне это статические HTML-артефакты, не приложение.
- **Framework Preset**: Next.js. **Node.js Version**: 24.x (нужен для `node --experimental-strip-types`).
- **Include source files outside of the Root Directory in the Build Step**: включено
  (по умолчанию включено у новых проектов). Install/build команды из `vercel.json`
  обращаются к корню репозитория (`..`), без этой опции их не выполнить.
- Install: `npm install --include-workspace-root` (ставит зависимости воркспейса и корня),
  Build: `cd ../.. && npm run db:generate && npm run web:build` — берутся из `vercel.json`.
- После изменения Root Directory нужен новый деплой (Redeploy); старые сборки настройку не подхватят.
- Переменные окружения для demo: `APP_URL` (валидный абсолютный URL), `SESSION_SECRET`,
  `LEGAL_VERSION`, `ADMIN_EMAILS`, `ANALYTICS_HASH_SALT`. Публичные страницы работают без БД;
  вход, сохранения, отзывы и админка требуют `DATABASE_URL` (PostgreSQL + `npm run db:deploy`)
  и, для magic link, `EMAIL_API_URL`/`EMAIL_API_TOKEN`/`EMAIL_FROM`.

```bash
npm run release:validate -- --release beta-1
npm run release:build -- --release beta-1
npm run web:build
npm --workspace apps/web run start
```

## Схемы компетенций

`/canvas` — индекс Beta-схем и исследовательских карт. Сами страницы генерируются в `web/*.html`, затем `npm run web:canvases` копирует их в `apps/web/public/canvas/`; ссылки открываются в новой вкладке. `web:build` и `web:dev` вызывают копирование автоматически.

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
