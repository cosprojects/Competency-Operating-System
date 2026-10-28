import { NextResponse } from "next/server";
import { deleteCurrentSession, sameOrigin } from "@/lib/auth";

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Некорректный источник запроса" }, { status: 403 });
  }
  await deleteCurrentSession();
  return NextResponse.redirect(new URL("/", request.url), 303);
}
