"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/** The signed-in user and their role; demo accounts see read-only controls. */
export function useViewer() {
  const viewer = useQuery(api.users.viewer);
  return { viewer, isDemo: viewer?.role === "demo" };
}

export const DEMO_HINT = "The demo account can only act on simulated emails.";
