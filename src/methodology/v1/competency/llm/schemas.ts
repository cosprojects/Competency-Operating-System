import { z } from "zod";

export const candidateItemSchema = z.object({
  title: z.string().min(2).max(160),
  titleEn: z.string().min(2).max(160).optional(),
  aliases: z.array(z.string().min(1).max(160)).max(8).default([]),
  tagIds: z.array(z.string().min(1)).min(2).max(30),
  definition: z.string().min(10).max(1200),
  rationale: z.string().min(5).max(800),
  scopeHint: z.enum(["universal", "profession"]).default("profession"),
});

export const candidateResponseSchema = z.object({
  candidates: z.array(candidateItemSchema).min(1).max(20),
  unassignedTagIds: z.array(z.string().min(1)).default([]),
});

export type CandidateResponse = z.infer<typeof candidateResponseSchema>;

export const blockItemSchema = z.object({
  title: z.string().min(2).max(200),
  kind: z.enum(["knowledge", "skill"]),
  definition: z.string().min(10).max(1200),
  evidenceTagIds: z.array(z.string().min(1)).max(20).default([]),
  modelProposal: z.boolean().default(false),
});

export const blockComponentSchema = z.object({
  title: z.string().min(2).max(200),
  definition: z.string().min(10).max(1200),
  items: z.array(blockItemSchema).min(1).max(12),
});

export const blockResponseSchema = z.object({
  title: z.string().min(2).max(200),
  titleEn: z.string().min(2).max(200).optional(),
  aliases: z.array(z.string().min(1).max(200)).max(8).default([]),
  definition: z.string().min(20).max(1500),
  scope: z.enum(["universal", "profession"]).default("profession"),
  components: z.array(blockComponentSchema).min(2).max(8),
  unresolved: z.array(z.string().max(800)).max(20).default([]),
});

export type BlockResponse = z.infer<typeof blockResponseSchema>;

export const materialLinkSchema = z.object({
  competencyId: z.string().min(1),
  componentId: z.string().min(1).optional(),
  tagId: z.string().min(1).optional(),
  relevance: z.number().min(0).max(1),
  reason: z.string().min(3).max(600),
  modelProposal: z.boolean().default(false),
});

export const materialResponseSchema = z.object({
  links: z.array(materialLinkSchema).max(20).default([]),
  rejected: z.array(z.string().min(1).max(600)).max(20).default([]),
});

export type MaterialResponse = z.infer<typeof materialResponseSchema>;
