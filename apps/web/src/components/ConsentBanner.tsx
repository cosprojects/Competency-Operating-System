"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { setAnalyticsConsent, trackClient } from "@/lib/client-analytics";

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hasDecision = document.cookie
      .split(";")
      .some((part) => part.trim().startsWith("axiona_consent="));
    setVisible(!hasDecision);
  }, []);

  if (!visible) return null;

  return (
    <div className="consent-banner" role="dialog" aria-label="Согласие на аналитику">
      <div>
        Мы используем необходимые cookie для входа и, с вашего согласия, обезличенную аналитику.
        Подробнее — <Link href="/legal/cookies">в описании cookie</Link>.
      </div>
      <div className="actions">
        <button
          className="button secondary small"
          type="button"
          onClick={() => {
            setAnalyticsConsent("necessary");
            setVisible(false);
          }}
        >
          Только необходимое
        </button>
        <button
          className="button small"
          type="button"
          onClick={() => {
            setAnalyticsConsent("all");
            trackClient("page_view", {
              path: window.location.pathname,
              locale: "ru",
              referrer_type: document.referrer ? "external" : "none",
            });
            setVisible(false);
          }}
        >
          Принять аналитику
        </button>
      </div>
    </div>
  );
}
