import workpool from "@convex-dev/workpool/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();

// Background queue for CSV import batches (Stage 2).
app.use(workpool, { name: "importPool" });

export default app;
