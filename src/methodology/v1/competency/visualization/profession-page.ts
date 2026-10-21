import type { GlobalCompetency } from "../model/types.ts";
import type { ProfessionView } from "../model/profession-view.ts";

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface ProfessionMapPageData {
  professionId: string;
  title: string;
  titleEn?: string;
  generatedOn: string;
  sections: Array<{
    id: string;
    title: string;
    definition: string;
    competencies: Array<{
      id: string;
      title: string;
      definition: string;
      tier: string;
      order: number;
    }>;
  }>;
  counts: { foundation: number; core: number; optional: number };
}

export function buildProfessionMapPageData(
  view: ProfessionView,
  competencies: GlobalCompetency[],
  generatedOn: string,
): ProfessionMapPageData {
  const byId = new Map(competencies.map((competency) => [competency.id, competency]));
  const sections = view.sections.map((section) => ({
    id: section.id,
    title: section.title,
    definition: section.definition,
    competencies: section.competencies.flatMap((item) => {
      const competency = byId.get(item.competencyId);
      if (!competency) return [];
      return [{
        id: item.competencyId,
        title: competency.title,
        definition: competency.definition,
        tier: item.tier,
        order: item.order,
      }];
    }),
  }));
  const all = sections.flatMap((section) => section.competencies);
  return {
    professionId: view.professionId,
    title: view.title,
    ...(view.titleEn ? { titleEn: view.titleEn } : {}),
    generatedOn,
    sections,
    counts: {
      foundation: all.filter((item) => item.tier === "foundation").length,
      core: all.filter((item) => item.tier === "core").length,
      optional: all.filter((item) => item.tier === "optional").length,
    },
  };
}

export function renderProfessionMapPage(data: ProfessionMapPageData): string {
  const tierLabel: Record<string, string> = { foundation: "Фундаментальная", core: "Основная", optional: "Необязательная" };
  const cards = data.sections.map((section) => `
    <section class="section">
      <div class="section-head">
        <h2>${esc(section.title)}</h2>
        <span>${section.competencies.length}</span>
      </div>
      <p class="section-def">${esc(section.definition)}</p>
      <div class="cards">
        ${section.competencies.map((item) => `
          <article class="card tier-${esc(item.tier)}" data-tier="${esc(item.tier)}">
            <div class="card-top"><span class="badge">${esc(tierLabel[item.tier] ?? item.tier)}</span><span class="order">${item.order}</span></div>
            <h3>${esc(item.title)}</h3>
            <p>${esc(item.definition)}</p>
          </article>`).join("")}
      </div>
    </section>`).join("");
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(data.title)} — карта компетенций</title>
<style>
:root{--ink:#132238;--muted:#64748b;--line:#cbd5e1;--bg:#f1f5f9;--foundation:#b45309;--core:#1d4ed8;--optional:#64748b;font-family:"Inter","Segoe UI",system-ui,sans-serif;color-scheme:light}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink)}.page{max-width:1400px;margin:0 auto;padding:24px 24px 40px}
.eyebrow{color:#0f766e;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}h1{margin:6px 0 4px;font-size:clamp(28px,4vw,48px);letter-spacing:-.04em}.sub{color:var(--muted);font-size:14px}.summary{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}.summary span{background:#fff;border:1px solid var(--line);border-radius:999px;padding:7px 11px;font-size:12px;font-weight:700}.f{color:var(--foundation)}.c{color:var(--core)}.o{color:var(--optional)}
.notice{border:1px solid #fde68a;background:#fffbeb;color:#92400e;border-radius:12px;padding:10px 13px;font-size:12px;margin:0 0 18px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}.section{background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px;box-shadow:0 10px 30px rgba(15,23,42,.05)}.section-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.section-head h2{margin:0;font-size:17px;letter-spacing:-.02em}.section-head span{color:var(--muted);font-size:12px}.section-def{color:var(--muted);font-size:12px;line-height:1.4;margin:6px 0 12px}.cards{display:flex;flex-direction:column;gap:8px}.card{border:1px solid var(--line);border-radius:12px;padding:10px 11px;background:#fbfdff}.card.tier-foundation{border-color:#f59e0b;background:#fffaf0}.card.tier-core{border-color:#93c5fd;background:#f7fbff}.card.tier-optional{border-color:#cbd5e1;background:#f8fafc}.card-top{display:flex;justify-content:space-between;gap:8px}.badge{font-size:9px;text-transform:uppercase;letter-spacing:.06em;font-weight:800;color:var(--muted)}.tier-foundation .badge{color:var(--foundation)}.tier-core .badge{color:var(--core)}.order{font-size:10px;color:#94a3b8}.card h3{margin:3px 0 3px;font-size:13px;line-height:1.2}.card p{margin:0;color:var(--muted);font-size:11px;line-height:1.35}
</style></head><body><div class="page"><div class="eyebrow">AXIONA · ${esc(data.professionId)}</div><h1>${esc(data.title)}${data.titleEn ? ` <small style="font-size:18px;color:#64748b">${esc(data.titleEn)}</small>` : ""}</h1><p class="sub">Карта компетенций: разделы, приоритеты и переиспользование единого массива. Сгенерировано ${esc(data.generatedOn)}.</p><div class="summary"><span class="f">${data.counts.foundation} фундаментальных</span><span class="c">${data.counts.core} основных</span><span class="o">${data.counts.optional} необязательных</span></div><div class="notice">Профессия — view над единым массивом компетенций. Tier/order специфичны для этой профессии; компетенции переиспользуются из общего каталога.</div><div class="grid">${cards}</div></div></body></html>`;
}
