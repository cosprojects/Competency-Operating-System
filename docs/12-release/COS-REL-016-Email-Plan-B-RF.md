---
id: COS-REL-016
title: Plan B — РФ-email вместо Resend (Yandex SMTP)
version: 1.0.0
status: Draft
owner: Engineering / Legal
last_updated: 2026-11-13
references:
  - COS-LEG-002
  - COS-LEG-005
  - COS-LEG-006
  - COS-REL-005
  - COS-REL-008
  - T-005
  - T-007
---

# COS-REL-016 — Plan B: РФ-email вместо Resend

## 1. Когда включаем

- РКН не разрешает/затягивает трансграничную передачу в Resend/Proton.
- Resend или Proton не дают DPA/сведения по ст. 12.
- Доставляемость Resend в РФ ухудшается.
- Юрист требует убрать иностранных обработчиков до Beta.

## 2. Варианты

### A. Yandex 360 на домене (рекомендуется)

- Ящик `no-reply@app.axiona.world` (или `no-reply@axiona.world`).
- SMTP `smtp.yandex.ru:465` (SSL), app password.
- DNS: MX/SPF/DKIM Yandex для выбранного домена; A-запись `app` на VDS не трогать.
- Плюсы: бренд, РФ, без трансграничной передачи email.
- Минусы: настройка домена, тариф/лимиты, нужно проверить, поддерживает ли Yandex 360 поддомен `app.axiona.world`.

### B. Личный Yandex `av3rtino@yandex.ru` (быстрый fallback)

- Включить 2FA → «Пароли приложений» → пароль для Почты.
- SMTP `smtp.yandex.ru:465`, user `av3rtino@yandex.ru`, app password.
- `EMAIL_FROM=AXIONA <av3rtino@yandex.ru>`.
- Плюсы: 10 минут, без DNS.
- Минусы: личный адрес в письмах, лимиты, меньше доверия; только для закрытой Beta.
- Контакт `hi.axiona@protonmail.com` тоже заменить на `av3rtino@yandex.ru`, иначе Proton остаётся иностранным обработчиком.

## 3. Конфиг

```env
# SMTP имеет приоритет над Resend
EMAIL_SMTP_HOST=smtp.yandex.ru
EMAIL_SMTP_PORT=465
EMAIL_SMTP_SECURE=true
EMAIL_SMTP_USER=av3rtino@yandex.ru
EMAIL_SMTP_PASSWORD=<app-password>
EMAIL_FROM=AXIONA <av3rtino@yandex.ru>

# Resend можно оставить пустым
EMAIL_API_URL=
EMAIL_API_TOKEN=
```

Код: `apps/web/src/lib/email.ts` — при `EMAIL_SMTP_HOST` используется nodemailer SMTP, иначе HTTP Resend. Переключение — только env + restart, без пересборки.

## 4. Порядок переключения

1. Создать app password Yandex; проверить SMTP тестом.
2. На VDS: добавить SMTP-переменные в `.env.production`, очистить Resend-переменные.
3. `docker compose --env-file .env.production up -d --no-deps --force-recreate app`.
4. Запросить magic link на `avertinoave@gmail.com`; проверить доставку, SPF/DKIM, папку спама.
5. Проверить welcome, email-change, feedback.
6. Обновить политику: Yandex — обработчик в РФ; Resend/Proton убрать; трансграничной передачи email нет.
7. Обновить основное уведомление РКН (сведения об обработчиках) в течение 15 дней; отдельное трансграничное уведомление не подавать, если иностранных получателей не осталось.
8. Обновить `COS-LEG-006`: статус «не применяется/отозвано».
9. Пересоздать неиспользованные инвайты; `LEGAL_VERSION` поднять при изменении текста.

## 5. Проверка

- письмо приходит в Gmail/Яндекс/Mail.ru;
- заголовки: SPF pass, DKIM pass, DMARC pass;
- ссылка ведёт на `app.axiona.world`, не localhost;
- нет Resend/Proton в логах и политике;
- RKN-уведомление обновлено;
- `AUTH_REGISTRATION_DISABLED=1` до завершения legal gate.

## 6. Если Yandex не подходит

- Yandex 360 / Mail.ru / VK WorkMail — SMTP.
- Unisender Go / Sendsay / Mailopost — HTTP API; адаптер `EMAIL_API_URL` уже есть, но нужен формат их API (проверить).
- Любой вариант: РФ-обработчик, DPA, без трансграничной передачи email.

## 7. Откат

- Убрать `EMAIL_SMTP_*`, вернуть Resend env, restart.
- Вернуть политику/уведомление; отдельное трансграничное уведомление снова актуально.
- Проверить доставку и логи.

## 8. Риски

- Личный `@yandex.ru` может попадать в спам; лимиты на массовые письма.
- Yandex может требовать капчу/подтверждение при входе из нового IP — app password решает.
- Отправка с VDS IP может требовать прогрева; для 15–25 писем Beta допустимо.
- Юридически Yandex — обработчик; нужен DPA/поручение, проверить у юриста.
