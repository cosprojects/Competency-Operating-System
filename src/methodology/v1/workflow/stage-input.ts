/**
 * Связывание стадий: вход шага собирается из параметров прогона и выходов
 * предыдущих шагов. Без этого стадии не могут обмениваться результатами —
 * а именно это и есть конвейер, а не набор независимых команд.
 */
import {
  stageInputSchema,
  type Run,
  type Stage,
  type Step,
} from "../contracts/workflow.ts";
import { StageError } from "./errors.ts";

/** Выход стадии по имени. Восстанавливается из артефактов, в том числе между вызовами. */
export type StageOutputs = Partial<Record<Stage, unknown>>;

function requireOutput<T>(outputs: StageOutputs, stage: Stage, field: string): T {
  const output = outputs[stage] as Record<string, unknown> | undefined;
  if (!output || output[field] === undefined) {
    throw new StageError(
      `нет выхода стадии ${stage}: поле ${field} отсутствует — нарушен порядок выполнения`,
      "input_unavailable",
      false,
    );
  }
  return output[field] as T;
}

function professionIdFrom(run: Run): string {
  const ids = run.params.professionIds;
  if (!Array.isArray(ids) || typeof ids[0] !== "string") {
    throw new StageError("в прогоне не задан professionIds[0]", "input_unavailable", false);
  }
  return ids[0];
}

/**
 * Вход конкретной стадии. Каждая ветка возвращает ровно то, что описано
 * в `stageInputSchema` соответствующей стадии.
 */
export function resolveStageInput(stage: Stage, run: Run, outputs: StageOutputs): unknown {
  switch (stage) {
    case "research.plan": {
      const professionIds = Array.isArray(run.params.professionIds)
        ? run.params.professionIds.filter((id): id is string => typeof id === "string")
        : [];
      return stageInputSchema.shape["research.plan"].parse({
        professionIds,
        ...(typeof run.params.sphereId === "string" ? { sphereId: run.params.sphereId } : {}),
      });
    }
    case "research.collect": {
      return stageInputSchema.shape["research.collect"].parse({
        professionId: professionIdFrom(run),
        queries: requireOutput<string[]>(outputs, "research.plan", "queries"),
      });
    }
    case "review.materials": {
      const materials = requireOutput<Array<Record<string, unknown>>>(
        outputs,
        "research.collect",
        "materials",
      );
      return stageInputSchema.shape["review.materials"].parse({
        professionId: professionIdFrom(run),
        items: materials.map((material) => ({
          materialId: String(material.externalId ?? material.materialId ?? ""),
          title: String(material.title ?? ""),
          ...(typeof material.url === "string" ? { sourceId: material.url } : {}),
          ...(typeof material.competencyId === "string"
            ? { competencyId: material.competencyId }
            : {}),
          ...(typeof material.confidence === "number" ? { confidence: material.confidence } : {}),
          ...(typeof material.relevance === "number" ? { relevance: material.relevance } : {}),
          ...(material.verdict === "accept" || material.verdict === "confirm" || material.verdict === "reject"
            ? { verdict: material.verdict }
            : {}),
          ...(Array.isArray(material.flags) ? { flags: material.flags as string[] } : {}),
          ...(material.access === "free" || material.access === "freemium" || material.access === "paid" || material.access === "unknown"
            ? { access: material.access }
            : {}),
          ...(material.language === "ru" || material.language === "en" ? { language: material.language } : {}),
          ...(typeof material.provider === "string" ? { provider: material.provider } : {}),
          ...(typeof material.kind === "string" ? { kind: material.kind } : {}),
        })),
      });
    }
    case "rewrite.formulations": {
      // Райтер правит формулировки тех компетенций, по которым методолог принял материалы.
      const decisions =
        (outputs["review.materials"] as { decisions?: Array<Record<string, unknown>> } | undefined)
          ?.decisions ?? [];
      const nodeIds = [
        ...new Set(
          decisions
            // Публикуем всё, кроме отклонённого: бейдж не мешает править формулировки.
            .filter((decision) => decision.decision !== "rejected")
            .map((decision) => String(decision.nodeId ?? decision.competencyId ?? ""))
            .filter((id) => id.length > 0),
        ),
      ];
      if (nodeIds.length === 0) {
        throw new StageError(
          "нет принятых материалов — нечего переписывать",
          "input_unavailable",
          false,
        );
      }
      return stageInputSchema.shape["rewrite.formulations"].parse({
        professionId: professionIdFrom(run),
        nodeIds,
      });
    }
    case "materials.attach": {
      const decisions = requireOutput<Array<Record<string, unknown>>>(
        outputs,
        "review.materials",
        "decisions",
      );
      const mapped = decisions.map((decision) => ({
        materialId: String(decision.materialId ?? ""),
        nodeId: String(decision.nodeId ?? decision.competencyId ?? ""),
        status: decision.decision,
        ...(typeof decision.title === "string" ? { title: decision.title } : {}),
      }));
      const withoutNode = mapped.find((decision) => decision.nodeId === "");
      if (withoutNode) {
        throw new StageError(
          `решение по материалу ${withoutNode.materialId} не содержит компетенции — привязка невозможна`,
          "input_unavailable",
          false,
        );
      }
      return stageInputSchema.shape["materials.attach"].parse({
        professionId: professionIdFrom(run),
        decisions: mapped,
      });
    }
    case "release.publish": {
      return stageInputSchema.shape["release.publish"].parse({
        releaseId: typeof run.params.releaseId === "string" ? run.params.releaseId : "beta-1",
      });
    }
    case "analysis.market": {
      const markets = Array.isArray(run.params.markets)
        ? run.params.markets.filter((item): item is string => typeof item === "string")
        : [];
      return stageInputSchema.shape["analysis.market"].parse({ markets });
    }
  }
}

/** Выходы успешных шагов: нужны, чтобы стадия получила результат предыдущей. */
export function collectOutputs(steps: Step[], resolved: Map<string, unknown>): StageOutputs {
  const outputs: StageOutputs = {};
  const latest = new Map<string, Step>();
  for (const step of steps) {
    const current = latest.get(step.stage);
    if (!current || step.attempt > current.attempt) latest.set(step.stage, step);
  }
  for (const step of latest.values()) {
    if (step.status !== "succeeded" && step.status !== "skipped") continue;
    const sha = step.outputRef?.sha256;
    if (!sha) continue;
    if (resolved.has(sha)) outputs[step.stage as Stage] = resolved.get(sha);
  }
  return outputs;
}
