const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

export function formatEuro(cents: number) {
  return euro.format(cents / 100);
}

/** Formats an ISO "YYYY-MM-DD" date without timezone shifts. */
export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return date.format(new Date(Date.UTC(y, m - 1, d)));
}

export function humanize(value: string) {
  const text = value.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
