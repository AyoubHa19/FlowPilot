"use client";

import { usePaginatedQuery, useQuery } from "convex/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "../../../../../convex/_generated/api";
import { PageHeader } from "@/components/page-header";
import { EmptyState, NotFound, TableSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatEuro } from "@/lib/format";

const PAGE_SIZE = 50;

export default function BuildingDetailPage() {
  const { buildingId } = useParams<{ buildingId: string }>();
  const building = useQuery(api.buildings.get, { buildingId });
  const units = usePaginatedQuery(
    api.buildings.units,
    { buildingId },
    { initialNumItems: PAGE_SIZE },
  );

  if (building === null) {
    return <NotFound what="Building" />;
  }

  return (
    <>
      {building === undefined ? (
        <Skeleton className="h-16 w-72" />
      ) : (
        <PageHeader
          eyebrow={
            <Link href="/buildings" className="hover:text-foreground">
              ← Buildings
            </Link>
          }
          title={building.name}
          description={`${building.address} · ${building.city}`}
        />
      )}

      <h2 className="text-lg font-medium">Units</h2>
      {units.status === "LoadingFirstPage" ? (
        <TableSkeleton rows={8} />
      ) : units.results.length === 0 ? (
        <EmptyState title="No units in this building" />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Floor</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead className="text-right">Rent</TableHead>
                <TableHead>Tenant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.results.map((unit) => (
                <TableRow key={unit._id}>
                  <TableCell className="font-medium">{unit.label}</TableCell>
                  <TableCell className="text-right">{unit.floor}</TableCell>
                  <TableCell className="text-right">{unit.sizeSqm} m²</TableCell>
                  <TableCell className="text-right">
                    {formatEuro(unit.rentCents)}
                  </TableCell>
                  <TableCell>
                    {unit.tenant ? (
                      <Link
                        href={`/tenants/${unit.tenant._id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {unit.tenant.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Vacant</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {units.status !== "Exhausted" && (
            <Button
              variant="outline"
              className="self-center"
              disabled={units.status === "LoadingMore"}
              onClick={() => units.loadMore(PAGE_SIZE)}
            >
              Load more
            </Button>
          )}
        </>
      )}
    </>
  );
}
