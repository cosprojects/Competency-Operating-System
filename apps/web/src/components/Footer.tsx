import Link from "next/link";

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div>
          <strong>AXIONA</strong> — карта компетенций дизайнера. Beta 1.
          <div className="small">База для следующего слоя — диагностики и оценки.</div>
        </div>
        <div className="footer-links">
          <Link href="/legal/privacy">Политика конфиденциальности</Link>
          <Link href="/legal/terms">Условия использования</Link>
          <Link href="/legal/cookies">Cookie</Link>
          <Link href="/feedback">Обратная связь</Link>
          <a href="mailto:support@axiona.world">support@axiona.world</a>
        </div>
      </div>
    </footer>
  );
}
