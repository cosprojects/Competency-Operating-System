import { redirect } from "next/navigation";
import { getProfession } from "@/lib/content";

export default async function CanvasSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profession = getProfession(slug);
  redirect(profession ? `/professions/${profession.slug}` : "/professions");
}
