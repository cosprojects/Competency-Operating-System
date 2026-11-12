---
title: Production QA — повторный прогон 2026-11-12
status: Review
owner: Engineering
last_updated: 2026-11-12
references:
  - COS-REL-015
  - COS-REL-014
  - COS-LEG-005
  - COS-LEG-006
  - T-009
  - T-005
---

# Production QA — 2026-11-12

## 1. Результат

- Смоук: **79 проверок, 77 PASS, 2 WARN, 0 FAIL**.
- Браузер/a11y: **14/14 страниц без critical**, mobile 360 и desktop 1280.
- Cookie-баннер: выбор фиксируется; до согласия событий нет, после — событие уходит.
- Публичные страницы, `/api/health`, TLS, robots/sitemap, статика — PASS.
- Уведомление РКН об обработке подано: № 100495783 (2026-11-12).

## 2. Что изменилось с 2026-11-10

- Контакты приведены к `hi.axiona@protonmail.com`; `support@`/`privacy@` удалены из UI.
- В футер добавлены реквизиты оператора-НПД.
- Legal 1.1.0: политика/условия/cookie, Resend/Proton и трансграничная передача раскрыты.
- Docker-образ включает `public`-ассеты (логотип/шрифты).
- Smoke-проверки QA-71/72 обновлены под новые реквизиты.

## 3. Осталось для закрытия T-009

- удаление аккаунта через модалку на production;
- смена email (письмо на новый адрес, отзыв сессий);
- инвайт через `/admin/users`;
- смена статусов отзывов и аудит админ-действий;
- реальные iOS/Android/Safari/Firefox;
- legal-страницы остаются `draft: true` до T-005 sign-off.

## 4. Артефакты

- `docs/12-release/reports/screenshots/production-qa-2026-11-12/`
- `docs/12-release/COS-REL-015-Production-QA-Checklist.md`

**Вердикт:** production-контур технически готов к закрытой Beta; финальный gate — T-005 (юрист + трансграничное уведомление) и оставшиеся ручные пункты T-009.
