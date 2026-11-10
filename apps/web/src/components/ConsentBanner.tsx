"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { setAnalyticsConsent, trackClient } from "@/lib/client-analytics";
import { getAttributionProps } from "@/lib/attribution";

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hasDecision = document.cookie
      .split(";")
      .some((part) => part.trim().startsWith("axiona_consent="));
    setVisible(!hasDecision);
  }, []);

  // Канвас и меню прижаты к низу: пока баннер виден, элементы на экране
  // поднимаются выше него. Высота баннера зависит от ширины экрана, поэтому
  // меряем её и отдаём в CSS-переменную.
  useEffect(() => {
    const root = document.documentElement;
    const banner = bannerRef.current;
    if (!visible || !banner) {
      delete root.dataset.consent;
      root.style.removeProperty("--consent-offset");
      return;
    }
    root.dataset.consent = "pending";
    const update = () => {
      root.style.setProperty("--consent-offset", `${banner.getBoundingClientRect().height + 24}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(banner);
    return () => {
      observer.disconnect();
      delete root.dataset.consent;
      root.style.removeProperty("--consent-offset");
    };
  }, [visible]);

  if (!visible) return null;

  function decide(decision: "all" | "necessary") {
    // Cookie для UI; параллельно решение фиксируется на сервере (ConsentRecord у вошедших).
    setAnalyticsConsent(decision);
    void fetch("/api/consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision }),
      keepalive: true,
    }).catch(() => undefined);
    if (decision === "all") {
      trackClient("page_view", {
        path: window.location.pathname,
        locale: "ru",
        referrer_type: document.referrer ? "external" : "none",
        ...getAttributionProps(),
      });
    }
    setVisible(false);
  }

  return (
    <div
      className="consent-banner"
      role="dialog"
      aria-label="Согласие на аналитику"
      ref={bannerRef}
    >
      <div>
        Мы используем необходимые cookie для входа и, с вашего согласия, обезличенную аналитику.
        Подробнее — <Link href="/legal/cookies">в описании cookie</Link>.
      </div>
      <div className="actions">
        <button className="button secondary small" type="button" onClick={() => decide("necessary")}>
          Только необходимое
        </button>
        <button className="button small" type="button" onClick={() => decide("all")}>
          Принять аналитику
        </button>
      </div>
    </div>
  );
}
