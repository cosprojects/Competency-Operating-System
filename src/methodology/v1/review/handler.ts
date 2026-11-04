/**
 * Стадия `review.materials`: политика приёмки на входе сбора.
 * Ничего не ждёт от человека — возвращает решения, публикуем всё, кроме отвергнутого.
 */
import { stageInputSchema, stageOutputSchema } from "../contracts/workflow.ts";
import type { MaterialsStore } from "../materials/store.ts";
import { StageError } from "../workflow/errors.ts";
import type { StageHandler } from "../workflow/runner.ts";
import { DEFAULT_REVIEW_POLICY, classifyMaterial, reviewSignalSchema, toStageDecision } from "./policy.ts";
import { buildReviewContext, signalFromReviewItem } from "./signals.ts";

export function createReviewHandler(
  root: string = process.cwd(),
  options: { store?: MaterialsStore } = {},
): StageHandler {
  let context: ReturnType<typeof buildReviewContext> | undefined;
  const getContext = () => {
    context ??= buildReviewContext(root);
    return context;
  };

  return async ({ input, run, step }) => {
    const parsed = stageInputSchema.shape["review.materials"].parse(input);
    const reviewContext = getContext();

    const decisions = parsed.items.map((item) => {
      const signal = signalFromReviewItem(item, reviewContext);
      const decision = classifyMaterial(signal, DEFAULT_REVIEW_POLICY);
      return {
        materialId: item.materialId,
        decision: toStageDecision(decision),
        reason: `${decision.outcome}: ${decision.reason} (policy ${decision.policyVersion})`,
        ...(item.competencyId ? { competencyId: item.competencyId } : {}),
        ...(item.title ? { title: item.title } : {}),
      };
    });

    if (decisions.length === 0) {
      throw new StageError("приёмка получила пустой список материалов", "no_materials", false);
    }

    if (options.store?.recordReviewDecisions) {
      const results = parsed.items.map((item) => {
        const signal = signalFromReviewItem(item, reviewContext);
        return { item, signal, decision: classifyMaterial(signal, DEFAULT_REVIEW_POLICY) };
      });
      await options.store.recordReviewDecisions({
        runId: run.id,
        stepId: step.id,
        policyVersion: DEFAULT_REVIEW_POLICY.version,
        decisions: results.map(({ item, signal, decision }) => ({
          materialUrl: item.materialId,
          ...(item.title ? { title: item.title } : {}),
          ...(item.competencyId ? { competencyId: item.competencyId } : {}),
          outcome: decision.outcome,
          decision: toStageDecision(decision),
          reason: decision.reason,
          signalsJson: JSON.stringify(signal),
        })),
      });
    }
    return { output: stageOutputSchema.shape["review.materials"].parse({ decisions }) };
  };
}
