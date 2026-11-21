/**
 * Общий каркас писем AXIONA: белая карточка на светлом фоне, логотип, заголовок,
 * основное действие кнопкой и подвал. Вёрстка — таблицы и инлайн-стили, чтобы
 * письмо одинаково собиралось в Gmail, Яндекс Почте и Mail.ru.
 *
 * Шаблоны (`magic-link`, `welcome`) задают только содержание и передают готовый
 * `bodyHtml`; каркас отвечает за рамку, кнопку и подвал.
 */

export interface EmailLayoutInput {
  /** Заголовок документа (он же subject письма). */
  title: string;
  /** Скрытая строка-превью в списке писем. */
  preheader: string;
  h1: string;
  lead: string;
  button: { href: string; label: string };
  /** Блоки под кнопкой: уже экранированный HTML с инлайн-стилями. */
  bodyHtml: string;
  supportEmail: string;
  /** Фраза перед адресом поддержки, например «Нужна помощь? Напиши мне на». */
  supportLine: string;
  privacyUrl: string;
  logoUrl: string;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderEmailLayout(input: EmailLayoutInput): string {
  const title = escapeHtml(input.title);
  const preheader = escapeHtml(input.preheader);
  const h1 = escapeHtml(input.h1);
  const lead = escapeHtml(input.lead);
  const buttonHref = escapeHtml(input.button.href);
  const buttonLabel = escapeHtml(input.button.label);
  const support = escapeHtml(input.supportEmail);
  const supportLine = escapeHtml(input.supportLine);
  const privacy = escapeHtml(input.privacyUrl);
  const logo = escapeHtml(input.logoUrl);

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${title}</title>
    <style>
      @media (max-width: 480px) {
        .email-pad { padding: 24px !important; }
        .email-title { font-size: 28px !important; line-height: 34px !important; }
        .email-button { width: 100% !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:#f6f7f9;font-family:Geist,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#132238;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
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

                <h1 class="email-title" style="margin:24px 0 0 0;font-size:32px;line-height:38px;font-weight:700;letter-spacing:-1.19px;color:#132238;">${h1}</h1>

                <p style="margin:10px 0 0 0;max-width:442px;font-size:16px;line-height:22px;color:#5f6f85;">
                  ${lead}
                </p>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0 0;">
                  <tr>
                    <td align="center" bgcolor="#4f46e5" style="width:252px;border-radius:12px;background-color:#4f46e5;">
                      <a class="email-button" href="${buttonHref}" target="_blank" rel="noopener noreferrer" style="display:block;width:252px;padding:13px 0;font-size:20px;line-height:22px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;text-align:center;">${buttonLabel}</a>
                    </td>
                  </tr>
                </table>

${input.bodyHtml}

                <p style="margin:37px 0 0 0;font-size:16px;line-height:20px;color:#595959;">
                  ${supportLine}
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
}
