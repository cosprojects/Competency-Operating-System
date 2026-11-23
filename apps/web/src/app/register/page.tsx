import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { loginLinkTtlText, safeReturnTo } from "@/lib/auth";
import { NOINDEX_FOLLOW } from "@/lib/seo";

export const metadata = {
  ...NOINDEX_FOLLOW,
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
  // Аварийный стоп публичной регистрации (`AUTH_REGISTRATION_DISABLED=1`): не показываем форму,
  // которая молча принимает email и не отправляет письмо. Вход — по приглашению или magic link.
  const registrationDisabled = process.env.AUTH_REGISTRATION_DISABLED === "1";
  return (
    <div className="auth-page">
      <header className="auth-hero">
        <h1>{registrationDisabled ? "AXIONA в закрытой Beta" : "Создай аккаунт в AXIONA"}</h1>
        <p>
          {registrationDisabled
            ? "Сейчас доступ по приглашениям: карта в тестовом режиме. Оставь email — пришлём ссылку на почту."
            : "Сохраняй компетенции и материалы, возвращайся к ним с любого устройства и собирай личный профиль. Без пароля: вход по ссылке из письма."}
        </p>
      </header>
      <div className="auth-card">
        {registrationDisabled ? (
          <LoginForm
            returnTo={safeReturn}
            mode="register"
            intent="invite"
            linkTtlText={loginLinkTtlText()}
          />
        ) : (
          <>
            <LoginForm returnTo={safeReturn} mode="register" linkTtlText={loginLinkTtlText()} />
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
