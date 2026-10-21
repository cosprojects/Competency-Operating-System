import type { CompetencyComponent, Material, TagRecord } from "../types.ts";
import { hashId } from "../sources/common.ts";

export const PROMPT_VERSION = "competency-v1";

const CANDIDATE_SYSTEM = [
  "<system_instructions>",
  "Ты — методолог каталога компетенций AXIONA. Ты получаешь теги (навыки/знания) одной профессии и предлагаешь группы-компетенции.",
  "",
  "ПРАВИЛА:",
  "1. Используй только переданные tagIds. Не придумывай теги и источники.",
  "2. Инструменты (kind=tool) не являются компетенциями и не входят в tagIds кандидата.",
  "3. Каждый кандидат объединяет 2–30 тегов по одному предмету работы. Соседство тем и общее слово группой не считаются.",
  "4. Не оценивай важность, уровень и качество. Не добавляй поля вне схемы.",
  "5. Каждый входной тег либо входит в одного кандидата, либо в unassignedTagIds.",
  "6. Названия и определения — по-русски; titleEn — по-английски, если он очевиден.",
  "7. Верни только валидный JSON без markdown.",
  "",
  "СХЕМА: {candidates:[{title,titleEn?,aliases,tagIds,definition,rationale,scopeHint}], unassignedTagIds:[]}",
  "</system_instructions>",
].join("\n");

const BLOCK_SYSTEM = [
  "<system_instructions>",
  "Ты — методолог каталога компетенций AXIONA. Ты получаешь кандидата в компетенцию и его теги. Нужно предложить структуру компетенции.",
  "",
  "ПРАВИЛА:",
  "1. 2–8 компонентов; в каждом 1–12 тегов (навыков/знаний).",
  "2. Тег: title, kind=knowledge|skill, definition (1–3 предложения), evidenceTagIds (только id из входа), modelProposal.",
  "3. modelProposal=true, если тезис не выводится напрямую из переданных источников; иначе false и evidenceTagIds не пуст.",
  "4. Не выдумывай источники, URL, цитаты и цифры. Инструменты не становятся тегами знаний.",
  "5. Не оценивай уровень, важность и качество. Не добавляй поля вне схемы.",
  "6. Компоненты — разделы предмета (например: физика цвета, физиология восприятия). Теги — конкретные знания/навыки внутри.",
  "7. Верни только валидный JSON без markdown.",
  "",
  "СХЕМА: {title,titleEn?,aliases,definition,scope,components:[{title,definition,items:[{title,kind,definition,evidenceTagIds,modelProposal}]}],unresolved}",
  "</system_instructions>",
].join("\n");

const MATERIAL_SYSTEM = [
  "<system_instructions>",
  "Ты — методист каталога компетенций AXIONA. Ты сопоставляешь материалы (статьи, курсы, видео) с компетенцией, её компонентами и тегами.",
  "",
  "ПРАВИЛА:",
  "1. Используй только переданные id материалов и id компетенции/компонентов/тегов.",
  "2. Ставь связь только если название/описание/фрагмент материала действительно относится к предмету. Соседство слов не доказательство.",
  "3. relevance — 0..1, описательная. modelProposal=true, если связь не подтверждается snippet.",
  "4. Не придумывай URL, названия, цены, доступ и авторов. Не меняй access/price.",
  "5. Сомнительные материалы — в rejected с причиной.",
  "6. Верни только валидный JSON без markdown.",
  "",
  "СХЕМА: {links:[{competencyId,componentId?,tagId?,relevance,reason,modelProposal}], rejected:[]}",
  "</system_instructions>",
].join("\n");

export interface BuiltPrompt {
  system: string;
  user: string;
  version: string;
  inputHash: string;
}

function finish(version: string, system: string, user: string): BuiltPrompt {
  return { system, user, version, inputHash: hashId("llm", `${version}\n${system}\n${user}`) };
}

export function buildCandidatePrompt(params: {
  domain: string;
  professionTitles: string[];
  tags: TagRecord[];
  existingCatalogTitles: string[];
}): BuiltPrompt {
  const payload = {
    domain: params.domain,
    professions: params.professionTitles,
    existingCompetencies: params.existingCatalogTitles,
    tags: params.tags.map((tag) => ({
      id: tag.id,
      title: tag.title,
      kind: tag.kind,
      definition: tag.definition,
      professions: tag.professionIds,
    })),
  };
  const user = [
    "<source_evidence>",
    JSON.stringify(payload, null, 2),
    "</source_evidence>",
    "",
    "Сгруппируй теги в кандидаты компетенций по схеме. Не добавляй теги, которых нет во входе.",
    "Верни только JSON.",
  ].join("\n");
  return finish(PROMPT_VERSION, CANDIDATE_SYSTEM, user);
}

export function buildBlockPrompt(params: {
  candidateTitle: string;
  candidateDefinition: string;
  scopeHint: string;
  professionTitles: string[];
  tags: TagRecord[];
  existingCatalogTitles: string[];
}): BuiltPrompt {
  const payload = {
    candidate: {
      title: params.candidateTitle,
      definition: params.candidateDefinition,
      scopeHint: params.scopeHint,
      professions: params.professionTitles,
    },
    existingCompetencies: params.existingCatalogTitles,
    tags: params.tags.map((tag) => ({
      id: tag.id,
      title: tag.title,
      kind: tag.kind,
      definition: tag.definition,
    })),
  };
  const user = [
    "<source_evidence>",
    JSON.stringify(payload, null, 2),
    "</source_evidence>",
    "",
    "Построй блок компетенции по схеме. Каждый тег должен ссылаться на id из входа.",
    "Верни только JSON.",
  ].join("\n");
  return finish(PROMPT_VERSION, BLOCK_SYSTEM, user);
}

export function buildMaterialPrompt(params: {
  competency: { id: string; title: string; definition: string };
  components: CompetencyComponent[];
  tags: TagRecord[];
  materials: Material[];
}): BuiltPrompt {
  const payload = {
    competency: params.competency,
    components: params.components.map((component) => ({
      id: component.id,
      title: component.title,
      definition: component.definition,
    })),
    tags: params.tags.map((tag) => ({ id: tag.id, title: tag.title, kind: tag.kind })),
    materials: params.materials.map((material) => ({
      id: material.id,
      title: material.title,
      kind: material.kind,
      provider: material.provider,
      language: material.language,
      access: material.access,
      description: material.description,
      snippet: material.snippet ?? "",
    })),
  };
  const user = [
    "<source_evidence>",
    JSON.stringify(payload, null, 2),
    "</source_evidence>",
    "",
    "Сопоставь материалы с компетенцией/компонентами/тегами по схеме. Верни только JSON.",
  ].join("\n");
  return finish(PROMPT_VERSION, MATERIAL_SYSTEM, user);
}

const RECONCILE_SYSTEM = [
  "<system_instructions>",
  "Ты — методолог каталога компетенций AXIONA. Ты получаешь список уже предложенных кандидатов в компетенции. Нужно объединить только те, которые описывают один предмет работы.",
  "",
  "ПРАВИЛА:",
  "1. Используй только memberCandidateIds из входа. Не добавляй новых кандидатов и теги.",
  "2. Каждый входной id должен попасть ровно в одну группу или в unassignedCandidateIds.",
  "3. Объединяй только при явном совпадении предмета работы; общая тема/слово не основание.",
  "4. Если кандидат один — группа из одного допустима.",
  "5. Не оценивай качество, уровень и важность. Не добавляй поля вне схемы.",
  "6. Верни только валидный JSON без markdown.",
  "",
  "СХЕМА: {groups:[{title,titleEn?,memberCandidateIds}],unassignedCandidateIds:[]}. Определение и scope не возвращай: они выводятся из участников.",
  "</system_instructions>",
].join("\n");

export function buildReconcilePrompt(params: {
  candidates: Array<{ id: string; title: string; definition: string; tagCount: number; scopeHint: string }>;
  existingCatalogTitles: string[];
}): BuiltPrompt {
  const payload = {
    existingCompetencies: params.existingCatalogTitles,
    candidates: params.candidates,
  };
  const user = [
    "<source_evidence>",
    JSON.stringify(payload, null, 2),
    "</source_evidence>",
    "",
    "Объедини кандидатов по схеме. Верни только JSON.",
  ].join("\n");
  return finish(`${PROMPT_VERSION}-reconcile`, RECONCILE_SYSTEM, user);
}
