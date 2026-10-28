import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { CompetenciesFile } from "../../src/methodology/v1/competency/model/types.ts";
import type { ProfessionCompetencyFile } from "../../src/methodology/v1/competency/model/types.ts";
import type { LearningSourceRegistry } from "../../src/methodology/v1/learning-sources/types.ts";
import type { ReleaseManifest } from "./lib.ts";

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function main(): Promise<void> {
  const root = process.cwd();
  const manifest = await readJson<ReleaseManifest>(path.join(root, "release/beta-1.json"));
  const competencies = await readJson<CompetenciesFile>(
    path.join(root, "src/methodology/v1/competency/model/competencies.json"),
  );
  const registry = await readJson<LearningSourceRegistry>(
    path.join(root, "src/methodology/v1/learning-sources/registry.json"),
  );
  const compById = new Map(competencies.competencies.map((item) => [item.id, item]));
  const sourceById = new Map(registry.sources.map((item) => [item.id, item]));
  const pairs = new Map<string, { competencyId: string; sourceId: string; professions: Set<string> }>();
  for (const professionId of manifest.professionIds) {
    const slug = professionId.split(".").at(-1) ?? professionId;
    const file = await readJson<ProfessionCompetencyFile>(
      path.join(root, "src/methodology/v1/competency/model/profession-competencies", `${slug}.json`),
    );
    for (const professionCompetency of file.competencies) {
      const competency = compById.get(professionCompetency.competencyId);
      if (!competency) continue;
      const excluded = (manifest.excludedCompetencyPrefixes ?? []).some((prefix) =>
        competency.id.startsWith(prefix),
      );
      if (excluded) continue;
      for (const sourceId of competency.learningSourceIds ?? []) {
        const key = `${competency.id}|${sourceId}`;
        const pair = pairs.get(key) ?? {
          competencyId: competency.id,
          sourceId,
          professions: new Set<string>(),
        };
        pair.professions.add(professionId);
        pairs.set(key, pair);
      }
    }
  }

  const lines: string[] = [
    "# Beta 1 — source review checklist",
    "",
    "Заполнить решения в `release/beta-1-source-review.json` (accepted / replaced / excluded + причина). Это не автоматическая приёмка.",
    "",
    "Правило Beta: активный источник, не агрегатор, не `discoveryOnly`; `primary` предпочтителен. `summary` обязателен.",
    "",
    "Решение можно дать один раз на пару «компетенция–источник»: `professionId` не указывать или поставить `*`. Профессиональное переопределение — только если нужно.",
    "",
    `Уникальных пар: ${pairs.size}.`,
    "",
    "| Компетенция | Источник | Authority | Status | Summary | Профессии | Решение |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const pair of [...pairs.values()].sort(
    (a, b) => a.competencyId.localeCompare(b.competencyId) || a.sourceId.localeCompare(b.sourceId),
  )) {
    const source = sourceById.get(pair.sourceId);
    lines.push(
      `| \`${pair.competencyId}\` | \`${pair.sourceId}\`${source ? ` — ${source.title}` : ""} | ${source?.authority ?? "?"} | ${source?.status ?? "?"} | ${source?.summary ? "есть" : "нет"} | ${[...pair.professions].join(", ")} |  |`,
    );
  }
  lines.push("");

  const dir = path.join(root, "docs/12-release/reports");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, "beta-1-source-review-checklist.md");
  await writeFile(file, `${lines.join("\n")}\n`, "utf8");
  console.log(`written: ${file}`);
}

await main();
