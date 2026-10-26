import type { LearningSourceAuditResult, LearningSourceRecord } from "./types.ts";

const UA = "Mozilla/5.0 (compatible; COS-LearningSourceAudit/0.1)";

export async function checkLearningSource(source: LearningSourceRecord): Promise<LearningSourceAuditResult> {
  const checkedAt = new Date().toISOString().slice(0, 10);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(source.url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
    });
    clearTimeout(timer);
    const text = await response.text();
    const title = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim();
    return {
      id: source.id,
      url: source.url,
      status: response.status >= 200 && response.status < 400 ? source.status : "blocked",
      httpStatus: response.status,
      finalUrl: response.url,
      ...(title ? { title: title.slice(0, 200) } : {}),
      checkedAt,
    };
  } catch (error) {
    return {
      id: source.id,
      url: source.url,
      status: "degraded",
      checkedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
