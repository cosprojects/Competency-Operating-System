import type { MetadataRoute } from "next";
import { getAllCompetencies, getProfessions } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL ?? "https://axiona.world";
  const now = new Date();
  const professions = getProfessions().map((profession) => ({
    url: `${base}/professions/${profession.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
  const competencies = [
    ...new Map(
      getAllCompetencies().map((item) => [
        item.competency.id,
        {
          url: `${base}/competencies/${item.competency.id}`,
          lastModified: now,
          changeFrequency: "weekly" as const,
          priority: 0.6,
        },
      ]),
    ).values(),
  ];
  return [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/professions`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/canvas`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    ...professions.map((profession) => ({
      ...profession,
      url: `${base}/canvas/${profession.url.split("/").at(-1)}`,
    })),
    ...competencies,
    { url: `${base}/legal/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/legal/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/legal/cookies`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
