"use client";

import { useConvex } from "convex/react";
import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { api } from "../../convex/_generated/api";
import { Input } from "@/components/ui/input";

const emailSchema = z.email();

/** Jumps to a tenant by email: one lookup on the by_email index. */
export function TenantSearch() {
  const convex = useConvex();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const parsed = emailSchema.safeParse(
      new FormData(form).get("email")?.toString().trim(),
    );
    if (!parsed.success) {
      toast.error("Enter a valid email");
      return;
    }

    setPending(true);
    try {
      const tenant = await convex.query(api.tenants.findByEmail, {
        email: parsed.data,
      });
      if (tenant === null) {
        toast.error(`No tenant with email ${parsed.data}`);
        return;
      }
      form.reset();
      router.push(`/tenants/${tenant._id}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="relative w-full max-w-64">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        name="email"
        type="email"
        placeholder="Find tenant by email"
        aria-label="Find tenant by email"
        className="pl-8"
        disabled={pending}
      />
    </form>
  );
}
