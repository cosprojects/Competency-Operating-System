"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { NavRail } from "@/components/NavRail";
import { SiteFooter } from "@/components/SiteFooter";
import { ToastHost } from "@/components/ui/Toast";

export interface ShellUser {
  email: string;
  createdAt: string;
  isAdmin: boolean;
}

export function AppShell({
  user,
  children,
}: {
  user: ShellUser | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isSearch = pathname === "/professions";
  const isCanvas = /^\/professions\/[^/]+$/.test(pathname);
  const isPlain =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/feedback" ||
    pathname.startsWith("/auth/");
  const isWorkspace = pathname === "/saved" || pathname.startsWith("/admin");
  const isSecondary = !isHome && !isSearch && !isCanvas && !isPlain && !isWorkspace;

  return (
    <>
      <NavRail user={user} />
      <main className="app-main">
        <div className="app-viewport">
          {isPlain ? (
            <div className="page-plain">{children}</div>
          ) : isWorkspace ? (
            <div className="workspace-page">
              <div className="workspace-glass">{children}</div>
            </div>
          ) : isSecondary ? (
            <div className="page-screen">
              <div className="page-surface">{children}</div>
            </div>
          ) : (
            children
          )}
        </div>
        {isHome ? null : <SiteFooter />}
      </main>
      <ToastHost />
    </>
  );
}
