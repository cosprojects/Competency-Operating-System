import Link from "next/link";
import { redirect } from "next/navigation";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";
import { ConsentControls } from "@/components/account/ConsentControls";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Аккаунт — AXIONA",
};

function consentKindLabel(kind: string): string {
  switch (kind) {
    case "TERMS":
      return "Условия использования";
    case "PRIVACY":
      return "Политика конфиденциальности";
    case "ANALYTICS":
      return "Аналитика";
    case "MARKETING":
      return "Маркетинговые сообщения";
    default:
      return kind;
  }
}

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent("/account")}`);

  const db = getDb();
  const [consents, favorites, statuses, feedback] = await Promise.all([
    db.consentRecord.findMany({ where: { userId: user.id }, orderBy: { grantedAt: "desc" } }),
    db.favorite.count({ where: { userId: user.id } }),
    db.studyStatus.count({ where: { userId: user.id } }),
    db.feedback.count({ where: { userId: user.id } }),
  ]);

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Аккаунт</div>
        <h1>{user.email}</h1>
        <p>Аккаунт создан {user.createdAt.toISOString().slice(0, 10)}. Пароля нет: вход по ссылке из письма.</p>
        <div className="actions" style={{ marginTop: 14 }}>
          <Link className="button secondary small" href="/profile">Открыть профиль</Link>
        </div>
      </div>

      <div className="two-col">
        <section className="section-block">
          <header>
            <div>
              <h2>Что хранится</h2>
              <p>Только то, что нужно для работы карты и ваших сохранений.</p>
            </div>
          </header>
          <dl className="kv">
            <dt>Email</dt>
            <dd>{user.email}</dd>
            <dt>Сохранённые</dt>
            <dd>{favorites}</dd>
            <dt>Статусы</dt>
            <dd>{statuses}</dd>
            <dt>Отзывы</dt>
            <dd>{feedback}</dd>
            <dt>Согласия</dt>
            <dd>{consents.length === 0 ? "нет записей" : `${consents.length} записей`}</dd>
          </dl>

          <h3 style={{ marginTop: 20 }}>Согласия и версии документов</h3>
          {consents.length === 0 ? (
            <p className="muted">Записей пока нет: согласие фиксируется при входе и при выборе в cookie-баннере.</p>
          ) : (
            <dl className="kv">
              {consents.map((consent) => (
                <div key={consent.id}>
                  <dt>{consentKindLabel(consent.kind)}</dt>
                  <dd>
                    версия {consent.version} · {consent.grantedAt.toISOString().slice(0, 10)}
                    {consent.revokedAt ? ` · отозвано ${consent.revokedAt.toISOString().slice(0, 10)}` : ""}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <ConsentControls />
          <p className="small muted" style={{ marginTop: 12 }}>
            Подробнее — в <Link href="/legal/privacy">политике конфиденциальности</Link>. Запросить копию
            согласий или отозвать их можно через <a href="mailto:privacy@axiona.world">privacy@axiona.world</a>.
          </p>
        </section>

        <aside className="section-list">
          <section className="section-block">
            <header>
              <div>
                <h2>Сессия</h2>
                <p>Выйти можно на этом устройстве.</p>
              </div>
            </header>
            <form action="/api/auth/logout" method="post">
              <button className="button secondary small" type="submit">
                Выйти
              </button>
            </form>
          </section>

          <section className="section-block">
            <header>
              <div>
                <h2>Удаление</h2>
                <p>Удаляются аккаунт, сохранения, статусы и отзывы. События аналитики обезличиваются.</p>
              </div>
            </header>
            <DeleteAccountButton />
          </section>
        </aside>
      </div>
    </>
  );
}
