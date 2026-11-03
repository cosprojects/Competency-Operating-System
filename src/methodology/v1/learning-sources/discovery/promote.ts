import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { LearningSourceRecord, LearningSourceRegistry } from "../types.ts";
import { checkLearningSource } from "../audit.ts";
import { hashId, slugify } from "../../competency/sources/common.ts";
import { canonicalizeSourceUrl, domainOf } from "./candidates.ts";
import type { SourceCandidate } from "./types.ts";

interface LinksFile {
  linksVersion?: string;
  updatedAt?: string;
  description?: string;
  links: Array<{ competencyId: string; sourceIds: string[]; rationale?: string }>;
}

interface ReleaseSourceReviewFile {
  reviewVersion: string;
  releaseId: string;
  updatedAt: string;
  reviewedBy: string | null;
  decisions: Array<{
    professionId?: string;
    competencyId: string;
    sourceId: string;
    decision: "accepted" | "replaced" | "excluded";
    reason?: string;
    reviewedBy?: string;
    reviewedAt?: string;
  }>;
  notes?: string[];
}

export interface PromoteOptions {
  write: boolean;
  audit: boolean;
  reviewDecisions: boolean;
  today: string;
  releaseId?: string;
}

export interface PromoteResult {
  added: LearningSourceRecord[];
  linkedExisting: Array<{ sourceId: string; competencyId: string }>;
  skipped: string[];
  report: string;
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function pathTitle(candidate: SourceCandidate): string {
  try {
    const path = new URL(candidate.canonicalUrl).pathname.replace(/^\/+|\/+$/g, "");
    if (!path) return "";
    const last = path.split("/").filter(Boolean).at(-1) ?? "";
    return decodeURIComponent(last).replace(/[-_]+/g, " ").replace(/\.(html?|php|aspx?)$/i, "").trim();
  } catch {
    return "";
  }
}

function titleFor(candidate: SourceCandidate): string {
  const fromPath = pathTitle(candidate);
  const base = candidate.domain;
  const title = fromPath ? `${base} — ${fromPath}` : `${base} — ${candidate.competencyTitle}`;
  return title.slice(0, 160);
}

const SITE_LEVEL_KINDS = new Set(["school", "course-platform", "blog", "video-channel", "video-playlist", "portfolio-case", "aggregator"]);

function sourceUrlFor(candidate: SourceCandidate): string {
  if (!SITE_LEVEL_KINDS.has(candidate.kind)) return candidate.canonicalUrl;
  try {
    return `${new URL(candidate.canonicalUrl).origin}/`;
  } catch {
    return candidate.canonicalUrl;
  }
}

function uniqueSourceId(candidate: SourceCandidate, used: Set<string>): string {
  const pathPart = new URL(candidate.canonicalUrl).pathname.replace(/^\/+|\/+$/g, "");
  const base = slugify(`${candidate.domain} ${pathPart}`.trim(), "source");
  let id = base.length > 60 ? `${slugify(candidate.domain, "source")}-${hashId("src", candidate.canonicalUrl).slice(4, 10)}` : base;
  if (used.has(id)) id = `${id}-${hashId("src", candidate.canonicalUrl).slice(4, 10)}`;
  used.add(id);
  return id;
}

/**
 * Промоушен найденных кандидатов в реестр учебных источников.
 *
 * - домен уже в реестре → связываем существующий источник с компетенцией (без дубля);
 * - новый домен → запись `status: planned`, `discoveredBy: search`;
 * - с `--audit` — HTTP-проверка и перевод в `active`/`blocked`;
 * - с `--review-decisions` — AI-assisted решения source review для публикационного gate.
 */
export async function promoteCandidates(
  root: string,
  domain: string,
  professionId: string,
  candidates: SourceCandidate[],
  options: PromoteOptions,
): Promise<PromoteResult> {
  const registryPath = path.join(root, "src/methodology/v1/learning-sources/registry.json");
  const linksPath = path.join(root, "src/methodology/v1/competency/model/learning-source-links.json");
  const registry = await readJson<LearningSourceRegistry>(registryPath);
  const linksFile = await readJson<LinksFile>(linksPath);
  const usedIds = new Set(registry.sources.map((source) => source.id));
  const existingByDomain = new Map(
    registry.sources.map((source) => [domainOf(source.url), source.id] as const),
  );
  const existingByCanonical = new Map(
    registry.sources
      .map((source) => [canonicalizeSourceUrl(source.url), source.id] as const)
      .filter((entry): entry is readonly [string, string] => Boolean(entry[0])),
  );
  const linkByCompetency = new Map<string, { sourceIds: Set<string>; rationale: string }>();
  for (const link of linksFile.links) {
    const existing = linkByCompetency.get(link.competencyId);
    if (existing) {
      for (const sourceId of link.sourceIds) existing.sourceIds.add(sourceId);
      existing.rationale = [existing.rationale, link.rationale ?? ""].filter(Boolean).join("; ");
    } else {
      linkByCompetency.set(link.competencyId, {
        sourceIds: new Set(link.sourceIds),
        rationale: link.rationale ?? "",
      });
    }
  }
  const added: LearningSourceRecord[] = [];
  const linkedExisting: Array<{ sourceId: string; competencyId: string }> = [];
  const skipped: string[] = [];

  for (const candidate of candidates) {
    const existingId =
      existingByCanonical.get(candidate.canonicalUrl) ?? existingByDomain.get(candidate.domain);
    if (existingId) {
      const link = linkByCompetency.get(candidate.competencyId) ?? {
        sourceIds: new Set<string>(),
        rationale: "",
      };
      if (!link.sourceIds.has(existingId)) {
        link.sourceIds.add(existingId);
        link.rationale = [link.rationale, candidate.reason].filter(Boolean).join("; ");
        linkByCompetency.set(candidate.competencyId, link);
        linkedExisting.push({ sourceId: existingId, competencyId: candidate.competencyId });
      }
      continue;
    }
    if (!candidate.canonicalUrl.startsWith("https://")) {
      skipped.push(`${candidate.url}: не https`);
      continue;
    }
    const id = uniqueSourceId(candidate, usedIds);
    const sourceUrl = sourceUrlFor(candidate);
    const record: LearningSourceRecord = {
      id,
      title: titleFor(candidate),
      url: sourceUrl,
      kind: candidate.kind,
      professionIds: [professionId],
      languages: candidate.languages,
      access: "unknown",
      authority: candidate.kind === "aggregator" ? "aggregator" : "secondary",
      status: "planned",
      topics: [candidate.query],
      discoveredBy: "search",
      lastChecked: options.today,
      summary: `Авто-подбор по теме «${candidate.competencyTitle}»: ${candidate.reason}`,
      notes: `Авто-расширение (${candidate.provider}); ${candidate.reason}`,
    };
    if (options.audit) {
      const audit = await checkLearningSource(record);
      record.lastChecked = audit.checkedAt;
      if (audit.httpStatus !== undefined) record.httpStatus = audit.httpStatus;
      if (audit.finalUrl) record.finalUrl = audit.finalUrl;
      const ok = audit.httpStatus !== undefined && audit.httpStatus >= 200 && audit.httpStatus < 400;
      record.status = ok ? "active" : audit.status === "blocked" ? "blocked" : "planned";
      if (audit.title) {
        record.title = audit.title.slice(0, 160);
        record.summary = audit.title.slice(0, 300);
      }
    }
    registry.sources.push(record);
    existingByDomain.set(record.url ? domainOf(record.url) : candidate.domain, record.id);
    if (record.url) {
      const canonical = canonicalizeSourceUrl(record.url);
      if (canonical) existingByCanonical.set(canonical, record.id);
    }
    added.push(record);
    const link = linkByCompetency.get(candidate.competencyId) ?? {
      sourceIds: new Set<string>(),
      rationale: "",
    };
    link.sourceIds.add(record.id);
    link.rationale = [link.rationale, candidate.reason].filter(Boolean).join("; ");
    linkByCompetency.set(candidate.competencyId, link);
  }

  if (options.write) {
    registry.updatedAt = options.today;
    await writeJson(registryPath, registry);
    if (linksFile.links.length > 0) {
      linksFile.updatedAt = options.today;
    }
    linksFile.links = [...linkByCompetency.entries()].map(([competencyId, link]) => ({
      competencyId,
      sourceIds: [...link.sourceIds],
      rationale: link.rationale,
    }));
    await writeJson(linksPath, linksFile);
    if (options.reviewDecisions && added.length > 0) {
      const reviewPath = path.join(root, "release", `${options.releaseId ?? "beta-1"}-source-review.json`);
      const review = await readJson<ReleaseSourceReviewFile>(reviewPath).catch(() => undefined);
      if (review) {
        const keys = new Set(
          review.decisions.map(
            (decision) =>
              `${decision.professionId ?? "*"}|${decision.competencyId}|${decision.sourceId}`,
          ),
        );
        for (const candidate of candidates) {
          const record = added.find((item) => domainOf(item.url) === candidate.domain);
          if (!record || record.status !== "active") continue;
          const key = `${professionId}|${candidate.competencyId}|${record.id}`;
          if (keys.has(key)) continue;
          keys.add(key);
          review.decisions.push({
            professionId,
            competencyId: candidate.competencyId,
            sourceId: record.id,
            decision: "accepted",
            reason: `Авто-расширение: ${candidate.reason}`,
            reviewedBy: "sources-expand-v1",
            reviewedAt: options.today,
          });
        }
        review.updatedAt = options.today;
        await writeJson(reviewPath, review);
      }
    }
  }

  const lines: string[] = [];
  lines.push(`# Авто-расширение ресурсной базы: ${professionId}`);
  lines.push("");
  lines.push(`Режим: ${options.write ? "запись" : "dry-run"}; аудит: ${options.audit ? "да" : "нет"}.`);
  lines.push(`Новых источников: ${added.length}; связали существующие: ${linkedExisting.length}; пропущено: ${skipped.length}.`);
  lines.push("");
  if (added.length > 0) {
    lines.push("## Новые источники");
    lines.push("");
    for (const record of added) {
      lines.push(`- ${record.title} — ${record.url} · ${record.kind} · ${record.status}`);
    }
    lines.push("");
  }
  if (linkedExisting.length > 0) {
    lines.push("## Связали существующие");
    lines.push("");
    for (const link of linkedExisting) lines.push(`- ${link.competencyId} → ${link.sourceId}`);
    lines.push("");
  }
  if (skipped.length > 0) {
    lines.push("## Пропущено");
    lines.push("");
    for (const item of skipped.slice(0, 30)) lines.push(`- ${item}`);
    lines.push("");
  }
  const report = `${lines.join("\n")}\n`;
  if (options.write) {
    const out = path.join(root, "data/learning-sources", `expansion-${professionId.split(".").pop()}-${options.today}.md`);
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, report, "utf8");
  }
  return { added, linkedExisting, skipped, report };
}
