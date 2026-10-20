"use client";

import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { DownloadIcon, LockIcon, UploadIcon } from "lucide-react";
import Papa from "papaparse";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { IMPORT_COLUMNS } from "../../../convex/model/importRows";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { downloadFile } from "@/lib/download";
import { useViewer } from "@/lib/use-viewer";

const TEMPLATE_ROW = {
  building_name: "Lindenhof",
  building_address: "Lindenstraße 42, 10969 Berlin",
  building_city: "Berlin",
  unit_label: "1.02",
  unit_floor: "1",
  unit_size_sqm: "50",
  unit_rent_eur: "725",
  tenant_name: "Felix Braun",
  tenant_email: "felix.braun@example.com",
  tenant_phone: "+49 30 5550105",
  lease_start: "2023-02-01",
  lease_end: "",
  notice_period_days: "90",
};

function downloadTemplate() {
  const csv = Papa.unparse([TEMPLATE_ROW], { columns: [...IMPORT_COLUMNS] });
  downloadFile("flowpilot-import-template.csv", csv, "text/csv");
}

export function ImportUpload() {
  const generateUploadUrl = useMutation(api.imports.generateUploadUrl);
  const startImport = useMutation(api.imports.start);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const { isDemo } = useViewer();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;

    setPending(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "text/csv" },
        body: file,
      });
      if (!response.ok) {
        throw new Error(`Upload failed (${response.status})`);
      }
      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
      await startImport({ storageId, filename: file.name });
      toast.success(`Importing ${file.name} in the background`);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? String(error.data)
          : error instanceof Error
            ? error.message
            : "Upload failed",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import properties from CSV</CardTitle>
        <CardDescription>
          One row per unit, with its building, tenant and lease. Rows are
          matched by building name, unit label and tenant email, so importing
          the same file again changes nothing.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isDemo && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <LockIcon className="size-3.5" /> The demo account can look around but not upload.
          </p>
        )}
        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
          <Input
            ref={inputRef}
            type="file"
            name="file"
            accept=".csv,text/csv"
            aria-label="CSV file"
            onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
            disabled={pending || isDemo}
          />
          <Button type="submit" disabled={!file || pending || isDemo}>
            <UploadIcon />
            {pending ? "Uploading…" : "Upload and import"}
          </Button>
        </form>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>
            Columns: <code className="text-xs">{IMPORT_COLUMNS.join(", ")}</code>
          </span>
          <Button type="button" variant="link" className="h-auto p-0" onClick={downloadTemplate}>
            <DownloadIcon />
            Template
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
