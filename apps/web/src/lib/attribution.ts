"use client";

/**
 * Атрибуция первого касания для бизнес-аналитики.
 *
 * Хранит только обезличенные UTM-метки, вариант посадочной и хост источника.
 * Email, query-параметры с персональными данными и полный referrer не сохраняются.
 */

const VARIANT_COOKIE = "axiona_landing_variant";
const MAX_VALUE_LENGTH = 80;

function cleanValue(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().slice(0, MAX_VALUE_LENGTH);
  if (!trimmed) return undefined;
  // В метках не должно быть email и управляющих символов.
  // Разрешаем буквы (включая кириллицу), цифры и типовые разделители.
  if (/[\u0000-\u001f\u007f]/.test(trimmed) || trimmed.includes("@")) return undefined;
  return trimmed;
}

function cleanVariant(value: string | null | undefined): string | undefined {
  const cleaned = cleanValue(value);
  if (!cleaned) return undefined;
  return /^[a-z0-9_-]{1,16}$/i.test(cleaned) ? cleaned.toLowerCase() : undefined;
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const item = part.trim();
    if (item.startsWith(prefix)) return decodeURIComponent(item.slice(prefix.length));
  }
  return undefined;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=15552000; SameSite=Lax`;
}

export function getLandingVariant(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const params = new URLSearchParams(window.location.search);
  const fromQuery = cleanVariant(params.get("variant"));
  if (fromQuery) {
    writeCookie(VARIANT_COOKIE, fromQuery);
    return fromQuery;
  }
  return cleanVariant(readCookie(VARIANT_COOKIE));
}

export function getAttributionProps(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const props: Record<string, string> = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const value = cleanValue(params.get(key));
    if (value) props[key] = value;
  }
  const variant = getLandingVariant();
  if (variant) props.landing_variant = variant;
  if (document.referrer) {
    try {
      const referrer = new URL(document.referrer);
      if (referrer.origin !== window.location.origin) {
        props.referrer_host = referrer.hostname.slice(0, MAX_VALUE_LENGTH);
      }
    } catch {
      // Некорректный referrer не влияет на страницу и не сохраняется.
    }
  }
  return props;
}

export { VARIANT_COOKIE };
