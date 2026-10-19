"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "../../convex/_generated/api";
import { TenantSearch } from "@/components/tenant-search";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/inbox", label: "Inbox" },
  { href: "/approvals", label: "Approvals" },
  { href: "/buildings", label: "Buildings" },
  { href: "/documents", label: "Documents" },
  { href: "/imports", label: "Imports" },
];

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuthActions();
  // Live: updates as soon as the agent proposes or someone decides.
  const pendingApprovals = useQuery(api.approvals.pendingCount);

  return (
    <header className="border-b">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <Link href="/inbox" className="font-semibold">
          FlowPilot AI
        </Link>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground",
                pathname.startsWith(link.href) && "font-medium text-foreground",
              )}
            >
              {link.label}
              {link.href === "/approvals" && pendingApprovals !== undefined && pendingApprovals > 0 && (
                <span
                  className="rounded-full bg-primary px-1.5 text-xs leading-5 font-medium text-primary-foreground tabular-nums"
                  aria-label={`${pendingApprovals} pending`}
                >
                  {pendingApprovals > 99 ? "99+" : pendingApprovals}
                </span>
              )}
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
