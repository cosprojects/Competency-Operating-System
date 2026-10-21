import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FetchLike } from "../candidate-parser/types.ts";
import type { MethodologistGraph, MethodologistProfession } from "../methodologist/decide.ts";
import { buildProfile } from "./build.ts";
import { renderProfileMarkdown } from "./render.ts";
import type {
  MappingFile,
  ProfileEntry,
  ProfileReviewFile,
  TaxonomyFile,
} from "./types.ts";

interface CatalogFile {
  professions: Array<{ id: string; title: string; status: string }>;
}

function flagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) return undefined;
  return value;
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function needsHumanReview(entry: ProfileEntry): boolean {
  if (entry.needsReview || entry.sourceError || entry.description.length === 0) return true;
  return entry.nodeMatch?.outcome === "needs_node" || entry.nodeMatch?.outcome === "ambiguous";
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const professionId = flagValue(argv, "--profession") ?? "uxui";
  const refresh = argv.includes("--refresh");
  const noCache = argv.includes("--no-cache");
  const root = process.cwd();

  const taxonomyPath = path.join(
    root,
    "src/methodology/v1/profile/taxonomy",
    `${professionId}.json`,
  );
  const mappingPath = path.join(
    root,
    "src/methodology/v1/profile/mapping",
    `${professionId}.json`,
  );
  const graphPath = path.join(root, "src/methodology/v1/design-competency-graph.json");
  const catalogPath = path.join(root, "src/methodology/v1/profession-catalog.json");

  const taxonomy = await readJson<TaxonomyFile>(taxonomyPath);
  const mapping = await readJson<MappingFile>(mappingPath);
  const graph = await readJson<MethodologistGraph>(graphPath);
  const catalog = await readJson<CatalogFile>(catalogPath);

  const profession = catalog.professions.find((item) => item.id === professionId);
  if (!profession) {
    throw new Error(`${professionId}: карточки в каталоге профессий нет`);
  }

  const fetchImpl: FetchLike = (input, init) => fetch(input, init);
  const generatedOn = new Date().toISOString().slice(0, 10);
  const outDir = path.join(root, "data/profile");

  const journal = await buildProfile({
    professionId,
    taxonomy,
    mapping,
    graph,
    professions: catalog.professions satisfies MethodologistProfession[],
    fetchImpl,
    generatedOn,
    ...(noCache
      ? {}
      : { cache: { dir: path.join(outDir, "esco-cache"), refresh } }),
  });

  const review: ProfileReviewFile = {
    reviewVersion: "1.0.0",
    writesToGraph: false,
    professionId,
    generatedOn,
    note: "Записи, которым нужен человек: нет описания, неоднозначное соответствие графу или новый узел. В граф ничего не переносится автоматически.",
    entries: journal.entries.filter(needsHumanReview),
    unmapped: journal.unmapped,
    gaps: journal.gaps,
    mappingMissing: journal.mappingMissing,
  };

  await mkdir(outDir, { recursive: true });
  const profilePath = path.join(outDir, `${professionId}.json`);
  const markdownPath = path.join(outDir, `${professionId}.md`);
  const reviewPath = path.join(outDir, `${professionId}-review.json`);
  await writeFile(profilePath, `${JSON.stringify(journal, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, renderProfileMarkdown(journal), "utf8");
  await writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8");

  const outcomes = Object.entries(journal.graphFit.counts)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");

  console.log(`Профиль: ${professionId} (${journal.professionTitle})`);
  console.log(
    `Источники: ${journal.stats.sourceOccupations} занятий, ${journal.stats.uniqueSkills} уникальных навыков ESCO`,
  );
  console.log(
    `Дерево: сопоставлено ${journal.stats.mapped}, вне области ${journal.stats.outOfScope}, не сопоставлено ${journal.stats.unmapped}`,
  );
  console.log(
    `Листья: ${journal.stats.leavesSupported}/${journal.stats.leavesTotal}; группы: ${journal.stats.groupsSupported}/${journal.stats.groupsTotal}`,
  );
  console.log(`Граф COS: ${outcomes}`);
  if (journal.gaps.length > 0) {
    console.log(`Пробелы (${journal.gaps.length}): ${journal.gaps.map((gap) => gap.title).join(", ")}`);
  }
  if (journal.mappingMissing.length > 0) {
    console.log(
      `Правила без источника (${journal.mappingMissing.length}): ${journal.mappingMissing.map((item) => item.escoTitle).join(", ")}`,
    );
  }
  console.log(`Записываю: ${profilePath}`);
  console.log(`Записываю: ${markdownPath}`);
  console.log(`Записываю: ${reviewPath}`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
