import type { Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import {
  upsertBuilding,
  upsertLease,
  upsertTenant,
  upsertTicket,
  upsertUnit,
} from "./model/properties";
import {
  BUILDINGS,
  NOTICE_PERIOD_DAYS,
  TICKETS,
  tenantFor,
  unitsFor,
} from "./seedData";

/**
 * Seeds 3 buildings, 60 units, 60 tenants with one active lease each, and a
 * few tickets. Every row is upserted by its natural key, so it is safe to
 * run any number of times:
 *
 *   npx convex run seed:run
 */
export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const counts = { created: 0, updated: 0 };
    const tally = ({ created }: { created: boolean }) => {
      counts[created ? "created" : "updated"] += 1;
    };
    const unitIds: Id<"units">[][] = [];
    const tenantIds: Id<"tenants">[][] = [];

    for (const [b, building] of BUILDINGS.entries()) {
      const buildingRow = await upsertBuilding(ctx, {
        name: building.name,
        address: building.address,
        city: building.city,
      });
      tally(buildingRow);
      unitIds[b] = [];
      tenantIds[b] = [];

      for (const [u, unit] of unitsFor(b).entries()) {
        const unitRow = await upsertUnit(ctx, {
          buildingId: buildingRow.id,
          ...unit,
        });
        tally(unitRow);
        unitIds[b][u] = unitRow.id;

        const tenant = tenantFor(b, u);
        const tenantRow = await upsertTenant(ctx, {
          name: tenant.name,
          email: tenant.email,
          phone: tenant.phone,
          unitId: unitRow.id,
        });
        tally(tenantRow);
        tenantIds[b][u] = tenantRow.id;

        tally(
          await upsertLease(ctx, {
            tenantId: tenantRow.id,
            unitId: unitRow.id,
            startDate: tenant.startDate,
            rentCents: unit.rentCents,
            noticePeriodDays: NOTICE_PERIOD_DAYS,
            status: "active",
          }),
        );
      }
    }

    for (const t of TICKETS) {
      tally(
        await upsertTicket(ctx, {
          unitId: unitIds[t.buildingIndex][t.unitIndex],
          tenantId: tenantIds[t.buildingIndex][t.unitIndex],
          category: t.category,
          priority: t.priority,
          status: t.status,
          description: t.description,
        }),
      );
    }

    return counts;
  },
});
