---
id: COS-REL-005
title: Launch runbook Beta 1
version: 1.4.0
status: Draft
owner: Engineering
last_updated: 2026-11-11
references:
  - COS-REL-000
  - COS-REL-003
  - COS-REL-004
  - COS-REL-008
  - COS-EAR-015
  - COS-LEG-005
---

# COS-REL-005 — Launch runbook Beta 1

## 0. Контуры и текущий этап

Принят **ADR-025**: продукт целиком на VDS в Москве, корпоративный сайт остаётся на Vercel. Прежняя схема ADR-023 (РФ-тест + СНГ-релиз) — историческая рамка, не текущий план запуска.

| Контур | Домен | Хостинг | Назначение |
|---|---|---|---|
| Локально | `localhost:3000` | машина разработчика, SQLite | разработка и QA |
| Vercel demo | preview | Vercel, без production-БД | показ без реальных ПДн; регистрация закрыта |
| Продукт | `app.axiona.world` | VDS в Москве: Next.js + PostgreSQL 16 + Caddy | Beta на инвайтах, затем публичный запуск |
| Корпоративный сайт | `axiona.world` | Vercel | сайт компании; остаётся на месте до отдельного решения |
| `axiona.biz` | — | позже | регистратор/американский номер; не блокирует Beta |

Vercel demo не является production-контуром ПДн. Продукт, БД и бэкапы — в РФ; один origin для SSR/auth/cookie/Prisma.

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
- Vercel demo **не является** продакшн-контуром персональных данных: реальные регистрации и публичный Beta на нём не открываются. Для теста — РФ-контур на отдельном домене, для публичного запуска — СНГ-контур (`ADR-023`).

## 1. Предусловия

Не начинать деплой, пока не выполнено:

- `release:validate` — 0 ошибок; `release:build` собирает контент.
- `npm run typecheck && npm test` — зелёные; `apps/web` build — зелёный.
- Подписаны политика, условия, cookie notice; реквизиты оператора заполнены. Для Beta допустим самозанятый (НПД); структура для публичного релиза определяется отдельно.
- Для контура с реальными ПДн в РФ — уведомление Роскомнадзора и политика (обязанности оператора не зависят от того, самозанятый это или ИП); для СНГ-контура — юридическая проверка выбранной юрисдикции (включая требования к ПДн граждан РФ).
- Есть хостинг выбранного контура (VPS в РФ для теста / вне РФ для релиза), домен и DNS, email-провайдер.
- Есть доступ к репозиторию корпоративного сайта.
- Секреты в env, DeepSeek key ротирован, `.env*` не в git.
- Бэкап и восстановление проверены на staging.

## 2. Переменные окружения

```text
# APP_URL продукта: https://app.axiona.world
APP_URL=https://app.axiona.world
LEGAL_VERSION=1.0.0
# Срок ссылки для входа: 43200 минут = 30 дней (по умолчанию в коде)
LOGIN_LINK_TTL_MINUTES=43200
DATABASE_URL=postgresql://...
SESSION_SECRET=<32+ bytes>
EMAIL_API_URL=https://provider.example/send
EMAIL_API_TOKEN=...
EMAIL_FROM=no-reply@axiona.world
SUPPORT_EMAIL=support@axiona.world
PRIVACY_EMAIL=privacy@axiona.world
ADMIN_EMAILS=...
ANALYTICS_HASH_SALT=...
# 1 — аварийный стоп публичной регистрации: ссылки получают только существующие адреса
AUTH_REGISTRATION_DISABLED=0
```

Набор переменных один для продукта: `APP_URL`, `DATABASE_URL`, `EMAIL_*`; `EMAIL_FROM`/`SUPPORT_EMAIL` — на домене `app.axiona.world`. `axiona.world` остаётся корпоративным сайтом.

`DEEPSEEK_API_KEY` нужен только контентному pipeline, не приложению. В production env приложения его быть не должно.

`LEGAL_VERSION` — версия согласий: при её изменении у пользователей создадутся новые записи `ConsentRecord` при следующем подтверждении входа; согласие оформлено пассивной строкой на форме (как в макете), без чекбокса (`COS-EAR-015`).

## 3. Хостинг

### 3.1. VDS в Москве

1. Купить VDS с московским IP и статическим адресом (Yandex Cloud / Selectel / Timeweb), Ubuntu LTS; открыть 22/80/443, SSH по ключу. Текущий план — 1 CPU / 2 ГБ RAM / 300 ГБ SSD; для 2 ГБ включить swap 2 ГБ и лимиты PostgreSQL.
2. Установить Docker и Compose; скопировать репозиторий в `/srv/axiona`; `sudo scripts/deploy/setup-swap.sh`.
3. Заполнить `.env.production`: `APP_URL=https://app.axiona.world`, `DATABASE_URL`, `EMAIL_*`, `OWNER_EMAILS`, `LEGAL_VERSION`, на старте `AUTH_REGISTRATION_DISABLED=1`.
4. Caddy: `app.axiona.world` → приложение; TLS автоматически. PostgreSQL 16 — в compose, порт БД не публиковать.
5. `docker compose --env-file .env.production up -d --build` (APP_URL из `.env.production` передаётся и в build-arg: robots/sitemap генерируются на сборке); `scripts/deploy/migrate.sh`; `GET /api/health`.
6. Впускать тестеров по инвайтам; публичную регистрацию открыть после legal/QA.
7. Nightly `pg_dump` + проверка restore в отдельную БД; мониторинг health/5xx.
8. `axiona.world` не направлять на VDS: это корпоративный сайт на Vercel.

### 3.2. Позже

`axiona.biz`, отдельный СНГ-контур и смена корневого домена — отдельные решения. Они не блокируют Beta на `app.axiona.world`.

## 4. DNS

| Домен | Контур | Назначение | Записи |
|---|---|---|---|
| `app.axiona.world` | Продукт | VDS в Москве | A → IP VDS; TLS Caddy |
| `axiona.world` | Vercel | Корпоративный сайт | по инструкции Vercel; не менять до решения |
| `axiona.biz` | Позже | Корпоративный сайт/алиас | решается отдельно; регистратор требует US phone |
| `mail.app.axiona.world` | Email | Отправка писем продукта | MX, SPF, DKIM, DMARC |

- Понизить TTL за 24 часа до переключения; после — `dig`, `curl -I`, HSTS.
- Порт PostgreSQL наружу не открывать.

## 5. Email

1. Для продукта на `app.axiona.world` выбран Resend: `EMAIL_API_URL=https://api.resend.com/emails`, `EMAIL_API_TOKEN` (Sending access), `EMAIL_FROM=AXIONA <no-reply@app.axiona.world>`. Домен `app.axiona.world` Verified в Resend; magic link доставлен 2026-11-10. Регион Resend — Ирландия/ЕС; передача email и текста письма раскрыта в политике.
2. Официальный контакт — `hi.axiona@protonmail.com`; `support@`/`privacy@` на домене пока не используются. Если появятся — обновить политику, футер и уведомление РКН.
3. SPF/DKIM/DMARC настроены Resend и Verified; DMARC (`p=none`) добавить/проверить до публичного запуска.
4. Отправить тестовые magic link на Gmail, Яндекс, Mail.ru; проверить папку спама.
5. Проверить, что ссылка ведёт на `/auth/verify` домена этого контура (`APP_URL`), а не на localhost и не на чужой контур.
6. Проверить доставку welcome-письма после первого входа (`COS-EAR-015`); в production без `EMAIL_API_URL` регистрация отвечает 503.
7. Пройти регистрацию с нового адреса: `/register` → письмо → подтверждение → `/saved?welcome=1`; повторить вход существующим адресом — письмо и вход без сюрпризов, согласие фиксируется по факту подтверждения. Публичная регистрация остаётся закрытой (`AUTH_REGISTRATION_DISABLED=1`) до уведомления РКН и юридической проверки.

**Gate.** До реальных инвайтов подать уведомление РКН об обработке ПДн и отдельное уведомление о трансграничной передаче (Resend IE/US, Proton CH) по `COS-LEG-005`.

## 6. Деплой

```bash
# на VM
git pull
npm ci
npm run release:validate -- --release beta-1
npm run release:build -- --release beta-1
npm run web:build
RELEASE_BUILD=release:build docker compose --env-file .env.production up -d --build
scripts/deploy/migrate.sh   # использует DATABASE_URL из .env.production; runtime-образ Prisma CLI не содержит
curl -fsS https://app.axiona.world/api/health
```

- Деплой только из тега/коммита, прошедшего CI.
- Не запускать `release:build` на проде без `release:validate`.
- Сохранить предыдущий образ для rollback.
- `<домен контура>` — `app.axiona.world`; `axiona.world` — корпоративный сайт.

## 7. Pre-launch проверки

### Контент
- 12 профессий открываются; 292 опубликованные связи; 131 компетенция.
- У каждой компетенции есть знания, навыки и материал.
- AI-слой виден только в AI-дизайнере (56 компетенций); в остальных профессиях AI-компетенций нет (ADR-015).
- Гейм-дизайнер не публикуется.
- Нет placeholder/TODO/битых ссылок.

### Аккаунт
- Запрос magic link; письмо приходит; ссылка открывает подтверждение; POST входит.
- Новый адрес: `/register` → письмо → подтверждение (без чекбокса, согласие — пассивная строка формы) → аккаунт, welcome-письмо, `/saved?welcome=1`.
- Повторный вход существующим адресом: вход в один клик, welcome-письма нет.
- Инвайт владельца: приглашённый подтверждает ссылку и попадает в аккаунт.
- Проверить `AUTH_REGISTRATION_DISABLED=1`: новый адрес письма не получает, существующий входит, инвайты работают.
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

## 8. Корпоративный сайт

Сейчас `axiona.world` — корпоративный сайт на Vercel. Продукт живёт на `app.axiona.world` (VDS). Сайт компании не переносим и не меняем корневой домен до отдельного решения после Beta.

`axiona.biz` куплен, но регистратор требует американский номер; это не блокирует Beta. Когда домен будет доступен, решаем: оставить сайт на `axiona.world`, перенести на `axiona.biz` или сделать `axiona.biz` алиасом. Все переходы — с 301 и проверкой canonical/sitemap/OG.

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

## 11. История изменений

| Версия | Дата | Что изменилось |
|---|---|---|
| 1.0.0 | 2026-10-28 | Первая редакция: предусловия, хостинг, DNS, email, деплой, pre-launch проверки, rollback |
| 1.1.0 | 2026-11-05 | Два контура (`ADR-023`): РФ-тест на отдельном домене и СНГ-релиз; разделы хостинга, DNS и email параметризованы по контуру; регистрация по email (`COS-EAR-015`) в pre-launch проверках |
| 1.3.0 | 2026-11-09 | ADR-025: продукт на VDS в Москве (`app.axiona.world`), корпоративный сайт на Vercel; обновлены хостинг, DNS, email и раздел сайта |
