import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

async function main(): Promise<void> {
  const root = process.cwd();
  const tabs = [
    { id: "uxui", label: "UX/UI", file: "it-uxui-competency-canvas.html" },
    { id: "product", label: "Product", file: "it-product-competency-canvas.html" },
    { id: "motion", label: "Motion", file: "it-motion-competency-canvas.html" },
    { id: "graphic", label: "Graphic", file: "it-graphic-competency-canvas.html" },
  ];
  const buttons = tabs.map((tab, index) => `<button class="tab${index === 0 ? " active" : ""}" data-src="${tab.file}">${tab.label}</button>`).join("");
  const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>AXIONA · Competency Review Canvas</title>
<style>
:root{--ink:#132238;--muted:#64748b;--line:#cbd5e1;--bg:#eef4f8;--accent:#0f766e;font-family:"Inter","Segoe UI",system-ui,sans-serif;color-scheme:light}
*{box-sizing:border-box}html,body{height:100%}body{margin:0;background:var(--bg);color:var(--ink);display:flex;flex-direction:column;overflow:hidden}
.header{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:14px 20px 10px;background:#fff;border-bottom:1px solid var(--line)}
.eyebrow{color:var(--accent);font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.title{margin:2px 0 0;font-size:20px;letter-spacing:-.03em}
.tabs{display:flex;gap:6px;flex-wrap:wrap}.tab{border:1px solid var(--line);background:#f8fafc;color:var(--ink);border-radius:999px;padding:8px 14px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}.tab:hover{border-color:#94a3b8}.tab.active{background:var(--ink);color:#fff;border-color:var(--ink)}
.hint{color:var(--muted);font-size:11px;padding:7px 20px;background:#fff;border-bottom:1px solid var(--line)}
.frame{flex:1;width:100%;border:0;background:#f1f5f9}
</style></head><body>
<header class="header"><div><div class="eyebrow">AXIONA · Human Review</div><h1 class="title">Карта компетенций по профессиям</h1></div><nav class="tabs">${buttons}</nav></header>
<div class="hint">Переключение между профессиями на одном канвасе. Внутри — сеть компетенций, связи и карточки; нажмите на карточку для деталей.</div>
<iframe class="frame" id="frame" src="${tabs[0]!.file}" title="Карта компетенций"></iframe>
<script>
const frame=document.getElementById('frame');
document.querySelectorAll('.tab').forEach((button)=>{button.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach((item)=>item.classList.remove('active'));button.classList.add('active');frame.src=button.dataset.src;});});
</script>
</body></html>`;
  const output = path.join(root, "web", "competencies-review-canvas.html");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, html, "utf8");
  console.log(output);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
