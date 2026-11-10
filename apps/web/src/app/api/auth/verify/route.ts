import { NextResponse } from "next/server";
import { consumeLoginToken, sameOrigin, setSessionCookie } from "@/lib/auth";
import { trackServerEvent } from "@/lib/analytics";
import { sendWelcomeEmail } from "@/lib/email";

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url), 303);
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

  if (result.isNewUser) {
    // Письмо и событие не должны ломать вход: регистрация уже состоялась.
    try {
      await sendWelcomeEmail({ to: result.email });
    } catch (error) {
      console.error("auth: не удалось отправить welcome-письмо", error instanceof Error ? error.message : error);
    }
    await trackServerEvent({ name: "signup_complete", userId: result.userId });
  }

  const target =
    result.isNewUser && result.returnTo === "/saved" ? "/saved?welcome=1" : result.returnTo;
  return redirectTo(request, target);
}
