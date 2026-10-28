import { NextResponse } from "next/server";
import { consumeLoginToken, sameOrigin, setSessionCookie } from "@/lib/auth";
import { trackServerEvent } from "@/lib/analytics";

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.redirect(new URL("/login?error=origin", request.url), 303);
  }

  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const result = await consumeLoginToken(token);
  if (!result) {
    return NextResponse.redirect(new URL("/login?error=link", request.url), 303);
  }

  await setSessionCookie(result.sessionToken);
  await trackServerEvent({ name: "signup_complete", userId: result.userId });
  return NextResponse.redirect(new URL(result.returnTo, request.url), 303);
}
