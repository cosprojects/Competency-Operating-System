/**
 * Письмо со ссылкой для входа (magic link) — по макету Figma 409:8828.
 *
 * Каркас и вёрстка — в `layout.ts`; здесь только содержание письма.
 * Провайдер (Resend/SMTP) доставляет готовый HTML.
 */

import { escapeHtml, renderEmailLayout } from "./layout.ts";
import type { RenderedEmail } from "./layout.ts";

export type { RenderedEmail } from "./layout.ts";

export interface MagicLinkTemplateInput {
  url: string;
  expiresText: string;
  supportEmail: string;
  privacyUrl: string;
  logoUrl: string;
}

export const MAGIC_LINK_SUBJECT = "Ссылка для входа в AXIONA";

export function renderMagicLinkEmail(input: MagicLinkTemplateInput): RenderedEmail {
  const url = escapeHtml(input.url);
  const expires = escapeHtml(input.expiresText);

  const text = [
    "Карта компетенций",
    "",
    "Войти в AXIONA",
    "",
    "Привет, я Кирилл. Ты запрашивал вход в AXIONA. Нажми на кнопку — ссылка откроет карту компетенций.",
    "",
    input.url,
    "",
    `Ссылка действует ${input.expiresText} и работает один раз.`,
    "",
    `Если ты не запрашивал вход — проигнорируй письмо.`,
    "",
    `Нужна помощь? Напиши мне на ${input.supportEmail}`,
    `Политика конфиденциальности: ${input.privacyUrl}`,
    "",
    "AXIONA",
  ].join("\n");

  const bodyHtml = `                <p style="margin:28px 0 0 0;font-size:16px;line-height:20px;color:#595959;">
                  Ссылка действует ${expires} и работает один раз.
                </p>

                <p style="margin:27px 0 0 0;font-size:16px;line-height:20px;color:#595959;">
                  Если кнопка не открылась, нажми на эту ссылку:
                </p>

                <p style="margin:11px 0 0 0;font-size:16px;line-height:20px;">
                  <a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#4f46e5;text-decoration:underline;word-break:break-all;">${url}</a>
                </p>

                <p style="margin:27px 0 0 0;max-width:359px;font-size:14px;line-height:21px;color:#8a99ad;">
                  Если ты не запрашивал вход — просто проигнорируй письмо.
                </p>`;

  const html = renderEmailLayout({
    title: MAGIC_LINK_SUBJECT,
    preheader: `Ссылка для входа в AXIONA. Действует ${expires} и работает один раз.`,
    h1: "Войти в AXIONA",
    lead: "Привет, я Кирилл. Ты запрашивал вход в AXIONA. Нажми на кнопку — ссылка откроет карту компетенций.",
    button: { href: input.url, label: "Войти" },
    bodyHtml,
    supportEmail: input.supportEmail,
    supportLine: "Нужна помощь? Напиши мне на",
    privacyUrl: input.privacyUrl,
    logoUrl: input.logoUrl,
  });

  return { subject: MAGIC_LINK_SUBJECT, text, html };
}
