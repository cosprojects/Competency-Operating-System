import type { CanvasLayout } from "../canvas/types.ts";
import type { CompetencyBlock } from "../types.ts";
import type { StudyPriorityTier } from "../priority/types.ts";
import { TIER_LABELS } from "../priority/types.ts";
import type { VisualizationConfig, VisualizationPageData, VisualizationPageNode } from "./types.ts";

const TIER_ORDER: Record<StudyPriorityTier, number> = { foundation: 0, core: 1, optional: 2 };

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildVisualizationPageData(input: {
  layout: CanvasLayout;
  blocks: CompetencyBlock[];
  config: VisualizationConfig;
  generatedOn: string;
}): VisualizationPageData {
  const blocksById = new Map(input.blocks.map((block) => [block.id, block]));
  const configById = new Map(input.config.nodes.map((node) => [node.competencyId, node]));
  const nodeIds = new Set(input.layout.nodes.map((node) => node.competencyId));

  const nodes: VisualizationPageNode[] = input.layout.nodes
    .map((node) => {
      const block = blocksById.get(node.competencyId);
      const config = configById.get(node.competencyId);
      if (!block) return null;
      return {
        id: node.competencyId,
        title: block.title,
        tier: node.tier,
        tierLabel: TIER_LABELS[node.tier],
        order: node.order,
        description: config?.shortDescription ?? block.definition,
        fullDescription: block.definition,
        components: block.components.map((component) => component.title),
        tags: block.tags.map((tag) => tag.title),
        evidenceState: block.evidenceState,
        ...(config?.branch ? { branch: config.branch } : {}),
        ...(config?.section ? { section: config.section } : {}),
        x: node.x,
        y: node.y,
        width: node.width,
        height: Math.max(node.height, 92),
        ring: node.ring,
        emphasis: node.emphasis,
        opacity: node.opacity,
      } satisfies VisualizationPageNode;
    })
    .filter((node): node is VisualizationPageNode => node !== null)
    .sort(
      (a, b) =>
        TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || a.order - b.order || a.title.localeCompare(b.title),
    );

  const edges = input.layout.edges
    .filter((edge) => nodeIds.has(edge.fromCompetencyId) && nodeIds.has(edge.toCompetencyId))
    .map((edge) => ({ from: edge.fromCompetencyId, to: edge.toCompetencyId }));

  const minX = Math.min(...nodes.map((node) => node.x - node.width / 2), 0);
  const minY = Math.min(...nodes.map((node) => node.y - node.height / 2), 0);
  const maxX = Math.max(...nodes.map((node) => node.x + node.width / 2), 1200);
  const maxY = Math.max(...nodes.map((node) => node.y + node.height / 2), 800);
  const offsetX = 80 - minX;
  const offsetY = 80 - minY;

  return {
    title: "UX/UI дизайнер",
    subtitle: "Сеть компетенций: от фундамента к углублённым и необязательным",
    note: input.config.note,
    generatedOn: input.generatedOn,
    nodes,
    edges,
    stage: {
      width: Math.ceil(maxX - minX + 160),
      height: Math.ceil(maxY - minY + 160),
      offsetX,
      offsetY,
    },
    counts: {
      foundation: nodes.filter((node) => node.tier === "foundation").length,
      core: nodes.filter((node) => node.tier === "core").length,
      optional: nodes.filter((node) => node.tier === "optional").length,
    },
  };
}

function edgePaths(data: VisualizationPageData): string {
  const byId = new Map(data.nodes.map((node) => [node.id, node]));
  return data.edges
    .map((edge) => {
      const from = byId.get(edge.from);
      const to = byId.get(edge.to);
      if (!from || !to) return "";
      const x1 = from.x + data.stage.offsetX;
      const y1 = from.y + data.stage.offsetY;
      const x2 = to.x + data.stage.offsetX;
      const y2 = to.y + data.stage.offsetY;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const curve = 0.08;
      const cx = (x1 + x2) / 2 - dy * curve;
      const cy = (y1 + y2) / 2 + dx * curve;
      return `<path class="edge" data-from="${esc(edge.from)}" data-to="${esc(edge.to)}" d="M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" marker-end="url(#arrow)" />`;
    })
    .join("\n        ");
}

function nodeCard(node: VisualizationPageNode, data: VisualizationPageData): string {
  const left = node.x - node.width / 2 + data.stage.offsetX;
  const top = node.y - node.height / 2 + data.stage.offsetY;
  return `<article class="competency-card tier-${node.tier}" data-id="${esc(node.id)}" data-tier="${node.tier}" style="left:${left.toFixed(1)}px;top:${top.toFixed(1)}px;width:${node.width}px;height:${node.height}px;opacity:${node.opacity}" tabindex="0">
          <div class="card-top">
            <span class="tier-badge">${esc(node.tierLabel)}</span>
            <span class="order">${node.order}</span>
          </div>
          <h2>${esc(node.title)}</h2>
          <p>${esc(node.description)}</p>
        </article>`;
}

export function renderCanvasPage(data: VisualizationPageData): string {
  const embedded = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>UX/UI — карта компетенций</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #132238;
      --muted: #64748b;
      --line: #cbd5e1;
      --canvas: #f1f5f9;
      --card: #ffffff;
      --foundation: #b45309;
      --foundation-bg: #fff7ed;
      --foundation-border: #f59e0b;
      --core: #1d4ed8;
      --core-bg: #eff6ff;
      --core-border: #93c5fd;
      --optional: #64748b;
      --optional-bg: #f8fafc;
      --optional-border: #cbd5e1;
      --accent: #0f766e;
      font-family: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
    }
    * { box-sizing: border-box; }
    body { margin: 0; color: var(--ink); background: var(--canvas); }
    .page { max-width: 1580px; margin: 0 auto; padding: 22px 22px 30px; }
    .topbar { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding: 2px 2px 16px; }
    .eyebrow { color: var(--accent); font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
    h1 { margin: 5px 0 4px; font-size: clamp(28px, 4vw, 48px); letter-spacing: -.04em; line-height: 1; }
    .subtitle { margin: 0; color: var(--muted); font-size: 14px; }
    .summary { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .summary span { border: 1px solid var(--line); background: #fff; border-radius: 999px; padding: 7px 11px; font-size: 12px; font-weight: 700; white-space: nowrap; }
    .summary .f { color: var(--foundation); } .summary .c { color: var(--core); } .summary .o { color: var(--optional); }
    .banner { border: 1px solid #fde68a; background: #fffbeb; color: #92400e; border-radius: 12px; padding: 10px 13px; font-size: 12px; margin-bottom: 12px; }
    .toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
    .toolbar-label { color: var(--muted); font-size: 12px; margin-right: 2px; }
    .filter { border: 1px solid var(--line); background: #fff; color: var(--ink); border-radius: 999px; padding: 7px 11px; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
    .filter:hover { border-color: #94a3b8; }
    .filter.active { background: var(--ink); color: #fff; border-color: var(--ink); }
    .hint { margin-left: auto; color: var(--muted); font-size: 12px; }
    .workspace { display: grid; grid-template-columns: minmax(0, 1fr) 310px; gap: 14px; align-items: start; }
    .canvas-wrap { overflow: auto; border: 1px solid var(--line); border-radius: 18px; background-color: var(--canvas); background-image: radial-gradient(#cbd5e1 1px, transparent 1px); background-size: 22px 22px; box-shadow: inset 0 1px 0 #fff, 0 16px 40px rgba(15, 23, 42, .06); }
    .canvas-stage { position: relative; }
    .edges { position: absolute; inset: 0; overflow: visible; pointer-events: none; }
    .edge { fill: none; stroke: #94a3b8; stroke-width: 1.4; opacity: .55; transition: opacity .15s, stroke .15s; }
    .edge.is-active { stroke: var(--accent); stroke-width: 2.4; opacity: 1; }
    .edge.is-muted { opacity: .12; }
    .competency-card { position: absolute; display: flex; flex-direction: column; gap: 4px; overflow: hidden; border: 1px solid var(--line); border-radius: 14px; background: var(--card); padding: 9px 11px; cursor: pointer; box-shadow: 0 5px 14px rgba(15, 23, 42, .07); transition: transform .15s, box-shadow .15s, opacity .15s, border-color .15s; }
    .competency-card:hover, .competency-card:focus-visible { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(15, 23, 42, .14); outline: none; border-color: #94a3b8; }
    .competency-card.is-active { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(15, 118, 110, .18), 0 12px 24px rgba(15, 23, 42, .14); }
    .competency-card.is-muted { opacity: .22 !important; }
    .tier-foundation { border-color: var(--foundation-border); background: linear-gradient(180deg, #fffdf8, var(--foundation-bg)); }
    .tier-core { border-color: var(--core-border); background: linear-gradient(180deg, #ffffff, var(--core-bg)); }
    .tier-optional { border-color: var(--optional-border); background: var(--optional-bg); opacity: .78; }
    .card-top { display: flex; justify-content: space-between; align-items: center; gap: 6px; min-height: 17px; }
    .tier-badge { font-size: 9px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
    .tier-foundation .tier-badge { color: var(--foundation); }
    .tier-core .tier-badge { color: var(--core); }
    .order { color: #94a3b8; font-size: 10px; font-variant-numeric: tabular-nums; }
    .competency-card h2 { margin: 0; font-size: 12px; line-height: 1.18; letter-spacing: -.01em; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .competency-card p { margin: 0; color: var(--muted); font-size: 10px; line-height: 1.28; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .detail { position: sticky; top: 12px; border: 1px solid var(--line); border-radius: 18px; background: #fff; padding: 16px; box-shadow: 0 16px 40px rgba(15, 23, 42, .06); min-height: 240px; }
    .detail[hidden] { display: none; }
    .detail-close { float: right; border: 0; background: #f1f5f9; color: var(--muted); width: 26px; height: 26px; border-radius: 50%; cursor: pointer; font-size: 16px; }
    .detail .tier-badge { display: inline-block; margin-bottom: 8px; }
    .detail h2 { margin: 0 0 6px; font-size: 19px; line-height: 1.15; }
    .detail .full { color: var(--muted); font-size: 12px; line-height: 1.45; margin: 0 0 12px; }
    .detail h3 { margin: 12px 0 4px; font-size: 10px; text-transform: uppercase; letter-spacing: .09em; color: var(--muted); }
    .detail ul { margin: 0; padding-left: 17px; color: var(--ink); font-size: 12px; line-height: 1.45; }
    .detail li { margin: 2px 0; }
    .detail .muted { color: var(--muted); font-size: 11px; line-height: 1.4; }
    @media (max-width: 1050px) { .workspace { grid-template-columns: 1fr; } .detail { position: static; } .summary { justify-content: flex-start; } .topbar { align-items: flex-start; flex-direction: column; } }
    @media (max-width: 620px) { .page { padding: 14px; } .hint { display: none; } }
  </style>
</head>
<body>
  <div class="page">
    <header class="topbar">
      <div>
        <div class="eyebrow">AXIONA · Competency Canvas</div>
        <h1>${esc(data.title)}</h1>
        <p class="subtitle">${esc(data.subtitle)}</p>
      </div>
      <div class="summary">
        <span class="f">${data.counts.foundation} фундаментальных</span>
        <span class="c">${data.counts.core} основных</span>
        <span class="o">${data.counts.optional} необязательных</span>
      </div>
    </header>
    <div class="banner"><strong>Черновой слой.</strong> ${esc(data.note)} Сгенерировано ${esc(data.generatedOn)}.</div>
    <div class="toolbar">
      <span class="hint">Наведите на карточку, чтобы увидеть связи; нажмите — подробности</span>
    </div>
    <main class="workspace">
      <div class="canvas-wrap">
        <div class="canvas-stage" style="width:${data.stage.width}px;height:${data.stage.height}px">
          <svg class="edges" width="${data.stage.width}" height="${data.stage.height}" viewBox="0 0 ${data.stage.width} ${data.stage.height}" aria-hidden="true">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
              </marker>
            </defs>
            ${edgePaths(data)}
          </svg>
          ${data.nodes.map((node) => nodeCard(node, data)).join("\n          ")}
        </div>
      </div>
      <aside class="detail" id="detail" hidden>
        <button class="detail-close" id="detail-close" aria-label="Закрыть">×</button>
        <span class="tier-badge" id="detail-tier"></span>
        <h2 id="detail-title"></h2>
        <p class="full" id="detail-full"></p>
        <h3>Компоненты</h3>
        <ul id="detail-components"></ul>
        <h3>Теги и знания</h3>
        <ul id="detail-tags"></ul>
        <p class="muted" id="detail-meta"></p>
      </aside>
    </main>
  </div>
  <script>
    const DATA = ${embedded};
    const byId = new Map(DATA.nodes.map((node) => [node.id, node]));
    const cards = [...document.querySelectorAll('.competency-card')];
    const edges = [...document.querySelectorAll('.edge')];
    const detail = document.getElementById('detail');

    function connected(id) {
      const ids = new Set([id]);
      for (const edge of edges) {
        if (edge.dataset.from === id) ids.add(edge.dataset.to);
        if (edge.dataset.to === id) ids.add(edge.dataset.from);
      }
      return ids;
    }
    function highlight(id) {
      const ids = connected(id);
      cards.forEach((card) => {
        card.classList.toggle('is-active', card.dataset.id === id);
        card.classList.toggle('is-muted', !ids.has(card.dataset.id));
      });
      edges.forEach((edge) => {
        const active = edge.dataset.from === id || edge.dataset.to === id;
        edge.classList.toggle('is-active', active);
        edge.classList.toggle('is-muted', !active);
      });
    }
    function clearHighlight() {
      cards.forEach((card) => card.classList.remove('is-active', 'is-muted'));
      edges.forEach((edge) => edge.classList.remove('is-active', 'is-muted'));
    }
    function openDetail(id) {
      const node = byId.get(id);
      if (!node) return;
      document.getElementById('detail-tier').textContent = node.tierLabel;
      document.getElementById('detail-title').textContent = node.title;
      document.getElementById('detail-full').textContent = node.fullDescription;
      document.getElementById('detail-components').replaceChildren(...node.components.map((item) => { const li = document.createElement('li'); li.textContent = item; return li; }));
      document.getElementById('detail-tags').replaceChildren(...node.tags.slice(0, 12).map((item) => { const li = document.createElement('li'); li.textContent = item; return li; }));
      document.getElementById('detail-meta').textContent = [node.branch, node.section, 'Порядок ' + node.order, 'evidence: ' + node.evidenceState, 'ring ' + node.ring].filter(Boolean).join(' · ');
      detail.hidden = false;
    }
    cards.forEach((card) => {
      card.addEventListener('mouseenter', () => highlight(card.dataset.id));
      card.addEventListener('mouseleave', clearHighlight);
      card.addEventListener('focus', () => highlight(card.dataset.id));
      card.addEventListener('blur', clearHighlight);
      card.addEventListener('click', () => { highlight(card.dataset.id); openDetail(card.dataset.id); });
      card.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); card.click(); } });
    });
    document.getElementById('detail-close').addEventListener('click', () => { detail.hidden = true; clearHighlight(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { detail.hidden = true; clearHighlight(); } });
  </script>
</body>
</html>
`;
}
