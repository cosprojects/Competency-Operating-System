import { NextResponse } from "next/server";
import { getCurrentUser, legalVersion, recordAnalyticsConsent, sameOrigin } from "@/lib/auth";
import { CONSENT_COOKIE } from "@/lib/validation";

const CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

/**
 * Решение по аналитике: cookie для работы баннера + запись в ConsentRecord
 * у вошедшего пользователя. Доказательство согласия/отказа (ч. 3 ст. 9 152-ФЗ).
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Некорректный источник запроса" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const decision = (payload as { decision?: unknown })?.decision;
  if (decision !== "all" && decision !== "necessary") {
    return NextResponse.json({ error: "Неизвестное решение" }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (user) {
    await recordAnalyticsConsent(user.id, decision);
  }

  const response = NextResponse.json({ ok: true, decision, version: legalVersion() });
  response.cookies.set(CONSENT_COOKIE, decision, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CONSENT_MAX_AGE_SECONDS,
  });
  return response;
}
