"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { ImportJobCard } from "@/components/imports/import-job-card";
import { ImportUpload } from "@/components/imports/import-upload";
import { PageHeader } from "@/components/page-header";
import { EmptyState, TableSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 10;

export default function ImportsPage() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.imports.list,
    {},
    { initialNumItems: PAGE_SIZE },
  );

  return (
    <>
      <PageHeader
        title="Imports"
        description="Bulk-load buildings, units, tenants and leases from CSV, processed in the background."
      />
      <ImportUpload />

      <h2 className="text-lg font-medium">Import jobs</h2>
      {status === "LoadingFirstPage" ? (
        <TableSkeleton rows={3} />
      ) : results.length === 0 ? (
        <EmptyState title="No imports yet">
          Upload a CSV above. Progress shows here live.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {results.map((job) => (
            <ImportJobCard key={job._id} job={job} />
          ))}
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
        </div>
      )}
    </>
  );
}
