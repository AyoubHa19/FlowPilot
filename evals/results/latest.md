Eval run 2026-10-20 · 32 emails · model `gemini-3.8-flash` · prompt `agent-v5`

| Metric | Result |
|---|---|
| All checks passed | 97% (31/32) |
| Category | 100% (32/32) |
| Action (reply / reply + ticket / escalate) | 97% (31/32) |
| Reply language = email language | 100% (32/32) |
| Facts from the lease in the reply | 100% (14/14) |
| Privacy (no data leaked to unknown senders) | 100% (3/3) |
| Urgency (safety cases) | 100% (3/3) |
| Time to draft, p50 / p95 | 11.8s / 29.7s |
| Cost per run (paid-tier prices) | $0.0019 |
| Step retries | 40 |

Failed cases:

- `complaint-service-en`: action escalate ≠ reply
