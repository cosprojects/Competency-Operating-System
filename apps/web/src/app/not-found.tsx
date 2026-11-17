import Link from "next/link";
import { NotFoundShell } from "@/components/NotFoundShell";

/**
 * Страница 404 по макету 409-8104: крупный «404», короткое пояснение и
 * возврат на главную. Полностью перекрывает оболочку приложения.
 */
export default function NotFound() {
  return (
    <>
      <NotFoundShell />
      <main className="not-found-screen">
      <p className="not-found-code">404</p>
      <p className="not-found-text">
        Упс! Страница не найдена.
        <br />
        Работаю над этим.
      </p>
      <Link className="button not-found-cta" href="/">
        Назад на главную
      </Link>
      </main>
    </>
  );
}
