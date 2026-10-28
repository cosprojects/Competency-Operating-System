import { redirect } from "next/navigation";
import { getCurrentUser, isAdminEmail } from "./auth";

export async function requireAdmin(returnTo = "/admin/feedback") {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return user;
}

export async function getAdminOrNull() {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}
