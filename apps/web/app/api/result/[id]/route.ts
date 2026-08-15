import { gatewayUrl } from "@/lib/gateway";

// Pure passthrough: GET /api/result/:job_id → Gateway GET /api/jobs/{id}.
// The result page itself fetches Gateway directly via
// lib/gateway.ts's fetchJob() instead of calling this route — this exists for
// the documented browser-facing contract, not as the only way to read a Job.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await fetch(gatewayUrl(`/api/jobs/${id}`), { cache: "no-store" });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
