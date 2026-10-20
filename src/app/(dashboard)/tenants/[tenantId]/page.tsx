"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { api } from "../../../../../convex/_generated/api";
import type { Doc } from "../../../../../convex/_generated/dataModel";
import { TenantDocuments } from "@/components/documents/tenant-documents";
import { InitialsAvatar } from "@/components/initials-avatar";
import { PageHeader } from "@/components/page-header";
import { EmptyState, NotFound } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatEuro, humanize } from "@/lib/format";

export default function TenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const detail = useQuery(api.tenants.get, { tenantId });

  if (detail === null) {
    return <NotFound what="Tenant" />;
  }
  if (detail === undefined) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-32" />
      </div>
    );
  }

  const { tenant, unit, building, activeLease, tickets } = detail;

  return (
    <>
      <PageHeader
        eyebrow={
          building && (
            <Link href={`/buildings/${building._id}`} className="hover:text-foreground">
              ← {building.name}
            </Link>
          )
        }
        title={
          <span className="flex items-center gap-3">
            <InitialsAvatar name={tenant.name} className="size-10 text-sm" />
            {tenant.name}
          </span>
        }
        description={unit ? `Unit ${unit.label} · ${tenant.email}` : tenant.email}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact and unit</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <Field label="Email">{tenant.email}</Field>
              <Field label="Phone">{tenant.phone ?? "—"}</Field>
              <Field label="Unit">
                {unit ? `${unit.label} · floor ${unit.floor} · ${unit.sizeSqm} m²` : "—"}
              </Field>
              <Field label="Building">
                {building ? `${building.name}, ${building.address}` : "—"}
              </Field>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active lease</CardTitle>
            {!activeLease && <CardDescription>No active lease.</CardDescription>}
          </CardHeader>
          {activeLease && (
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <Field label="Rent">{formatEuro(activeLease.rentCents)} / month</Field>
                <Field label="Start">{formatDate(activeLease.startDate)}</Field>
                <Field label="End">
                  {activeLease.endDate ? formatDate(activeLease.endDate) : "Open-ended"}
                </Field>
                <Field label="Notice period">{activeLease.noticePeriodDays} days</Field>
              </dl>
            </CardContent>
          )}
        </Card>
      </div>

      <h2 className="text-lg font-medium">Tickets for this unit</h2>
      {tickets.length === 0 ? (
        <EmptyState title="No tickets" />
      ) : (
        <ul className="flex flex-col gap-2">
          {tickets.map((ticket) => (
            <TicketRow key={ticket._id} ticket={ticket} />
          ))}
        </ul>
      )}

      <h2 className="text-lg font-medium">Documents</h2>
      <TenantDocuments tenantId={tenant._id} />
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

function TicketRow({ ticket }: { ticket: Doc<"tickets"> }) {
  const urgent = ticket.priority === "urgent" || ticket.priority === "high";
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
      <Badge variant={ticket.status === "closed" ? "outline" : "secondary"}>
        {humanize(ticket.status)}
      </Badge>
      <Badge variant={urgent ? "destructive" : "outline"}>
        {humanize(ticket.priority)}
      </Badge>
      <span className="text-muted-foreground">{humanize(ticket.category)}</span>
      <span className="basis-full sm:basis-auto">{ticket.description}</span>
    </li>
  );
}
