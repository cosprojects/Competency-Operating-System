import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { Material } from "../types.ts";
import { renderMaterialReview } from "../render.ts";
import { dataDir, flagValue } from "./common.ts";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession");
  const suffix = profession ? `-${profession}` : "";
  const input = path.join(dataDir(root), `materials-classified-${domain}${suffix}.json`);
  const data = JSON.parse(await readFile(input, "utf8")) as {
    materials: Material[];
    coverage?: Array<{ title: string; materials: number; kinds: Record<string, number> }>;
  };
  const output = path.join(dataDir(root), "review", `materials-${domain}${suffix}.md`);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, renderMaterialReview(data.materials, data.coverage ?? []), "utf8");
  console.log(`Материалов на проверку: ${data.materials.length}`);
  console.log(output);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
