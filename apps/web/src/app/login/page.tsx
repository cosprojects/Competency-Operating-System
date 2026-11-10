import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { safeReturnTo } from "@/lib/auth";

export const metadata = {
  title: "Вход — AXIONA",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; emailChanged?: string }>;
}) {
  const { returnTo, emailChanged } = await searchParams;
  const safeReturn = safeReturnTo(returnTo);
  return (
    <div className="auth-page">
      <header className="auth-hero">
        <h1>Карта компетенций, которая объясняет профессию</h1>
        <p>
          Сохраняй компетенции, изучай учебные материалы, которые обновляются и пополняются
          ежедневно. Вход по email — без пароля: просто попроси ссылку и открой её из письма.
        </p>
      </header>
      <div className="auth-card">
        {emailChanged ? (
          <div className="notice success">Email изменён. Войди с новым адресом.</div>
        ) : null}
        <LoginForm returnTo={safeReturn} />
        <p className="small muted" style={{ marginTop: 16 }}>
          Нет аккаунта?{" "}
          <Link href={`/register?returnTo=${encodeURIComponent(safeReturn)}`}>Создать аккаунт</Link>
        </p>
      </div>
    </div>
  );
}
