/**
 * COS-ARCH-174 — хранилище материалов и привязок.
 *
 * Порт один, адаптеров три: Prisma (прод), файл (локальные прогоны и миграция),
 * память (тесты). Привязка и приёмка не знают, где лежит состояние.
 */
export type StoredMaterial = {
  id: string;
  canonicalUrl: string;
  url: string;
  title: string;
  provider?: string;
};

export type ReviewDecisionRecord = {
  materialUrl: string;
  title?: string;
  competencyId?: string;
  outcome: string;
  decision: string;
  reason: string;
  signalsJson?: string;
};

export type ReviewBatch = {
  runId: string;
  stepId: string;
  policyVersion: string;
  decisions: ReviewDecisionRecord[];
};

export interface MaterialsStore {
  listMaterials(): Promise<StoredMaterial[]>;
  findMaterialByCanonicalUrl(canonicalUrl: string): Promise<StoredMaterial | undefined>;
  addMaterial(material: StoredMaterial): Promise<void>;
  hasLink(materialId: string, nodeId: string): Promise<boolean>;
  addLink(materialId: string, nodeId: string): Promise<void>;
  /** Журнал решений приёмки: пишется, если адаптер умеет. */
  recordReviewDecisions?(batch: ReviewBatch): Promise<void>;
}
