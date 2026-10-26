const USER_AGENT = "COS-LearningSourcesBot/0.1 (+https://github.com/cosprojects/Competency-Operating-System)";

export interface RobotsRules {
  allow: string[];
  disallow: string[];
}

function patternToRegExp(pattern: string): RegExp {
  const end = pattern.endsWith("$");
  const body = end ? pattern.slice(0, -1) : pattern;
  const escaped = body
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}${end ? "$" : ""}`);
}

/** Минимальный парсер robots.txt: группы User-agent: * и наш UA, Disallow/Allow. */
export function parseRobots(text: string, userAgent = USER_AGENT): RobotsRules {
  const rules: RobotsRules = { allow: [], disallow: [] };
  const lines = text.split(/\r?\n/);
  let currentAgents: string[] = [];
  let collecting = false;
  const agentMatches = (agent: string): boolean => {
    const value = agent.trim().toLowerCase();
    if (value === "*") return true;
    return userAgent.toLowerCase().includes(value) || value.includes("cos-learningsourcesbot");
  };
  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const [directive, ...rest] = line.split(":");
    const key = (directive ?? "").trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      if (!collecting) {
        currentAgents.push(value);
      } else {
        // новая группа
        currentAgents = [value];
        collecting = false;
      }
      continue;
    }
    if (key !== "disallow" && key !== "allow") continue;
    const applies = currentAgents.some(agentMatches);
    if (!applies) continue;
    collecting = true;
    if (!value) continue;
    if (key === "allow") rules.allow.push(value);
    else rules.disallow.push(value);
  }
  return rules;
}

/**
 * Проверяет путь по правилам robots: longest match wins, при равенстве приоритет у Allow.
 * Неизвестные правила (нет совпадений) считаются разрешёнными.
 */
export function isPathAllowed(rules: RobotsRules, path: string): boolean {
  const matches = (patterns: string[]): string | undefined =>
    patterns.filter((pattern) => patternToRegExp(pattern).test(path)).sort((a, b) => b.length - a.length)[0];
  const allow = matches(rules.allow);
  const disallow = matches(rules.disallow);
  if (disallow === undefined) return true;
  if (allow === undefined) return false;
  return allow.length >= disallow.length;
}

export function robotsUrl(url: string): string {
  const parsed = new URL(url);
  return `${parsed.origin}/robots.txt`;
}

export type RobotsFetchLike = (input: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  text?: () => Promise<string>;
}>;

export interface RobotsDecision {
  allowed: boolean;
  reason: string;
}

/** Загружает robots.txt и решает, можно ли идти по адресу. Ошибка сети = запрет (safe-by-default). */
export async function checkRobots(
  fetchImpl: RobotsFetchLike,
  url: string,
  cache?: { get: (key: string) => Promise<string | undefined>; set: (key: string, value: string) => Promise<void> },
): Promise<RobotsDecision> {
  const robots = robotsUrl(url);
  let text: string | undefined;
  try {
    text = (await cache?.get(robots)) ?? undefined;
    if (text === undefined) {
      const response = await fetchImpl(robots, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(15_000) });
      if (!response.ok) {
        const isNotFound = response.status === 404 || response.status === 410;
        return { allowed: isNotFound, reason: isNotFound ? "robots.txt отсутствует (404) — разрешено" : `robots.txt ответил ${response.status}` };
      }
      text = (await response.text?.()) ?? "";
      await cache?.set(robots, text);
    }
  } catch {
    return { allowed: false, reason: "robots.txt недоступен — не рискуем" };
  }
  const path = new URL(url).pathname;
  const allowed = isPathAllowed(parseRobots(text), path);
  return { allowed, reason: allowed ? "robots.txt разрешает" : "robots.txt запрещает" };
}

export { USER_AGENT };
