import Link from "next/link";
import { ProfessionCard } from "@/components/ProfessionCard";
import { content, getProfessions } from "@/lib/content";

export default function HomePage() {
  const professions = getProfessions();
  return (
    <>
      <section className="hero">
        <div>
          <div className="eyebrow">AXIONA · Beta 1</div>
          <h1>Карта компетенций, которая объясняет профессию</h1>
          <p className="lead">
            Выберите профессию, разберитесь в её структуре, посмотрите знания и навыки каждой
            компетенции и найдите материалы, с которых можно начать. Без диагностики и обещаний
            «уровня» — только структура и источники.
          </p>
          <div className="actions">
            <Link className="button" href="/professions">
              Выбрать профессию
            </Link>
            <Link className="button secondary" href="/feedback">
              Оставить обратную связь
            </Link>
          </div>
          <div className="stats">
            <span className="stat">
              <strong>{content.stats.professions}</strong> профессии
            </span>
            <span className="stat">
              <strong>{content.stats.publishedCompetencies}</strong> компетенций
            </span>
            <span className="stat">
              <strong>{content.stats.sources}</strong> материалов
            </span>
            <span className="stat">
              <strong>{content.stats.publishedLinks}</strong> связей «профессия–компетенция»
            </span>
          </div>
        </div>
        <aside className="hero-panel">
          <h2>Что внутри</h2>
          <ul>
            <li>
              <span className="check">✓</span> Профессия как структура, а не список курсов
            </li>
            <li>
              <span className="check">✓</span> Знания и навыки по каждой компетенции
            </li>
            <li>
              <span className="check">✓</span> Учебные материалы с типом, доступом и языком
            </li>
            <li>
              <span className="check">✓</span> Сохранения и статусы изучения
            </li>
            <li>
              <span className="check">✓</span> Обратная связь о качестве карты
            </li>
          </ul>
        </aside>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <div className="eyebrow">Профессии</div>
            <h2>С чего начать</h2>
            <p>
              В Beta опубликованы четыре направления. Покрытие указано честно: часть карты ещё
              в разработке и не показывается как готовая.
            </p>
          </div>
        </div>
        <div className="card-grid">
          {professions.map((profession) => (
            <ProfessionCard key={profession.id} profession={profession} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <div className="eyebrow">Как это работает</div>
            <h2>От профессии к конкретному шагу</h2>
          </div>
        </div>
        <div className="card-grid">
          <article className="card">
            <span className="badge neutral">1</span>
            <h3 style={{ marginTop: 10 }}>Выберите профессию</h3>
            <p>Посмотрите разделы и поймите, из чего состоит направление.</p>
          </article>
          <article className="card">
            <span className="badge neutral">2</span>
            <h3 style={{ marginTop: 10 }}>Откройте компетенцию</h3>
            <p>Проверьте, какие знания и навыки в неё входят и что с ними делать.</p>
          </article>
          <article className="card">
            <span className="badge neutral">3</span>
            <h3 style={{ marginTop: 10 }}>Найдите материал</h3>
            <p>Перейдите к курсу или статье и сохраните то, к чему хотите вернуться.</p>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="notice info">
          Beta 1 — базовый слой: карта компетенций. Диагностика и оценка — следующий слой,
          они требуют нормально собранных компетенций. Сейчас мы не оцениваем ваш уровень,
          не строим индивидуальный маршрут и не подтверждаем навыки. Если карта помогает
          ориентироваться — расскажите, чего в ней не хватает.
        </div>
      </section>
    </>
  );
}
