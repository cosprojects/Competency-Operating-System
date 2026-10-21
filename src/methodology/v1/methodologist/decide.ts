import type { CandidateQueue, CompetencyCandidate } from "../candidate-parser/types.ts";
import type { CompetencyLevelCode } from "../design-graph-engine.ts";

export interface MethodologistNode {
  id: string;
  title: string;
  shortTitle: string;
  description?: string;
  aiEvolutionNote?: string;
  behavioralAnchors?: Record<string, string>;
}

export interface MethodologistTrack {
  id: string;
  requiredNodes: Array<{
    nodeId: string;
    targetLevel: CompetencyLevelCode;
    isCore: boolean;
  }>;
}

export interface MethodologistGraph {
  nodes: MethodologistNode[];
  tracks: MethodologistTrack[];
}

export interface MethodologistProfession {
  id: string;
  status: string;
}

export type MethodologistOutcome =
  | "add_requirement"
  | "already_required"
  | "needs_node"
  | "ambiguous"
  | "reject_tool"
  | "reject_taste"
  | "reject_closed";

export interface MethodologistDecision {
  outcome: MethodologistOutcome;
  candidateId: string;
  professionId: string;
  phrase: string;
  nodeId?: string;
  /** Предложение для ревью. В граф не записывается. */
  targetLevel?: CompetencyLevelCode;
  isCore?: boolean;
  /** Как действие выглядит в этой профессии. Поле TrackNodeRequirement.roleSpecificContext. */
  roleSpecificContext?: string;
  sourceUrl?: string;
  needsReview: boolean;
  reason: string;
}

export interface MethodologistPatch {
  patchVersion: "1.0.0";
  writesToGraph: false;
  counts: Record<MethodologistOutcome, number>;
  decisions: MethodologistDecision[];
}

interface Alias {
  nodeId: string;
  /** Нормализованная фраза. Совпадение по границе слов, побеждает самая длинная. */
  phrase: string;
}

const ALIASES: readonly Alias[] = [
  { nodeId: "node_form_comp", phrase: "visual composition" },
  { nodeId: "node_form_comp", phrase: "colour theory" },
  { nodeId: "node_form_comp", phrase: "color theory" },
  { nodeId: "node_form_comp", phrase: "typography" },
  { nodeId: "node_form_comp", phrase: "composition" },
  { nodeId: "node_ergonomics_human", phrase: "human factors" },
  { nodeId: "node_ergonomics_human", phrase: "accessibility" },
  { nodeId: "node_ergonomics_human", phrase: "ergonomics" },
  { nodeId: "node_brand_semiotics", phrase: "visual identity" },
  { nodeId: "node_brand_semiotics", phrase: "brand identity" },
  { nodeId: "node_brand_semiotics", phrase: "semiotics" },
  { nodeId: "node_ai_art_direction", phrase: "art direction" },
  { nodeId: "node_motion_kinetics", phrase: "motion graphics" },
  { nodeId: "node_motion_kinetics", phrase: "animation principles" },
  { nodeId: "node_3d_spatial_vis", phrase: "3d modelling" },
  { nodeId: "node_3d_spatial_vis", phrase: "3d modeling" },
  { nodeId: "node_design_systems", phrase: "design tokens" },
  { nodeId: "node_design_systems", phrase: "design system" },
  { nodeId: "node_info_arch", phrase: "information architecture" },
  { nodeId: "node_ux_flows", phrase: "edge cases" },
  { nodeId: "node_ux_flows", phrase: "user flows" },
  { nodeId: "node_ux_research", phrase: "usability testing" },
  { nodeId: "node_ux_research", phrase: "user research" },
  { nodeId: "node_prod_metrics", phrase: "conversion rate" },
  { nodeId: "node_prod_metrics", phrase: "product metrics" },
  { nodeId: "node_game_loops", phrase: "game balance" },
  { nodeId: "node_game_loops", phrase: "game design" },
];

const TOOL_WORDS = [
  "figma",
  "sketch",
  "adobe",
  "photoshop",
  "illustrator",
  "indesign",
  "after effects",
  "blender",
  "cinema 4d",
  "zbrush",
  "midjourney",
  "comfyui",
  "stable diffusion",
  "html",
  "css",
  "javascript",
  "github",
  "jira",
  "framer",
  "webflow",
  "rive",
  "lottie",
  "spline",
  "unreal",
  "unity",
];

const TASTE_PHRASES = [
  "good taste",
  "aesthetic sense",
  "sense of beauty",
  "artistic flair",
  "creativity",
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9а-яё]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsPhrase(text: string, phrase: string): boolean {
  return ` ${text} `.includes(` ${phrase} `);
}

function matchedAlias(phrase: string): Alias | undefined {
  const text = normalize(phrase);
  const hits = ALIASES.filter((alias) => containsPhrase(text, alias.phrase));
  hits.sort((a, b) => b.phrase.length - a.phrase.length);
  return hits[0];
}

function isTool(phrase: string): boolean {
  const text = normalize(phrase);
  return TOOL_WORDS.some((tool) => containsPhrase(text, tool));
}

function isTaste(phrase: string): boolean {
  const text = normalize(phrase);
  return TASTE_PHRASES.some((taste) => containsPhrase(text, taste));
}

const STOP_STEMS = new Set([
  "это", "как", "что", "для", "или", "при", "его", "её", "их", "уже", "ещё",
  "the", "and", "for", "with", "that", "from", "into", "using", "while",
  "дизайн", "дизайнер", "работа", "уметь", "должен",
]);

function contentWords(text: string): string[] {
  const words: string[] = [];
  for (const token of normalize(text).split(" ")) {
    if (token.length < 4) continue;
    const value = token.replace(/ё/g, "е");
    if (!STOP_STEMS.has(value)) words.push(value);
  }
  return words;
}

function nodeFields(node: MethodologistNode): string[] {
  return [
    node.title,
    node.shortTitle,
    node.description ?? "",
    ...Object.values(node.behavioralAnchors ?? {}),
  ];
}

/**
 * Три содержательных слова одного поля идут в источнике подряд и в том же порядке.
 * Совпадение — целое слово, не обрубок. Слова из разных полей и из разных частей фразы не складываются.
 */
function confirmedAction(statement: string, node: MethodologistNode): string[] | undefined {
  const haystack = contentWords(statement);
  for (const field of nodeFields(node)) {
    const needles = contentWords(field);
    for (let start = 0; start <= needles.length - 3; start += 1) {
      const span = needles.slice(start, start + 3);
      for (let at = 0; at <= haystack.length - span.length; at += 1) {
        if (span.every((word, index) => haystack[at + index] === word)) return span;
      }
    }
  }
  return undefined;
}

/** Два одинаковых слова одного поля. Порог ревью прежний, общий мешок полей не используется. */
function weakOverlap(statement: string, node: MethodologistNode): number {
  const left = new Set(contentWords(statement));
  let best = 0;
  for (const field of nodeFields(node)) {
    let score = 0;
    for (const word of new Set(contentWords(field))) if (left.has(word)) score += 1;
    if (score > best) best = score;
  }
  return best;
}

function emptyCounts(): Record<MethodologistOutcome, number> {
  return {
    add_requirement: 0,
    already_required: 0,
    needs_node: 0,
    ambiguous: 0,
    reject_tool: 0,
    reject_taste: 0,
    reject_closed: 0,
  };
}

function decideOne(
  candidate: CompetencyCandidate,
  graph: MethodologistGraph,
  professions: ReadonlyMap<string, MethodologistProfession>,
): MethodologistDecision {
  const profession = professions.get(candidate.professionId);
  if (!profession || profession.status !== "open_for_assessment") {
    return {
      outcome: "reject_closed",
      candidateId: candidate.id,
      professionId: candidate.professionId,
      phrase: candidate.phrase,
      needsReview: false,
      reason: profession
        ? "профессия в каталоге не открыта для оценки"
        : "профессии нет в каталоге",
    };
  }
  if (isTool(candidate.phrase)) {
    return {
      outcome: "reject_tool",
      candidateId: candidate.id,
      professionId: candidate.professionId,
      phrase: candidate.phrase,
      needsReview: false,
      reason: "формулировка называет инструмент, а не действие",
    };
  }
  if (isTaste(candidate.phrase)) {
    return {
      outcome: "reject_taste",
      candidateId: candidate.id,
      professionId: candidate.professionId,
      phrase: candidate.phrase,
      needsReview: false,
      reason: "формулировка оценивает вкус или черту, а не наблюдаемое действие",
    };
  }

  const evidenceText = candidate.matchText
    ? `${candidate.matchText}. ${candidate.phrase}`
    : `${candidate.phrase}. ${candidate.fragment}`;
  const confident = graph.nodes.flatMap((node) => {
    const words = confirmedAction(evidenceText, node);
    return words ? [{ node, words }] : [];
  });
  if (confident.length === 1) {
    const hit = confident[0];
    if (!hit) {
      return {
        outcome: "needs_node",
        candidateId: candidate.id,
        professionId: candidate.professionId,
        phrase: candidate.phrase,
        sourceUrl: candidate.sourceUrl,
        needsReview: true,
        reason: "нет подтверждённого соответствия; ближайший узел не выбирается",
      };
    }
    const nodeId = hit.node.id;
    const action = hit.words.join(" ");
    const track = graph.tracks.find((item) => item.id === candidate.professionId);
    const already = track?.requiredNodes.some((requirement) => requirement.nodeId === nodeId) ?? false;
    if (already) {
      return {
        outcome: "already_required",
        candidateId: candidate.id,
        professionId: candidate.professionId,
        phrase: candidate.phrase,
        nodeId,
        roleSpecificContext: candidate.phrase,
        sourceUrl: candidate.sourceUrl,
        needsReview: false,
        reason: `действие «${action}» есть в источнике и в одном поле узла, и этот узел уже требуется профессии`,
      };
    }
    return {
      outcome: "add_requirement",
      candidateId: candidate.id,
      professionId: candidate.professionId,
      phrase: candidate.phrase,
      nodeId,
      targetLevel: "L2",
      isCore: candidate.relation === "essential",
      roleSpecificContext: candidate.phrase,
      sourceUrl: candidate.sourceUrl,
      needsReview: true,
      reason: `действие «${action}» есть в источнике и в одном поле узла; целевой уровень L2 — черновик для приёмки`,
    };
  }

  const weak = graph.nodes
    .map((node) => ({ nodeId: node.id, score: weakOverlap(evidenceText, node) }))
    .filter((item) => item.score >= 2)
    .sort((a, b) => b.score - a.score);
  const alias = matchedAlias(evidenceText);
  const aliasNode = alias && graph.nodes.some((node) => node.id === alias.nodeId) ? alias.nodeId : undefined;
  if (confident.length > 1 || weak.length > 0 || aliasNode) {
    const hinted = confident.length > 1 ? undefined : (weak[0]?.nodeId ?? aliasNode);
    const tied = weak.length > 1 && weak[0]?.score === weak[1]?.score;
    return {
      outcome: "ambiguous",
      candidateId: candidate.id,
      professionId: candidate.professionId,
      phrase: candidate.phrase,
      nodeId: tied ? undefined : hinted,
      sourceUrl: candidate.sourceUrl,
      needsReview: true,
      reason: "совпали отдельные слова, действие узла фрагментом не подтверждено; требованием не считается",
    };
  }

  return {
    outcome: "needs_node",
    candidateId: candidate.id,
    professionId: candidate.professionId,
    phrase: candidate.phrase,
    sourceUrl: candidate.sourceUrl,
    needsReview: true,
    reason: "нет подтверждённого соответствия; ближайший узел не выбирается",
  };
}

export function buildMethodologistPatch(input: {
  queue: CandidateQueue;
  graph: MethodologistGraph;
  professions: MethodologistProfession[];
}): MethodologistPatch {
  const professions = new Map(input.professions.map((profession) => [profession.id, profession]));
  const counts = emptyCounts();
  const decisions = input.queue.candidates.map((candidate) => {
    const decision = decideOne(candidate, input.graph, professions);
    counts[decision.outcome] += 1;
    return decision;
  });
  return {
    patchVersion: "1.0.0",
    writesToGraph: false,
    counts,
    decisions,
  };
}
