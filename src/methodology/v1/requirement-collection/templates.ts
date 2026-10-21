import type { SearchQuery } from "./types.ts";

const RU: Array<{ id: string; text: (profession: string) => string }> = [
  { id: "ru-key-skills", text: (profession) => `Ключевые навыки ${profession}` },
  { id: "ru-what-able", text: (profession) => `Что должен уметь ${profession}` },
  { id: "ru-specialist-requirements", text: (profession) => `Требования к специалисту ${profession}` },
  { id: "ru-competencies", text: (profession) => `Профессиональные компетенции ${profession}` },
  { id: "ru-duties", text: (profession) => `Обязанности ${profession}` },
];

const EN: Array<{ id: string; text: (profession: string) => string }> = [
  { id: "en-essential-skills", text: (profession) => `Essential skills ${profession}` },
  { id: "en-skills-competencies", text: (profession) => `Skills and competencies ${profession}` },
  { id: "en-what-does", text: (profession) => `What does a ${profession} do` },
  { id: "en-required-skills", text: (profession) => `Required skills for a ${profession}` },
];

/** Английские запросы появляются только при явной подписи. Название из каталога само не переводится. */
export function buildQueries(professionTitle: string, englishLabel?: string): SearchQuery[] {
  const russian = RU.map((template) => ({
    id: template.id,
    language: "ru" as const,
    text: template.text(professionTitle),
  }));
  const label = englishLabel?.trim();
  if (!label) return russian;
  const english = EN.map((template) => ({
    id: template.id,
    language: "en" as const,
    text: template.text(label),
  }));
  return [...russian, ...english];
}
