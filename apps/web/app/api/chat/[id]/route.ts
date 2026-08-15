import { gatewayUrl } from "@/lib/gateway";

// Pure passthrough: POST /api/chat/:job_id → Gateway POST /api/jobs/{id}/chat.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.text();
  const res = await fetch(gatewayUrl(`/api/jobs/${id}/chat`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const resBody = await res.text();
  return new Response(resBody, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
