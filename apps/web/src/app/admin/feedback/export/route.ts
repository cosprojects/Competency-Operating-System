import { NextResponse } from "next/server";
import { getAdminOrNull } from "@/lib/admin";
import { getDb } from "@/lib/db";

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const db = getDb();
  const items = await db.feedback.findMany({ orderBy: { createdAt: "desc" } });
  const header = [
    "id",
    "createdAt",
    "type",
    "status",
    "targetType",
    "targetId",
    "rating",
    "comment",
    "contactEmail",
    "pagePath",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const item of items) {
    lines.push(
      [
        item.id,
        item.createdAt.toISOString(),
        item.type,
        item.status,
        item.targetType,
        item.targetId,
        item.rating,
        item.comment,
        item.contactEmail,
        item.pagePath,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return new NextResponse(`${lines.join("\n")}\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="axiona-feedback.csv"',
    },
  });
}
