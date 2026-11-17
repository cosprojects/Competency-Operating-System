import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Текущий статус входа для клиентских элементов оболочки. */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ authed: Boolean(user) });
}
