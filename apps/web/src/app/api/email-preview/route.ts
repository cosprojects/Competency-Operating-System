import { NextResponse } from "next/server";
import { renderEmailChangeEmail, renderEmailChangedNoticeEmail } from "@/lib/email-templates/email-change";
import { renderFeedbackNotificationEmail } from "@/lib/email-templates/feedback";
import { renderMagicLinkEmail } from "@/lib/email-templates/magic-link";
import { renderWelcomeEmail } from "@/lib/email-templates/welcome";

export const dynamic = "force-dynamic";

/**
 * Локальное превью писем (только dev). В production роут не публикуется.
 *   /api/email-preview?template=magic|welcome|email-change|email-changed|feedback
 *   /api/email-preview?template=welcome&format=text
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const template = url.searchParams.get("template") ?? "magic";
  const appUrl = process.env.APP_URL ?? url.origin;
  const supportEmail = process.env.SUPPORT_EMAIL ?? "hi.axiona@protonmail.com";
  const privacyUrl = `${appUrl}/legal/privacy`;
  const logoUrl = `${appUrl}/brand/email-logo.png`;

  let rendered: { subject: string; text: string; html: string };
  if (template === "magic") {
    rendered = renderMagicLinkEmail({
      url: `${appUrl}/auth/verify?token=preview-token`,
      expiresText: "30 дней",
      supportEmail,
      privacyUrl,
      logoUrl,
    });
  } else if (template === "welcome") {
    rendered = renderWelcomeEmail({ appUrl, supportEmail, privacyUrl, logoUrl });
  } else if (template === "email-change") {
    rendered = renderEmailChangeEmail({
      url: `${appUrl}/auth/email-change?token=preview-token`,
      supportEmail,
      privacyUrl,
      logoUrl,
    });
  } else if (template === "email-changed") {
    rendered = renderEmailChangedNoticeEmail({
      appUrl,
      newEmail: "new-address@example.com",
      supportEmail,
      privacyUrl,
      logoUrl,
    });
  } else if (template === "feedback") {
    rendered = renderFeedbackNotificationEmail({
      appUrl,
      privacyUrl,
      logoUrl,
      type: "material",
      rating: 4,
      comment: "Помогло разобраться с сеткой: примеры понятные, но не хватает прототипов.",
      contactEmail: "reader@example.com",
      pagePath: "/professions/uxui",
      targetType: "COMPETENCY",
      targetId: "ux-design-thinking",
    });
  } else {
    return NextResponse.json({ error: "Неизвестный шаблон" }, { status: 404 });
  }

  if (url.searchParams.get("format") === "text") {
    return new NextResponse(rendered.text, {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return new NextResponse(rendered.html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
