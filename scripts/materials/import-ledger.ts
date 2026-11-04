/**
 * Импорт файлового реестра привязанных материалов в БД.
 *
 *   npm run materials:import-ledger
 *
 * Нужен один раз при переезде с `data/workflow/attached-materials.json`.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const LEDGER_PATH = "data/workflow/attached-materials.json";

type Ledger = {
  materials: Array<{ id: string; url: string; title: string; provider?: string }>;
  links: Array<{ materialId: string; nodeId: string }>;
};

function canonicalUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw.trim());
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.protocol = "https:";
    for (const param of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref", "source", "fbclid", "gclid", "yclid"]) {
      url.searchParams.delete(param);
    }
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return undefined;
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    let ledger: Ledger = { materials: [], links: [] };
    try {
      ledger = JSON.parse(await readFile(resolve(process.cwd(), LEDGER_PATH), "utf8")) as Ledger;
    } catch {
      console.log("реестр не найден — нечего импортировать");
      return;
    }

    let materials = 0;
    let links = 0;
    for (const material of ledger.materials) {
      const canonical = canonicalUrl(material.url) ?? material.url;
      await prisma.material.upsert({
        where: { id: material.id },
        create: {
          id: material.id,
          canonicalUrl: canonical,
          url: material.url,
          title: material.title,
          provider: material.provider ?? null,
        },
        update: { title: material.title, canonicalUrl: canonical },
      });
      materials += 1;
    }
    for (const link of ledger.links) {
      const exists = await prisma.materialLink.findUnique({
        where: { materialId_nodeId: { materialId: link.materialId, nodeId: link.nodeId } },
      });
      if (exists) continue;
      await prisma.materialLink.create({ data: { materialId: link.materialId, nodeId: link.nodeId } });
      links += 1;
    }
    console.log(`импортировано: материалов ${materials}, связей ${links}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`ошибка: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
