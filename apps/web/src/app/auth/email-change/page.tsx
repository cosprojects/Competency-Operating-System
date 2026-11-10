import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Подтверждение нового email — AXIONA",
};

export default async function EmailChangePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="auth-card">
        <h1>Ссылка неполная</h1>
        <p className="auth-desc">В ссылке нет токена. Запроси смену email ещё раз в аккаунте.</p>
        <Link className="button" href="/">
          На главную
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h1>Подтвердить новый email?</h1>
      <p className="auth-desc">
        После подтверждения старый адрес удалится, все сессии завершатся, а старые ссылки для входа
        перестанут работать.
      </p>
      <form action="/api/auth/email-change" method="post">
        <input type="hidden" name="token" value={token} />
        <button className="button block" type="submit">
          Подтвердить
        </button>
      </form>
      <p className="small muted" style={{ marginTop: 14 }}>
        Если ты не запрашивал смену, закрой страницу.
      </p>
    </div>
  );
}
