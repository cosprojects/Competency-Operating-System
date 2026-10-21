import type { FetchLike } from "../candidate-parser/types.ts";
import { normalizeQuote } from "./mapping.ts";

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&ldquo;": "“",
  "&rdquo;": "”",
};

/** Грубое, но детерминированное превращение HTML в текст. Разметка не доказательство. */
export function htmlToText(html: string): string {
  let text = html;
  text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<!--[\s\S]*?-->/g, " ");
  text = text.replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, " ");
  text = text.replace(/<br\s*\/?>/gi, " ");
  text = text.replace(/<[^>]+>/g, " ");
  for (const [entity, value] of Object.entries(ENTITIES)) {
    text = text.split(entity).join(value);
  }
  text = text.replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
  return text.replace(/\s+/g, " ").trim();
}

export async function readGuidancePage(fetchImpl: FetchLike, url: string): Promise<string> {
  const response = await fetchImpl(url, {
    headers: { Accept: "text/html,application/xhtml+xml" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Руководство ответило ${response.status} на ${url}`);
  const candidate = response as unknown as { text?: () => Promise<string> };
  if (typeof candidate.text !== "function") {
    throw new Error(`Руководство не дало текст страницы ${url}`);
  }
  return htmlToText(await candidate.text());
}

/** GOV.UK Content API отдаёт JSON с HTML в details.body; обычные страницы — HTML. */
export function guidanceTextFromResponse(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as {
        details?: { body?: unknown };
        body?: unknown;
      };
      const body = parsed.details?.body ?? parsed.body;
      if (typeof body === "string") return htmlToText(body);
    } catch {
      // не JSON — читаем как HTML
    }
  }
  return htmlToText(raw);
}

export function pageContainsQuote(pageText: string, quote: string): boolean {
  const normalizedPage = normalizeQuote(pageText);
  const normalizedQuote = normalizeQuote(quote);
  return normalizedQuote.length > 0 && normalizedPage.includes(normalizedQuote);
}
