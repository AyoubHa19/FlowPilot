"use client";

import { useConvexAuth } from "convex/react";
import { LoaderIcon, MenuIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { Logo } from "@/components/app-shell/logo";
import { Nav } from "@/components/app-shell/nav";
import { UserMenu } from "@/components/app-shell/user-menu";
import { TenantSearch } from "@/components/tenant-search";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

/** Sidebar layout on desktop, top bar with a slide-out menu on mobile. */
export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isLoading, isAuthenticated } = useConvexAuth();
  const router = useRouter();

  // The proxy only checks for a cookie. If the session behind it expired,
  // go to sign-in instead of running queries that would throw.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/signin");
  }, [isLoading, isAuthenticated, router]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-1 items-center justify-center" aria-busy="true" aria-label="Loading">
        <LoaderIcon className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col gap-6 p-3">
      <Link href="/home" onClick={onNavigate} className="px-1.5 pt-1">
        <Logo />
      </Link>
      <div className="flex-1 overflow-y-auto">
        <Nav onNavigate={onNavigate} />
      </div>
      <UserMenu />
    </div>
  );

  return (
    <div className="flex min-h-svh flex-1">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 border-r bg-sidebar text-sidebar-foreground backdrop-blur-xl lg:block">
        {sidebar()}
      </aside>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 bg-background/90 p-0 text-sidebar-foreground backdrop-blur-xl">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {sidebar(() => setMenuOpen(false))}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/40 px-4 py-2.5 backdrop-blur-xl lg:px-8">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon />
          </Button>
          <Link href="/home" className="lg:hidden">
            <Logo />
          </Link>
          <div className="ml-auto w-full max-w-72">
            <TenantSearch />
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
