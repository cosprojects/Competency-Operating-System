---
id: COS-REL-005
title: Launch runbook Beta 1
version: 1.0.0
status: Draft
owner: Engineering
last_updated: 2026-10-28
references:
  - COS-REL-000
  - COS-REL-003
  - COS-REL-004
  - COS-REL-008
---

# COS-REL-005 — Launch runbook Beta 1

## 0. Текущий этап и публичный запуск

Сейчас MVP доводится локально. Хостинг не куплен, корпоративный сайт остаётся на `axiona.world`, продукт при необходимости деплоится на Vercel для demo. Разделы 3–6 (РФ-хостинг, DNS, email, production deploy) относятся к публичному запуску и выполняются только после готовности MVP и юридического sign-off.

### Локально

```bash
npm run db:local          # SQLite + локальный Prisma client
cp apps/web/.env.example apps/web/.env.local
# APP_URL=http://localhost:3000, ADMIN_EMAILS=..., LEGAL_VERSION=1.0.0
npm run release:build:draft
npm run web:dev
```

`db:local` использует `data/local.db`; после него Prisma client собран под SQLite. Перед production build снова выполните `npm run db:generate`.

### Vercel demo

- Root Directory проекта: `apps/web`.
- В `apps/web/vercel.json` build command поднимается в корень репозитория, генерирует Prisma client и собирает приложение.
- Публичные страницы работают без БД; вход/сохранения/отзывы требуют PostgreSQL. Для demo используйте временную тестовую БД и только тестовые аккаунты.
- Vercel demo **не является** продакшн-контуром персональных данных: реальные регистрации и публичный Beta на нём не открываются. Для публичного запуска — РФ-хостинг и юридический контур.

## 1. Предусловия

Не начинать деплой, пока не выполнено:

- `release:validate` — 0 ошибок; `release:build` собирает контент.
- `npm run typecheck && npm test` — зелёные; `apps/web` build — зелёный.
- Подписаны политика, условия, cookie notice; реквизиты ИП заполнены.
- Уведомление Роскомнадзора подано.
- Есть РФ-хостинг, домен, email-провайдер, доступ к DNS.
- Есть доступ к репозиторию корпоративного сайта.
- Секреты в env, DeepSeek key ротирован, `.env*` не в git.
- Бэкап и восстановление проверены на staging.

## 2. Переменные окружения

```text
APP_URL=https://axiona.world
LEGAL_VERSION=1.0.0
DATABASE_URL=postgresql://...
SESSION_SECRET=<32+ bytes>
EMAIL_API_URL=https://provider.example/send
EMAIL_API_TOKEN=...
EMAIL_FROM=no-reply@axiona.world
SUPPORT_EMAIL=support@axiona.world
PRIVACY_EMAIL=privacy@axiona.world
ADMIN_EMAILS=...
ANALYTICS_HASH_SALT=...
```

`DEEPSEEK_API_KEY` нужен только контентному pipeline, не приложению. В production env приложения его быть не должно.

## 3. Хостинг

1. Создать VM в РФ (Yandex Cloud, Ubuntu LTS), открыть 80/443, SSH по ключу.
2. Установить Docker и Compose; создать каталог `/srv/axiona`.
3. Поднять Postgres 16 с volume и паролем из env; приложение; Caddy.
4. Настроить Caddy: `axiona.world`, `www.axiona.world` → redirect; TLS автоматически.
5. Применить `prisma migrate deploy`.
6. Проверить `GET /api/health`.
7. Настроить nightly `pg_dump` в Object Storage, retention 14 дней; проверить restore в отдельную БД.

## 4. DNS

| Домен | Назначение | Записи |
|---|---|---|
| `axiona.world` | Продукт | A/AAAA → VM; `www` CNAME → apex |
| `axiona.biz` | Корпоративный сайт | по инструкции Vercel/хостинга |
| `mail.axiona.world` | Email | MX, SPF, DKIM, DMARC |

- Понизить TTL за 24 часа до переключения.
- После переключения проверить `dig`, `curl -I`, HSTS, редиректы.
- `axiona.biz` проверить и зарегистрировать/делегировать до переезда.

## 5. Email

1. Подключить домен к РФ-провайдеру (Yandex 360/Unisender) и настроить HTTP-адаптер `EMAIL_API_URL`.
2. Создать `no-reply@`, `support@`, `privacy@`.
3. Настроить SPF (`v=spf1 include:... ~all`), DKIM, DMARC (`p=quarantine`).
4. Отправить тестовые magic link на Gmail, Яндекс, Mail.ru; проверить папку спама.
5. Проверить, что ссылка ведёт на `https://axiona.world/auth/verify`, а не на localhost.

## 6. Деплой

```bash
# на VM
git pull
npm ci
npm run release:validate -- --release beta-1
npm run release:build -- --release beta-1
npm run web:build
RELEASE_BUILD=release:build docker compose up -d --build
npm run db:deploy   # или отдельный job с DATABASE_URL; в runtime-образе Prisma CLI нет
curl -fsS https://axiona.world/api/health
```

- Деплой только из тега/коммита, прошедшего CI.
- Не запускать `release:build` на проде без `release:validate`.
- Сохранить предыдущий образ для rollback.

## 7. Pre-launch проверки

### Контент
- 4 профессии открываются; 110 связей; 54 компетенции.
- У каждой компетенции есть знания, навыки и материал.
- Нет AI-слоя и `it.aidesigner`.
- Нет placeholder/TODO/битых ссылок.

### Аккаунт
- Запрос magic link; письмо приходит; ссылка открывает подтверждение; POST входит.
- Повторное использование ссылки отклоняется.
- Выход и повторный вход; сессия сохраняется.
- Удаление аккаунта очищает данные.

### Сохранения и статусы
- Добавить/удалить компетенцию и материал; обновить страницу; выйти/войти — данные на месте.
- Статусы меняются и сохраняются; `/saved` показывает пустое состояние.

### Отзывы
- Контекстный и общий отзыв; подтверждение; запись в админке; CSV.
- Пустой отзыв отклоняется; длинный — обрезается/отклоняется с ошибкой.

### Аналитика
- Согласие/отказ; события пишутся только после согласия.
- `page_view`, `profession_view`, `competency_view`, `source_click`, `signup_complete`, `favorite_add`, `study_status_change`, `feedback_submit` видны в отчёте.
- В событиях нет email/комментариев.

### Мобильный и доступность
- 360px, 768px, 1280px; меню, карточки, формы.
- Клавиатурная навигация, фокус, контраст, alt/aria.

### Юридическое
- Политика/условия/cookie notice открываются, реквизиты верны, дата версии.
- Ссылки в футере, логине, форме отзыва.
- Cookie-баннер не блокирует продукт; отказ работает.

## 8. Переезд корпоративного сайта

1. Задеплоить корпоративный сайт на `axiona.biz`.
2. Настроить 301:
   - `axiona.world/ru/*` → `axiona.biz/ru/*`
   - `axiona.world/en/*` → `axiona.biz/en/*`
   - `/docs/*`, `/investors`, `/team`, `/whitepaper` — сохранить пути.
3. Не редиректить продуктовые маршруты (`/`, `/professions`, `/competencies`, `/saved`, `/login`, `/legal`).
4. Обновить canonical, sitemap, OG, внешние ссылки, подписи, презентации.
5. Проверить старые URL и отсутствие циклов.
6. Аудит claims: «pre-development», 128 компетенций, 36 проектов, 247 подтверждённых, ISO/IEC 27001, контакты. Подтвердить или убрать.
7. Добавить ссылку на продукт `https://axiona.world` и юридические документы.

## 9. Rollback

- Приложение: вернуть предыдущий Docker-образ, `docker compose up -d`.
- БД: миграции только additive; при проблеме — restore из последнего бэкапа в отдельную БД, затем переключение.
- Домен: вернуть DNS на предыдущий хост; TTL низкий.
- Контент: вернуть предыдущий `beta-1.json` и образ; не откатывать данные пользователей.
- После rollback: записать инцидент, причину, решение; уведомить пользователей при утечке/потере данных.

## 10. После запуска

- Первые 24 часа: health, 5xx, доставка email, отзывы, события.
- Ежедневно 14 дней: ошибки, отзывы, контентные неточности, воронка.
- Еженедельно: триаж отзывов, обновление backlog, краткий отчёт.
- Через 14 дней: `COS-REL-006`.
