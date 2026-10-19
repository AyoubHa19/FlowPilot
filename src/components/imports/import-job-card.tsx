"use client";

import { useConvex, usePaginatedQuery } from "convex/react";
import { DownloadIcon } from "lucide-react";
import Papa from "papaparse";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { IMPORT_COLUMNS } from "../../../convex/model/importRows";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { downloadFile } from "@/lib/download";
import { humanize } from "@/lib/format";

const PREVIEW_ERRORS = 3;
const ERROR_PAGE_SIZE = 500;

type Job = Doc<"importJobs">;

const number = new Intl.NumberFormat("en-GB");
const time = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

function statusVariant(status: Job["status"]) {
  if (status === "failed") return "destructive" as const;
  if (status === "completed") return "outline" as const;
  return "secondary" as const;
}

export function ImportJobCard({ job }: { job: Job }) {
  const done = job.processed + job.failed;
  const percent = job.total === 0 ? 0 : Math.round((done / job.total) * 100);
  const running = job.status === "queued" || job.status === "parsing" || job.status === "processing";
  const seconds = job.finishedAt ? Math.max(1, Math.round((job.finishedAt - job._creationTime) / 1000)) : null;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center gap-2">
        <CardTitle className="mr-auto break-all">{job.filename}</CardTitle>
        <Badge variant={statusVariant(job.status)}>{humanize(job.status)}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {job.status === "failed" && job.error ? (
          <p className="text-sm text-destructive">{job.error}</p>
        ) : (
          <>
            <Progress value={running && job.total === 0 ? null : percent} aria-label="Import progress" />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground tabular-nums">
              <span>
                {number.format(done)} / {number.format(job.total)} rows ({percent}%)
              </span>
              <span>{number.format(job.processed)} imported</span>
              <span className={job.failed > 0 ? "text-destructive" : undefined}>
                {number.format(job.failed)} failed
              </span>
              <span>{number.format(job.created)} new</span>
            </div>
          </>
        )}
        <p className="text-xs text-muted-foreground">
          Started {time.format(job._creationTime)}
          {seconds !== null && ` · took ${seconds}s`}
        </p>
        {job.failed > 0 && <ErrorPreview job={job} />}
      </CardContent>
    </Card>
  );
}

function ErrorPreview({ job }: { job: Job }) {
  const convex = useConvex();
  const [downloading, setDownloading] = useState(false);
  const { results } = usePaginatedQuery(
    api.imports.listErrors,
    { jobId: job._id },
    { initialNumItems: PREVIEW_ERRORS },
  );

  async function downloadReport() {
    setDownloading(true);
    try {
      const rows: Record<string, string | number>[] = [];
      let cursor: string | null = null;
      for (;;) {
        const page: Awaited<ReturnType<typeof convex.query<typeof api.imports.listErrors>>> =
          await convex.query(api.imports.listErrors, {
            jobId: job._id,
            paginationOpts: { numItems: ERROR_PAGE_SIZE, cursor },
          });
        for (const error of page.page) {
          rows.push({ row: error.row, error: error.message, ...JSON.parse(error.data) });
        }
        if (page.isDone) break;
        cursor = page.continueCursor;
      }
      const csv = Papa.unparse(rows, { columns: ["row", "error", ...IMPORT_COLUMNS] });
      downloadFile(job.filename.replace(/\.csv$/i, "") + "-errors.csv", csv, "text/csv");
    } catch {
      toast.error("Could not build the error report");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 p-3 text-sm">
      <ul className="flex flex-col gap-1">
        {results.slice(0, PREVIEW_ERRORS).map((error) => (
          <li key={error._id}>
            <span className="font-medium tabular-nums">Row {error.row}:</span> {error.message}
          </li>
        ))}
        {job.failed > PREVIEW_ERRORS && (
          <li className="text-muted-foreground">
            and {number.format(job.failed - PREVIEW_ERRORS)} more
          </li>
        )}
      </ul>
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        disabled={downloading}
        onClick={() => void downloadReport()}
      >
        <DownloadIcon />
        {downloading ? "Preparing…" : "Download error report"}
      </Button>
    </div>
  );
}
