/**
 * Сферы деятельности (направления) и их цветовая кодировка.
 *
 * Сфера — это надпрофессиональная группа: «Дизайн», «Исследования» и т.д.
 * Каждая сфера получает один базовый цвет: он используется для текста бейджа,
 * а фон бейджа — тот же цвет с прозрачностью 80% (альфа 20%).
 *
 * Алгоритм присвоения:
 *  1. Профессия ищется в явном реестре сфер по slug (SPHERES[].slugs).
 *  2. Если slug не описан — профессия попадает в сферу «Другое», а цвет
 *     выбирается детерминированно из палитры (по хешу slug), чтобы новые
 *     профессии не прыгали по цветам между сборками.
 *  3. Чтобы добавить новую сферу, достаточно дописать её в SPHERES: название,
 *     базовый цвет и список slug'ов профессий.
 */

export interface SphereDefinition {
  id: string;
  title: string;
  /** Базовый цвет сферы: цвет текста бейджа; фон — этот же цвет с alpha 20%. */
  color: string;
  slugs: string[];
}

/** Палитра для сфер, которые появятся позже. */
export const SPHERE_PALETTE = [
  "#4f46e5", // индиго
  "#0ea5e9", // небо
  "#059669", // изумруд
  "#d97706", // янтарь
  "#dc2626", // алый
  "#7c3aed", // фиолетовый
  "#0891b2", // бирюза
  "#65a30d", // олива
] as const;

export const SPHERES: SphereDefinition[] = [
  {
    id: "design",
    title: "Дизайн",
    color: "#4f46e5",
    slugs: [
      "uxui",
      "product",
      "graphic",
      "motion",
      "3ddesigner",
      "interior",
      "webdesigner",
      "presentation",
      "appdesign",
      "artdir",
      "aidesigner",
      "game",
    ],
  },
  {
    id: "research",
    title: "Исследования",
    color: "#0ea5e9",
    slugs: ["uxresearch"],
  },
];

export const FALLBACK_SPHERE: SphereDefinition = {
  id: "other",
  title: "Другое",
  color: "#64748b",
  slugs: [],
};

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

/** Стабильный цвет из палитры для сферы/профессии без явного цвета. */
export function paletteColorFor(key: string): string {
  return SPHERE_PALETTE[hashString(key) % SPHERE_PALETTE.length]!;
}

/** Сфера для профессии по её slug. */
export function sphereForSlug(slug: string): SphereDefinition {
  const known = SPHERES.find((sphere) => sphere.slugs.includes(slug));
  if (known) return known;
  return {
    ...FALLBACK_SPHERE,
    color: paletteColorFor(slug),
  };
}

/** Сфера по названию (для страниц, где есть только подпись группы). */
export function sphereByTitle(title: string): SphereDefinition | null {
  return SPHERES.find((sphere) => sphere.title === title) ?? null;
}

/**
 * Цвет бейджа: текст — базовый цвет сферы, фон — он же с прозрачностью 80%
 * (альфа 20%): фон почти не спорит с текстом.
 * Работает с hex вида #rrggbb; иначе возвращает исходный цвет.
 */
export function sphereBadgeStyle(color: string): { color: string; backgroundColor: string } {
  const match = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return { color, backgroundColor: color };
  const value = match[1]!;
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return { color, backgroundColor: `rgba(${r}, ${g}, ${b}, 0.2)` };
}
