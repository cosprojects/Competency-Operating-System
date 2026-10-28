import Link from "next/link";
import { FeedbackForm } from "@/components/FeedbackForm";
import { findCompetency, findSource } from "@/lib/content";
import { isFeedbackType } from "@/lib/validation";

export const metadata = {
  title: "Обратная связь — AXIONA",
};

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ targetType?: string; targetId?: string; type?: string }>;
}) {
  const { targetType: rawTargetType, targetId, type: rawType } = await searchParams;
  let targetType: "COMPETENCY" | "SOURCE" | undefined;
  if (rawTargetType === "COMPETENCY" || rawTargetType === "SOURCE") targetType = rawTargetType;

  const competencyTarget =
    targetType === "COMPETENCY" && targetId ? findCompetency(targetId) : undefined;
  const sourceTarget = targetType === "SOURCE" && targetId ? findSource(targetId) : undefined;
  if (!competencyTarget && !sourceTarget) {
    targetType = undefined;
  }
  const targetLabel = competencyTarget?.competency.title ?? sourceTarget?.title;

  const initialType = rawType && isFeedbackType(rawType) ? rawType : undefined;
  const context = targetType === "SOURCE" ? "source" : targetType === "COMPETENCY" ? "competency" : "general";

  return (
    <>
      <div className="breadcrumbs">
        <Link href="/">Главная</Link>
        <span>/</span>
        <span>Обратная связь</span>
      </div>
      <div className="page-head">
        <div className="eyebrow">Обратная связь</div>
        <h1>Что стоит исправить или добавить</h1>
        <p>
          Мы читаем отзывы и используем их для исправления контента и развития карты. Можно
          отправить анонимно; email нужен только если вы хотите получить ответ.
        </p>
        {targetLabel ? (
          <div className="notice info" style={{ marginTop: 14 }}>
            Отзыв о: <strong>{targetLabel}</strong>
          </div>
        ) : null}
      </div>
      <div className="card" style={{ maxWidth: 760 }}>
        <FeedbackForm
          context={context}
          {...(targetType ? { targetType } : {})}
          {...(targetType && targetId ? { targetId } : {})}
          {...(initialType ? { initialType } : {})}
        />
      </div>
    </>
  );
}
