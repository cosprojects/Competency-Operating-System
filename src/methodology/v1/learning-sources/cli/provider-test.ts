import { flagValue } from "../../competency/cli/common.ts";

/**
 * Проверка официальных провайдеров авто-расширения до запуска пайплайна.
 *
 *   npm run sources:provider-test -- --provider all
 *   npm run sources:provider-test -- --provider youtube --channel-id UC...
 *
 * Ничего не пишет в реестр и не печатает секреты: только доступность API,
 * коды ответов и признаки квоты/бот-защиты.
 */

const UA = "COS-LearningSourcesBot/0.1 (+https://github.com/cosprojects/Competency-Operating-System)";
const DEFAULT_CHANNEL = "UC_x5XG1OV2P6uZZ5FSM9Ttw"; // технический канал Google Developers для проверки RSS

interface CheckResult {
  provider: string;
  status: "ok" | "no_key" | "error" | "blocked";
  detail: string;
}

async function testWikipedia(): Promise<CheckResult> {
  try {
    const response = await fetch(
      "https://ru.wikipedia.org/w/api.php?action=query&list=search&srsearch=%D0%B0%D0%BD%D0%B8%D0%BC%D0%B0%D1%86%D0%B8%D1%8F&format=json&srlimit=1",
      { headers: { "user-agent": UA, accept: "application/json" } },
    );
    if (!response.ok) return { provider: "wikipedia", status: "error", detail: `HTTP ${response.status}` };
    const body = (await response.json()) as { query?: { search?: unknown[] } };
    return {
      provider: "wikipedia",
      status: "ok",
      detail: `MediaWiki API 200, результатов ${body.query?.search?.length ?? 0}; ключ не нужен`,
    };
  } catch (error) {
    return { provider: "wikipedia", status: "error", detail: error instanceof Error ? error.message : "ошибка" };
  }
}

async function testGithub(): Promise<CheckResult> {
  try {
    const response = await fetch(
      "https://api.github.com/search/repositories?q=motion%20design%20awesome&sort=stars&per_page=1",
      {
        headers: {
          "user-agent": UA,
          accept: "application/vnd.github+json",
          ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
        },
      },
    );
    if (response.status === 403 || response.status === 429) {
      return {
        provider: "github",
        status: "blocked",
        detail: `HTTP ${response.status}: лимит поиска (10/мин без токена). GITHUB_TOKEN поднимает лимит.`,
      };
    }
    if (!response.ok) return { provider: "github", status: "error", detail: `HTTP ${response.status}` };
    const body = (await response.json()) as { items?: unknown[] };
    const remaining = response.headers.get("x-ratelimit-remaining");
    return {
      provider: "github",
      status: "ok",
      detail: `GitHub Search API 200, результатов ${body.items?.length ?? 0}, остаток лимита ${remaining ?? "?"}${process.env.GITHUB_TOKEN ? "" : " (без токена)"}`,
    };
  } catch (error) {
    return { provider: "github", status: "error", detail: error instanceof Error ? error.message : "ошибка" };
  }
}

async function testYoutubeRss(channelId: string): Promise<CheckResult> {
  try {
    const response = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`, {
      headers: { "user-agent": UA },
    });
    if (!response.ok) return { provider: "youtube-rss", status: "error", detail: `HTTP ${response.status}` };
    const text = await response.text();
    return {
      provider: "youtube-rss",
      status: "ok",
      detail: `RSS канала 200, ${text.length} байт; ключ не нужен, бот-проверки нет (это публичная лента)`,
    };
  } catch (error) {
    return { provider: "youtube-rss", status: "error", detail: error instanceof Error ? error.message : "ошибка" };
  }
}

async function testYoutubeApi(): Promise<CheckResult> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return {
      provider: "youtube-api",
      status: "no_key",
      detail: "YOUTUBE_API_KEY не задан. Data API не вызывается; RSS-проверка выше работает без ключа.",
    };
  }
  try {
    const params = new URLSearchParams({
      part: "snippet",
      type: "channel",
      q: "motion design tutorial",
      maxResults: "1",
      key,
    });
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
      headers: { accept: "application/json" },
    });
    const body = (await response.json()) as { items?: unknown[]; error?: { message?: string } };
    if (!response.ok) {
      return {
        provider: "youtube-api",
        status: "error",
        detail: `HTTP ${response.status}: ${body.error?.message ?? "ошибка"}`,
      };
    }
    return {
      provider: "youtube-api",
      status: "ok",
      detail: `Data API 200, каналов ${body.items?.length ?? 0}; 1 поиск ≈ 100 units из 10 000/день; страницы YouTube не скрейпим, бот-проверка не участвует`,
    };
  } catch (error) {
    return { provider: "youtube-api", status: "error", detail: error instanceof Error ? error.message : "ошибка" };
  }
}

async function testBrave(): Promise<CheckResult> {
  const key = process.env.BRAVE_API_KEY;
  if (!key) {
    return {
      provider: "brave",
      status: "no_key",
      detail: "BRAVE_API_KEY не задан. Официальный веб-поиск без Google CSE; free ≈1000 запросов/мес ($5 кредитов, $5/1000).",
    };
  }
  try {
    const params = new URLSearchParams({ q: "motion design free course", count: "3", safesearch: "moderate" });
    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
      headers: { accept: "application/json", "x-subscription-token": key },
    });
    const body = (await response.json()) as { web?: { results?: unknown[] }; error?: { detail?: string } };
    if (!response.ok) {
      return {
        provider: "brave",
        status: response.status === 401 || response.status === 403 ? "blocked" : "error",
        detail: `HTTP ${response.status}: ${body.error?.detail ?? "ошибка"}`,
      };
    }
    return {
      provider: "brave",
      status: "ok",
      detail: `Brave Search API 200, результатов ${body.web?.results?.length ?? 0}; free ≈1000 запросов/мес ($5 кредитов)`,
    };
  } catch (error) {
    return { provider: "brave", status: "error", detail: error instanceof Error ? error.message : "ошибка" };
  }
}

async function testGoogle(): Promise<CheckResult> {
  const key = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;
  if (!key || !cx) {
    return {
      provider: "google-cse",
      status: "no_key",
      detail:
        "GOOGLE_CSE_API_KEY/GOOGLE_CSE_CX не заданы. Для новых CSE режим «весь интернет» отключён — CSE годится только для поиска по курируемому списку сайтов; для веба используй BRAVE_API_KEY.",
    };
  }
  try {
    const params = new URLSearchParams({ key, cx, q: "motion design free course", num: "3" });
    const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`, {
      headers: { accept: "application/json" },
    });
    const body = (await response.json()) as {
      items?: Array<{ link?: string }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      return { provider: "google-cse", status: "error", detail: `HTTP ${response.status}: ${body.error?.message ?? "ошибка"}` };
    }
    return {
      provider: "google-cse",
      status: "ok",
      detail: `Custom Search JSON API 200, результатов ${body.items?.length ?? 0}; бесплатно 100 запросов/день`,
    };
  } catch (error) {
    return { provider: "google-cse", status: "error", detail: error instanceof Error ? error.message : "ошибка" };
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const provider = flagValue(argv, "--provider") ?? "all";
  const channelId = flagValue(argv, "--channel-id") ?? DEFAULT_CHANNEL;
  const checks: CheckResult[] = [];
  if (provider === "all" || provider === "wikipedia") checks.push(await testWikipedia());
  if (provider === "all" || provider === "github") checks.push(await testGithub());
  if (provider === "all" || provider === "youtube") {
    checks.push(await testYoutubeRss(channelId));
    checks.push(await testYoutubeApi());
  }
  if (provider === "all" || provider === "brave") checks.push(await testBrave());
  if (provider === "all" || provider === "google") checks.push(await testGoogle());

  console.log("Проверка официальных провайдеров авто-расширения:");
  for (const check of checks) {
    const mark =
      check.status === "ok"
        ? "✓"
        : check.status === "no_key"
          ? "—"
          : check.status === "blocked"
            ? "!"
            : "✕";
    console.log(`  ${mark} ${check.provider} [${check.status}]: ${check.detail}`);
  }
  const failed = checks.filter((check) => check.status === "error");
  if (failed.length > 0) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
