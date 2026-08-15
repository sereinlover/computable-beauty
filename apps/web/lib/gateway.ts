import type { Job, ListJobResponse } from "@contracts/types";

// Route Handlers are pure passthrough to Gateway — this only builds the
// target URL, it does not parse or reshape the {code, message, data} envelope.
const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:8080";

export function gatewayUrl(path: string): string {
  return `${GATEWAY_URL}${path}`;
}

// Shape of every apps/web `/api/*` response, since Route Handlers pass
// Gateway's {code, message, data} envelope through unchanged.
export interface GatewayEnvelope<T> {
  code: number;
  message: string;
  data?: T;
}

// Server-only. Fetches a Job directly from Gateway rather than through this
// app's own /api/result/[id] route — that route exists for the browser-facing
// contract, but a Server Component calling it would just be an unnecessary
// self-referential HTTP hop within the same process.
export async function fetchJob(id: string): Promise<Job | null> {
  const res = await fetch(gatewayUrl(`/api/jobs/${id}`), { cache: "no-store" });
  const body: GatewayEnvelope<Job> = await res.json();
  if (body.code !== 20000 || !body.data) return null;
  return body.data;
}

// Server-only, same reasoning as fetchJob. Always filters to status=done:
// HistoryItem renders nothing for a job without a result, so without this
// filter an in-progress job in one of the most recent rows would silently
// shrink the visible list below `limit`.
export async function fetchJobs(limit?: number, offset?: number): Promise<ListJobResponse> {
  const params = new URLSearchParams({ status: "done" });
  if (limit) params.set("limit", String(limit));
  if (offset) params.set("offset", String(offset));
  const res = await fetch(gatewayUrl(`/api/jobs?${params}`), { cache: "no-store" });
  const body: GatewayEnvelope<ListJobResponse> = await res.json();
  if (body.code !== 20000 || !body.data) return { items: [], total: 0 };
  return body.data;
}

// Server-only. Seeds AnalyzeWorkspace's in-flight job tracking so a
// still-running job doesn't "disappear" on refresh (activeJobs is plain
// React state). `?status=` takes one value, so there's no single filter for
// "not done and not failed" — fetch unfiltered and filter client-side, then
// sort ascending by created_at to match FIFO submission order.
export async function fetchActiveJobs(limit = 20): Promise<Job[]> {
  const res = await fetch(gatewayUrl(`/api/jobs?limit=${limit}`), { cache: "no-store" });
  const body: GatewayEnvelope<ListJobResponse> = await res.json();
  if (body.code !== 20000 || !body.data) return [];
  return body.data.items
    .filter((job) => job.status !== "done" && job.status !== "failed")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}
