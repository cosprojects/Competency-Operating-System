---
id: COS-REL-007
title: Реестр документации перед Beta 1
version: 1.0.0
status: Draft
owner: Product Team
last_updated: 2026-10-28
references:
  - COS-REL-000
  - COS-REL-008
  - COS_Foundation_Book_v0.3
  - COS-ARCH-000
  - COS-EAR-002
  - COS-EAR-009
  - COS-BP-003
  - COS-BP-004
  - COS-COM-001
  - COS-LEG-001
  - COS-LEG-002
---

# COS-REL-007 — Реестр документации перед Beta 1

## 1. Как читать

Реестр фиксирует, какие документы описывают целевую архитектуру, какие — текущий продукт, и что нужно сделать до/после Beta. Он не заменяет сами документы и не переписывает книги целиком.

Состояния:
- **Актуален** — можно использовать без правок для Beta.
- **Уточнить** — нужна небольшая правка формулировок.
- **Синхронизировать** — описывает другой продукт/состояние, нужна правка.
- **Архитектурное решение** — требует решения до правки.
- **Будущий этап** — сохранить как target, не менять ради Beta.

Приоритеты:
- **До Beta** — блокирует запуск или публичную коммуникацию.
- **После Beta** — важно, но не блокирует.
- **Стратегический** — горизонт 6–24 месяцев.

## 2. Реестр

| Документ | Роль | Состояние | Зависимости | Затронутые документы | Следующее действие | Приоритет |
|---|---|---|---|---|---|---|
| `docs/00-foundation/COS_Foundation_Book_v0.3.md` | Фундаментальное видение COS | Актуален + статус-раздел | North Star, Product Vision | Experience, Business | Добавить короткий раздел «Что реализовано в Beta 1» со ссылкой на `COS-REL-000`; не переписывать видение | До Beta |
| `docs/04-experience-architecture/COS-EAR-002-Mental-Model.md` | Целевая ментальная модель | Уточнить | Foundation | Navigation, Journeys | Добавить границу: текущая Beta — карта, а не навигатор с диагностикой | До Beta |
| `docs/04-experience-architecture/COS-EAR-009-User-Scenarios-Design-MVP.md` | Сценарий диагностики — следующий слой | Будущий этап | COS-RES-005/008 | Legal, Communication | Не менять как target; явно отделить от текущего Beta flow | До Beta |
| `docs/02-architecture/COS-ARCH-000-Enterprise-Architecture-Overview.md` | Архитектурный обзор | Уточнить | Foundation, DDD | ADE, Experience | Добавить current-state note: Beta использует JSON-модель + тонкое приложение | До Beta |
| `docs/02-architecture/COS-ARCH-001-Development Workflow.md` | Процесс развития | Уточнить | Foundation | Engineering Standard | Разделить архитектурную стадию и Beta release track; последовательность не менять | После Beta |
| `docs/01-ddd/COS-DDD-SUMMARY-Domain-Driven-Design-Summary.md` | Сводка домена | Уточнить | DDD-001…010 | Model, Architecture | Добавить таблицу текущих объектов Beta (Profession, Competency, LearningSource, Favorite, StudyStatus, Feedback); не вводить новые bounded contexts | После Beta |
| `docs/03-adaptive-development-engine/*` | Целевой ADE | Будущий этап | Foundation | Experience, Business | Не менять; явно не обещать в Beta | Стратегический |
| `docs/04-experience-architecture/COS-Experience_Architecture_Book.md` | Целевой опыт | Будущий этап | EAR-001…011 | Communication | Добавить ссылку на Beta flow; не переписывать | После Beta |
| `docs/05-business-architecture/COS-BUS-Business Book.md` | Бизнес-модель | Уточнить | Business Foundation | BP-003 | Добавить Beta-addendum: гипотезы map-продукта, диагностика post-Beta | После Beta |
| `docs/06-communication/COS-COM-001-Product Communication.md` | Публичные сообщения | Синхронизировать | Foundation, Beta scope | Website docs | Привести описание к map-продукту; убрать diagnostics-first обещания | До Beta |
| `docs/07-website/COS-WEB-000-Website Book.md` | Архитектура сайта | Уточнить | COM-001 | Landing, Investors | Добавить продукт `axiona.world` и корпоративный `axiona.biz`; обновить roles | До Beta |
| `docs/07-website/COS-WEB-001 Landing page.md` | Контент лендинга | Синхронизировать | COM-001 | Website Book | Убрать pre-development и неподтверждённые показатели; добавить CTA в Beta | До Beta |
| `docs/07-website/COS-WEB-002 For Investors.md` | Инвесторский контент | Синхронизировать | BP-003, Beta data | Pitch Deck | Не обещать диагностику как текущую функцию; обновить после Beta | После Beta |
| `docs/08-business-plan/COS-BP-003-Business-Plan.md` | Бизнес-план | Синхронизировать | RES-005/008 | BP-004, Investors | Beta-addendum; диагностическая воронка — следующий слой, не текущий прогноз | После Beta |
| `docs/08-business-plan/COS-BP-004-Product-Roadmap-MVP.md` | Roadmap MVP | Уточнить | BP-003 | Experience, ADE | Добавить пометку: текущая Beta — базовый слой, диагностика — следующий; не отменять roadmap | До Beta |
| `docs/09-research/COS-RES-005-User-Assessment-Scenario.md` | Сценарий диагностики | Будущий этап | RES-008 | EAR-009, Legal | Оставить как следующий слой; не использовать в коммуникации текущего MVP | До Beta |
| `docs/09-research/COS-RES-008-Design-Competency-Graph-and-MVP-Blueprint.md` | Блюпринт диагностики | Будущий этап | RES-005 | BP-004, Legal | Сохранить как следующий слой; не выдавать за текущий MVP | До Beta |
| `docs/10-legal/COS-LEG-001-Terms-of-Service.md` | Условия | Актуален для Beta 1 (draft) | Beta scope | Privacy, Consent | Заполнить реквизиты ИП и проверить юристом | До Beta |
| `docs/10-legal/COS-LEG-002-Privacy-Policy.md` | Политика ПДн | Актуален для Beta 1 (draft) | Beta data flow | Terms, Cookie | Заполнить реквизиты, проверить юристом, подать уведомление РКН | До Beta |
| `docs/11-scenarios/*` | Сценарии диагностики | Будущий этап | RES-005 | EAR-009 | Не менять; не публиковать как текущий продукт | Стратегический |
| `docs/10-legal/COS-LEG-003-Cookie-Notice.md` | Cookie и аналитика | Актуален для Beta 1 (draft) | Privacy | Terms | Проверить юристом; синхронизировать с consent-баннером | До Beta |
| `README.md` | Вход в репозиторий | Актуален для Beta 1 | Beta scope | Все | Поддерживать статус и команды | До Beta |

## 3. Документы Beta 1

Новые документы `docs/12-release/`:
- `COS-REL-000` — программа.
- `COS-REL-001` — состав и quality bar.
- `COS-REL-002` — контентная работа.
- `COS-REL-003` — архитектура.
- `COS-REL-004` — аналитика и отзывы.
- `COS-REL-005` — запуск.
- `COS-REL-006` — отчёт.
- `COS-REL-007` — этот реестр.
- `COS-REL-008` — decision log.

## 4. Порядок правок

1. Сначала `COS-REL-008` и `COS-REL-000` — фиксируют рамку.
2. Затем `COS-REL-001`/`002` — контентный gate.
3. Затем `COS-REL-003`/`004`/`005` — продукт и запуск.
4. Юридические документы — после подтверждения data flow.
5. Публичная коммуникация — после юридических документов.
6. Foundation/DDD/Business/Investment — после Beta, по данным.

Не переписывать книги целиком; каждая правка — отдельный артефакт с записью в истории документа.
