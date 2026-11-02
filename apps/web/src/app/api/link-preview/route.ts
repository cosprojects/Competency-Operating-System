import { NextResponse } from "next/server";
import { rateLimit, requestIpHash } from "@/lib/auth";
import { fetchLinkPreview } from "@/lib/link-preview";

export const runtime = "nodejs";

/**
 * Превью внешнего материала: og:image, заголовок и аннотация со страницы.
 * Кэшируем на CDN и в браузере на сутки — карточки материалов переиспользуют
 * одни и те же источники в разных компетенциях.
 */
export async function GET(request: Request) {
  const ipHash = requestIpHash(request);
  if (!rateLimit(`link-preview:${ipHash}`, 120, 60_000)) {
    return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
  }

  const url = new URL(request.url).searchParams.get("url")?.trim() ?? "";
  if (!url || url.length > 1000) {
    return NextResponse.json({ error: "Некорректный url" }, { status: 400 });
  }

  const preview = await fetchLinkPreview(url);
  return NextResponse.json(preview, {
    headers: {
      "cache-control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
