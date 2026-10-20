# Demo video script (2–3 minutes, English)

Goal: show one real email going through the whole system, from Gmail to an
approved reply back in Gmail, and the engineering behind it. Record the screen
at 1920×1080 (OBS or Loom), with the browser zoomed to 110% so text is readable.
Speak calmly; every scene has a target length.

## Before recording

- [ ] Production dashboard open and signed in, Gmail connected, inbox synced.
- [ ] A second browser window on the sender's Gmail (a personal address, not the test inbox).
- [ ] Approvals queue empty, so the new item is obvious.
- [ ] The sender is a seeded tenant, so the agent finds context. Either send from
      a tenant address you control, or link your address to a tenant first.
- [ ] Draft the test email in advance (below) and keep it unsent.
- [ ] Close other tabs and notifications.

Test email (from the sender's Gmail to the test inbox):

> **Subject:** Bathroom window does not close
>
> Hi, the window in my bathroom does not close anymore, the handle seems
> broken and it is getting cold. Can you send someone? Thanks

---

## Scene 1: The problem (0:00–0:15)

**Screen:** dashboard inbox.

**Say:** "Property managers get dozens of tenant emails a day: repairs,
payments, lease questions. Each one means finding the tenant, the lease and the
history before you can answer. FlowPilot is an email agent that does that work,
and never sends anything without a human click."

## Scene 2: An email arrives (0:15–0:35)

**Screen:** switch to the sender's Gmail, press Send. Switch back to the
dashboard and click "Sync now" (or wait for the one-minute sync).

**Say:** "I'm sending a real email to the property manager's Gmail inbox. A
Convex cron pulls new mail every minute; it is deduplicated by Gmail message
id and linked to the tenant by the sender's address."

Point at the new thread and the tenant badge.

## Scene 3: The agent run, live (0:35–1:15)

**Screen:** open the thread, then "Open run timeline". Let the steps appear.

**Say:** "Every email starts a durable workflow. First a small model classifies
it: a repair, medium urgency, English. Then, without any LLM, it looks up the
tenant, the active lease, open tickets, and searches the tenant's own lease PDF
with vector search. Only then does the agent model write a reply and propose a
repair ticket."

Expand one tool step to show input and output.

**Say:** "Each step is its own retryable unit with its own log: tokens, cost,
duration. If Gemini is overloaded, only that step retries, with backoff and a
fallback model. This whole run cost about a fifth of a cent."

## Scene 4: The human decides (1:15–1:50)

**Screen:** the approval cards on the timeline page, or the Approvals page
with its counter.

**Say:** "The agent can't send or create anything. Its side-effect tools only
write proposals; the workflow is now asleep, waiting for my decision. I approve
the ticket as is."

Click Approve on the ticket; the timeline moves on to the reply.

**Say:** "For the reply I edit the time slot before approving. The edited text
is what gets sent; the original stays on record."

Click Edit, change one sentence, click Approve edited.

## Scene 5: The reply in Gmail (1:50–2:10)

**Screen:** switch to the sender's Gmail, open the conversation.

**Say:** "The reply arrives in the same Gmail conversation, threaded with the
original email, with my edit in it."

## Scene 6: Why you can trust it (2:10–2:45)

**Screen:** the README eval table on GitHub, then the tenant's page with the
new ticket.

**Say:** "Two guarantees are enforced in code, not in the prompt. Privacy: the
agent's tools are bound to the sender, so it cannot read another tenant's
lease, and unknown senders get nothing. And no side effect without an approved
row. I measure the agent on a 30-email eval set in four languages: category,
action, facts from the lease, and privacy. These are the numbers. The stack is
Next.js, Convex, its Workflow and Workpool components, and Gemini, all on free
tiers."

## Scene 7: Close (2:45–3:00)

**Screen:** the inbox, ticket created, reply sent.

**Say:** "An email came in, the agent did the research and the drafting, and a
person made the call. The code, the decisions log and the eval are on GitHub."

---

## After recording

- Trim dead time (sync waits) to keep the video under three minutes.
- Add the link to the README (YouTube unlisted, or Loom).
