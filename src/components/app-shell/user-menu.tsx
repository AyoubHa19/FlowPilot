"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { ChevronsUpDownIcon, LogOutIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { api } from "../../../convex/_generated/api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu() {
  const viewer = useQuery(api.users.viewer);
  const { signOut } = useAuthActions();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const email = viewer?.email ?? "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left text-sm transition-colors hover:bg-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <Avatar className="size-8">
          <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
            {(email[0] ?? "?").toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{email || "…"}</span>
          <span className="block text-xs text-muted-foreground">
            {viewer?.role === "demo" ? "Demo account" : "Property manager"}
          </span>
        </span>
        <ChevronsUpDownIcon className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2">
            <span className="truncate">{email}</span>
            {viewer?.role === "demo" && <Badge variant="warning">Demo</Badge>}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground">Theme</DropdownMenuLabel>
          {[
            { value: "light", label: "Light", icon: SunIcon },
            { value: "dark", label: "Dark", icon: MoonIcon },
            { value: "system", label: "System", icon: MonitorIcon },
          ].map((option) => (
            <DropdownMenuItem key={option.value} onClick={() => setTheme(option.value)}>
              <option.icon />
              {option.label}
              {theme === option.value && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut().then(() => router.push("/signin"))}>
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
