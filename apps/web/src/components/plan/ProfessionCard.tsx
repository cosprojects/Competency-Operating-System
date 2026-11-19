import Link from "next/link";
import type { ComponentType } from "react";
import { IconGamepad, IconHome } from "@/components/icons";
import {
  IconLinearArrowRight,
  IconLinearBolt,
  IconLinearBox,
  IconLinearCrown,
  IconLinearGraph,
  IconLinearLayers,
  IconLinearMagic,
  IconLinearPalette,
  IconLinearRulerCrossPen,
  IconLinearPhone,
  IconLinearPresentation,
  IconLinearStructure,
  IconLinearWeb,
} from "@/components/icons-library";
import { matrixFamilyLabel, type MatrixProfession } from "@/lib/matrix";

type IconComponent = ComponentType<{ className?: string }>;

const PROFESSION_ICONS: Record<string, IconComponent> = {
  uxui: IconLinearRulerCrossPen,
  product: IconLinearLayers,
  aidesigner: IconLinearMagic,
  webdesigner: IconLinearWeb,
  appdesign: IconLinearPhone,
  motion: IconLinearBolt,
  "3ddesigner": IconLinearBox,
  graphic: IconLinearPalette,
  artdir: IconLinearCrown,
  interior: IconHome,
  presentation: IconLinearPresentation,
  uxresearch: IconLinearGraph,
  game: IconGamepad,
};

export function ProfessionCard({
  profession,
  href,
}: {
  profession: MatrixProfession;
  href: string;
}) {
  const Icon = PROFESSION_ICONS[profession.slug] ?? IconLinearLayers;
  return (
    <Link className="plan-matrix-card" href={href}>
      <span className="plan-matrix-card-badge">{matrixFamilyLabel(profession.family)}</span>
      <span className="plan-matrix-card-head">
        <Icon className="plan-matrix-card-icon" />
        <strong>{profession.title}</strong>
      </span>
      <p>{profession.description ?? "Структура компетенций, знания, навыки и учебные материалы."}</p>
      <span className="plan-matrix-card-link">
        <span>Выбрать профессию</span>
        <IconLinearArrowRight />
      </span>
    </Link>
  );
}
