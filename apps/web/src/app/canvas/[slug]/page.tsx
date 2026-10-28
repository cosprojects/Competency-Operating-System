import Link from "next/link";
import { notFound } from "next/navigation";
import { CANVAS_LINKS, canvasHref, canvasPageHref } from "@/lib/canvas";

export function generateStaticParams() {
  return CANVAS_LINKS.map((item) => ({ slug: item.slug }));
}

export default async function CanvasViewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = CANVAS_LINKS.find((candidate) => candidate.slug === slug);
  if (!item) notFound();

  return (
    <div className="canvas-embed-page">
      <div className="canvas-embed-head">
        <div>
          <div className="breadcrumbs">
            <Link href="/canvas">Схемы</Link>
            <span>/</span>
            <span>{item.title}</span>
          </div>
          <h1>{item.title}</h1>
          <p className="small muted">
            Схема компетенций: узлы, связи, приоритеты и источники. Перетаскивание — панорама,
            колесо — масштаб.
          </p>
        </div>
        <a className="button secondary small" href={canvasHref(item.file)} target="_blank" rel="noreferrer">
          Открыть отдельно ↗
        </a>
      </div>

      <nav className="canvas-embed-tabs" aria-label="Другие схемы">
        {CANVAS_LINKS.map((candidate) => (
          <Link
            key={candidate.slug}
            className={`profession-tab${candidate.slug === item.slug ? " active" : ""}`}
            href={canvasPageHref(candidate.slug)}
          >
            {candidate.title.replace("-дизайнер", "").replace("UX/UI", "UX/UI")}
          </Link>
        ))}
      </nav>

      <div className="canvas-embed-frame">
        <iframe
          src={`${canvasHref(item.file)}?embed=1`}
          title={`Схема компетенций: ${item.title}`}
          loading="eager"
        />
      </div>
    </div>
  );
}
