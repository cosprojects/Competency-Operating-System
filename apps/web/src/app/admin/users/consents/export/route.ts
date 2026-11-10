import { NextResponse } from "next/server";
import { requireApiCapability } from "@/lib/access";
import { getDb } from "@/lib/db";

function csvCell(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

/** Выгрузка согласий: доказательства для запросов субъектов ПДн и проверок РКН. */
export async function GET() {
  const admin = await requireApiCapability("users:read");
  if (!admin) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const db = getDb();
  const rows = await db.consentRecord.findMany({
    orderBy: { grantedAt: "desc" },
    include: { user: { select: { email: true } } },
  });
  const header = ["email", "kind", "version", "grantedAt", "revokedAt"];
  const lines = [header.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.user.email,
        row.kind,
        row.version,
        row.grantedAt.toISOString(),
        row.revokedAt ? row.revokedAt.toISOString() : "",
      ]
        .map(csvCell)
        .join(","),
    );
  }

  return new NextResponse(`\uFEFF${lines.join("\n")}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="axiona-consents-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
