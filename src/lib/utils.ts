import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Format elapsed seconds as "0m 0s", "1m 23s", "1h 5m 30s" for live timer display */
export function formatDurationWithSeconds(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

/** First 4 letters from project name, uppercased (e.g. "Fenceworkshop" -> "FENC"). Fallback "PRJ" if none. */
export function getProjectPrefix(projectName: string): string {
  const letters = (projectName || "")
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 4)
    .toUpperCase();
  return letters || "PRJ";
}

/** Task identifier with project prefix: FENC-001, FENC-002, etc. */
export function formatTaskIdentifierWithProject(
  taskNumber: number | null | undefined,
  projectName: string
): string {
  if (taskNumber == null) return `${getProjectPrefix(projectName)}-???`;
  return `${getProjectPrefix(projectName)}-${String(taskNumber).padStart(3, "0")}`;
}
