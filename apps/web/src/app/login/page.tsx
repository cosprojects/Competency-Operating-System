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
    <div className="auth-page">
      <header className="auth-hero">
        <h1>Карта компетенций, которая объясняет профессию</h1>
        <p>
          Сохраняй компетенции, изучай учебные материалы, которые обновляются и пополняются
          ежедневно. Простая регистрация, чтобы формировать личный профиль с базой знаний.
        </p>
      </header>
      <div className="auth-card">
        <LoginForm returnTo={safeReturnTo(returnTo)} />
      </div>
    </div>
  );
}
