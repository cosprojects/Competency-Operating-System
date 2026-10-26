export type LearningSourceKind =
  | "school"
  | "course-platform"
  | "video-channel"
  | "video-playlist"
  | "portfolio-case"
  | "aggregator"
  | "blog"
  | "reference";

export type LearningSourceStatus = "active" | "degraded" | "blocked" | "duplicate" | "planned";

export interface LearningSourceRecord {
  id: string;
  title: string;
  url: string;
  kind: LearningSourceKind;
  professionIds: string[];
  languages: string[];
  access: "free" | "freemium" | "paid" | "mixed" | "unknown";
  authority: "primary" | "secondary" | "aggregator";
  status: LearningSourceStatus;
  topics: string[];
  discoveredBy: "user" | "search" | "manual";
  lastChecked: string;
  httpStatus?: number;
  finalUrl?: string;
  duplicateOf?: string;
  notes?: string;
}

export interface LearningSourceRegistry {
  registryVersion: "1.0.0";
  updatedAt: string;
  sources: LearningSourceRecord[];
}

export interface LearningSourceAuditResult {
  id: string;
  url: string;
  status: LearningSourceStatus;
  httpStatus?: number;
  finalUrl?: string;
  title?: string;
  checkedAt: string;
  error?: string;
}
