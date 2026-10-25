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
];
