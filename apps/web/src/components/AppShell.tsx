"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { NavRail } from "@/components/NavRail";
import { SiteFooter } from "@/components/SiteFooter";

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
  const isPlain = pathname === "/login" || pathname === "/feedback";
  const isSecondary = !isHome && !isSearch && !isCanvas && !isPlain;

  return (
    <>
      <NavRail user={user} />
      <main className="app-main">
        {isPlain ? (
          <div className="page-plain">
            {children}
            <SiteFooter />
          </div>
        ) : isSecondary ? (
          <div className="page-screen">
            <div className="page-surface">{children}</div>
            <SiteFooter />
          </div>
        ) : (
          children
        )}
      </main>
    </>
  );
}
