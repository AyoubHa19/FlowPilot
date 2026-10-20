"use client";

import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { LockIcon, UploadIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useViewer } from "@/lib/use-viewer";

// Parallel uploads from the browser; processing is queued server side.
const UPLOAD_CONCURRENCY = 4;

function errorMessage(error: unknown) {
  if (error instanceof ConvexError) return String(error.data);
  if (error instanceof Error) return error.message;
  return "Upload failed";
}

export function DocumentUpload() {
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const createDocument = useMutation(api.documents.create);
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const { isDemo } = useViewer();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function uploadOne(file: File) {
    const uploadUrl = await generateUploadUrl();
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/pdf" },
      body: file,
    });
    if (!response.ok) {
      throw new Error(`${file.name}: upload failed (${response.status})`);
    }
    const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
    await createDocument({ storageId, filename: file.name });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (files.length === 0) return;

    const queue = [...files];
    const failures: string[] = [];
    let done = 0;
    setProgress({ done, total: files.length });
    const worker = async () => {
      for (let file = queue.shift(); file; file = queue.shift()) {
        try {
          await uploadOne(file);
        } catch (error) {
          failures.push(errorMessage(error));
        }
        setProgress({ done: ++done, total: files.length });
      }
    };
    await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, worker));

    const uploaded = files.length - failures.length;
    if (uploaded > 0) {
      toast.success(`${uploaded} file${uploaded === 1 ? "" : "s"} queued for processing`);
    }
    for (const failure of failures) {
      toast.error(failure);
    }
    setFiles([]);
    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const uploading = progress !== null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload lease PDFs</CardTitle>
        <CardDescription>
          Each file is processed in the background: text extraction, chunking
          and embedding. Name files <code className="text-xs">lease-&lt;tenant email&gt;.pdf</code>{" "}
          to link them to the tenant automatically, or link them by hand below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isDemo && (
          <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <LockIcon className="size-3.5" /> The demo account can look around but not upload.
          </p>
        )}
        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
          <Input
            ref={inputRef}
            type="file"
            name="files"
            accept=".pdf,application/pdf"
            multiple
            aria-label="PDF files"
            onChange={(e) => setFiles(Array.from(e.currentTarget.files ?? []))}
            disabled={uploading || isDemo}
          />
          <Button type="submit" disabled={files.length === 0 || uploading || isDemo}>
            <UploadIcon />
            {uploading
              ? `Uploading ${progress.done}/${progress.total}…`
              : files.length > 1
                ? `Upload ${files.length} files`
                : "Upload"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
