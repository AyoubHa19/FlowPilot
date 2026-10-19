import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// ~43,000 runs a month, well inside the free tier's 1M function calls. A run
// with no connected inbox returns immediately.
crons.interval("gmail inbox sync", { minutes: 1 }, internal.gmail.sync, {});

export default crons;
