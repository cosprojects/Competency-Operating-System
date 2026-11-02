export interface MagicLinkEmail {
  to: string;
  url: string;
}

export async function sendMagicLink({ to, url }: MagicLinkEmail): Promise<void> {
  const subject = "Вход в AXIONA";
  const text = [
    "Здравствуйте!",
    "",
    "Чтобы войти в AXIONA, откройте ссылку:",
    url,
    "",
    "Ссылка действует 15 минут и работает один раз.",
    "Если вы не запрашивали вход, просто проигнорируйте письмо.",
    "",
    "AXIONA — карта компетенций дизайнера.",
  ].join("\n");
  const html = `<p>Здравствуйте!</p><p>Чтобы войти в AXIONA, откройте ссылку:</p><p><a href="${escapeHtml(url)}">Войти в AXIONA</a></p><p>Ссылка действует 15 минут и работает один раз. Если вы не запрашивали вход, просто проигнорируйте письмо.</p>`;

  const apiUrl = process.env.EMAIL_API_URL;
  const token = process.env.EMAIL_API_TOKEN;
  if (!apiUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("EMAIL_API_URL не настроен: production не может отправлять magic link.");
    }
    console.log(`[axiona:email] to=${to} magic link=${url}`);
    return;
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      to,
      subject,
      text,
      html,
      from: process.env.EMAIL_FROM ?? "no-reply@axiona.world",
    }),
  });
  if (!response.ok) {
    throw new Error(`Email provider error: ${response.status}`);
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
  const apiUrl = process.env.EMAIL_API_URL;
  const token = process.env.EMAIL_API_TOKEN;
  if (!apiUrl) {
    console.log(`[axiona:email] feedback to=${to}\n${text}`);
    return;
  }
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      to,
      subject: "AXIONA: новый отзыв",
      text,
      html,
      from: process.env.EMAIL_FROM ?? "no-reply@axiona.world",
    }),
  });
  if (!response.ok) throw new Error(`Email provider error: ${response.status}`);
}
