"use client";

import { useAction, useConvex } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { SearchIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { api } from "../../../convex/_generated/api";
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

const searchSchema = z.object({
  email: z.email("Enter the tenant's email"),
  question: z.string().trim().min(1, "Enter a question").max(500, "Keep it under 500 characters"),
});

type Hit = FunctionReturnType<typeof api.documents.search>[number];

/** Test bench for the agent's lease search: same function, same tenant filter. */
export function DocumentSearch() {
  const convex = useConvex();
  const search = useAction(api.documents.search);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ tenant: string; hits: Hit[] } | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = searchSchema.safeParse({
      email: form.get("email")?.toString().trim(),
      question: form.get("question"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const tenant = await convex.query(api.tenants.findByEmail, { email: parsed.data.email });
      if (tenant === null) {
        setResult(null);
        setError(`No tenant with email ${parsed.data.email}`);
        return;
      }
      const hits = await search({ tenantId: tenant._id, query: parsed.data.question });
      setResult({ tenant: tenant.name, hits });
    } catch (err) {
      setError(err instanceof ConvexError ? String(err.data) : "Search failed, try again");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Search a tenant&apos;s documents</CardTitle>
        <CardDescription>
          Vector search over one tenant&apos;s chunks only, exactly as the agent will use it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
          <div className="flex flex-col gap-2">
            <Label htmlFor="search-email">Tenant email</Label>
            <Input id="search-email" name="email" type="email" placeholder="felix.braun@example.com" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="search-question">Question</Label>
            <Input id="search-question" name="question" defaultValue="notice period" />
          </div>
          <Button type="submit" disabled={pending}>
            <SearchIcon />
            {pending ? "Searching…" : "Search"}
          </Button>
        </form>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {result && result.hits.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No processed documents for {result.tenant} yet.
          </p>
        )}
        {result && result.hits.length > 0 && (
          <ol className="flex flex-col gap-3">
            {result.hits.map((hit, i) => (
              <li key={hit.chunkId} className="rounded-lg border p-3 text-sm">
                <div className="mb-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">#{i + 1}</span>
                  <span className="break-all">{hit.filename}</span>
                  <span>chunk {hit.chunkIndex}</span>
                  <span className="tabular-nums">score {hit.score.toFixed(3)}</span>
                </div>
                <p className="whitespace-pre-line">{hit.text}</p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
