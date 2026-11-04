/**
 * Обработчики стадий. Подключены по одному: пока стадия не реализована,
 * раннер помечает её `blocked` и не двигается дальше — это видно в отчёте.
 *
 * `research.plan` работает офлайн и служит доказательством механизма:
 * прогон, артефакты, идемпотентность, ретраи — без сетевых вызовов.
 */
import { readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import { professionsFileSchema } from "../contracts/adapters.ts";
import { stageInputSchema, stageOutputSchema, type Stage } from "../contracts/workflow.ts";
import { createReviewHandler } from "../review/handler.ts";
import { attachMaterialsHandler } from "./stages-attach.ts";
import { publishReleaseHandler } from "./stages-publish.ts";
import { rewriteFormulationsHandler } from "./stages-writer.ts";
import { StageError } from "./errors.ts";
import type { StageHandler } from "./runner.ts";

/** Порог приёмки источника — как quality gate расширения: только accept с confidence ≥ 0.75. */
const MIN_SOURCE_CONFIDENCE = 0.75;

type ProfessionRow = { id: string; sphereId: string; title: string };

function loadProfessions(root: string): ProfessionRow[] {
  const raw = JSON.parse(
    readFileSync(
      resolve(root, "src/methodology/v1/competency/model/professions.json"),
      "utf8",
    ),
  );
  return professionsFileSchema.parse(raw).professions;
}

export function researchPlanHandler(root: string = process.cwd()): StageHandler {
  return async ({ input }) => {
    const parsed = stageInputSchema.shape["research.plan"].parse(input);
    const professions = loadProfessions(root);
    const byId = new Map(professions.map((profession) => [profession.id, profession]));

    const queries: string[] = [];
    for (const professionId of parsed.professionIds) {
      const profession = byId.get(professionId);
      if (!profession) {
        throw new StageError(`неизвестная профессия: ${professionId}`, "unknown_profession", false);
      }
      queries.push(
        `${profession.title}: компетенции`,
        `${profession.title}: знания и навыки`,
        `${profession.title}: учебные материалы`,
      );
    }

    return { output: stageOutputSchema.shape["research.plan"].parse({ queries }) };
  };
}

// --- research.collect: сбор материалов из журнала расширения ------------------

const journalCandidateSchema = z
  .object({
    canonicalUrl: z.string().min(8),
    url: z.string().optional(),
    title: z.string().min(3),
    provider: z.string().optional(),
    competencyId: z.string().optional(),
    competencyTitle: z.string().optional(),
    kind: z.string().optional(),
    languages: z.array(z.string()).optional(),
    score: z.number().optional(),
    review: z
      .object({
        verdict: z.string(),
        confidence: z.number().optional(),
        usefulness: z.number().optional(),
        flags: z.array(z.string()).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const expandJournalSchema = z
  .object({
    generatedOn: z.string().optional(),
    professionId: z.string(),
    candidates: z.array(journalCandidateSchema),
  })
  .passthrough();

function slugOf(professionId: string): string {
  return professionId.split(".")[1] ?? professionId;
}

/**
 * Сбор идёт из журнала `sources:expand`, а не из сети:
 *  - прогон не тратит квоту Brave и воспроизводим;
 *  - живой режим — отдельное осознанное действие оператора.
 * Если журнала нет — стадия падает с `journal_missing` и подсказкой.
 */
export function researchCollectHandler(root: string = process.cwd()): StageHandler {
  return async ({ input }) => {
    const parsed = stageInputSchema.shape["research.collect"].parse(input);
    const dir = resolve(root, "data/learning-sources");
    let files: string[] = [];
    try {
      files = (await readdir(dir)).filter(
        (file) => file.startsWith(`expansion-${slugOf(parsed.professionId)}-`) && file.endsWith(".json"),
      );
    } catch {
      files = [];
    }
    const journalFile = files.sort().at(-1);
    if (!journalFile) {
      throw new StageError(
        `нет журнала расширения для ${parsed.professionId}: сначала запусти npm run sources:expand -- --profession ${slugOf(parsed.professionId)}`,
        "journal_missing",
        false,
      );
    }

    const journal = expandJournalSchema.parse(
      JSON.parse(await readFile(join(dir, journalFile), "utf8")),
    );
    if (journal.professionId !== parsed.professionId) {
      throw new StageError(
        `журнал ${journalFile} относится к ${journal.professionId}, а не к ${parsed.professionId}`,
        "journal_mismatch",
        false,
      );
    }

    const materials = journal.candidates
      .filter((candidate) => {
        const verdict = candidate.review?.verdict;
        const confidence = candidate.review?.confidence ?? 0;
        return verdict === "accept" && confidence >= MIN_SOURCE_CONFIDENCE;
      })
      .map((candidate) => ({
        externalId: candidate.canonicalUrl,
        title: candidate.title,
        url: candidate.canonicalUrl,
        ...(candidate.competencyId ? { competencyId: candidate.competencyId } : {}),
        ...(candidate.competencyTitle ? { competencyTitle: candidate.competencyTitle } : {}),
        ...(candidate.review?.confidence !== undefined
          ? { confidence: candidate.review.confidence }
          : {}),
        ...(candidate.provider ? { provider: candidate.provider } : {}),
        ...(candidate.kind ? { kind: candidate.kind } : {}),
        // relevance = полезность по оценке LLM; score расширения — другая шкала, в политику не идёт
        ...(candidate.review?.usefulness !== undefined
          ? { relevance: candidate.review.usefulness }
          : {}),
        ...(candidate.review?.verdict === "accept" ||
        candidate.review?.verdict === "confirm" ||
        candidate.review?.verdict === "reject"
          ? { verdict: candidate.review.verdict }
          : {}),
        ...(candidate.review?.flags ? { flags: candidate.review.flags } : {}),
        ...(candidate.languages?.[0] === "ru" || candidate.languages?.[0] === "en"
          ? { language: candidate.languages[0] }
          : {}),
      }));

    if (materials.length === 0) {
      throw new StageError(
        `в журнале ${journalFile} нет принятых материалов (accept + confidence ≥ ${MIN_SOURCE_CONFIDENCE})`,
        "no_materials",
        false,
      );
    }

    return {
      output: stageOutputSchema.shape["research.collect"].parse({
        materials,
        source: { mode: "journal", journal: `data/learning-sources/${journalFile}` },
      }),
    };
  };
}

/** Стадии, подключённые к рантайму. Остальные помечаются blocked до своей очереди. */
export function createStageHandlers(
  root: string = process.cwd(),
  options: {
    store?: import("../materials/store.ts").MaterialsStore;
    publications?: import("../release/publication.ts").PublicationStore;
  } = {},
): Partial<Record<Stage, StageHandler>> {
  return {
    "research.plan": researchPlanHandler(root),
    "research.collect": researchCollectHandler(root),
    "review.materials": createReviewHandler(root, options),
    "rewrite.formulations": rewriteFormulationsHandler(root),
    "materials.attach": attachMaterialsHandler(root, options),
    "release.publish": publishReleaseHandler(root, options),
  };
}
