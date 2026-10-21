import type { CandidateQueue, CompetencyCandidate } from "../candidate-parser/types.ts";

const CYRILLIC = /[а-яё]/i;

function needsRussian(candidate: CompetencyCandidate): boolean {
  return !CYRILLIC.test(`${candidate.phrase} ${candidate.fragment}`);
}

/** Передаёт смысл действия по-русски. Исходный fragment не изменяет. */
export async function translateActions(
  texts: string[],
  apiKey: string,
): Promise<string[]> {
  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL_ID ?? "deepseek-v4-flash",
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            "Передай смысл каждого профессионального действия по-русски одним предложением. Не заменяй слова по словарю и не добавляй действий, которых нет в тексте. Верни JSON-массив строк той же длины и в том же порядке.",
        },
        { role: "user", content: JSON.stringify(texts) },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(`Перевод ответил ${response.status}`);
  }
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = body.choices?.[0]?.message?.content ?? "";
  const parsed = JSON.parse(content.slice(content.indexOf("["), content.lastIndexOf("]") + 1)) as unknown;
  if (!Array.isArray(parsed) || parsed.length !== texts.length || parsed.some((item) => typeof item !== "string")) {
    throw new Error("Перевод вернул не тот список действий");
  }
  return parsed as string[];
}

export async function attachMatchText(
  queue: CandidateQueue,
  apiKey: string | undefined,
): Promise<{ queue: CandidateQueue; translated: number; skipped: boolean }> {
  if (!apiKey) return { queue, translated: 0, skipped: true };
  const pending = queue.candidates.filter(needsRussian);
  const translated: string[] = [];
  const batchSize = 20;
  for (let offset = 0; offset < pending.length; offset += batchSize) {
    const batch = pending.slice(offset, offset + batchSize);
    const part = await translateActions(
      batch.map((candidate) => `${candidate.phrase}. ${candidate.fragment}`),
      apiKey,
    );
    translated.push(...part);
  }
  const byId = new Map(pending.map((candidate, index) => [candidate.id, translated[index]]));
  return {
    translated: pending.length,
    skipped: false,
    queue: {
      ...queue,
      candidates: queue.candidates.map((candidate) => {
        const matchText = byId.get(candidate.id);
        if (!matchText) return candidate;
        return { ...candidate, matchText };
      }),
    },
  };
}
