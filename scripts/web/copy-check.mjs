#!/usr/bin/env node
/**
 * copy:check — анти-слоп и голос продукта для интерфейсных строк.
 *
 * Источник правил: docs/06-communication/COS-COM-010-Voice-and-Tone.md,
 * AGENTS.md § «Голос и тексты», внешний чек-лист
 * ~/Documents/dsh-skills/ux/ux-copy/references/anti-slop.md.
 *
 * Что проверяет: строки интерфейса в apps/web/src (литералы и текст JSX):
 * обращение на «вы», восклицательные знаки, эмодзи, маркетинговые клише,
 * канцелярит, давление, восторг, лишние англицизмы.
 *
 * Не проверяет: юридические тексты (content/legal.ts — там точность важнее тона),
 * сгенерированные кластеры (content/generated), ассеты и вендорные файлы.
 *
 * Запуск: npm run copy:check
 * Код выхода: 0 — чисто, 1 — есть нарушения.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = "apps/web/src";
const EXTS = new Set([".ts", ".tsx"]);

/** Каталоги и файлы вне проверки. */
const SKIP = [
  /(^|\/)assets\//,
  /(^|\/)vendor\//,
  /(^|\/)content\/generated\//,
  /(^|\/)content\/legal\.ts$/,
];

/** Строки, проверенные вручную и признанные допустимыми. */
const ALLOWLIST = [
  "useFeedback должен использоваться внутри FeedbackProvider",
  // Авторская подпись навигации: владелец оставил «Ваш фидбек» осознанно (2026-11-20).
  "Ваш фидбек",
];

/**
 * Авторские тексты: лендинг, личные обращения, подписи вариантов оффера, лог.
 * Их пишет владелец продукта; агент не переписывает их без согласования.
 * Нарушения здесь — предупреждения, а не ошибки: код выхода от них не падает.
 */
const AUTHORED = [
  /(^|\/)app\/page\.tsx$/,
  /(^|\/)components\/WhyDialog\.tsx$/,
  /(^|\/)components\/account\/WelcomeToast\.tsx$/,
  /(^|\/)lib\/landing-variants\.ts$/,
  /(^|\/)content\/changelog\.ts$/,
];

/** Правила: id, что искать, как исправить. */
const RULES = [
  {
    id: "formal-address",
    label: "обращение на «вы»",
    fix: "пиши на «ты» и в единственном числе: «посмотри», а не «посмотрите» (COS-COM-010 §3)",
    test: (text) => {
      const pronouns = new Set(["вы", "вас", "вам", "ваш", "ваша", "ваши", "вашего", "вашему", "вашей", "вашим", "вашими", "ваших"]);
      const pluralVerbs = new Set([
        "посмотрите","выберите","откройте","проверьте","введите","нажмите","сохраните","отметьте","добавьте",
        "удалите","напишите","скажите","расскажите","поделитесь","попробуйте","вернитесь","перейдите","зайдите",
        "начните","продолжите","соберите","создайте","войдите","отправьте","загрузите","обновите","укажите",
        "оцените","свяжитесь","обратитесь","используйте","прочитайте","сравните","подтвердите","запросите",
        "дождитесь","будьте","примите","измените","закройте","спросите","ответьте","ознакомьтесь","уточните",
        "купите","платите","оставьте","пригласите","воспользуйтесь","следуйте","запомните",
      ]);
      const words = text.toLowerCase().match(/[а-яё-]+/g) ?? [];
      const hit = words.find((word) => pronouns.has(word) || pluralVerbs.has(word));
      return hit ? "«" + hit + "»" : null;
    },
  },
  {
    id: "exclamation",
    label: "восклицательный знак",
    fix: "убери «!»: типографика слопа (COS-COM-010 §6)",
    test: (text) => (text.includes("!") ? "«!»" : null),
  },
  {
    id: "emoji",
    label: "эмодзи в интерфейсе",
    fix: "эмодзи в интерфейсе запрещены (COS-COM-010 §6)",
    test: (text) => {
      const match = text.replace(/[©®™]/g, "").match(/\p{Extended_Pictographic}/u);
      return match ? match[0] : null;
    },
  },
  {
    id: "cliche",
    label: "маркетинговое клише",
    fix: "замени клише конкретным действием и его последствием (anti-slop §1, §9)",
    test: (text) => {
      const patterns = [
        /погруз\w*/i, /раскро(?:й|йте|ет|ем)\w*/i, /раскрыва\w*/i, /потенциал\w*/i, /новый уровень/i,
        /мир возможностей/i, /бесшовн\w*/i, /инновацион\w*/i, /революцион\w*/i, /уникальн\w*/i,
        /в современном мире/i, /не просто(?![\p{L}\d])/iu, /больше, чем(?![\p{L}\d])/iu, /открой для себя/i, /путь развития/i,
        /строй свой путь/i, /играет важную роль/i, /является ключом/i,
      ];
      const match = patterns.map((pattern) => text.match(pattern)).find(Boolean);
      return match ? "«" + match[0] + "»" : null;
    },
  },
  {
    id: "bureaucracy",
    label: "канцелярит",
    fix: "замени на глагол в активном залоге (anti-slop §3, §12)",
    test: (text) => {
      const patterns = [
        /является/i, /осуществля\w*/i, /производится/i, /в рамках/i, /с целью(?![\p{L}\d])/iu,
        /вышеуказанн\w*/i, /необходимо отметить/i, /делает возможным/i, /принимает участие/i, /в целях(?![\p{L}\d])/iu,
      ];
      const match = patterns.map((pattern) => text.match(pattern)).find(Boolean);
      return match ? "«" + match[0] + "»" : null;
    },
  },
  {
    id: "pressure",
    label: "давление на человека",
    fix: "убери давление и дефицит: мотивация — через аргумент и путь (COS-COM-010 §4)",
    test: (text) => {
      const patterns = [
        /должен(?![\p{L}\d])/iu, /должна(?![\p{L}\d])/iu, /должны(?![\p{L}\d])/iu, /обязан(?![\p{L}\d])/iu, /только сейчас/i, /успей\w*/i, /не упусти/i,
        /осталось только/i, /все уже/i, /последний шанс/i, /ты же хочешь/i,
      ];
      const match = patterns.map((pattern) => text.match(pattern)).find(Boolean);
      return match ? "«" + match[0] + "»" : null;
    },
  },
  {
    id: "praise",
    label: "восторг и похвала без факта",
    fix: "хвали только проверяемый результат (COS-COM-010 §2)",
    test: (text) => {
      const patterns = [
        /отличн\w*/i, /молодец/i, /здорово/i, /(?<![\p{L}\d])супер(?![\p{L}\d])/iu, /(?<![\p{L}\d])ура(?![\p{L}\d])/iu, /мы рады/i, /рады сообщить/i,
        /восхит\w*/i, /добро пожаловать/i,
      ];
      const match = patterns.map((pattern) => text.match(pattern)).find(Boolean);
      return match ? "«" + match[0] + "»" : null;
    },
  },
  {
    id: "anglicism",
    label: "англицизм без нужды",
    fix: "найди точное русское слово: фидбек → обратная связь, контент → материалы (anti-slop §8)",
    test: (text) => {
      const match = text.match(/(?<![\p{L}\d])(фидбек\w*|юзер\w*|сетап\w*|челлендж\w*|лайфхак\w*|хайп\w*|контент\w*)(?![\p{L}\d])/iu);
      return match ? "«" + match[0] + "»" : null;
    },
  },
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const rel = relative(ROOT, path);
    if (SKIP.some((pattern) => pattern.test(rel))) continue;
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, out);
    else if (EXTS.has(path.slice(path.lastIndexOf(".")))) out.push(path);
  }
  return out;
}

/** Убираем комментарии: правила проверяют текст для человека, а не пояснения в коде. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => {
      if (line.includes("//") && !line.includes("://")) {
        return line.slice(0, line.indexOf("//"));
      }
      return line;
    })
    .join("\n");
}

/** Строки для проверки: литералы и текст JSX. */
function collectStrings(line) {
  if (/console\./.test(line)) return [];
  const values = [];
  for (const match of line.matchAll(/(["'])((?:\\.|(?!\1)[^\\\n])*?)\1/g)) values.push(match[2]);
  for (const match of line.matchAll(/>([^<>{}|\n]*[А-Яа-яЁё][^<>{}|\n]*)</g)) values.push(match[1]);
  return values
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter((value) => /[А-Яа-яЁё]/.test(value))
    .filter((value) => !ALLOWLIST.some((allowed) => value.includes(allowed)));
}

const violations = [];
const warnings = [];
for (const file of walk(join(ROOT, SRC))) {
  const rel = relative(ROOT, file);
  const authored = AUTHORED.some((pattern) => pattern.test(rel));
  const lines = stripComments(readFileSync(file, "utf8")).split("\n");
  lines.forEach((line, index) => {
    for (const value of collectStrings(line)) {
      for (const rule of RULES) {
        const hit = rule.test(value);
        if (!hit) continue;
        const item = {
          file: rel,
          line: index + 1,
          rule: rule.id,
          label: rule.label,
          hit,
          text: value,
          fix: rule.fix,
        };
        (authored ? warnings : violations).push(item);
      }
    }
  });
}

function print(items, title) {
  if (items.length === 0) return;
  const byFile = new Map();
  for (const item of items) {
    if (!byFile.has(item.file)) byFile.set(item.file, []);
    byFile.get(item.file).push(item);
  }
  console.log(title + " — " + items.length + " в " + byFile.size + " файлах\n");
  for (const [file, list] of byFile) {
    console.log(file);
    for (const item of list) {
      console.log("  " + item.line + ": [" + item.rule + "] " + item.label + " " + item.hit);
      console.log("      «" + item.text.slice(0, 140) + "»");
      console.log("      → " + item.fix);
    }
    console.log("");
  }
}

print(violations, "copy:check — нарушения");
print(
  warnings,
  "copy:check — предупреждения в авторских текстах (правит автор; агенту не переписывать без согласования)",
);

if (violations.length === 0 && warnings.length === 0) {
  console.log("copy:check — нарушений нет.");
  process.exit(0);
}
if (violations.length === 0) {
  console.log("copy:check — ошибок нет, только предупреждения в авторских текстах.");
  process.exit(0);
}
process.exit(1);

