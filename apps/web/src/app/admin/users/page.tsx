import Link from "next/link";
import { UserDeleteButton } from "@/components/admin/UserDeleteButton";
import { InviteResendButton } from "@/components/admin/InviteResendButton";
import { UserInviteForm } from "@/components/admin/UserInviteForm";
import { requireCapability } from "@/lib/access";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Пользователи — AXIONA admin",
};

const PAGE_SIZE = 25;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const admin = await requireCapability("users:read", "/admin/users");
  const { q, page } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();
  const currentPage = Math.max(1, Number(page ?? "1") || 1);
  const db = getDb();

  const where = query ? { email: { contains: query } } : {};
  const [users, total, invites] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        email: true,
        createdAt: true,
        lastSeenAt: true,
        _count: { select: { favorites: true, feedback: true, sourceReviews: true, sourceViews: true } },
      },
    }),
    db.user.count({ where }),
    db.loginToken.findMany({
      where: { purpose: "invite", usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, email: true, createdAt: true, expiresAt: true },
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Админка</div>
        <div className="page-head-row">
          <h1>Пользователи</h1>
          <div className="export-actions">
            <a className="button secondary small" href="/admin/users/export?format=csv">
              Выгрузить CSV
            </a>
            <a className="button secondary small" href="/admin/users/export?format=pdf">
              Выгрузить PDF
            </a>
            <a
              className="button ghost small"
              href="/admin/users/consents/export"
              title="Доказательства согласий для запросов субъектов ПДн и РКН"
            >
              Согласия CSV
            </a>
          </div>
        </div>
        <p>
          Только подтверждённые адреса: аккаунт появляется после перехода по ссылке из письма.
          Удаление полное — данные не хранятся.
        </p>
      </div>

      <UserInviteForm />

      {invites.length > 0 ? (
        <section className="section">
          <h2>Приглашения в ожидании ({invites.length})</h2>
          <p className="small muted">Адрес появится в списке после перехода по ссылке.</p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Отправлено</th>
                  <th>Ссылка действует до</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {invites.map((invite) => (
                  <tr key={invite.id}>
                    <td>{invite.email}</td>
                    <td>{invite.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                    <td>{invite.expiresAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                    <td>
                      <InviteResendButton email={invite.email} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <form className="admin-search" method="get">
        <input
          className="input"
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Поиск по email"
          aria-label="Поиск по email"
        />
        <button className="button secondary small" type="submit">
          Найти
        </button>
      </form>

      {users.length === 0 ? (
        <div className="empty">
          <h2>{query ? "Ничего не найдено" : "Пока никого нет"}</h2>
          <p>{query ? "Проверь адрес или добавь его приглашением." : "Пригласи первого пользователя по email."}</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Регистрация</th>
                <th>Последний вход</th>
                <th>Сохранения</th>
                <th>Просмотры</th>
                <th>Отзывы</th>
                <th>Голоса</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.createdAt.toISOString().slice(0, 10)}</td>
                  <td>{user.lastSeenAt ? user.lastSeenAt.toISOString().slice(0, 10) : "—"}</td>
                  <td>{user._count.favorites}</td>
                  <td>{user._count.sourceViews}</td>
                  <td>{user._count.feedback}</td>
                  <td>{user._count.sourceReviews}</td>
                  <td>
                    {user.email === admin.email ? (
                      <span className="small muted">это ты</span>
                    ) : (
                      <UserDeleteButton userId={user.id} email={user.email} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <nav className="admin-pages" aria-label="Страницы">
          {Array.from({ length: pages }, (_, index) => index + 1).map((value) => (
            <Link
              key={value}
              className={`admin-page${value === currentPage ? " is-active" : ""}`}
              href={`/admin/users?${query ? `q=${encodeURIComponent(query)}&` : ""}page=${value}`}
            >
              {value}
            </Link>
          ))}
        </nav>
      ) : null}

      <p className="small muted">Всего: {total}</p>
    </>
  );
}
