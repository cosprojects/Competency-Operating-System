import type { MappingFile, MappingRule, OutOfScopeRule } from "./types.ts";
import type { TaxonomyIndex } from "./taxonomy.ts";

/** Сравнение названий без регистра и лишних пробелов. Смысл не меняет. */
export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Сравнение цитат: без регистра, пунктуации и лишних пробелов. */
export function normalizeQuote(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d«»"']/g, "")
    .replace(/[^a-zа-яё0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
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
    const extraTargets = rule.additionalTargetIds ?? [];
    if (new Set(extraTargets).size !== extraTargets.length) {
      errors.push(`«${rule.escoTitle}»: повтор additionalTargetIds`);
    }
    for (const extra of extraTargets) {
      if (extra === rule.targetId) errors.push(`«${rule.escoTitle}»: additionalTargetIds повторяет primary`);
      if (!taxonomy.targets.has(extra)) {
        errors.push(`«${rule.escoTitle}»: дополнительной цели «${extra}» нет в таксономии`);
      }
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
    for (const extra of rule.additionalTargetIds ?? []) {
      const extraTarget = taxonomy.targets.get(extra);
      if (!extraTarget) {
        errors.push(`universalSkills «${key}»: дополнительной цели «${extra}» нет в таксономии`);
      } else if (!extraTarget.leafId || extraTarget.scope !== "universal") {
        errors.push(`universalSkills «${key}»: дополнительная цель «${extra}» должна быть универсальным листом`);
      }
    }
    if ((rule.additionalTargetIds ?? []).includes(rule.targetId)) {
      errors.push(`universalSkills «${key}»: additionalTargetIds повторяет primary`);
    }
    if (universalKeys.has(key)) errors.push(`universalSkills: повтор записи «${key}»`);
    universalKeys.add(key);
    if (!rule.basis) errors.push(`universalSkills «${key}»: нет basis`);
  }

  if (mapping.onet) {
    const onet = mapping.onet;
    if (!onet.databaseVersion) errors.push("onet: нет databaseVersion");
    if (!onet.csvUrl) errors.push("onet: нет csvUrl");
    if (!onet.license) errors.push("onet: нет license");
    if (onet.occupations.length === 0) errors.push("onet: нет occupations");
    const socCodes = new Set<string>();
    for (const occupation of onet.occupations) {
      if (!/^\d{2}-\d{4}\.\d{2}$/.test(occupation.socCode)) {
        errors.push(`onet «${occupation.socCode}»: код не похож на O*NET-SOC`);
      }
      if (socCodes.has(occupation.socCode)) errors.push(`onet: повтор O*NET-SOC «${occupation.socCode}»`);
      socCodes.add(occupation.socCode);
    }
    if (onet.tools.length === 0) errors.push("onet: нет tools");
    const toolNames = new Set<string>();
    for (const tool of onet.tools) {
      if (!tool.workplaceExample) errors.push("onet: инструмент без workplaceExample");
      if (toolNames.has(normalizeTitle(tool.workplaceExample))) {
        errors.push(`onet: повтор инструмента «${tool.workplaceExample}»`);
      }
      toolNames.add(normalizeTitle(tool.workplaceExample));
      if (!taxonomy.targets.has(tool.targetId)) {
        errors.push(`onet «${tool.workplaceExample}»: цели «${tool.targetId}» нет в таксономии`);
      }
      if (!tool.basis) errors.push(`onet «${tool.workplaceExample}»: нет basis`);
    }
  }

  const modelLeafIds = new Set<string>();
  for (const rule of mapping.modelSkills ?? []) {
    const target = taxonomy.targets.get(rule.leafId);
    if (!target?.leafId) errors.push(`modelSkills «${rule.leafId}»: цель должна быть листом`);
    if (modelLeafIds.has(rule.leafId)) errors.push(`modelSkills: повтор листа «${rule.leafId}»`);
    modelLeafIds.add(rule.leafId);
    if (!rule.nodeId) errors.push(`modelSkills «${rule.leafId}»: нет nodeId`);
    if (!rule.quote) errors.push(`modelSkills «${rule.leafId}»: нет quote`);
    if (!rule.basis) errors.push(`modelSkills «${rule.leafId}»: нет basis`);
  }

  const guidanceIds = new Set<string>();
  for (const source of mapping.guidanceSources ?? []) {
    if (!source.id) errors.push("guidanceSources: пустой id");
    if (guidanceIds.has(source.id)) errors.push(`guidanceSources: повтор id «${source.id}»`);
    guidanceIds.add(source.id);
    if (!source.url || !/^https?:\/\//.test(source.url)) errors.push(`guidanceSources «${source.id}»: плохой url`);
    if (source.fetchUrl !== undefined && !/^https?:\/\//.test(source.fetchUrl)) {
      errors.push(`guidanceSources «${source.id}»: плохой fetchUrl`);
    }
    if (!source.license) errors.push(`guidanceSources «${source.id}»: нет license`);
  }
  const guidanceKeys = new Set<string>();
  for (const rule of mapping.guidanceSkills ?? []) {
    if (!guidanceIds.has(rule.sourceId)) {
      errors.push(`guidanceSkills «${rule.sourceId}»: источника нет в guidanceSources`);
    }
    const target = taxonomy.targets.get(rule.targetId);
    if (!target?.leafId) errors.push(`guidanceSkills «${rule.targetId}»: цель должна быть листом`);
    const key = `${rule.sourceId}\u0000${rule.targetId}\u0000${rule.quote}`;
    if (guidanceKeys.has(key)) errors.push(`guidanceSkills: повтор правила «${key}»`);
    guidanceKeys.add(key);
    if (!rule.quote) errors.push(`guidanceSkills «${rule.targetId}»: нет quote`);
    if (!rule.basis) errors.push(`guidanceSkills «${rule.targetId}»: нет basis`);
  }

  const watchlistLeafIds = new Set<string>();
  for (const rule of mapping.watchlist ?? []) {
    const target = taxonomy.targets.get(rule.leafId);
    if (!target?.leafId) errors.push(`watchlist «${rule.leafId}»: цель должна быть листом`);
    if (watchlistLeafIds.has(rule.leafId)) errors.push(`watchlist: повтор листа «${rule.leafId}»`);
    watchlistLeafIds.add(rule.leafId);
    if (!rule.reason) errors.push(`watchlist «${rule.leafId}»: нет reason`);
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
