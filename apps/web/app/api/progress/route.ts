import type { NextRequest } from "next/server";

import { gatewayUrl } from "@/lib/gateway";

// Pure passthrough: GET /api/progress?job_id=xxx → Gateway GET
// /api/jobs/{id}/stream. Streams the SSE body straight through instead
// of buffering — the browser needs events as Gateway emits them, not all at
// once when the connection finally closes.
export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("job_id");
  if (!jobId) {
    return new Response("missing job_id", { status: 400 });
  }

  const res = await fetch(gatewayUrl(`/api/jobs/${jobId}/stream`));
  return new Response(res.body, {
    status: res.status,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
