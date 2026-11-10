# Beta 1 documentation

| Документ | Назначение |
|---|---|
| [COS-REL-000](COS-REL-000-Beta-Program.md) | Программа Beta 1: решения, scope, gates, риски |
| [COS-REL-001](COS-REL-001-Release-Scope.md) | Состав релиза и quality bar |
| [COS-REL-002](COS-REL-002-Content-QA.md) | Контентная работа и приёмка |
| [COS-REL-003](COS-REL-003-Product-Architecture.md) | Архитектура приложения и данные |
| [COS-REL-004](COS-REL-004-Analytics-Feedback.md) | События, метрики, отзывы |
| [COS-REL-005](COS-REL-005-Launch-Runbook.md) | Запуск, домены, инфраструктура, rollback |
| [COS-REL-006](COS-REL-006-Beta-Report.md) | Шаблон отчёта Beta |
| [COS-REL-007](COS-REL-007-Documentation-Register.md) | Реестр документации |
| [COS-REL-008](COS-REL-008-Decision-Log.md) | Decision log |
| [COS-REL-012](COS-REL-012-Delivery-Plan-and-Versioning.md) | План реализации, версионность и канбан |
| [COS-REL-013](COS-REL-013-Beta-Backlog-Review.md) | Детализация backlog и решения по зависимостям |
| [COS-REL-014](COS-REL-014-Project-Audit-2026-11-09.md) | Аудит состояния проекта и документации |
| [COS-REL-015](COS-REL-015-Production-QA-Checklist.md) | Production QA checklist Public Beta (T-009) |
| [COS-REL-009](COS-REL-009-Materials-Review-and-Confirmation.md) | Материалы: лимиты покрытия, LLM-приёмка, подтверждение ресурсов |

Стратегическая рамка: [`COS-BP-005`](../08-business-plan/COS-BP-005-Product-Roadmap-AXIONA-COS.md).

Отчёты:
- [`reports/archive/beta-1-gap-report.md`](reports/archive/beta-1-gap-report.md) — исторический release gate (до расширения ресурсной базы).
- [`reports/archive/beta-1-content-gate-closure.md`](reports/archive/beta-1-content-gate-closure.md) — исторический результат content gate.
- [`reports/archive/beta-1-content-backlog.md`](reports/archive/beta-1-content-backlog.md) — исторический чек-лист до gate (superseded).
- [`reports/archive/beta-1-source-review-checklist.md`](reports/archive/beta-1-source-review-checklist.md) — 125 уникальных пар «компетенция–источник» для source review.
- [`reports/beta-1-sources-expansion-2026-11-03.md`](reports/beta-1-sources-expansion-2026-11-03.md) — финальная сводка ресурсной базы по профессиям: авто-расширение Brave, покрытие, пробелы.
- [`reports/cleanup-2026-11-03.md`](reports/cleanup-2026-11-03.md) — аудит документации и legacy-скриптов, что удалено/переименовано, что требует решения.
- [`COS-REL-010-Daily-Materials-Automation.md`](COS-REL-010-Daily-Materials-Automation.md) — ежедневный добор материалов: алгоритм, корнер-кейсы, opt-in GitHub Actions.
- [`reports/spot-check-aidesigner-expanded-2026-11-03.md`](reports/spot-check-aidesigner-expanded-2026-11-03.md) — spot-check AI-дизайнера после расширения до 56 компетенций.
- [`reports/descriptions-2026-11-03.md`](reports/descriptions-2026-11-03.md) — субагент описаний: раскатка на 13 профессий, 0 ошибок валидатора.
- [`reports/demo-2026-11-09.md`](reports/demo-2026-11-09.md) — demo-сборка: commit, CI, Vercel и ограничения.
- [`reports/qa-2026-11-10.md`](reports/qa-2026-11-10.md) — QA локального контура: профиль, аккаунт, admin, audit.
- [`reports/vds-2026-11-10.md`](reports/vds-2026-11-10.md) — VDS-контур app.axiona.world: сервер, TLS, health, backup.
- [`reports/production-qa-2026-11-10.md`](reports/production-qa-2026-11-10.md) — production QA: смоук, мобильные, доступность, consent, дефекты и блокеры T-009.
- [`reports/legal-gaps-2026-11-10.md`](reports/legal-gaps-2026-11-10.md) — недостающие legal-данные T-005: ОПФ, реквизиты, email-контур, согласия, уведомление РКН.

Текущий статус (2026-11-10): production-контур `app.axiona.world` развёрнут (T-006/T-007/T-008), `release:validate` проходит: 12 профессий, 131/131 компетенция, 292/391 связей, 116 источников, манифест `ready`. Первый production QA-прогон проведён (смоук + браузер/axe, `reports/production-qa-2026-11-10.md`): T-009 заблокирован P0 — вход по magic link редиректит на `localhost:3000`, плюс P1 по sitemap/robots, hydration и H1. Закрытая Beta на инвайтах заблокирована до фикса QA-дефектов и legal sign-off T-005 (`reports/legal-gaps-2026-11-10.md`).
