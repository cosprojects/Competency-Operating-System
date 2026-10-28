import Link from "next/link";

export const metadata = {
  title: "Проверьте почту — AXIONA",
};

export default function CheckEmailPage() {
  return (
    <div className="auth-card">
      <h1>Проверьте почту</h1>
      <p className="muted">
        Мы отправили ссылку для входа. Она действует 15 минут и работает один раз.
      </p>
      <div className="notice info">
        Если письмо не пришло, проверьте папку «Спам» или{" "}
        <Link href="/login">запросите новое</Link>.
      </div>
    </div>
  );
}
