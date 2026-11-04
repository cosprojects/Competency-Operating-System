/**
 * Файловый адаптер (реестр привязанных материалов).
 * Используется для локальных прогонов до включения БД и для импорта старых данных.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { MaterialsStore, StoredMaterial } from "./store.ts";

type Ledger = {
  ledgerVersion: "1.0.0";
  updatedAt: string;
  materials: StoredMaterial[];
  links: Array<{ materialId: string; nodeId: string }>;
};

/** Всегда новый объект: иначе пустое состояние шарит массивы между экземплярами. */
function emptyLedger(): Ledger {
  return { ledgerVersion: "1.0.0", updatedAt: new Date().toISOString(), materials: [], links: [] };
}

export class FileMaterialsStore implements MaterialsStore {
  private readonly path: string;

  constructor(path: string) {
    this.path = path;
  }

  private async read(): Promise<Ledger> {
    try {
      const body = JSON.parse(await readFile(this.path, "utf8")) as Partial<Ledger>;
      return {
        ledgerVersion: "1.0.0",
        updatedAt: body.updatedAt ?? new Date().toISOString(),
        materials: Array.isArray(body.materials) ? [...body.materials] : [],
        links: Array.isArray(body.links) ? [...body.links] : [],
      };
    } catch {
      return emptyLedger();
    }
  }

  private async write(ledger: Ledger): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(
      this.path,
      `${JSON.stringify({ ...ledger, updatedAt: new Date().toISOString() }, null, 2)}\n`,
      "utf8",
    );
  }

  async listMaterials(): Promise<StoredMaterial[]> {
    return (await this.read()).materials;
  }

  async findMaterialByCanonicalUrl(canonicalUrl: string): Promise<StoredMaterial | undefined> {
    return (await this.read()).materials.find((material) => material.canonicalUrl === canonicalUrl);
  }

  async addMaterial(material: StoredMaterial): Promise<void> {
    const ledger = await this.read();
    if (!ledger.materials.some((item) => item.id === material.id)) ledger.materials.push(material);
    await this.write(ledger);
  }

  async hasLink(materialId: string, nodeId: string): Promise<boolean> {
    return (await this.read()).links.some(
      (link) => link.materialId === materialId && link.nodeId === nodeId,
    );
  }

  async addLink(materialId: string, nodeId: string): Promise<void> {
    const ledger = await this.read();
    if (!ledger.links.some((link) => link.materialId === materialId && link.nodeId === nodeId)) {
      ledger.links.push({ materialId, nodeId });
    }
    await this.write(ledger);
  }
}
