import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { safeReturnTo } from "@/lib/auth";

export const metadata = {
  title: "Создать аккаунт — AXIONA",
  description:
    "Аккаунт AXIONA создаётся по ссылке из письма: без пароля. Сохраняй компетенции и возвращайся к материалам.",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  const safeReturn = safeReturnTo(returnTo);
  // Публичная регистрация закрыта (AUTH_REGISTRATION_DISABLED=1): не показываем форму,
  // которая молча принимает email и не отправляет письмо. Вход — по приглашению или magic link.
  const registrationDisabled = process.env.AUTH_REGISTRATION_DISABLED === "1";
  return (
    <div className="auth-page">
      <header className="auth-hero">
        <h1>{registrationDisabled ? "AXIONA в закрытой Beta" : "Создай аккаунт в AXIONA"}</h1>
        <p>
          {registrationDisabled
            ? "Сейчас доступ по приглашениям: мы тестируем карту компетенций с ограниченной группой дизайнеров. Если у тебя есть приглашение — открой ссылку из письма."
            : "Сохраняй компетенции и материалы, возвращайся к ним с любого устройства и собирай личный профиль. Без пароля: вход по ссылке из письма."}
        </p>
      </header>
      <div className="auth-card">
        {registrationDisabled ? (
          <>
            <div className="notice">Публичная регистрация пока закрыта. Аккаунт создаётся по приглашению.</div>
            <p className="muted" style={{ marginTop: 12 }}>
              Уже есть приглашение или аккаунт? Войди по ссылке из письма.
            </p>
            <p style={{ marginTop: 16 }}>
              <Link className="button block" href={`/login?returnTo=${encodeURIComponent(safeReturn)}`}>
                Войти
              </Link>
            </p>
          </>
        ) : (
          <>
            <LoginForm returnTo={safeReturn} mode="register" />
            <p className="small muted" style={{ marginTop: 16 }}>
              Уже есть аккаунт?{" "}
              <Link href={`/login?returnTo=${encodeURIComponent(safeReturn)}`}>Войти</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
