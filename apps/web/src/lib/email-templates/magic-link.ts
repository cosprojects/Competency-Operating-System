/**
 * Письмо со ссылкой для входа (magic link) — по макету Figma 409:8828.
 *
 * Шаблон живёт в репозитории: провайдер (Resend/SMTP) только доставляет готовый HTML.
 * Вёрстка — таблицы и инлайн-стили; единственная картинка — логотип с публичного URL.
 */

export interface MagicLinkTemplateInput {
  url: string;
  expiresText: string;
  supportEmail: string;
  privacyUrl: string;
  logoUrl: string;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export const MAGIC_LINK_SUBJECT = "Ссылка для входа в AXIONA";

export function renderMagicLinkEmail(input: MagicLinkTemplateInput): RenderedEmail {
  const url = escapeHtml(input.url);
  const expires = escapeHtml(input.expiresText);
  const support = escapeHtml(input.supportEmail);
  const privacy = escapeHtml(input.privacyUrl);
  const logo = escapeHtml(input.logoUrl);

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

  const html = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(MAGIC_LINK_SUBJECT)}</title>
    <style>
      @media (max-width: 480px) {
        .email-pad { padding: 24px !important; }
        .email-title { font-size: 28px !important; line-height: 34px !important; }
        .email-button { width: 100% !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:#f6f7f9;font-family:Geist,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#132238;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Ссылка для входа в AXIONA. Действует ${expires} и работает один раз.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f6f7f9;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="562" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:562px;background-color:#ffffff;border:1px solid #f2f4f7;border-radius:16px;">
            <tr>
              <td class="email-pad" style="padding:40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td>
                      <img src="${logo}" width="148" height="32" alt="AXIONA" style="display:block;width:148px;max-width:100%;height:auto;border:0;outline:none;" />
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:11px;font-size:16px;line-height:20px;color:#595959;">Карта компетенций</td>
                  </tr>
                </table>

                <h1 class="email-title" style="margin:24px 0 0 0;font-size:32px;line-height:38px;font-weight:700;letter-spacing:-1.19px;color:#132238;">Войти в AXIONA</h1>

                <p style="margin:10px 0 0 0;max-width:442px;font-size:16px;line-height:22px;color:#5f6f85;">
                  Привет, я Кирилл. Ты запрашивал вход в AXIONA. Нажми на кнопку — ссылка откроет карту компетенций.
                </p>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0 0;">
                  <tr>
                    <td align="center" bgcolor="#4f46e5" style="width:252px;border-radius:12px;background-color:#4f46e5;">
                      <a class="email-button" href="${url}" target="_blank" rel="noopener noreferrer" style="display:block;width:252px;padding:13px 0;font-size:20px;line-height:22px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;text-align:center;">Войти</a>
                    </td>
                  </tr>
                </table>

                <p style="margin:28px 0 0 0;font-size:16px;line-height:20px;color:#595959;">
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
                </p>

                <p style="margin:37px 0 0 0;font-size:16px;line-height:20px;color:#595959;">
                  Нужна помощь? Напиши мне на
                  <a href="mailto:${support}" style="color:#4f46e5;text-decoration:underline;">${support}</a>
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
                  <tr>
                    <td align="left" style="font-size:16px;line-height:20px;">
                      <a href="${privacy}" target="_blank" rel="noopener noreferrer" style="color:#595959;text-decoration:underline;">Политика конфиденциальности</a>
                    </td>
                    <td align="right" style="font-size:16px;line-height:20px;color:#595959;">AXIONA</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject: MAGIC_LINK_SUBJECT, text, html };
}
