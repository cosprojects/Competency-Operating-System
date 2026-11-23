import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireCapability } from "@/lib/access";
import { NOINDEX_NOFOLLOW } from "@/lib/seo";

/**
 * Консоль владельца: закрыта и в robots.txt, и метатегом. Доступ требует
 * сессии, но двойная защита не лишняя — URL консоли легко утекает в чат.
 */
export const metadata: Metadata = {
  ...NOINDEX_NOFOLLOW,
  title: "Консоль владельца — AXIONA",
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireCapability("metrics:read", "/admin/materials");
  return <>{children}</>;
}
