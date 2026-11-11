import { NextResponse } from "next/server";
import {
  buildPdf,
  csvResponse,
  isoDate,
  pdfResponse,
  toCsv,
} from "@/lib/admin-export";
import { requireApiCapability } from "@/lib/access";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const HEADER = [
  "email",
  "registeredAt",
  "lastSeenAt",
  "favorites",
  "feedback",
  "sourceReviews",
  "sourceViews",
];

/** Выгрузка пользователей для админки: CSV или PDF. */
export async function GET(request: Request) {
  const admin = await requireApiCapability("users:read");
  if (!admin) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const format = new URL(request.url).searchParams.get("format") === "pdf" ? "pdf" : "csv";
  const db = getDb();
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: {
      email: true,
      createdAt: true,
      lastSeenAt: true,
      _count: { select: { favorites: true, feedback: true, sourceReviews: true, sourceViews: true } },
    },
  });

  const today = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const rows: Array<Array<string | number>> = [HEADER];
    for (const user of users) {
      rows.push([
        user.email,
        isoDate(user.createdAt),
        user.lastSeenAt ? isoDate(user.lastSeenAt) : "",
        user._count.favorites,
        user._count.feedback,
        user._count.sourceReviews,
        user._count.sourceViews,
      ]);
    }
    return csvResponse(toCsv(rows), `axiona-users-${today}.csv`);
  }

  const lines = users.map(
    (user) =>
      `${user.email} · рег. ${isoDate(user.createdAt)} · вход ${
        user.lastSeenAt ? isoDate(user.lastSeenAt) : "—"
      } · сохранения ${user._count.favorites} · просмотры ${user._count.sourceViews} · отзывы ${
        user._count.feedback
      } · голоса ${user._count.sourceReviews}`,
  );

  const pdf = await buildPdf({
    title: "Пользователи",
    subtitle: `Выгрузка от ${today} · всего ${users.length}`,
    sections: [{ heading: "Аккаунты", lines }],
  });
  return pdfResponse(pdf, `axiona-users-${today}.pdf`);
}
