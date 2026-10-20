"use client";

import { usePaginatedQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../../convex/_generated/api";
import { PageHeader } from "@/components/page-header";
import { EmptyState, TableSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 25;

export default function BuildingsPage() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.buildings.list,
    {},
    { initialNumItems: PAGE_SIZE },
  );

  return (
    <>
      <PageHeader title="Buildings" description="Every building under management, with its units and tenants." />
      {status === "LoadingFirstPage" ? (
        <TableSkeleton />
      ) : results.length === 0 ? (
        <EmptyState title="No buildings yet">
          Seed demo data with <code>npx convex run seed:run</code>.
        </EmptyState>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="hidden sm:table-cell">City</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((building) => (
                <TableRow key={building._id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/buildings/${building._id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {building.name}
                    </Link>
                  </TableCell>
                  <TableCell>{building.address}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {building.city}
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
      )}
    </>
  );
}
