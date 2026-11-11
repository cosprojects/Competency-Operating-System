"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconCloseCircle } from "@/components/icons";

/**
 * Приветственный алерт после первого входа по ссылке: одна короткая фраза о
 * смысле продукта и кнопка «Выбрать направление».
 */
export function WelcomeToast() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Убираем ?welcome=1 из адреса, чтобы обновление страницы не показывало алерт снова.
    const url = new URL(window.location.href);
    if (url.searchParams.has("welcome")) {
      url.searchParams.delete("welcome");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="welcome-toast" role="status">
      <div>
        <p>
          <strong>Добро пожаловать в AXIONA!</strong> Мы стремимся сделать развитие людей
          дешевле, структурированнее и интереснее.
        </p>
        <div className="welcome-actions">
          <Link className="button small" href="/professions">
            Выбрать направление
          </Link>
        </div>
      </div>
      <button
        className="icon-button"
        type="button"
        aria-label="Закрыть приветствие"
        onClick={() => setVisible(false)}
      >
        <IconCloseCircle />
      </button>
    </div>
  );
}
