import nodemailer from "nodemailer";
import { renderEmailChangeEmail, renderEmailChangedNoticeEmail } from "./email-templates/email-change";
import { renderFeedbackNotificationEmail } from "./email-templates/feedback";
import { renderMagicLinkEmail } from "./email-templates/magic-link";
import { renderWelcomeEmail } from "./email-templates/welcome";

export interface MagicLinkEmail {
  to: string;
  url: string;
  /** Срок жизни ссылки в тексте письма: 30 дней для входа (настраивается), 7 дней для приглашения. */
  expiresText?: string;
}

export async function sendMagicLink({ to, url, expiresText = "15 минут" }: MagicLinkEmail): Promise<void> {
  const appUrl = process.env.APP_URL ?? "https://app.axiona.world";
  const supportEmail = process.env.SUPPORT_EMAIL ?? "hi.axiona@protonmail.com";
  const { subject, text, html } = renderMagicLinkEmail({
    url,
    expiresText,
    supportEmail,
    privacyUrl: `${appUrl}/legal/privacy`,
    logoUrl: `${appUrl}/brand/email-logo.png`,
  });
  await sendTransactionalEmail({ to, subject, text, html });
}

/** Приветствие после создания аккаунта. Best-effort: сбой письма не ломает вход. */
export async function sendWelcomeEmail({ to }: { to: string }): Promise<void> {
  const appUrl = process.env.APP_URL ?? "https://app.axiona.world";
  const supportEmail = process.env.SUPPORT_EMAIL ?? "hi.axiona@protonmail.com";
  const { subject, text, html } = renderWelcomeEmail({
    appUrl,
    supportEmail,
    privacyUrl: `${appUrl}/legal/privacy`,
    logoUrl: `${appUrl}/brand/email-logo.png`,
  });
  await sendTransactionalEmail({ to, subject, text, html });
}

interface TransactionalEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

let smtpTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getSmtpTransporter(): ReturnType<typeof nodemailer.createTransport> {
  if (smtpTransporter) return smtpTransporter;
  const host = process.env.EMAIL_SMTP_HOST;
  const user = process.env.EMAIL_SMTP_USER;
  const pass = process.env.EMAIL_SMTP_PASSWORD;
  if (!host || !user || !pass) {
    throw new Error("EMAIL_SMTP_HOST/USER/PASSWORD не настроены.");
  }
  smtpTransporter = nodemailer.createTransport({
    host,
    port: Number(process.env.EMAIL_SMTP_PORT ?? 465),
    secure: process.env.EMAIL_SMTP_SECURE !== "false",
    auth: { user, pass },
  });
  return smtpTransporter;
}

/**
 * Общая отправка письма.
 * Приоритет: SMTP (например, Yandex) → HTTP API (Resend) → console в dev.
 */
async function sendTransactionalEmail({ to, subject, text, html }: TransactionalEmail): Promise<void> {
  const from = process.env.EMAIL_FROM ?? "no-reply@axiona.world";
  // Ответ на письмо должен попадать в живой ящик, а не в no-reply: так человек может написать.
  const replyTo = process.env.SUPPORT_EMAIL;
  if (process.env.EMAIL_SMTP_HOST) {
    await getSmtpTransporter().sendMail({
      from,
      to,
      subject,
      text,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    console.info("[axiona:email] sent via smtp");
    return;
  }

  const apiUrl = process.env.EMAIL_API_URL;
  const token = process.env.EMAIL_API_TOKEN;
  if (!apiUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("EMAIL_API_URL/EMAIL_SMTP_HOST не настроены: production не может отправлять письма.");
    }
    console.log(`[axiona:email] to=${to} subject=${subject}\n${text}`);
    return;
  }
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  if (!response.ok) {
    // Тело ответа провайдера — единственный способ понять причину отказа (домен, адрес, лимит).
    const detail = await response.text().catch(() => "");
    throw new Error(`Email provider error: ${response.status}${detail ? ` — ${detail.slice(0, 300)}` : ""}`);
  }
  console.info("[axiona:email] sent via http api");
}

/** Подтверждение смены email: уходит на НОВЫЙ адрес (COS-EAR-013). */
export async function sendEmailChangeLink({ to, url }: MagicLinkEmail): Promise<void> {
  const appUrl = process.env.APP_URL ?? "https://app.axiona.world";
  const supportEmail = process.env.SUPPORT_EMAIL ?? "hi.axiona@protonmail.com";
  const { subject, text, html } = renderEmailChangeEmail({
    url,
    supportEmail,
    privacyUrl: `${appUrl}/legal/privacy`,
    logoUrl: `${appUrl}/brand/email-logo.png`,
  });
  await sendTransactionalEmail({ to, subject, text, html });
}

/** Уведомление на старый email после смены адреса (COS-EAR-013). Не хранит старый адрес. */
export async function sendEmailChangedNotice({ to, newEmail }: { to: string; newEmail: string }): Promise<void> {
  const appUrl = process.env.APP_URL ?? "https://app.axiona.world";
  const supportEmail = process.env.SUPPORT_EMAIL ?? "hi.axiona@protonmail.com";
  const { subject, text, html } = renderEmailChangedNoticeEmail({
    appUrl,
    newEmail,
    supportEmail,
    privacyUrl: `${appUrl}/legal/privacy`,
    logoUrl: `${appUrl}/brand/email-logo.png`,
  });
  await sendTransactionalEmail({ to, subject, text, html });
}

export interface FeedbackNotification {
  type: string;
  comment?: string;
  rating?: number;
  contactEmail?: string;
  pagePath: string;
  targetType?: string;
  targetId?: string;
}

/**
 * Уведомление о новом отзыве на почтовый ящик команды.
 * Best-effort: отзыв уже сохранён в БД, доставка письма не должна ломать ответ.
 */
export async function sendFeedbackNotification(feedback: FeedbackNotification): Promise<void> {
  const appUrl = process.env.APP_URL ?? "https://app.axiona.world";
  const to = process.env.FEEDBACK_EMAIL ?? "hi.axiona@protonmail.com";
  const { subject, text, html } = renderFeedbackNotificationEmail({
    appUrl,
    privacyUrl: `${appUrl}/legal/privacy`,
    logoUrl: `${appUrl}/brand/email-logo.png`,
    ...feedback,
  });
  await sendTransactionalEmail({ to, subject, text, html });
}
