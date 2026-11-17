import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getGuide } from "@/lib/guides";

/** Разбор знания/навыка для модалки (COS-EAR-017). Открыт только после входа. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Нужен вход" }, { status: 401 });
  const itemId = new URL(request.url).searchParams.get("item")?.trim();
  if (!itemId) return NextResponse.json({ error: "Не указан пункт" }, { status: 400 });
  const guide = getGuide(itemId);
  if (!guide) return NextResponse.json({ error: "Разбор пока не готов" }, { status: 404 });
  return NextResponse.json({ guide });
}
