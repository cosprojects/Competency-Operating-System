/**
 * Уведомление команде о новом отзыве. Служебное письмо: уходит на почту
 * поддержки, поэтому каркас без строки «напиши мне» — отвечать на него не нужно.
 */

import { escapeHtml, renderEmailLayout } from "./layout.ts";
import type { RenderedEmail } from "./layout.ts";

export const FEEDBACK_SUBJECT = "AXIONA: новый отзыв";

export interface FeedbackEmailInput {
  appUrl: string;
  privacyUrl: string;
  logoUrl: string;
  type: string;
  comment?: string;
  rating?: number;
  contactEmail?: string;
  pagePath: string;
  targetType?: string;
  targetId?: string;
}

/** Строки «подпись: значение» для тела письма. */
function feedbackRows(input: FeedbackEmailInput): Array<{ label: string; value: string }> {
  return [
    { label: "Тип", value: input.type },
    { label: "Оценка полезности", value: input.rating ? `${input.rating}/5` : "" },
    { label: "Комментарий", value: input.comment ?? "" },
    { label: "Email для ответа", value: input.contactEmail ?? "" },
    {
      label: "Объект",
      value: input.targetType && input.targetId ? `${input.targetType} ${input.targetId}` : "",
    },
    { label: "Страница", value: input.pagePath },
  ].filter((row) => row.value !== "");
}

export function renderFeedbackNotificationEmail(input: FeedbackEmailInput): RenderedEmail {
  const appUrl = input.appUrl.replace(/\/+$/, "");
  const rows = feedbackRows(input);

  const text = [
    "Карта компетенций",
    "",
    "Новый отзыв",
    "",
    ...rows.map((row) => `${row.label}: ${row.value}`),
    "",
    `Открыть отзывы: ${appUrl}/admin/feedback`,
    "",
    `Политика конфиденциальности: ${input.privacyUrl}`,
    "",
    "AXIONA",
  ].join("\n");

  const bodyHtml = rows
    .map(
      (row) => `                <p style="margin:0 0 0 0;padding-top:8px;font-size:16px;line-height:22px;color:#595959;">
                  <span style="color:#8a99ad;">${escapeHtml(row.label)}:</span> ${escapeHtml(row.value).replaceAll("\n", "<br/>")}
                </p>`,
    )
    .join("\n");

  const html = renderEmailLayout({
    title: FEEDBACK_SUBJECT,
    preheader: `Новый отзыв на странице ${input.pagePath}.`,
    h1: "Новый отзыв",
    lead: "Отзыв сохранён. Все детали — ниже, а полный список открывается в консоли.",
    button: { href: `${appUrl}/admin/feedback`, label: "Открыть отзывы" },
    bodyHtml: `                <div style="margin-top:24px;">\n${bodyHtml}\n                </div>`,
    privacyUrl: input.privacyUrl,
    logoUrl: input.logoUrl,
  });

  return { subject: FEEDBACK_SUBJECT, text, html };
}
