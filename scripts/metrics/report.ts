import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function flag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const days = Number(flag(argv, "--days") ?? 30);
  const since = new Date(Date.now() - (Number.isFinite(days) ? days : 30) * 86_400_000);
  const [users, favorites, statuses, feedbackTotal, events, feedbackGroups] = await Promise.all([
    db.user.findMany({ select: { id: true, createdAt: true } }),
    db.favorite.count(),
    db.studyStatus.count(),
    db.feedback.count(),
    db.analyticsEvent.findMany({
      where: { createdAt: { gte: since } },
      select: { name: true, anonId: true, userId: true, createdAt: true },
    }),
    db.feedback.groupBy({ by: ["type"], _count: { _all: true } }),
  ]);

  const visitors = new Set(events.map((event) => event.anonId).filter(Boolean));
  const competencyUsers = new Set(
    events
      .filter((event) => event.name === "competency_view")
      .map((event) => event.userId ?? event.anonId)
      .filter(Boolean),
  );
  const sourceUsers = new Set(
    events
      .filter((event) => event.name === "source_click")
      .map((event) => event.userId ?? event.anonId)
      .filter(Boolean),
  );
  const favoriteUsers = new Set(
    events
      .filter((event) => event.name === "favorite_add")
      .map((event) => event.userId)
      .filter(Boolean),
  );
  const sevenDaysAgo = Date.now() - 7 * 86_400_000;
  const eligibleForReturn = users.filter((user) => user.createdAt.getTime() <= sevenDaysAgo);
  const returned = new Set(
    events
      .filter((event) => event.userId && event.createdAt.getTime() >= sevenDaysAgo)
      .map((event) => event.userId)
      .filter(Boolean),
  );
  const returnUsers = eligibleForReturn.filter((user) => returned.has(user.id));
  const counts = new Map<string, number>();
  for (const event of events) counts.set(event.name, (counts.get(event.name) ?? 0) + 1);

  const lines = [
    "# AXIONA Beta metrics",
    "",
    `Период событий: с ${isoDate(since)} по ${isoDate(new Date())}. Размер выборки мал; это ориентиры.`,
    "",
    "| Метрика | Значение | Знаменатель |",
    "|---|---:|---|",
    `| Пользователи всего | ${users.length} | — |`,
    `| Посетители с событиями | ${visitors.size} | — |`,
    `| Открыли компетенцию | ${competencyUsers.size} | посетители |`,
    `| Открыли материал | ${sourceUsers.size} | зарегистрированные |`,
    `| Сохраняли | ${favoriteUsers.size} | зарегистрированные |`,
    `| 7-дневный возврат | ${returnUsers.length} | ${eligibleForReturn.length} |`,
    `| Сохранения всего | ${favorites} | — |`,
    `| Статусы всего | ${statuses} | — |`,
    `| Отзывы всего | ${feedbackTotal} | — |`,
    "",
    "## События",
    "",
    "| Событие | Количество |",
    "|---|---:|",
    ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => `| \`${name}\` | ${count} |`),
    "",
    "## Отзывы по типам",
    "",
    "| Тип | Количество |",
    "|---|---:|",
    ...feedbackGroups.map((group) => `| \`${group.type}\` | ${group._count._all} |`),
    "",
  ];
  const output = `${lines.join("\n")}\n`;
  console.log(output);
  if (argv.includes("--write")) {
    const dir = path.join(process.cwd(), "docs/12-release/reports");
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `metrics-${isoDate(new Date())}.md`);
    await writeFile(file, output, "utf8");
    console.log(`written: ${file}`);
  }
}

await main().finally(async () => {
  await db.$disconnect();
});
