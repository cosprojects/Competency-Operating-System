import { NextResponse } from "next/server";
import { renderMagicLinkEmail } from "@/lib/email-templates/magic-link";
import { renderWelcomeEmail } from "@/lib/email-templates/welcome";

export const dynamic = "force-dynamic";

/**
 * Локальное превью писем (только dev). В production роут не публикуется.
 *   /api/email-preview?template=magic
 *   /api/email-preview?template=welcome
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

  let rendered: { subject: string; text: string; html: string };
  if (template === "magic") {
    rendered = renderMagicLinkEmail({
      url: `${appUrl}/auth/verify?token=preview-token`,
      expiresText: "30 дней",
      supportEmail,
      privacyUrl: `${appUrl}/legal/privacy`,
      logoUrl: `${appUrl}/brand/email-logo.png`,
    });
  } else if (template === "welcome") {
    rendered = renderWelcomeEmail({
      appUrl,
      supportEmail,
      privacyUrl: `${appUrl}/legal/privacy`,
      logoUrl: `${appUrl}/brand/email-logo.png`,
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
