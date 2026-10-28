"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { trackClient } from "@/lib/client-analytics";

export function PageViewTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastPath.current === pathname) return;
    lastPath.current = pathname;
    const referrerType = document.referrer
      ? document.referrer.startsWith(window.location.origin)
        ? "internal"
        : "external"
      : "none";
    trackClient("page_view", { path: pathname, locale: "ru", referrer_type: referrerType });
  }, [pathname]);

  return null;
}
