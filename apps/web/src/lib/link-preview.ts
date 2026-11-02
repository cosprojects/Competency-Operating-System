/**
 * Превью внешних материалов: картинка, название и описание со страницы источника.
 *
 * Зачем: в карточках материалов нужны изображение и аннотация, которые
 * подтягиваются с сайта, где лежит материал. Сеть на запросе — дорого и
 * ненадёжно, поэтому ответы кэшируются в памяти процесса, а страница
 * ограничивается по размеру и таймауту.
 */

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_HTML_BYTES = 300 * 1024;
const FETCH_TIMEOUT_MS = 6000;

const cache = new Map<string, { preview: LinkPreview; expiresAt: number }>();

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "::1" || host.startsWith("[::1]")) return true;
  if (/^fc00:|^fd00:|^fe80:/i.test(host)) return true;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const [first, second] = [Number(ipv4[1]), Number(ipv4[2])];
  if (first === 10 || first === 127) return true;
  if (first === 169 && second === 254) return true;
  if (first === 192 && second === 168) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  return false;
}

function normalizeUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (isPrivateHostname(url.hostname)) return null;
  return url;
}

function decodeEntities(value: string): string {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#34;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&#x2F;", "/")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .trim();
}

function extractMetaTags(html: string): Map<string, string> {
  const result = new Map<string, string>();
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of metaTags) {
    const keyMatch = tag.match(/(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i);
    const valueMatch = tag.match(/content\s*=\s*["']([^"']*)["']/i);
    const key = keyMatch?.[1];
    const value = valueMatch?.[1];
    if (!key || value === undefined) continue;
    if (!result.has(key.toLowerCase())) result.set(key.toLowerCase(), decodeEntities(value));
  }
  return result;
}

function cleanDescription(value: string): string {
  return decodeEntities(
    value
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " "),
  ).slice(0, 260);
}

function firstParagraph(html: string): string | undefined {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ");
  const paragraphs = body.match(/<p\b[^>]*>([\s\S]*?)<\/p>/gi) ?? [];
  for (const paragraph of paragraphs) {
    const text = cleanDescription(paragraph);
    if (text.replace(/<[^>]+>/g, "").length >= 80) return text;
  }
  return undefined;
}

function resolveImage(image: string | undefined, base: string): string | undefined {
  if (!image) return undefined;
  if (image.startsWith("data:")) return undefined;
  try {
    return new URL(decodeEntities(image), base).href;
  } catch {
    return undefined;
  }
}

async function readLimited(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let received = 0;
  let result = "";
  while (received < MAX_HTML_BYTES) {
    const chunk = await reader.read();
    if (chunk.done) break;
    received += chunk.value.byteLength;
    result += decoder.decode(chunk.value, { stream: true });
  }
  await reader.cancel().catch(() => undefined);
  return result;
}

export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview> {
  const empty: LinkPreview = { url: rawUrl };
  const url = normalizeUrl(rawUrl);
  if (!url) return empty;

  const cached = cache.get(url.href);
  if (cached && cached.expiresAt > Date.now()) return cached.preview;

  try {
    const response = await fetch(url.href, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "ru,en;q=0.8",
        "user-agent": "Mozilla/5.0 (compatible; AXIONA preview bot; +https://axiona.world)",
      },
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("text/html")) {
      cache.set(url.href, { preview: empty, expiresAt: Date.now() + CACHE_TTL_MS });
      return empty;
    }

    const html = await readLimited(response);
    const base = response.url || url.href;
    const meta = extractMetaTags(html);

    const title =
      meta.get("og:title") ??
      meta.get("twitter:title") ??
      (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
        ? decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "")
        : undefined) ??
      undefined;

    const description =
      meta.get("og:description") ??
      meta.get("twitter:description") ??
      (meta.get("description") ? cleanDescription(meta.get("description") ?? "") : undefined) ??
      firstParagraph(html);

    const preview: LinkPreview = {
      url: base,
      ...(title ? { title: title.slice(0, 200) } : {}),
      ...(description ? { description: description.slice(0, 260) } : {}),
      ...(resolveImage(meta.get("og:image") ?? meta.get("twitter:image"), base)
        ? { image: resolveImage(meta.get("og:image") ?? meta.get("twitter:image"), base) }
        : {}),
      ...(meta.get("og:site_name") ? { siteName: meta.get("og:site_name") ?? undefined } : {}),
    };

    cache.set(url.href, { preview, expiresAt: Date.now() + CACHE_TTL_MS });
    return preview;
  } catch {
    // Не кэшируем сетевые сбои: при следующем открытии попробуем снова.
    return empty;
  }
}
