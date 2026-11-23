import type { JsonLdNode } from "@/lib/structured-data";

/**
 * JSON-LD на странице. `<` экранируем, чтобы данные модели не могли закрыть
 * тег script и попасть в HTML как разметка.
 */
export function JsonLd({ data }: { data: JsonLdNode | JsonLdNode[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
