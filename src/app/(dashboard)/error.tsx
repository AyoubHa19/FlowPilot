"use client";

import { RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Error boundary for every dashboard page. Convex queries throw here when
 * they fail (e.g. an expired session); the rest of the layout stays usable.
 */
export default function DashboardError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const message = error instanceof Error ? error.message : String(error);
  const signedOut = /not authenticated/i.test(message);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
      <p className="font-medium">{signedOut ? "Your session has expired" : "Something went wrong"}</p>
      <p className="text-sm text-muted-foreground">
        {signedOut
          ? "Sign in again to continue."
          : "This page could not load its data. Nothing was lost; try again in a moment."}
      </p>
      {signedOut ? (
        <Link href="/signin" className="text-sm underline underline-offset-4">
          Sign in
        </Link>
      ) : (
        <Button variant="outline" onClick={() => retry()}>
          <RotateCcwIcon />
          Try again
        </Button>
      )}
    </div>
  );
}
