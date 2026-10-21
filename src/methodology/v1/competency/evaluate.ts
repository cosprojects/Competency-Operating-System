import { normalizeTitle } from "./sources/common.ts";

export interface GoldPair {
  tagId: string;
  tagTitle?: string;
  expectedCompetency: string;
}

export interface CandidateGoldFile {
  version: string;
  description?: string;
  pairs: GoldPair[];
}

export interface CandidatePrediction {
  title: string;
  tagIds: string[];
}

export interface CandidateEvaluation {
  metrics: {
    total: number;
    truePositives: number;
    falsePositives: number;
    falseNegatives: number;
    exact: number;
    precision: number;
    recall: number;
    exactRate: number;
  };
  details: Array<{
    tagId: string;
    expected: string;
    predicted: string | null;
    verdict: "true_positive" | "false_positive" | "false_negative";
  }>;
}

export function evaluateCandidateGold(
  gold: CandidateGoldFile,
  candidates: CandidatePrediction[],
): CandidateEvaluation {
  const predictedByTag = new Map<string, string>();
  for (const candidate of candidates) {
    for (const tagId of candidate.tagIds) predictedByTag.set(tagId, candidate.title);
  }

  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let exact = 0;
  const details: CandidateEvaluation["details"] = [];

  for (const pair of gold.pairs) {
    const predicted = predictedByTag.get(pair.tagId) ?? null;
    const expectedKey = normalizeTitle(pair.expectedCompetency);
    const predictedKey = predicted ? normalizeTitle(predicted) : null;
    if (predictedKey !== null && predictedKey === expectedKey) {
      truePositives += 1;
      exact += 1;
      details.push({
        tagId: pair.tagId,
        expected: pair.expectedCompetency,
        predicted,
        verdict: "true_positive",
      });
      continue;
    }
    falseNegatives += 1;
    if (predictedKey !== null) falsePositives += 1;
    details.push({
      tagId: pair.tagId,
      expected: pair.expectedCompetency,
      predicted,
      verdict: predictedKey === null ? "false_negative" : "false_positive",
    });
  }

  const total = gold.pairs.length;
  return {
    metrics: {
      total,
      truePositives,
      falsePositives,
      falseNegatives,
      exact,
      precision: truePositives + falsePositives === 0 ? 0 : truePositives / (truePositives + falsePositives),
      recall: truePositives + falseNegatives === 0 ? 0 : truePositives / (truePositives + falseNegatives),
      exactRate: total === 0 ? 0 : exact / total,
    },
    details,
  };
}
