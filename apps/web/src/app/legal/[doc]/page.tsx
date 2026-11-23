import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { getLegalDocument, legalDocuments } from "@/content/legal";
import { canonical, socialMetadata } from "@/lib/site";

export function generateStaticParams() {
  return legalDocuments.map((document) => ({ doc: document.slug }));
}

/**
 * У каждого документа свой title и description: раньше все три страницы
 * отдавали «Правовая информация — AXIONA», и поисковик видел три одинаковых
 * документа с разным содержимым.
 */
const LEGAL_SEO: Record<string, { title: string; description: string }> = {
  terms: {
    title: "Условия использования — AXIONA",
    description:
      "Правила работы с AXIONA: что делает сервис, что можно и чего нельзя делать, права и обязанности сторон.",
  },
  privacy: {
    title: "Политика конфиденциальности — AXIONA",
    description:
      "Какие данные собирает AXIONA, зачем они нужны, где хранятся, кому передаются и как удалить аккаунт.",
  },
  cookies: {
    title: "Cookie и аналитика — AXIONA",
    description:
      "Какие cookie нужны AXIONA для работы, какая аналитика включена и как отказаться от необязательного.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ doc: string }>;
}): Promise<Metadata> {
  const { doc } = await params;
  const document = getLegalDocument(doc);
  if (!document) return { title: "Правовая информация — AXIONA", robots: { index: false, follow: false } };

  const seo = LEGAL_SEO[document.slug] ?? {
    title: `${document.title} — AXIONA`,
    description: document.intro,
  };
  const path = `/legal/${document.slug}`;

  return {
    title: seo.title,
    description: seo.description,
    alternates: canonical(path),
    ...socialMetadata({ title: seo.title, description: seo.description, path }),
  };
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const document = getLegalDocument(doc);
  if (!document) notFound();

  return (
    <article className="card" style={{ maxWidth: 900, margin: "0 auto" }}>
      <Eyebrow as="div">Правовая информация</Eyebrow>
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
