import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface CacheOptions {
  /** Каталог кеша ответов источников. Без него каждый прогон идёт в сеть. */
  dir?: string;
  refresh?: boolean;
}

export async function cachedJson<T>(
  cache: CacheOptions | undefined,
  key: string,
  loader: () => Promise<T>,
): Promise<T> {
  if (!cache?.dir) return loader();
  const file = path.join(cache.dir, `${key}.json`);
  if (!cache.refresh) {
    try {
      return JSON.parse(await readFile(file, "utf8")) as T;
    } catch {
      // кеша нет или он повреждён — идём в сеть
    }
  }
  const value = await loader();
  await mkdir(cache.dir, { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return value;
}

export async function cachedText(
  cache: CacheOptions | undefined,
  key: string,
  extension: string,
  loader: () => Promise<string>,
): Promise<string> {
  if (!cache?.dir) return loader();
  const file = path.join(cache.dir, `${key}.${extension}`);
  if (!cache.refresh) {
    try {
      return await readFile(file, "utf8");
    } catch {
      // кеша нет — идём в сеть
    }
  }
  const value = await loader();
  await mkdir(cache.dir, { recursive: true });
  await writeFile(file, value, "utf8");
  return value;
}

/** Чтение HTTP-страницы как текста. FetchLike отдаёт json(), но Response умеет text(). */
export async function fetchText(
  fetchImpl: (input: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number }>,
  url: string,
  accept: string,
  timeoutMs = 60_000,
): Promise<string> {
  const response = await fetchImpl(url, {
    headers: { Accept: accept },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Источник ответил ${response.status} на ${url}`);
  const candidate = response as unknown as { text?: () => Promise<string> };
  if (typeof candidate.text !== "function") {
    throw new Error(`Источник не дал текст страницы ${url}`);
  }
  return candidate.text();
}
