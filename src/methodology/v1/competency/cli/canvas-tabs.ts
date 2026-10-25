import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { PROFESSION_TABS } from "../visualization/profession-nav.ts";

async function main(): Promise<void> {
  const root = process.cwd();
  const links = PROFESSION_TABS.map((tab) => `<a href="${tab.href}">${tab.label}</a>`).join(" · ");
  const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"/>
<title>AXIONA · Competency Review Canvas</title>
<meta http-equiv="refresh" content="0; url=${PROFESSION_TABS[0]?.href ?? "uxui-competency-canvas.html"}"/>
<style>body{font-family:Inter,"Segoe UI",system-ui,sans-serif;background:#eef4f8;color:#132238;padding:32px}a{color:#0f766e;font-weight:700;text-decoration:none}</style>
</head><body><p>Открываю UX/UI-канвас…</p><p>${links}</p></body></html>`;
  const output = path.join(root, "web", "competencies-review-canvas.html");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, html, "utf8");
  console.log(output);
}

try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exit(1); }
