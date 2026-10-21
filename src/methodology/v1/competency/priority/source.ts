import path from "node:path";
import type { CompetencyBlock } from "../types.ts";
import { loadCatalog } from "../catalog.ts";
import { dataDir, readJson } from "../cli/common.ts";

export type PriorityBlockSource = "catalog" | "review";

export interface ResolvedPriorityBlocks {
  source: PriorityBlockSource;
  files: string[];
  blocks: CompetencyBlock[];
}

export function professionIdOf(domain: string, profession: string): string {
  return profession.startsWith(`${domain}.`) ? profession : `${domain}.${profession}`;
}

export function professionSlugOf(professionId: string): string {
  return professionId.includes(".") ? professionId.slice(professionId.indexOf(".") + 1) : professionId;
}

export async function resolvePriorityBlocks(input: {
  root: string;
  domain: string;
  profession: string;
  source?: PriorityBlockSource | "auto";
  blocksFile?: string;
  includeSeed?: boolean;
}): Promise<ResolvedPriorityBlocks> {
  const professionId = professionIdOf(input.domain, input.profession);
  const requested = input.source ?? "auto";
  const explicitFiles = (input.blocksFile ?? "")
    .split(",")
    .map((file) => file.trim())
    .filter(Boolean);

  if (requested !== "review" && explicitFiles.length === 0) {
    const catalog = await loadCatalog(input.root, input.domain);
    const blocks = catalog.blocks.filter((block) => block.professionIds.includes(professionId));
    if (blocks.length > 0 && (requested === "catalog" || requested === "auto")) {
      return {
        source: "catalog",
        files: [path.join(input.root, "src/methodology/v1/competency/catalog", `${input.domain}.json`)],
        blocks,
      };
    }
    if (requested === "catalog") {
      throw new Error(`В каталоге ${input.domain} нет accepted-блоков для ${professionId}`);
    }
  }

  const files = explicitFiles.length > 0
    ? explicitFiles.map((file) => path.resolve(input.root, file))
    : [path.join(dataDir(input.root), `blocks-${input.domain}.json`)];
  if (input.includeSeed && explicitFiles.length === 0) {
    files.push(path.join(dataDir(input.root), `blocks-${input.domain}-${professionSlugOf(professionId)}.json`));
  }

  const byId = new Map<string, CompetencyBlock>();
  for (const file of files) {
    const payload = await readJson<{ blocks: CompetencyBlock[] }>(file);
    for (const block of payload.blocks ?? []) {
      if (block.professionIds.includes(professionId)) byId.set(block.id, block);
    }
  }
  return { source: "review", files, blocks: [...byId.values()] };
}
