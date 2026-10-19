"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { TenantSearch } from "@/components/tenant-search";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Inbox and Approvals join this list in later stages.
const LINKS = [
  { href: "/buildings", label: "Buildings" },
  { href: "/imports", label: "Imports" },
];

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuthActions();

  return (
    <header className="border-b">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <Link href="/buildings" className="font-semibold">
          FlowPilot AI
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-muted-foreground transition-colors hover:text-foreground",
                pathname.startsWith(link.href) && "font-medium text-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <TenantSearch />
          <Button
            variant="outline"
            onClick={() => void signOut().then(() => router.push("/signin"))}
          >
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
