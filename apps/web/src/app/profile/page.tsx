import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { findCompetencies, findSource, getProfession } from "@/lib/content";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Профиль — AXIONA",
};

type SavedItem = { key: string; title: string; meta: string; href: string };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent("/profile")}`);

  const db = getDb();
  const [favorites, favoriteCount, statusCount, viewCount, feedbackCount, consents] = await Promise.all([
    db.favorite.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 12 }),
    db.favorite.count({ where: { userId: user.id } }),
    db.studyStatus.count({ where: { userId: user.id } }),
    db.sourceView.count({ where: { userId: user.id } }),
    db.feedback.count({ where: { userId: user.id } }),
    db.consentRecord.findMany({ where: { userId: user.id }, orderBy: { grantedAt: "desc" } }),
  ]);

  const saved = favorites
    .map((item): SavedItem | null => {
      if (item.targetType === "PROFESSION") {
        const profession = getProfession(item.targetId);
        return profession
          ? { key: `${item.targetType}:${item.targetId}`, title: profession.title, meta: "Профессия", href: `/professions/${profession.slug}` }
          : null;
      }
      if (item.targetType === "COMPETENCY") {
        const occurrence = findCompetencies(item.targetId)[0];
        return occurrence
          ? { key: `${item.targetType}:${item.targetId}`, title: occurrence.competency.title, meta: "Компетенция", href: `/professions/${occurrence.profession.slug}?competency=${occurrence.competency.id}` }
          : null;
      }
      const source = findSource(item.targetId);
      return source
        ? { key: `${item.targetType}:${item.targetId}`, title: source.title, meta: "Материал", href: "/saved" }
        : null;
    })
    .filter((item): item is SavedItem => item !== null);

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Профиль</div>
        <h1>{user.email}</h1>
        <p>Твои действия в AXIONA: сохранения, просмотры и прогресс. Аккаунт и данные — отдельно.</p>
      </div>

      <div className="card-grid">
        <div className="card"><span className="small muted">Сохранения</span><h2 style={{ marginTop: 6 }}>{favoriteCount}</h2></div>
        <div className="card"><span className="small muted">Статусы</span><h2 style={{ marginTop: 6 }}>{statusCount}</h2></div>
        <div className="card"><span className="small muted">Просмотры</span><h2 style={{ marginTop: 6 }}>{viewCount}</h2></div>
        <div className="card"><span className="small muted">Отзывы</span><h2 style={{ marginTop: 6 }}>{feedbackCount}</h2></div>
      </div>

      <div className="actions" style={{ marginTop: 16 }}>
        <Link className="button" href="/saved">Открыть сохранённое</Link>
        <Link className="button secondary" href="/account">Аккаунт и данные</Link>
      </div>

      <section className="section">
        <h2>Последние сохранения</h2>
        {saved.length === 0 ? (
          <div className="empty">
            <p>Пока пусто. Сохрани профессию, компетенцию или материал — здесь появятся последние действия.</p>
            <Link className="button" href="/professions">Выбрать профессию</Link>
          </div>
        ) : (
          <div className="saved-section-box">
            <ul className="checklist">
              {saved.map((item) => (
                <li key={item.key}>
                  <span className="small muted">{item.meta}</span>{" "}
                  <Link href={item.href}>{item.title}</Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <p className="small muted">
        Аккаунт создан {user.createdAt.toISOString().slice(0, 10)}. Согласия: {consents.length === 0 ? "нет записей" : `${consents.length} записей`}.
      </p>
    </>
  );
}
