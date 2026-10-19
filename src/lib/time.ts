"use client";

import { useEffect, useState } from "react";

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

/** "12 seconds ago", "3 minutes ago", or a date for anything older than a day. */
export function timeAgo(timestamp: number, now: number) {
  const seconds = Math.round((timestamp - now) / 1000);
  if (Math.abs(seconds) < 60) return relative.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, "hour");
  return dateTime.format(timestamp);
}

export function formatDateTime(timestamp: number) {
  return dateTime.format(timestamp);
}

/** Current time, refreshed every `intervalMs`, for live "x ago" labels. */
export function useNow(intervalMs = 10_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
