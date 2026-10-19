import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { ticketPayloadSchema } from "./approvals";
import { embedQuery } from "./embeddings";
import { normalizeEmail } from "./properties";
import { searchTenantChunks } from "./search";

/**
 * What a tool may touch. Tools never take a tenant id from the model: every
 * lookup is bound to the email's sender, so the agent cannot read another
 * tenant's data however it is prompted (PRD privacy rule, enforced in code).
 */
export type RunScope = {
  runId: Id<"agentRuns">;
  threadId: Id<"emailThreads">;
  senderEmail: string;
  tenantId?: Id<"tenants">;
  /** The timeline step running this call (dedupe key for proposals). */
  stepIndex?: number;
};

type ToolDefinition<Schema extends z.ZodType> = {
  name: string;
  description: string;
  inputSchema: Schema;
  /**
   * Side-effect tools never act directly: their handler only records a
   * proposal, and the workflow executes it after a human approves.
   */
  requiresApproval: boolean;
  /** Ends the act loop once it succeeds. */
  terminal?: boolean;
  handler: (ctx: ActionCtx, scope: RunScope, input: z.infer<Schema>) => Promise<unknown>;
};

function define<Schema extends z.ZodType>(def: ToolDefinition<Schema>) {
  return def;
}

const UNKNOWN_SENDER = {
  error: "The sender is not a known tenant. Do not share any tenant information.",
};

export const TOOLS = [
  define({
    name: "find_tenant_by_email",
    description:
      "Look up the tenant, unit and building for an email address. Only the sender of the current email can be looked up.",
    inputSchema: z.object({ email: z.email() }),
    requiresApproval: false,
    handler: async (ctx, scope, { email }): Promise<unknown> => {
      if (normalizeEmail(email) !== scope.senderEmail) {
        return { error: "Only the sender of this email can be looked up." };
      }
      return (await ctx.runQuery(internal.agent.tenantProfile, { email })) ?? { found: false };
    },
  }),
  define({
    name: "get_lease",
    description: "Get the sender's active lease terms: start, end, rent, notice period.",
    inputSchema: z.object({}),
    requiresApproval: false,
    handler: async (ctx, scope): Promise<unknown> => {
      if (!scope.tenantId) return UNKNOWN_SENDER;
      return (await ctx.runQuery(internal.agent.activeLease, { tenantId: scope.tenantId })) ?? {
        found: false,
      };
    },
  }),
  define({
    name: "search_lease_documents",
    description:
      "Semantic search over the sender's own lease PDF. Use a short, specific question, e.g. 'notice period' or 'are dogs allowed'.",
    inputSchema: z.object({ query: z.string().trim().min(2).max(300) }),
    requiresApproval: false,
    handler: async (ctx, scope, { query }): Promise<unknown> => {
      if (!scope.tenantId) return UNKNOWN_SENDER;
      const hits = await searchTenantChunks(ctx, scope.tenantId, await embedQuery(query), 4);
      return hits.map((h) => ({
        file: h.filename,
        chunk: h.chunkIndex,
        score: Number(h.score.toFixed(3)),
        text: h.text,
      }));
    },
  }),
  define({
    name: "list_open_tickets",
    description: "List open and in-progress repair tickets for the sender's unit.",
    inputSchema: z.object({}),
    requiresApproval: false,
    handler: async (ctx, scope): Promise<unknown> => {
      if (!scope.tenantId) return UNKNOWN_SENDER;
      return await ctx.runQuery(internal.agent.openTickets, { tenantId: scope.tenantId });
    },
  }),
  define({
    name: "create_ticket",
    description:
      "Propose a repair ticket for the sender's unit. A person approves it before it is created. Use only for a new problem that no open ticket already covers.",
    inputSchema: ticketPayloadSchema,
    requiresApproval: true,
    handler: async (ctx, scope, ticket): Promise<unknown> => {
      if (!scope.tenantId) return UNKNOWN_SENDER;
      await ctx.runMutation(internal.approvals.proposeFromTool, {
        runId: scope.runId,
        stepIndex: scope.stepIndex ?? -1,
        payload: ticket,
      });
      return { proposed: true, note: "Waiting for a person to approve. Mention in the reply that the repair is being arranged." };
    },
  }),
  define({
    name: "draft_reply",
    description:
      "Finish with the reply. Call exactly once, at the end. It becomes a send_reply proposal that a person approves, edits or rejects; nothing is sent before that.",
    inputSchema: z.object({
      subject: z.string().trim().min(1).max(200),
      body: z.string().trim().min(1).max(5000),
    }),
    requiresApproval: false,
    terminal: true,
    handler: async (ctx, scope, draft): Promise<unknown> => {
      await ctx.runMutation(internal.agent.saveDraft, { runId: scope.runId, draft });
      return { saved: true };
    },
  }),
  define({
    name: "escalate_to_human",
    description:
      "Flag the conversation for a person instead of drafting a reply. Give a short reason.",
    inputSchema: z.object({ reason: z.string().trim().min(3).max(500) }),
    requiresApproval: false,
    terminal: true,
    handler: async (ctx, scope, { reason }): Promise<unknown> => {
      await ctx.runMutation(internal.agent.escalate, { runId: scope.runId, reason });
      return { escalated: true };
    },
  }),
];

export type ToolName = (typeof TOOLS)[number]["name"];

export function findTool(name: string) {
  return TOOLS.find((t) => t.name === name);
}

/** What the model sees: name, description and schema only, no handlers. */
export function toolSetForModel(): ToolSet {
  return Object.fromEntries(
    TOOLS.map((t) => [t.name, tool({ description: t.description, inputSchema: t.inputSchema })]),
  );
}

/**
 * Validates the model's input with zod before the handler runs. Bad input is
 * returned to the model as an error it can correct, not thrown.
 */
export async function executeTool(
  ctx: ActionCtx,
  scope: RunScope,
  name: string,
  rawInput: unknown,
): Promise<{ output: unknown; terminal: boolean; invalid: boolean }> {
  const def = findTool(name);
  if (!def) {
    return { output: { error: `Unknown tool ${name}` }, terminal: false, invalid: true };
  }
  const parsed = def.inputSchema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`);
    return { output: { error: `Invalid input. ${issues.join("; ")}` }, terminal: false, invalid: true };
  }
  // The cast is safe: def and its schema come from the same registry entry.
  const output = await (def.handler as (c: ActionCtx, s: RunScope, i: unknown) => Promise<unknown>)(
    ctx,
    scope,
    parsed.data,
  );
  return { output, terminal: def.terminal === true, invalid: false };
}
