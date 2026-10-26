import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { GoogleCustomSearchProvider, LEARNING_SEARCH_QUERIES } from "../search.ts";

function flagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const profession = flagValue(argv, "--profession") ?? "motion";
  const limit = Number(flagValue(argv, "--limit") ?? 10);
  const queryArg = flagValue(argv, "--query");
  const sourceProfession = profession.includes(".") ? profession : `it.${profession}`;
  const queries = queryArg ? [queryArg] : (LEARNING_SEARCH_QUERIES[sourceProfession.split(".").pop() ?? ""] ?? []);
  if (queries.length === 0) throw new Error(`Нет search queries для ${sourceProfession}`);
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;
  if (!apiKey || !cx) {
    console.error("Нужны GOOGLE_CSE_API_KEY и GOOGLE_CSE_CX (Google Programmable Search JSON API).");
    console.error("Скрипт не парсит Google HTML и не обходит блокировки; нужен официальный API-ключ.");
    console.error(`Будут выполнены запросы: ${queries.join(" | ")}`);
    process.exit(2);
  }
  const provider = new GoogleCustomSearchProvider(apiKey, cx);
  const results = [];
  for (const query of queries) {
    const hits = await provider.search(query, limit);
    results.push({ query, hits: hits.slice(0, limit) });
  }
  const out = path.join(root, "data/learning-sources", `discovered-${profession}-${new Date().toISOString().slice(0, 10)}.json`);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify({ profession: sourceProfession, provider: provider.id, results, note: "Кандидаты требуют ручной проверки; в реестр автоматически не добавляются." }, null, 2)}\n`, "utf8");
  console.log(`learning sources: ${sourceProfession}; queries ${queries.length}; hits ${results.reduce((n, item) => n + item.hits.length, 0)}`);
  console.log(out);
}
try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exit(1); }
