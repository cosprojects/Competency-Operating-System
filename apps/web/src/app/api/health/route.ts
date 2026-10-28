import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    await getDb().$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      service: "axiona-web",
      release: process.env.RELEASE_ID ?? "beta-1",
      db: "ok",
      time: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        service: "axiona-web",
        release: process.env.RELEASE_ID ?? "beta-1",
        db: "unavailable",
        time: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
