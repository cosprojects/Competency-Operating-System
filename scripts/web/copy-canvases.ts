import path from "node:path";
import { copyFile, mkdir, readdir } from "node:fs/promises";

async function main(): Promise<void> {
  const root = process.cwd();
  const source = path.join(root, "web");
  const target = path.join(root, "apps/web/public/canvas");
  await mkdir(target, { recursive: true });
  const files = (await readdir(source)).filter((file) => file.endsWith(".html"));
  for (const file of files) {
    await copyFile(path.join(source, file), path.join(target, file));
  }
  console.log(`web:canvases: ${files.length} HTML pages -> apps/web/public/canvas`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
