"use client";

import Link from "next/link";
import { trackClient } from "@/lib/client-analytics";
import type { LandingVariantId } from "@/lib/landing-variants";

export function OfferCta({
  href,
  label,
  ctaId,
  variant,
  secondary = false,
}: {
  href: string;
  label: string;
  ctaId: string;
  variant: LandingVariantId;
  secondary?: boolean;
}) {
  return (
    <Link
      className={secondary ? "button secondary" : "button"}
      href={href}
      onClick={() => {
        trackClient("cta_click", {
          cta_id: ctaId,
          cta_target: href,
          landing_variant: variant,
          page: "/offer",
        });
      }}
    >
      {label}
    </Link>
  );
}
