/**
 * Приветственное письмо после создания аккаунта.
 *
 * Каркас и вёрстка — как у письма со ссылкой входа (`layout.ts`): белая карточка,
 * логотип, заголовок, кнопка действия и подвал. Отправляется best-effort: сбой
 * доставки не ломает вход.
 */

import { escapeHtml, renderEmailLayout } from "./layout.ts";
import type { RenderedEmail } from "./layout.ts";

export interface WelcomeTemplateInput {
  appUrl: string;
  supportEmail: string;
  privacyUrl: string;
  logoUrl: string;
}

export const WELCOME_SUBJECT = "Аккаунт в AXIONA создан";

export function renderWelcomeEmail(input: WelcomeTemplateInput): RenderedEmail {
  const appUrl = input.appUrl.replace(/\/+$/, "");
  const professionsUrl = `${appUrl}/professions`;
  const savedUrl = `${appUrl}/saved`;

  const text = [
    "Карта компетенций",
    "",
    "Аккаунт в AXIONA создан",
    "",
    "Привет, я Кирилл. Теперь можно сохранять компетенции и материалы и возвращаться к ним с любого устройства.",
    "",
    `Выбрать профессию: ${professionsUrl}`,
    "",
    `Сохранённое: ${savedUrl}`,
    "",
    `Если что-то не работает или есть идея — напиши мне на ${input.supportEmail}`,
    `Политика конфиденциальности: ${input.privacyUrl}`,
    "",
    "AXIONA",
  ].join("\n");

  const bodyHtml = `                <p style="margin:28px 0 0 0;font-size:16px;line-height:20px;color:#595959;">
                  Компетенции и материалы, которые ты сохранишь, появятся в разделе
                  <a href="${escapeHtml(savedUrl)}" target="_blank" rel="noopener noreferrer" style="color:#4f46e5;text-decoration:underline;">«Сохранённое»</a>.
                </p>`;

  const html = renderEmailLayout({
    title: WELCOME_SUBJECT,
    preheader:
      "Аккаунт в AXIONA создан. Теперь можно сохранять компетенции и материалы и возвращаться к ним с любого устройства.",
    h1: "Аккаунт в AXIONA создан",
    lead: "Привет, я Кирилл. Теперь можно сохранять компетенции и материалы и возвращаться к ним с любого устройства.",
    button: { href: professionsUrl, label: "Выбрать профессию" },
    bodyHtml,
    supportEmail: input.supportEmail,
    supportLine: "Если что-то не работает или есть идея — напиши мне на",
    privacyUrl: input.privacyUrl,
    logoUrl: input.logoUrl,
  });

  return { subject: WELCOME_SUBJECT, text, html };
}
