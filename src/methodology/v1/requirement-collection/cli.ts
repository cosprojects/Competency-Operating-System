import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { collectRequirementJournal } from "./collect.ts";
import { htmlExcerpts, htmlToText, jsonExcerpts, pageTitle } from "./text.ts";
import type { PageInput } from "./types.ts";

interface CatalogFile {
  professions: Array<{ id: string; title: string }>;
}

function flagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  const value = index === -1 ? undefined : argv[index + 1];
  if (!value || value.startsWith("--")) return undefined;
  return value;
}

function flagValues(argv: string[], name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== name) continue;
    const value = argv[index + 1];
    if (value && !value.startsWith("--")) values.push(value);
  }
  return values;
}

const professionId = flagValue(process.argv, "--profession");
if (!professionId) {
  console.error("Нужен --profession с id из каталога.");
  process.exit(1);
}

const catalog = JSON.parse(
  await readFile(path.resolve("src/methodology/v1/profession-catalog.json"), "utf8"),
) as CatalogFile;
const profession = catalog.professions.find((item) => item.id === professionId);
if (!profession) {
  console.error(`${professionId}: карточки в каталоге нет. Запросы не собраны.`);
  process.exit(1);
}

const pages: PageInput[] = [];
for (const url of flagValues(process.argv, "--url")) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    console.error(`${url}: страница не прочитана (${response.status})`);
    continue;
  }
  const body = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  const json = contentType.includes("json") || body.trim().startsWith("{") || body.trim().startsWith("[");
  const excerpts = json ? jsonExcerpts(body, url) : htmlExcerpts(body, url);
  pages.push({
    url,
    title: json ? "" : pageTitle(body),
    text: json ? excerpts.map((excerpt) => excerpt.fragment).join("\n") : htmlToText(body),
    obtainedBy: "url",
    excerpts,
  });
}

const journal = collectRequirementJournal({
  professionId,
  professionTitle: profession.title,
  englishLabel: flagValue(process.argv, "--label"),
  pages,
  retrievedOn: new Date().toISOString().slice(0, 10),
});

const outputPath = path.resolve(`data/requirement-collection/${professionId}.json`);
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(journal, null, 2)}\n`, "utf8");

const matching = journal.statements.filter((statement) => statement.entersMatching).length;
console.log(`Запросы: ${journal.queries.length}. Фрагменты: ${journal.statements.length}, в сопоставление: ${matching}.`);
console.log(outputPath);
if (journal.note) console.log(journal.note);
