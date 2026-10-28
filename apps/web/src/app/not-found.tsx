import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty" style={{ marginTop: 40 }}>
      <h2>Страница не найдена</h2>
      <p>Возможно, ссылка устарела или компетенция ещё не опубликована.</p>
      <div className="actions" style={{ justifyContent: "center" }}>
        <Link className="button" href="/professions">
          К профессиям
        </Link>
        <Link className="button secondary" href="/">
          На главную
        </Link>
      </div>
    </div>
  );
}
