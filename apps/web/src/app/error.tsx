"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("app error", error.message);
  }, [error]);

  return (
    <div className="empty" style={{ marginTop: 40 }}>
      <h2>Что-то пошло не так</h2>
      <p>Попробуйте обновить страницу. Если ошибка повторяется — напишите в support@axiona.world.</p>
      <div className="actions" style={{ justifyContent: "center" }}>
        <button className="button" type="button" onClick={reset}>
          Повторить
        </button>
        <Link className="button secondary" href="/">
          На главную
        </Link>
      </div>
    </div>
  );
}
