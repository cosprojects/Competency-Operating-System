export interface CanvasLink {
  slug: string;
  title: string;
  file: string;
  beta: boolean;
  description: string;
}

export const CANVAS_LINKS: CanvasLink[] = [
  {
    slug: "uxui",
    title: "UX/UI-дизайнер",
    file: "uxui-competency-canvas.html",
    beta: true,
    description: "Исследования, архитектура, прототипы, UI и инструменты.",
  },
  {
    slug: "product",
    title: "Продуктовый дизайнер",
    file: "it-product-competency-canvas.html",
    beta: true,
    description: "Discovery, JTBD, CJM, метрики, рост и эксперименты.",
  },
  {
    slug: "motion",
    title: "Моушн-дизайнер",
    file: "it-motion-competency-canvas.html",
    beta: true,
    description: "Принципы анимации, 3D, звук, композитинг и продакшн.",
  },
  {
    slug: "graphic",
    title: "Графический дизайнер",
    file: "it-graphic-competency-canvas.html",
    beta: true,
    description: "Типографика, бренд, печать и редакционный дизайн.",
  },
  {
    slug: "presentation",
    title: "Дизайнер презентаций",
    file: "it-presentation-competency-canvas.html",
    beta: false,
    description: "Схема компетенций по презентациям и визуальной коммуникации.",
  },
  {
    slug: "appdesign",
    title: "Дизайнер приложений",
    file: "it-appdesign-competency-canvas.html",
    beta: false,
    description: "Схема компетенций по мобильным и продуктовым приложениям.",
  },
  {
    slug: "uxresearch",
    title: "UX-исследователь",
    file: "it-uxresearch-competency-canvas.html",
    beta: false,
    description: "Схема компетенций по исследованиям, интервью и анализу.",
  },
  {
    slug: "artdir",
    title: "Арт-директор",
    file: "it-artdir-competency-canvas.html",
    beta: false,
    description: "Схема компетенций по арт-дирекшену и визуальной системе.",
  },
  {
    slug: "3ddesigner",
    title: "3D-дизайнер",
    file: "it-3ddesigner-competency-canvas.html",
    beta: false,
    description: "Схема компетенций по 3D-моделированию, свету и рендеру.",
  },
  {
    slug: "interior",
    title: "Дизайнер интерьеров",
    file: "it-interior-competency-canvas.html",
    beta: false,
    description: "Схема компетенций по интерьерам и пространственному дизайну.",
  },
  {
    slug: "webdesigner",
    title: "Веб-дизайнер",
    file: "it-webdesigner-competency-canvas.html",
    beta: false,
    description: "Схема компетенций по веб-дизайну, вёрстке и интерактиву.",
  },
  {
    slug: "aidesigner",
    title: "AI-дизайнер",
    file: "it-aidesigner-competency-canvas.html",
    beta: false,
    description: "Схема компетенций по AI-инструментам и дизайн-процессам.",
  },
];

export function canvasForProfession(slug: string): CanvasLink | undefined {
  return CANVAS_LINKS.find((item) => item.slug === slug);
}

export function canvasHref(file: string): string {
  return `/canvas/${file}`;
}

export function canvasPageHref(slug: string): string {
  return `/canvas/${slug}`;
}
