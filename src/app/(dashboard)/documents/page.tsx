"use client";

import { DocumentSearch } from "@/components/documents/document-search";
import { DocumentTable } from "@/components/documents/document-table";
import { DocumentUpload } from "@/components/documents/document-upload";

export default function DocumentsPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Documents</h1>
      <DocumentUpload />
      <DocumentSearch />
      <h2 className="text-lg font-medium">Files</h2>
      <DocumentTable />
    </>
  );
}
