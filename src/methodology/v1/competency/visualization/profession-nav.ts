export interface ProfessionTab {
  id: string;
  label: string;
  href: string;
}

export const PROFESSION_TABS: ProfessionTab[] = [
  { id: "uxui", label: "UX/UI", href: "uxui-competency-canvas.html" },
  { id: "product", label: "Product", href: "it-product-competency-canvas.html" },
  { id: "motion", label: "Motion", href: "it-motion-competency-canvas.html" },
  { id: "graphic", label: "Graphic", href: "it-graphic-competency-canvas.html" },
  { id: "presentation", label: "Презентации", href: "it-presentation-competency-canvas.html" },
  { id: "appdesign", label: "Приложения", href: "it-appdesign-competency-canvas.html" },
  { id: "uxresearch", label: "UX-исследования", href: "it-uxresearch-competency-canvas.html" },
  { id: "artdir", label: "Арт-дирекшн", href: "it-artdir-competency-canvas.html" },
  { id: "3ddesigner", label: "3D", href: "it-3ddesigner-competency-canvas.html" },
  { id: "interior", label: "Интерьеры", href: "it-interior-competency-canvas.html" },
  { id: "webdesigner", label: "Веб-дизайн", href: "it-webdesigner-competency-canvas.html" },
  { id: "aidesigner", label: "AI-дизайнер", href: "it-aidesigner-competency-canvas.html" },
];
