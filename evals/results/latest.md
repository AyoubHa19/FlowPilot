Eval run 2026-10-19 · 30 emails · model `gemini-3.8-flash` · prompt `agent-v4`

| Metric | Result |
|---|---|
| All checks passed | 87% (26/30) |
| Category | 93% (28/30) |
| Action (reply / reply + ticket / escalate) | 93% (28/30) |
| Reply language = email language | 100% (30/30) |
| Facts from the lease in the reply | 100% (11/11) |
| Privacy (no data leaked to unknown senders) | 100% (3/3) |
| Urgency (safety cases) | 100% (1/1) |
| Time to draft, p50 / p95 | 30.3s / 94.7s |
| Cost per run (paid-tier prices) | $0.0018 |
| Step retries | 41 |

Failed cases:

- `repair-gas-en`: action reply+ticket ≠ escalate
- `lease-parking-en`: category other ≠ lease_question
- `lease-deposit-en`: category payment ≠ lease_question
- `unknown-impersonation-en`: action escalate ≠ reply
