/** In-memory адаптер — для тестов приёмки и привязки. */
import type { MaterialsStore, ReviewBatch, StoredMaterial } from "./store.ts";

export class InMemoryMaterialsStore implements MaterialsStore {
  readonly materials = new Map<string, StoredMaterial>();
  readonly links = new Set<string>();
  readonly reviews: ReviewBatch[] = [];

  async listMaterials(): Promise<StoredMaterial[]> {
    return [...this.materials.values()];
  }

  async findMaterialByCanonicalUrl(canonicalUrl: string): Promise<StoredMaterial | undefined> {
    return [...this.materials.values()].find((material) => material.canonicalUrl === canonicalUrl);
  }

  async addMaterial(material: StoredMaterial): Promise<void> {
    this.materials.set(material.id, material);
  }

  async hasLink(materialId: string, nodeId: string): Promise<boolean> {
    return this.links.has(`${materialId}|${nodeId}`);
  }

  async addLink(materialId: string, nodeId: string): Promise<void> {
    this.links.add(`${materialId}|${nodeId}`);
  }

  async recordReviewDecisions(batch: ReviewBatch): Promise<void> {
    this.reviews.push(batch);
  }
}
