"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MobileNav } from "@/components/mobile/MobileNav";
import { NavRail } from "@/components/NavRail";
import { SiteFooter } from "@/components/SiteFooter";
import { ButtonHoverLights } from "@/components/ui/ButtonHoverLights";
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
  const isSaved = pathname === "/saved";
  const isPlan = pathname === "/plan" || pathname.startsWith("/plan/");
  const isPlanHome = pathname === "/plan";
  const isWorkspace = pathname.startsWith("/admin");
  const isSecondary = !isHome && !isSearch && !isCanvas && !isPlain && !isWorkspace;

  return (
    <>
      <NavRail user={user} />
      <MobileNav user={user} />
      <main className="app-main">
        <div className={`app-viewport${isPlan ? " app-viewport--plan" : ""}`}>
          {isPlanHome ? (
            <div className="plan-bg-app" aria-hidden="true">
              <img src="/images/bg-plan.png" alt="" width={1671} height={941} />
            </div>
          ) : null}
          {isPlain ? (
            <div className="page-plain">{children}</div>
          ) : isSaved || isPlan ? (
            <div className="studying-page">{children}</div>
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
      <ButtonHoverLights />
    </>
  );
}
