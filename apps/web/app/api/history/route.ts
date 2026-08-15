import type { NextRequest } from "next/server";

import { gatewayUrl } from "@/lib/gateway";

// Pure passthrough: GET /api/history → Gateway GET /api/jobs. Query string
// (limit/offset) is forwarded as-is. Used by client
// components that need to refetch the list after something changes (e.g.
// AnalyzeWorkspace once a job finishes) — Server Components fetch Gateway
// directly via lib/gateway.ts's fetchJobs() instead of calling this route.
export async function GET(req: NextRequest) {
  const res = await fetch(gatewayUrl(`/api/jobs${req.nextUrl.search}`), { cache: "no-store" });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
