import type { DescriptionIssue, DescriptionKind, DescriptionValidationInput } from "./types.ts";
import { DESCRIPTION_LIMITS } from "./types.ts";

const FORBIDDEN_PREFIX = /^(понимание|умение|знание|навык)\s*[:\-—]/i;
const BOILERPLATE = /структура компетенций|знания,\s*навыки и учебные материалы|общепрофессиональн/i;

function cyrillicRatio(text: string): number {
  const letters = [...text].filter((char) => /\p{L}/u.test(char));
  if (letters.length === 0) return 0;
  const cyrillic = letters.filter((char) => /\p{Script=Cyrillic}/u.test(char)).length;
  return cyrillic / letters.length;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Детерминированный quality bar для описаний (без LLM). */
export function validateDescription(
  text: string,
  input: DescriptionValidationInput,
): DescriptionIssue[] {
  const issues: DescriptionIssue[] = [];
  const value = normalize(text);
  const limits = DESCRIPTION_LIMITS[input.kind];
  const title = normalize(input.title);
  if (!value) {
    issues.push({ code: "empty", message: "пустое описание" });
    return issues;
  }
  if (value.length < limits.min) issues.push({ code: "too_short", message: `длина ${value.length}, минимум ${limits.min}` });
  if (value.length > limits.max) issues.push({ code: "too_long", message: `длина ${value.length}, максимум ${limits.max}` });
  if (value.includes("\n")) issues.push({ code: "multiline", message: "описание должно быть одной строкой" });
  if (!/[.!?]$/.test(value)) issues.push({ code: "no_sentence_end", message: "нет завершающей точки" });
  if (cyrillicRatio(value) < 0.5) issues.push({ code: "not_russian", message: "меньше половины букв — кириллица" });
  if (FORBIDDEN_PREFIX.test(value)) issues.push({ code: "forbidden_prefix", message: "префикс «Понимание:/Умение:»" });
  if (BOILERPLATE.test(value)) issues.push({ code: "boilerplate", message: "шаблонная формулировка" });
  const lower = value.toLowerCase();
  const titleLower = title.toLowerCase();
  if (lower === titleLower || lower === `${titleLower}.`) {
    issues.push({ code: "equals_title", message: "описание повторяет название" });
  } else if (lower.startsWith(titleLower) && /^[\s:—\-.,]/.test(lower.slice(titleLower.length))) {
    issues.push({ code: "starts_with_title", message: "описание начинается с названия сущности" });
  } else if (lower.startsWith(titleLower)) {
    const rest = lower.slice(titleLower.length).replace(/^[\s:—\-.,]+/, "");
    if (rest.length < 20) issues.push({ code: "restates_title", message: "описание начинается с названия и почти его повторяет" });
  }
  return issues;
}

export function isDescriptionValid(text: string, input: DescriptionValidationInput): boolean {
  return validateDescription(text, input).length === 0;
}

export function summarizeIssues(issues: DescriptionIssue[]): string {
  return issues.map((issue) => issue.message).join("; ");
}
