import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { CompetencyBlock } from "../types.ts";
import { renderBlockReview } from "../render.ts";
import { dataDir, flagValue, readJson } from "./common.ts";

interface BlocksFile {
  domain: string;
  blocks: CompetencyBlock[];
  issues: string[];
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession");
  const suffix = profession ? `-${profession}` : "";
  const blocksPath = path.join(dataDir(root), `blocks-${domain}${suffix}.json`);
  const blocks = await readJson<BlocksFile>(blocksPath);
  const output = path.join(dataDir(root), "review", `blocks-${domain}${suffix}.md`);
  await mkdir(path.dirname(output), { recursive: true });
  const existing = await readFile(output, "utf8").catch(() => "");
  const markdown = renderBlockReview(blocks.blocks, blocks.issues ?? []);
  await writeFile(output, existing ? `${markdown}\n\n${existing}` : markdown, "utf8");
  console.log(`Блоков на проверку: ${blocks.blocks.length}; замечаний: ${(blocks.issues ?? []).length}`);
  console.log(output);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
