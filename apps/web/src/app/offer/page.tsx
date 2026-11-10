import type { Metadata } from "next";
import Link from "next/link";
import { OfferCta } from "@/components/OfferCta";
import { SiteFooter } from "@/components/SiteFooter";
import { isLandingVariant, LANDING_VARIANTS } from "@/lib/landing-variants";

export const metadata: Metadata = {
  title: "AXIONA — карта компетенций дизайнера",
  description:
    "Карта профессий, компетенций, знаний, навыков и учебных материалов для дизайнеров. Бесплатная Beta.",
  robots: { index: false, follow: false },
};

export default async function OfferPage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  const { variant: rawVariant } = await searchParams;
  const variant = isLandingVariant(rawVariant) ? rawVariant : "a";
  const copy = LANDING_VARIANTS[variant];

  return (
    <>
      <main className="workspace">
        <section className="page-head">
          <div className="eyebrow">{copy.eyebrow}</div>
          <h1>{copy.title}</h1>
          <p>{copy.lead}</p>
          <div className="actions" style={{ marginTop: 20 }}>
            <OfferCta
              href={copy.primaryCta.href}
              label={copy.primaryCta.label}
              ctaId={copy.primaryCta.id}
              variant={variant}
            />
            <OfferCta
              href={copy.secondaryCta.href}
              label={copy.secondaryCta.label}
              ctaId={copy.secondaryCta.id}
              variant={variant}
              secondary
            />
          </div>
          <p className="small muted" style={{ marginTop: 12 }}>
            {copy.priceNote}
          </p>
        </section>

        <section className="section">
          <h2>Что внутри</h2>
          <ul className="checklist">
            {copy.bullets.map((bullet) => (
              <li key={bullet}>
                <span className="check" aria-hidden="true">
                  ✓
                </span>
                {bullet}
              </li>
            ))}
          </ul>
        </section>

        <section className="section">
          <h2>Как это работает</h2>
          <div className="card-grid">
            <article className="card">
              <span className="small muted">01</span>
              <h3>Выбери профессию</h3>
              <p>Посмотри, из каких разделов и компетенций состоит направление.</p>
            </article>
            <article className="card">
              <span className="small muted">02</span>
              <h3>Открой компетенцию</h3>
              <p>Проверь знания и навыки, которые в неё входят, и найди материал.</p>
            </article>
            <article className="card">
              <span className="small muted">03</span>
              <h3>Отметь прогресс</h3>
              <p>Сохрани важное и вернись к следующему шагу, когда будет удобно.</p>
            </article>
          </div>
        </section>

        <section className="section">
          <h2>{copy.offerTitle}</h2>
          <p>{copy.offerText}</p>
          <div className="actions" style={{ marginTop: 16 }}>
            <OfferCta
              href={copy.primaryCta.href}
              label={copy.primaryCta.label}
              ctaId={`bottom-${copy.primaryCta.id}`}
              variant={variant}
            />
            <Link className="button ghost" href="/">
              На главную
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
