import { getDb } from "./db";

/** Запись админ-действия в журнал (COS-ARCH-173, T-040). */
export async function recordAdminAction(input: {
  actorId?: string | null;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await getDb().adminAudit.create({
      data: {
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        ...(input.meta ? { meta: input.meta as object } : {}),
      },
    });
  } catch (error) {
    console.error("audit: не удалось записать действие", error instanceof Error ? error.message : error);
  }
}
