"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const credentialsSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type Flow = "signIn" | "signUp";

export default function SignInPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [flow, setFlow] = useState<Flow>("signIn");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = credentialsSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setPending(true);
    try {
      await signIn("password", { ...parsed.data, flow });
      router.push("/");
    } catch {
      toast.error(
        flow === "signIn"
          ? "Wrong email or password"
          : "Could not create the account",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>FlowPilot AI</CardTitle>
          <CardDescription>
            {flow === "signIn"
              ? "Sign in to the property manager dashboard"
              : "Create the property manager account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={flow === "signIn" ? "current-password" : "new-password"}
                required
              />
            </div>
            <Button type="submit" disabled={pending}>
              {flow === "signIn" ? "Sign in" : "Sign up"}
            </Button>
            <Button
              type="button"
              variant="link"
              onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
            >
              {flow === "signIn"
                ? "No account yet? Sign up"
                : "Already have an account? Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
