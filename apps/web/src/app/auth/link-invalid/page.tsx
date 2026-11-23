import Link from "next/link";
import { NOINDEX_NOFOLLOW } from "@/lib/seo";

export const metadata = {
  ...NOINDEX_NOFOLLOW,
  title: "Ссылка больше не действует — AXIONA",
};

export default function LinkInvalidPage() {
  return (
    <div className="auth-card">
      <h1>Ссылка больше не действует</h1>
      <p className="auth-desc">
        Она одноразовая или срок истёк. Запроси новую — это займёт минуту.
      </p>
      <Link className="button block" href="/login">
        Запросить ссылку
      </Link>
    </div>
  );
}
