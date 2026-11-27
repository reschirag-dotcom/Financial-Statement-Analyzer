import { createServerFn } from "@tanstack/react-start";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type WaitlistEntry = { email: string; joinedAt: string };
export type JoinWaitlistResult = { ok: true } | { ok: false; error: string };

const WAITLIST_FILE = path.resolve(process.cwd(), "waitlist.json");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readEntries(): WaitlistEntry[] {
  try {
    const parsed: unknown = JSON.parse(readFileSync(WAITLIST_FILE, "utf8"));
    if (Array.isArray(parsed)) return parsed as WaitlistEntry[];
  } catch {
    // Missing or unparseable file — start fresh.
  }
  return [];
}

/**
 * Server function backing the waitlist form. POSTs the email, appends it to
 * `waitlist.json` in the site directory (created on first use), and never
 * exposes the file contents to the client.
 */
export const joinWaitlist = createServerFn({ method: "POST" })
  .validator((data: unknown): { email: string } => {
    const raw =
      typeof data === "object" && data !== null && "email" in data
        ? (data as { email?: unknown }).email
        : undefined;
    return { email: typeof raw === "string" ? raw.trim().toLowerCase() : "" };
  })
  .handler(async ({ data }): Promise<JoinWaitlistResult> => {
    if (!EMAIL_RE.test(data.email)) {
      return { ok: false, error: "Please enter a valid email address." };
    }

    const entries = readEntries();
    if (!entries.some((entry) => entry.email === data.email)) {
      entries.push({ email: data.email, joinedAt: new Date().toISOString() });
      writeFileSync(WAITLIST_FILE, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
    }
    return { ok: true };
  });