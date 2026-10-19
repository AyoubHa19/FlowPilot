import { v, type Infer } from "convex/values";

export const leaseStatus = v.union(
  v.literal("upcoming"),
  v.literal("active"),
  v.literal("ended"),
);
export type LeaseStatus = Infer<typeof leaseStatus>;

export const importJobStatus = v.union(
  v.literal("queued"),
  v.literal("parsing"),
  v.literal("processing"),
  v.literal("completed"),
  v.literal("failed"),
);
export type ImportJobStatus = Infer<typeof importJobStatus>;

export const ticketCategory = v.union(
  v.literal("plumbing"),
  v.literal("electrical"),
  v.literal("heating"),
  v.literal("appliance"),
  v.literal("structural"),
  v.literal("pest"),
  v.literal("other"),
);
export type TicketCategory = Infer<typeof ticketCategory>;

export const ticketPriority = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("urgent"),
);
export type TicketPriority = Infer<typeof ticketPriority>;

export const ticketStatus = v.union(
  v.literal("open"),
  v.literal("in_progress"),
  v.literal("closed"),
);
export type TicketStatus = Infer<typeof ticketStatus>;
