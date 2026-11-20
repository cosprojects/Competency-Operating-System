/** Информационная карточка шага: используется на главной и в разделе «План». */
export function StepCard({ title, text }: { title: string; text: string }) {
  return (
    <article className="step-card">
      <h3 className="step-card-title">{title}</h3>
      <p className="step-card-text">{text}</p>
    </article>
  );
}
