import Link from "next/link";
import { notFound } from "next/navigation";
import { CompetencyCard } from "@/components/CompetencyCard";
import { getProfession, getProfessions } from "@/lib/content";

export function generateStaticParams() {
  return getProfessions().map((profession) => ({ slug: profession.slug }));
}

export default async function ProfessionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profession = getProfession(slug);
  if (!profession) notFound();

  return (
    <>
      <div className="breadcrumbs">
        <Link href="/">Главная</Link>
        <span>/</span>
        <Link href="/professions">Профессии</Link>
        <span>/</span>
        <span>{profession.title}</span>
      </div>

      <div className="page-head">
        <div className="meta" style={{ justifyContent: "space-between" }}>
          <span className="badge">{profession.titleEn ?? "Профессия"}</span>
          <span className="small muted">
            Опубликовано {profession.coverage.published} из {profession.coverage.total} компетенций
          </span>
        </div>
        <h1>{profession.title}</h1>
        <p>{profession.description}</p>
        <div className="coverage" style={{ marginTop: 18, maxWidth: 520 }}>
          <div className="coverage-bar" aria-hidden="true">
            <span style={{ width: `${profession.coverage.percent}%` }} />
          </div>
          <div className="coverage-text">
            <span>Покрытие Beta</span>
            <span>{profession.coverage.percent}%</span>
          </div>
        </div>
      </div>

      {profession.sections.length === 0 ? (
        <div className="empty">
          <h2>Пока нет опубликованных компетенций</h2>
          <p>Эта часть карты ещё проходит проверку. Загляните в другие профессии.</p>
        </div>
      ) : (
        <div className="section-list">
          {profession.sections.map((section) => (
            <section className="section-block" key={section.id}>
              <header>
                <div>
                  <h2>{section.title}</h2>
                  {section.definition ? <p>{section.definition}</p> : null}
                </div>
                <span>{section.competencies.length} компетенций</span>
              </header>
              <div className="competency-grid">
                {section.competencies.map((competency) => (
                  <CompetencyCard key={competency.id} competency={competency} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="notice info" style={{ marginTop: 22 }}>
        В Beta опубликованы только проверенные компетенции. Если вы не нашли нужную —{" "}
        <Link href="/feedback">сообщите о пробеле</Link>.
      </div>
    </>
  );
}
