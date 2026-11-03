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

export const MATERIAL_REVIEW_PROMPT_VERSION = "material-review-v1";

const MATERIAL_REVIEW_SYSTEM = [
  "<system_instructions>",
  "Ты — методолог каталога компетенций AXIONA. Ты решаешь, стоит ли принимать найденный материал (курс, видео, статью) для освоения компетенции.",
  "",
  "ПРАВИЛА:",
  "1. Суди только по переданным метаданным и короткому snippet. Не выдумывай содержание, цитаты, автора, цену и лицензию.",
  "2. Оценивай пригодность для освоения компетенции: точность темы, практическую ценность, актуальность, формат. Не оценивай «научность» и уровень владения.",
  "3. Агрегаторы, лендинги «купи курс», вакансии и карьерные страницы — reject с причиной.",
  "4. Сомнительное — confirm, а не accept: лучше бейдж «Подтвердить», чем тихая ошибка.",
  "5. Если snippet пустой или не относится к теме — confirm/reject, не accept.",
  "6. whyUseful — одно короткое предложение для карточки, без маркетинга.",
  "7. Не меняй и не придумывай URL, доступ, цену, язык. Верни только валидный JSON без markdown.",
  "",
  "СХЕМА: {verdict:accept|confirm|reject, confidence:0..1, usefulness:0..1, whyUseful, reason, flags:[]}",
  "flags: generic, no_practice, marketing, paywall, outdated, no_snippet, wrong_language, duplicate, off_topic.",
  "</system_instructions>",
].join("\n");

export const SOURCE_REVIEW_PROMPT_VERSION = "source-review-v1";

const SOURCE_REVIEW_SYSTEM = [
  "<system_instructions>",
  "Ты — методолог каталога компетенций AXIONA. Ты решаешь, стоит ли добавить найденный сайт/канал в ресурсную базу как учебный источник для компетенции.",
  "",
  "ПРАВИЛА:",
  "1. Суди только по переданным данным: домен, URL, название, описание, запрос. Не выдумывай содержание сайта.",
  "2. Источник должен учить теме: курсы, школа, документация, профильный блог/канал. Новости, вакансии, магазины, справочные сноски — reject.",
  "3. Неизвестный домен без признаков обучения — confirm, а не accept.",
  "4. Агрегаторы и подборки — confirm (не доказательство), если не первичный источник.",
  "5. whyUseful — коротко, что именно даёт источник по теме.",
  "6. Верни только валидный JSON без markdown.",
  "",
  "СХЕМА: {verdict:accept|confirm|reject, confidence:0..1, usefulness:0..1, whyUseful, reason, flags:[]}",
  "flags: generic, no_practice, marketing, paywall, outdated, no_snippet, wrong_language, duplicate, off_topic.",
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

export function buildMaterialReviewPrompt(params: {
  competency: { id: string; title: string; definition: string };
  components: CompetencyComponent[];
  tags: TagRecord[];
  material: Material;
  format: string;
  acceptedInFormat: number;
  target: number;
}): BuiltPrompt {
  const payload = {
    competency: params.competency,
    components: params.components.map((component) => ({
      id: component.id,
      title: component.title,
      definition: component.definition,
    })),
    tags: params.tags.map((tag) => ({ id: tag.id, title: tag.title, kind: tag.kind })),
    material: {
      title: params.material.title,
      kind: params.material.kind,
      provider: params.material.provider,
      language: params.material.language,
      access: params.material.access,
      description: params.material.description,
      snippet: params.material.snippet ?? "",
      publishedAt: params.material.publishedAt ?? "",
    },
    format: params.format,
    coverage: { accepted: params.acceptedInFormat, target: params.target },
  };
  const user = [
    "<source_evidence>",
    JSON.stringify(payload, null, 2),
    "</source_evidence>",
    "",
    "Вынеси вердикт по материалу и верни только JSON.",
  ].join("\n");
  return finish(MATERIAL_REVIEW_PROMPT_VERSION, MATERIAL_REVIEW_SYSTEM, user);
}

export function buildSourceReviewPrompt(params: {
  competency: { title: string; definition: string; components: string[] };
  candidate: {
    url: string;
    domain: string;
    title: string;
    snippet?: string;
    query: string;
    kind: string;
    languages: string[];
    score: number;
  };
}): BuiltPrompt {
  const user = [
    "<source_evidence>",
    JSON.stringify(
      {
        competency: params.competency,
        candidate: params.candidate,
      },
      null,
      2,
    ),
    "</source_evidence>",
    "",
    "Реши, стоит ли добавить источник в ресурсную базу. Верни только JSON.",
  ].join("\n");
  return finish(SOURCE_REVIEW_PROMPT_VERSION, SOURCE_REVIEW_SYSTEM, user);
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

export const DESCRIPTION_PROMPT_VERSION = "descriptions-v1";

const DESCRIPTION_SYSTEM = [
  "<system_instructions>",
  "Ты — редактор профессиональных описаний AXIONA COS. Ты пишешь короткие точные описания для карточек профессий, компетенций, знаний и навыков.",
  "",
  "ПРАВИЛА:",
  "1. Используй только факты из переданного контекста: названия, определения, компоненты, источники. Не придумывай инструменты, стандарты, цифры, цитаты и факты.",
  "2. Пиши по-русски, одна строка, 1–2 предложения, без markdown и без списков.",
  "3. Для профессии: опиши фокус специалиста и его вклад в продукт, а не «структуру компетенций».",
  "4. Для компетенции: что специалист способен понимать/делать, в каком контексте и с каким результатом.",
  "5. Для знания: объясни суть понятия/принципа и зачем оно нужно в работе. Не начинай с «Понимание:» и не повторяй название.",
  "6. Для навыка: действие + объект + критерий качества. Не начинай с «Умение:» и не повторяй название.",
  "7. Не перечисляй стек инструментов; инструменты упоминай только если без них теряется смысл.",
  "8. Не начинай описание с названия сущности и не повторяй его. Соблюдай длину: профессия 90–300 символов, компетенция 80–350, знание/навык 60–220.",
  "9. Верни только валидный JSON без markdown.",
  "",
  "СХЕМА: {professionDescription?} или {competencyDefinition?, tags:[{id,definition}]}",
  "</system_instructions>",
].join("\n");

export function buildProfessionDescriptionPrompt(params: {
  profession: { id: string; title: string; titleEn?: string };
  currentDescription?: string;
  sections: Array<{ title: string; definition: string; competencies: Array<{ title: string; definition: string }> }>;
  sourceTitles: string[];
}): BuiltPrompt {
  const payload = {
    task: "profession_description",
    profession: params.profession,
    currentDescription: params.currentDescription ?? "",
    sections: params.sections,
    sourceTitles: params.sourceTitles.slice(0, 12),
  };
  return finish(
    DESCRIPTION_PROMPT_VERSION,
    DESCRIPTION_SYSTEM,
    ["<context>", JSON.stringify(payload, null, 2), "</context>", "", "Напиши описание профессии по схеме. Верни только JSON."].join("\n"),
  );
}

export function buildCompetencyDescriptionPrompt(params: {
  profession: { id: string; title: string };
  competency: { id: string; title: string; titleEn?: string; definition: string };
  blocks: Array<{
    title: string;
    definition: string;
    components: Array<{ title: string; definition: string }>;
  }>;
  tags: Array<{ id: string; title: string; kind: "knowledge" | "skill"; definition: string; blockTitle: string }>;
  sourceTitles: string[];
}): BuiltPrompt {
  const payload = {
    task: "competency_and_tags",
    profession: params.profession,
    competency: params.competency,
    blocks: params.blocks,
    tags: params.tags,
    sourceTitles: params.sourceTitles.slice(0, 12),
  };
  return finish(
    DESCRIPTION_PROMPT_VERSION,
    DESCRIPTION_SYSTEM,
    ["<context>", JSON.stringify(payload, null, 2), "</context>", "", "Напиши определение компетенции и описания знаний/навыков по схеме. Верни только JSON."].join("\n"),
  );
}
