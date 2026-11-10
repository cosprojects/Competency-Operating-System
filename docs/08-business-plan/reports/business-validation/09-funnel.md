# Воронка: события, формулы и baseline

**Дата:** 2026-11-10
**Статус:** инструментация обновлена; реальные данные не собраны (регистрация закрыта, legal/QA gates).

## 1. События

| Этап | Событие | Где | Пропсы |
|---|---|---|---|
| Визит | `page_view` | все страницы | `path`, `locale`, `referrer_type`, `utm_*`, `referrer_host`, `landing_variant` |
| Открыл профессию | `profession_view` | `/professions/[slug]` | `profession_id` |
| Открыл компетенцию | `competency_view` | канвас профессии, initial query | `profession_id`, `competency_id` |
| Перешёл к материалу | `source_click` / `source_gate_view` | карточка материала | `competency_id`, `source_id`, `source_kind`, `access` |
| Начал регистрацию | `signup_start` | `/register` | `method`, `context` |
| Зарегистрировался | `signup_complete` | verify | — |
| Активация | `favorite_add`, `study_status_change`, `source_view_submit` | приложение | `target_type/id`, `from/to` |
| CTA | `cta_click` | `/offer`, лендинги | `cta_id`, `cta_target`, `landing_variant`, `page` |
| Возврат | вычисляется из `page_view`/событий + `User.createdAt` | metrics | — |

**Изменения 2026-11-10:**
- добавлен `cta_click` и UTM/`landing_variant` в allowlist;
- `competency_view` отправляется при открытии компетенции в канвасе и по прямой ссылке;
- клиентский дубль `study_status_change` убран (сервер пишет один раз);
- `return_visit` не добавляется; retention считается из существующих событий;
- `scripts/metrics/report.ts` выводит воронку, варианты лендинга, CTA и UTM.

## 2. Формулы

```
Visit → Signup          = signup_complete / visitors
Signup → Activation     = activated / signup_complete
Activation → Return 7d  = returned_7d / eligible
CTA rate                = cta_click / visitors
Pro conversion          = paid / signup_complete
Churn                   = canceled / active_at_start
ARPU                    = subscription_revenue / active_paid
LTV                     = ARPU / churn
CAC                     = marketing_spend / new_paid
```

Знаменатели — только согласившиеся на аналитику (`axiona_consent=all`); это ограничение указывается в каждом отчёте.

## 3. Baseline

Сейчас данных нет: production в закрытой Beta, реальных пользователей нет. После T-005/T-009:

1. Закрытая Beta 15–25 участников: качественные сценарии, не статистика.
2. Публичная Beta: ≥ 1 000 сессий, ≥ 300 регистраций; отчёт `npm run metrics:report -- --days 30 --write`.
3. Лендинг A/B: 3 варианта, ≥ 1 000 сессий/вариант.
4. Пилот Pro: 20–30 приглашённых, фактическая оплата.

## 4. Целевые пороги (гипотезы, не нормативы)

| Этап | Порог | Что делать при недостижении |
|---|---:|---|
| Посетитель → регистрация | ≥ 8% | упростить вход/оффер; проверить источник |
| Регистрация → активация | ≥ 40% | проблема продукта/онбординга |
| 7-дневный возврат | ≥ 20% | нет повода вернуться; менять ценность |
| CTA-клик | ≥ 5% | проблема сообщения/оффера |
| Регистрация → Pro | ≥ 3% | цена/ценность/пейвол |
| Отток | ≤ 8%/мес | ценность подписки |
| LTV/CAC | ≥ 3 | остановить канал/пересмотреть цену |

Пороги — гипотезы из `COS-BP-007`; после первых данных заменить на измеренные и указать N.

## 5. Что нельзя утверждать до данных

- «Конверсия 4%» — это гипотеза из модели, не измерение.
- «CAC 900 ₽» — это маркетинговый бюджет / платящие в модели, не реальный CAC.
- «Люди готовы платить 590 ₽» — пока нет ни одного платежа.
- «Рынок 217 тыс.» — это численность дизайнеров, не платящая аудитория.

## 6. Следующий шаг

После открытия Beta: включить T-010, проверить события в production, снять baseline, зафиксировать в `09-funnel.md` и обновить `COS-BP-008` уже на измеренных конверсиях.
