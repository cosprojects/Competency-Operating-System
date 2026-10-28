import { LoginForm } from "@/components/LoginForm";
import { safeReturnTo } from "@/lib/auth";

export const metadata = {
  title: "Вход — AXIONA",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  return (
    <div className="auth-card">
      <LoginForm returnTo={safeReturnTo(returnTo)} />
    </div>
  );
}
