"use client";

import { useQuery } from "convex/react";
import {
  ActivityIcon,
  Building2Icon,
  FileTextIcon,
  InboxIcon,
  LayoutDashboardIcon,
  ShieldCheckIcon,
  UploadIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: LucideIcon; count?: "approvals" };

const GROUPS: { label: string; items: Item[] }[] = [
  {
    label: "Work",
    items: [
      { href: "/home", label: "Overview", icon: LayoutDashboardIcon },
      { href: "/inbox", label: "Inbox", icon: InboxIcon },
      { href: "/approvals", label: "Approvals", icon: ShieldCheckIcon, count: "approvals" },
      { href: "/runs", label: "Agent runs", icon: ActivityIcon },
    ],
  },
  {
    label: "Properties",
    items: [
      { href: "/buildings", label: "Buildings", icon: Building2Icon },
      { href: "/documents", label: "Documents", icon: FileTextIcon },
      { href: "/imports", label: "Imports", icon: UploadIcon },
    ],
  },
];

/** Sidebar navigation, shared by the desktop sidebar and the mobile sheet. */
export function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  // Live: changes as soon as the agent proposes or someone decides.
  const pendingApprovals = useQuery(api.approvals.pendingCount);

  return (
    <nav className="flex flex-col gap-5">
      {GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <p className="px-2.5 pb-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            {group.label}
          </p>
          {group.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const count = item.count === "approvals" ? pendingApprovals : undefined;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <item.icon
                  className={cn("size-4", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")}
                />
                <span className="flex-1">{item.label}</span>
                {count !== undefined && count > 0 && (
                  <span
                    className="rounded-full bg-primary px-1.5 text-[11px] leading-5 font-semibold text-primary-foreground tabular-nums"
                    aria-label={`${count} pending`}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
