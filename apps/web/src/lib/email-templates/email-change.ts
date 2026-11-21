/**
 * Письма смены email (COS-EAR-013): подтверждение нового адреса и уведомление
 * старого адреса. Каркас — общий `layout.ts`.
 */

import { escapeHtml, renderEmailLayout } from "./layout.ts";
import type { RenderedEmail } from "./layout.ts";

export const EMAIL_CHANGE_SUBJECT = "Подтверждение нового адреса в AXIONA";
export const EMAIL_CHANGED_SUBJECT = "Адрес в AXIONA изменён";

export interface EmailChangeTemplateInput {
  url: string;
  supportEmail: string;
  privacyUrl: string;
  logoUrl: string;
}

/** Подтверждение смены: уходит на НОВЫЙ адрес. */
export function renderEmailChangeEmail(input: EmailChangeTemplateInput): RenderedEmail {
  const url = escapeHtml(input.url);

  const text = [
    "Карта компетенций",
    "",
    "Подтверди новый адрес",
    "",
    "Привет, я Кирилл. Ты попросил сменить почту в AXIONA на этот адрес. Открой ссылку:",
    "",
    input.url,
    "",
    "Ссылка действует 15 минут и работает один раз. Если ты не запрашивал смену — проигнорируй письмо.",
    "",
    `Если что-то пошло не так — напиши мне на ${input.supportEmail}`,
    `Политика конфиденциальности: ${input.privacyUrl}`,
    "",
    "AXIONA",
  ].join("\n");

  const bodyHtml = `                <p style="margin:28px 0 0 0;font-size:16px;line-height:20px;color:#595959;">
                  Ссылка действует 15 минут и работает один раз. Если ты не запрашивал смену — просто проигнорируй письмо.
                </p>`;

  const html = renderEmailLayout({
    title: EMAIL_CHANGE_SUBJECT,
    preheader: "Подтверди новый адрес в AXIONA. Ссылка действует 15 минут и работает один раз.",
    h1: "Подтверди новый адрес",
    lead: "Привет, я Кирилл. Ты попросил сменить почту в AXIONA на этот адрес.",
    button: { href: input.url, label: "Подтвердить адрес" },
    bodyHtml,
    supportEmail: input.supportEmail,
    supportLine: "Если что-то пошло не так — напиши мне на",
    privacyUrl: input.privacyUrl,
    logoUrl: input.logoUrl,
  });

  return { subject: EMAIL_CHANGE_SUBJECT, text, html };
}

export interface EmailChangedNoticeInput {
  appUrl: string;
  newEmail: string;
  supportEmail: string;
  privacyUrl: string;
  logoUrl: string;
}

/** Уведомление на старый email после смены адреса. Старый адрес нигде не храним. */
export function renderEmailChangedNoticeEmail(input: EmailChangedNoticeInput): RenderedEmail {
  const appUrl = input.appUrl.replace(/\/+$/, "");

  const text = [
    "Карта компетенций",
    "",
    "Адрес изменён",
    "",
    `Этот email больше не привязан к аккаунту AXIONA. Новый адрес: ${input.newEmail}.`,
    "",
    "Все сессии завершены, старые ссылки для входа больше не работают.",
    "",
    `Если это сделал не ты — напиши мне на ${input.supportEmail}`,
    `Политика конфиденциальности: ${input.privacyUrl}`,
    "",
    "AXIONA",
  ].join("\n");

  const bodyHtml = `                <p style="margin:28px 0 0 0;font-size:16px;line-height:20px;color:#595959;">
                  Все сессии завершены, старые ссылки для входа больше не работают.
                </p>`;

  const html = renderEmailLayout({
    title: EMAIL_CHANGED_SUBJECT,
    preheader: "Этот email больше не привязан к аккаунту AXIONA.",
    h1: "Адрес изменён",
    lead: `Этот email больше не привязан к аккаунту AXIONA. Новый адрес: ${input.newEmail}.`,
    button: { href: appUrl, label: "Открыть AXIONA" },
    bodyHtml,
    supportEmail: input.supportEmail,
    supportLine: "Если это сделал не ты — напиши мне на",
    privacyUrl: input.privacyUrl,
    logoUrl: input.logoUrl,
  });

  return { subject: EMAIL_CHANGED_SUBJECT, text, html };
}
