import type { GuideContent, GuideDoc, GuideSection } from "./types.ts";

/** Валидатор разбора: структура, длина, язык, запреты и признаки обрыва. */
export interface GuideValidation {
  ok: boolean;
  issues: string[];
}

/** Убирает строку «Источник: …» — источники показываются отдельным блоком в интерфейсе. */
export function stripSourceLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => !/^\s*источник\s*[::]/i.test(line))
    .join("\n")
    .trim();
}

/** Достаёт JSON-разбор из ответа модели (модель может обернуть его в текст). */
export function parseGuideContent(raw: string): GuideContent | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const data = parsed as { status?: unknown; sections?: unknown };
  if (data.status === "no_data") return { status: "no_data" };
  if (!Array.isArray(data.sections)) return null;
  const sections: GuideSection[] = [];
  for (const entry of data.sections) {
    const section = entry as { heading?: unknown; text?: unknown };
    if (typeof section.heading !== "string" || typeof section.text !== "string") return null;
    sections.push({ heading: section.heading.trim(), text: stripSourceLines(section.text).trim() });
  }
  return { status: "ok", sections };
}

/** Текст разбора из секций — для отчёта и проверки привязки к источнику. */
export function renderGuideText(doc: GuideDoc): string {
  return doc.sections.map((section) => `${section.heading}\n\n${section.text}`).join("\n\n");
}

const BANNED = [
  { re: /уровень/i, issue: "обещает уровень" },
  { re: /оценк/i, issue: "обещает оценку" },
  { re: /тест на/i, issue: "обещает тест" },
  { re: /\bNO_DATA\b/i, issue: "маркер отсутствия данных" },
];

function validateText(text: string, min: number, max: number, prefix: string, issues: string[]): void {
  if (text.length < min) issues.push(`${prefix}: короче ${min} символов`);
  if (text.length > max) issues.push(`${prefix}: длиннее ${max} символов`);
  const cyr = (text.match(/[а-яё]/gi) ?? []).length;
  const lat = (text.match(/[a-z]/gi) ?? []).length;
  if (cyr / (cyr + lat || 1) < 0.5) issues.push(`${prefix}: мало русского текста`);
  if (/https?:\/\//i.test(text)) issues.push(`${prefix}: ссылка внутри текста`);
  if (!/[.!?»)]$/.test(text.trim())) issues.push(`${prefix}: обрыв в конце`);
  for (const rule of BANNED) if (rule.re.test(text)) issues.push(`${prefix}: ${rule.issue}`);
}

/** Разбор — 3–6 разделов, каждый 180–1400 символов, весь текст 900–6000. */
export function validateGuideDoc(doc: GuideDoc): GuideValidation {
  const issues: string[] = [];
  if (doc.sections.length < 3) issues.push("меньше трёх разделов");
  if (doc.sections.length > 6) issues.push("больше шести разделов");
  const headings = new Set<string>();
  for (const [index, section] of doc.sections.entries()) {
    const prefix = `раздел ${index + 1}`;
    if (section.heading.length < 3 || section.heading.length > 70) issues.push(`${prefix}: плохой заголовок`);
    if (headings.has(section.heading.toLowerCase())) issues.push(`${prefix}: повтор заголовка`);
    headings.add(section.heading.toLowerCase());
    validateText(section.text, 180, 1400, prefix, issues);
  }
  const total = doc.sections.reduce((sum, section) => sum + section.heading.length + section.text.length, 0);
  if (total < 900) issues.push("разбор короче 900 символов");
  if (total > 6000) issues.push("разбор длиннее 6000 символов");
  return { ok: issues.length === 0, issues };
}
