import { siteUrl } from "@/lib/site";

/**
 * robots.txt отдаётся маршрутом, а не MetadataRoute.Robots: нужен `Clean-param`
 * — директива Яндекса, которой нет в типизированном API Next. Она говорит
 * краулеру Яндекса не считать параметр `competency` частью адреса, чтобы
 * фильтр по компетенции не порождал дубли страниц профессий.
 *
 * `Disallow` здесь — только для мусора и закрытой админки. Личные страницы
 * (saved, account, plan-шаги, auth) не запрещаем: запрет в robots.txt прячет
 * от краулера их noindex, и страница остаётся в выдаче как «проиндексирована,
 * несмотря на запрет». Их закрывает метатег (lib/seo.ts).
 */
export const dynamic = "force-static";

const DISALLOW = ["/api/", "/admin/"];

export function GET() {
  const lines = ["User-agent: *", "Allow: /", ...DISALLOW.map((path) => `Disallow: ${path}`)];

  // Яндекс: параметр выбора компетенции не делает адрес новым.
  lines.push("", "Clean-param: competency /professions/");

  lines.push("", `Sitemap: ${siteUrl("/sitemap.xml")}`);

  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
