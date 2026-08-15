import { gatewayUrl } from "@/lib/gateway";

// Pure passthrough: POST /api/analyze → Gateway POST /api/jobs.
// `formData()` re-encodes as multipart automatically, matching Gateway's
// `audioFormField = "audio"` — no manual boundary handling needed.
export async function POST(req: Request) {
  const formData = await req.formData();
  const res = await fetch(gatewayUrl("/api/jobs"), {
    method: "POST",
    body: formData,
  });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
