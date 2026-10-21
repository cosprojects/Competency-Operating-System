/**
 * Детерминированный движок сети компетенций дизайна + контракты для дешёвого AI API (Dual-Loop Engine)
 * Соответствует COS-ADE-110 (Competency State), COS-ADE-120 (Evidence) и COS-RES-005 v2.0
 */

export type CompetencyLevelCode = "L0" | "L1" | "L2" | "L3";

export type CaseBand = "ENTRY" | "PRACTICE";

/** L0 и L1 получают один кейс ENTRY, L2 и L3 — один кейс PRACTICE. */
export function resolveCaseBand(anchor: CompetencyLevelCode): CaseBand {
  return anchor === "L0" || anchor === "L1" ? "ENTRY" : "PRACTICE";
}

/** База скоринга полосы. Отдельных кейсов L0 и L3 в MVP нет. */
export function caseDifficultyForBand(band: CaseBand): CompetencyLevelCode {
  return band === "ENTRY" ? "L1" : "L2";
}

export type VerificationStatus =
  | "VERIFIED"
  | "CASE_TESTED"
  | "ARTIFACT_BACKED"
  | "SELF_REPORTED";

export interface NodeEvaluationInput {
  nodeId: string;
  selfReportedLevel: CompetencyLevelCode;
  /** Присутствует ли подтверждённый пользователем факт из портфолио/Figma/резюме по этому узлу */
  hasConfirmedArtifact: boolean;
  /** Уровень сложности артефакта, если он подтверждён */
  artifactInferredLevel?: CompetencyLevelCode;
  /** Доля выполненных критериев рубрики в адаптивном микро-кейсе (0.0 .. 1.0), если узел проверялся в кейсе */
  caseRubricScore?: number;
  /**
   * Сложность микро-кейса, который решал пользователь.
   * Если не передана явно, но передан `caseBand` или `caseRubricScore`,
   * автоматически выводится из полосы кейса (`resolveCaseBand(selfReportedLevel)`),
   * чтобы результат микро-кейса никогда молча не отбрасывался в SELF_REPORTED (28%).
   */
  caseDifficultyLevel?: CompetencyLevelCode;
  /** Полоса микро-кейса (ENTRY -> L1, PRACTICE -> L2), если известна вместо явного уровня */
  caseBand?: CaseBand;
  /** Целевой уровень узла для выбранного направления дизайна */
  targetLevelForTrack: CompetencyLevelCode;
}

export interface EvaluatedNodeState {
  nodeId: string;
  selfReportedLevel: CompetencyLevelCode;
  verifiedLevel: CompetencyLevelCode;
  confidencePercent: number;
  verificationStatus: VerificationStatus;
  /** Разница между подтверждённым уровнем и самооценкой (-2 .. +2) */
  calibrationDelta: number;
  /** Разрыв до целевого уровня выбранного направления (0 = цель достигнута) */
  targetGap: number;
}

const LEVEL_TO_NUM: Record<CompetencyLevelCode, number> = {
  L0: 0,
  L1: 1,
  L2: 2,
  L3: 3,
};

const NUM_TO_LEVEL: Record<number, CompetencyLevelCode> = {
  0: "L0",
  1: "L1",
  2: "L2",
  3: "L3",
};

function clampLevel(val: number): CompetencyLevelCode {
  const clamped = Math.max(0, Math.min(3, Math.round(val)));
  return NUM_TO_LEVEL[clamped] ?? "L0";
}

export interface ProfessionRequirementProgress {
  nodeId: string;
  targetLevel: CompetencyLevelCode;
  verifiedLevel: CompetencyLevelCode | null;
  /** Доля пути до требования профессии, 0..1. Выше цели не растёт. */
  progress: number;
  weight: number;
}

export interface ProfessionProgress {
  /** Взвешенная доля закрытых требований профессии, 0..1. */
  ratio: number;
  nodes: ProfessionRequirementProgress[];
}

/**
 * Доля одной компетенции до целевого уровня профессии.
 * Цель L0 означает «от узла ничего сверх основания не требуется» — доля равна 1.
 * Нет подтверждённого уровня — доля 0. Самооценка в расчёт не входит.
 */
export function competencyProgress(input: {
  verifiedLevel: CompetencyLevelCode | null;
  targetLevel: CompetencyLevelCode;
}): number {
  const target = LEVEL_TO_NUM[input.targetLevel];
  if (target === 0) return 1;
  if (!input.verifiedLevel) return 0;
  const verified = LEVEL_TO_NUM[input.verifiedLevel];
  return Math.min(verified, target) / target;
}

function requirementWeight(input: { isCore: boolean; importanceWeight?: number }): number {
  if (typeof input.importanceWeight === "number" && Number.isFinite(input.importanceWeight)) {
    return Math.max(0, input.importanceWeight);
  }
  return input.isCore ? 1.5 : 0.5;
}

/** Прогресс профессии: взвешенная доля требований. Неподтверждённый узел даёт ноль и остаётся в знаменателе. */
export function professionProgress(input: {
  requirements: Array<{
    nodeId: string;
    targetLevel: CompetencyLevelCode;
    isCore: boolean;
    importanceWeight?: number;
  }>;
  verifiedByNodeId: Readonly<Record<string, CompetencyLevelCode | null | undefined>>;
}): ProfessionProgress {
  const nodes = input.requirements.map((requirement) => {
    const verified = input.verifiedByNodeId[requirement.nodeId] ?? null;
    const weight = requirementWeight(requirement);
    return {
      nodeId: requirement.nodeId,
      targetLevel: requirement.targetLevel,
      verifiedLevel: verified,
      progress: competencyProgress({ verifiedLevel: verified, targetLevel: requirement.targetLevel }),
      weight,
    };
  });
  const totalWeight = nodes.reduce((sum, node) => sum + node.weight, 0);
  const filled = nodes.reduce((sum, node) => sum + node.progress * node.weight, 0);
  return {
    ratio: totalWeight === 0 ? 0 : filled / totalWeight,
    nodes,
  };
}

/**
 * 1. Детерминированный расчёт состояния узла (Competency State)
 * Работает как при наличии загруженных артефактов, так и без них (опираясь на Self-Anchor + Микро-кейс).
 */
export function evaluateCompetencyNodeState(
  input: NodeEvaluationInput
): EvaluatedNodeState {
  const selfNum = LEVEL_TO_NUM[input.selfReportedLevel];
  const targetNum = LEVEL_TO_NUM[input.targetLevelForTrack];
  const normalizedScore =
    typeof input.caseRubricScore === "number" && Number.isFinite(input.caseRubricScore)
      ? Math.max(0, Math.min(1, input.caseRubricScore))
      : undefined;
  const testedInCase = typeof normalizedScore === "number";
  const passedCase = (normalizedScore ?? 0) >= 0.6;
  const excelledInCase = (normalizedScore ?? 0) >= 0.85;

  // Защита от потери результата кейса: если caseRubricScore передан без caseDifficultyLevel,
  // выводим базовую сложность из caseBand или из полосы самооценки (ENTRY -> L1, PRACTICE -> L2)
  const effectiveCaseDifficulty: CompetencyLevelCode | undefined = testedInCase
    ? input.caseDifficultyLevel ??
      caseDifficultyForBand(input.caseBand ?? resolveCaseBand(input.selfReportedLevel))
    : undefined;

  let verifiedNum = selfNum;
  let confidencePercent = 30;
  let verificationStatus: VerificationStatus = "SELF_REPORTED";

  if (testedInCase && effectiveCaseDifficulty) {
    const caseBaseNum = LEVEL_TO_NUM[effectiveCaseDifficulty];

    if (excelledInCase) {
      // Пользователь решил почти все пункты рубрики (возможна недооценка себя на старте)
      verifiedNum = Math.min(3, Math.max(caseBaseNum, selfNum + (caseBaseNum >= selfNum ? 1 : 0)));
    } else if (passedCase) {
      verifiedNum = caseBaseNum;
    } else {
      // Кейс решён слабо (< 60% рубрики) — фиксируем калибровочный сдвиг вниз
      verifiedNum = Math.max(0, caseBaseNum - 1);
    }

    if (input.hasConfirmedArtifact) {
      verificationStatus = "VERIFIED";
      confidencePercent = passedCase ? 88 : 75;
    } else {
      // Артефактов не было, но навык проверен в реальном микро-кейсе (потолок Confidence 75%)
      verificationStatus = "CASE_TESTED";
      confidencePercent = passedCase ? 72 : 62;
    }
  } else if (input.hasConfirmedArtifact) {
    // В микро-кейсе этот узел не проверялся, но есть подтверждённый факт из портфолио/Figma
    verificationStatus = "ARTIFACT_BACKED";
    confidencePercent = 58;
    if (input.artifactInferredLevel) {
      verifiedNum = LEVEL_TO_NUM[input.artifactInferredLevel];
    }
  } else {
    // Только самооценка пользователя без артефакта и без проверки в кейсе
    verificationStatus = "SELF_REPORTED";
    confidencePercent = 28;
    verifiedNum = selfNum;
  }

  const verifiedLevel = clampLevel(verifiedNum);
  const calibrationDelta = verifiedNum - selfNum;
  const targetGap = Math.max(0, targetNum - verifiedNum);

  return {
    nodeId: input.nodeId,
    selfReportedLevel: input.selfReportedLevel,
    verifiedLevel,
    confidencePercent,
    verificationStatus,
    calibrationDelta,
    targetGap,
  };
}

/**
 * 2. Поиск оптимальных узлов-мостов (Pivot Bridges) на графе при смене или развитии направления дизайна
 * Например: Графический дизайнер -> UX/UI или Бренд-дизайнер -> Промышленный/Фуд-дизайн
 */
export interface GraphEdgeDef {
  fromNodeId: string;
  toNodeId: string;
  relationType: "PREREQUISITE" | "PIVOT_BRIDGE" | "SYNERGY";
  transferWeight: number;
  rationale: string;
}

export interface BridgeStepRecommendation {
  nodeId: string;
  currentVerifiedLevel: CompetencyLevelCode;
  requiredTargetLevel: CompetencyLevelCode;
  gapLevels: number;
  leveragedFromNodeId: string | null;
  transferWeight: number;
  bridgeRationale: string;
  priorityScore: number;
}

export function computeTrackBridgePath(params: {
  userStates: Record<string, EvaluatedNodeState>;
  targetTrackRequirements: Array<{
    nodeId: string;
    targetLevel: CompetencyLevelCode;
    isCore: boolean;
  }>;
  edges: GraphEdgeDef[];
}): BridgeStepRecommendation[] {
  const { userStates, targetTrackRequirements, edges } = params;
  const recommendations: BridgeStepRecommendation[] = [];

  for (const req of targetTrackRequirements) {
    const state = userStates[req.nodeId];
    const currentNum = state ? LEVEL_TO_NUM[state.verifiedLevel] : 0;
    const targetNum = LEVEL_TO_NUM[req.targetLevel];
    const gap = Math.max(0, targetNum - currentNum);

    if (gap === 0) continue;

    // Ищем входящие рёбра от узлов, которые у пользователя уже развиты (>= L1)
    const incomingFromStrongNodes = edges
      .filter((e) => e.toNodeId === req.nodeId)
      .map((edge) => {
        const sourceState = userStates[edge.fromNodeId];
        const sourceNum = sourceState ? LEVEL_TO_NUM[sourceState.verifiedLevel] : 0;
        return { edge, sourceNum };
      })
      .filter((item) => item.sourceNum >= 1)
      .sort((a, b) => b.edge.transferWeight * b.sourceNum - a.edge.transferWeight * a.sourceNum);

    const bestBridge = incomingFromStrongNodes[0];

    const priorityScore =
      (req.isCore ? 2.0 : 1.0) *
      gap *
      (bestBridge ? 1 + bestBridge.edge.transferWeight * 0.5 : 1);

    recommendations.push({
      nodeId: req.nodeId,
      currentVerifiedLevel: clampLevel(currentNum),
      requiredTargetLevel: req.targetLevel,
      gapLevels: gap,
      leveragedFromNodeId: bestBridge ? bestBridge.edge.fromNodeId : null,
      transferWeight: bestBridge ? bestBridge.edge.transferWeight : 0,
      bridgeRationale: bestBridge
        ? bestBridge.edge.rationale
        : "Базовый целевой узел выбранного направления",
      priorityScore: Number(priorityScore.toFixed(2)),
    });
  }

  return recommendations.sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * 3. Контракт ответа для дешёвого LLM API в чате (Dual-Loop Response Schema)
 * Модель одним вызовом возвращает:
 *  - `replyToUser`: живой ответ дизайнеру в чате;
 *  - `underTheHoodMutation`: структурированный пакет обновления БД (факты, чек-лист рубрики, сдвиг нодов).
 */
export interface DualLoopChatResponseContract {
  replyToUser: string;
  underTheHoodMutation: {
    extractedPortfolioFacts: Array<{
      nodeId: string;
      evidenceSpan: string;
      inferredLevel: CompetencyLevelCode;
      extractionConfidence: "high" | "medium" | "low";
    }>;
    microCaseEvaluation?: {
      caseId: string;
      matchedRubricItems: number[];
      missedRubricItems: number[];
      normalizedRubricScore: number;
    };
    suggestedTargetTrackPivot?: string | null;
  };
}
