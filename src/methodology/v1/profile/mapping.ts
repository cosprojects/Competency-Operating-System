import type { MappingFile, MappingRule, OutOfScopeRule } from "./types.ts";
import type { TaxonomyIndex } from "./taxonomy.ts";

/** Сравнение названий без регистра и лишних пробелов. Смысл не меняет. */
export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

interface CompiledOutOfScope {
  rule: OutOfScopeRule;
  regex?: RegExp;
}

export interface MappingIndex {
  ruleByTitle: Map<string, MappingRule>;
  outOfScope: CompiledOutOfScope[];
}

export function indexMapping(mapping: MappingFile): MappingIndex {
  const ruleByTitle = new Map<string, MappingRule>();
  for (const rule of mapping.rules) ruleByTitle.set(normalizeTitle(rule.escoTitle), rule);
  const outOfScope: CompiledOutOfScope[] = mapping.outOfScope.map((rule) => {
    if (rule.regex) return { rule, regex: new RegExp(rule.regex) };
    return { rule };
  });
  return { ruleByTitle, outOfScope };
}

export function ruleFor(index: MappingIndex, title: string): MappingRule | undefined {
  return index.ruleByTitle.get(normalizeTitle(title));
}

export function outOfScopeReasonFor(index: MappingIndex, title: string): string | undefined {
  const normalized = normalizeTitle(title);
  for (const item of index.outOfScope) {
    const { rule } = item;
    if (rule.title && normalizeTitle(rule.title) === normalized) return rule.reason;
    if (item.regex && item.regex.test(title)) return rule.reason;
  }
  return undefined;
}

/** Пустой список — маппинг корректен. */
export function validateMapping(mapping: MappingFile, taxonomy: TaxonomyIndex): string[] {
  const errors: string[] = [];
  if (!mapping.mappingVersion) errors.push("mappingVersion не задан");
  if (!mapping.professionId) errors.push("professionId не задан");
  if (mapping.sourceOccupations.length === 0) errors.push("нет sourceOccupations");
  if (mapping.rules.length === 0) errors.push("нет правил сопоставления");

  const occupationIds = new Set<string>();
  const checkOccupation = (occupation: { id: string; uri: string; role: string }, where: string): void => {
    if (!occupation.id) errors.push(`${where}: пустой id`);
    if (occupationIds.has(occupation.id)) errors.push(`${where}: повтор занятия «${occupation.id}»`);
    occupationIds.add(occupation.id);
    if (!occupation.uri) errors.push(`${occupation.id}: пустой uri`);
    if (occupation.role !== "core" && occupation.role !== "supporting" && occupation.role !== "universal") {
      errors.push(`${occupation.id}: недопустимая роль «${occupation.role}»`);
    }
  };
  for (const occupation of mapping.sourceOccupations) checkOccupation(occupation, "sourceOccupations");
  for (const occupation of mapping.universalOccupations ?? []) {
    checkOccupation(occupation, "universalOccupations");
    if (occupation.role !== "universal") {
      errors.push(`${occupation.id}: в universalOccupations роль должна быть universal`);
    }
  }

  const seen = new Set<string>();
  for (const rule of mapping.rules) {
    const key = normalizeTitle(rule.escoTitle);
    if (!rule.escoTitle) errors.push("правило без escoTitle");
    if (seen.has(key)) errors.push(`повтор правила для «${rule.escoTitle}»`);
    seen.add(key);
    if (!taxonomy.targets.has(rule.targetId)) {
      errors.push(`«${rule.escoTitle}»: цели «${rule.targetId}» нет в таксономии`);
    }
    if (!rule.basis) errors.push(`«${rule.escoTitle}»: нет basis`);
  }

  const universalKeys = new Set<string>();
  for (const rule of mapping.universalSkills ?? []) {
    const hasUri = typeof rule.escoUri === "string" && rule.escoUri.length > 0;
    const hasTitle = typeof rule.escoTitle === "string" && rule.escoTitle.length > 0;
    if (!hasUri && !hasTitle) {
      errors.push("universalSkills: нужен escoUri или escoTitle");
    }
    const key = hasUri ? `uri:${rule.escoUri ?? ""}` : `title:${normalizeTitle(rule.escoTitle ?? "")}`;
    const target = taxonomy.targets.get(rule.targetId);
    if (!target) {
      errors.push(`universalSkills «${key}»: цели «${rule.targetId}» нет в таксономии`);
    } else if (!target.leafId || target.scope !== "universal") {
      errors.push(
        `universalSkills «${key}»: цель «${rule.targetId}» должна быть листом универсальной базы (scope: universal)`,
      );
    }
    if (universalKeys.has(key)) errors.push(`universalSkills: повтор записи «${key}»`);
    universalKeys.add(key);
    if (!rule.basis) errors.push(`universalSkills «${key}»: нет basis`);
  }

  let outOfScopeCount = 0;
  for (const rule of mapping.outOfScope) {
    outOfScopeCount += 1;
    const hasTitle = typeof rule.title === "string" && rule.title.length > 0;
    const hasRegex = typeof rule.regex === "string" && rule.regex.length > 0;
    if (hasTitle === hasRegex) {
      errors.push("outOfScope: нужно ровно одно из title/regex");
    }
    if (!rule.reason) errors.push("outOfScope: нет reason");
    if (hasRegex) {
      try {
        new RegExp(rule.regex ?? "");
      } catch {
        errors.push(`outOfScope: некорректный regex «${rule.regex ?? ""}»`);
      }
    }
  }
  if (outOfScopeCount === 0) errors.push("outOfScope пуст: нечем объяснить отброшенные навыки");

  return errors;
}
