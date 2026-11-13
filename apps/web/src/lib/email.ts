import nodemailer from "nodemailer";

export interface MagicLinkEmail {
  to: string;
  url: string;
  /** Срок жизни ссылки в тексте письма: 30 дней для входа (настраивается), 7 дней для приглашения. */
  expiresText?: string;
}

export async function sendMagicLink({ to, url, expiresText = "15 минут" }: MagicLinkEmail): Promise<void> {
  const subject = "Ссылка для входа в AXIONA";
  const text = [
    "Привет!",
    "",
    "Это ссылка для входа в AXIONA. Открой её:",
    url,
    "",
    `Ссылка действует ${expiresText} и работает один раз.`,
    "Если ты не запрашивал вход — просто проигнорируй письмо.",
    "",
    "AXIONA — карта компетенций дизайнера.",
  ].join("\n");
  const html = `<p>Привет!</p><p>Это ссылка для входа в AXIONA. Открой её:</p><p><a href="${escapeHtml(url)}">Войти в AXIONA</a></p><p>Ссылка действует ${expiresText} и работает один раз. Если ты не запрашивал вход — просто проигнорируй письмо.</p>`;
  await sendTransactionalEmail({ to, subject, text, html });
}

/** Приветствие после создания аккаунта. Best-effort: сбой письма не ломает вход. */
export async function sendWelcomeEmail({ to }: { to: string }): Promise<void> {
  const appUrl = process.env.APP_URL ?? "https://app.axiona.world";
  const text = [
    "Привет!",
    "",
    "Аккаунт в AXIONA создан. Теперь можно сохранять компетенции и материалы и возвращаться к ним с любого устройства.",
    "",
    `Профессии: ${appUrl}/professions`,
    `Сохранённое: ${appUrl}/saved`,
    "",
    "Если что-то не работает или есть идея — напиши в поддержку: hi.axiona@protonmail.com.",
  ].join("\n");
  const html = `<p>Привет!</p><p>Аккаунт в AXIONA создан. Теперь можно сохранять компетенции и материалы и возвращаться к ним с любого устройства.</p><p><a href="${escapeHtml(appUrl)}/professions">Профессии</a><br/><a href="${escapeHtml(appUrl)}/saved">Сохранённое</a></p><p>Если что-то не работает или есть идея — напиши в поддержку: hi.axiona@protonmail.com.</p>`;
  await sendTransactionalEmail({ to, subject: "Добро пожаловать в AXIONA", text, html });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
  if (process.env.EMAIL_SMTP_HOST) {
    await getSmtpTransporter().sendMail({ from, to, subject, text, html });
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
    body: JSON.stringify({ to, subject, text, html, from }),
  });
  if (!response.ok) throw new Error(`Email provider error: ${response.status}`);
}

/** Подтверждение смены email: уходит на НОВЫЙ адрес (COS-EAR-013). */
export async function sendEmailChangeLink({ to, url }: MagicLinkEmail): Promise<void> {
  const text = [
    "Привет!",
    "",
    "Чтобы сменить почту в AXIONA на этот адрес, открой ссылку:",
    url,
    "",
    "Ссылка действует 15 минут и работает один раз. Если ты не запрашивал смену, просто проигнорируй письмо.",
  ].join("\n");
  const html = `<p>Привет!</p><p>Чтобы сменить почту в AXIONA на этот адрес, открой ссылку:</p><p><a href="${escapeHtml(url)}">Подтвердить новый адрес</a></p><p>Ссылка действует 15 минут и работает один раз.</p>`;
  await sendTransactionalEmail({ to, subject: "Подтверждение нового адреса в AXIONA", text, html });
}

/** Уведомление на старый email после смены адреса (COS-EAR-013). Не хранит старый адрес. */
export async function sendEmailChangedNotice({ to, newEmail }: { to: string; newEmail: string }): Promise<void> {
  const text = [
    "Адрес изменён.",
    "",
    `Этот email больше не привязан к аккаунту AXIONA. Новый адрес: ${newEmail}.`,
    "",
    "Если это сделал не ты — напиши в поддержку: hi.axiona@protonmail.com.",
  ].join("\n");
  const html = `<p>Адрес изменён.</p><p>Этот email больше не привязан к аккаунту AXIONA. Новый адрес: ${escapeHtml(newEmail)}.</p><p>Если это сделал не ты — напиши в поддержку: hi.axiona@protonmail.com.</p>`;
  await sendTransactionalEmail({ to, subject: "Адрес в AXIONA изменён", text, html });
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
  const to = process.env.FEEDBACK_EMAIL ?? "hi.axiona@protonmail.com";
  const lines = [
    `Тип: ${feedback.type}`,
    feedback.rating ? `Оценка полезности: ${feedback.rating}/5` : "",
    feedback.comment ? `Комментарий: ${feedback.comment}` : "",
    feedback.contactEmail ? `Email для ответа: ${feedback.contactEmail}` : "",
    feedback.targetType && feedback.targetId ? `Объект: ${feedback.targetType} ${feedback.targetId}` : "",
    `Страница: ${feedback.pagePath}`,
  ].filter(Boolean);
  const text = lines.join("\n");
  const html = lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
  await sendTransactionalEmail({ to, subject: "AXIONA: новый отзыв", text, html });
}
