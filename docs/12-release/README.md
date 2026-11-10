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

Текущий статус (2026-11-09): `release:validate` проходит (292/391 связей опубликовано, 131/131 компетенция, 0 пробелов, 12 профессий, 116 источников в сборке); AI-дизайнер опубликован с полным AI-слоем (ADR-015), гейм-дизайнер собран в модели и не публикуется. Манифест — `ready`; человеческий spot-check основателя проведён, остались некритичные расхождения. Публичный запуск заблокирован до production-контура, QA и юридического sign-off.
