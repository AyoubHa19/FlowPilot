import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="text-lg font-medium">Page not found</p>
      <p className="text-sm text-muted-foreground">The link may be wrong or the page was moved.</p>
      <Link href="/inbox" className="text-sm underline underline-offset-4">
        Go to the inbox
      </Link>
    </main>
  );
}
