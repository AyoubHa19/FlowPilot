"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DashboardHome() {
  const viewer = useQuery(api.users.viewer);
  const { signOut } = useAuthActions();
  const router = useRouter();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">FlowPilot AI</h1>
        <Button
          variant="outline"
          onClick={() => void signOut().then(() => router.push("/signin"))}
        >
          Sign out
        </Button>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>
            {viewer === undefined
              ? "Loading…"
              : `Signed in as ${viewer?.email ?? "unknown user"}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Stage 0 is set up. Inbox, approvals, properties and import jobs arrive
          in the next stages.
        </CardContent>
      </Card>
    </main>
  );
}
