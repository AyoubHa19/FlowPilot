import workflow from "@convex-dev/workflow/convex.config";
import workpool from "@convex-dev/workpool/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();

// Background queue for CSV import batches (Stage 2).
app.use(workpool, { name: "importPool" });
// PDF extraction + embedding, one job per file (Stage 3). Separate pool so a
// big import never delays documents, and to cap parallel Gemini calls.
app.use(workpool, { name: "documentPool" });
// Durable agent runs, one workflow per inbound email (Stage 5).
app.use(workflow);

export default app;
