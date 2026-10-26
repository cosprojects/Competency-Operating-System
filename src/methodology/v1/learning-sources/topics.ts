const MAX_TOPIC_LENGTH = 80;
const MIN_TOPIC_LENGTH = 3;
const SENTENCE = /[.!?](\s|$)/;
const QUESTION = /^(как|какую|какое|какие|какой|какая|что|куда|зачем|почему|когда|сколько|how|what|why|when|where|which)(\s|$)/i;
const MARKETING =
  /(карьер|ваканс|резюме|портфолио|зарплат|фриланс|отклик|сопроводительн|стажиров|работодател|ментор|мастерск|собеседован|трудоустро|куда пойти|пойти работать|career|salary|resume|portfolio|hiring|job search)/i;
const FIRST_PERSON = /^(владею|создаю|делаю|монтирую|использую|понимаю|разбираюсь|умею|знаю|учусь|i |we |my )/i;
const SUBSCRIPTION = /(подпиш|купить|оставить заявк|записаться|скидк|промокод|subscribe|buy now|sign up|discount|% off|grab your|coupon|promo code|sale\b)/i;
const CONTACT = /(\[email|@|https?:\/\/|www\.|\b\d{2,}\s+[A-Za-z])/i;
const NAV_BOILERPLATE =
  /(terms and conditions|privacy policy|cookie policy|refund policy|license agreement|sign in|sign out|account settings|subscriptions?|orders\/invoices|payments and billing|become an author|follow us|all rights reserved|skip to content|general enquiries|new business|representation|follow:|instagram linkedin)/i;
const PRICE = /([$€£]\s?\d|\d+\s*\/\s*(quarter|year|month)|\bprice\b|\/quarter|\/year)/i;
const CTA_PREFIX =
  /^(learn|train|talk|get|join|start|book|contact|visit|follow|discover|explore|try|buy|see|read|talk to us|дарите|стать|посмотрите|узнайте|оформите|о нас|партнёрам|полезные)/i;
const NAV_EXTRA =
  /(community|dashboard|onboarding|credentials|workshops|critiques|seat|white-glove|learning paths|every course|talk to us|learn alongside)/i;
const DURATION = /(\d+\s*(hours?|hrs?|месяц|мес|час)|с нуля|с опытом|\(\s*\d|^\d+(\.\d+)?\s*(hrs?|hours?)$)/i;
const LEVELS = /^(beginner|intermediate|advanced|продвинутый|новичок|для начинающих)$/i;
const FREEBIE = /^(free|бесплатно|freebie)\b/i;
const GENERIC_TITLES = new Set([
  "courses",
  "blog",
  "masterclasses",
  "scripts",
  "about",
  "anniversary",
  "advertising",
  "learn more",
  "read more",
  "contact",
  "home",
  "menu",
  "search",
]);

/**
 * Заголовки и пункты списков с курсов — короткие темы, а не текст страницы.
 * Полные описания и абзацы не сохраняются: только названия тем/уроков.
 */
export function sanitizeTopic(raw: string): string | undefined {
  const value = raw
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .replace(/^[\s•·\-–—*]+/, "")
    .trim();
  if (value.length < MIN_TOPIC_LENGTH || value.length > MAX_TOPIC_LENGTH) return undefined;
  if (SENTENCE.test(value)) return undefined;
  if (QUESTION.test(value)) return undefined;
  if (MARKETING.test(value)) return undefined;
  if (FIRST_PERSON.test(value)) return undefined;
  if (SUBSCRIPTION.test(value)) return undefined;
  if (CONTACT.test(value)) return undefined;
  if (NAV_BOILERPLATE.test(value)) return undefined;
  if (PRICE.test(value)) return undefined;
  if (GENERIC_TITLES.has(value.toLowerCase())) return undefined;
  if (CTA_PREFIX.test(value)) return undefined;
  if (NAV_EXTRA.test(value)) return undefined;
  if (DURATION.test(value)) return undefined;
  if (LEVELS.test(value)) return undefined;
  if (FREEBIE.test(value)) return undefined;
  return value;
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

/** Извлекает темы из заголовков h1–h3 и пунктов списков. Без текста статей. */
export function extractTopicCandidates(html: string, limit = 40): string[] {
  const chunks: string[] = [];
  for (const match of html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)) {
    if (match[1]) chunks.push(stripTags(match[1]));
  }
  for (const match of html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
    if (match[1]) chunks.push(stripTags(match[1]));
  }
  const seen = new Set<string>();
  const topics: string[] = [];
  for (const chunk of chunks) {
    const topic = sanitizeTopic(chunk);
    if (!topic) continue;
    const key = topic.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    topics.push(topic);
    if (topics.length >= limit) break;
  }
  return topics;
}
