import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { consumeLoginToken, publicOrigin, recordAnalyticsConsent, sameOrigin, setSessionCookie } from "@/lib/auth";
import { trackServerEvent } from "@/lib/analytics";
import { sendWelcomeEmail } from "@/lib/email";
import { CONSENT_COOKIE } from "@/lib/validation";

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, publicOrigin(request)), 303);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return redirectTo(request, "/auth/link-invalid");
  }

  const form = await request.formData();
  const token = String(form.get("token") ?? "");

  let result: Awaited<ReturnType<typeof consumeLoginToken>>;
  try {
    result = await consumeLoginToken(token);
  } catch (error) {
    console.error("auth: не удалось подтвердить ссылку", error instanceof Error ? error.message : error);
    return redirectTo(request, "/auth/link-invalid");
  }

  if (!result.ok) {
    return redirectTo(request, "/auth/link-invalid");
  }

  await setSessionCookie(result.sessionToken);

  // Решение по аналитике, принятое до входа, переносим в аккаунт: доказательство согласия.
  const consentDecision = (await cookies()).get(CONSENT_COOKIE)?.value;
  if (consentDecision === "all" || consentDecision === "necessary") {
    await recordAnalyticsConsent(result.userId, consentDecision);
  }

  if (result.isNewUser) {
    // Письмо и событие не должны ломать вход: регистрация уже состоялась.
    try {
      await sendWelcomeEmail({ to: result.email });
    } catch (error) {
      console.error("auth: не удалось отправить welcome-письмо", error instanceof Error ? error.message : error);
    }
    await trackServerEvent({ name: "signup_complete", userId: result.userId });
  }

  const target = result.isNewUser ? "/?welcome=1" : result.returnTo;
  return redirectTo(request, target);
}
