import type { ReactNode } from "react";
import { requireCapability } from "@/lib/access";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireCapability("metrics:read", "/admin/materials");
  return <>{children}</>;
}
