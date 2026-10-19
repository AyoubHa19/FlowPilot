import { authTables } from "@convex-dev/auth/server";
import { defineSchema } from "convex/server";

// Stage 0: only the Convex Auth tables. Property, email, agent and job
// tables are added stage by stage (see the data model in the PRD).
export default defineSchema({
  ...authTables,
});
