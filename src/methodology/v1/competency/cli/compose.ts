import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import type { CatalogFile, ProfessionProfile, ProfessionRecord } from "../types.ts";
import { dataDir, flagValue, readJson, writeJson } from "./common.ts";
import { loadCatalog } from "../catalog.ts";

interface ProfessionsFile {
  professions: ProfessionRecord[];
}

function renderProfile(profile: ProfessionProfile): string {
  const lines: string[] = [];
  lines.push(`# ${profile.profession.title} — компетенции`);
  lines.push("");
  lines.push(`> domain: ${profile.domain} · \`writesToGraph: false\``);
  lines.push("");
  for (const competency of profile.competencies) {
    lines.push(`## ${competency.title}`);
    lines.push("");
    lines.push(competency.definition);
    lines.push("");
    for (const component of competency.components) {
      lines.push(`### ${component.title}`);
      lines.push("");
      for (const tag of component.tags) {
        lines.push(`- **${tag.title}** (${tag.kind}) — ${tag.definition}${tag.evidenceState === "needs_review" ? " · нужна проверка" : ""}`);
      }
      lines.push("");
    }
    if (competency.materials.length > 0) {
      lines.push("### Материалы");
      lines.push("");
      for (const material of competency.materials) {
        lines.push(`- [${material.title}](${material.url}) — ${material.kind}, ${material.access}`);
      }
      lines.push("");
    }
  }
  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const professionSlug = flagValue(argv, "--profession");
  if (!professionSlug) throw new Error("Нужен --profession (slug из professions-<domain>.json)");
  const professions = await readJson<ProfessionsFile>(
    path.join(dataDir(root), `professions-${domain}.json`),
  );
  const profession = professions.professions.find(
    (item) => item.slug === professionSlug || item.id === professionSlug,
  );
  if (!profession) throw new Error(`Профессия «${professionSlug}» не найдена`);
  const catalog: CatalogFile = await loadCatalog(root, domain);
  const blocks = catalog.blocks.filter((block) => block.professionIds.includes(profession.id));

  const competencies = blocks.map((block) => ({
    competencyId: block.id,
    title: block.title,
    definition: block.definition,
    scope: block.scope,
    components: block.components.map((component) => ({
      componentId: component.id,
      title: component.title,
      tags: component.tagIds
        .map((tagId) => block.tags.find((tag) => tag.id === tagId))
        .filter((tag): tag is NonNullable<typeof tag> => tag !== undefined)
        .map((tag) => ({
          tagId: tag.id,
          title: tag.title,
          kind: tag.kind,
          definition: tag.definition,
          evidenceState: tag.evidenceState,
        })),
    })),
    materials: catalog.materials
      .filter((material) => material.links.some((link) => link.competencyId === block.id))
      .map((material) => ({
        materialId: material.id,
        title: material.title,
        kind: material.kind,
        access: material.access,
        url: material.url,
      })),
  }));

  const profile: ProfessionProfile = {
    profileVersion: "1.0.0",
    writesToGraph: false,
    domain,
    profession,
    competencies,
    stats: {
      competencies: competencies.length,
      components: competencies.reduce((sum, item) => sum + item.components.length, 0),
      tags: competencies.reduce((sum, item) => sum + item.components.reduce((n, c) => n + c.tags.length, 0), 0),
      materials: competencies.reduce((sum, item) => sum + item.materials.length, 0),
      tagsWithoutDefinition: competencies.reduce(
        (sum, item) =>
          sum + item.components.reduce((n, c) => n + c.tags.filter((tag) => !tag.definition).length, 0),
        0,
      ),
    },
  };

  const outDir = path.join(dataDir(root), "profiles");
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, `${domain}-${profession.slug}.json`);
  const mdPath = path.join(outDir, `${domain}-${profession.slug}.md`);
  await writeJson(jsonPath, profile);
  await writeFile(mdPath, renderProfile(profile), "utf8");
  console.log(
    `Профиль ${profession.title}: компетенций ${profile.stats.competencies}, компонентов ${profile.stats.components}, тегов ${profile.stats.tags}, материалов ${profile.stats.materials}`,
  );
  console.log(jsonPath);
  console.log(mdPath);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
