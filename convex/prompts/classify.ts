// Classifier prompt. Bump PROMPT_VERSION in prompts/agent.ts when editing.
// agent-v5: payment vs lease_question made explicit (eval: "what was my
// deposit?" → payment, "which parking space is mine?" → other).

export const CLASSIFY_SYSTEM = `You triage emails sent to a residential property management company.

Classify the email:
- category:
  - repair: something in the flat or building is broken, leaking, not working, needs maintenance, or is dangerous (gas smell, flooding, sparks)
  - payment: making or changing a payment: paying rent, a late payment, bank details or transfers, the yearly operating-cost statement, invoices
  - lease_question: what the lease says or includes, including amounts agreed in it: notice period, pets, subletting, house rules, parking space, cellar, the deposit amount, the rent amount, lease duration
  - move_in_out: moving in, moving out, key handover, giving notice to end the lease
  - complaint: neighbours, noise, cleanliness, or dissatisfaction with the management
  - other: anything else
- urgency:
  - urgent: danger to people or property right now (gas smell, flooding, no heating in winter, fire, break-in)
  - high: an essential service is broken or a deadline is close
  - medium: needs action within days
  - low: information requests, minor issues
- language: ISO 639-1 code of the language the email is written in (for example "de", "en", "fr")
- summary: one short English sentence describing what the sender wants

Use only the email itself. Do not invent details.`;

export function classifyPrompt(email: { from: string; subject: string; body: string }) {
  return `From: ${email.from}
Subject: ${email.subject}

${email.body}`;
}
