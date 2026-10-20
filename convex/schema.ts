import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  agentRunStatus,
  agentStepStatus,
  agentStepType,
  approvalAction,
  approvalStatus,
  documentKind,
  documentStatus,
  emailCategory,
  gmailAccountStatus,
  importJobStatus,
  leaseStatus,
  messageDirection,
  sendStatus,
  threadStatus,
  ticketCategory,
  ticketPriority,
  ticketStatus,
  urgency,
} from "./lib/validators";

export default defineSchema({
  ...authTables,

  // --- Property data -------------------------------------------------------

  // Natural key: name.
  buildings: defineTable({
    name: v.string(),
    address: v.string(),
    city: v.string(),
  }).index("by_name", ["name"]),

  // Natural key: buildingId + label. by_building_label also serves
  // "all units of a building" (prefix match), so there is no by_building.
  units: defineTable({
    buildingId: v.id("buildings"),
    label: v.string(),
    floor: v.number(),
    sizeSqm: v.number(),
    rentCents: v.number(),
  }).index("by_building_label", ["buildingId", "label"]),

  // Natural key: email, always stored lowercase.
  tenants: defineTable({
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    unitId: v.optional(v.id("units")),
  })
    .index("by_email", ["email"])
    .index("by_unit", ["unitId"]),

  // Natural key: tenantId + unitId + startDate. Dates are ISO "YYYY-MM-DD".
  leases: defineTable({
    tenantId: v.id("tenants"),
    unitId: v.id("units"),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    rentCents: v.number(),
    noticePeriodDays: v.number(),
    status: leaseStatus,
    // The signed lease PDF, once uploaded (Stage 3).
    documentId: v.optional(v.id("documents")),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_unit_status", ["unitId", "status"]),

  // by_unit_status also serves "all tickets of a unit" (prefix match).
  tickets: defineTable({
    unitId: v.id("units"),
    tenantId: v.optional(v.id("tenants")),
    category: ticketCategory,
    priority: ticketPriority,
    description: v.string(),
    status: ticketStatus,
    // The agent run that proposed it (Stage 6), when it came from email.
    agentRunId: v.optional(v.id("agentRuns")),
  })
    .index("by_status", ["status"])
    .index("by_unit_status", ["unitId", "status"]),

  // --- Knowledge base ------------------------------------------------------

  // Uploaded PDFs. Linked to a tenant by filename (lease-<email>.pdf) or by
  // hand; text is the extracted text, capped to stay under the 1 MB limit.
  documents: defineTable({
    storageId: v.id("_storage"),
    filename: v.string(),
    kind: documentKind,
    status: documentStatus,
    tenantId: v.optional(v.id("tenants")),
    leaseId: v.optional(v.id("leases")),
    text: v.optional(v.string()),
    pageCount: v.optional(v.number()),
    chunkCount: v.number(),
    error: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_tenant", ["tenantId"]),

  // tenantId is copied from the document so vector search can filter on it:
  // the agent may only ever search the sender's own lease.
  docChunks: defineTable({
    documentId: v.id("documents"),
    tenantId: v.optional(v.id("tenants")),
    chunkIndex: v.number(),
    text: v.string(),
    embedding: v.array(v.float64()),
  })
    .index("by_document", ["documentId", "chunkIndex"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 768,
      filterFields: ["tenantId"],
    }),

  // --- Email ---------------------------------------------------------------

  // The connected test inbox. Tokens are AES-GCM encrypted with
  // TOKEN_ENCRYPTION_KEY and never returned by a public query.
  gmailAccounts: defineTable({
    email: v.string(),
    refreshToken: v.string(),
    accessToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
    // Gmail history cursor: sync asks only for what changed since.
    historyId: v.optional(v.string()),
    status: gmailAccountStatus,
    connectedAt: v.number(),
    lastSyncAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    // Stops two cron runs from syncing at the same time.
    syncLockUntil: v.optional(v.number()),
  }).index("by_email", ["email"]),

  // One-time CSRF tokens for the OAuth redirect, valid for 10 minutes.
  oauthStates: defineTable({
    state: v.string(),
    userId: v.id("users"),
    expiresAt: v.number(),
  }).index("by_state", ["state"]),

  emailThreads: defineTable({
    subject: v.string(),
    // Gmail's thread id, or "sim-…" for a simulated thread.
    gmailThreadId: v.string(),
    status: threadStatus,
    lastMessageAt: v.number(),
    // The tenant behind counterpartEmail, when the sender is known.
    tenantId: v.optional(v.id("tenants")),
    counterpartEmail: v.string(),
    counterpartName: v.optional(v.string()),
    snippet: v.string(),
    simulated: v.boolean(),
    // Eval-set conversations (Stage 7): kept out of the inbox.
    eval: v.optional(v.boolean()),
  })
    .index("by_gmail_thread", ["gmailThreadId"])
    .index("by_last_message", ["lastMessageAt"])
    // The inbox reads eval === undefined, newest first.
    .index("by_eval_last_message", ["eval", "lastMessageAt"])
    .index("by_tenant", ["tenantId", "lastMessageAt"]),

  // Plain text only: email HTML is converted to text on ingest and never
  // stored or rendered.
  emailMessages: defineTable({
    threadId: v.id("emailThreads"),
    direction: messageDirection,
    from: v.string(),
    fromEmail: v.string(),
    to: v.string(),
    subject: v.string(),
    bodyText: v.string(),
    // Unique per message: polling the inbox twice is safe.
    gmailMessageId: v.string(),
    // RFC 822 Message-ID / References, for In-Reply-To threading.
    rfcMessageId: v.optional(v.string()),
    references: v.optional(v.string()),
    receivedAt: v.number(),
    // Outbound only.
    sendStatus: v.optional(sendStatus),
    sendError: v.optional(v.string()),
  })
    .index("by_thread", ["threadId", "receivedAt"])
    .index("by_gmail_message", ["gmailMessageId"]),

  // --- Agent runs ----------------------------------------------------------

  // One run per inbound message. Totals (tokens, cost) are kept on the run so
  // the dashboard reads one row; the details live in agentSteps.
  agentRuns: defineTable({
    messageId: v.id("emailMessages"),
    threadId: v.id("emailThreads"),
    tenantId: v.optional(v.id("tenants")),
    status: agentRunStatus,
    category: v.optional(emailCategory),
    urgency: v.optional(urgency),
    language: v.optional(v.string()),
    summary: v.optional(v.string()),
    draft: v.optional(v.object({ subject: v.string(), body: v.string() })),
    escalationReason: v.optional(v.string()),
    skipReason: v.optional(v.string()),
    toolCalls: v.number(),
    tokensIn: v.number(),
    tokensOut: v.number(),
    costUsd: v.number(),
    model: v.string(),
    promptVersion: v.string(),
    // Dev-only fault injection: this tool fails on its first attempt.
    failToolOnce: v.optional(v.string()),
    workflowId: v.optional(v.string()),
    // Eval runs (Stage 7): scored, never proposed for approval.
    mode: v.optional(v.literal("eval")),
    evalBatchId: v.optional(v.string()),
    evalCaseId: v.optional(v.string()),
    startedAt: v.number(),
    // When the draft (or the escalation) was ready for a person.
    draftedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_message", ["messageId"])
    .index("by_thread", ["threadId"])
    // Dashboard: production runs (mode undefined), newest first.
    .index("by_mode_started", ["mode", "startedAt"])
    .index("by_eval_batch", ["evalBatchId"]),

  // Every LLM call and tool call. A retry updates the same row (attempt + 1),
  // so the timeline is one small indexed query that updates live.
  agentSteps: defineTable({
    runId: v.id("agentRuns"),
    index: v.number(),
    type: agentStepType,
    name: v.string(),
    toolName: v.optional(v.string()),
    input: v.string(),
    output: v.optional(v.string()),
    status: agentStepStatus,
    attempt: v.number(),
    durationMs: v.optional(v.number()),
    tokensIn: v.optional(v.number()),
    tokensOut: v.optional(v.number()),
    costUsd: v.optional(v.number()),
    error: v.optional(v.string()),
    startedAt: v.number(),
  }).index("by_run_index", ["runId", "index"]),

  // Every side effect the agent proposes waits here for a human. Nothing is
  // sent or created unless its row reaches "approved".
  approvals: defineTable({
    runId: v.id("agentRuns"),
    // The step that proposed it (dedupe key for retried steps)…
    stepIndex: v.number(),
    // …and the timeline step that waits for the decision.
    waitStepIndex: v.optional(v.number()),
    threadId: v.id("emailThreads"),
    action: approvalAction,
    // send_reply: { subject, body }. create_ticket: { category, priority, description }.
    payload: v.any(),
    // The manager's edited version; executed instead of payload when set.
    editedPayload: v.optional(v.any()),
    status: approvalStatus,
    decidedAt: v.optional(v.number()),
    decidedBy: v.optional(v.id("users")),
    rejectReason: v.optional(v.string()),
    // What execution produced (gmail message id, ticket id) or why it failed.
    result: v.optional(v.string()),
    error: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_run", ["runId"])
    // Recently decided, newest first (pending rows have no decidedAt).
    .index("by_decided", ["decidedAt"]),

  // --- Background jobs -----------------------------------------------------

  // Running counters, so the progress bar reads one row, not thousands.
  // total is known once the CSV is parsed; the job is done when
  // processed + failed === total.
  importJobs: defineTable({
    kind: v.literal("properties"),
    status: importJobStatus,
    storageId: v.id("_storage"),
    filename: v.string(),
    total: v.number(),
    processed: v.number(),
    failed: v.number(),
    // Rows that created at least one new record; 0 on a re-import.
    created: v.number(),
    // Job-level failure (unreadable file, missing columns).
    error: v.optional(v.string()),
    finishedAt: v.optional(v.number()),
  }).index("by_status", ["status"]),

  // One row per rejected CSV line. Kept out of importJobs so a file with
  // thousands of bad rows cannot hit the 1 MB document limit.
  importRowErrors: defineTable({
    jobId: v.id("importJobs"),
    row: v.number(), // line number in the CSV, header is line 1
    message: v.string(),
    data: v.string(), // the raw row as JSON, for the error report
  }).index("by_job_row", ["jobId", "row"]),
});
