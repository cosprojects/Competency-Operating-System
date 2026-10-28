"use client";

import type { EventName } from "./validation";

export function hasAnalyticsConsent(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((part) => part.trim() === "axiona_consent=all");
}

export function trackClient(
  name: EventName,
  props?: Record<string, string | number | boolean>,
): void {
  if (!hasAnalyticsConsent()) return;
  const body = JSON.stringify({ name, path: window.location.pathname, props });
  try {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon("/api/events", blob)) return;
  } catch {
    // fall through to fetch
  }
  void fetch("/api/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  });
}

export function setAnalyticsConsent(value: "all" | "necessary"): void {
  const maxAge = 180 * 24 * 60 * 60;
  document.cookie = `axiona_consent=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}
