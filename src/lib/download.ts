/** Saves text as a file in the browser. */
export function downloadFile(filename: string, content: string, type: string) {
  // A UTF-8 byte order mark makes Excel read umlauts (Straße) correctly.
  // The importer strips it again: it trims header names.
  const body = type === "text/csv" ? `﻿${content}` : content;
  const url = URL.createObjectURL(new Blob([body], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
