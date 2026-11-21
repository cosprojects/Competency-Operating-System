import { redirect } from "next/navigation";

/** Небольшая редирект-страница вместо отдельной формы обратной связи. */
export const dynamic = "force-dynamic";

/**
 * Отдельной страницы обратной связи нет: форма живёт в модальном окне.
 * Старые ссылки и закладки ведут на главную, где диалог открывается сразу.
 */
export default function FeedbackPage() {
  redirect("/?feedback=1");
}
