/**
 * `rewrite.formulations` — приведение формулировок к единым источникам истины.
 *
 * Без LLM стадия не сочиняет текст, а проверяет и подтягивает определения из
 * канонических источников (модель компетенций, каталог). Записи, которым нужен
 * рерайт, возвращаются списком `missing` — это очередь для LLM-райтера.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { catalogFileSchema, competenciesFileSchema } from "../contracts/adapters.ts";
import { stageInputSchema, stageOutputSchema } from "../contracts/workflow.ts";
import { StageError } from "./errors.ts";
import type { StageHandler } from "./runner.ts";

/** Политика описаний из AGENTS-description-writer: компетенция ≥ 80 символов. */
const MIN_COMPETENCY_DEFINITION = 80;

export function rewriteFormulationsHandler(root: string = process.cwd()): StageHandler {
  return async ({ input }) => {
    const parsed = stageInputSchema.shape["rewrite.formulations"].parse(input);
    const competencies = competenciesFileSchema.parse(
      JSON.parse(
        readFileSync(resolve(root, "src/methodology/v1/competency/model/competencies.json"), "utf8"),
      ),
    );
    const catalog = catalogFileSchema.parse(
      JSON.parse(
        readFileSync(resolve(root, "src/methodology/v1/competency/catalog/it.json"), "utf8"),
      ),
    );
    const byId = new Map(competencies.competencies.map((item) => [item.id, item]));
    const blockByCanonical = new Map<string, (typeof catalog.blocks)[number]>();
    for (const block of catalog.blocks) {
      if ((block.canonicalIds ?? []).length === 1 && block.canonicalIds?.[0]) {
        blockByCanonical.set(block.canonicalIds[0], block);
      }
    }

    const descriptions: Array<{
      nodeId: string;
      definition: string;
      source: "model" | "catalog" | "missing";
      meetsPolicy: boolean;
    }> = [];
    const missing: string[] = [];

    for (const nodeId of parsed.nodeIds) {
      const competency = byId.get(nodeId);
      const block = blockByCanonical.get(nodeId);
      const definition = (competency?.definition ?? block?.definition ?? "").trim();
      const source: "model" | "catalog" | "missing" = competency
        ? "model"
        : block
          ? "catalog"
          : "missing";
      const meetsPolicy = definition.length >= MIN_COMPETENCY_DEFINITION;
      descriptions.push({ nodeId, definition: definition || "—", source, meetsPolicy });
      if (!definition || !meetsPolicy) missing.push(nodeId);
    }

    if (descriptions.length === 0) {
      throw new StageError("нет узлов для правки формулировок", "no_nodes", false);
    }

    return {
      output: stageOutputSchema.shape["rewrite.formulations"].parse({ descriptions, missing }),
    };
  };
}
