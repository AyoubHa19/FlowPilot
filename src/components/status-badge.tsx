import { LoaderIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { humanize } from "@/lib/format";

type Tone = "success" | "warning" | "info" | "danger" | "neutral";

// One place that maps every status in the app to a color, so the same state
// looks the same on every page.
const TONES: Record<string, Tone> = {
  // agent runs
  queued: "neutral",
  running: "info",
  awaiting_approval: "warning",
  drafted: "info",
  completed: "success",
  evaluated: "success",
  rejected: "neutral",
  escalated: "danger",
  skipped: "neutral",
  failed: "danger",
  // threads
  open: "info",
  replied: "success",
  needs_human: "danger",
  closed: "neutral",
  // approvals
  pending: "warning",
  approved: "info",
  executed: "success",
  eval: "neutral",
  // documents and imports
  extracting: "info",
  embedding: "info",
  processing: "info",
  parsing: "info",
  ready: "success",
  // tickets
  in_progress: "info",
  // priorities and urgency
  low: "neutral",
  medium: "info",
  high: "warning",
  urgent: "danger",
};

const LABELS: Record<string, string> = {
  awaiting_approval: "Awaiting approval",
  needs_human: "Needs a person",
  executed: "Done",
  eval: "Eval only",
};

const ACTIVE = new Set(["running", "extracting", "embedding", "processing", "parsing", "approved"]);

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <Badge variant={TONES[status] ?? "neutral"}>
      {ACTIVE.has(status) && <LoaderIcon className="animate-spin" />}
      {label ?? LABELS[status] ?? humanize(status)}
    </Badge>
  );
}
