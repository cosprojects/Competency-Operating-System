import { ProfessionCard } from "@/components/ProfessionCard";
import { getProfessions } from "@/lib/content";

export const metadata = {
  title: "Профессии — AXIONA",
  description: "Четыре профессии дизайнера: структура компетенций, знания и навыки.",
};

export default function ProfessionsPage() {
  const professions = getProfessions();
  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Профессии</div>
        <h1>Выберите направление</h1>
        <p>
          Каждая профессия — это разделы, компетенции и материалы. Покрытие показывает, сколько
          компетенций уже прошло проверку и опубликовано.
        </p>
      </div>
      <div className="card-grid">
        {professions.map((profession) => (
          <ProfessionCard key={profession.id} profession={profession} />
        ))}
      </div>
    </>
  );
}
