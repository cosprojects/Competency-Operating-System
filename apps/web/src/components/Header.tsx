import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export async function Header() {
  const user = await getCurrentUser();
  return (
    <header className="site-header">
      <div className="container">
        <Link className="brand" href="/">
          <span className="brand-mark">AX</span>
          <span>
            AXIONA
            <small>карта компетенций</small>
          </span>
        </Link>
        <nav className="nav-links" aria-label="Основная навигация">
          <Link href="/professions">Профессии</Link>
          <Link className="hide-mobile" href="/saved">
            Сохранённое
          </Link>
          <Link className="hide-mobile" href="/feedback">
            Обратная связь
          </Link>
          {user ? (
            <>
              <Link href="/account" title={user.email}>
                Аккаунт
              </Link>
              <form action="/api/auth/logout" method="post">
                <button className="button secondary small" type="submit">
                  Выйти
                </button>
              </form>
            </>
          ) : (
            <Link className="button small" href="/login">
              Войти
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
