import { redirect } from "next/navigation";
import { getCurrentUser, isAdminEmail } from "./auth";
import { capabilitiesForOwner, type Capability } from "./access-core";

export type { Capability };

/**
 * Capability-слой доступа (COS-ARCH-173, T-040, фаза 0).
 * Чистые правила — в `access-core.ts`; здесь текущий пользователь и redirect.
 */
export function capabilitiesFor(email: string | null | undefined): Capability[] {
  return capabilitiesForOwner(Boolean(email && isAdminEmail(email)));
}

export function can(
  user: { email: string } | null | undefined,
  capability: Capability,
): boolean {
  return capabilitiesFor(user?.email).includes(capability);
}

/** Для страниц: нет прав — редирект на вход с возвратом. */
export async function requireCapability(
  capability: Capability,
  returnTo: string,
): Promise<{ id: string; email: string }> {
  const user = await getCurrentUser();
  if (!user || !can(user, capability)) {
    if (user) redirect("/");
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return { id: user.id, email: user.email };
}

/** Для API: нет прав — null (роут отвечает 401). */
export async function requireApiCapability(
  capability: Capability,
): Promise<{ id: string; email: string } | null> {
  const user = await getCurrentUser();
  if (!user || !can(user, capability)) return null;
  return { id: user.id, email: user.email };
}
