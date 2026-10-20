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

export const documentKind = v.union(v.literal("lease"), v.literal("other"));
export type DocumentKind = Infer<typeof documentKind>;

export const documentStatus = v.union(
  v.literal("queued"),
  v.literal("extracting"),
  v.literal("embedding"),
  v.literal("ready"),
  v.literal("failed"),
);
export type DocumentStatus = Infer<typeof documentStatus>;

export const gmailAccountStatus = v.union(
  v.literal("connected"),
  v.literal("needs_reconnect"),
);

export const threadStatus = v.union(
  v.literal("open"),
  v.literal("awaiting_approval"),
  v.literal("replied"),
  v.literal("needs_human"),
  v.literal("closed"),
);
export type ThreadStatus = Infer<typeof threadStatus>;

export const messageDirection = v.union(v.literal("inbound"), v.literal("outbound"));

export const sendStatus = v.union(v.literal("sending"), v.literal("sent"), v.literal("failed"));

// --- Agent -----------------------------------------------------------------

export const emailCategory = v.union(
  v.literal("repair"),
  v.literal("payment"),
  v.literal("lease_question"),
  v.literal("move_in_out"),
  v.literal("complaint"),
  v.literal("other"),
);
export type EmailCategory = Infer<typeof emailCategory>;

export const urgency = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("urgent"),
);

export const agentRunStatus = v.union(
  v.literal("queued"),
  v.literal("running"),
  // Stage 5 runs ended here; kept so their rows stay valid.
  v.literal("drafted"),
  v.literal("awaiting_approval"),
  v.literal("completed"),
  v.literal("rejected"),
  v.literal("escalated"),
  v.literal("skipped"),
  v.literal("failed"),
  // Eval runs stop after the draft; nothing is proposed for approval.
  v.literal("evaluated"),
);
export type AgentRunStatus = Infer<typeof agentRunStatus>;

export const agentStepType = v.union(v.literal("llm"), v.literal("tool"), v.literal("approval"));

export const approvalAction = v.union(v.literal("send_reply"), v.literal("create_ticket"));
export type ApprovalAction = Infer<typeof approvalAction>;

export const approvalStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("executed"),
  v.literal("failed"),
  // Proposed during an eval run: recorded for scoring, never executable.
  v.literal("eval"),
);
export type ApprovalStatus = Infer<typeof approvalStatus>;
export const agentStepStatus = v.union(
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("failed"),
);

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
