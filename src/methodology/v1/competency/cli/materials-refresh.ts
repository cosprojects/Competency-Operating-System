import path from "node:path";
import type { Material } from "../types.ts";
import { dataDir, flagValue, readJson, writeJson } from "./common.ts";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession");
  const suffix = profession ? `-${profession}` : "";
  const input = flagValue(argv, "--materials-file") ?? path.join(dataDir(root), `materials-${domain}${suffix}.json`);
  const file = await readJson<{ materials: Material[]; coverage?: unknown; notes?: string[] }>(input);
  const checkLinks = argv.includes("--check-links");
  const refreshed: Material[] = [];
  const notes: string[] = [...(file.notes ?? [])];

  for (const material of file.materials) {
    const next = { ...material, retrievedAt: new Date().toISOString().slice(0, 10) };
    if (checkLinks) {
      try {
        const response = await fetch(material.url, { method: "HEAD", signal: AbortSignal.timeout(15_000) });
        if (!response.ok) {
          next.issues = [...new Set([...next.issues, `ссылка ответила ${response.status}`])];
          notes.push(`${material.title}: ссылка ответила ${response.status}`);
        }
      } catch (error) {
        next.issues = [
          ...new Set([
            ...next.issues,
            `ссылка недоступна: ${error instanceof Error ? error.message : "ошибка"}`,
          ]),
        ];
        notes.push(`${material.title}: ссылка недоступна`);
      }
    }
    refreshed.push(next);
  }

  const output = path.join(dataDir(root), `materials-refreshed-${domain}${suffix}.json`);
  await writeJson(output, {
    domain,
    refreshedOn: new Date().toISOString().slice(0, 10),
    writesToGraph: false,
    materials: refreshed,
    notes,
  });
  console.log(`Обновлено материалов: ${refreshed.length}; ссылок проверено: ${checkLinks ? refreshed.length : 0}`);
  console.log(output);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
