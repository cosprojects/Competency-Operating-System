import { NextResponse } from "next/server";
import { deleteCurrentSession, publicOrigin, sameOrigin } from "@/lib/auth";

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Некорректный источник запроса" }, { status: 403 });
  }
  await deleteCurrentSession();
  return NextResponse.redirect(new URL("/", publicOrigin(request)), 303);
}
