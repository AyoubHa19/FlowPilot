import Link from "next/link";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <p className="font-medium">{title}</p>
      {children && (
        <div className="mt-1 text-sm text-muted-foreground">{children}</div>
      )}
    </div>
  );
}

export function NotFound({ what }: { what: string }) {
  return (
    <EmptyState title={`${what} not found`}>
      It may have been removed, or the link is wrong.{" "}
      <Link href="/buildings" className="underline underline-offset-4">
        Back to buildings
      </Link>
    </EmptyState>
  );
}
