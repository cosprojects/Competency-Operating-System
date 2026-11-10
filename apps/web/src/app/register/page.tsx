import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { safeReturnTo } from "@/lib/auth";

export const metadata = {
  title: "Создать аккаунт — AXIONA",
  description:
    "Аккаунт AXIONA создаётся по ссылке из письма: без пароля. Сохраняй компетенции и возвращайся к материалам.",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  const safeReturn = safeReturnTo(returnTo);
  return (
    <div className="auth-page">
      <header className="auth-hero">
        <h1>Создай аккаунт в AXIONA</h1>
        <p>
          Сохраняй компетенции и материалы, возвращайся к ним с любого устройства и собирай личный
          профиль. Без пароля: вход по ссылке из письма.
        </p>
      </header>
      <div className="auth-card">
        <LoginForm returnTo={safeReturn} mode="register" />
        <p className="small muted" style={{ marginTop: 16 }}>
          Уже есть аккаунт?{" "}
          <Link href={`/login?returnTo=${encodeURIComponent(safeReturn)}`}>Войти</Link>
        </p>
      </div>
    </div>
  );
}
