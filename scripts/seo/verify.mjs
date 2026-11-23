#!/usr/bin/env node
/**
 * seo:verify — проверка индексации на живом контуре одной командой.
 *
 * Зачем: после деплоя нужно убедиться, что canonical, sitemap, редиректы и noindex
 * действительно уехали в прод, а не остались в локальной сборке. Ручной обход
 * четырёх десятков страниц не делается, поэтому проверки собраны здесь и
 * возвращают код выхода 1, если что-то сломалось.
 *
 * Запуск:
 *   npm run seo:verify -- --base https://app.axiona.world
 *   npm run seo:verify -- --base http://127.0.0.1:3100
 *
 * Что проверяет:
 *   robots.txt — разрешения, Clean-param, sitemap на своём домене;
 *   sitemap.xml — адреса без параметров, один origin, без дублей;
 *   canonical — главная, направления, профессия, компетенция;
 *   редиректы — ?competency= и /competencies/[id] постоянные;
 *   noindex — служебные страницы закрыты;
 *   OG и микроразметка — картинка отдаётся, JSON-LD на месте;
 *   верификация панелей — есть ли метатеги (без них — предупреждение, не ошибка).
 */
const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const BASE = argValue("--base", process.env.SEO_BASE_URL ?? "https://app.axiona.world").replace(/\/$/, "");
const EXPECTED_MIN_URLS = Number(argValue("--min-urls", "150"));
const TIMEOUT_MS = Number(argValue("--timeout", "60000"));

const results = [];

function pass(name, detail = "") {
  results.push({ status: "PASS", name, detail });
}
function fail(name, detail = "") {
  results.push({ status: "FAIL", name, detail });
}
function info(name, detail = "") {
  results.push({ status: "INFO", name, detail });
}

async function fetchText(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    redirect: options.redirect ?? "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "user-agent": "AXIONA-SEO-Check/1.0" },
  });
  const body = options.body === false ? "" : await response.text();
  return { status: response.status, headers: response.headers, body };
}

function pick(html, regex) {
  const match = html.match(regex);
  return match ? match[0] : null;
}

function canonicalOf(html) {
  const href = pick(html, /<link rel="canonical" href="([^"]+)"/);
  return href ? href.replace(/^.*?href="|"$/g, "") : null;
}

function robotsMeta(html) {
  const content = pick(html, /<meta name="robots" content="([^"]+)"/);
  return content ? content.replace(/^.*?content="|"$/g, "") : null;
}

function jsonLdTypes(html) {
  const types = [];
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const parsed = JSON.parse(match[1]);
      for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
        if (node && node["@type"]) types.push(node["@type"]);
      }
    } catch {
      types.push("parse-error");
    }
  }
  return types;
}

async function checkRobots() {
  try {
    const { status, body } = await fetchText("/robots.txt");
    if (status !== 200) return fail("robots.txt", `статус ${status}`);
    const missing = [];
    if (!/^User-agent: \*/m.test(body)) missing.push("User-agent");
    if (!/^Allow: \/$/m.test(body)) missing.push("Allow: /");
    if (!/^Disallow: \/api\/$/m.test(body)) missing.push("Disallow: /api/");
    if (!/^Disallow: \/admin\/$/m.test(body)) missing.push("Disallow: /admin/");
    if (!/^Clean-param: competency \/professions\/$/m.test(body)) missing.push("Clean-param");
    const sitemapLine = body.match(/^Sitemap: (.+)$/m);
    if (!sitemapLine) missing.push("Sitemap");
    else if (sitemapLine[1].trim() !== `${BASE}/sitemap.xml`) {
      missing.push(`Sitemap указывает на ${sitemapLine[1].trim()}, а не на ${BASE}/sitemap.xml`);
    }
    if (missing.length) return fail("robots.txt", missing.join("; "));
    pass("robots.txt", "разрешения, Clean-param и Sitemap на месте");
  } catch (error) {
    fail("robots.txt", error.message);
  }
}

async function checkSitemap() {
  let locs = [];
  try {
    const { status, body } = await fetchText("/sitemap.xml");
    if (status !== 200) return fail("sitemap.xml", `статус ${status}`);
    if (!body.includes("<urlset")) return fail("sitemap.xml", "не похоже на urlset");
    locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
  } catch (error) {
    return fail("sitemap.xml", error.message);
  }

  const withQuery = locs.filter((url) => url.includes("?"));
  const foreign = locs.filter((url) => url !== BASE && !url.startsWith(`${BASE}/`));
  const duplicates = locs.filter((url, index) => locs.indexOf(url) !== index);
  const problems = [];
  if (locs.length < EXPECTED_MIN_URLS) problems.push(`адресов ${locs.length}, ожидалось не меньше ${EXPECTED_MIN_URLS}`);
  if (withQuery.length) problems.push(`${withQuery.length} адресов с параметрами (например ${withQuery[0]})`);
  if (foreign.length) problems.push(`${foreign.length} адресов с чужим доменом (например ${foreign[0]})`);
  if (duplicates.length) problems.push(`${duplicates.length} дублей (например ${duplicates[0]})`);
  const competencyPages = locs.filter((url) => /\/professions\/[^/]+\/[^/]+$/.test(url)).length;
  if (competencyPages === 0) problems.push("нет ни одной страницы компетенции");

  if (problems.length) fail("sitemap.xml", problems.join("; "));
  else pass("sitemap.xml", `${locs.length} адресов, из них ${competencyPages} страниц компетенций, параметров нет`);

  return locs;
}

/** Хвостовой слэш для сравнения не важен: Next отдаёт главную как домен без него. */
function sameUrl(left, right) {
  return left.replace(/\/$/, "") === right.replace(/\/$/, "");
}

async function checkCanonical(name, path, expectedPath) {
  try {
    const { status, body } = await fetchText(path);
    if (status !== 200) return fail(`${name}: canonical`, `страница отдала ${status}`);
    const canonical = canonicalOf(body);
    const expected = `${BASE}${expectedPath}`;
    if (!canonical) return fail(`${name}: canonical`, "canonical отсутствует");
    if (!sameUrl(canonical, expected)) return fail(`${name}: canonical`, `${canonical}, ожидалось ${expected}`);
    pass(`${name}: canonical`, canonical);
    return body;
  } catch (error) {
    fail(`${name}: canonical`, error.message);
  }
}

async function checkRedirect(name, path, expectedPath) {
  try {
    const { status, headers } = await fetchText(path, { redirect: "manual", body: false });
    const location = headers.get("location");
    if (status !== 301 && status !== 308) return fail(`${name}: редирект`, `статус ${status}, ожидался 301 или 308`);
    const target = location ? new URL(location, BASE).pathname + new URL(location, BASE).search : "";
    if (target !== expectedPath) return fail(`${name}: редирект`, `${status} → ${target}, ожидалось ${expectedPath}`);
    pass(`${name}: редирект`, `${status} → ${expectedPath}`);
  } catch (error) {
    fail(`${name}: редирект`, error.message);
  }
}

async function checkNoindex(name, path) {
  try {
    const { status, body } = await fetchText(path);
    if (status !== 200) {
      // Редирект на вход — тоже нормальный закрытый сценарий.
      if ([301, 302, 307, 308].includes(status)) return pass(`${name}: noindex`, `закрыта редиректом ${status}`);
      return fail(`${name}: noindex`, `статус ${status}`);
    }
    const robots = robotsMeta(body);
    if (!robots || !robots.includes("noindex")) return fail(`${name}: noindex`, `robots: ${robots ?? "нет"}`);
    pass(`${name}: noindex`, robots);
  } catch (error) {
    fail(`${name}: noindex`, error.message);
  }
}

async function checkOpenGraph() {
  try {
    const { body } = await fetchText("/");
    const image = pick(body, /<meta property="og:image" content="([^"]+)"/);
    const url = image ? image.replace(/^.*?content="|"$/g, "") : null;
    if (!url) return fail("og:image", "метатега нет");
    if (!url.startsWith("http")) return fail("og:image", `адрес не абсолютный: ${url}`);
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok) return fail("og:image", `${url} отдал ${response.status}`);
    if (!type.startsWith("image/")) return fail("og:image", `${url} отдаёт ${type}`);
    pass("og:image", `${url} (${type}, ${Math.round(Number(response.headers.get("content-length") ?? 0) / 1024)} КБ)`);

    const card = pick(body, /<meta name="twitter:card" content="([^"]+)"/);
    if (!card) return fail("twitter:card", "метатега нет");
    if (!card.includes("summary_large_image")) return fail("twitter:card", card);
    pass("twitter:card", "summary_large_image");
  } catch (error) {
    fail("og:image", error.message);
  }
}

async function checkStructuredData(name, path, expectedType) {
  try {
    const { status, body } = await fetchText(path);
    if (status !== 200) return fail(`${name}: микроразметка`, `статус ${status}`);
    const types = jsonLdTypes(body);
    if (!types.includes(expectedType)) {
      return fail(`${name}: микроразметка`, `нет ${expectedType}; найдено: ${types.join(", ") || "ничего"}`);
    }
    pass(`${name}: микроразметка`, types.join(", "));
  } catch (error) {
    fail(`${name}: микроразметка`, error.message);
  }
}

/** Первая профессия и её первая компетенция — из живого HTML, без догадок. */
async function discoverPaths() {
  const { body } = await fetchText("/professions");
  const match = body.match(/href="\/professions\/([^"/]+)"/);
  const professionSlug = match ? match[1] : null;
  if (!professionSlug) throw new Error("на /professions не нашлось ни одной профессии");

  const profession = await fetchText(`/professions/${professionSlug}`);
  const competencyLink = profession.body.match(/href="(\/professions\/[^"/]+\/[^"/]+)"/);
  const competencyPath = competencyLink
    ? competencyLink[1]
    : profession.body.match(/"\/professions\/([^"]+)\/([^"]+)"/)?.[0] ?? null;
  if (!competencyPath) throw new Error(`на /professions/${professionSlug} нет ссылок на компетенции`);
  return { professionSlug, competencyPath, professionBody: profession.body };
}

async function checkVerification() {
  const { body } = await fetchText("/");
  const tags = {
    google: /<meta name="google-site-verification"/.test(body),
    yandex: /<meta name="yandex-verification"/.test(body),
    bing: /<meta name="msvalidate\.01"/.test(body),
  };
  const enabled = Object.entries(tags).filter(([, value]) => value).map(([key]) => key);
  if (enabled.length === 0) {
    info(
      "верификация панелей",
      "метатегов нет — задай GOOGLE_SITE_VERIFICATION / YANDEX_SITE_VERIFICATION / BING_SITE_VERIFICATION и пересобери",
    );
  } else {
    info("верификация панелей", enabled.join(", "));
  }
}

async function main() {
  console.log(`seo:verify — ${BASE}`);
  await checkRobots();
  const locs = await checkSitemap();

  let discovered = null;
  let primaryPath = null;
  try {
    discovered = await discoverPaths();
  } catch (error) {
    fail("внутренние ссылки", error.message);
  }

  await checkCanonical("главная", "/", "/");

  if (discovered) {
    const { professionSlug, competencyPath } = discovered;
    await checkCanonical("направления", "/professions", "/professions");
    const profession = await checkCanonical(
      `профессия ${professionSlug}`,
      `/professions/${professionSlug}`,
      `/professions/${professionSlug}`,
    );

    const linkCount = profession
      ? (profession.match(/href="\/professions\/[^"]+\/[^"]+"/g) ?? []).length
      : 0;
    if (linkCount >= 5) pass("ссылки на компетенции", `${linkCount} ссылок на странице профессии`);
    else fail("ссылки на компетенции", `найдено ${linkCount}, ожидалось не меньше 5`);

    // Канонический адрес компетенции может отличаться от запрошенной профессии:
    // одна компетенция входит в несколько профессий.
    try {
      const { status, body } = await fetchText(competencyPath);
      if (status !== 200) {
        fail("компетенция: canonical", `статус ${status}`);
      } else {
        const canonical = canonicalOf(body);
        const expectedSuffix = competencyPath.split("/").pop();
        if (!canonical) fail("компетенция: canonical", "canonical отсутствует");
        else if (!canonical.startsWith(`${BASE}/professions/`) || !canonical.endsWith(`/${expectedSuffix}`)) {
          fail("компетенция: canonical", canonical);
        } else if (!sameUrl(canonical, `${BASE}${competencyPath}`)) {
          primaryPath = canonical.replace(BASE, "");
          pass("компетенция: canonical", `${competencyPath} → ${primaryPath} (основная страница)`);
        } else {
          pass("компетенция: canonical", canonical);
        }
        const types = jsonLdTypes(body);
        if (types.includes("DefinedTerm")) pass("компетенция: микроразметка", types.join(", "));
        else fail("компетенция: микроразметка", `нет DefinedTerm; найдено: ${types.join(", ") || "ничего"}`);
      }
    } catch (error) {
      fail("компетенция: canonical", error.message);
    }

    const competencyId = competencyPath.split("/").pop();
    await checkRedirect(
      "старый адрес с параметром",
      `/professions/${professionSlug}?competency=${competencyId}`,
      `/professions/${professionSlug}/${competencyId}`,
    );
    // /competencies/[id] ведёт на основную страницу компетенции — она может быть
    // у другой профессии, поэтому берём её из canonical, а не из запроса.
    await checkRedirect(
      "старый адрес /competencies",
      `/competencies/${competencyId}`,
      primaryPath ?? competencyPath,
    );
  }

  await checkNoindex("вход", "/login");
  await checkNoindex("аккаунт", "/account");
  await checkNoindex("изучаю", "/saved");
  await checkNoindex("шаг плана", "/plan/start");

  await checkOpenGraph();
  await checkStructuredData("главная", "/", "Organization");
  await checkStructuredData("направления", "/professions", "CollectionPage");
  await checkVerification();

  const failed = results.filter((item) => item.status === "FAIL");
  const width = Math.max(...results.map((item) => item.name.length));
  for (const item of results) {
    const mark = item.status === "PASS" ? "PASS" : item.status === "FAIL" ? "FAIL" : "INFO";
    console.log(`  ${mark}  ${item.name.padEnd(width)}  ${item.detail}`);
  }

  if (locs.length) console.log(`  sitemap: ${locs.length} адресов`);

  if (failed.length) {
    console.log(`\nseo:verify — ${failed.length} проблем(ы)`);
    process.exit(1);
  }
  console.log("\nseo:verify — всё на месте");
}

await main();
