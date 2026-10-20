"use client";

import { DocumentSearch } from "@/components/documents/document-search";
import { DocumentTable } from "@/components/documents/document-table";
import { DocumentUpload } from "@/components/documents/document-upload";
import { PageHeader } from "@/components/page-header";

export default function DocumentsPage() {
  return (
    <>
      <PageHeader
        title="Documents"
        description="Lease PDFs, searchable by the agent. Each tenant's search only ever sees their own lease."
      />
      <DocumentUpload />
      <DocumentSearch />
      <h2 className="text-lg font-medium">Files</h2>
      <DocumentTable />
    </>
  );
}
