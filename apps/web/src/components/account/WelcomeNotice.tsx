"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Приветствие после создания аккаунта. Показывается один раз: `?welcome=1`
 * убирается из адреса без перезагрузки, чтобы возврат на `/saved` был чистым.
 */
export function WelcomeNotice() {
  useEffect(() => {
    window.history.replaceState(null, "", "/saved");
  }, []);

  return (
    <div className="notice success" role="status">
      <strong>Аккаунт создан.</strong> Здесь появятся сохранённые профессии и компетенции.{" "}
      <Link href="/professions">Выбери профессию</Link> или{" "}
      <Link href="/">вернись на главную</Link>.
    </div>
  );
}
