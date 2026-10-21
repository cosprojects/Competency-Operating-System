import { createHash } from "node:crypto";

export function normalizeTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function hashId(prefix: string, value: string): string {
  return `${prefix}_${createHash("sha1").update(value).digest("hex").slice(0, 12)}`;
}

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
  э: "e", ю: "yu", я: "ya",
};

function transliterate(text: string): string {
  return [...text].map((char) => TRANSLIT[char] ?? char).join("");
}

export function slugify(title: string, fallback = "item"): string {
  const latin = transliterate(normalizeTitle(title))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return latin.length > 0 ? latin.slice(0, 80) : `${fallback}-${createHash("sha1").update(title).digest("hex").slice(0, 8)}`;
}

export function cleanText(text: string | undefined): string {
  return (text ?? "")
    .replace(/\\n/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function mapLimited<T, R>(
  items: readonly T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item === undefined) return;
      results[index] = await run(item);
    }
  }
  const workers = Math.min(Math.max(limit, 1), items.length);
  if (workers > 0) await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

export { mapLimited };

export function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const value = key(item);
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(item);
  }
  return out;
}
