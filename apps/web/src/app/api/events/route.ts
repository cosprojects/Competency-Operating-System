import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser, rateLimit, requestIpHash, sameOrigin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  ANON_COOKIE,
  CONSENT_COOKIE,
  eventSchema,
  sanitizeEventProps,
} from "@/lib/validation";

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return new NextResponse(null, { status: 204 });
  }
  const store = await cookies();
  if (store.get(CONSENT_COOKIE)?.value !== "all") {
    return new NextResponse(null, { status: 204 });
  }

  const ipHash = requestIpHash(request);
  if (!rateLimit(`events:${ipHash}`, 300, 60 * 60_000)) {
    return new NextResponse(null, { status: 204 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const parsed = eventSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректное событие" }, { status: 400 });
  }

  const user = await getCurrentUser();
  const existingAnon = store.get(ANON_COOKIE)?.value;
  const anonId = existingAnon ?? randomBytes(16).toString("hex");
  const path = parsed.data.path?.startsWith("/") ? parsed.data.path : undefined;

  const db = getDb();
  await db.analyticsEvent.create({
    data: {
      name: parsed.data.name,
      anonId,
      userId: user?.id ?? null,
      path: path ?? null,
      props: sanitizeEventProps(parsed.data.props) ?? undefined,
    },
  });

  const response = NextResponse.json({ ok: true });
  if (!existingAnon) {
    response.cookies.set(ANON_COOKIE, anonId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 180 * 24 * 60 * 60,
    });
  }
  return response;
}
