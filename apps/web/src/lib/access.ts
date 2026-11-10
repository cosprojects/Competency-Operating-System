import { redirect } from "next/navigation";
import { getCurrentUser, isAdminEmail } from "./auth";

/**
 * Capability-слой доступа (COS-ARCH-173, T-040, фаза 0).
 * Роль не проверяется напрямую: решение принимает capability.
 */
export type Capability =
  | "account:self"
  | "feedback:create"
  | "feedback:read"
  | "feedback:write"
  | "metrics:read"
  | "users:read"
  | "users:manage"
  | "source-review:moderate"
  | "audit:read";

const OWNER_CAPABILITIES: Capability[] = [
  "account:self",
  "feedback:create",
  "feedback:read",
  "feedback:write",
  "metrics:read",
  "users:read",
  "users:manage",
  "source-review:moderate",
  "audit:read",
];

const USER_CAPABILITIES: Capability[] = ["account:self", "feedback:create"];

export function capabilitiesFor(email: string | null | undefined): Capability[] {
  if (!email) return [];
  if (isAdminEmail(email)) return OWNER_CAPABILITIES;
  return USER_CAPABILITIES;
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
