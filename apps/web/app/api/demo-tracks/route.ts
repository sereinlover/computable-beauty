import { gatewayUrl } from "@/lib/gateway";

export async function GET() {
  const res = await fetch(gatewayUrl("/api/demo-tracks"));
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
