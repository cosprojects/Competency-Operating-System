import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { LearningSourceRecord, LearningSourceRegistry } from "../types.ts";
import { checkRobots, USER_AGENT } from "../robots.ts";
import { extractTopicCandidates } from "../topics.ts";

interface TopicsJournalSource {
  sourceId: string;
  title: string;
  url: string;
  status: "extracted" | "skipped";
  reason?: string;
  topics: string[];
}

async function readCachedText(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return undefined;
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const index = argv.indexOf(name);
    const value = argv[index + 1];
    return index >= 0 && value && !value.startsWith("--") ? value : undefined;
  };
  const root = process.cwd();
  const registry = JSON.parse(
    await readFile(path.join(root, "src/methodology/v1/learning-sources/registry.json"), "utf8"),
  ) as LearningSourceRegistry;
  const profession = flag("--profession");
  const sourceId = flag("--source");
  const limit = Number(flag("--limit") ?? 10);
  const robotsDir = path.join(root, "data/learning-sources/robots");

  const selected = registry.sources
    .filter((source) => source.status === "active" && !source.discoveryOnly && !source.duplicateOf)
    .filter((source) => (sourceId ? source.id === sourceId : true))
    .filter((source) => (profession ? source.professionIds.includes(`it.${profession}`) || source.professionIds.includes(profession) : true))
    .slice(0, limit);

  if (selected.length === 0) throw new Error("Нет подходящих активных источников для извлечения тем");
  if (argv.includes("--dry-run")) {
    console.log(`dry-run: источников ${selected.length}`);
    for (const source of selected) console.log(`  ${source.id} — ${source.url}`);
    return;
  }

  await mkdir(robotsDir, { recursive: true });
  const results: TopicsJournalSource[] = [];
  for (const source of selected) {
    const decision = await checkRobots(
      async (input, init) => fetch(input, init as RequestInit),
      source.url,
      {
        get: (key) => readCachedText(path.join(robotsDir, `${new URL(key).hostname}.txt`)),
        set: async (key, value) => writeFile(path.join(robotsDir, `${new URL(key).hostname}.txt`), value, "utf8"),
      },
    );
    if (!decision.allowed) {
      results.push({ sourceId: source.id, title: source.title, url: source.url, status: "skipped", reason: decision.reason, topics: [] });
      continue;
    }
    try {
      const response = await fetch(source.url, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        results.push({ sourceId: source.id, title: source.title, url: source.url, status: "skipped", reason: `HTTP ${response.status}`, topics: [] });
        continue;
      }
      const html = await response.text();
      const topics = extractTopicCandidates(html);
      results.push({
        sourceId: source.id,
        title: source.title,
        url: source.url,
        status: topics.length > 0 ? "extracted" : "skipped",
        ...(topics.length === 0 ? { reason: "темы не найдены в HTML" } : {}),
        topics,
      });
    } catch (error) {
      results.push({
        sourceId: source.id,
        title: source.title,
        url: source.url,
        status: "skipped",
        reason: error instanceof Error ? error.message : "ошибка загрузки",
        topics: [],
      });
    }
  }

  const extracted = results.filter((item) => item.status === "extracted");
  const journal = {
    journalVersion: "1.0.0",
    generatedOn: new Date().toISOString().slice(0, 10),
    writesToGraph: false as const,
    scope: profession ?? sourceId ?? "all",
    note: "Извлекаются только короткие заголовки/пункты списков; полные тексты и описания не сохраняются. Кандидаты не попадают в реестр автоматически.",
    sources: results,
    stats: {
      sources: results.length,
      extracted: extracted.length,
      skipped: results.length - extracted.length,
      topics: extracted.reduce((sum, item) => sum + item.topics.length, 0),
    },
  };
  const suffix = profession ?? sourceId ?? "all";
  const output = path.join(root, "data/learning-sources", `topics-${suffix}-${journal.generatedOn}.json`);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(journal, null, 2)}\n`, "utf8");
  console.log(
    `learning topics: источников ${journal.stats.sources}; извлечено ${journal.stats.extracted}; пропущено ${journal.stats.skipped}; тем ${journal.stats.topics}`,
  );
  for (const item of results) {
    if (item.status === "extracted") console.log(`  ${item.sourceId}: тем ${item.topics.length}`);
    else console.log(`  ${item.sourceId}: skipped — ${item.reason}`);
  }
  console.log(output);

  if (argv.includes("--report")) {
    const lines = [
      `# Тематические блоки источников — ${journal.scope}`,
      "",
      `Источников: ${journal.stats.sources}; извлечено: ${journal.stats.extracted}; тем: ${journal.stats.topics}.`,
      "",
      "> Извлекаются только короткие заголовки и пункты списков. Полные тексты не копируются.",
      "",
    ];
    for (const item of extracted) {
      lines.push(`## ${item.title}`, "", item.topics.map((topic) => `- ${topic}`).join("\n"), "");
    }
    for (const item of results.filter((result) => result.status === "skipped")) {
      lines.push(`- ${item.sourceId}: skipped — ${item.reason}`);
    }
    const report = path.join(root, "data/learning-sources", `topics-${suffix}-${journal.generatedOn}.md`);
    await writeFile(report, `${lines.join("\n")}\n`, "utf8");
    console.log(report);
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
