"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Footer } from "@/components/Footer";
import { NavRail } from "@/components/NavRail";

export function AppShell({
  user,
  children,
}: {
  user: { email: string } | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isSearch = pathname === "/professions";
  const isCanvas = /^\/professions\/[^/]+$/.test(pathname);
  const isSecondary = !isHome && !isSearch && !isCanvas;

  return (
    <>
      <NavRail user={user} />
      <main className="app-main">
        {isSecondary ? (
          <div className="page-screen">
            <div className="page-surface">{children}</div>
            <Footer />
          </div>
        ) : (
          children
        )}
      </main>
    </>
  );
}
