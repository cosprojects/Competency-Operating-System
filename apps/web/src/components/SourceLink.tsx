"use client";

import Link from "next/link";
import type { ContentSource } from "@/lib/content-types";
import { trackClient } from "@/lib/client-analytics";

export function SourceLink({
  source,
  competencyId,
  canOpen,
  returnTo,
}: {
  source: ContentSource;
  competencyId: string;
  canOpen: boolean;
  returnTo: string;
}) {
  if (!canOpen) {
    return (
      <Link
        className="button secondary small"
        href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
        onClick={() =>
          trackClient("source_gate_view", {
            competency_id: competencyId,
            source_id: source.id,
          })
        }
      >
        Войти и открыть
      </Link>
    );
  }

  return (
    <a
      className="button small"
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() =>
        trackClient("source_click", {
          competency_id: competencyId,
          source_id: source.id,
          source_kind: source.kind,
          access: source.access,
        })
      }
    >
      Открыть материал
    </a>
  );
}
