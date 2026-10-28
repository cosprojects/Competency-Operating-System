import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Вход — AXIONA",
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
        <p className="muted">В ссылке нет токена. Запросите новое письмо.</p>
        <Link className="button" href="/login">
          Запросить ссылку
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h1>Подтвердите вход</h1>
      <p className="muted">
        Нажмите кнопку, чтобы войти в AXIONA. Ссылка одноразовая и действует 15 минут.
      </p>
      <form action="/api/auth/verify" method="post">
        <input type="hidden" name="token" value={token} />
        <button className="button" type="submit">
          Войти
        </button>
      </form>
      <p className="small muted" style={{ marginTop: 14 }}>
        Если вы не запрашивали вход, закройте страницу.
      </p>
    </div>
  );
}
