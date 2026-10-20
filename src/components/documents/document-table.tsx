"use client";

import { useMutation, usePaginatedQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { LinkIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { EmptyState, TableSkeleton } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useViewer } from "@/lib/use-viewer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { humanize } from "@/lib/format";

const PAGE_SIZE = 50;

export function statusVariant(status: Doc<"documents">["status"]) {
  if (status === "failed") return "destructive" as const;
  if (status === "ready") return "outline" as const;
  return "secondary" as const;
}

export function DocumentTable() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.documents.list,
    {},
    { initialNumItems: PAGE_SIZE },
  );

  if (status === "LoadingFirstPage") return <TableSkeleton rows={6} />;
  if (results.length === 0) {
    return (
      <EmptyState title="No documents yet">
        Upload lease PDFs above. Generate samples with{" "}
        <code>npm run generate:lease-pdfs</code>.
      </EmptyState>
    );
  }

  const counts = Object.groupBy(results, (d) => d.status);
  return (
    <>
      <p className="text-sm text-muted-foreground">
        {Object.entries(counts)
          .map(([s, docs]) => `${docs?.length ?? 0} ${s}`)
          .join(" · ")}
        {status !== "Exhausted" && " (loaded so far)"}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File</TableHead>
            <TableHead>Tenant</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Pages</TableHead>
            <TableHead className="text-right">Chunks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((doc) => (
            <TableRow key={doc._id}>
              <TableCell className="max-w-72 truncate font-medium" title={doc.filename}>
                {doc.filename}
              </TableCell>
              <TableCell>
                {doc.tenant ? (
                  <Link
                    href={`/tenants/${doc.tenant._id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {doc.tenant.name}
                  </Link>
                ) : (
                  <LinkTenantForm documentId={doc._id} />
                )}
              </TableCell>
              <TableCell>
                <Badge variant={statusVariant(doc.status)}>{humanize(doc.status)}</Badge>
                {doc.error && (
                  <p className="mt-1 max-w-72 text-xs whitespace-normal text-destructive">
                    {doc.error}
                  </p>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{doc.pageCount ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums">
                {doc.status === "ready" ? doc.chunkCount : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {status !== "Exhausted" && (
        <Button
          variant="outline"
          className="self-center"
          disabled={status === "LoadingMore"}
          onClick={() => loadMore(PAGE_SIZE)}
        >
          Load more
        </Button>
      )}
    </>
  );
}

function LinkTenantForm({ documentId }: { documentId: Id<"documents"> }) {
  const linkTenant = useMutation(api.documents.linkTenant);
  const [pending, setPending] = useState(false);
  const { isDemo } = useViewer();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get("email")?.toString() ?? "";
    if (email.trim() === "") return;
    setPending(true);
    try {
      const name = await linkTenant({ documentId, tenantEmail: email });
      toast.success(`Linked to ${name}`);
    } catch (error) {
      toast.error(error instanceof ConvexError ? String(error.data) : "Could not link");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-1">
      <Input
        name="email"
        type="email"
        placeholder="Tenant email"
        aria-label="Tenant email to link"
        className="h-7 w-44 text-xs"
        disabled={pending || isDemo}
      />
      <Button type="submit" size="icon-sm" variant="ghost" disabled={pending || isDemo} aria-label="Link tenant">
        <LinkIcon />
      </Button>
    </form>
  );
}
