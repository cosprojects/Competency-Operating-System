import { z } from "zod";

export const CONSENT_COOKIE = "axiona_consent";
export const ANON_COOKIE = "axiona_aid";

export const emailSchema = z.string().trim().toLowerCase().email("Некорректный email").max(254);

export const loginRequestSchema = z.object({
  email: emailSchema,
  returnTo: z.string().max(300).optional(),
  acceptTerms: z.literal(true),
});

export const favoriteSchema = z.object({
  targetType: z.enum(["COMPETENCY", "SOURCE"]),
  targetId: z.string().trim().min(1).max(200),
});

export const studyStatusSchema = z.object({
  competencyId: z.string().trim().min(1).max(200),
  status: z.enum(["NOT_STARTED", "LEARNING", "LEARNED"]),
});

export const adminFeedbackStatusSchema = z.object({
  id: z.string().min(1).max(100),
  status: z.enum(["NEW", "TRIAGED", "RESOLVED"]),
});

export const feedbackTypeSchema = z.enum([
  "CONTENT_ERROR",
  "MISSING_COMPETENCY",
  "BAD_MATERIAL",
  "MISSING_FEATURE",
  "IMPROVEMENT",
  "GENERAL",
]);

const optionalEmail = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  emailSchema.optional(),
);

export const feedbackSchema = z
  .object({
    type: feedbackTypeSchema,
    targetType: z.enum(["COMPETENCY", "SOURCE"]).optional(),
    targetId: z.string().trim().max(200).optional(),
    rating: z.preprocess(
      (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
      z.number().int().min(1).max(5).optional(),
    ),
    comment: z
      .string()
      .trim()
      .max(4000, "Комментарий слишком длинный")
      .optional()
      .transform((value) => (value ? value : undefined)),
    contactEmail: optionalEmail,
    pagePath: z.string().trim().max(500).default("/"),
    website: z.string().max(0, "Спам").optional(),
  })
  .refine((value) => Boolean(value.rating) || Boolean(value.comment), {
    message: "Добавьте оценку или комментарий",
    path: ["comment"],
  });

export const EVENT_NAMES = [
  "page_view",
  "profession_view",
  "competency_view",
  "source_click",
  "source_gate_view",
  "signup_start",
  "signup_complete",
  "favorite_add",
  "favorite_remove",
  "study_status_change",
  "feedback_open",
  "feedback_submit",
  "return_visit",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

const EVENT_PROP_KEYS = new Set([
  "path",
  "locale",
  "referrer_type",
  "profession_id",
  "competency_id",
  "source_id",
  "source_kind",
  "access",
  "method",
  "target_type",
  "target_id",
  "from",
  "to",
  "context",
  "feedback_type",
  "has_rating",
  "has_comment",
  "days_since_signup",
]);

export const eventSchema = z.object({
  name: z.enum(EVENT_NAMES),
  path: z.string().trim().max(300).optional(),
  props: z
    .record(z.union([z.string().max(200), z.number(), z.boolean()]))
    .optional(),
});

export function sanitizeEventProps(
  props: Record<string, string | number | boolean> | undefined,
): Record<string, string | number | boolean> | undefined {
  if (!props) return undefined;
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (EVENT_PROP_KEYS.has(key)) result[key] = value;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export function isFeedbackType(value: string): value is z.infer<typeof feedbackTypeSchema> {
  return feedbackTypeSchema.safeParse(value).success;
}
