import Link from "next/link";
import { redirect } from "next/navigation";
import { peekLoginToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Подтверждение входа — AXIONA",
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="auth-card">
        <h1>Ссылка неполная</h1>
        <p className="muted">В ссылке нет токена. Запроси новое письмо.</p>
        <Link className="button" href="/login">
          Запросить ссылку
        </Link>
      </div>
    );
  }

  let invalid = false;
  try {
    const info = await peekLoginToken(token);
    if (!info || info.usedAt || info.expiresAt.getTime() <= Date.now() || info.purpose === "email_change") {
      invalid = true;
    }
  } catch {
    // Без БД (demo/preview): показываем форму, POST завершится экраном недействительной ссылки.
    invalid = false;
  }

  if (invalid) redirect("/auth/link-invalid");

  return (
    <div className="auth-card">
      <h1>Подтверди вход</h1>
      <p className="muted">
        Нажми кнопку, чтобы войти в AXIONA. Ссылка одноразовая и действует 15 минут.
      </p>
      <form action="/api/auth/verify" method="post">
        <input type="hidden" name="token" value={token} />
        <button className="button" type="submit">
          Войти
        </button>
      </form>
      <p className="small muted" style={{ marginTop: 14 }}>
        Если ты не запрашивал вход, закрой страницу.
      </p>
    </div>
  );
}
