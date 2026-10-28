import { CANVAS_LINKS, canvasPageHref } from "@/lib/canvas";

export const metadata = {
  title: "Схемы компетенций — AXIONA",
  description: "Интерактивные сети компетенций по профессиям: узлы, связи, приоритеты и источники.",
};

function CanvasCard({ item }: { item: (typeof CANVAS_LINKS)[number] }) {
  return (
    <a
      className="card profession-card"
      href={canvasPageHref(item.slug)}
      target="_blank"
      rel="noreferrer"
    >
      <div className="meta" style={{ justifyContent: "space-between" }}>
        <span className={`badge ${item.beta ? "" : "neutral"}`}>{item.beta ? "Beta 1" : "Research"}</span>
        <span className="small muted">Открыть ↗</span>
      </div>
      <h3 style={{ marginTop: 10 }}>{item.title}</h3>
      <p>{item.description}</p>
      <div className="coverage" style={{ marginTop: "auto", paddingTop: 16 }}>
        <span className="button secondary small" style={{ width: "100%" }}>
          Открыть схему
        </span>
      </div>
    </a>
  );
}

export default function CanvasPage() {
  const beta = CANVAS_LINKS.filter((item) => item.beta);
  const research = CANVAS_LINKS.filter((item) => !item.beta);
  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Схемы компетенций</div>
        <h1>Граф профессии, а не список курсов</h1>
        <p>
          Откройте интерактивную схему: узлы — компетенции, связи — зависимости, панель справа —
          знания, навыки и источники. Схемы открываются в отдельной полноэкранной вкладке.
        </p>
      </div>

      <div className="card-grid">
        {beta.map((item) => (
          <CanvasCard key={item.slug} item={item} />
        ))}
      </div>

      <section className="section">
        <div className="section-head">
          <div>
            <div className="eyebrow">Исследовательские схемы</div>
            <h2>Ещё направления</h2>
            <p>
              Эти карты доступны для просмотра и обратной связи, но ещё не входят в публичный
              набор Beta 1.
            </p>
          </div>
        </div>
        <div className="card-grid">
          {research.map((item) => (
            <CanvasCard key={item.slug} item={item} />
          ))}
        </div>
      </section>

      <div className="notice info" style={{ marginTop: 22 }}>
        Схема показывает структуру компетенций и связи. Она не оценивает ваш уровень и не строит
        индивидуальный маршрут — это следующий слой продукта.
      </div>
    </>
  );
}
