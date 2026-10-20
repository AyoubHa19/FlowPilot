"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { ConvexError } from "convex/values";
import { BotIcon, FileSearchIcon, ShieldCheckIcon, SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Logo, LogoMark } from "@/components/app-shell/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const credentialsSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type Flow = "signIn" | "signUp";

// Public demo account, shown on the sign-in page of the deployed demo. It is a
// "demo" role: it can only act on simulated email (enforced server side).
const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL;
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD;

const FEATURES = [
  {
    icon: BotIcon,
    title: "Reads every tenant email",
    text: "Classifies it, finds the tenant, the lease and open tickets, and drafts a reply in the tenant's language.",
  },
  {
    icon: FileSearchIcon,
    title: "Answers from the lease",
    text: "Searches the tenant's own lease PDF, never anyone else's.",
  },
  {
    icon: ShieldCheckIcon,
    title: "You stay in control",
    text: "Nothing is sent or created until you approve, edit or reject it.",
  },
];

export default function SignInPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [flow, setFlow] = useState<Flow>("signIn");
  const [pending, setPending] = useState(false);

  async function submit(email: string, password: string, mode: Flow) {
    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setPending(true);
    try {
      await signIn("password", { ...parsed.data, flow: mode });
      router.push("/home");
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? String(error.data)
          : mode === "signIn"
            ? "Wrong email or password"
            : "Could not create the account",
      );
    } finally {
      setPending(false);
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void submit(String(form.get("email") ?? ""), String(form.get("password") ?? ""), flow);
  }

  return (
    <main className="grid flex-1 lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-[oklch(0.33_0.13_274)] via-[oklch(0.4_0.17_280)] to-[oklch(0.45_0.16_300)] p-10 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-[oklch(0.7_0.15_200)]/20 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <LogoMark className="bg-white/15 from-white/20 to-white/5" />
          <span className="font-semibold tracking-tight">FlowPilot AI</span>
        </div>
        <div className="relative mt-auto flex max-w-md flex-col gap-8">
          <div>
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
              <SparklesIcon className="size-3.5" /> Email agent for property managers
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Tenant email, researched and drafted. You make the call.
            </h1>
          </div>
          <ul className="flex flex-col gap-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <f.icon className="size-4.5" />
                </span>
                <span>
                  <span className="block font-medium">{f.title}</span>
                  <span className="block text-sm text-white/75">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              {flow === "signIn" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {flow === "signIn" ? "Sign in to the property manager dashboard." : "Sign-up is limited to invited emails."}
            </p>
          </div>

          {DEMO_EMAIL && DEMO_PASSWORD && flow === "signIn" && (
            <div className="flex flex-col gap-2 rounded-xl border bg-secondary/60 p-4 text-sm">
              <p className="font-medium">Just looking around?</p>
              <p className="text-muted-foreground">
                The demo account sees everything and can try the agent on simulated email.
              </p>
              <Button variant="outline" disabled={pending} onClick={() => void submit(DEMO_EMAIL, DEMO_PASSWORD, "signIn")}>
                Try the demo
              </Button>
            </div>
          )}

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
            <Button type="submit" disabled={pending} size="lg">
              {pending ? "One moment…" : flow === "signIn" ? "Sign in" : "Create account"}
            </Button>
            <Button type="button" variant="link" onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}>
              {flow === "signIn" ? "Invited? Create your account" : "Already have an account? Sign in"}
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
