"use client";

import Link from "next/link";
import { FeedbackTrigger } from "@/components/feedback/FeedbackTrigger";

export function Footer() {
  return (
    <footer className="footer">
      <div>
        <strong>AXIONA</strong> — карта компетенций дизайнера. Beta 1.
        <div className="small">База для следующего слоя — диагностики и оценки.</div>
      </div>
      <div className="footer-links">
        <Link href="/legal/privacy">Политика конфиденциальности</Link>
        <Link href="/legal/terms">Условия использования</Link>
        <Link href="/legal/cookies">Cookie</Link>
        <FeedbackTrigger className="link-button" options={{ context: "general" }}>
          Обратная связь
        </FeedbackTrigger>
        <a href="mailto:support@axiona.world">support@axiona.world</a>
      </div>
    </footer>
  );
}
