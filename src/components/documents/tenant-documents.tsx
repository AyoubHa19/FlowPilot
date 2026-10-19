"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { statusVariant } from "@/components/documents/document-table";
import { EmptyState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { humanize } from "@/lib/format";

export function TenantDocuments({ tenantId }: { tenantId: Id<"tenants"> }) {
  const documents = useQuery(api.documents.listForTenant, { tenantId });

  if (documents === undefined) return <Skeleton className="h-12" />;
  if (documents.length === 0) {
    return (
      <EmptyState title="No documents">
        Upload their lease on the{" "}
        <Link href="/documents" className="underline underline-offset-4">
          Documents
        </Link>{" "}
        page.
      </EmptyState>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {documents.map((doc) => (
        <li key={doc._id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
          <Badge variant={statusVariant(doc.status)}>{humanize(doc.status)}</Badge>
          <span className="text-muted-foreground">{humanize(doc.kind)}</span>
          <span className="break-all">{doc.filename}</span>
          {doc.status === "ready" && (
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {doc.pageCount} pages · {doc.chunkCount} chunks
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
