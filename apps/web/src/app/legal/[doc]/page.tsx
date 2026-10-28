import { notFound } from "next/navigation";
import { getLegalDocument, legalDocuments } from "@/content/legal";

export function generateStaticParams() {
  return legalDocuments.map((document) => ({ doc: document.slug }));
}

export const metadata = {
  title: "Правовая информация — AXIONA",
};

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const document = getLegalDocument(doc);
  if (!document) notFound();

  return (
    <article className="card" style={{ maxWidth: 900, margin: "0 auto" }}>
      <div className="eyebrow">Правовая информация</div>
      <h1 style={{ fontSize: "clamp(28px, 4vw, 42px)", margin: "8px 0 6px" }}>{document.title}</h1>
      <p className="small muted">Обновлено: {document.updated}</p>
      {document.draft ? <div className="notice">{document.intro}</div> : null}
      <div className="section-list" style={{ marginTop: 18 }}>
        {document.sections.map((section) => (
          <section key={section.heading}>
            <h2 style={{ fontSize: 22, marginBottom: 8 }}>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="muted" style={{ marginTop: 0 }}>
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
